// Attendance derived from biometric punches. Pure rules here; api/iclock.ts writes the records.
//
//   device punch ──► accessEvents/{key}          raw, every punch, never deleted (audit layer)
//                 ├─► MEMBER  → checkins/{day}_{memberId}         one visit per member per day
//                 ├─► TRAINER → trainerAttendance/{day}_{trainerId}  first punch = check-in,
//                 │                                                  last punch = check-out
//                 └─► UNKNOWN → the access event only (unresolved), for staff to map
//
// The day is the gym's local calendar day (India, +05:30) — the device records local wall-clock
// time, so "2026-09-30 00:15:00" belongs to 30 Sept, never to the UTC day before.
// The X2008 at the entrance can't tell entry from exit, so trainer attendance uses the first and
// last punch of the day; the punches in between are kept as access events only.

export type TrainerDayStatus = 'COMPLETED' | 'MISSING_CHECKOUT' | 'NO_ATTENDANCE_RECORDED';
export type TrainerException = 'PUNCH_DURING_APPROVED_LEAVE' | 'MANUAL_CHECKOUT';

/** "YYYY-MM-DD HH:MM:SS" device local time → its local calendar day. */
export const localDay = (deviceTime: string) => deviceTime.slice(0, 10);

/**
 * A trainer's day from their punch times (ms). One punch = check-in with no check-out (never
 * invented); two or more = first and last. A manual check-out (admin, audited) closes a day that
 * has only a check-in. No roster, shift, schedule or weekday is involved.
 */
export function trainerDay(punchesMs: number[], opts: { manualCheckoutMs?: number | null; onApprovedLeave?: boolean } = {}) {
  const p = [...new Set(punchesMs)].sort((a, b) => a - b);
  const exceptions: TrainerException[] = [];
  if (!p.length) return { firstAt: null, lastAt: null, checkoutAt: null, punchCount: 0, durationMs: null, status: 'NO_ATTENDANCE_RECORDED' as TrainerDayStatus, exceptions };
  if (opts.onApprovedLeave) exceptions.push('PUNCH_DURING_APPROVED_LEAVE');
  const firstAt = p[0];
  const lastPunch = p.length > 1 ? p[p.length - 1] : null;
  const manual = opts.manualCheckoutMs && opts.manualCheckoutMs > firstAt ? opts.manualCheckoutMs : null;
  if (!lastPunch && manual) exceptions.push('MANUAL_CHECKOUT');
  const checkoutAt = lastPunch ?? manual;
  return {
    firstAt, lastAt: lastPunch, checkoutAt, punchCount: p.length,
    durationMs: checkoutAt ? checkoutAt - firstAt : null,
    status: (checkoutAt ? 'COMPLETED' : 'MISSING_CHECKOUT') as TrainerDayStatus,
    exceptions,
  };
}

/** Whether a local day falls inside an approved leave (inclusive dates, YYYY-MM-DD). */
export const onLeave = (day: string, leaves: { from: string; to: string; status: string }[]) =>
  leaves.some((l) => l.status === 'approved' && l.from <= day && day <= l.to);

/** The person a device user ID is linked to, from its identity record. */
export type PersonType = 'member' | 'trainer' | 'unknown';
export function personOf(identity: { personType?: string; memberId?: string | null; trainerId?: string | null; status?: string } | null) {
  if (!identity) return { type: 'unknown' as PersonType, id: null };
  if (identity.personType === 'trainer' && identity.trainerId) return { type: 'trainer' as PersonType, id: identity.trainerId };
  if (identity.memberId) return { type: 'member' as PersonType, id: identity.memberId };
  return { type: 'unknown' as PersonType, id: null };
}

export const memberAttendanceId = (day: string, memberId: string) => `${day}_${memberId}`;
export const trainerAttendanceId = (day: string, trainerId: string) => `${day}_${trainerId}`;
