import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, ShieldBan, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayIST, type Member } from '@/lib/admin/members';
import {
  ACCESS_CONNECTED, BIOMETRIC_LABEL, HEALTH_LABEL, OVERRIDE_LABEL, accessEligibility, deviceHealth,
  type AccessDevice, type AccessOverride, type BiometricIdentity,
} from '@/lib/access';
import { DeviceUserTakenError, assignDeviceUser, listDevices, setAccessOverride, setIdentityStatus } from '@/lib/access/store';
import { ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate, fmtTime } from './lookups';

const Tone = ({ tone, children }: { tone: 'ok' | 'bad' | 'wait' | 'muted'; children: ReactNode }) => (
  <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-bold', { ok: 'bg-brand-400/15 text-brand-300', bad: 'bg-red-500/15 text-red-200', wait: 'bg-amber-400/15 text-amber-100', muted: 'bg-white/[0.06] text-ink-300' }[tone])}>{children}</span>
);
const toneOf = (s: BiometricIdentity['status']) => (s === 'SYNCED' || s === 'ENROLLED' ? 'ok' : s === 'SYNC_FAILED' ? 'bad' : s === 'PENDING' || s === 'SYNCING' ? 'wait' : 'muted');

/**
 * The member's door access: whether the membership allows entry, any staff block, and their
 * user on each biometric device. Only what's actually known is shown — "synced" appears only
 * when the integration service has confirmed it, which it can't until the device is connected.
 */
const MemberAccess = ({ m, identities, onChange, startEnrol }: { m: Member; identities: BiometricIdentity[] | null; onChange: () => void; startEnrol?: boolean }) => {
  const actor = useActor();
  const [devices, setDevices] = useState<AccessDevice[] | null>(null);
  const [enrolling, setEnrolling] = useState(!!startEnrol);
  const [deviceId, setDeviceId] = useState('');
  const [mode, setMode] = useState<'next' | 'existing'>('next');
  const [existingId, setExistingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  useEffect(() => { listDevices().then((d) => { setDevices(d); if (d.length === 1) setDeviceId(d[0].id); }).catch(() => setDevices([])); }, []);

  const access = accessEligibility(m, todayIST());
  const live = (identities ?? []).filter((i) => i.status !== 'REMOVED');
  const device = (id: string) => devices?.find((d) => d.id === id);

  const enrol = async () => {
    const d = device(deviceId);
    if (!d) return;
    setBusy(true); setMsg(null);
    try {
      const uid = await assignDeviceUser(m, d, actor, { method: 'fingerprint', existingId: mode === 'existing' ? existingId : undefined });
      setMsg({ ok: true, text: `Device user ${uid} on ${d.name} is reserved for ${m.name}. Now enrol their fingerprint on the device under user ID ${uid}, then press “Fingerprint saved on device”.` });
      setEnrolling(false); setExistingId(''); onChange();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof DeviceUserTakenError ? e.message : `Couldn’t reserve a device user ID: ${(e as Error).message}` });
    } finally { setBusy(false); }
  };
  const status = async (i: BiometricIdentity, s: 'PENDING' | 'ENROLLED' | 'DISABLED' | 'REMOVED') => { await setIdentityStatus(i, s, actor, m.name); onChange(); };
  const override = async (o: AccessOverride | null) => {
    if (o && blockReason.trim().length < 3) { setMsg({ ok: false, text: 'Say briefly why access is being stopped.' }); return; }
    await setAccessOverride(m, o, blockReason, actor); setBlockReason(''); setMsg(null); onChange();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="Access control" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Access control</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3"><dt className="text-ink-400">Access status</dt>
            <dd>{access.eligible ? <Tone tone="ok">ENABLED</Tone> : access.eligible === false ? <Tone tone="bad">NOT ALLOWED</Tone> : <Tone tone="muted">NO MEMBERSHIP</Tone>}</dd></div>
          <p className="text-xs text-ink-500">{access.reason}. Gym entry follows the gym membership only — a PT package on its own doesn’t open the door.</p>
          <div className="flex justify-between gap-3"><dt className="text-ink-400">Membership</dt><dd className="text-right text-white">{m.membershipEnd ? `${m.membershipEnd >= todayIST() ? 'Active until' : 'Ended'} ${fmtDate(m.membershipEnd)}` : 'None on record'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-ink-400">Device integration</dt><dd className="text-right text-white">{ACCESS_CONNECTED ? 'Connected' : 'Not configured yet'}</dd></div>
        </dl>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          {m.accessOverride ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-red-200"><ShieldBan className="h-4 w-4" aria-hidden /> {OVERRIDE_LABEL[m.accessOverride]}{m.accessOverrideReason ? ` — ${m.accessOverrideReason}` : ''}</p>
              <ConfirmButton size="sm" variant="outline" confirm={{ title: 'Restore access?', body: 'Entry will follow the membership again.' }} onConfirm={() => override(null)}><ShieldCheck /> Enable access</ConfirmButton>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Stop access" hint="Blocks entry even with an active membership" htmlFor="acc-reason"><input id="acc-reason" className={cn(inputCls, 'h-11')} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason, e.g. payment dispute" /></Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => override('suspended')}>Suspend membership</Button>
                <Button size="sm" variant="destructive" onClick={() => override('blocked')}><ShieldBan /> Disable access</Button>
              </div>
            </div>
          )}
        </div>
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={cn('mt-4 text-sm', msg.ok ? 'text-brand-300' : 'text-red-300')}>{msg.text}</p>}
      </section>

      <section aria-label="Biometric" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Biometric</h2>
          {!enrolling && <Button size="sm" onClick={() => { setEnrolling(true); setMsg(null); }}><Fingerprint /> Enroll biometric</Button>}
        </div>
        {identities === null ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : live.length === 0 && !enrolling ? (
          <p className="mt-4 text-sm text-ink-400">Not enrolled on any device.</p>
        ) : (
          <ul className="mt-4 space-y-4" aria-label="Device users">
            {live.map((i) => {
              const d = device(i.deviceId);
              return (
                <li key={i.id} className="rounded-xl border border-white/[0.08] p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-white">{d ? `${d.model} — ${d.name}` : 'Device'}</span><Tone tone={toneOf(i.status)}>{BIOMETRIC_LABEL[i.status]}</Tone></div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt className="text-ink-500">Device user ID</dt><dd className="font-mono text-white">{i.deviceUserId}</dd>
                    <dt className="text-ink-500">Enrolled</dt><dd className="text-ink-200">{i.enrolledAt ? fmtTime(i.enrolledAt as never) : '—'}</dd>
                    <dt className="text-ink-500">Last sync</dt><dd className="text-ink-200">{i.lastSyncedAt ? fmtTime(i.lastSyncedAt as never) : 'Never — integration not configured'}</dd>
                    {i.status === 'SYNC_FAILED' && <><dt className="text-ink-500">Last attempt</dt><dd className="text-red-200">{i.lastSyncAttemptAt ? fmtTime(i.lastSyncAttemptAt as never) : '—'}{i.lastSyncError ? ` · ${i.lastSyncError}` : ''}</dd></>}
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {i.status === 'PENDING' && <Button size="sm" onClick={() => status(i, 'ENROLLED')}>Fingerprint saved on device</Button>}
                    {(i.status === 'ENROLLED' || i.status === 'SYNCED' || i.status === 'SYNC_FAILED') && <Button size="sm" variant="outline" onClick={() => status(i, 'DISABLED')}>Disable on device</Button>}
                    {i.status === 'DISABLED' && <Button size="sm" variant="outline" onClick={() => status(i, 'ENROLLED')}>Enable on device</Button>}
                    <Button size="sm" variant="ghost" disabled title="Resync needs the device integration" aria-describedby={`resync-${i.id}`}>Resync</Button>
                    <ConfirmButton size="sm" variant="secondary" confirm={{ title: `Remove device user ${i.deviceUserId}?`, body: 'Also delete this user on the device itself. The ID can then be reused only for this member.' }} onConfirm={() => status(i, 'REMOVED')}>Remove</ConfirmButton>
                  </div>
                  <p id={`resync-${i.id}`} className="mt-2 text-[11px] text-ink-500">Changes here are recorded in the CRM. Until the device integration is set up, make the same change on the device.</p>
                </li>
              );
            })}
          </ul>
        )}

        {enrolling && (
          <div className="mt-4 rounded-xl border border-brand-400/25 p-4">
            <p className="text-sm font-semibold text-white">Enroll {m.name}</p>
            {devices && devices.length === 0 ? (
              <p className="mt-2 text-sm text-ink-400">No biometric device is set up yet. <Link to="/admin/settings/access" className="font-semibold text-brand-400 hover:underline">Add the device</Link> first (Settings → Access control).</p>
            ) : (
              <ol className="mt-3 space-y-4 text-sm">
                <li><Field label="1. Device" htmlFor="enr-device">
                  <select id="enr-device" className={cn(inputCls, 'h-11')} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                    <option value="">Choose…</option>
                    {(devices ?? []).filter((d) => d.enabled).map((d) => <option key={d.id} value={d.id}>{d.name} · {d.model} · {HEALTH_LABEL[deviceHealth(d)]}</option>)}
                  </select>
                </Field></li>
                <li>
                  <p className="text-sm font-semibold text-white">2. Device user ID</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Device user ID">
                    <button type="button" role="radio" aria-checked={mode === 'next'} onClick={() => setMode('next')} className={cn('rounded-xl border px-3 py-2 text-left text-xs', mode === 'next' ? 'border-brand-400 text-white' : 'border-white/15 text-ink-300')}>Give the next free number</button>
                    <button type="button" role="radio" aria-checked={mode === 'existing'} onClick={() => setMode('existing')} className={cn('rounded-xl border px-3 py-2 text-left text-xs', mode === 'existing' ? 'border-brand-400 text-white' : 'border-white/15 text-ink-300')}>Already on the device (old CRM ID)</button>
                  </div>
                  {mode === 'existing' && <label className="mt-2 block text-xs text-ink-400">User ID on the device<input className={cn(inputCls, 'mt-1 h-11')} value={existingId} onChange={(e) => setExistingId(e.target.value.trim())} inputMode="numeric" /></label>}
                </li>
                <li className="text-ink-400">3. After saving, the status is <strong className="text-amber-100">Waiting for the device</strong>. Enrol the fingerprint on the F22 under that user ID, then confirm it here.</li>
              </ol>
            )}
            <div className="mt-4 flex gap-2">
              <Button size="sm" disabled={busy || !deviceId || (mode === 'existing' && !existingId)} onClick={enrol}>{busy ? 'Reserving…' : 'Reserve device user ID'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEnrolling(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default MemberAccess;
