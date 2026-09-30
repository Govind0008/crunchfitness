import { useCached } from '@/features/admin/useCached';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { memberCounts, membersByIds, todayIST, type Member } from '@/lib/admin/members';
import { getSettings } from '@/lib/admin/settings';
import { ACCESS_CONNECTED, BIOMETRIC_LABEL, HEALTH_LABEL, RESULT_LABEL, deviceHealth, type AccessEvent, type BiometricIdentity } from '@/lib/access';
import { accessEventsSince, accessSummary, identitiesByStatus, todayStartIso, type AccessSummary } from '@/lib/access/store';
import { AdminShell, Empty } from '@/features/events/admin/shared';
import AccessActivity from './AccessActivity';
import AttendanceCheck from './AttendanceCheck';

const TABS = [['overview', 'Overview'], ['activity', 'Activity'], ['integrity', 'Attendance check']] as const;
type Tab = (typeof TABS)[number][0];

const Stat = ({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'warn' | 'bad' }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</p>
    <p className={cn('mt-2 font-display text-4xl font-bold leading-none tabular-nums', tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-200' : 'text-white')}>{value}</p>
    {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
  </div>
);

/** Operations → Access control: devices, enrolments and today's door scans — real records only. */
const AccessPage = () => {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? (params.get('member') || params.get('day') ? 'activity' : 'overview')) as Tab;
  const go = (t: Tab) => setParams(() => (t === 'overview' ? new URLSearchParams() : new URLSearchParams({ tab: t })), { replace: true });
  const today = todayIST();
  const start = todayStartIso(today);
  const sumQ = useCached(['accessSummary', start], () => accessSummary(start));
  const sum: AccessSummary | null = sumQ.data, error = sumQ.error;
  const active = useCached(['activeCount'], () => getSettings().then((s) => memberCounts(s.expiringSoonDays)).then((c) => c.active).catch(() => null)).data;
  const scans = useCached(['accessEvents', start], () => accessEventsSince(start, 8).catch((): AccessEvent[] => [])).data;
  const waiting = useCached(['accessWaiting'], () => identitiesByStatus(['PENDING', 'SYNC_FAILED'], 50).then(async (list) => {
    const ms = await membersByIds(list.map((i) => i.memberId));
    return list.map((i): { i: BiometricIdentity; m?: Member } => ({ i, m: ms.find((x) => x.id === i.memberId) }));
  }).catch(() => [])).data;

  const online = sum?.devices.filter((d) => deviceHealth(d) === 'online').length ?? 0;
  const issues = sum ? sum.failed + sum.devices.filter((d) => deviceHealth(d) === 'offline').length : 0;

  return (
    <AdminShell title="Access control" nav="access" area="Operations" fill={tab === 'activity'}
      actions={<Button asChild variant="outline"><Link to="/admin/settings/access"><Settings /> Devices</Link></Button>}>
      {!ACCESS_CONNECTED && (
        <div role="status" className="-mt-2 mb-6 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
          <p className="font-semibold">Device integration not configured</p>
          <p className="mt-1 text-amber-100/80">The F22 still runs through the old system. You can already add devices and link members to their device user IDs; scans and sync status start appearing once the pilot connects the device.</p>
        </div>
      )}
      <div role="tablist" aria-label="Access control" className="-mt-1 mb-4 flex flex-shrink-0 gap-1 overflow-x-auto border-b border-white/[0.08]">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => go(t)}
            className={cn('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors', tab === t ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}>{label}</button>
        ))}
      </div>
      {tab === 'activity' && <AccessActivity />}
      {tab === 'integrity' && <AttendanceCheck />}
      {tab === 'overview' && <>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Couldn’t load access control: {error}</p>}

      <section aria-label="Access at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Devices" value={sum ? `${online} / ${sum.devices.length}` : '…'} sub={sum ? (sum.devices.length ? 'online' : 'None set up yet') : ''} />
        <Stat label="Scans today" value={sum?.scansToday ?? '…'} sub={sum ? `${sum.grantedToday} verified · ${sum.scansToday - sum.grantedToday} not let in` : ''} />
        <Stat label="Enrolled members" value={sum?.enrolled ?? '…'} sub={active != null ? `of ${active} active members` : ''} />
        <Stat label="Issues" value={sum ? issues + sum.pending : '…'} sub={sum ? `${sum.pending} waiting for device · ${sum.failed} sync failed · ${sum.blocked} blocked` : ''} tone={sum && (issues || sum.pending) ? 'warn' : undefined} />
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="dev-h" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <div className="flex items-center justify-between"><h2 id="dev-h" className="text-sm font-bold uppercase tracking-wider text-white">Devices</h2><Link to="/admin/settings/access" className="text-xs text-ink-400 hover:text-white">Manage →</Link></div>
          {!sum ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : sum.devices.length === 0 ? (
            <p className="mt-4 text-sm text-ink-400">No devices yet. <Link to="/admin/settings/access" className="font-semibold text-brand-fg hover:underline">Add the F22</Link>.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
              {sum.devices.map((d) => <li key={d.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate font-semibold text-white">{d.name}</span><span className="text-xs text-ink-500">{d.model}{d.serialNumber ? ` · ${d.serialNumber}` : ''}</span></span><span className="text-xs font-semibold text-ink-300">{HEALTH_LABEL[deviceHealth(d)]}</span></li>)}
            </ul>
          )}
        </section>

        <section aria-labelledby="wait-h" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h2 id="wait-h" className="text-sm font-bold uppercase tracking-wider text-white">Needs attention</h2>
          {!waiting ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : waiting.length === 0 ? <p className="mt-4 text-sm text-ink-400">No enrolments waiting and no failed syncs.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm" aria-label="Enrolments needing attention">
              {waiting.map(({ i, m }) => (
                <li key={i.id}><Link to={`/admin/members/${i.memberId}?tab=access`} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0"><span className="block truncate font-semibold text-white">{m?.name ?? 'Member'}</span><span className="text-xs text-ink-500">Device user {i.deviceUserId} · {BIOMETRIC_LABEL[i.status]}</span></span>
                  <ArrowRight className="h-4 w-4 text-ink-500" aria-hidden />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="scan-h" className="mt-6 rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
        <div className="flex items-center justify-between"><h2 id="scan-h" className="text-sm font-bold uppercase tracking-wider text-white">Latest punches today</h2><button type="button" onClick={() => go('activity')} className="text-xs text-ink-400 hover:text-white">All activity →</button></div>
        {!scans ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : scans.length === 0 ? (
          <div className="mt-4"><Empty title="No scans today" body={ACCESS_CONNECTED ? 'Scans appear here as members use the door.' : 'Scans will appear here once the device integration is set up.'} /></div>
        ) : (
          <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
            {scans.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-white">{e.memberId ? <Link to={`/admin/members/${e.memberId}?tab=attendance`} className="hover:text-brand-fg">Member · device user {e.deviceUserId}</Link> : e.trainerId ? <Link to={`/admin/trainers/${e.trainerId}?tab=attendance`} className="hover:text-brand-fg">Trainer · device user {e.deviceUserId}</Link> : `Unresolved · device user ${e.deviceUserId}`}</span>
                <span className={cn('text-xs font-semibold', e.trainerId ? 'text-ink-300' : e.result === 'granted' ? 'text-brand-fg' : e.result === 'unknown_user' ? 'text-amber-100' : 'text-red-200')}>{e.trainerId ? 'Staff' : RESULT_LABEL[e.result]}</span>
                <span className="text-xs tabular-nums text-ink-500">{new Date(e.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>}
    </AdminShell>
  );
};

export default AccessPage;
