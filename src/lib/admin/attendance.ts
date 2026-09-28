// Class check-ins (`attendance`, written by /checkin) and today's classes (`classSessions`).
import {
  collection, doc, getCountFromServer, getDocs, increment, limit, orderBy, query, runTransaction, serverTimestamp,
  Timestamp, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { phoneKey } from './phone';
import { todayIST } from './members';

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
export async function countSince(start: Timestamp) {
  return (await getCountFromServer(query(col(), where('checkedInAt', '>=', start)))).data().count;
}

export async function classesOn(date: string): Promise<ClassSession[]> {
  const snap = await getDocs(query(collection(db, 'classSessions'), where('date', '==', date)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassSession).sort((a, b) => a.startTime.localeCompare(b.startTime));
}
export async function attendeesOf(sessionId: string) {
  const snap = await getDocs(query(col(), where('sessionId', '==', sessionId)));
  return snap.docs.map(toRec).sort((a, b) => (a.checkedInAt?.seconds ?? 0) - (b.checkedInAt?.seconds ?? 0));
}

/** A member's check-ins. New records carry memberPhoneKey; older ones stored the phone as typed,
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

/** Peak hour (IST) among check-ins, or null. Derived from real records only. */
export function peakHour(recs: CheckInRecord[]) {
  const counts = new Map<number, number>();
  recs.forEach((r) => {
    if (!r.checkedInAt) return;
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(r.checkedInAt.toDate()));
    counts.set(h, (counts.get(h) ?? 0) + 1);
  });
  let best: [number, number] | null = null;
  counts.forEach((c, h) => { if (!best || c > best[1]) best = [h, c]; });
  return best as [number, number] | null;
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

/**
 * Front-desk check-in by staff. Same one-document-per-person-per-class record as /checkin, but
 * staff may overwrite attendance, so this checks for an existing record inside the transaction
 * rather than relying on the rules to refuse it (which would double-count the class).
 */
export async function staffCheckIn(session: Pick<ClassSession, 'id'>, name: string, phone: string): Promise<CheckInResult> {
  const key = phoneKey(phone);
  const sessionRef = doc(db, 'classSessions', session.id);
  const recRef = doc(db, 'attendance', `${session.id}_${key}`);
  return runTransaction(db, async (tx) => {
    const [s, existing] = await Promise.all([tx.get(sessionRef), tx.get(recRef)]);
    if (existing.exists()) return 'duplicate' as const;
    const count = (s.data()?.checkedInCount as number | undefined) ?? 0;
    if (count >= (s.data()?.capacity as number)) return 'full' as const;
    tx.update(sessionRef, { checkedInCount: increment(1) });
    tx.set(recRef, { sessionId: session.id, memberName: name.trim(), memberPhone: phone.trim(), memberPhoneKey: key, checkedInAt: serverTimestamp() });
    return 'ok' as const;
  });
}
