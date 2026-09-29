"""
Crunch access reader — runs on the gym PC, next to the fingerprint device.

It only READS from the device (eSSL/ZKTeco over the LAN, port 4370): device info, the user list
(IDs and names — never fingerprint templates) and scan records. It never changes the device, so
the old software keeps working exactly as before.

What it writes to the CRM (Firestore, with the reader's own service-account key):
  • gyms/{gym}/devices/{device}          lastSeenAt / lastSyncAt / firmware / lastError (heartbeat)
  • gyms/{gym}/devices/{device}/deviceUsers/{userId}   the device's user list, for matching
  • accessEvents/{key}                   scans of device users linked to a CRM member, once each
                                         (others are ignored; linking someone later backfills theirs)
  • biometricIdentities/{device}_{user}  SYNCED when that user really exists on the device
  • members/{id}.lastVisitAt             after a verified scan

Same rules as the CRM code in src/lib/access/index.ts (eligibility, event key, result).

Run:  python crunch_reader.py            (uses config.json next to this file)
Test: python crunch_reader.py --once     (one full pass, then exit)
"""
import argparse
import datetime as dt
import json
import logging
import logging.handlers
import os
import re
import sys
import time

from google.cloud import firestore
from zk import ZK

HERE = os.path.dirname(os.path.abspath(__file__))
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
VERIFY = {0: 'password', 1: 'fingerprint', 2: 'card', 3: 'password', 4: 'card', 15: 'face'}
OVERRIDE_LABEL = {'blocked': 'Blocked by staff', 'suspended': 'Membership suspended'}

DEFAULTS = {
    'deviceIp': '192.168.1.4',
    'devicePort': 4370,
    'commKey': 0,                 # the device's Comm Key (Menu → Comm. → PC Connection)
    'gymId': 'crunch-wakad',
    'serviceAccount': 'serviceAccount.json',
    'pollSeconds': 15,            # how often to look for new scans
    'heartbeatSeconds': 60,       # how often to tell the CRM the device is reachable
    'usersEveryMinutes': 30,      # how often to refresh the device's user list
}

log = logging.getLogger('crunch-reader')


# ── Config & state ───────────────────────────────────────────────────────────
def load_config():
    cfg = dict(DEFAULTS)
    path = os.path.join(HERE, 'config.json')
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            cfg.update(json.load(f))
    return cfg


STATE_PATH = os.path.join(HERE, 'state.json')


def load_state():
    try:
        with open(STATE_PATH, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(state):
    tmp = STATE_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(state, f)
    os.replace(tmp, STATE_PATH)


# ── Same logic as src/lib/access/index.ts ────────────────────────────────────
def event_key(gym_id, device_id, device_user_id, local_time):
    parts = [gym_id, device_id, device_user_id, local_time.strftime('%Y-%m-%dT%H:%M:%S')]
    return '__'.join(re.sub(r'[^A-Za-z0-9:._-]', '_', p) for p in parts)


def to_iso(local_time):
    """Device wall-clock (India) → the ISO instant format the CRM stores ('…T…:…:….000Z')."""
    utc = local_time.replace(tzinfo=IST).astimezone(dt.timezone.utc)
    return utc.strftime('%Y-%m-%dT%H:%M:%S.') + f'{utc.microsecond // 1000:03d}Z'


def eligibility(member, day):
    """(eligible, reason) — eligible is True, False or None (no membership on record)."""
    override = member.get('accessOverride')
    if override:
        reason = OVERRIDE_LABEL.get(override, 'Access stopped by staff')
        if member.get('accessOverrideReason'):
            reason += f" — {member['accessOverrideReason']}"
        return False, reason
    if member.get('status') == 'inactive':
        return False, 'Membership marked inactive'
    end = member.get('membershipEnd')
    if not end:
        return None, 'No gym membership on record'
    if end < day:
        return False, f'Membership expired on {end}'
    return True, 'Active membership'


def evaluate(device_user_id, identity, member, day):
    if not identity or not member:
        return None, 'unknown_user', f'Device user {device_user_id} isn’t linked to a member'
    if identity.get('status') in ('DISABLED', 'REMOVED'):
        return identity['memberId'], 'access_disabled', 'Access disabled for this device user'
    ok, reason = eligibility(member, day)
    # The membership on the day of the scan decides (a scan from July is judged by July's membership)
    return identity['memberId'], ('granted' if ok else 'denied'), reason


# ── Reader ───────────────────────────────────────────────────────────────────
class Reader:
    def __init__(self, cfg, db):
        self.cfg = cfg
        self.db = db
        self.gym = cfg['gymId']
        self.state = load_state()
        self.device_id = None
        self.serial = None
        self.firmware = None
        self.identities = {}      # deviceUserId → identity dict (live from Firestore)
        self.members = {}         # memberId → (fetched_at, member dict)
        self.last_heartbeat = 0.0
        self.last_users = 0.0
        self.last_full_read = 0.0
        self.last_error = None
        self.device_users = set()
        self._unsub = None

    # Device ------------------------------------------------------------------
    def connect(self):
        zk = ZK(self.cfg['deviceIp'], port=int(self.cfg['devicePort']), timeout=15,
                password=int(self.cfg['commKey']), force_udp=False, ommit_ping=True)
        return zk.connect()

    def with_device(self, fn):
        conn = None
        try:
            conn = self.connect()
            return fn(conn)
        finally:
            if conn:
                try:
                    conn.disconnect()
                except Exception:  # noqa: BLE001 — a failed goodbye isn't worth failing the cycle
                    pass

    # CRM ---------------------------------------------------------------------
    def find_device_doc(self):
        """The device added in the CRM (Settings → Access control) with this serial number."""
        for d in self.db.collection('gyms').document(self.gym).collection('devices').stream():
            if (d.to_dict().get('serialNumber') or '').upper() == self.serial.upper():
                return d.id
        return None

    def watch_identities(self):
        q = (self.db.collection('biometricIdentities')
             .where(filter=firestore.FieldFilter('gymId', '==', self.gym))
             .where(filter=firestore.FieldFilter('deviceId', '==', self.device_id)))

        def on_change(docs, changes, _read_time):
            fresh = []
            for ch in changes:
                data = ch.document.to_dict()
                if ch.type.name == 'REMOVED':
                    self.identities.pop(data.get('deviceUserId'), None)
                else:
                    before = self.identities.get(data.get('deviceUserId'))
                    self.identities[data['deviceUserId']] = {**data, 'id': ch.document.id}
                    if not before or before.get('memberId') != data.get('memberId') or before.get('status') != data.get('status'):
                        fresh.append(data['deviceUserId'])
            if fresh:
                self.state.setdefault('relink', [])
                self.state['relink'] = sorted(set(self.state['relink']) | set(fresh))

        self._unsub = q.on_snapshot(on_change)

    def member(self, member_id):
        hit = self.members.get(member_id)
        if hit and time.time() - hit[0] < 300:
            return hit[1]
        snap = self.db.collection('members').document(member_id).get()
        data = snap.to_dict() if snap.exists else None
        self.members[member_id] = (time.time(), data)
        return data

    def heartbeat(self, synced=False, error=None):
        if not self.device_id:
            return
        patch = {'lastSeenAt': firestore.SERVER_TIMESTAMP, 'firmware': self.firmware, 'lastError': error}
        if synced:
            patch['lastSyncAt'] = firestore.SERVER_TIMESTAMP
        self.db.collection('gyms').document(self.gym).collection('devices').document(self.device_id).update(patch)
        self.last_heartbeat = time.time()

    def report_error(self, message):
        self.last_error = message
        if self.device_id:
            try:
                self.db.collection('gyms').document(self.gym).collection('devices').document(self.device_id).update({'lastError': message})
            except Exception as e:  # noqa: BLE001
                log.warning('could not record the error in the CRM: %s', e)

    # Steps -------------------------------------------------------------------
    def identify(self):
        def read(conn):
            return conn.get_serialnumber(), conn.get_firmware_version()
        self.serial, self.firmware = self.with_device(read)
        self.device_id = self.find_device_doc()
        if not self.device_id:
            raise SystemExit(
                f'This device (serial {self.serial}) isn’t in the CRM yet. Add it in Settings → Access control → '
                f'Add device, with serial number {self.serial}, then start the reader again.')
        log.info('device %s (firmware %s) is CRM device %s', self.serial, self.firmware, self.device_id)
        self.watch_identities()

    def sync_users(self):
        users = self.with_device(lambda conn: conn.get_users())
        col = self.db.collection('gyms').document(self.gym).collection('devices').document(self.device_id).collection('deviceUsers')
        known = self.state.get('users', {})
        batch, n, current = self.db.batch(), 0, {}
        for u in users:
            uid = str(u.user_id).strip()
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,24}', uid):
                continue
            row = {'deviceUserId': uid, 'name': (u.name or '').strip(), 'admin': u.privilege == 14, 'hasCard': bool(u.card)}
            current[uid] = row
            if known.get(uid) != row:
                batch.set(col.document(uid), {**row, 'updatedAt': firestore.SERVER_TIMESTAMP})
                n += 1
                if n % 400 == 0:
                    batch.commit()
                    batch = self.db.batch()
        for uid in set(known) - set(current):       # removed from the device
            batch.delete(col.document(uid))
            n += 1
        batch.commit()
        self.state['users'] = current
        self.device_users = set(current)
        save_state(self.state)
        self.last_users = time.time()
        if n:
            log.info('device user list: %d users (%d changed)', len(current), n)
        self.sync_identity_status()

    def sync_identity_status(self):
        """A linked member is SYNCED once their user ID really exists on the device."""
        for uid, ident in list(self.identities.items()):
            present = uid in self.device_users
            status = ident.get('status')
            ref = self.db.collection('biometricIdentities').document(ident['id'])
            if present and status in ('PENDING', 'ENROLLED', 'SYNC_FAILED'):
                ref.update({'status': 'SYNCED', 'lastSyncedAt': firestore.SERVER_TIMESTAMP, 'lastSyncAttemptAt': firestore.SERVER_TIMESTAMP, 'lastSyncError': None, 'updatedAt': firestore.SERVER_TIMESTAMP})
            elif not present and status == 'SYNCED':
                ref.update({'status': 'SYNC_FAILED', 'lastSyncAttemptAt': firestore.SERVER_TIMESTAMP, 'lastSyncError': 'This user ID is no longer on the device', 'updatedAt': firestore.SERVER_TIMESTAMP})

    def record(self, rows):
        """Write scans (idempotent: the same scan always has the same document id)."""
        if not rows:
            return 0
        batch, n = self.db.batch(), 0
        visits = {}
        for att in rows:
            uid = str(att.user_id).strip()
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,24}', uid):
                continue
            ident = self.identities.get(uid)
            if not ident:
                continue      # not a CRM member (yet): the scan stays on the device, untouched
            member = self.member(ident['memberId'])
            day = att.timestamp.strftime('%Y-%m-%d')
            member_id, result, reason = evaluate(uid, ident, member, day)
            key = event_key(self.gym, self.device_id, uid, att.timestamp)
            batch.set(self.db.collection('accessEvents').document(key), {
                'gymId': self.gym, 'deviceId': self.device_id, 'deviceUserId': uid, 'memberId': member_id,
                'at': to_iso(att.timestamp), 'verify': VERIFY.get(att.status, 'unknown'), 'result': result, 'reason': reason,
                'statusCode': str(att.punch), 'receivedAt': firestore.SERVER_TIMESTAMP, 'source': 'crunch-reader',
            })
            n += 1
            if result == 'granted' and member_id:
                t = att.timestamp.replace(tzinfo=IST)
                if member_id not in visits or visits[member_id] < t:
                    visits[member_id] = t
            if n % 400 == 0:
                batch.commit()
                batch = self.db.batch()
        batch.commit()
        for member_id, t in visits.items():
            m = self.member(member_id) or {}
            last = m.get('lastVisitAt')
            if not last or last < t:
                self.db.collection('members').document(member_id).update({'lastVisitAt': t})
                m['lastVisitAt'] = t
        return n

    def poll_scans(self, force=False):
        state = self.state
        def read(conn):
            conn.read_sizes()
            if not force and conn.records == state.get('records') and time.time() - self.last_full_read < 600:
                return None
            return conn.records, conn.get_attendance()
        got = self.with_device(read)
        if got is None:
            return 0
        count, rows = got
        self.last_full_read = time.time()
        after = state.get('lastScan')
        fresh = [r for r in rows if after is None or r.timestamp.strftime('%Y-%m-%dT%H:%M:%S') > after]
        written = self.record(fresh)
        if rows:
            state['lastScan'] = max(r.timestamp for r in rows).strftime('%Y-%m-%dT%H:%M:%S')
        state['records'] = count
        save_state(state)
        if written:
            log.info('recorded %d scan(s) of CRM members%s', written, ' (history)' if after is None else '')
        return written

    def relink(self):
        """Newly linked device users: read their earlier scans from the device and record them."""
        pending = set(self.state.get('relink') or [])
        if not pending:
            return
        rows = self.with_device(lambda conn: conn.get_attendance())
        mine = [r for r in rows if str(r.user_id).strip() in pending]
        n = self.record(mine)
        self.state['relink'] = []
        save_state(self.state)
        self.sync_identity_status()
        log.info('linked %d device user(s): recorded %d earlier scan(s) from the device', len(pending), n)

    # Loop --------------------------------------------------------------------
    def run(self, once=False):
        self.identify()
        self.heartbeat()
        failures = 0
        while True:
            try:
                if time.time() - self.last_users > self.cfg['usersEveryMinutes'] * 60:
                    self.sync_users()
                wrote = self.poll_scans(force=once)
                self.relink()
                if wrote or time.time() - self.last_heartbeat > self.cfg['heartbeatSeconds'] or self.last_error:
                    self.heartbeat(synced=bool(wrote))
                    self.last_error = None
                failures = 0
            except Exception as e:  # noqa: BLE001 — keep running; report and retry
                failures += 1
                msg = f'{type(e).__name__}: {e}'
                log.warning('cycle failed (%d in a row): %s', failures, msg)
                if failures >= 3:
                    self.report_error(f'Reader can’t reach the device: {msg}')
            if once:
                return
            time.sleep(self.cfg['pollSeconds'] if failures == 0 else min(120, 15 * failures))


def main():
    ap = argparse.ArgumentParser(description='Crunch access reader')
    ap.add_argument('--once', action='store_true', help='one full pass, then exit')
    ap.add_argument('--emulator', help='host:port of a local Firestore emulator (testing only)')
    args = ap.parse_args()

    handler = logging.handlers.RotatingFileHandler(os.path.join(HERE, 'reader.log'), maxBytes=2_000_000, backupCount=3, encoding='utf-8')
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s', handlers=[handler, logging.StreamHandler(sys.stdout)])

    cfg = load_config()
    if args.emulator:
        from google.auth.credentials import AnonymousCredentials
        os.environ['FIRESTORE_EMULATOR_HOST'] = args.emulator
        db = firestore.Client(project='demo-crunch', credentials=AnonymousCredentials())
        cfg['gymId'] = cfg.get('gymId', 'crunch-wakad')
    else:
        key = cfg['serviceAccount'] if os.path.isabs(cfg['serviceAccount']) else os.path.join(HERE, cfg['serviceAccount'])
        if not os.path.exists(key):
            raise SystemExit(f'Missing the reader’s Firebase key: {key}\n(Firebase console → Project settings → Service accounts → Generate new private key)')
        db = firestore.Client.from_service_account_json(key)
    log.info('reader starting — device %s:%s, gym %s', cfg['deviceIp'], cfg['devicePort'], cfg['gymId'])
    Reader(cfg, db).run(once=args.once)


if __name__ == '__main__':
    main()
