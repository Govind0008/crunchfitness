import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { eventKey, scanResult, toIso, type MemberLike, type Scan } from './adms.js';
import { localDay, memberAttendanceId, onLeave, personOf, trainerAttendanceId, trainerDay } from './attendance.js';

// Turning device punches into records. Used by the live relay (api/iclock.ts) and by the
// reviewed backfill (api/adms.ts). Idempotent: the same punch always has the same event id, and
// attendance records keep the ids of the events they contain, so a re-delivered punch (ADMS
// retries, a second upload, a backfill run twice) changes nothing.

const GYM = 'crunch-wakad';

interface Identity { id: string; personType?: string; memberId?: string | null; trainerId?: string | null; status: string }
type MemberDoc = MemberLike & { name?: string; phoneKey?: string; lastVisitAt?: Timestamp };

export interface IngestResult { events: number; members: number; trainers: number; unknown: number; attendanceCreated: number; attendanceUpdated: number }

/**
 * `writeEvents: false` is the backfill mode: attendance is completed from punches already stored,
 * and the original access events are left exactly as they are.
 */
export async function ingestScans(fs: Firestore, deviceId: string, scans: Scan[], opts: { writeEvents?: boolean } = {}): Promise<IngestResult> {
  const writeEvents = opts.writeEvents !== false;
  const out: IngestResult = { events: 0, members: 0, trainers: 0, unknown: 0, attendanceCreated: 0, attendanceUpdated: 0 };
  if (!scans.length) return out;
  const pins = [...new Set(scans.map((s) => s.pin))];
  const [idSnaps, userSnaps] = await Promise.all([
    fs.getAll(...pins.map((p) => fs.collection('biometricIdentities').doc(`${deviceId}_${p}`))),
    fs.getAll(...pins.map((p) => fs.collection('gyms').doc(GYM).collection('devices').doc(deviceId).collection('deviceUsers').doc(p))),
  ]);
  const identities = new Map<string, Identity>(idSnaps.filter((s) => s.exists && s.get('status') !== 'REMOVED').map((s) => [s.get('deviceUserId') as string, { id: s.id, ...(s.data() as Omit<Identity, 'id'>) }]));
  const deviceNames = new Map(userSnaps.filter((s) => s.exists).map((s) => [s.id, String(s.get('name') ?? '')]));

  const memberIds = [...new Set([...identities.values()].map((i) => personOf(i)).filter((p) => p.type === 'member').map((p) => p.id!))];
  const trainerIds = [...new Set([...identities.values()].map((i) => personOf(i)).filter((p) => p.type === 'trainer').map((p) => p.id!))];
  const [memberSnaps, trainerSnaps, leaveSnaps] = await Promise.all([
    memberIds.length ? fs.getAll(...memberIds.map((id) => fs.collection('members').doc(id))) : [],
    trainerIds.length ? fs.getAll(...trainerIds.map((id) => fs.collection('teamMembers').doc(id))) : [],
    Promise.all(trainerIds.map((id) => fs.collection('trainerLeave').where('trainerId', '==', id).get())),
  ]);
  const members = new Map(memberSnaps.filter((s) => s.exists).map((s) => [s.id, s.data() as MemberDoc]));
  const trainers = new Map(trainerSnaps.filter((s) => s.exists).map((s) => [s.id, String(s.get('name') ?? 'Trainer')]));
  const leaves = new Map(trainerIds.map((id, i) => [id, leaveSnaps[i].docs.map((d) => d.data() as { from: string; to: string; status: string })]));

  // 1) Every punch is an access event — resolved or not — so nothing a device reports is lost
  const memberDays = new Map<string, { memberId: string; scans: { key: string; ms: number; pin: string }[] }>();
  const trainerDays = new Map<string, { trainerId: string; scans: { key: string; ms: number; pin: string }[] }>();
  const batch = fs.batch();
  for (const s of scans) {
    const ident = identities.get(s.pin) ?? null;
    const person = personOf(ident);
    const key = eventKey(GYM, deviceId, s.pin, s.time);
    const at = toIso(s.time);
    const day = localDay(s.time);
    const base = { gymId: GYM, deviceId, deviceUserId: s.pin, at, localDate: day, verify: s.verify, statusCode: s.status, receivedAt: FieldValue.serverTimestamp(), source: 'adms-relay' };
    if (person.type === 'member' && members.has(person.id!)) {
      const m = members.get(person.id!)!;
      const { result, reason } = scanResult(ident!.status, m, day);
      if (writeEvents) batch.set(fs.collection('accessEvents').doc(key), { ...base, personType: 'member', memberId: person.id, trainerId: null, result, reason, attendanceRef: `checkins/${memberAttendanceId(day, person.id!)}` });
      const k = memberAttendanceId(day, person.id!);
      if (!memberDays.has(k)) memberDays.set(k, { memberId: person.id!, scans: [] });
      memberDays.get(k)!.scans.push({ key, ms: Date.parse(at), pin: s.pin });
      out.members++;
    } else if (person.type === 'trainer' && trainers.has(person.id!)) {
      if (writeEvents) batch.set(fs.collection('accessEvents').doc(key), { ...base, personType: 'trainer', memberId: null, trainerId: person.id, result: 'granted', reason: 'Staff', attendanceRef: `trainerAttendance/${trainerAttendanceId(day, person.id!)}` });
      const k = trainerAttendanceId(day, person.id!);
      if (!trainerDays.has(k)) trainerDays.set(k, { trainerId: person.id!, scans: [] });
      trainerDays.get(k)!.scans.push({ key, ms: Date.parse(at), pin: s.pin });
      out.trainers++;
    } else {
      // Linked to someone who no longer exists, or not linked at all: kept, and shown as unresolved
      if (writeEvents) batch.set(fs.collection('accessEvents').doc(key), {
        ...base, personType: 'unknown', memberId: null, trainerId: null, result: 'unknown_user', attendanceRef: null,
        reason: ident ? 'Linked person not found' : `Device user ${s.pin} isn’t linked to a member or trainer`,
        deviceUserName: deviceNames.get(s.pin) ?? '',
      });
      out.unknown++;
    }
    out.events++;
    // A punch proves this user ID exists on the device
    if (writeEvents && ident && ['PENDING', 'ENROLLED', 'SYNC_FAILED'].includes(ident.status)) {
      batch.update(fs.collection('biometricIdentities').doc(ident.id), { status: 'SYNCED', lastSyncedAt: FieldValue.serverTimestamp(), lastSyncError: null, updatedAt: FieldValue.serverTimestamp() });
      ident.status = 'SYNCED';
    }
  }
  await batch.commit();

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
    if (changed === 1) out.attendanceCreated++;
    if (changed === 2) out.attendanceUpdated++;
    // "Last visit" on the member (lists read this one field)
    const lastMs = Math.max(...ss.map((x) => x.ms));
    const prev = m.lastVisitAt?.toMillis() ?? 0;
    if (lastMs > prev) { await fs.collection('members').doc(memberId).update({ lastVisitAt: Timestamp.fromMillis(lastMs) }).catch(() => {}); m.lastVisitAt = Timestamp.fromMillis(lastMs); }
  }

  // 3) Trainer attendance: first punch = check-in, last = check-out, per local day
  for (const [docId, { trainerId, scans: ss }] of trainerDays) {
    const ref = fs.collection('trainerAttendance').doc(docId);
    const day = docId.slice(0, 10);
    const changed = await fs.runTransaction(async (tx) => {
      const cur = await tx.get(ref);
      const known = new Set<string>((cur.get('eventIds') as string[]) ?? []);
      const fresh = ss.filter((x) => !known.has(x.key));
      if (!fresh.length) return 0;
      const punches = [...((cur.get('punches') as number[]) ?? []), ...fresh.map((x) => x.ms)].sort((a, b) => a - b);
      const manual = (cur.get('manualCheckoutAt') as Timestamp | undefined)?.toMillis() ?? null;
      const d = trainerDay(punches, { manualCheckoutMs: manual, onApprovedLeave: onLeave(day, leaves.get(trainerId) ?? []) });
      const data = {
        gymId: GYM, trainerId, trainerName: trainers.get(trainerId) ?? 'Trainer', date: day, deviceId,
        punches, eventIds: [...known, ...fresh.map((x) => x.key)], punchCount: d.punchCount,
        firstAt: d.firstAt ? Timestamp.fromMillis(d.firstAt) : null, lastAt: d.lastAt ? Timestamp.fromMillis(d.lastAt) : null,
        checkoutAt: d.checkoutAt ? Timestamp.fromMillis(d.checkoutAt) : null, durationMs: d.durationMs, status: d.status, exceptions: d.exceptions,
        updatedAt: FieldValue.serverTimestamp(),
      };
      tx.set(ref, cur.exists ? data : { ...data, createdAt: FieldValue.serverTimestamp() }, { merge: true });
      return cur.exists ? 2 : 1;
    });
    if (changed === 1) out.attendanceCreated++;
    if (changed === 2) out.attendanceUpdated++;
  }
  return out;
}
