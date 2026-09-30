import { useMemo, useState } from 'react';
import { attendanceQuery } from './pageData';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import { todayIST } from '@/lib/admin/members';
import { toVisit, visitsQuery, type ManualCheckIn, type VisitSource } from '@/lib/admin/attendance';
import { AdminShell } from '@/features/events/admin/shared';
import StaffCheckIn from './StaffCheckIn';
import { usePaged } from './usePaged';
import { DataRegion, EmptyNote, ErrorNote, HeadRow, Pagination, Pill, SkeletonRows } from './kit';
import { useCached } from './useCached';
import { listDevices } from '@/lib/access/store';

const clock = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '');
const sourceOf = (v: ManualCheckIn) => {
  const s = new Set(v.sources ?? [v.method ?? 'manual']);
  return s.has('biometric') && s.has('manual') ? 'Fingerprint + front desk' : s.has('biometric') ? 'Fingerprint' : 'Front desk';
};

/**
 * Attendance — member visits for a day. One visit per member per day, whichever way they came
 * in (fingerprint or front desk). Raw punches stay in Access → Activity.
 */
const AttendancePage = () => {
  const [params, setParams] = useSearchParams();
  const today = todayIST();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') ?? '') && params.get('day')! <= today ? params.get('day')! : today;
  const [source, setSource] = useState<VisitSource>('all');
  const setDay = (d: string) => setParams((p) => { const n = new URLSearchParams(p); if (!d || d === today) n.delete('day'); else n.set('day', d); return n; }, { replace: true });

  const att = useQuery(attendanceQuery(day));
  const base = useMemo(() => visitsQuery(day, source), [day, source]);
  const p = usePaged(`visits:${day}:${source}`, base, toVisit, 50);
  const earlier = att.data?.earlier ?? [];
  const error = (att.error ? (att.error as Error).message : null) ?? att.data?.failed ?? null;
  const load = () => { void att.refetch(); p.refetch(); };
  const isToday = day === today;
  const devices = useCached(['accessDevices'], () => listDevices().then((d) => new Map(d.map((x) => [x.id, x.name])))).data;

  return (
    <AdminShell title="Attendance" nav="attendance" area="Operations" fill
      subtitle={<><span className="font-semibold tabular-nums text-white">{att.data ? att.data.day : '…'}</span> visit{att.data?.day === 1 ? '' : 's'} {isToday ? 'today' : `on ${new Date(`${day}T12:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`} · {att.data?.week ?? '…'} this week · {att.data?.month ?? '…'} this month</>}>
      {error && <div className="mb-3 flex-shrink-0"><ErrorNote what="Couldn’t load attendance." error={error} onRetry={load} /></div>}

      <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="recent-h" className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1">
          <div className="mb-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-ink-400"><span id="recent-h" className="font-sans text-xs font-bold uppercase tracking-[0.16em]">Visits on</span>
              <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="h-9 rounded-lg border border-white/15 bg-field px-2 text-sm text-white focus:border-brand-400 focus:outline-none" />
            </label>
            <Link to="/admin/access?tab=integrity" className="order-last inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400 hover:text-white sm:order-none sm:ml-auto sm:mr-2">
              <Fingerprint className="h-4 w-4 text-brand-fg" aria-hidden /> Check punches against attendance
            </Link>
            <div className="flex w-full gap-1 rounded-xl border border-white/[0.08] bg-ink-900 p-1 sm:w-auto" role="group" aria-label="Show">
              {([['all', 'All'], ['biometric', 'Fingerprint'], ['manual', 'Front desk']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={source === k} onClick={() => setSource(k)} className={cn('flex-1 rounded-lg px-3 py-1 text-sm font-semibold transition-colors sm:flex-none', source === k ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>{l}</button>
              ))}
            </div>
          </div>
          {p.error ? <ErrorNote what={/index/i.test(p.error) ? 'This filter needs a database index that isn’t published yet (see FIREBASE_INDEX_AUDIT.md).' : 'Couldn’t load visits.'} error={p.error} onRetry={p.refetch} />
            : !p.rows ? <SkeletonRows rows={5} />
            : p.rows.length === 0 && !(source !== 'biometric' && earlier.length) ? <EmptyNote title={isToday ? 'No visits yet today' : 'No visits that day'} body={isToday ? 'Members appear here when they punch in or are checked in at the desk.' : 'Nothing was recorded for this day.'} />
            : (
              <DataRegion>
                <HeadRow className="md:grid-cols-[4.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)] xl:grid-cols-[4.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)_minmax(0,1fr)]"><span>Arrived</span><span>Member</span><span>Source</span><span>Scans</span><span className="hidden xl:block">Device</span></HeadRow>
                <ul className="divide-y divide-white/[0.06]" aria-label="Visits">
                  {p.rows.map((v) => (
                    <li key={v.id}>
                      <Link to={`/admin/members/${v.memberId}?tab=attendance`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.03] md:grid-cols-[4.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)] xl:grid-cols-[4.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)_minmax(0,1fr)]">
                        <span className="font-mono tabular-nums text-ink-400">{clock(v.at?.toMillis())}</span>
                        <span className="min-w-0"><span className="block truncate font-semibold text-white">{v.memberName || 'Member'}</span>
                          <span className="block truncate text-xs text-ink-400 md:hidden">{v.punchCount && v.punchCount > 1 ? `Scanned ${v.punchCount} times · again at ${clock(v.lastAt?.toMillis())}` : v.punchCount ? '1 punch' : 'Checked in at the desk'}</span></span>
                        <span><Pill tone={sourceOf(v) === 'Front desk' ? 'info' : 'ok'}>{sourceOf(v) === 'Front desk' ? 'Desk' : sourceOf(v) === 'Fingerprint' ? 'Fingerprint' : 'Both'}</Pill></span>
                        <span className="hidden text-ink-300 md:block">{v.punchCount ? `${v.punchCount}${v.punchCount > 1 ? ` · again at ${clock(v.lastAt?.toMillis())}` : ''}` : '—'}</span>
                        <span className="hidden truncate text-ink-300 xl:block">{v.deviceId ? devices?.get(v.deviceId) ?? 'Device' : 'Front desk'}</span>
                      </Link>
                    </li>
                  ))}
                  {source !== 'biometric' && !p.hasPrev && earlier.map((r) => (
                    <li key={`c-${r.id}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-sm md:grid-cols-[4.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)] xl:grid-cols-[4.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)_minmax(0,1fr)]">
                      <span className="font-mono tabular-nums text-ink-400">{clock(r.checkedInAt?.toMillis())}</span>
                      <span className="min-w-0"><span className="block truncate font-semibold text-white">{r.memberName}</span><span className="block truncate text-xs text-ink-400">Self check-in (older PIN page)</span></span>
                      <span><Pill tone="muted">PIN</Pill></span>
                      <span className="hidden text-ink-300 md:block">—</span>
                      <span className="hidden text-ink-300 xl:block">PIN page</span>
                    </li>
                  ))}
                </ul>
              </DataRegion>
            )}
          <Pagination p={p} label="Visits" count={p.rows?.length} />
          <p className="mt-2 flex-shrink-0 text-xs text-ink-500">The device is at the entrance, so a scan means arriving; more scans the same day (coming back in, or a second try) stay one visit. Every punch, including ones not linked to anyone yet, is in <Link to="/admin/access?tab=activity" className="font-semibold text-ink-300 hover:text-white">Access → Activity</Link>.</p>
        </section>

        <aside className="order-first flex-shrink-0 space-y-3 xl:order-none" aria-label="Attendance details">
          {isToday && <StaffCheckIn initialMemberId={params.get('member')} autoFocus={params.has('checkin')} onDone={load} />}
        </aside>
      </div>
    </AdminShell>
  );
};

export default AttendancePage;
