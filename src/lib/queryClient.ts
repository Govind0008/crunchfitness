import { QueryClient } from '@tanstack/react-query';

// Pages show what they loaded last time instantly, then refresh in the background (stale-while-
// revalidate). Nothing is persisted to disk.
//
// How long a page's data counts as fresh (no re-read when staff come back to it) depends on what
// it is. Anything not listed keeps the default of 0 (re-read on every visit) — that includes the
// paged lists (activity log, visits, access events) and everything access-control shows.
// Saving anything in the admin marks ALL admin data stale at once (adminDataChanged below), so a
// change staff just made is never hidden by these windows; they only skip re-reads while nothing
// has been saved.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, gcTime: 30 * 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

const MIN = 60_000;
// The project runs on Firestore's free daily quota, so pages don't re-read on every visit.
// Slow-changing reference data
for (const key of ['team', 'trainers', 'unreadEnquiries', 'settings']) queryClient.setQueryDefaults(['admin', key], { staleTime: 30 * MIN });
// Operational data: going back and forth between pages doesn't re-read it; scans and other changes
// made outside this browser show up within 5 minutes (anything saved here refreshes at once)
for (const key of ['dashboard', 'members', 'memberCounts', 'memberExtras', 'dues', 'payments', 'revenue', 'revenueCards', 'revenueTrend', 'attendance', 'trainerAttendance', 'trainerLeaveOn', 'trainerDays', 'trainerLeave']) {
  queryClient.setQueryDefaults(['admin', key], { staleTime: 5 * MIN });
}

const listeners = new Set<() => void>();
let pending: ReturnType<typeof setTimeout> | undefined;
/**
 * Something in the admin was saved: every cached admin query becomes stale. Queries on screen
 * re-read now; the rest re-read when their page is next opened (exactly as before caching).
 * Several writes in one action are coalesced into one refresh.
 */
export function adminDataChanged() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    listeners.forEach((fn) => fn());
  }, 150);
}
/** Other caches (outside React Query) that must also forget their data after a save. */
export function onAdminDataChanged(fn: () => void) { listeners.add(fn); }
