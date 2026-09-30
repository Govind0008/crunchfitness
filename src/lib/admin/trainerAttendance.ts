// Trainer attendance, from device punches only — no roster, shift, schedule or weekday rules.
// For each trainer and local day: first punch = check-in, last punch = check-out; the punches in
// between stay access events. One punch = check-in with no check-out (never invented). No punch =
// "No attendance recorded" — never "absent", because nothing says the trainer was expected.
// Records are written by the device relay (api/_lib/ingest.ts); admins may add a manual
// check-out to a day that has only a check-in, recorded with who and why.
import { Timestamp, addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAdmin, type AdminActor } from './activity';

export type TrainerDayStatus = 'COMPLETED' | 'MISSING_CHECKOUT' | 'NO_ATTENDANCE_RECORDED';
export type TrainerException = 'PUNCH_DURING_APPROVED_LEAVE' | 'MANUAL_CHECKOUT';
export const STATUS_LABEL: Record<TrainerDayStatus, string> = { COMPLETED: 'Completed', MISSING_CHECKOUT: 'Missing check-out', NO_ATTENDANCE_RECORDED: 'No attendance recorded' };
export const EXCEPTION_LABEL: Record<TrainerException, string> = { PUNCH_DURING_APPROVED_LEAVE: 'Punched during approved leave', MANUAL_CHECKOUT: 'Check-out added by staff' };

export interface TrainerDay {
  id: string; trainerId: string; trainerName: string; date: string; deviceId?: string;
  punches: number[]; punchCount: number; firstAt: Timestamp | null; lastAt: Timestamp | null; checkoutAt: Timestamp | null;
  durationMs: number | null; status: TrainerDayStatus; exceptions: TrainerException[];
  manualCheckoutAt?: Timestamp | null; manualCheckoutReason?: string; manualCheckoutBy?: string;
}
const col = () => collection(db, 'trainerAttendance');
const toDay = (d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, exceptions: [], punches: [], ...d.data() }) as TrainerDay;

/** Every trainer's record for one local day (at most one per trainer). */
export async function trainerAttendanceOn(date: string) {
  const snap = await getDocs(query(col(), where('date', '==', date), limit(200)));
  return snap.docs.map(toDay);
}
/** One trainer's days in a date range, newest first (a month is at most 31 records). */
export async function trainerAttendanceOf(trainerId: string, from: string, to: string) {
  const snap = await getDocs(query(col(), where('trainerId', '==', trainerId), where('date', '>=', from), where('date', '<=', to), limit(62)));
  return snap.docs.map(toDay).sort((a, b) => b.date.localeCompare(a.date));
}

/** Close a day that has only a check-in. Never used to invent a first punch. */
export async function addManualCheckout(day: TrainerDay, checkoutAt: Date, reason: string, actor: AdminActor) {
  const first = day.firstAt?.toMillis();
  if (!first) throw new Error('This day has no check-in to close.');
  if (day.status !== 'MISSING_CHECKOUT') throw new Error('This day already has a check-out.');
  if (checkoutAt.getTime() <= first) throw new Error('The check-out must be after the check-in.');
  const exceptions = [...new Set([...(day.exceptions ?? []).filter((e) => e !== 'MANUAL_CHECKOUT'), 'MANUAL_CHECKOUT'])];
  await updateDoc(doc(col(), day.id), {
    manualCheckoutAt: Timestamp.fromDate(checkoutAt), manualCheckoutBy: actor.uid, manualCheckoutReason: reason.trim(),
    checkoutAt: Timestamp.fromDate(checkoutAt), durationMs: checkoutAt.getTime() - first, status: 'COMPLETED', exceptions, updatedAt: serverTimestamp(),
  });
  await logAdmin(actor, 'Trainer check-out added manually', 'trainer', day.trainerId, { name: day.trainerName, date: day.date, reason: reason.trim() });
}

// ── Leave ────────────────────────────────────────────────────────────────────
export type LeaveType = 'casual' | 'sick' | 'planned' | 'unpaid' | 'other';
export type LeaveStatus = 'approved' | 'pending' | 'cancelled';
export const LEAVE_TYPE: Record<LeaveType, string> = { casual: 'Casual', sick: 'Sick', planned: 'Planned', unpaid: 'Unpaid', other: 'Other' };
export const LEAVE_STATUS: Record<LeaveStatus, string> = { approved: 'Approved', pending: 'Pending', cancelled: 'Cancelled' };
export interface Leave { id: string; trainerId: string; from: string; to: string; type: LeaveType; reason: string; status: LeaveStatus; notes: string }
export type LeaveInput = Omit<Leave, 'id'>;
const leaveCol = () => collection(db, 'trainerLeave');

export async function leaveOf(trainerId: string) {
  const snap = await getDocs(query(leaveCol(), where('trainerId', '==', trainerId), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Leave).sort((a, b) => b.from.localeCompare(a.from));
}
/** Approved leave that covers a given day, for every trainer (a gym has few leave records). */
export async function approvedLeaveOn(date: string) {
  const snap = await getDocs(query(leaveCol(), where('status', '==', 'approved'), where('from', '<=', date), limit(300)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Leave).filter((l) => l.to >= date);
}
export function validateLeave(i: LeaveInput): string[] {
  const e: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.from) || !/^\d{4}-\d{2}-\d{2}$/.test(i.to)) e.push('Choose the first and last day of the leave.');
  else if (i.from > i.to) e.push('The last day can’t be before the first day.');
  if (i.reason.length > 300) e.push('Keep the reason under 300 characters.');
  return e;
}
export async function saveLeave(i: LeaveInput, actor: AdminActor, existing?: Leave) {
  const data = { trainerId: i.trainerId, from: i.from, to: i.to, type: i.type, reason: i.reason.trim(), status: i.status, notes: i.notes.trim() };
  if (existing) await updateDoc(doc(leaveCol(), existing.id), data);
  else await addDoc(leaveCol(), { ...data, createdBy: actor.uid, createdAt: serverTimestamp() });
  await logAdmin(actor, existing ? 'Trainer leave updated' : 'Trainer leave recorded', 'trainer', i.trainerId, { from: i.from, to: i.to, type: i.type, status: i.status });
}

/** Status for display, including a day with no record at all. */
export const dayStatus = (d: TrainerDay | undefined): TrainerDayStatus => d?.status ?? 'NO_ATTENDANCE_RECORDED';
export const fmtDuration = (ms: number | null | undefined) => {
  if (ms == null) return '—';
  const m = Math.round(ms / 60000);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};
export const fmtClock = (t: Timestamp | null | undefined) => (t ? t.toDate().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '—');

/** The team (a handful of profiles), for names and pickers. */
export async function listTeam(): Promise<{ id: string; name: string; role?: string; image?: string }[]> {
  const snap = await getDocs(collection(db, 'teamMembers'));
  return snap.docs.map((d) => ({ id: d.id, name: String(d.get('name') ?? 'Trainer'), role: d.get('role') as string | undefined, image: d.get('image') as string | undefined })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Exceptions for a day, including a leave recorded after the punches (derived, not stored). */
export function exceptionsOf(day: TrainerDay | undefined, onLeave: boolean): TrainerException[] {
  const e = new Set(day?.exceptions ?? []);
  if (day && day.punchCount > 0 && onLeave) e.add('PUNCH_DURING_APPROVED_LEAVE');
  return [...e];
}
