import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { todayIST } from '@/lib/admin/members';
import { approvedLeaveOn, dayStatus, exceptionsOf, fmtClock, fmtDuration, listTeam, trainerAttendanceOn, type TrainerDay } from '@/lib/admin/trainerAttendance';
import { useCached } from '../useCached';
import { DataRegion, EmptyNote, ErrorNote, HeadRow, Pill, SkeletonRows } from '../kit';
import { Exceptions, ManualCheckout, StatusPill } from './bits';

const Metric = ({ label, value, sub }: { label: string; value: string | number; sub: string }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-ink-900 px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
    <p className="mt-1 font-display text-3xl font-bold leading-none tabular-nums text-white">{value}</p>
    <p className="mt-1 text-xs text-ink-500">{sub}</p>
  </div>
);

/**
 * Trainers → Attendance for one day, from device punches only. There is no roster or shift, so a
 * trainer with no punch is "No attendance recorded" — never "absent".
 */
const TrainerAttendanceBoard = () => {
  const [params, setParams] = useSearchParams();
  const today = todayIST();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') ?? '') && params.get('day')! <= today ? params.get('day')! : today;
  const setDay = (d: string) => setParams((p) => { const n = new URLSearchParams(p); if (!d || d === today) n.delete('day'); else n.set('day', d); return n; }, { replace: true });
  const [closing, setClosing] = useState<TrainerDay | null>(null);

  const team = useCached(['team'], listTeam);
  const recs = useCached(['trainerAttendance', day], () => trainerAttendanceOn(day));
  const leave = useCached(['trainerLeaveOn', day], () => approvedLeaveOn(day));
  const error = team.error ?? recs.error;
  const byTrainer = new Map((recs.data ?? []).map((r) => [r.trainerId, r]));
  const onLeave = new Set((leave.data ?? []).map((l) => l.trainerId));
  // Records for trainers whose profile has since been removed are still shown
  const people = [...(team.data ?? []), ...(recs.data ?? []).filter((r) => !(team.data ?? []).some((t) => t.id === r.trainerId)).map((r) => ({ id: r.trainerId, name: r.trainerName, role: 'Profile removed' }))];
  const count = (s: string) => people.filter((t) => dayStatus(byTrainer.get(t.id)) === s).length;
  const present = people.filter((t) => byTrainer.get(t.id)?.punchCount).length;
  const loading = !team.data || !recs.data;

  return (
    <section aria-labelledby="ta-h" className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="mb-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
        <h2 id="ta-h" className="font-sans text-sm font-bold uppercase tracking-wider text-white">Trainer attendance</h2>
        <label className="flex items-center gap-2 text-sm text-ink-400">Day
          <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="h-10 rounded-lg border border-white/15 bg-field px-2 text-white focus:border-brand-400 focus:outline-none" />
        </label>
      </div>
      {error && <div className="mb-4"><ErrorNote what="Couldn’t load trainer attendance." error={error} onRetry={() => { team.refetch(); recs.refetch(); }} /></div>}
      <div className="mb-3 grid flex-shrink-0 grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Attendance summary">
        <Metric label={day === today ? 'Present today' : 'Present'} value={loading ? '…' : present} sub="At least one punch" />
        <Metric label="Completed" value={loading ? '…' : count('COMPLETED')} sub="Check-in and check-out" />
        <Metric label="Missing check-out" value={loading ? '…' : count('MISSING_CHECKOUT')} sub="Only one punch so far" />
        <Metric label="No attendance recorded" value={loading ? '…' : count('NO_ATTENDANCE_RECORDED')} sub="No punch this day" />
      </div>
      {loading ? <SkeletonRows rows={3} /> : people.length === 0 ? <EmptyNote title="No trainers" body="Add trainer profiles under Team, then link each trainer to their device user ID." /> : (
        <DataRegion>
          <HeadRow className="md:grid-cols-[minmax(7rem,1fr)_5rem_5rem_4.5rem_minmax(8rem,1.3fr)_9.5rem] xl:grid-cols-[minmax(8rem,1fr)_5.5rem_5.5rem_4.5rem_5rem_minmax(9rem,1.3fr)_10rem]"><span>Trainer</span><span>First punch</span><span>Last punch</span><span className="hidden xl:block">Punches</span><span>Duration</span><span>Notes</span><span className="justify-self-end">Status</span></HeadRow>
          <ul className="divide-y divide-white/[0.06]" aria-label="Trainer attendance">
          {people.map((t) => {
            const r = byTrainer.get(t.id);
            const status = dayStatus(r);
            return (
              <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm md:grid-cols-[minmax(7rem,1fr)_5rem_5rem_4.5rem_minmax(8rem,1.3fr)_9.5rem] xl:grid-cols-[minmax(8rem,1fr)_5.5rem_5.5rem_4.5rem_5rem_minmax(9rem,1.3fr)_10rem]">
                <Link to={`/admin/trainers/${t.id}?tab=attendance`} className="min-w-0 truncate font-semibold text-white hover:underline">{t.name}</Link>
                <span className="md:order-last md:justify-self-end"><StatusPill status={status} /></span>
                <span className="tabular-nums text-ink-300"><span className="text-xs text-ink-500 md:hidden">In </span>{fmtClock(r?.firstAt)}</span>
                <span className="tabular-nums text-ink-300"><span className="text-xs text-ink-500 md:hidden">Out </span>{fmtClock(r?.checkoutAt)}</span>
                <span className="hidden tabular-nums text-ink-300 xl:block">{r?.punchCount ?? 0}</span>
                <span className="tabular-nums text-ink-300">{fmtDuration(r?.durationMs)}</span>
                <span className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1">
                  {onLeave.has(t.id) && !r?.punchCount && <Pill tone="info">On approved leave</Pill>}
                  <Exceptions list={exceptionsOf(r, onLeave.has(t.id))} />
                  {r && status === 'MISSING_CHECKOUT' && <Button size="sm" variant="outline" className="h-8" onClick={() => setClosing(r)}><LogOut /> Add check-out</Button>}
                </span>
              </li>
            );
          })}
          </ul>
        </DataRegion>
      )}
      <p className="mt-2 flex-shrink-0 text-xs text-ink-500">The X2008 can’t tell entry from exit, so the first punch of the day is the check-in and the last is the check-out. Punches in between are kept in Access → Activity.</p>
      <ManualCheckout day={closing} onClose={() => setClosing(null)} onDone={() => recs.refetch()} />
    </section>
  );
};

export default TrainerAttendanceBoard;
