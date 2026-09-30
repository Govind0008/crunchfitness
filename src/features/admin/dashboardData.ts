// The dashboard's data in one loader, shared by the dashboard and the sign-in page (which starts
// it the moment the password is accepted, so the dashboard opens with its numbers ready).
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { queryClient } from '@/lib/queryClient';
import { DUES_LOOKBACK_DAYS, addDays, memberCounts, membersDue, todayIST, type Member, type MemberCounts } from '@/lib/admin/members';
import { countManualSince, countSince, periodStarts } from '@/lib/admin/attendance';
import { getSettings } from '@/lib/admin/settings';
import { paymentsBetween, type Payment } from '@/lib/admin/payments';
import { recentActivity, type ActivityEntry } from '@/lib/admin/activity';
import { deviceHealth } from '@/lib/access';
import { accessSummary, todayStartIso, type AccessSummary } from '@/lib/access/store';
import { listTeam, trainerAttendanceOn } from '@/lib/admin/trainerAttendance';
import { PUBLIC_STATUSES, normalizeEvent, type CrunchEvent } from '@/lib/events';

export interface Alert { tone: 'info' | 'warn'; what: string; action: string; to: string }

export interface Dash {
  expDays: number; counts: MemberCounts; membersUnavailable: boolean; checkIns: number | null; events: CrunchEvent[]; todays: Payment[] | null;
  due: Member[] | null; access: AccessSummary | null;
  visitsWeek: number | null; trainers: { team: number; present: number; completed: number; missing: number } | null; activity: ActivityEntry[]; alerts: Alert[]; failed: string | null;
}
/** Everything on the dashboard in one round of parallel queries (cached between visits). */
export async function loadDashboard(today: string): Promise<Dash> {
  const settings = await getSettings();   // cached after the first call
  // Each source loads on its own: one refused or failing query shows as "unavailable",
  // it doesn't blank the whole dashboard
  const parts = await Promise.allSettled([
    memberCounts(settings.expiringSoonDays),
    // Check-ins today: front desk plus any older-style self check-ins
    Promise.all([countManualSince(periodStarts().today), countSince(periodStarts().today).catch(() => 0)]).then(([a, b]) => a + b),
    getDocs(query(collection(db, 'events'), where('status', 'in', PUBLIC_STATUSES.filter((s) => s !== 'archived')))),
    getCountFromServer(query(collection(db, 'enquiries'), where('status', '==', 'new'))),
    // Renewals overdue: memberships that ended in the last DUES_LOOKBACK_DAYS (not long-gone history)
    getCountFromServer(query(collection(db, 'members'), where('activeUntil', '>=', addDays(today, -DUES_LOOKBACK_DAYS)), where('activeUntil', '<', today))),
    paymentsBetween(today, today),
    membersDue(settings.expiringSoonDays),
    accessSummary(todayStartIso(today)),
    recentActivity(8),
    Promise.all([countManualSince(periodStarts().week), countSince(periodStarts().week).catch(() => 0)]).then(([a, b]) => a + b),
    Promise.all([listTeam(), trainerAttendanceOn(today)]).then(([team, days]) => ({
      team: team.length, present: days.filter((d) => d.punchCount > 0).length,
      completed: days.filter((d) => d.status === 'COMPLETED').length, missing: days.filter((d) => d.status === 'MISSING_CHECKOUT').length,
    })),
  ]);
  const NAMES = ['members', 'visits', 'events', 'enquiries', 'renewals', 'today’s payments', 'dues', 'access control', 'activity', 'visits this week', 'trainer attendance'];
  const failedParts = parts.map((r, i) => (r.status === 'rejected' ? NAMES[i] : null)).filter(Boolean);
  const val = <T,>(i: number, fallback: T): T => (parts[i].status === 'fulfilled' ? (parts[i] as PromiseFulfilledResult<T>).value : fallback);
  const mc = val<MemberCounts | null>(0, null);
  const evSnap = val<Awaited<ReturnType<typeof getDocs>> | null>(2, null);
  const newEnq = val<Awaited<ReturnType<typeof getCountFromServer>> | null>(3, null);
  const overdue = val<Awaited<ReturnType<typeof getCountFromServer>> | null>(4, null)?.data().count ?? 0;
  const acc = val<AccessSummary | null>(7, null);
  const evs = (evSnap?.docs ?? []).map((d) => normalizeEvent({ id: d.id, ...(d.data() as object) } as CrunchEvent)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  // Needs attention — each alert is derived from a real count or record
  const a: Alert[] = [];
  const n = newEnq?.data().count ?? 0;
  if (n) a.push({ tone: 'warn', what: `${n} new ${n === 1 ? 'enquiry' : 'enquiries'} waiting for a reply`, action: 'Review enquiries', to: '/admin/enquiries' });
  if (overdue) a.push({ tone: 'warn', what: `${overdue} ${overdue === 1 ? 'membership has' : 'memberships have'} expired and ${overdue === 1 ? 'is' : 'are'} due for renewal`, action: 'See dues', to: '/admin/payments/dues' });
  if (mc?.expiring) a.push({ tone: 'warn', what: `${mc.expiring} ${mc.expiring === 1 ? 'membership expires' : 'memberships expire'} in the next ${settings.expiringSoonDays} days`, action: 'See who', to: '/admin/members?filter=expiring' });
  if (acc?.failed) a.push({ tone: 'warn', what: `${acc.failed} biometric ${acc.failed === 1 ? 'sync has' : 'syncs have'} failed`, action: 'Fix access', to: '/admin/access' });
  if (acc?.unresolvedToday) a.push({ tone: 'warn', what: `${acc.unresolvedToday} punch${acc.unresolvedToday === 1 ? '' : 'es'} today from device users not linked to anyone`, action: 'Review', to: '/admin/access?tab=activity&who=unknown' });
  if (acc?.pending) a.push({ tone: 'info', what: `${acc.pending} biometric ${acc.pending === 1 ? 'enrolment is' : 'enrolments are'} waiting for the device`, action: 'See enrolments', to: '/admin/access' });
  acc?.devices.filter((d) => deviceHealth(d) === 'offline').forEach((d) => a.push({ tone: 'warn', what: `${d.name} (${d.model}) is offline`, action: 'Check device', to: '/admin/settings/access' }));
  if (acc && acc.devices.length && mc && mc.active > acc.enrolled) a.push({ tone: 'info', what: `${mc.active - acc.enrolled} active ${mc.active - acc.enrolled === 1 ? 'member isn’t' : 'members aren’t'} enrolled on a biometric device`, action: 'See members', to: '/admin/members?filter=active' });
  evs.filter((e) => e.status === 'live').forEach((e) => a.push({ tone: 'info', what: `${e.title} is live now`, action: 'Open event day screen', to: `/admin/events/${e.id}/live` }));
  const soon = Date.now() + 48 * 3600 * 1000;
  evs.filter((e) => e.status === 'registration_open' && e.registrationCloseAt && new Date(e.registrationCloseAt).getTime() < soon && new Date(e.registrationCloseAt).getTime() > Date.now())
    .forEach((e) => a.push({ tone: 'info', what: `Registration for ${e.title} closes ${new Date(e.registrationCloseAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, action: 'Manage event', to: `/admin/events/${e.id}` }));
  evs.filter((e) => e.status === 'results_pending').forEach((e) => a.push({ tone: 'warn', what: `Results for ${e.title} aren’t published yet`, action: 'Review results', to: `/admin/events/${e.id}?tab=results` }));
  if (mc && mc.total === 0) a.push({ tone: 'info', what: 'No members in the system yet', action: 'Add or import members', to: '/admin/members' });

  return {
    expDays: settings.expiringSoonDays, counts: mc ?? { total: 0, active: 0, inactive: 0, expiring: 0, withExpiry: 0 }, membersUnavailable: !mc,
    checkIns: val<number | null>(1, null), events: evs, todays: val<Payment[] | null>(5, null), due: val<Member[] | null>(6, null), access: acc,
    activity: val<ActivityEntry[] | null>(8, null) ?? [], alerts: a,
    visitsWeek: val<number | null>(9, null), trainers: val<Dash['trainers']>(10, null),
    failed: failedParts.length ? `${failedParts.join(', ')} couldn’t load (${(parts.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason?.message ?? 'error'})` : null,
  };
}

export const dashboardQuery = (today: string) => ({ queryKey: ['admin', 'dashboard', today], queryFn: () => loadDashboard(today) });
/** Start loading the dashboard now (e.g. right after sign-in). */
export const prefetchDashboard = () => queryClient.prefetchQuery(dashboardQuery(todayIST()));
