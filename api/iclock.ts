import type { IncomingMessage } from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { firestoreOrNull } from './_lib/firebase.js';
import { ingestScans } from './_lib/ingest.js';
import { ENFORCE_FULL_MS, ENFORCE_MODE, ENFORCE_QUICK_MS, istDay, planAccess, type EnforceIdentity, type EnforceMember } from './_lib/enforce.js';
import { meterFor, returnUsage, takeUsage, type Meter } from './_lib/usage.js';
import { PROBE_SN, commandVerbs, logLine, recordContact, requestKind, summarize, type Outcome, type RequestSummary } from './_lib/diagnostics.js';
import {
  OUR_ID, commandText, ownHandshake, parseAttlog, parseCommandResults, parseFingerprintPins, parseUsers, type CommandType,
} from './_lib/adms.js';

// ADMS relay for the gym's fingerprint device (eSSL X2008). The device's "Cloud Server" points
// here; every request is passed on UNCHANGED to the old attendance software's server, and its
// reply goes back to the device — so the old system keeps working exactly as before. On the way
// through, the CRM records scans of linked members, keeps the device's user list for matching,
// and adds its own commands (create a user, start fingerprint enrolment).
//
// Safety: a scan upload is only acknowledged to the device if the old server acknowledged it, so
// the old system can never miss data because of the relay. If the old server is unreachable, the
// device is told to try again later (as it would be without the relay).
//
// Env: FIREBASE_SERVICE_ACCOUNT (JSON of a service account key) — without it the relay still
// passes everything through, it just records nothing. ADMS_UPSTREAM (default the old server);
// set it to "none" once the old software is retired.

const GYM = 'crunch-wakad';
// Read on each request (like the other ADMS_* settings), so switching it needs no code change.
// Since 27 Oct 2026 production runs with "none": the CRM answers the device itself.
const UPSTREAM = () => (process.env.ADMS_UPSTREAM ?? 'http://122.160.158.120:5072').replace(/\/$/, '');
const HAS_UPSTREAM = () => UPSTREAM() !== 'none' && UPSTREAM() !== '';

export const config = { api: { bodyParser: false } };

const firestore = firestoreOrNull;

/**
 * The request body, byte for byte. Uses 'data'/'end' listeners on purpose: Vercel's Node runtime
 * reads the body before our handler runs and re-attaches it only to those listeners
 * (@vercel/node restoreBody). Iterating the stream (`for await`) would see an already-finished
 * stream there and return an empty body — and an empty scan upload must never be forwarded.
 */
function rawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer | string) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** The device's own query string, without the routing parameter the rewrite adds. */
function deviceQuery(req: VercelRequest) {
  const url = new URL(req.url ?? '/', 'http://relay');
  url.searchParams.delete('path');
  return url.search;
}

const FORWARD_HEADERS = ['content-type', 'user-agent', 'accept', 'cookie', 'pragma'];
async function forward(req: VercelRequest, path: string, body: Buffer | null) {
  const headers: Record<string, string> = {};
  for (const h of FORWARD_HEADERS) {
    const v = req.headers[h];
    if (typeof v === 'string') headers[h] = v;
  }
  return forwardRaw(req.method ?? 'GET', path, deviceQuery(req), headers, body);
}
async function forwardRaw(method: string, path: string, query: string, headers: Record<string, string>, body: Buffer | null) {
  const res = await fetch(`${UPSTREAM()}/iclock/${path}${query}`, {
    method, headers, body: body && body.length ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(20_000),
  });
  return { status: res.status, type: res.headers.get('content-type') ?? 'text/plain', date: res.headers.get('date'), body: Buffer.from(await res.arrayBuffer()) };
}

/**
 * When the old server is down the CRM keeps working (ADMS_OUTAGE_MODE "keep", the default): it
 * answers the device itself — its own handshake, its own commands, "OK" to uploads — and every
 * upload is first saved (admsReplay/{SN}/uploads) and sent to the old server, oldest first, once
 * it answers again; scans carry their own times, so the old system gets them as they happened.
 * If the copy can't be saved, the device is told to retry instead, as before. "retry": the old
 * behaviour — nothing acknowledged while the old server is down.
 */
const OUTAGE_MODE = () => (process.env.ADMS_OUTAGE_MODE === 'retry' ? 'retry' : 'keep');
/** After the old server fails to answer, don't wait on it again for this long (the device polls every few seconds) */
const UPSTREAM_RETRY_MS = () => Number(process.env.ADMS_UPSTREAM_RETRY_MS ?? 60_000);
let upstreamDownUntil = 0;
const replayCol = (fs: Firestore, sn: string) => fs.collection('admsReplay').doc(sn.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60)).collection('uploads');
/** A saved upload the old server keeps refusing is given up after this many tries — never one with scans */
const REPLAY_GIVE_UP = 20;
const replayIdleUntil = new Map<string, number>();
async function saveForOldServer(fs: Firestore, sn: string, req: VercelRequest, path: string, body: Buffer, hasScans: boolean) {
  const headers: Record<string, string> = {};
  for (const h of FORWARD_HEADERS) { const v = req.headers[h]; if (typeof v === 'string') headers[h] = v; }
  await replayCol(fs, sn).doc().set({ path, query: deviceQuery(req), method: req.method ?? 'POST', headers, body: body.toString('utf8'), bytes: body.length, hasScans, atMs: Date.now(), tries: 0 });
  replayIdleUntil.delete(sn);
}
/** Send saved uploads to the old server, oldest first; stops at the first one it doesn't take */
async function drainReplay(fs: Firestore, sn: string, meter: Meter) {
  if (Date.now() < (replayIdleUntil.get(sn) ?? 0)) return;
  if (!(await claim(`replay/${sn}`, 15_000))) return;
  const snap = await replayCol(fs, sn).orderBy('atMs').limit(5).get();
  meter.read('replay', Math.max(1, snap.size));
  if (snap.empty) { replayIdleUntil.set(sn, Date.now() + 5 * 60_000); return; }
  for (const d of snap.docs) {
    const body = Buffer.from(String(d.get('body') ?? ''), 'utf8');
    let ok = false;
    try {
      const r = await forwardRaw(d.get('method') ?? 'POST', d.get('path'), d.get('query') ?? '', d.get('headers') ?? {}, body);
      ok = r.status < 300;
    } catch { /* tried below in pieces */ }
    if (!ok && !d.get('hasScans') && body.length > PIECE_BYTES()) {
      try {
        const pieceReq = { method: d.get('method') ?? 'POST', headers: d.get('headers') ?? {}, url: `/x${d.get('query') ?? ''}` } as unknown as VercelRequest;
        await forwardInPieces(pieceReq, d.get('path'), body.toString('utf8'));
        ok = true;
      } catch { /* still refused */ }
    }
    if (ok) { await d.ref.delete(); meter.write('replay'); continue; }
    const tries = Number(d.get('tries') ?? 0) + 1;
    if (tries >= REPLAY_GIVE_UP && !d.get('hasScans')) {
      await d.ref.delete();
      console.log(JSON.stringify({ adms: true, kind: 'replay given up', sn, path: d.get('path'), bytes: d.get('bytes'), tries }));
    } else await d.ref.update({ tries, lastTryMs: Date.now() });
    meter.write('replay');
    return;   // keep the order: nothing newer goes before it
  }
  console.log(JSON.stringify({ adms: true, kind: 'replayed to the old server', sn, count: snap.size }));
}

/**
 * An upload WITHOUT scans (the device's users, fingerprint templates, operation log) that the old
 * server dropped. Measured on 27 Oct 2026: it closes the connection on a 65 KB upload of 42
 * fingerprint templates, and the device then re-sent that one upload every ~10 s for hours — no
 * scans and no commands got through behind it. Each line is a record of its own, so it is sent
 * again in pieces of whole lines. If the old server still won't take it after UNSENT_ACK_AFTER
 * tries, the device is told "OK" anyway so it moves on; the device keeps its own copy, and the CRM
 * still records it. Uploads WITH scans are never acknowledged without the old server.
 */
const PIECE_BYTES = () => Number(process.env.ADMS_PIECE_BYTES ?? 16 * 1024);
const UNSENT_ACK_AFTER = 3;
const unsentTries = new Map<string, number>();

/**
 * The old server deletes from the device every user it doesn't know — which includes everyone the
 * CRM adds (seen 27 Oct 2026: "DATA DELETE USERINFO" ×5 right after the CRM added users 18–21; CRM
 * users 10 and 11, fingerprints confirmed, had already disappeared). A delete of a CRM-managed user
 * is therefore not passed to the device. The old server is told it was done (Return=0 on the
 * device's next command report) so it doesn't keep sending it. Its own users are never touched.
 */
// …and its user rewrites too: one would undo a block the CRM put on its own user
const SHIELDED_DELETE = /^C:([^:\s]+):DATA (?:DELETE (?:USERINFO|FINGERTMP|BIODATA|USERPIC|BIOPHOTO|FACE)|UPDATE USERINFO)\b.*?\bPIN=([^\t\s]+)/;
const pendingAcks = new Map<string, string[]>();
const uploadKey = (sn: string, table: string, body: Buffer) => {
  let h = 0;
  for (let i = 0; i < body.length; i += 97) h = (h * 31 + body[i]) | 0;
  return `${sn}|${table}|${body.length}|${h}`;
};
async function forwardInPieces(req: VercelRequest, path: string, text: string) {
  const pieces: string[] = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (cur && cur.length + line.length + 1 > PIECE_BYTES()) { pieces.push(cur); cur = ''; }
    cur += `${line}\n`;
  }
  if (cur) pieces.push(cur);
  if (pieces.length < 2) throw new Error('nothing to split');
  let last: Awaited<ReturnType<typeof forward>> | null = null;
  for (const p of pieces) {
    last = await forward(req, path, Buffer.from(p));
    if (last.status >= 300) throw new Error(`piece answered ${last.status}`);
  }
  return { reply: last!, pieces: pieces.length };
}

// ── CRM side ─────────────────────────────────────────────────────────────────
// Serial → CRM device id. A device's id never changes, so a match is kept 30 minutes; "no device
// with this serial" only 5, so a device added in the CRM is picked up quickly.
const deviceCache = new Map<string, { id: string; at: number }>();
async function deviceIdFor(fs: Firestore, sn: string, meter: Meter) {
  const hit = deviceCache.get(sn);
  if (hit && Date.now() - hit.at < (hit.id ? 30 : 5) * 60_000) return hit.id;
  const snap = await fs.collection('gyms').doc(GYM).collection('devices').where('serialNumber', '==', sn.toUpperCase()).limit(1).get();
  meter.read('deviceLookup', Math.max(1, snap.size));
  const id = snap.docs[0]?.id ?? '';
  deviceCache.set(sn, { id, at: Date.now() });
  return id;
}
const devRef = (fs: Firestore, deviceId: string) => fs.collection('gyms').doc(GYM).collection('devices').doc(deviceId);

/**
 * The device's "last communication" (devices/{id}.lastSeenAt), which the CRM's Online/Offline
 * status reads (online = heard from within 10 minutes). Written at most every HEARTBEAT_MS per
 * device per server instance — well inside that window — and at once when it matters: the first
 * request this instance sees, a device back after a quiet spell (it's been longer than
 * HEARTBEAT_MS), or recovery after an error was recorded on the device.
 */
const HEARTBEAT_MS = () => Number(process.env.ADMS_HEARTBEAT_MS ?? 300_000);
const lastBeat = new Map<string, number>();

/**
 * Shared write gate. A platform that runs several server instances at once (Cloudflare Workers)
 * registers one, so a routine write (heartbeat, diagnostics) happens once per interval in TOTAL,
 * not once per instance: claim(key, ms) is true for the first caller in each interval and false
 * for the rest. Where none is registered (Node, Vercel) every instance writes on its own, as before.
 * Only routine writes use it; errors, device restarts and command results are written at once.
 */
export interface WriteGate { claim(key: string, ms: number): Promise<boolean> }
let writeGate: WriteGate | null = null;
export function registerWriteGate(g: WriteGate) { writeGate = g; }
const claim = (key: string, ms: number) => (writeGate && ms > 0 ? writeGate.claim(key, ms).catch(() => true) : Promise.resolve(true));
const errorShown = new Set<string>();
async function heartbeat(fs: Firestore, deviceId: string, meter: Meter, keepError = false) {
  // keepError: this request was answered without the old server — its notice stays up
  const clearing = errorShown.has(deviceId) && !keepError;
  if (!clearing && Date.now() - (lastBeat.get(deviceId) ?? 0) < HEARTBEAT_MS()) return;
  lastBeat.set(deviceId, Date.now());
  // Another instance wrote it within the interval: nothing to add (an error to clear still writes)
  if (!clearing && !(await claim(`heartbeat/${deviceId}`, HEARTBEAT_MS()))) return;
  if (clearing) errorShown.delete(deviceId);
  await devRef(fs, deviceId).update({ lastSeenAt: FieldValue.serverTimestamp(), ...(keepError ? {} : { lastError: null }), connection: 'relay' });
  meter.write('heartbeat');
}

/**
 * This device's CRM identity records, loaded once per upload with one query (the few people linked
 * in the CRM) instead of looking up every user ID on the device (528 IDs → 528 reads, twice).
 */
type IdentityDoc = FirebaseFirestore.DocumentSnapshot;
/**
 * The links an upload can change. Reading every link on the device for each upload (500+ reads,
 * several uploads per user list) used up the free daily quota, so: a small upload reads just its
 * own users' links; a big one (the whole user list) reads only links still waiting for the device
 * or for a fingerprint — the ones it can change.
 */
async function identitiesFor(fs: Firestore, deviceId: string, pins: string[], wantFingerprints: boolean, meter: Meter) {
  const unique = [...new Set(pins)].filter((p) => /^[A-Za-z0-9_-]{1,24}$/.test(p));
  const col = fs.collection('biometricIdentities');
  let docs: IdentityDoc[];
  if (unique.length <= IDENTITY_GETALL_MAX) {
    docs = unique.length ? (await fs.getAll(...unique.map((p) => col.doc(`${deviceId}_${p}`)))).filter((d) => d.exists) : [];
    meter.read('deviceUsers', Math.max(1, unique.length));
  } else {
    const [waiting, unconfirmed] = await Promise.all([
      col.where('deviceId', '==', deviceId).where('status', 'in', ['PENDING', 'ENROLLED', 'SYNC_FAILED']).get(),
      wantFingerprints ? col.where('deviceId', '==', deviceId).where('enrollment', 'in', ['not_enrolled', 'unverified', 'requested', 'device_accepted', 'failed']).get() : null,
    ]);
    docs = [...waiting.docs, ...(unconfirmed?.docs ?? [])];
    meter.read('deviceUsers', Math.max(1, waiting.size) + (unconfirmed ? Math.max(1, unconfirmed.size) : 0));
  }
  return new Map(docs.map((d) => [String(d.get('deviceUserId')), d]));
}
const IDENTITY_GETALL_MAX = 50;

/**
 * Mirroring a big user list in one request costs more CPU than some platforms allow per request
 * (Workers free plan: 10 ms). With ADMS_USER_CHUNK set, ADMS_USER_CHUNK users are written per
 * request and the rest are kept in a backlog document, written on the device's next polls. The
 * device's answer never waits for or depends on it. 0 (the default) writes the whole list at once.
 */
const USER_CHUNK = () => Number(process.env.ADMS_USER_CHUNK ?? 0);
type DeviceUser = ReturnType<typeof parseUsers>[number];
const backlogRef = (fs: Firestore, deviceId: string) => devRef(fs, deviceId).collection('userBacklog').doc('pending');
const backlogKnown = new Map<string, boolean>();   // per server instance: is there a backlog to write?
async function mirrorUsers(fs: Firestore, deviceId: string, users: DeviceUser[], meter: Meter) {
  const col = devRef(fs, deviceId).collection('deviceUsers');
  for (let i = 0; i < users.length; i += 400) {
    const batch = fs.batch();
    users.slice(i, i + 400).forEach((u) => batch.set(col.doc(u.pin), { deviceUserId: u.pin, name: u.name, admin: u.admin, hasCard: u.hasCard, updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
  }
  meter.write('deviceUsers', users.length);
}
/** On a poll: write the next chunk of a pending user list, if any. */
async function drainUserBacklog(fs: Firestore, deviceId: string, meter: Meter) {
  const chunk = USER_CHUNK();
  if (!chunk || backlogKnown.get(deviceId) === false) return;
  const snap = await backlogRef(fs, deviceId).get();   // once per server instance, then only while pending
  meter.read('deviceUsers');
  const pending = (snap.exists ? (snap.get('users') as DeviceUser[]) : null) ?? [];
  if (!pending.length) { backlogKnown.set(deviceId, false); return; }
  await mirrorUsers(fs, deviceId, pending.slice(0, chunk), meter);
  const rest = pending.slice(chunk);
  if (rest.length) { await backlogRef(fs, deviceId).set({ users: rest, updatedAt: FieldValue.serverTimestamp() }); backlogKnown.set(deviceId, true); }
  else { await backlogRef(fs, deviceId).delete(); backlogKnown.set(deviceId, false); await devRef(fs, deviceId).update({ usersSeenAt: FieldValue.serverTimestamp() }); }
  meter.write('deviceUsers', rest.length ? 1 : 2);
}

/** The device's users (IDs and names only) for the CRM's Match users screen. */
async function recordUsers(fs: Firestore, deviceId: string, users: DeviceUser[], ids: Map<string, IdentityDoc>, meter: Meter) {
  if (!users.length) return;
  // A user now on the device confirms any link waiting for it
  const batch = fs.batch();
  let n = 0;
  for (const u of users) {
    const s = ids.get(u.pin);
    if (s && ['PENDING', 'ENROLLED', 'SYNC_FAILED'].includes(s.get('status'))) { batch.update(s.ref, { status: 'SYNCED', lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp() }); n++; }
  }
  if (n) { await batch.commit(); meter.write('deviceUsers', n); }
  const chunk = USER_CHUNK();
  if (chunk && users.length > chunk) {
    await mirrorUsers(fs, deviceId, users.slice(0, chunk), meter);
    await backlogRef(fs, deviceId).set({ users: users.slice(chunk), updatedAt: FieldValue.serverTimestamp() });
    meter.write('deviceUsers');
    backlogKnown.set(deviceId, true);
    return;   // usersSeenAt is stamped when the backlog is written out
  }
  await mirrorUsers(fs, deviceId, users, meter);
  await devRef(fs, deviceId).update({ usersSeenAt: FieldValue.serverTimestamp() });
  meter.write('deviceUsers');
}

/** Device-side events in the CRM's activity log (who = the device, never a person). */
function audit(batch: FirebaseFirestore.WriteBatch, fs: Firestore, action: string, event: string, ident: FirebaseFirestore.DocumentSnapshot | null, meta: Record<string, string | number | null> = {}) {
  const trainer = ident?.get('personType') === 'trainer';
  batch.set(fs.collection('activity').doc(), {
    action, actorUid: 'device', actorEmail: 'Fingerprint device', refType: ident ? (trainer ? 'trainer' : 'member') : 'device',
    refId: ident ? (trainer ? ident.get('trainerId') : ident.get('memberId')) ?? null : null, meta: { event, ...meta }, at: FieldValue.serverTimestamp(),
  });
}

/**
 * The device reported a fingerprint template for a user ("FP PIN=…" in an upload): the device
 * itself confirms the fingerprint is enrolled. The template is never read or stored.
 */
async function recordFingerprints(fs: Firestore, deviceId: string, pins: string[], ids: Map<string, IdentityDoc>, meter: Meter) {
  if (!pins.length) return;
  const batch = fs.batch();
  let n = 0;
  for (const p of new Set(pins)) {
    const s = ids.get(p);
    if (!s || s.get('status') === 'REMOVED') continue;
    const status = s.get('status') === 'DISABLED' ? 'DISABLED' : 'SYNCED';
    // Already confirmed and in sync: a repeated upload changes nothing (enrolledAt keeps the real time)
    if (s.get('enrollment') === 'confirmed' && s.get('status') === status) continue;
    batch.update(s.ref, {
      status, enrolledAt: FieldValue.serverTimestamp(), lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp(),
      enrollment: 'confirmed', enrollmentConfirmedAt: FieldValue.serverTimestamp(), enrollmentEvidence: 'fingerprint_template_reported', enrollmentError: null,
    });
    if (s.get('enrollment') !== 'confirmed') { audit(batch, fs, 'Fingerprint enrolment confirmed by the device', 'ENROLLMENT_CONFIRMED', s, { deviceUserId: s.get('deviceUserId') }); n++; }
    n++;
  }
  if (n) { await batch.commit(); meter.write('deviceUsers', n); }
}

/**
 * Queued CRM commands → "C:<id>:<command>" lines (at most a few per poll). The device polls every
 * few seconds; looking for queued commands on every poll costs a database read each time, so each
 * server instance looks at most every COMMAND_CHECK_MS (a request reaches the device within ~10s).
 */
// Read on each use (not once at load) so tests can switch between immediate and production timing
const COMMAND_CHECK_MS = () => Number(process.env.ADMS_COMMAND_CHECK_MS ?? 10_000);
const lastCommandCheck = new Map<string, number>();
/**
 * Fast lane: a Firestore listener on this device's queued commands tells this server instance the
 * moment staff queue something (e.g. "Open door"), so it goes out on the very next poll (~3–4 s)
 * instead of waiting for the periodic check. A listener only costs reads when a command is added
 * or changes. While it's healthy the periodic check becomes a 20-second safety net — shorter than
 * an unlock's 30-second expiry, so a silently stalled listener can't make "Open door" expire
 * unsent; if it fails, the 10-second check takes over again. ADMS_COMMAND_LISTEN=0 turns it off.
 */
const COMMAND_SAFETY_MS = 20_000;
/**
 * Platforms that can't hold a Firestore listener (Cloudflare Workers) can register a cheap
 * "a command was just queued" signal instead: staff's notify call (/api/adms?check=notify) sets
 * it, and the device's next poll looks in the queue at once instead of waiting for the periodic
 * check. Only a hint: the queue in Firestore stays the single source of truth, and the periodic
 * check still runs, so a lost signal can only slow a command down, never drop or repeat it.
 */
export interface CommandSignal { raise(deviceId: string): Promise<void>; take(deviceId: string): Promise<boolean> }
let commandSignal: CommandSignal | null = null;
export function registerCommandSignal(s: CommandSignal) { commandSignal = s; }
/** A command was just queued for this device (no-op where the listener already does this). */
export async function signalCommandQueued(deviceId: string) { await commandSignal?.raise(deviceId); }
const queueWatch = new Map<string, { pending: boolean; healthy: boolean }>();
function watchQueue(fs: Firestore, deviceId: string, meter: Meter) {
  if (process.env.ADMS_COMMAND_LISTEN === '0') return null;
  const existing = queueWatch.get(deviceId);
  if (existing) return existing;
  const w = { pending: true, healthy: false };   // look once straight away
  queueWatch.set(deviceId, w);
  try {
    devRef(fs, deviceId).collection('commands').where('status', '==', 'queued').limit(1).onSnapshot((snap) => {
      meter.read('commands', Math.max(1, snap.docChanges().length));
      w.healthy = true;
      if (!snap.empty) w.pending = true;
    }, (e) => { console.error('[iclock] command listener', e.message); queueWatch.delete(deviceId); });
  } catch (e) {
    console.error('[iclock] command listener', (e as Error).message);
    queueWatch.delete(deviceId);
  }
  return w;
}
/** An "Open door" that couldn't reach the device quickly must never fire later (e.g. when an
 *  offline device reconnects hours afterwards): unlock requests expire after this long unsent. */
const UNLOCK_MAX_AGE_MS = 30_000;
/**
 * Safety switch for controlled device tests: ADMS_DELIVER_CRM_COMMANDS=0 sends NO CRM command to
 * the device (Open door, add user, enrolment, user-list requests…) and leaves the queue exactly as
 * it is — not read, not marked sent, not expired. The old server's commands pass through as always.
 * Absent or any other value: delivered as normal.
 */
const DELIVER_CRM_COMMANDS = () => process.env.ADMS_DELIVER_CRM_COMMANDS !== '0';
/** What a failed ENROLL_FP answer means for staff. The X2008 answers 6 when nobody placed a finger
 *  (three times) before the enrolment screen timed out; other codes are shown as they are. */
const enrolError = (ret: string | number) => (String(ret) === '6' ? 'No finger was placed in time — start the enrolment again with the person at the device' : `Device answered ${ret}`);
async function takeCommands(fs: Firestore, deviceId: string, meter: Meter) {
  const w = watchQueue(fs, deviceId, meter);
  const due = Date.now() - (lastCommandCheck.get(deviceId) ?? 0) >= (w?.healthy ? Math.max(COMMAND_SAFETY_MS, COMMAND_CHECK_MS()) : COMMAND_CHECK_MS());
  const signalled = !w?.pending && !due && commandSignal ? await commandSignal.take(deviceId).catch(() => false) : false;
  if (!w?.pending && !due && !signalled) return [];
  // A routine check another server instance already made in this interval adds nothing — each
  // instance looking on its own multiplied the reads (a signal or a listener hint always looks)
  if (due && !w?.pending && !signalled && !(await claim(`commands/${deviceId}`, COMMAND_CHECK_MS()))) { lastCommandCheck.set(deviceId, Date.now()); return []; }
  if (w) w.pending = false;
  lastCommandCheck.set(deviceId, Date.now());
  const snap = await devRef(fs, deviceId).collection('commands').where('status', '==', 'queued').limit(5).get();
  meter.read('commands', Math.max(1, snap.size));
  // More may be waiting (5 per poll): look again on the very next poll instead of in 10 seconds
  if (snap.size) { lastCommandCheck.set(deviceId, 0); if (w) w.pending = true; }
  const lines: string[] = [];
  const batch = fs.batch();
  for (const d of snap.docs.sort((a, b) => (a.get('createdAt')?.toMillis?.() ?? 0) - (b.get('createdAt')?.toMillis?.() ?? 0))) {
    if (d.get('type') === 'unlock_door') {
      const created = d.get('createdAt')?.toMillis?.() as number | undefined;
      if (!created || Date.now() - created > UNLOCK_MAX_AGE_MS) {
        batch.update(d.ref, { status: 'failed', error: 'Expired — the device didn’t collect it within 30 seconds, so it was not sent', doneAt: FieldValue.serverTimestamp() });
        continue;
      }
    }
    const text = commandText({ type: d.get('type') as CommandType, pin: d.get('deviceUserId'), name: d.get('name') });
    if (!text) { batch.update(d.ref, { status: 'failed', error: 'Not a valid command', doneAt: FieldValue.serverTimestamp() }); continue; }
    // 9 digits starting with 9: our range, so results can be told apart from the old server's
    const id = String(900_000_000 + (Math.floor(Date.now() / 10) % 99_000_000) + lines.length);
    lines.push(`C:${id}:${text}`);
    batch.update(d.ref, { status: 'sent', commandId: id, sentAt: FieldValue.serverTimestamp() });
  }
  if (snap.size) { await batch.commit(); meter.write('commands', snap.size); }
  return lines;
}

/**
 * Keeps CRM-managed users blocked/unblocked ON the device (api/_lib/enforce.ts). Runs after the
 * device has been answered. Every CRM-managed user at most every ENFORCE_FULL_MS; in between, only
 * members and links changed since the last look (a renewal or "Enable access" applies within
 * about a minute). One server instance per interval (the shared write gate).
 */
const enforceState = new Map<string, { full: number; quick: number }>();
const toEnforce = (d: FirebaseFirestore.DocumentSnapshot): EnforceIdentity => ({
  id: d.id, deviceUserId: String(d.get('deviceUserId') ?? ''), managedBy: d.get('managedBy') ?? null, accessEnabled: d.get('accessEnabled') ?? null, status: d.get('status') ?? null,
  personType: d.get('personType') ?? null, memberId: d.get('memberId') ?? null, trainerId: d.get('trainerId') ?? null,
  deviceAccess: d.get('deviceAccess') ?? null, deviceAccessPending: d.get('deviceAccessPending') ?? null, deviceAccessPendingAtMs: d.get('deviceAccessPendingAt')?.toMillis?.() ?? null,
});
async function enforceAccess(fs: Firestore, deviceId: string, sn: string, meter: Meter) {
  const mode = ENFORCE_MODE();
  if (mode === 'off') return;
  const st = enforceState.get(deviceId) ?? { full: 0, quick: 0 };
  enforceState.set(deviceId, st);
  const now = Date.now();
  let found: FirebaseFirestore.DocumentSnapshot[];
  let full = false;
  if (now - st.full >= ENFORCE_FULL_MS() && await claim(`enforce-full/${deviceId}`, ENFORCE_FULL_MS())) {
    st.full = now; st.quick = now; full = true;
    // Only the users the CRM controls (a handful) — never every link on the device
    const snap = await fs.collection('biometricIdentities').where('deviceId', '==', deviceId).where('managedBy', '==', 'crm').get();
    meter.read('enforce', Math.max(1, snap.size));
    found = snap.docs;
  } else if (mode === 'on' && now - st.quick >= ENFORCE_QUICK_MS() && await claim(`enforce-quick/${deviceId}`, ENFORCE_QUICK_MS())) {
    // (Dry run: the hourly sweep is enough to see what would change — no per-minute reads)
    // Overlap generously: looking at a change twice does nothing the second time
    const since = new Date((st.quick || now - 2 * ENFORCE_QUICK_MS()) - 120_000);
    st.quick = now;
    const [mSnap, iSnap] = await Promise.all([
      fs.collection('members').where('updatedAt', '>', since).limit(50).get(),
      fs.collection('biometricIdentities').where('updatedAt', '>', since).limit(50).get(),
    ]);
    meter.read('enforce', Math.max(1, mSnap.size) + Math.max(1, iSnap.size));
    const byId = new Map(iSnap.docs.filter((d) => d.get('deviceId') === deviceId).map((d) => [d.id, d]));
    const changed = mSnap.docs.map((d) => d.id);
    for (let k = 0; k < changed.length; k += 30) {
      const s = await fs.collection('biometricIdentities').where('memberId', 'in', changed.slice(k, k + 30)).get();
      meter.read('enforce', Math.max(1, s.size));
      s.docs.filter((d) => d.get('deviceId') === deviceId).forEach((d) => byId.set(d.id, d));
    }
    found = [...byId.values()];
  } else return;

  const ids = found.map(toEnforce).filter((i) => i.managedBy === 'crm' && i.status !== 'REMOVED');
  const memberIds = [...new Set(ids.filter((i) => i.personType !== 'trainer' && i.memberId).map((i) => i.memberId!))];
  const trainerIds = [...new Set(ids.filter((i) => i.personType === 'trainer' && i.trainerId).map((i) => i.trainerId!))];
  const [mDocs, tDocs] = await Promise.all([
    memberIds.length ? fs.getAll(...memberIds.map((id) => fs.collection('members').doc(id))) : Promise.resolve([]),
    trainerIds.length ? fs.getAll(...trainerIds.map((id) => fs.collection('teamMembers').doc(id))) : Promise.resolve([]),
  ]);
  meter.read('enforce', mDocs.length + tDocs.length);
  const members = new Map<string, EnforceMember>(mDocs.filter((d) => d.exists).map((d) => [d.id, { id: d.id, name: d.get('name'), status: d.get('status'), membershipStart: d.get('membershipStart') ?? null, membershipEnd: d.get('membershipEnd') ?? null, accessOverride: d.get('accessOverride') ?? null }]));
  const trainers = new Map<string, { name?: string }>(tDocs.filter((d) => d.exists).map((d) => [d.id, { name: d.get('name') }]));
  const changes = planAccess(ids, members, trainers, istDay(now), now);

  if (mode === 'dry') {
    // What WOULD be sent — recorded for review, nothing goes to the device
    if (!full && !changes.length) return;
    console.log(JSON.stringify({ adms: true, kind: 'access enforcement (dry run)', sn, checked: ids.length, would: changes.map((c) => ({ pin: c.deviceUserId, want: c.want, reason: c.reason })) }));
    await fs.collection('admsDiagnostics').doc(`${sn.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 50)}_enforce`).set({
      sn, mode, at: FieldValue.serverTimestamp(), full, checked: ids.length,
      would: changes.map((c) => ({ deviceUserId: c.deviceUserId, want: c.want, reason: c.reason })),
    });
    meter.write('enforce');
    return;
  }
  if (!changes.length) return;
  const batch = fs.batch();
  for (const c of changes) {
    batch.set(devRef(fs, deviceId).collection('commands').doc(), {
      type: c.want === 'blocked' ? 'block_user' : 'unblock_user', deviceUserId: c.deviceUserId, name: c.name.slice(0, 40), personType: c.personType, personId: c.personId,
      reason: c.reason, status: 'queued', createdBy: 'CRM access control', createdAt: FieldValue.serverTimestamp(),
    });
    batch.update(fs.collection('biometricIdentities').doc(c.identityId), { deviceAccessPending: c.want, deviceAccessPendingAt: FieldValue.serverTimestamp(), deviceAccessReason: c.reason });
  }
  await batch.commit();
  meter.write('enforce', changes.length * 2);
  lastCommandCheck.set(deviceId, 0);   // send them on the very next poll
  console.log(JSON.stringify({ adms: true, kind: 'access enforcement', sn, queued: changes.map((c) => ({ pin: c.deviceUserId, want: c.want, reason: c.reason })) }));
}

/**
 * The device's answers to OUR commands. "Return=0" means the device carried the command out;
 * anything else is a failure, reported with the device's own code. For fingerprint enrolment a
 * successful answer means the device accepted the request — the enrolment itself is confirmed
 * only by the device reporting the fingerprint (or a fingerprint-verified scan).
 */
async function recordResults(fs: Firestore, deviceId: string, results: ReturnType<typeof parseCommandResults>, meter: Meter) {
  for (const r of results) {
    const snap = await devRef(fs, deviceId).collection('commands').where('commandId', '==', r.id).limit(1).get();
    meter.read('results', Math.max(1, snap.size));
    const d = snap.docs[0];
    if (!d) continue;
    // A result the device sends again (e.g. our reply didn't reach it) changes nothing a second time
    if (d.get('status') === 'done' || d.get('status') === 'failed') continue;
    const ok = r.ret === '0';
    const batch = fs.batch();
    batch.update(d.ref, { status: ok ? 'done' : 'failed', returnCode: r.ret, doneAt: FieldValue.serverTimestamp() });
    const type = String(d.get('type'));
    const uid = d.get('deviceUserId') as string | undefined;
    const ident = uid ? await fs.collection('biometricIdentities').doc(`${deviceId}_${uid}`).get() : null;
    if (ident) meter.read('results');
    if (ident?.exists) {
      if (type === 'enroll_fp') {
        // Never downgrade a confirmed enrolment because of a later answer
        if (ident.get('enrollment') !== 'confirmed') batch.update(ident.ref, ok ? { enrollment: 'device_accepted', enrollmentError: null } : { enrollment: 'failed', enrollmentError: enrolError(r.ret) });
        if (!ok) audit(batch, fs, 'Fingerprint enrolment failed on the device', 'ENROLLMENT_FAILED', ident, { deviceUserId: uid ?? null, returnCode: r.ret });
      }
      if (type === 'block_user' || type === 'unblock_user') {
        const state = type === 'block_user' ? 'blocked' : 'open';
        batch.update(ident.ref, ok
          ? { deviceAccess: state, deviceAccessPending: null, deviceAccessAt: FieldValue.serverTimestamp(), deviceAccessError: null }
          : { deviceAccessPending: null, deviceAccessError: `Device answered ${r.ret}` });
      }
      if (type === 'add_user' && !ok) batch.update(ident.ref, { status: 'SYNC_FAILED', lastSyncAttemptAt: FieldValue.serverTimestamp(), lastSyncError: `Device answered ${r.ret}` });
    }
    if (type === 'unlock_door') audit(batch, fs, ok ? 'Door released by the device' : 'Door release refused by the device', ok ? 'DOOR_UNLOCKED' : 'DOOR_UNLOCK_FAILED', null, { returnCode: r.ret });
    else audit(batch, fs, ok ? 'Device command carried out' : 'Device command failed', ok ? 'DEVICE_COMMAND_SUCCESS' : 'DEVICE_COMMAND_FAILED', ident?.exists ? ident : null, { command: type, deviceUserId: uid ?? null, returnCode: r.ret });
    await batch.commit();
    meter.write('results', 2 + (ident?.exists && (type === 'enroll_fp' || (type === 'add_user' && !ok)) ? 1 : 0) + (ident?.exists && type === 'enroll_fp' && !ok ? 1 : 0));
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
/**
 * Diagnostics. Every request gets a full log line (Vercel → Logs, search "adms"). The Firestore
 * contact record (admsDiagnostics/{SN}) is written:
 *   • at once for anything meaningful — a non-2xx answer (refused upload, old server unreachable),
 *     a result of OUR commands, a handshake (device (re)start), or the first request after a quiet
 *     spell (> DIAG_RECORD_MS since the last write);
 *   • otherwise at most every DIAG_RECORD_MS per device per server instance.
 * Request counts, the old server's command verbs and the relay's own Firestore usage are totalled
 * in memory meanwhile and added in that write, so the stored totals stay exact.
 * The device polls every 3–4 s; writing each request used ~18,000 writes a day on its own.
 */
const DIAG_RECORD_MS = () => Number(process.env.ADMS_ROUTINE_RECORD_MS ?? 300_000);
const lastRecord = new Map<string, number>();
const pendingCounts = new Map<string, Record<string, number>>();
const verbTotals = new Map<string, Map<string, number>>();
async function observe(fs: Firestore | null, s: RequestSummary, o: Outcome, urgent = false) {
  logLine(s, o);
  if (!fs) return;
  const key = s.sn || '?';
  const kind = requestKind(s.method, s.path, s.table);
  const counts = pendingCounts.get(key) ?? {};
  counts[kind] = (counts[kind] ?? 0) + 1;
  pendingCounts.set(key, counts);
  if (o.upstreamCommands?.length) {
    const t = verbTotals.get(key) ?? new Map<string, number>();
    for (const v of o.upstreamCommands) { const [verb, n] = v.split(' ×'); t.set(verb, (t.get(verb) ?? 0) + Number(n)); }
    verbTotals.set(key, t);
  }
  // (Notes alone don't count: an unregistered serial polls every few seconds too — its note is
  // recorded on the first request and then every DIAG_RECORD_MS, which is enough to spot a typo)
  const meaningful = urgent || o.status < 200 || o.status >= 300 || kind === 'handshake';
  if (!meaningful && Date.now() - (lastRecord.get(key) ?? 0) < DIAG_RECORD_MS()) return;
  lastRecord.set(key, Date.now());
  // A routine record another instance already wrote in this interval: keep totalling here instead
  if (!meaningful && !(await claim(`diagnostics/${key}`, DIAG_RECORD_MS()))) return;
  const t = verbTotals.get(key);
  if (t?.size) { o = { ...o, upstreamCommands: [...t].map(([v, n]) => `${v} ×${n}`) }; verbTotals.delete(key); }
  pendingCounts.delete(key);
  const usage = takeUsage(key);
  const write = recordContact(fs, s, o, { counts, usage });
  await Promise.race([write, new Promise((r) => setTimeout(r, 2000))]).catch((e) => {
    console.error('[iclock] diagnostics', (e as Error).message);
    // Not lost: put the totals back for the next write
    const back = pendingCounts.get(key) ?? {};
    for (const [k, n] of Object.entries(counts)) back[k] = (back[k] ?? 0) + n;
    pendingCounts.set(key, back);
    returnUsage(key, usage);
    lastRecord.delete(key);
  });
  console.log(JSON.stringify({ adms: true, kind: 'firestore usage', sn: s.sn, since: 'last record', requests: counts, usage }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now();
  // The path as the device sent it (forwarded unchanged), and its name without the ".aspx" some
  // firmwares add — this X2008 calls /iclock/getrequest.aspx — for our own handling
  const rawPath = String(req.query.path ?? '').replace(/^\/+/, '') || 'cdata';
  const path = rawPath.replace(/\.aspx$/i, '');
  const sn = String(req.query.SN ?? req.query.sn ?? '');
  const table = String(req.query.table ?? '');
  const body = req.method === 'POST' ? await rawBody(req) : null;
  const text = body ? body.toString('utf8') : '';
  const summary = summarize({ method: req.method ?? 'GET', path: rawPath, query: req.query, headers: req.headers, body: text, bodyBytes: body?.length ?? 0 });
  const fsDiag = firestore();

  // Never forward an upload whose body we failed to read: the old server could acknowledge
  // "nothing" and the device would drop those scans. Refusing makes the device send them again.
  const declared = Number(req.headers['content-length'] ?? 0);
  if (req.method === 'POST' && declared > 0 && (body?.length ?? 0) === 0) {
    await observe(fsDiag, summary, { status: 503, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: null, forwarded: false, note: `body not received (declared ${declared} bytes) — refused, device will retry` });
    res.status(503).send('Try again');
    return;
  }

  // Remote self-test: answered here — never forwarded, never touches devices, members or scans
  if (sn === PROBE_SN) {
    const reply = path === 'cdata' && req.method === 'GET' ? ownHandshake(sn) : 'OK';
    await observe(fsDiag, summary, { status: 200, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: null, forwarded: false, note: 'self-test' });
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(reply);
    return;
  }

  const fs = sn ? fsDiag : null;
  const meter = meterFor(sn || '?');
  const deviceId = fs ? await deviceIdFor(fs, sn, meter).catch(() => '') : '';

  // 1) Command results: ours are handled here; everything else goes to the old server
  let upstreamBody = body;
  let oursOnly = false;
  let oursSeen = false;   // a result of a CRM command: always worth recording
  if (path === 'devicecmd' && body) {
    const results = parseCommandResults(text);
    const ours = results.filter((r) => OUR_ID.test(r.id));
    if (ours.length && fs && deviceId) await recordResults(fs, deviceId, ours, meter).catch((e) => console.error('[iclock] results', e));
    oursSeen = ours.length > 0;
    const theirs = results.filter((r) => !OUR_ID.test(r.id));
    // Deletes the relay kept from the device (see SHIELDED_DELETE): report them done to the old server
    const acks = pendingAcks.get(sn) ?? [];
    pendingAcks.delete(sn);
    const lines = [...theirs.map((r) => r.line), ...acks];
    oursOnly = ours.length > 0 && lines.length === 0;
    upstreamBody = Buffer.from(lines.join('\n') + (lines.length ? '\n' : ''));
  }

  // 2) The old server's answer (the device only moves on when it has one)
  type Reply = { status: number; type: string; date: string | null; body: Buffer };
  const ownReply = (): Reply => ({ status: 200, type: 'text/plain', date: null, body: Buffer.from(path === 'cdata' && req.method === 'GET' ? ownHandshake(sn) : 'OK') });
  let unsentNote: string | null = null;
  let ackedHere = false;   // answered by the relay: the old server never took it
  const noScans = path === 'cdata' && req.method === 'POST' && table !== 'ATTLOG' && summary.parsed.attlogLines === 0 && !!body?.length
    && !/(^|\n)[^\s=]+\t\d{4}-\d{2}-\d{2} \d/.test(text);   // a scan line, whatever the table says

  /** The old server's answer; throws when it has none */
  const oldServerReply = async (): Promise<Reply> => {
    try {
      if (OUTAGE_MODE() === 'keep' && Date.now() < upstreamDownUntil) throw new Error('old server down (not retried yet)');
      return await forward(req, rawPath, upstreamBody);
    } catch (e) {
      // Anything but a big upload failing means the old server itself is down
      if (!/not retried yet/.test((e as Error).message) && (upstreamBody?.length ?? 0) <= PIECE_BYTES()) upstreamDownUntil = Date.now() + UPSTREAM_RETRY_MS();
      if (!noScans || /not retried yet/.test((e as Error).message)) throw e;
      const key = uploadKey(sn, table, body!);
      try {
        const split = await forwardInPieces(req, rawPath, text);
        unsentNote = `old server dropped this ${body!.length}-byte upload whole (${(e as Error).message}); it took it in ${split.pieces} pieces`;
        unsentTries.delete(key);
        return split.reply;
      } catch {
        const tries = (unsentTries.get(key) ?? 0) + 1;
        unsentTries.set(key, tries);
        if (unsentTries.size > 50) unsentTries.delete(unsentTries.keys().next().value!);
        if (tries < UNSENT_ACK_AFTER || OUTAGE_MODE() === 'keep') throw e;   // "keep": saved for later below
        unsentTries.delete(key);
        ackedHere = true;
        unsentNote = `old server refused this ${table || 'upload'} (no scans in it) ${tries} times (${(e as Error).message}); acknowledged so the device moves on — the CRM recorded it, the old server didn’t get it`;
        return ownReply();
      }
    }
  };

  let reply: Reply | null = null;
  let failure: Error | null = null;
  if (!HAS_UPSTREAM() || oursOnly) reply = ownReply();
  else {
    try { reply = await oldServerReply(); } catch (e) { failure = e as Error; console.error('[iclock] old server unreachable:', failure.message); }
    // Keep working without it: save what it should get, then answer the device ourselves
    if (!reply && OUTAGE_MODE() === 'keep' && fs && deviceId) {
      const upload = req.method === 'POST' && !!upstreamBody?.length;
      const saved = !upload || await saveForOldServer(fs, sn, req, rawPath, upstreamBody!, !noScans).then(() => { meter.write('replay'); return true; }, (err) => { console.error('[iclock] replay save failed:', (err as Error).message); return false; });
      if (saved) {
        reply = ownReply();
        ackedHere = true;
        unsentNote = `old server unreachable (${failure!.message}) — answered by the CRM${upload ? '; a copy is kept for the old server' : ''}`;
        // Shown on the device in the CRM until the old server answers again (cleared like any error)
        if (!errorShown.has(deviceId)) {
          await devRef(fs, deviceId).update({ lastError: 'The old attendance server isn’t answering — the CRM is working on its own and will pass everything on when it’s back' }).catch(() => {});
          meter.write('heartbeat');
          errorShown.add(deviceId);
        }
      }
    }
  }
  if (!reply) {
    if (fs && deviceId) {
      await devRef(fs, deviceId).update({ lastError: 'The old attendance server didn’t answer; the device will retry' }).catch(() => {});
      meter.write('heartbeat');
      errorShown.add(deviceId);   // the next good request clears it at once
    }
    await observe(fsDiag, summary, { status: 503, upstreamStatus: null, durationMs: Date.now() - started, crmDeviceId: deviceId || null, forwarded: false, note: `old server unreachable: ${failure?.message ?? 'no answer'}` });
    res.status(503).send('Try again');   // nothing acknowledged → the device re-sends later
    return;
  }

  const upstreamText = reply.body.toString('utf8');
  // 2b) The old server may not delete the CRM's own users from the device (see SHIELDED_DELETE)
  let shieldNote: string | null = null;
  if (fs && deviceId && path === 'getrequest' && HAS_UPSTREAM() && !oursOnly && /DATA (DELETE|UPDATE USERINFO)/.test(upstreamText)) {
    try {
      const lines = upstreamText.split(/\r?\n/);
      // Only the users named in those commands
      const named = [...new Set(lines.map((l) => l.match(SHIELDED_DELETE)?.[2]).filter((p): p is string => !!p && /^[A-Za-z0-9_-]{1,24}$/.test(p)))];
      const got = named.length ? await fs.getAll(...named.map((p) => fs.collection('biometricIdentities').doc(`${deviceId}_${p}`))) : [];
      meter.read('deviceUsers', Math.max(1, named.length));
      const ids = new Map(got.filter((d) => d.exists).map((d) => [String(d.get('deviceUserId')), d]));
      const crmUser = (pin: string) => { const d = ids.get(pin); return !!d && d.get('managedBy') === 'crm' && d.get('status') !== 'REMOVED'; };
      const kept: string[] = []; const shielded: string[] = []; const acks: string[] = [];
      for (const l of lines) {
        const m = l.match(SHIELDED_DELETE);
        if (m && crmUser(m[2])) { shielded.push(m[2]); acks.push(`ID=${m[1]}&Return=0&CMD=DATA`); } else kept.push(l);
      }
      if (shielded.length) {
        pendingAcks.set(sn, [...(pendingAcks.get(sn) ?? []), ...acks]);
        const rest = kept.join('\n').trim();
        reply.body = Buffer.from(rest ? `${rest}\n` : 'OK');
        shieldNote = `kept the old server from deleting or changing CRM users ${[...new Set(shielded)].join(', ')} (reported done to it)`;
        console.log(JSON.stringify({ adms: true, kind: 'shielded delete', sn, pins: [...new Set(shielded)] }));
      }
    } catch (e) {
      console.error('[iclock] shield check failed:', (e as Error).message);
    }
  }
  // 3) Our queued commands go into THIS reply (the device only sees what's in its answer)
  if (fs && deviceId && path === 'getrequest' && DELIVER_CRM_COMMANDS()) {
    try {
      const mine = await takeCommands(fs, deviceId, meter);
      if (mine.length) {
        const theirs = reply.body.toString('utf8').trim();
        reply.body = Buffer.from([...(theirs && theirs !== 'OK' ? [theirs] : []), ...mine].join('\n') + '\n');
      }
    } catch (e) {
      console.error('[iclock] commands failed:', (e as Error).message);
    }
  }

  // 4) Record on the way through — never changes the old system's reply. Where the platform can
  // keep working after answering (Workers: req.waitUntil), the device is answered FIRST: a slow
  // or CPU-limited recording can then never make the device resend an upload the old server has
  // already acknowledged. Elsewhere (Vercel) it is recorded before answering, as before.
  const record = async () => {
    if (fs && deviceId) {
      try {
        await heartbeat(fs, deviceId, meter, ackedHere && !!failure);
        if (path === 'cdata' && req.method === 'POST' && reply.status < 300) {
          if (table === 'ATTLOG') await ingestScans(fs, deviceId, parseAttlog(text), { meter });
          // The device's own settings and feature list (no member data; sent on each reconnect):
          // kept so we know what this firmware supports before sending it new kinds of command
          if (table.toLowerCase() === 'options' && text.trim()) {
            await fs.collection('admsDiagnostics').doc(`${sn.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 50)}_options`).set({ sn, deviceOptions: text.slice(0, 8000), at: FieldValue.serverTimestamp() });
            meter.write('heartbeat');
          }
          const users = table === 'OPERLOG' || table === 'USERINFO' || /(^|\n)USER /.test(text) ? parseUsers(text) : [];
          const pins = parseFingerprintPins(text);
          if (users.length || pins.length) {
            const ids = await identitiesFor(fs, deviceId, [...users.map((u) => u.pin), ...pins], pins.length > 0, meter);
            await recordUsers(fs, deviceId, users, ids, meter);
            await recordFingerprints(fs, deviceId, pins, ids, meter);
          }
        }
        if (path === 'getrequest') await drainUserBacklog(fs, deviceId, meter);
        if (path === 'getrequest' && DELIVER_CRM_COMMANDS()) await enforceAccess(fs, deviceId, sn, meter);
        // The old server answered: send it what it missed while it was down (oldest first)
        if (HAS_UPSTREAM() && !oursOnly && !ackedHere && OUTAGE_MODE() === 'keep') await drainReplay(fs, sn, meter);
      } catch (e) {
        console.error('[iclock] recording failed:', (e as Error).message);
      }
    }
    // Which commands the OLD server is sending (verbs only) — evidence of whether it rewrites users
    const upstreamCommands = path === 'getrequest' && HAS_UPSTREAM() && !oursOnly ? commandVerbs(upstreamText) : [];
    await observe(fsDiag, summary, {
      ...(upstreamCommands.length ? { upstreamCommands } : {}),
      status: reply.status, upstreamStatus: HAS_UPSTREAM() && !oursOnly && !ackedHere ? reply.status : null, durationMs: Date.now() - started,
      crmDeviceId: deviceId || null, forwarded: HAS_UPSTREAM() && !oursOnly && !ackedHere,
      ...(unsentNote || shieldNote ? { note: [unsentNote, shieldNote].filter(Boolean).join('; ') } : sn && fs && !deviceId ? { note: `no CRM device has serial ${sn.toUpperCase()}` } : !sn ? { note: 'request without a serial (SN)' } : {}),
    }, oursSeen || !!unsentNote || !!shieldNote);
  };
  const waitUntil = (req as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil;
  if (!waitUntil) await record();
  res.setHeader('Content-Type', reply.type);
  if (reply.date) res.setHeader('Date', reply.date);
  res.setHeader('Cache-Control', 'no-store');
  res.status(reply.status).send(reply.body);
  if (waitUntil) waitUntil(record());
}
