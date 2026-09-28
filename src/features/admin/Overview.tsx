import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowRight, CalendarPlus, ClipboardCheck, Inbox, IndianRupee, UserPlus, CalendarDays } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { memberCounts, todayIST, type MemberCounts } from '@/lib/admin/members';
import { classesOn, countSince, periodStarts, type ClassSession } from '@/lib/admin/attendance';
import { getSettings } from '@/lib/admin/settings';
import { revenueBetween, rupees } from '@/lib/admin/payments';
import { PUBLIC_STATUSES, STATUS, formatEventDate, normalizeEvent, type CrunchEvent } from '@/lib/events';
import { AdminShell } from '@/features/events/admin/shared';
import { cn } from '@/lib/utils';

interface Alert { tone: 'info' | 'warn'; what: string; action: string; to: string }

// Same week convention as the Duty Roster screen (Monday, ISO date)
const weekStart = () => {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split('T')[0];
};
const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const Metric = ({ label, value, sub, to }: { label: string; value: ReactNode; sub?: ReactNode; to?: string }) => {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-2 font-display text-5xl font-bold leading-none tabular-nums text-white">{value}</p>
      {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
    </>
  );
  return to
    ? <Link to={to} className="block rounded-2xl border border-white/[0.08] bg-ink-900 p-5 transition-colors hover:border-white/20">{body}</Link>
    : <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">{body}</div>;
};

/** Dashboard — what's happening today, how many members, and what needs doing. Real data only. */
const Overview = () => {
  const [counts, setCounts] = useState<MemberCounts | null>(null);
  const [checkIns, setCheckIns] = useState<number | null>(null);
  const [collection_, setCollection] = useState<{ paise: number; payments: number } | null>(null);
  const [classes, setClasses] = useState<ClassSession[] | null>(null);
  const [events, setEvents] = useState<CrunchEvent[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [expDays, setExpDays] = useState(14);
  const [failed, setFailed] = useState<string | null>(null);
  const [membersUnavailable, setMembersUnavailable] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const settings = await getSettings();
        const today = todayIST();
        // Each source loads on its own: one refused or failing query shows as "unavailable",
        // it doesn't blank the whole dashboard
        const parts = await Promise.allSettled([
          memberCounts(settings.expiringSoonDays),
          countSince(periodStarts().today),
          classesOn(today),
          getDocs(query(collection(db, 'events'), where('status', 'in', PUBLIC_STATUSES.filter((s) => s !== 'archived')))),
          getCountFromServer(query(collection(db, 'enquiries'), where('status', '==', 'new'))),
          getCountFromServer(query(collection(db, 'duties'), where('weekStart', '==', weekStart()))),
          // Renewals overdue: expired memberships of members not marked inactive
          getCountFromServer(query(collection(db, 'members'), where('activeUntil', '>', '0000-00-00'), where('activeUntil', '<', today))),
          revenueBetween(today, today),
        ]);
        const NAMES = ['members', 'check-ins', 'classes', 'events', 'enquiries', 'duty roster', 'renewals', 'today’s collection'];
        const failedParts = parts.map((r, i) => (r.status === 'rejected' ? NAMES[i] : null)).filter(Boolean);
        const val = <T,>(i: number, fallback: T): T => (parts[i].status === 'fulfilled' ? (parts[i] as PromiseFulfilledResult<T>).value : fallback);
        const mc = val<MemberCounts | null>(0, null);
        const ci = val<number | null>(1, null);
        const cls = val<ClassSession[]>(2, []);
        const evSnap = val<Awaited<ReturnType<typeof getDocs>> | null>(3, null);
        const newEnq = val<Awaited<ReturnType<typeof getCountFromServer>> | null>(4, null);
        const duties = val<Awaited<ReturnType<typeof getCountFromServer>> | null>(5, null);
        const overdue = val<Awaited<ReturnType<typeof getCountFromServer>> | null>(6, null)?.data().count ?? 0;
        const takings = val<Awaited<ReturnType<typeof revenueBetween>> | null>(7, null);
        if (failedParts.length) setFailed(`${failedParts.join(', ')} couldn’t load (${(parts.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason?.message ?? 'error'})`);
        if (off) return;
        const evs = (evSnap?.docs ?? []).map((d) => normalizeEvent({ id: d.id, ...(d.data() as object) } as CrunchEvent)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
        setCollection(takings); setExpDays(settings.expiringSoonDays); setCounts(mc ?? { total: 0, active: 0, inactive: 0, expiring: 0, withExpiry: 0 }); setCheckIns(ci); setClasses(cls); setEvents(evs);
        if (!mc) setMembersUnavailable(true);

        // Needs attention — each alert is derived from a real count or record
        const a: Alert[] = [];
        const n = newEnq?.data().count ?? 0;
        if (n) a.push({ tone: 'warn', what: `${n} new ${n === 1 ? 'enquiry' : 'enquiries'} waiting for a reply`, action: 'Review enquiries', to: '/admin/dashboard?tab=enquiries' });
        if (overdue) a.push({ tone: 'warn', what: `${overdue} ${overdue === 1 ? 'membership has' : 'memberships have'} expired and ${overdue === 1 ? 'is' : 'are'} due for renewal`, action: 'See dues', to: '/admin/payments/dues' });
        if (mc?.expiring) a.push({ tone: 'warn', what: `${mc.expiring} ${mc.expiring === 1 ? 'membership expires' : 'memberships expire'} in the next ${settings.expiringSoonDays} days`, action: 'See who', to: '/admin/members?filter=expiring' });
        evs.filter((e) => e.status === 'live').forEach((e) => a.push({ tone: 'info', what: `${e.title} is live now`, action: 'Open event day screen', to: `/admin/events/${e.id}/live` }));
        const soon = Date.now() + 48 * 3600 * 1000;
        evs.filter((e) => e.status === 'registration_open' && e.registrationCloseAt && new Date(e.registrationCloseAt).getTime() < soon && new Date(e.registrationCloseAt).getTime() > Date.now())
          .forEach((e) => a.push({ tone: 'info', what: `Registration for ${e.title} closes ${new Date(e.registrationCloseAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, action: 'Manage event', to: `/admin/events/${e.id}` }));
        evs.filter((e) => e.status === 'results_pending').forEach((e) => a.push({ tone: 'warn', what: `Results for ${e.title} aren’t published yet`, action: 'Review results', to: `/admin/events/${e.id}?tab=results` }));
        cls.filter((c) => c.capacity && (c.checkedInCount ?? 0) / c.capacity >= 0.8)
          .forEach((c) => a.push({ tone: 'info', what: `${c.title} (${c.startTime}) is ${(c.checkedInCount ?? 0) >= c.capacity ? 'full' : 'nearly full'} — ${c.checkedInCount ?? 0}/${c.capacity}`, action: 'See check-ins', to: '/admin/attendance' }));
        if (duties && duties.data().count === 0) a.push({ tone: 'warn', what: 'No trainer duty roster set for this week', action: 'Plan the roster', to: '/admin/dashboard?tab=roster' });
        if (mc && mc.total === 0) a.push({ tone: 'info', what: 'No members in the system yet', action: 'Add or import members', to: '/admin/members' });
        setAlerts(a);
      } catch (e) {
        if (!off) setFailed((e as Error).message);
      }
    })();
    return () => { off = true; };
  }, []);

  const loading = !counts && !failed;
  const upcoming = (events ?? []).filter((e) => e.status !== 'results_published').slice(0, 4);

  return (
    <AdminShell title={greeting()} nav="dashboard" area="Dashboard">
      <p className="-mt-6 mb-8 text-sm font-semibold uppercase tracking-[0.2em] text-ink-400">Crunch Fitness · Wakad</p>
      {failed && (
        <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Some data couldn’t load — {failed}.{/permission/i.test(failed) && ' This usually means the Firestore rules in the Firebase console are older than this version of the admin.'}
        </p>
      )}

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-ink-900" />) : <>
          <Metric label="Today’s collection" value={collection_ ? rupees(collection_.paise) : '—'}
            sub={collection_ ? (collection_.payments ? `${collection_.payments} receipt${collection_.payments === 1 ? '' : 's'} today` : 'No payments yet today') : 'Unavailable'} to="/admin/revenue" />
          <Metric label="Check-ins today" value={checkIns ?? '—'} sub={checkIns == null ? 'Unavailable' : classes?.length ? `${classes.length} class${classes.length === 1 ? '' : 'es'} today` : 'No classes today'} to="/admin/attendance" />
          <Metric label="Active members" value={!membersUnavailable && counts?.total ? counts.active : '—'}
            sub={membersUnavailable ? 'Unavailable' : !counts?.total ? 'No members added yet' : `of ${counts.total} member${counts.total === 1 ? '' : 's'}${counts.withExpiry < counts.total ? ` · ${counts.total - counts.withExpiry} without an expiry date` : ''}`}
            to="/admin/members?filter=active" />
          <Metric label="Expiring soon" value={membersUnavailable || !counts?.total ? '—' : counts.expiring} sub={`Next ${expDays} days`} to="/admin/payments/dues" />
        </>}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section aria-labelledby="attention-heading" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 lg:col-span-3">
          <h2 id="attention-heading" className="text-sm font-bold uppercase tracking-wider text-white">Needs attention</h2>
          {!alerts ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-800" /> : alerts.length === 0 ? (
            <p className="mt-4 text-sm text-ink-400">Nothing needs attention right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {alerts.map((a) => (
                <li key={a.what} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', a.tone === 'warn' ? 'bg-amber-400' : 'bg-sky-400')} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm text-white">{a.what}</span>
                  <Link to={a.to} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-400 hover:underline">{a.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="actions-heading" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 lg:col-span-2">
          <h2 id="actions-heading" className="text-sm font-bold uppercase tracking-wider text-white">Quick actions</h2>
          {/* The four front-desk jobs first, then the rest */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { to: '/admin/members/new', label: 'Add member', icon: <UserPlus size={18} /> },
              { to: '/admin/payments/new', label: 'Record payment', icon: <IndianRupee size={18} /> },
              { to: '/admin/attendance?checkin=1', label: 'Check in', icon: <ClipboardCheck size={18} /> },
              { to: '/admin/payments/dues', label: 'View dues', icon: <AlarmClock size={18} /> },
            ].map((q) => (
              <Link key={q.label} to={q.to} className="flex min-h-[3.5rem] items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-400 hover:text-ink-950 [&:hover_span]:text-ink-950">
                <span className="text-brand-400">{q.icon}</span>{q.label}
              </Link>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { to: '/admin/events/new', label: 'New event', icon: <CalendarPlus size={14} /> },
              { to: '/admin/dashboard?tab=schedule', label: 'Add class', icon: <CalendarDays size={14} /> },
              { to: '/admin/dashboard?tab=enquiries', label: 'Enquiries', icon: <Inbox size={14} /> },
            ].map((q) => (
              <Link key={q.label} to={q.to} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 py-2.5 text-xs font-semibold text-ink-300 transition-colors hover:border-white/25 hover:text-white">
                <span className="text-ink-500">{q.icon}</span>{q.label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="classes-heading" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <div className="flex items-center justify-between"><h2 id="classes-heading" className="text-sm font-bold uppercase tracking-wider text-white">Today’s classes</h2><Link to="/admin/attendance" className="text-xs text-ink-400 hover:text-white">Check-ins →</Link></div>
          {!classes ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-800" /> : classes.length === 0 ? <p className="mt-4 text-sm text-ink-400">No classes scheduled today.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {classes.map((c) => (
                <li key={c.id} className="flex items-center gap-4 py-3">
                  <span className="w-14 font-mono text-sm text-ink-300">{c.startTime}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{c.title}</span><span className="text-xs text-ink-500">{c.trainerName ?? ''}{c.area ? ` · ${c.area}` : ''}</span></span>
                  <span className="text-sm tabular-nums text-ink-300">{c.checkedInCount ?? 0}<span className="text-ink-500">/{c.capacity}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="events-heading" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <div className="flex items-center justify-between"><h2 id="events-heading" className="text-sm font-bold uppercase tracking-wider text-white">Events</h2><Link to="/admin/events" className="text-xs text-ink-400 hover:text-white">All events →</Link></div>
          {!events ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-800" /> : upcoming.length === 0 ? <p className="mt-4 text-sm text-ink-400">No upcoming events.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {upcoming.map((e) => (
                <li key={e.id}><Link to={`/admin/events/${e.id}`} className="flex items-center gap-4 py-3">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{e.title}</span><span className="text-xs text-ink-500">{formatEventDate(e.eventDate)} · {e.registrationCount} registered</span></span>
                  <span className="text-xs font-semibold text-ink-300">{STATUS[e.status].admin}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="mt-6 text-xs text-ink-500">“Expiring soon” means within {expDays} days — change it in Settings.</p>
    </AdminShell>
  );
};

export default Overview;
