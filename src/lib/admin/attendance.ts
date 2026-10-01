// Attendance records.
//  • `checkins` — member visits: one per member per local day ({date}_{memberId}), from the front
//    desk (manual) or from fingerprint punches (biometric, written by the device relay).
//  • `attendance` — earlier check-ins from the class-PIN page (/checkin). Classes are retired from
//    the admin; these stay readable as historical manual records.
//  • Every raw punch from the fingerprint device lives in `accessEvents` (see lib/access); a
//    member's punches for a day are folded into that day's `checkins` visit.
import {
  collection, doc, getCountFromServer, getDocs, increment, limit, orderBy, query, serverTimestamp,
  Timestamp, getDoc, where,
} from 'firebase/firestore';
import { runTransaction, setDoc, updateDoc } from '@/lib/admin/writes';
import { db } from '@/lib/firebase';
import { phoneKey } from './phone';
import { todayIST } from './members';
import type { AdminActor } from './activity';

export interface CheckInRecord {
  id: string; sessionId: string; memberName: string; memberPhone: string; memberPhoneKey?: string;
  checkedInAt?: Timestamp;
}
export interface ClassSession {
  id: string; trainerId: string; trainerName?: string; title: string; area: string;
  date: string; startTime: string; duration: number; capacity: number; checkedInCount?: number;
}

/** Midnight in Pune for today / the start of this week (Mon) / this month, as Timestamps. */
export function periodStarts(now = new Date()) {
  const ymd = todayIST(now);
  const [y, m, d] = ymd.split('-').map(Number);
  const ist = (yy: number, mm: number, dd: number) => Timestamp.fromDate(new Date(Date.UTC(yy, mm - 1, dd) - 5.5 * 3600 * 1000));
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = Monday
  return { today: ist(y, m, d), week: ist(y, m, d - dow), month: ist(y, m, 1) };
}

const col = () => collection(db, 'attendance');
const toRec = (d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, ...d.data() }) as CheckInRecord;

export async function checkInsSince(start: Timestamp, n = 500) {
  const snap = await getDocs(query(col(), where('checkedInAt', '>=', start), orderBy('checkedInAt', 'desc'), limit(n)));
  return snap.docs.map(toRec);
}
export async function checkInsBetween(start: Timestamp, end: Timestamp, n = 300) {
  const snap = await getDocs(query(col(), where('checkedInAt', '>=', start), where('checkedInAt', '<', end), orderBy('checkedInAt', 'desc'), limit(n)));
  return snap.docs.map(toRec);
}
export async function countSince(start: Timestamp) {
  return (await getCountFromServer(query(col(), where('checkedInAt', '>=', start)))).data().count;
}

/** A member's earlier /checkin records. New records carry memberPhoneKey; older ones stored the phone as typed,
 *  so common formats of the same number are matched too. */
export async function checkInsForPhone(phone: string) {
  const key = phoneKey(phone);
  if (key.length !== 10) return [];
  const variants = [...new Set([key, `+91${key}`, `+91 ${key}`, `91${key}`, `0${key}`, `+91 ${key.slice(0, 5)} ${key.slice(5)}`, `${key.slice(0, 5)} ${key.slice(5)}`, phone.trim()])];
  const [a, b] = await Promise.all([
    getDocs(query(col(), where('memberPhoneKey', '==', key), limit(200))),
    getDocs(query(col(), where('memberPhone', 'in', variants.slice(0, 30)), limit(200))),
  ]);
  const all = [...a.docs, ...b.docs].map(toRec);
  return all.filter((r, i) => all.findIndex((x) => x.id === r.id) === i).sort((x, y) => (y.checkedInAt?.seconds ?? 0) - (x.checkedInAt?.seconds ?? 0));
}

export type CheckInResult = 'ok' | 'duplicate' | 'full';

/**
 * Public self check-in (/checkin). One document per person per class — id `{sessionId}_{phoneKey}` —
 * so a second check-in is impossible, and the class counter moves in the same transaction, so
 * capacity holds without the public page reading anyone's check-ins. The rules enforce both.
 */
export async function selfCheckIn(session: Pick<ClassSession, 'id'>, name: string, phone: string): Promise<CheckInResult> {
  const key = phoneKey(phone);
  const sessionRef = doc(db, 'classSessions', session.id);
  try {
    return await runTransaction(db, async (tx) => {
      const s = await tx.get(sessionRef);
      const count = (s.data()?.checkedInCount as number | undefined) ?? 0;
      if (count >= (s.data()?.capacity as number)) return 'full' as const;
      tx.update(sessionRef, { checkedInCount: increment(1) });
      tx.set(doc(db, 'attendance', `${session.id}_${key}`), {
        sessionId: session.id, memberName: name.trim(), memberPhone: phone.trim(), memberPhoneKey: key, checkedInAt: serverTimestamp(),
      });
      return 'ok' as const;
    });
  } catch (e) {
    // The rules refuse to overwrite an existing check-in for this person and class
    if ((e as { code?: string }).code === 'permission-denied') return 'duplicate';
    throw e;
  }
}

/** Latest earlier (/checkin) record per phone key, for a page of members (≤30 phones per query, last 60 days). */
export async function lastCheckIns(keys: string[], days = 60): Promise<Map<string, Timestamp>> {
  const since = Timestamp.fromMillis(Date.now() - days * 86400000);
  const out = new Map<string, Timestamp>();
  const unique = [...new Set(keys.filter((k) => k.length === 10))];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await getDocs(query(col(), where('memberPhoneKey', 'in', unique.slice(i, i + 30)), where('checkedInAt', '>=', since), limit(500)));
    snap.docs.forEach((d) => {
      const r = toRec(d); const k = r.memberPhoneKey ?? ''; const at = r.checkedInAt;
      if (at && (!out.get(k) || out.get(k)!.seconds < at.seconds)) out.set(k, at);
    });
  }
  return out;
}

// ── Manual check-ins (no class) ──────────────────────────────────────────────
/**
 * A member's visit on one local day (checkins/{date}_{memberId}): from the front desk ("manual")
 * or from fingerprint punches ("biometric", written by the device relay with the ids of the
 * punches it contains). One per member per day, whatever the source.
 */
export interface ManualCheckIn {
  id: string; memberId: string; memberName: string; memberPhoneKey: string; date: string; method: 'manual' | 'biometric'; by: string; at?: Timestamp;
  lastAt?: Timestamp; sources?: ('manual' | 'biometric')[]; eventIds?: string[]; punchCount?: number; deviceId?: string; deviceUserId?: string;
}
const mcol = () => collection(db, 'checkins');
const toManual = (d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, ...d.data() }) as ManualCheckIn;

/**
 * Front-desk check-in. One record per member per day — id `{date}_{memberId}` — so checking the
 * same person in twice is refused, not double-counted. The rules allow admins to create only,
 * stamped with the server time and their own uid.
 */
export async function manualCheckIn(m: { id: string; name: string; phone: string }, actor: AdminActor): Promise<'ok' | 'duplicate'> {
  if (!actor) throw new Error('Not signed in');
  const date = todayIST();
  const ref = doc(db, 'checkins', `${date}_${m.id}`);
  if ((await getDoc(ref)).exists()) return 'duplicate';
  try {
    await setDoc(ref, { memberId: m.id, memberName: m.name.trim(), memberPhoneKey: phoneKey(m.phone), date, method: 'manual', by: actor.uid, at: serverTimestamp() });
    // "Last visit" on the member, so lists read one field instead of scanning check-ins.
    // Separate from the check-in: if this fails, the visit is still recorded.
    updateDoc(doc(db, 'members', m.id), { lastVisitAt: serverTimestamp() }).catch(() => {});
    return 'ok';
  } catch (e) {
    // Created a moment ago from another screen: the rules refuse the overwrite
    if ((e as { code?: string }).code === 'permission-denied' && (await getDoc(ref).catch(() => null))?.exists()) return 'duplicate';
    throw e;
  }
}
export async function manualCheckInsSince(start: Timestamp, n = 500) {
  const snap = await getDocs(query(mcol(), where('at', '>=', start), orderBy('at', 'desc'), limit(n)));
  return snap.docs.map(toManual);
}
export type VisitSource = 'all' | 'biometric' | 'manual';
/**
 * One day's visits, newest first (paged with usePaged). Fingerprint = any visit with a punch;
 * front desk = checked in by staff. Each maps to one index: sources (contains) + at · method + at.
 */
export function visitsQuery(day: string, source: VisitSource) {
  const start = Timestamp.fromDate(new Date(`${day}T00:00:00+05:30`));
  const end = Timestamp.fromMillis(start.toMillis() + 86_400_000);
  const by = source === 'biometric' ? [where('sources', 'array-contains', 'biometric')] : source === 'manual' ? [where('method', '==', 'manual')] : [];
  return query(mcol(), ...by, where('at', '>=', start), where('at', '<', end), orderBy('at', 'desc'));
}
export const toVisit = toManual;
export async function countVisitsBetween(start: Timestamp, end: Timestamp) {
  return (await getCountFromServer(query(mcol(), where('at', '>=', start), where('at', '<', end)))).data().count;
}
/** Visits (checkins) since a moment — every source: front desk and fingerprint. */
export async function countManualSince(start: Timestamp) {
  return (await getCountFromServer(query(mcol(), where('at', '>=', start)))).data().count;
}
export async function manualCheckInsOf(memberId: string) {
  const snap = await getDocs(query(mcol(), where('memberId', '==', memberId), limit(300)));
  return snap.docs.map(toManual).sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0));
}
/** Latest manual check-in per member id (≤30 ids per query, last `days` days). */
export async function lastManualCheckIns(memberIds: string[], days = 60): Promise<Map<string, Timestamp>> {
  const since = Timestamp.fromMillis(Date.now() - days * 86400000);
  const out = new Map<string, Timestamp>();
  const unique = [...new Set(memberIds)];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await getDocs(query(mcol(), where('memberId', 'in', unique.slice(i, i + 30)), where('at', '>=', since), limit(500)));
    snap.docs.forEach((d) => {
      const r = toManual(d);
      if (r.at && (!out.get(r.memberId) || out.get(r.memberId)!.seconds < r.at.seconds)) out.set(r.memberId, r.at);
    });
  }
  return out;
}

/** Peak hour (IST) across a set of arrival times in ms. */
export function peakHourOf(times: number[]) {
  const counts = new Map<number, number>();
  times.filter(Boolean).forEach((t) => {
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date(t)));
    counts.set(h, (counts.get(h) ?? 0) + 1);
  });
  let best: [number, number] | null = null;
  counts.forEach((c, h) => { if (!best || c > best[1]) best = [h, c]; });
  return best as [number, number] | null;
}
