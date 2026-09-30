// Loaders for the pages staff open most, shared by the pages and by the background prefetch
// that runs once the dashboard has loaded — so even the first visit to them is instant.
import { Timestamp } from 'firebase/firestore';
import { queryClient } from '@/lib/queryClient';
import { lastCheckIns } from '@/lib/admin/attendance';
import { ptForMembers, type PtPackage } from '@/lib/admin/packages';
import { identitiesForMembers } from '@/lib/access/store';
import type { BiometricIdentity } from '@/lib/access';
import { phoneKey } from '@/lib/admin/phone';
import type { Member } from '@/lib/admin/members';
import { listMembers, memberCounts, membersDue, todayIST } from '@/lib/admin/members';
import { checkInsBetween, countManualSince, countSince, countVisitsBetween, periodStarts, type CheckInRecord } from '@/lib/admin/attendance';
import { monthStart, paymentsBetween } from '@/lib/admin/payments';
import { getSettings } from '@/lib/admin/settings';

export const duesQuery = () => ({
  queryKey: ['admin', 'dues'],
  queryFn: async () => { const s = await getSettings(); return { days: s.expiringSoonDays, rows: await membersDue(s.expiringSoonDays) }; },
});

export const paymentsQuery = (from: string, to: string) => ({ queryKey: ['admin', 'payments', from, to], queryFn: () => paymentsBetween(from, to) });

/** Visit counts for a day, this week and this month, plus the day's older PIN-page check-ins. */
export const attendanceQuery = (day: string) => ({
  queryKey: ['admin', 'attendance', day],
  queryFn: async () => {
    const p = periodStarts();
    const start = Timestamp.fromDate(new Date(`${day}T00:00:00+05:30`));
    const end = Timestamp.fromMillis(start.toMillis() + 86_400_000);
    // Self check-ins from the old PIN page (/checkin) still count, shown as manual
    const safe = <T,>(x: Promise<T>, fallback: T) => x.catch(() => fallback);
    // A failing source shows an error but doesn't blank the rest of the page
    let failed: string | null = null;
    const visits = <T,>(x: Promise<T>, fallback: T) => x.catch((e: Error) => { failed = e.message; return fallback; });
    const [d, e, w, ew, m, em] = await Promise.all([
      visits(countVisitsBetween(start, end), 0), safe(checkInsBetween(start, end), [] as CheckInRecord[]),
      visits(countManualSince(p.week), 0), safe(countSince(p.week), 0), visits(countManualSince(p.month), 0), safe(countSince(p.month), 0),
    ]);
    return { day: d + e.length, earlier: e, week: w + ew, month: m + em, failed: failed as string | null };
  },
});

export const settingsQuery = () => ({ queryKey: ['admin', 'settings'], queryFn: getSettings });
export const memberCountsQuery = (expDays: number) => ({ queryKey: ['admin', 'memberCounts', expDays], queryFn: () => memberCounts(expDays) });
/** The first page of the plain "All members" list (other filters load on demand). */
export const allMembersQuery = (expDays: number) => ({ queryKey: ['admin', 'members', 'all', expDays], queryFn: () => listMembers('all', expDays) });

export interface MemberExtras { pt: Map<string, PtPackage[]>; ids: Map<string, BiometricIdentity[]>; last: Map<string, Timestamp> }
/** PT, device users and last visit for the members on screen — one batched round. */
export const memberExtrasQuery = (list: Member[]) => ({
  queryKey: ['admin', 'memberExtras', list.map((m) => m.id).join(',')],
  queryFn: async (): Promise<MemberExtras> => {
    const [pt, idm, earlier] = await Promise.all([
      ptForMembers(list.map((m) => m.id)),
      identitiesForMembers(list.map((m) => m.id)).catch(() => new Map<string, BiometricIdentity[]>()),
      lastCheckIns(list.map((m) => phoneKey(m.phone))).catch(() => new Map<string, Timestamp>()),
    ]);
    // Last visit: the member's own lastVisitAt (stamped at check-in), or an earlier self check-in
    const last = new Map<string, Timestamp>();
    list.forEach((m) => { const a = m.lastVisitAt ?? undefined; const b = earlier.get(phoneKey(m.phone)); const t = a && b ? (a.seconds >= b.seconds ? a : b) : a ?? b; if (t) last.set(m.id, t); });
    return { pt, ids: idm, last };
  },
});

let prefetched = false;
/** Once per session, after the dashboard is on screen: warm the pages staff go to next. */
export function prefetchCommonPages() {
  if (prefetched) return;
  prefetched = true;
  const today = todayIST();
  void getSettings().then((s) => {
    void queryClient.prefetchQuery(settingsQuery());
    void queryClient.prefetchQuery(memberCountsQuery(s.expiringSoonDays));
    void queryClient.fetchQuery(allMembersQuery(s.expiringSoonDays)).then((page) => queryClient.prefetchQuery(memberExtrasQuery(page.members))).catch(() => {});
  });
  void queryClient.prefetchQuery(attendanceQuery(today));
  void queryClient.prefetchQuery(duesQuery());
  void queryClient.prefetchQuery(paymentsQuery(monthStart(today), today));
}
