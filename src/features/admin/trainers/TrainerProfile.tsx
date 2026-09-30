import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { CalendarPlus, LogOut, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { addDays, memberCode, todayIST, type Member } from '@/lib/admin/members';
import { activityFor } from '@/lib/admin/activity';
import { BIOMETRIC_LABEL } from '@/lib/access';
import { identitiesOfTrainer } from '@/lib/access/store';
import {
  LEAVE_STATUS, LEAVE_TYPE, dayStatus, exceptionsOf, fmtClock, fmtDuration, leaveOf, listTeam, trainerAttendanceOf, type Leave, type TrainerDay,
} from '@/lib/admin/trainerAttendance';
import { fmtTime } from '@/features/admin/members/lookups';
import { AdminShell } from '@/features/events/admin/shared';
import { useCached } from '../useCached';
import { usePaged } from '../usePaged';
import { DataRegion, EmptyNote, ErrorNote, HeadRow, ListBox, Pagination, Pill, SkeletonRows } from '../kit';
import { Exceptions, LeaveDrawer, ManualCheckout, StatusPill } from './bits';

const TABS = [['overview', 'Overview'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['members', 'Assigned members'], ['activity', 'Activity']] as const;
type Tab = (typeof TABS)[number][0];
const monthOf = (ymd: string) => ymd.slice(0, 7);
const monthEnd = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const covers = (leave: Leave[], d: string) => leave.some((l) => l.status === 'approved' && l.from <= d && d <= l.to);

/** One trainer: attendance from their punches, leave, assigned members, activity. */
const TrainerProfile = () => {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'overview') as Tab;
  const go = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const today = todayIST();
  const [month, setMonth] = useState(monthOf(today));
  const [closing, setClosing] = useState<TrainerDay | null>(null);
  const [editing, setEditing] = useState<Leave | null | 'new'>(null);

  const team = useCached(['team'], listTeam);
  const trainer = team.data?.find((t) => t.id === id);
  const from = `${month}-01`, to = month === monthOf(today) ? today : monthEnd(month);
  const days = useCached(['trainerDays', id, month], () => trainerAttendanceOf(id, from, to));
  const leave = useCached(['trainerLeave', id], () => leaveOf(id));
  const ids = useCached(['trainerIds', id], () => identitiesOfTrainer(id));
  const log = useCached(['trainerActivity', id], () => activityFor(id, 50), tab === 'activity');
  const membersBase = useMemo(() => query(collection(db, 'members'), where('trainerId', '==', id)), [id]);
  const members = usePaged(`trainerMembers:${id}`, tab === 'members' ? membersBase : null, (d) => ({ id: d.id, ...d.data() }) as Member, 25);

  // Every calendar day of the month up to today: a day without a record is "No attendance recorded"
  const calendar = useMemo(() => {
    const out: string[] = [];
    for (let d = to; d >= from; d = addDays(d, -1)) out.push(d);
    return out;
  }, [from, to]);
  const byDay = new Map((days.data ?? []).map((d) => [d.date, d]));
  const recorded = days.data ?? [];
  const totalMs = recorded.reduce((n, d) => n + (d.durationMs ?? 0), 0);
  const todayRec = month === monthOf(today) ? byDay.get(today) : undefined;

  if (team.data && !trainer) return <AdminShell title="Trainer not found" nav="trainers" area="People" back={{ to: '/admin/trainers', label: 'Trainers' }}><EmptyNote title="No such trainer" body="The profile may have been removed." /></AdminShell>;

  return (
    <AdminShell title={trainer?.name ?? 'Trainer'} nav="trainers" area="People" fill={tab === 'attendance'} back={{ to: '/admin/trainers', label: 'Trainers' }}
      subtitle={trainer?.role ?? ''} actions={<Button asChild variant="outline"><Link to="/admin/team"><Pencil /> Edit profile</Link></Button>}>
      <div role="tablist" aria-label="Trainer" className="-mt-1 mb-4 flex flex-shrink-0 gap-1 overflow-x-auto border-b border-white/[0.08]">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => go(t)}
            className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', tab === t ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}>{label}</button>
        ))}
      </div>
      {days.error && <div className="mb-5"><ErrorNote what={/index/i.test(days.error) ? 'Trainer attendance needs a database index that isn’t published yet (see FIREBASE_INDEX_AUDIT.md).' : 'Couldn’t load attendance.'} error={days.error} onRetry={days.refetch} /></div>}

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="ov-today" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
            <h2 id="ov-today" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Today</h2>
            {!days.data ? <div className="mt-4 h-12 animate-pulse rounded-xl bg-ink-800" /> : (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <StatusPill status={dayStatus(todayRec)} />
                {todayRec && <span className="text-ink-300">In {fmtClock(todayRec.firstAt)} · Out {fmtClock(todayRec.checkoutAt)} · {fmtDuration(todayRec.durationMs)}</span>}
                {leave.data && covers(leave.data, today) && <Pill tone="info">On approved leave</Pill>}
              </div>
            )}
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {([['Days recorded', recorded.length], ['Completed', recorded.filter((d) => d.status === 'COMPLETED').length], ['Hours', days.data ? fmtDuration(totalMs) : '…']] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col-reverse rounded-xl bg-ink-800 p-2"><dt className="text-[11px] text-ink-400">{k} this month</dt><dd className="font-display text-2xl font-bold tabular-nums text-white">{days.data ? v : '…'}</dd></div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="ov-dev" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
            <h2 id="ov-dev" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Device</h2>
            {!ids.data ? <div className="mt-4 h-12 animate-pulse rounded-xl bg-ink-800" /> : ids.data.filter((i) => i.status !== 'REMOVED').length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">Not linked to a device user yet, so punches can’t be recorded as trainer attendance. <Link to="/admin/settings/access" className="font-semibold text-brand-fg hover:underline">Link in Access devices → Match users</Link>.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">{ids.data.filter((i) => i.status !== 'REMOVED').map((i) => <li key={i.id} className="flex items-center gap-2"><span className="font-mono text-white">#{i.deviceUserId}</span><Pill tone="muted">{BIOMETRIC_LABEL[i.status]}</Pill></li>)}</ul>
            )}
          </section>
        </div>
      )}

      {tab === 'attendance' && (
        <section aria-labelledby="att-h" className="flex flex-col lg:min-h-0 lg:flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="att-h" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Attendance</h2>
            <label className="flex items-center gap-2 text-sm text-ink-400">Month
              <input type="month" value={month} max={monthOf(today)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 rounded-lg border border-white/15 bg-field px-2 text-white focus:border-brand-400 focus:outline-none" />
            </label>
          </div>
          {!days.data ? <SkeletonRows rows={5} /> : (
            <DataRegion>
              <HeadRow className="md:grid-cols-[7rem_5rem_5rem_4.5rem_minmax(8rem,1fr)_9.5rem] xl:grid-cols-[8rem_5.5rem_5.5rem_4.5rem_5rem_minmax(9rem,1fr)_10rem]"><span>Day</span><span>First punch</span><span>Last punch</span><span className="hidden xl:block">Punches</span><span>Duration</span><span>Notes</span><span className="justify-self-end">Status</span></HeadRow>
              <ul className="divide-y divide-white/[0.06]" aria-label="Attendance by day">
              {calendar.map((d) => {
                const r = byDay.get(d);
                const status = dayStatus(r);
                const lv = leave.data ? covers(leave.data, d) : false;
                return (
                  <li key={d} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm md:grid-cols-[7rem_5rem_5rem_4.5rem_minmax(8rem,1fr)_9.5rem] xl:grid-cols-[8rem_5.5rem_5.5rem_4.5rem_5rem_minmax(9rem,1fr)_10rem]">
                    <span className="font-semibold text-white">{dayLabel(d)}</span>
                    <span className="md:order-last md:justify-self-end"><StatusPill status={status} /></span>
                    <span className="text-ink-300"><span className="text-xs text-ink-500 md:hidden">In </span>{fmtClock(r?.firstAt)}</span>
                    <span className="text-ink-300"><span className="text-xs text-ink-500 md:hidden">Out </span>{fmtClock(r?.checkoutAt)}</span>
                    <span className="hidden tabular-nums text-ink-300 xl:block">{r?.punchCount ?? 0}</span>
                    <span className="tabular-nums text-ink-300">{fmtDuration(r?.durationMs)}</span>
                    <span className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
                      {lv && !r?.punchCount && <Pill tone="info">Approved leave</Pill>}
                      <Exceptions list={exceptionsOf(r, lv)} />
                      {r?.manualCheckoutReason && <span className="text-xs text-ink-500">“{r.manualCheckoutReason}”</span>}
                      {r && status === 'MISSING_CHECKOUT' && <Button size="sm" variant="outline" onClick={() => setClosing(r)}><LogOut /> Add check-out</Button>}
                    </span>
                  </li>
                );
              })}
              </ul>
            </DataRegion>
          )}
          <p className="mt-3 text-xs text-ink-500">First punch of the day = check-in, last = check-out. A single punch is shown as missing check-out; no check-out is ever assumed. A day with no punch is “No attendance recorded”.</p>
        </section>
      )}

      {tab === 'leave' && trainer && (
        <section aria-labelledby="lv-h">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="lv-h" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Leave</h2>
            <Button size="sm" onClick={() => setEditing('new')}><CalendarPlus /> Record leave</Button>
          </div>
          {leave.error ? <ErrorNote what="Couldn’t load leave." error={leave.error} onRetry={leave.refetch} /> : !leave.data ? <SkeletonRows rows={3} /> : leave.data.length === 0 ? <EmptyNote title="No leave recorded" body="Leave appears here once it’s recorded. Nothing is assumed from missing punches." /> : (
            <ListBox label="Leave">
              {leave.data.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0"><span className="block font-semibold text-white">{dayLabel(l.from)}{l.to !== l.from ? ` – ${dayLabel(l.to)}` : ''}</span><span className="text-xs text-ink-400">{LEAVE_TYPE[l.type]}{l.reason ? ` · ${l.reason}` : ''}</span></span>
                  <span className="flex items-center gap-2"><Pill tone={l.status === 'approved' ? 'ok' : l.status === 'pending' ? 'warn' : 'muted'}>{LEAVE_STATUS[l.status]}</Pill><Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Edit</Button></span>
                </li>
              ))}
            </ListBox>
          )}
          <LeaveDrawer open={editing !== null} trainer={trainer} existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={() => { leave.refetch(); days.refetch(); }} />
        </section>
      )}

      {tab === 'members' && (
        <section aria-labelledby="mem-h">
          <h2 id="mem-h" className="font-sans mb-4 text-sm font-bold uppercase tracking-wider text-white">Assigned members</h2>
          {members.error ? <ErrorNote what="Couldn’t load members." error={members.error} onRetry={members.refetch} /> : !members.rows ? <SkeletonRows rows={4} /> : members.rows.length === 0 ? <EmptyNote title="No assigned members" body="Members show here when this trainer is set on their profile." /> : (
            <ListBox label="Assigned members">
              {members.rows.map((m) => <li key={m.id}><Link to={`/admin/members/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.03]"><span className="truncate font-semibold text-white">{m.name}</span><span className="font-mono text-xs text-ink-500">{memberCode(m.id)}</span></Link></li>)}
            </ListBox>
          )}
          <Pagination p={members} label="Assigned members" count={members.rows?.length} />
        </section>
      )}

      {tab === 'activity' && (
        <section aria-labelledby="log-h" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 id="log-h" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Activity</h2>
          {log.error ? <div className="mt-4"><ErrorNote what="Couldn’t load activity." error={log.error} /></div> : !log.data ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : log.data.length === 0 ? <p className="mt-4 text-sm text-ink-400">No recorded activity yet.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
              {log.data.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span className="text-white">{a.action}{a.meta?.date ? ` · ${a.meta.date}` : ''}</span><span className="text-xs text-ink-500">{fmtTime(a.at)} · {a.actorEmail}</span></li>)}
            </ul>
          )}
        </section>
      )}
      <ManualCheckout day={closing} onClose={() => setClosing(null)} onDone={() => days.refetch()} />
    </AdminShell>
  );
};

export default TrainerProfile;
