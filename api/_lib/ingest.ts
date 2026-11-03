import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { eventKey, toIso, type MemberLike, type Scan } from './adms.js';
import { DENY_TEXT, memberDecision, resultOf, trainerDecision, type MemberAccessLike } from './access.js';
import { localDay, memberAttendanceId, personOf } from './attendance.js';
import { noMeter, type Meter } from './usage.js';

// Turning device punches into records. Used by the live relay (api/iclock.ts) and by the
// reviewed backfill (api/adms.ts). Idempotent: the same punch always has the same event id, and
// attendance records keep the ids of the events they contain, so a re-delivered punch (ADMS
// retries, a second upload, a backfill run twice) changes nothing.

const GYM = 'crunch-wakad';
/**
 * Raw punches (accessEvents) are kept for this many days, then Firestore deletes them by itself
 * (a TTL policy on `expireAt`, set in firestore.indexes.json). What stays for good is the
 * attendance built from them: one visit per member per day (checkins). 90 days leaves time to
 * link a device user late and rebuild their visits with Access → Attendance check.
 */
export const PUNCH_RETENTION_DAYS = 90;
const expiryOf = (atIso: string) => Timestamp.fromMillis(Date.parse(atIso) + PUNCH_RETENTION_DAYS * 86_400_000);

interface Identity { id: string; personType?: string; memberId?: string | null; trainerId?: string | null; status: string; managedBy?: string | null; accessEnabled?: boolean | null; enrollment?: string | null }
type MemberDoc = MemberLike & MemberAccessLike & { name?: string; phoneKey?: string; lastVisitAt?: Timestamp };

export interface IngestResult { events: number; members: number; trainers: number; unknown: number; attendanceCreated: number; attendanceUpdated: number }

/**
 * `writeEvents: false` is the backfill mode: attendance is completed from punches already stored,
 * and the original access events are left exactly as they are.
 */
export async function ingestScans(fs: Firestore, deviceId: string, scans: Scan[], opts: { writeEvents?: boolean; meter?: Meter } = {}): Promise<IngestResult> {
  const writeEvents = opts.writeEvents !== false;
  // Counting only (what each punch costs in Firestore) — never changes what is written
  const meter = opts.meter ?? noMeter;
  const out: IngestResult = { events: 0, members: 0, trainers: 0, unknown: 0, attendanceCreated: 0, attendanceUpdated: 0 };
  if (!scans.length) return out;
  const pins = [...new Set(scans.map((s) => s.pin))];
  const [idSnaps, userSnaps] = await Promise.all([
    fs.getAll(...pins.map((p) => fs.collection('biometricIdentities').doc(`${deviceId}_${p}`))),
    fs.getAll(...pins.map((p) => fs.collection('gyms').doc(GYM).collection('devices').doc(deviceId).collection('deviceUsers').doc(p))),
  ]);
  meter.read('punches', pins.length * 2);
  const identities = new Map<string, Identity>(idSnaps.filter((s) => s.exists && s.get('status') !== 'REMOVED').map((s) => [s.get('deviceUserId') as string, { id: s.id, ...(s.data() as Omit<Identity, 'id'>) }]));
  const deviceNames = new Map(userSnaps.filter((s) => s.exists).map((s) => [s.id, String(s.get('name') ?? '')]));

  const memberIds = [...new Set([...identities.values()].map((i) => personOf(i)).filter((p) => p.type === 'member').map((p) => p.id!))];
  const trainerIds = [...new Set([...identities.values()].map((i) => personOf(i)).filter((p) => p.type === 'trainer').map((p) => p.id!))];
  const [memberSnaps, trainerSnaps] = await Promise.all([
    memberIds.length ? fs.getAll(...memberIds.map((id) => fs.collection('members').doc(id))) : [],
    trainerIds.length ? fs.getAll(...trainerIds.map((id) => fs.collection('teamMembers').doc(id))) : [],
  ]);
  meter.read('punches', memberIds.length + trainerIds.length);
  const members = new Map(memberSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as MemberDoc]));
  const trainers = new Map(trainerSnaps.filter((s) => s.exists).map((s) => [s.id, String(s.get('name') ?? 'Trainer')]));
  // PT-only check, only for CRM-managed members with no membership (rare): explains the denial
  const ptOnly = new Set<string>();
  const noMembership = [...identities.values()].filter((i) => i.managedBy === 'crm' && i.memberId && members.has(i.memberId) && !members.get(i.memberId)!.membershipEnd).map((i) => i.memberId!);
  await Promise.all([...new Set(noMembership)].map(async (id) => {
    const pt = await fs.collection('ptPackages').where('memberId', '==', id).limit(5).get();
    meter.read('punches', Math.max(1, pt.size));
    if (!pt.empty) ptOnly.add(id);
  }));

  // 1) Every punch is an access event — resolved or not — so nothing a device reports is lost
  const memberDays = new Map<string, { memberId: string; scans: { key: string; ms: number; pin: string }[] }>();
  const batch = fs.batch();
  let batched = 0;
  for (const s of scans) {
    const ident = identities.get(s.pin) ?? null;
    const person = personOf(ident);
    const key = eventKey(GYM, deviceId, s.pin, s.time);
    const at = toIso(s.time);
    const day = localDay(s.time);
    const base = { gymId: GYM, deviceId, deviceUserId: s.pin, at, localDate: day, verify: s.verify, statusCode: s.status, receivedAt: FieldValue.serverTimestamp(), source: 'adms-relay', expireAt: expiryOf(at) };
    // The CRM's verdict for this scan. Legacy and unknown users are never "denied" — the old
    // system owns them. (The device has already opened the door either way: this is the record.)
    if (person.type === 'member' && members.has(person.id!)) {
      const m = members.get(person.id!)!;
      const { decision, reason: code } = memberDecision(ident, m, day, ptOnly.has(person.id!));
      const reason = code ? DENY_TEXT[code] : decision === 'LEGACY_USER' ? 'Managed by the old system' : 'Allowed by the new CRM';
      if (writeEvents) batched++;
      if (writeEvents) batch.set(fs.collection('accessEvents').doc(key), { ...base, personType: 'member', memberId: person.id, trainerId: null, decision, decisionReason: code, managedBy: ident?.managedBy === 'crm' ? 'crm' : 'legacy', result: resultOf(decision), reason, attendanceRef: `checkins/${memberAttendanceId(day, person.id!)}` });
      const k = memberAttendanceId(day, person.id!);
      if (!memberDays.has(k)) memberDays.set(k, { memberId: person.id!, scans: [] });
      memberDays.get(k)!.scans.push({ key, ms: Date.parse(at), pin: s.pin });
      out.members++;
    } else if (person.type === 'trainer' && trainers.has(person.id!)) {
      const { decision, reason: code } = trainerDecision(ident, true);
      const reason = code ? DENY_TEXT[code] : decision === 'LEGACY_USER' ? 'Staff · managed by the old system' : 'Staff';
      if (writeEvents) batched++;
      if (writeEvents) batch.set(fs.collection('accessEvents').doc(key), { ...base, personType: 'trainer', memberId: null, trainerId: person.id, decision, decisionReason: code, managedBy: ident?.managedBy === 'crm' ? 'crm' : 'legacy', result: resultOf(decision), reason, attendanceRef: null });
      // Staff scans are recorded (and expire) like any punch; attendance for staff is kept in the
      // gym's separate HR platform, so no trainer attendance is built here
      out.trainers++;
    } else {
      // Linked to someone who no longer exists, or not linked at all: kept, and shown as unresolved
      if (writeEvents) batched++;
      if (writeEvents) batch.set(fs.collection('accessEvents').doc(key), {
        ...base, personType: 'unknown', memberId: null, trainerId: null, decision: 'UNKNOWN_USER', decisionReason: null, managedBy: 'legacy', result: 'unknown_user', attendanceRef: null,
        reason: ident ? 'Linked person not found' : `Device user ${s.pin} isn’t linked to a member or trainer`,
        deviceUserName: deviceNames.get(s.pin) ?? '',
      });
      out.unknown++;
    }
    out.events++;
    // A punch proves this user ID exists on the device…
    if (writeEvents && ident && ['PENDING', 'ENROLLED', 'SYNC_FAILED'].includes(ident.status)) {
      batched++;
      batch.update(fs.collection('biometricIdentities').doc(ident.id), { status: 'SYNCED', lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp() });
      ident.status = 'SYNCED';
    }
    // …and a scan the device verified BY FINGERPRINT proves the fingerprint is enrolled on it —
    // the device's own confirmation (nothing is marked enrolled because a command was sent)
    if (writeEvents && ident && s.verify === 'fingerprint' && ident.enrollment !== 'confirmed' && ident.status !== 'REMOVED') {
      batched++;
      batch.update(fs.collection('biometricIdentities').doc(ident.id), { enrollment: 'confirmed', enrollmentConfirmedAt: FieldValue.serverTimestamp(), enrollmentEvidence: 'fingerprint_scan', enrollmentError: null });
      ident.enrollment = 'confirmed';
    }
  }
  await batch.commit();
  meter.write('punches', batched);

  // 2) Member attendance: one visit per member per local day, holding the ids of its punches
  for (const [docId, { memberId, scans: ss }] of memberDays) {
    const m = members.get(memberId)!;
    const ref = fs.collection('checkins').doc(docId);
    const changed = await fs.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      const known = new Set<string>((cur.get('eventIds') as string[]) ?? []);
      const fresh = ss.filter((x) => !known.has(x.key));
      if (!fresh.length) return 0;
      const first = Math.min(...fresh.map((x) => x.ms));
      const last = Math.max(...fresh.map((x) => x.ms));
      if (!cur.exists) {
        tx.set(ref, {
          gymId: GYM, memberId, memberName: m.name ?? '', memberPhoneKey: m.phoneKey ?? '', date: docId.slice(0, 10),
          method: 'biometric', sources: ['biometric'], by: 'adms-relay', deviceId, deviceUserId: fresh[0].pin,
          at: Timestamp.fromMillis(first), lastAt: Timestamp.fromMillis(last), eventIds: fresh.map((x) => x.key), punchCount: fresh.length,
          createdAt: FieldValue.serverTimestamp(),
        });
        return 1;
      }
      const curAt = (cur.get('at') as Timestamp | undefined)?.toMillis() ?? first;
      const curLast = (cur.get('lastAt') as Timestamp | undefined)?.toMillis() ?? curAt;
      tx.update(ref, {
        eventIds: FieldValue.arrayUnion(...fresh.map((x) => x.key)), punchCount: known.size + fresh.length,
        sources: [...new Set([...((cur.get('sources') as string[]) ?? [String(cur.get('method') ?? 'manual')]), 'biometric'])], at: Timestamp.fromMillis(Math.min(curAt, first)), lastAt: Timestamp.fromMillis(Math.max(curLast, last)),
        deviceId, deviceUserId: fresh[0].pin,
      });
      return 2;
    });
    meter.read('punches'); if (changed) meter.write('punches');
    if (changed === 1) out.attendanceCreated++;
    if (changed === 2) out.attendanceUpdated++;
    // "Last visit" on the member (lists read this one field)
    const lastMs = Math.max(...ss.map((x) => x.ms));
    const prev = m.lastVisitAt?.toMillis() ?? 0;
    if (lastMs > prev) { meter.write('punches'); await fs.collection('members').doc(memberId).update({ lastVisitAt: Timestamp.fromMillis(lastMs) }).catch(() => {}); m.lastVisitAt = Timestamp.fromMillis(lastMs); }
  }

  return out;
}
