import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarPlus, ClipboardCheck, Fingerprint, IndianRupee, UserPlus } from 'lucide-react';
import { addDays, todayIST, type Member } from '@/lib/admin/members';
import { PAYMENT_LABEL, monthStart, parsePrice, paymentTypeOf, revenueBetween, rupees, toPaise } from '@/lib/admin/payments';
import { ACCESS_CONNECTED, deviceHealth } from '@/lib/access';
import { identitiesOfMember } from '@/lib/access/store';
import type { BiometricIdentity } from '@/lib/access';
import { STATUS, formatEventDate } from '@/lib/events';
import { AdminShell } from '@/features/events/admin/shared';
import { dashboardQuery } from '@/features/admin/dashboardData';
import { prefetchCommonPages } from '@/features/admin/pageData';
import { Button } from '@/components/ui/button';
import { EmptyNote, ErrorNote, SideDrawer, SkeletonRows } from '@/features/admin/kit';
import AddMemberDrawer from '@/features/admin/members/AddMemberDrawer';
import MemberPicker from '@/features/admin/members/MemberPicker';
import EnrollWizard from '@/features/admin/members/EnrollWizard';
import PaymentForm from '@/features/admin/payments/PaymentForm';
import StaffCheckIn from '@/features/admin/StaffCheckIn';
import { fmtTime, useLookups } from '@/features/admin/members/lookups';
import { GYM } from '@/lib/gym';
import { cn } from '@/lib/utils';

type Range = 'today' | '7d' | 'month';
const RANGE_LABEL: Record<Range, string> = { today: 'Today', '7d': '7 days', month: 'This month' };

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const Panel = ({ id, title, link, children, className }: { id: string; title: string; link?: { to: string; label: string }; children: ReactNode; className?: string }) => (
  <section aria-labelledby={id} className={cn('rounded-2xl border border-white/[0.08] bg-ink-900 p-5', className)}>
    <div className="flex items-center justify-between gap-3"><h2 id={id} className="font-sans text-sm font-bold uppercase tracking-wider text-white">{title}</h2>{link && <Link to={link.to} className="text-xs text-ink-400 hover:text-white">{link.label} →</Link>}</div>
    <div className="mt-4">{children}</div>
  </section>
);

/** Dashboard — the gym today, what needs doing, and the shortcuts to do it. Real data only. */
const Overview = () => {
  const today = todayIST();
  const { plans } = useLookups();
  const [range, setRange] = useState<Range>('today');
  // Quick actions open their task in a drawer, on top of the dashboard
  const navigate = useNavigate();
  type Task = 'add' | 'pay' | 'checkin' | 'enroll';
  const [params, setParams] = useSearchParams();
  // ?task= (from the command palette) opens that task straight away
  const [task, setTask] = useState<Task | null>(null);
  useEffect(() => {
    const t = params.get('task');
    if (t === 'add' || t === 'pay' || t === 'checkin' || t === 'enroll') { setEnrollFor(null); setTask(t); setParams({}, { replace: true }); }
  }, [params, setParams]);
  const [enrollFor, setEnrollFor] = useState<{ m: Member; ids: BiometricIdentity[] } | null>(null);
  // Collection for the chosen range — one server-side sum
  const from = range === 'today' ? today : range === '7d' ? addDays(today, -6) : monthStart(today);
  const collectionQ = useQuery({ queryKey: ['admin', 'revenue', from, today], queryFn: () => revenueBetween(from, today), placeholderData: keepPreviousData });
  const collection_ = collectionQ.data ?? null;

  const dash = useQuery(dashboardQuery(today));
  // Dashboard on screen → quietly warm Members, Attendance, Dues and Payments for the next click
  useEffect(() => { if (!dash.data) return; const t = setTimeout(prefetchCommonPages, 400); return () => clearTimeout(t); }, [dash.data]);

  const d = dash.data;
  const counts = d?.counts ?? null, checkIns = d?.checkIns ?? null, todays = d?.todays ?? null, events = d?.events ?? null, due = d?.due ?? null;
  const access = d?.access ?? null, activity = d?.activity ?? null, alerts = d?.alerts ?? null, expDays = d?.expDays ?? 14, membersUnavailable = d?.membersUnavailable ?? false;
  const failed = dash.error ? (dash.error as Error).message : d?.failed ?? null;
  const loading = !d && !failed;
  const split = { membership: 0, pt: 0, other: 0 };
  (todays ?? []).filter((p) => p.status === 'paid').forEach((p) => { split[paymentTypeOf(p)] += p.amountPaise; });
  // Estimated renewals: each due member's plan at its current price (never money owed)
  const dueEstimate = (due ?? []).reduce((s, m) => { const p = m.planId ? parsePrice(plans.get(m.planId)?.price) : null; return s + (p != null ? toPaise(p) : 0); }, 0);
  const online = access?.devices.filter((d) => deviceHealth(d) === 'online').length ?? 0;
  const accessIssues = access ? access.pending + access.failed + access.devices.filter((d) => deviceHealth(d) === 'offline').length : 0;
  const upcoming = (events ?? []).filter((e) => e.status !== 'results_published').slice(0, 4);
  const lastPayment = (todays ?? []).find((p) => p.status === 'paid');
  const clock = (t?: { toDate: () => Date }) => (t ? t.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <AdminShell title={greeting()} nav="dashboard" area="Dashboard" bare>
      <header className="mb-8">
        <h1 className="font-display text-5xl font-bold uppercase leading-none text-white sm:text-6xl">{greeting()}</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-ink-400">{GYM.name.replace(' Club', '')} · Wakad</p>
        <p className="mt-4 text-base text-ink-300">{!alerts ? 'Checking what needs your attention…' : alerts.length ? 'Here’s what needs your attention today.' : 'Nothing needs your attention right now.'}</p>
      </header>
      {failed && <div className="mb-6"><ErrorNote what="Some of today’s numbers couldn’t load." error={failed} onRetry={() => dash.refetch()} /></div>}

      <section aria-label="Today at a glance" className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 lg:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse border-white/[0.06] p-5 motion-reduce:animate-none [&:not(:last-child)]:border-r" />) : [
          { label: 'Active members', value: !membersUnavailable && counts?.total ? counts.active : '—', sub: membersUnavailable ? 'Unavailable' : !counts?.total ? 'No members added yet' : `of ${counts.total} member${counts.total === 1 ? '' : 's'}`, to: '/admin/members?filter=active' },
          { label: 'Check-ins today', value: checkIns ?? '—', sub: checkIns == null ? 'Unavailable' : access?.scansToday ? `Manual · plus ${access.scansToday} door scans` : 'Manual check-ins', to: '/admin/attendance' },
          { label: 'Today’s collection', value: collection_ && range === 'today' ? rupees(collection_.paise) : todays ? rupees(split.membership + split.pt + split.other) : '…', sub: todays?.length ? `Membership ${rupees(split.membership)} · PT ${rupees(split.pt)} · Other ${rupees(split.other)}` : 'No payments yet today', to: '/admin/payments' },
          { label: 'Renewals due', value: due ? due.length : '—', sub: due?.length ? `Estimated next renewals ${rupees(dueEstimate)}` : 'No renewals due', to: '/admin/payments/dues', warn: !!due?.length },
        ].map((k) => (
          <Link key={k.label} to={k.to} className="group border-white/[0.06] p-5 transition-colors hover:bg-white/[0.03] max-lg:[&:nth-child(odd)]:border-r max-lg:[&:nth-child(-n+2)]:border-b lg:[&:not(:last-child)]:border-r">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{k.label}</p>
            <p className={cn('mt-1 font-display text-4xl font-bold leading-none tabular-nums', k.warn ? 'text-amber-200' : 'text-white')}>{k.value}</p>
            <p className="mt-1.5 truncate text-xs text-ink-500 group-hover:text-ink-400">{k.sub}</p>
          </Link>
        ))}
      </section>

      <section aria-labelledby="actions-heading" className="mt-6">
        <h2 id="actions-heading" className="sr-only">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {([
            { task: 'add', label: 'Add member', icon: <UserPlus size={20} /> },
            { task: 'pay', label: 'Collect payment', icon: <IndianRupee size={20} /> },
            { task: 'checkin', label: 'Check in', icon: <ClipboardCheck size={20} /> },
            { task: 'enroll', label: 'Enroll access', icon: <Fingerprint size={20} /> },
          ] as const).map((q, i) => (
            <button key={q.label} type="button" onClick={() => { setEnrollFor(null); setTask(q.task); }} aria-haspopup="dialog" className={cn('flex min-h-16 items-center gap-3 rounded-2xl px-4 py-3 text-left text-base font-bold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
              i === 0 ? 'bg-brand-400 text-ink-950 hover:bg-brand-300' : 'border border-white/[0.1] bg-ink-900 text-white hover:border-brand-400/50 hover:bg-white/[0.03] [&>span]:text-brand-400')}>
              <span>{q.icon}</span>{q.label}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Panel id="attention-heading" title="Needs attention" className="lg:col-span-3">
          {!alerts ? <SkeletonRows rows={3} /> : alerts.length === 0 ? <EmptyNote title="All clear" body="No renewals, enquiries or access issues waiting." /> : (
            <ul className="-mt-1 divide-y divide-white/[0.06]">
              {alerts.map((a) => (
                <li key={a.what} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', a.tone === 'warn' ? 'bg-amber-300' : 'bg-sky-300')} aria-hidden />
                  <span className="min-w-0 flex-1 text-sm text-white">{a.what}</span>
                  <Button asChild size="sm" variant="outline"><Link to={a.to}>{a.action}</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel id="activity-heading" title="Recent activity" link={{ to: '/admin/activity', label: 'View all activity' }} className="lg:col-span-2">
          {!activity ? <SkeletonRows rows={4} /> : activity.length === 0 ? <EmptyNote title="Quiet so far" body="Payments, new members and check-ins will show here as they happen." /> : (
            <ol className="-mt-1 space-y-3 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="grid grid-cols-[3.5rem_1fr] gap-3">
                  <span className="pt-0.5 font-mono text-xs tabular-nums text-ink-500">{clock(a.at)}</span>
                  <span className="min-w-0 text-white">{a.action}{typeof a.meta?.name === 'string' ? <span className="text-ink-400"> · {a.meta.name}</span> : null}{typeof a.meta?.amount === 'string' ? <span className="text-ink-400"> · {a.meta.amount}</span> : null}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <h2 className="mb-3 mt-10 font-sans text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Today’s operations</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Panel id="ops-att" title="Attendance" link={{ to: '/admin/attendance', label: 'Open' }}>
          <p className="font-display text-4xl font-bold tabular-nums text-white">{checkIns ?? '—'}<span className="ml-2 font-sans text-sm font-normal text-ink-400">check-ins</span></p>
          <p className="mt-1 text-xs text-ink-500">{access?.scansToday ? `Manual · plus ${access.scansToday} door scans` : 'Manual check-ins today'}</p>
        </Panel>
        <Panel id="payments-heading" title="Payments" link={{ to: '/admin/payments', label: 'Open' }}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-4xl font-bold tabular-nums text-white">{collection_ ? rupees(collection_.paise) : '…'}</p>
            <div className="flex gap-1" role="group" aria-label="Collection period">
              {(Object.keys(RANGE_LABEL) as Range[]).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', range === r ? 'bg-white text-ink-950' : 'text-ink-400 hover:text-white')}>{RANGE_LABEL[r]}</button>)}
            </div>
          </div>
          <p className="mt-1 text-xs text-ink-500">{range === 'today' ? (todays?.length ? `${todays.filter((p) => p.status === 'paid').length} payment${todays.length === 1 ? '' : 's'}${lastPayment ? ` · last ${PAYMENT_LABEL[paymentTypeOf(lastPayment)].toLowerCase()} from ${lastPayment.memberName}` : ''}` : 'Today’s collection is clear.') : collection_ ? `${collection_.payments} receipt${collection_.payments === 1 ? '' : 's'}` : ''}</p>
        </Panel>
        <Panel id="access-heading" title="Access control" link={{ to: '/admin/access', label: 'Open' }} className="sm:col-span-2 xl:col-span-1">
          {!access ? <SkeletonRows rows={2} /> : (
            <>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-ink-500">Devices</dt><dd className="font-display text-2xl font-bold text-white">{access.devices.length ? `${online} / ${access.devices.length}` : '—'}</dd></div>
                <div><dt className="text-xs text-ink-500">Verified</dt><dd className="font-display text-2xl font-bold text-white">{access.grantedToday}</dd></div>
                <div><dt className="text-xs text-ink-500">Not let in</dt><dd className="font-display text-2xl font-bold text-white">{access.scansToday - access.grantedToday}</dd></div>
              </dl>
              <p className="mt-2 text-xs text-ink-500">{access.pending ? `${access.pending} enrolment${access.pending === 1 ? '' : 's'} waiting` : 'No enrolments waiting'}{access.failed ? ` · ${access.failed} sync failed` : ''}</p>
              {!ACCESS_CONNECTED && <p className="mt-2 text-xs text-amber-200/90">Device integration not configured — the F22 still runs through the old system.</p>}
            </>
          )}
        </Panel>
      </div>

      <div className="mt-6">
        <Panel id="events-heading" title="Upcoming events" link={{ to: '/admin/events', label: 'All events' }}>
          {!events ? <SkeletonRows rows={2} /> : upcoming.length === 0 ? (
            <EmptyNote title="No upcoming events" body="Nothing scheduled yet."><Button asChild size="sm"><Link to="/admin/events/new"><CalendarPlus /> Create event</Link></Button></EmptyNote>
          ) : (
            <ul className="-mt-1 divide-y divide-white/[0.06]">
              {upcoming.map((e) => (
                <li key={e.id}><Link to={`/admin/events/${e.id}`} className="flex items-center gap-4 py-3 transition-colors hover:text-brand-300">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{e.title}</span><span className="text-xs text-ink-500">{formatEventDate(e.eventDate)} · {e.registrationCount} registered</span></span>
                  <span className="text-xs font-semibold text-ink-300">{STATUS[e.status].admin}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="mt-6 text-xs text-ink-500">“Expiring soon” means within {expDays} days — change it in Settings. Renewal amounts are estimates from current plan prices, not money owed.</p>

      <AddMemberDrawer open={task === 'add'} onOpenChange={(o) => !o && setTask(null)} />
      <SideDrawer open={task === 'pay'} onOpenChange={(o) => !o && setTask(null)} title="Collect payment" description="Find the member, then record what they paid">
        {task === 'pay' && <PaymentForm compact initial={{}} onCancel={() => setTask(null)} onSaved={(pid) => { setTask(null); navigate(`/admin/payments/${pid}?new=1`); }} />}
      </SideDrawer>
      <SideDrawer open={task === 'checkin'} onOpenChange={(o) => !o && setTask(null)} title="Check in" description="One manual check-in per member per day">
        {task === 'checkin' && <StaffCheckIn framed={false} autoFocus onDone={() => dash.refetch()} />}
      </SideDrawer>
      <SideDrawer open={task === 'enroll'} onOpenChange={(o) => !o && setTask(null)} title="Enroll access" description={enrollFor ? enrollFor.m.name : 'Fingerprint on the gym’s biometric device'}>
        {task === 'enroll' && (enrollFor ? (
          <div className="space-y-4">
            <EnrollWizard m={enrollFor.m} existing={enrollFor.ids} onDone={() => identitiesOfMember(enrollFor.m.id).then((ids) => setEnrollFor((x) => (x ? { ...x, ids } : x))).catch(() => {})} />
            <Button variant="ghost" onClick={() => setEnrollFor(null)}>Choose a different member</Button>
          </div>
        ) : <MemberPicker label="Who is enrolling?" onPick={(m) => identitiesOfMember(m.id).catch(() => []).then((ids) => setEnrollFor({ m, ids }))} />)}
      </SideDrawer>
    </AdminShell>
  );
};

export default Overview;
