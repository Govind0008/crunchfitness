import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { todayIST } from '@/lib/admin/members';
import { phoneKey } from '@/lib/admin/phone';
import {
  attendeesOf, checkInsSince, classesOn, countSince, peakHour, periodStarts, type CheckInRecord, type ClassSession,
} from '@/lib/admin/attendance';
import { AdminShell, Empty } from '@/features/events/admin/shared';
import StaffCheckIn from './StaffCheckIn';

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const time = (r: CheckInRecord) => r.checkedInAt?.toDate().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) ?? '';

const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>
    <p className="mt-2 font-display text-4xl font-bold leading-none tabular-nums text-white">{value}</p>
    {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
  </div>
);

/** One class with its capacity and (on demand) who checked in. */
const ClassRow = ({ c }: { c: ClassSession }) => {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<CheckInRecord[] | null>(null);
  const toggle = () => { setOpen(!open); if (!people) attendeesOf(c.id).then(setPeople).catch(() => setPeople([])); };
  const count = people?.length ?? c.checkedInCount ?? 0;
  const pct = c.capacity ? Math.min(100, (count / c.capacity) * 100) : 0;
  return (
    <li className="rounded-2xl border border-white/[0.08] bg-ink-900">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        <span className="w-14 font-mono text-sm text-ink-300">{c.startTime}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl font-bold uppercase text-white">{c.title}</span>
          <span className="text-xs text-ink-500">{c.trainerName ?? 'Trainer'}{c.area ? ` · ${c.area}` : ''} · {c.duration} min</span>
          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10"><span className={cn('block h-full', pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-300' : 'bg-brand-400')} style={{ width: `${pct}%` }} /></span>
        </span>
        <span className="text-right"><span className="block font-display text-2xl font-bold tabular-nums text-white">{count}<span className="text-base text-ink-500">/{c.capacity}</span></span><span className="text-xs text-ink-500">checked in</span></span>
        <ChevronDown className={cn('h-4 w-4 text-ink-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-4 py-3">
          {!people ? <div className="h-10 animate-pulse rounded bg-ink-800" /> : people.length === 0 ? <p className="text-sm text-ink-400">No one has checked in yet.</p> : (
            <ol className="space-y-1 text-sm" aria-label={`${c.title} attendees`}>
              {people.map((p) => <li key={p.id} className="flex justify-between gap-3"><span className="text-white">{p.memberName}</span><span className="tabular-nums text-ink-500">{time(p)}</span></li>)}
            </ol>
          )}
        </div>
      )}
    </li>
  );
};

/** Check-ins — today at a glance, today's classes, and who came in. Real /checkin records only. */
const AttendancePage = () => {
  const [today, setToday] = useState<CheckInRecord[] | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [classes, setClasses] = useState<ClassSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();

  const load = () => {
    const p = periodStarts();
    Promise.all([checkInsSince(p.today), countSince(p.week), countSince(p.month), classesOn(todayIST())])
      .then(([t, w, m, c]) => { setToday(t); setWeek(w); setMonth(m); setClasses(c); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const unique = today ? new Set(today.map((r) => r.memberPhoneKey || phoneKey(r.memberPhone))).size : 0;
  const peak = today ? peakHour(today) : null;
  const className = (id: string) => classes?.find((c) => c.id === id)?.title ?? 'Class';

  return (
    <AdminShell title="Check-ins" nav="attendance" area="Operations">
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Couldn’t load check-ins: {error}</p>}
      <p className="-mt-4 mb-6 text-sm text-ink-400">Members check in to classes at <a href="/checkin" target="_blank" rel="noopener noreferrer" className="text-white underline-offset-4 hover:underline">/checkin</a> with the class PIN, or you check them in here. Event check-ins are on each event’s page.</p>
      {classes && <div className="mb-8"><StaffCheckIn classes={classes} initialMemberId={params.get('member')} autoFocus={params.has('checkin')} onDone={load} /></div>}

      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Today</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Check-ins" value={today?.length ?? '…'} />
        <Stat label="Unique people" value={today ? unique : '…'} />
        <Stat label="Classes" value={classes?.length ?? '…'} />
        <Stat label="Peak time" value={peak ? hourLabel(peak[0]) : '—'} sub={peak ? `${peak[1]} check-in${peak[1] === 1 ? '' : 's'} that hour` : 'No check-ins yet'} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="This week" value={week ?? '…'} sub="Since Monday" />
        <Stat label="This month" value={month ?? '…'} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="classes-h">
          <div className="mb-3 flex items-center justify-between"><h2 id="classes-h" className="text-xs font-bold uppercase tracking-wider text-ink-400">Today’s classes</h2><Link to="/admin/dashboard?tab=schedule" className="text-xs text-ink-400 hover:text-white">Manage classes →</Link></div>
          {!classes ? <div className="h-24 animate-pulse rounded-2xl bg-ink-900" /> : classes.length === 0 ? <Empty title="No classes today" body="Classes added in the class schedule show here with their check-ins." /> : (
            <ul className="space-y-3">{classes.map((c) => <ClassRow key={c.id} c={c} />)}</ul>
          )}
        </section>
        <section aria-labelledby="recent-h">
          <h2 id="recent-h" className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">Recent check-ins</h2>
          {!today ? <div className="h-24 animate-pulse rounded-2xl bg-ink-900" /> : today.length === 0 ? <Empty title="No check-ins yet today" body="They’ll appear here as members check in." /> : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-ink-500"><tr>{['Name', 'Time', 'Class'].map((h) => <th key={h} scope="col" className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {today.slice(0, 100).map((r) => (
                    <tr key={r.id}><td className="px-4 py-2 text-white">{r.memberName}</td><td className="px-4 py-2 tabular-nums text-ink-300">{time(r)}</td><td className="px-4 py-2 text-ink-300">{className(r.sessionId)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
};

export default AttendancePage;
