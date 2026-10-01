import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { membersByIds } from '@/lib/admin/members';
import { listTeam } from '@/lib/admin/trainerAttendance';
import { RESULT_LABEL, type AccessEvent } from '@/lib/access';
import { accessEventsQuery, listDevices, toAccessEvent, type ActivityWho } from '@/lib/access/store';
import { useCached } from '../useCached';
import { usePaged } from '../usePaged';
import { DataRegion, EmptyNote, ErrorNote, HeadRow, Pagination, Pill, SkeletonRows, type Tone } from '../kit';

const WHO: { id: ActivityWho; label: string }[] = [
  { id: 'all', label: 'Everyone' }, { id: 'member', label: 'Members' }, { id: 'trainer', label: 'Trainers' }, { id: 'unknown', label: 'Unresolved' },
];
const RESULT_TONE: Record<AccessEvent['result'], Tone> = { granted: 'ok', denied: 'bad', legacy: 'muted', unknown_user: 'warn', access_disabled: 'bad', device_error: 'bad' };
const time = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Every punch the devices reported, newest first, one page at a time. Each row says who it
 * resolved to (member, trainer or nobody yet) and which attendance record it went into.
 */
const AccessActivity = () => {
  const [params, setParams] = useSearchParams();
  const who = (WHO.find((w) => w.id === params.get('who'))?.id ?? 'all') as ActivityWho;
  const memberId = params.get('member') ?? undefined;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') ?? '') ? params.get('day')! : undefined;
  const set = (k: string, v: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });

  const key = `access:${who}:${memberId ?? ''}:${day ?? ''}`;
  const base = useMemo(() => accessEventsQuery({ who, memberId, day }), [who, memberId, day]);
  const p = usePaged(key, base, toAccessEvent, 50);

  const memberIds = [...new Set((p.rows ?? []).map((e) => e.memberId).filter((x): x is string => !!x))];
  const names = useCached(['accessNames', memberIds.join(',')], () => membersByIds(memberIds).then((ms) => new Map(ms.map((m) => [m.id, m.name]))), memberIds.length > 0).data;
  const team = useCached(['team'], () => listTeam().then((t) => new Map(t.map((x) => [x.id, x.name])))).data;
  const devices = useCached(['accessDevices'], () => listDevices().then((d) => new Map(d.map((x) => [x.id, x.name])))).data;

  const person = (e: AccessEvent) => {
    const type = e.personType ?? (e.memberId ? 'member' : 'unknown');
    if (type === 'member' && e.memberId) return <Link to={`/admin/members/${e.memberId}?tab=attendance`} className="font-semibold text-white hover:underline">{names?.get(e.memberId) ?? 'Member'}</Link>;
    if (type === 'trainer' && e.trainerId) return <Link to={`/admin/trainers/${e.trainerId}?tab=attendance`} className="font-semibold text-white hover:underline">{team?.get(e.trainerId) ?? 'Trainer'}</Link>;
    return <span className="font-semibold text-amber-100">{e.deviceUserName ? `“${e.deviceUserName}” on the device` : 'Not linked'}</span>;
  };

  return (
    <section aria-labelledby="act-h" className="flex flex-col lg:min-h-0 lg:flex-1">
      <h2 id="act-h" className="sr-only">Access activity</h2>
      <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-ink-900 p-1" role="group" aria-label="Whose punches">
          {WHO.map((w) => (
            <button key={w.id} type="button" aria-pressed={who === w.id && !memberId} onClick={() => { set('member', null); set('who', w.id === 'all' ? null : w.id); }}
              className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', who === w.id && !memberId ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>{w.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-400">Day
          <input type="date" value={day ?? ''} onChange={(e) => set('day', e.target.value || null)}
            className="h-10 rounded-lg border border-white/15 bg-field px-2 text-white [color-scheme:inherit] focus:border-brand-400 focus:outline-none" />
        </label>
        {memberId && <button type="button" onClick={() => set('member', null)} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-ink-200 hover:text-white">One member <X className="h-3 w-3" aria-hidden /><span className="sr-only">Show everyone</span></button>}
      </div>

      {p.error ? <ErrorNote what={/index/i.test(p.error) ? 'This filter needs a database index that isn’t published yet (see FIREBASE_INDEX_AUDIT.md).' : 'Couldn’t load access activity.'} error={p.error} onRetry={p.refetch} />
        : !p.rows ? <SkeletonRows rows={6} />
        : p.rows.length === 0 ? <EmptyNote title="No punches" body={who === 'unknown' ? 'Every punch in this view is linked to a member or trainer.' : 'Nothing matches this view.'} />
        : (
          <DataRegion>
            <HeadRow className="md:grid-cols-[8.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)_minmax(0,1fr)_7.5rem]"><span>Time</span><span>Person</span><span>Type</span><span>Device</span><span>Attendance</span><span className="justify-self-end">Result</span></HeadRow>
            <ul className="divide-y divide-white/[0.06]" aria-label="Access activity">
            {p.rows.map((e) => {
              const type = e.personType ?? (e.memberId ? 'member' : 'unknown');
              return (
                <li key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm md:grid-cols-[8.5rem_minmax(0,1.6fr)_7.5rem_minmax(0,1fr)_minmax(0,1fr)_7.5rem]">
                  <span className="order-3 col-span-2 text-xs tabular-nums text-ink-400 md:order-none md:col-span-1 md:text-sm">{time(e.at)}</span>
                  <span className="min-w-0 truncate">{person(e)} <span className="text-ink-500 md:hidden">· {type === 'unknown' ? 'unresolved' : type} · user {e.deviceUserId}</span></span>
                  <span className="hidden truncate text-ink-300 md:block">{type === 'unknown' ? 'Unresolved' : type === 'trainer' ? 'Trainer' : 'Member'} <span className="text-xs text-ink-500">#{e.deviceUserId}</span></span>
                  <span className="hidden truncate text-ink-300 md:block">{devices?.get(e.deviceId) ?? 'Device'}</span>
                  <span className="order-4 col-span-2 text-xs text-ink-500 md:order-none md:col-span-1">{e.attendanceRef ? 'In attendance' : type === 'unknown' ? <Link to="/admin/settings/access" className="font-semibold text-brand-fg hover:underline">Link this user</Link> : 'No attendance record'}</span>
                  <span className="md:justify-self-end"><Pill tone={RESULT_TONE[e.result] ?? 'muted'}>{type === 'trainer' ? 'Staff' : RESULT_LABEL[e.result] ?? e.result}</Pill></span>
                </li>
              );
            })}
            </ul>
          </DataRegion>
        )}
      <Pagination p={p} label="Access activity" count={p.rows?.length} />
      <p className="mt-2 flex-shrink-0 text-xs text-ink-500">Every punch is kept as it was reported. A member’s punches for a day make one visit; a trainer’s first and last punch make check-in and check-out.</p>
    </section>
  );
};

export default AccessActivity;
