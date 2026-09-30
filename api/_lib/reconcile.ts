import type { Firestore } from 'firebase-admin/firestore';
import type { Scan } from './adms.js';
import { memberAttendanceId, personOf, trainerAttendanceId } from './attendance.js';
import { ingestScans } from './ingest.js';

// Attendance reconciliation: compares the raw layer (accessEvents) with the attendance layer
// (checkins for members, trainerAttendance for trainers) over a bounded date range, and lists
// every gap instead of letting a member silently show 0. The backfill fixes only the gaps it
// previewed, through the same idempotent ingestion as the live relay, never touching the events.

const GYM = 'crunch-wakad';
const MAX_EVENTS = 3000;

export interface Issue {
  kind: 'missing_member_attendance' | 'missing_trainer_attendance' | 'unknown_uid' | 'attendance_missing_member' | 'attendance_wrong_gym' | 'duplicate_event' | 'duplicate_attendance';
  detail: string;
  eventId?: string; at?: string; deviceId?: string; deviceUserId?: string; personId?: string; personName?: string; attendanceId?: string; day?: string; count?: number;
}

const dayBounds = (from: string, to: string) => ({ fromIso: new Date(`${from}T00:00:00+05:30`).toISOString(), toIso: new Date(`${to}T23:59:59.999+05:30`).toISOString() });
const localTime = (iso: string) => {
  const d = new Date(Date.parse(iso) + 330 * 60_000);
  return d.toISOString().slice(0, 19).replace('T', ' ');   // device wall-clock "YYYY-MM-DD HH:MM:SS"
};

export async function reconcile(fs: Firestore, from: string, to: string) {
  const { fromIso, toIso } = dayBounds(from, to);
  const evSnap = await fs.collection('accessEvents').where('gymId', '==', GYM).where('at', '>=', fromIso).where('at', '<=', toIso).orderBy('at', 'desc').limit(MAX_EVENTS).get();
  type Ev = { id: string; at: string; deviceId: string; deviceUserId: string; localDate?: string; deviceUserName?: string };
  const events: Ev[] = evSnap.docs.map((d) => ({ ...(d.data() as Omit<Ev, 'id'>), id: d.id }));
  const truncated = evSnap.size === MAX_EVENTS;

  // Who each device user is NOW (a UID mapped after its punches is resolved here)
  const idKeys = [...new Set(events.map((e) => `${e.deviceId}_${e.deviceUserId}`))];
  const idSnaps = idKeys.length ? await fs.getAll(...idKeys.map((k) => fs.collection('biometricIdentities').doc(k))) : [];
  const identity = new Map(idSnaps.filter((s) => s.exists && s.get('status') !== 'REMOVED').map((s) => [s.id, s.data() as { personType?: string; memberId?: string; trainerId?: string }]));

  const expected = new Map<string, { col: 'checkins' | 'trainerAttendance'; person: string; events: typeof events }>();
  const unknown = new Map<string, { count: number; lastAt: string; deviceId: string; name: string }>();
  const seenPunch = new Map<string, string[]>();
  for (const e of events) {
    const punch = `${e.deviceId}|${e.deviceUserId}|${e.at}`;
    seenPunch.set(punch, [...(seenPunch.get(punch) ?? []), e.id]);
    const p = personOf(identity.get(`${e.deviceId}_${e.deviceUserId}`) ?? null);
    const day = String(e.localDate ?? localTime(String(e.at)).slice(0, 10));
    if (p.type === 'unknown') {
      const k = `${e.deviceId}|${e.deviceUserId}`;
      const u = unknown.get(k) ?? { count: 0, lastAt: String(e.at), deviceId: String(e.deviceId), name: String(e.deviceUserName ?? '') };
      u.count++; if (String(e.at) > u.lastAt) u.lastAt = String(e.at);
      unknown.set(k, u);
      continue;
    }
    const col = p.type === 'member' ? 'checkins' : 'trainerAttendance';
    const id = p.type === 'member' ? memberAttendanceId(day, p.id!) : trainerAttendanceId(day, p.id!);
    const x = expected.get(`${col}/${id}`) ?? { col, person: p.id!, events: [] };
    x.events.push(e);
    expected.set(`${col}/${id}`, x);
  }

  const paths = [...expected.keys()];
  const attSnaps = paths.length ? await fs.getAll(...paths.map((p) => fs.doc(p))) : [];
  const issues: Issue[] = [];
  paths.forEach((path, i) => {
    const x = expected.get(path)!;
    const have = new Set<string>((attSnaps[i].get('eventIds') as string[]) ?? []);
    for (const e of x.events) {
      if (have.has(e.id)) continue;
      issues.push({
        kind: x.col === 'checkins' ? 'missing_member_attendance' : 'missing_trainer_attendance',
        detail: attSnaps[i].exists ? 'The day’s attendance exists but doesn’t include this punch' : 'No attendance record for this punch',
        eventId: e.id, at: String(e.at), deviceId: String(e.deviceId), deviceUserId: String(e.deviceUserId), personId: x.person, attendanceId: path, day: path.split('/')[1].slice(0, 10),
      });
    }
  });
  for (const [k, u] of unknown) {
    issues.push({ kind: 'unknown_uid', detail: `Device user ${k.split('|')[1]} isn’t linked to a member or trainer`, deviceId: u.deviceId, deviceUserId: k.split('|')[1], at: u.lastAt, count: u.count, personName: u.name });
  }
  for (const [punch, ids] of seenPunch) if (ids.length > 1) issues.push({ kind: 'duplicate_event', detail: `${ids.length} events for the same punch (${punch})`, count: ids.length });

  // Attendance in the range: points at a member who exists, in this gym, once per day
  const att = await fs.collection('checkins').where('date', '>=', from).where('date', '<=', to).limit(MAX_EVENTS).get();
  const memberIds = [...new Set(att.docs.map((d) => String(d.get('memberId') ?? '')).filter(Boolean))];
  const mSnaps = memberIds.length ? await fs.getAll(...memberIds.map((id) => fs.collection('members').doc(id))) : [];
  const exists = new Map(mSnaps.map((s) => [s.id, s.exists]));
  const perDay = new Map<string, string[]>();
  for (const d of att.docs) {
    const mid = String(d.get('memberId') ?? '');
    if (!exists.get(mid)) issues.push({ kind: 'attendance_missing_member', detail: 'Attendance for a member who no longer exists', attendanceId: `checkins/${d.id}`, personId: mid, day: String(d.get('date')) });
    const g = d.get('gymId');
    if (g && g !== GYM) issues.push({ kind: 'attendance_wrong_gym', detail: `Attendance recorded for gym ${g}`, attendanceId: `checkins/${d.id}`, personId: mid });
    const k = `${mid}|${d.get('date')}`;
    perDay.set(k, [...(perDay.get(k) ?? []), d.id]);
  }
  for (const [k, ids] of perDay) if (ids.length > 1) issues.push({ kind: 'duplicate_attendance', detail: `${ids.length} attendance records for one member on ${k.split('|')[1]}`, personId: k.split('|')[0], count: ids.length });

  // Names, so the preview says who each gap belongs to
  const pIds = [...new Set(issues.filter((x) => x.personId).map((x) => x.personId!))];
  const [ms, ts] = await Promise.all([
    pIds.length ? fs.getAll(...pIds.map((id) => fs.collection('members').doc(id))) : [],
    pIds.length ? fs.getAll(...pIds.map((id) => fs.collection('teamMembers').doc(id))) : [],
  ]);
  const names = new Map<string, string>();
  ms.forEach((s) => { if (s.exists) names.set(s.id, String(s.get('name') ?? '')); });
  ts.forEach((s) => { if (s.exists) names.set(s.id, String(s.get('name') ?? '')); });
  issues.forEach((x) => { if (x.personId && !x.personName) x.personName = names.get(x.personId) ?? ''; });

  const counts: Record<string, number> = {};
  issues.forEach((x) => { counts[x.kind] = (counts[x.kind] ?? 0) + 1; });
  return { from, to, eventsChecked: events.length, attendanceChecked: att.size, truncated, counts, issues: issues.slice(0, 500) };
}

/** Create only the missing attendance found by `reconcile` (idempotent; access events untouched). */
export async function backfill(fs: Firestore, from: string, to: string) {
  const r = await reconcile(fs, from, to);
  const missing = r.issues.filter((x) => x.kind === 'missing_member_attendance' || x.kind === 'missing_trainer_attendance');
  const byDevice = new Map<string, Scan[]>();
  for (const x of missing) {
    const scans = byDevice.get(x.deviceId!) ?? [];
    scans.push({ pin: x.deviceUserId!, time: localTime(x.at!), status: '', verify: 'unknown' });
    byDevice.set(x.deviceId!, scans);
  }
  let created = 0, updated = 0;
  for (const [deviceId, scans] of byDevice) {
    const res = await ingestScans(fs, deviceId, scans, { writeEvents: false });
    created += res.attendanceCreated; updated += res.attendanceUpdated;
  }
  return { considered: missing.length, attendanceCreated: created, attendanceUpdated: updated, after: await reconcile(fs, from, to).then((x) => x.counts) };
}
