import { useEffect, useState } from 'react';
import { attendanceQuery } from './pageData';
import { useQuery } from '@tanstack/react-query';
import { useCached } from './useCached';
import { Link, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { todayIST } from '@/lib/admin/members';
import { peakHourOf } from '@/lib/admin/attendance';
import { AdminShell } from '@/features/events/admin/shared';
import StaffCheckIn from './StaffCheckIn';
import { ACCESS_CONNECTED, RESULT_LABEL, type AccessEvent } from '@/lib/access';
import { accessEventsSince, listDevices, todayStartIso } from '@/lib/access/store';
import { membersByIds } from '@/lib/admin/members';
import { EmptyNote, ErrorNote, SkeletonRows } from './kit';

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

const Stat = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>
    <p className="mt-2 font-display text-4xl font-bold leading-none tabular-nums text-white">{value}</p>
    {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
  </div>
);

/** Attendance — who came in today: front-desk check-ins and door scans, in one timeline. */
const AttendancePage = () => {
  const [params] = useSearchParams();
  const [filter, setFilter] = useState<'all' | 'biometric' | 'manual'>('all');
  const day = todayIST();
  const scansQ = useCached(['attendanceScans', day], () => accessEventsSince(todayStartIso(day), 100).catch((): AccessEvent[] => []));
  const scans = scansQ.data;
  const att = useQuery(attendanceQuery(day));
  const today = att.data?.today ?? null, earlier = att.data?.earlier ?? [], week = att.data?.week ?? null, month = att.data?.month ?? null;
  const error = (att.error ? (att.error as Error).message : null) ?? att.data?.failed ?? null;
  const load = () => { att.refetch(); scansQ.refetch(); };
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [deviceNames, setDeviceNames] = useState<Map<string, string>>(new Map());

  // Names for door scans (members) and devices, in one batch each
  useEffect(() => {
    if (!scans?.length) return;
    membersByIds([...new Set(scans.map((e) => e.memberId).filter((x): x is string => !!x))]).then((ms) => setNames(new Map(ms.map((m) => [m.id, m.name])))).catch(() => {});
    listDevices().then((d) => setDeviceNames(new Map(d.map((x) => [x.id, x.name])))).catch(() => {});
  }, [scans]);

  // One timeline: front-desk check-ins, older PIN self check-ins, and door scans from the device
  const entries = [
    ...(today ?? []).map((r) => ({ id: `m-${r.id}`, at: r.at ? r.at.toMillis() : 0, name: r.memberName, how: 'Manual · front desk', kind: 'manual' as const, ok: true, to: `/admin/members/${r.memberId}` as string | null })),
    ...earlier.map((r) => ({ id: `c-${r.id}`, at: r.checkedInAt?.toDate().getTime() ?? 0, name: r.memberName, how: 'Manual · self check-in', kind: 'manual' as const, ok: true, to: null as string | null })),
    ...(scans ?? []).map((e) => ({ id: `s-${e.id}`, at: new Date(e.at).getTime(), name: (e.memberId && names.get(e.memberId)) || `Device user ${e.deviceUserId}`, how: `${e.verify === 'unknown' ? 'Biometric' : e.verify[0].toUpperCase() + e.verify.slice(1)} · ${deviceNames.get(e.deviceId) ?? 'Device'}${e.result === 'granted' ? '' : ` · ${RESULT_LABEL[e.result]}`}`, kind: 'biometric' as const, ok: e.result === 'granted', to: e.memberId ? `/admin/members/${e.memberId}` : null })),
  ].filter((x) => filter === 'all' || x.kind === filter).sort((a, b) => b.at - a.at);
  const peak = today && scans ? peakHourOf([...(today ?? []).map((r) => r.at?.toMillis() ?? 0), ...earlier.map((r) => r.checkedInAt?.toMillis() ?? 0), ...(scans ?? []).filter((e) => e.result === 'granted').map((e) => new Date(e.at).getTime())]) : null;
  const total = (today?.length ?? 0) + earlier.length + (scans?.filter((e) => e.result === 'granted').length ?? 0);
  const loading = !today || !scans;

  return (
    <AdminShell title="Attendance" nav="attendance" area="Operations" bare>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">Today’s attendance</p>
        <h1 className="mt-1 font-display text-5xl font-bold uppercase leading-none">Attendance</h1>
        <p className="mt-2 text-lg text-ink-200"><span className="font-display text-3xl font-bold tabular-nums text-white">{loading ? '…' : total}</span> check-ins today{peak ? <span className="text-sm text-ink-400"> · busiest around {hourLabel(peak[0])}</span> : null}</p>
      </header>
      {error && <div className="mb-6"><ErrorNote what="Couldn’t load today’s attendance." error={error} onRetry={load} /></div>}
      <div className="mb-8"><StaffCheckIn initialMemberId={params.get('member')} autoFocus={params.has('checkin')} onDone={load} /></div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="recent-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="recent-h" className="font-sans text-xs font-bold uppercase tracking-[0.16em] text-ink-400">Today</h2>
            <div className="flex w-full gap-1 rounded-xl border border-white/[0.08] bg-ink-900 p-1 sm:w-auto" role="group" aria-label="Show">
              {([['all', 'All'], ['biometric', 'Biometric'], ['manual', 'Manual']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors sm:flex-none', filter === k ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>{l}</button>
              ))}
            </div>
          </div>
          {loading ? <SkeletonRows rows={5} /> : entries.length === 0 ? (
            <EmptyNote title={filter === 'biometric' ? 'No door scans' : 'No check-ins yet today'}
              body={filter === 'biometric' && !ACCESS_CONNECTED ? 'The fingerprint device isn’t connected to this system yet — its scans still go to the old system.' : 'They’ll appear here as members arrive.'} />
          ) : (
            <ol className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900" aria-label="Today’s check-ins">
              {entries.slice(0, 150).map((e) => {
                const row = (
                  <>
                    <span className="w-12 flex-shrink-0 font-mono text-sm tabular-nums text-ink-400">{e.at ? new Date(e.at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{e.name}</span><span className={cn('block truncate text-xs', e.ok ? 'text-ink-400' : 'text-red-200')}>{e.how}</span></span>
                    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', e.kind === 'biometric' ? (e.ok ? 'bg-brand-400' : 'bg-red-400') : 'bg-sky-300')} aria-hidden />
                  </>
                );
                return <li key={e.id}>{e.to ? <Link to={e.to} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.03]">{row}</Link> : <div className="flex items-center gap-4 px-4 py-3">{row}</div>}</li>;
              })}
            </ol>
          )}
          <p className="mt-3 text-xs text-ink-500">Manual = checked in at the front desk (or self check-in on the older PIN page). Biometric = the fingerprint device.</p>
        </section>

        <aside className="space-y-6" aria-label="Attendance details">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="This week" value={week ?? '…'} sub="Manual check-ins since Monday" />
            <Stat label="This month" value={month ?? '…'} sub="Manual check-ins" />
          </div>
        </aside>
      </div>
    </AdminShell>
  );
};

export default AttendancePage;
