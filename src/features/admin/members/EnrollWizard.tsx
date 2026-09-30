import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { memberCode, type Member } from '@/lib/admin/members';
import { ACCESS_CONNECTED, deviceHealth, type AccessDevice, type BiometricIdentity } from '@/lib/access';
import { DeviceUserTakenError, assignDeviceUser, listDevices, queueDeviceCommand, setIdentityStatus, watchDeviceCommand, watchIdentity, type DeviceCommand } from '@/lib/access/store';
import { inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import Avatar from './Avatar';

type Step = 1 | 2 | 3;

/**
 * Enrol a member on the fingerprint device in three steps. The fingerprint is captured on the
 * device itself — this only reserves the member's user ID and records what staff confirm.
 * "Synced" is shown only when the device integration reports it; until then it says so.
 */
const EnrollWizard = ({ m, existing, onDone }: { m: Member; existing: BiometricIdentity[]; onDone: () => void }) => {
  const actor = useActor();
  const [step, setStep] = useState<Step>(1);
  const [devices, setDevices] = useState<AccessDevice[] | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [useExisting, setUseExisting] = useState(false);
  const [existingId, setExistingId] = useState('');
  const [identity, setIdentity] = useState<{ deviceUserId: string; status: BiometricIdentity['status']; id: string } | null>(null);
  // "Add to device": when the device is online through the relay, the CRM creates the user on it
  // and starts fingerprint enrolment — nothing to type on the device
  const [remote, setRemote] = useState<{ add: DeviceCommand | null; enroll: DeviceCommand | null } | null>(null);
  const [commandIds, setCommandIds] = useState<{ add: string; enroll: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listDevices().then((d) => { const on = d.filter((x) => x.enabled); setDevices(on); if (on.length === 1) setDeviceId(on[0].id); }).catch(() => setDevices([])); }, []);
  const device = devices?.find((d) => d.id === deviceId);
  const online = !!device && deviceHealth(device) === 'online';
  // Live: the command status, and the identity turning SYNCED when the device reports the fingerprint
  useEffect(() => {
    if (!device || !commandIds) return;
    const a = watchDeviceCommand(device.id, commandIds.add, (c) => setRemote((r) => ({ add: c, enroll: r?.enroll ?? null })));
    const b = watchDeviceCommand(device.id, commandIds.enroll, (c) => setRemote((r) => ({ add: r?.add ?? null, enroll: c })));
    return () => { a(); b(); };
  }, [device, commandIds]);
  useEffect(() => {
    if (!identity) return;
    return watchIdentity(identity.id, (i) => { if (i) setIdentity((x) => (x ? { ...x, status: i.status } : x)); });
  }, [identity?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const already = existing.find((i) => i.deviceId === deviceId && i.status !== 'REMOVED');

  const reserve = async () => {
    if (!device) return;
    setBusy(true); setError(null);
    try {
      const uid = await assignDeviceUser(m, device, actor, { method: 'fingerprint', existingId: useExisting ? existingId : undefined });
      setIdentity({ deviceUserId: uid, status: 'PENDING', id: `${device.id}_${uid}` });
      if (online && !useExisting) {
        const add = await queueDeviceCommand(device.id, { type: 'add_user', deviceUserId: uid, name: m.name }, actor);
        const enroll = await queueDeviceCommand(device.id, { type: 'enroll_fp', deviceUserId: uid }, actor);
        setCommandIds({ add, enroll });
      }
      setStep(3); onDone();
    } catch (e) {
      setError(e instanceof DeviceUserTakenError ? e.message : 'The device user ID couldn’t be reserved. Please try again.');
    } finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!identity) return;
    setBusy(true);
    try { await setIdentityStatus({ id: identity.id, memberId: m.id, deviceUserId: identity.deviceUserId } as BiometricIdentity, 'ENROLLED', actor, m.name); setIdentity({ ...identity, status: 'ENROLLED' }); onDone(); }
    catch { setError('Couldn’t save. Please try again.'); }
    finally { setBusy(false); }
  };

  const StepDot = ({ n, label }: { n: Step; label: string }) => (
    <li className="flex items-center gap-2">
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', step > n ? 'bg-brand-400 text-on-brand' : step === n ? 'bg-white text-on-brand' : 'bg-white/[0.08] text-ink-500')}>{step > n ? <Check size={14} aria-hidden /> : n}</span>
      <span className={cn('text-xs font-semibold', step === n ? 'text-white' : 'text-ink-500')}>{label}</span>
    </li>
  );

  return (
    <div>
      <ol className="mb-6 flex flex-wrap gap-4" aria-label="Enrolment steps">
        <StepDot n={1} label="Confirm member" /><StepDot n={2} label="Choose device" /><StepDot n={3} label="Enrol on device" />
      </ol>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 text-sm text-red-200">{error}</p>}

      {step === 1 && (
        <section aria-label="Confirm member">
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-ink-900 p-4">
            <Avatar m={m} size={56} />
            <div><p className="font-display text-2xl font-bold uppercase leading-none text-white">{m.name}</p><p className="mt-1 font-mono text-xs text-ink-400">{memberCode(m.id)}</p></div>
          </div>
          <Button size="lg" className="mt-5" onClick={() => setStep(2)}>Continue</Button>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Choose device">
          {devices === null ? <div className="h-20 animate-pulse rounded-xl bg-ink-900" /> : devices.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] p-4 text-sm text-ink-300">No fingerprint device is set up yet. An admin can add it in <Link to="/admin/settings/access" className="font-semibold text-brand-fg hover:underline">Settings → Access control</Link>.</p>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="Device">
              {devices.map((d) => (
                <button key={d.id} type="button" role="radio" aria-checked={deviceId === d.id} onClick={() => setDeviceId(d.id)}
                  className={cn('flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors', deviceId === d.id ? 'border-brand-400 bg-brand-400/[0.06]' : 'border-white/[0.1] hover:border-white/25')}>
                  <Fingerprint className={deviceId === d.id ? 'text-brand-fg' : 'text-ink-500'} size={22} aria-hidden />
                  <span><span className="block font-semibold text-white">{d.name}</span><span className="text-xs text-ink-400">{d.model}{d.location ? ` · ${d.location}` : ''}</span></span>
                </button>
              ))}
            </div>
          )}
          {already && <p className="mt-3 text-sm text-amber-100">{m.name} already has user ID {already.deviceUserId} on this device.</p>}
          {devices && devices.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/[0.08] p-4 text-sm">
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b0d43f]" checked={useExisting} onChange={(e) => setUseExisting(e.target.checked)} />
                <span><span className="block font-semibold text-white">Already on the device</span><span className="text-xs text-ink-400">Enrolled through the old system — use their existing user ID</span></span></label>
              {useExisting && <label className="mt-3 block text-xs text-ink-400">User ID on the device<input className={cn(inputCls, 'mt-1 h-11')} value={existingId} onChange={(e) => setExistingId(e.target.value.trim())} inputMode="numeric" /></label>}
            </div>
          )}
          <div className="mt-5 flex gap-2">
            <Button size="lg" disabled={!device || busy || !!already || (useExisting && !existingId)} onClick={reserve}>{busy ? 'Reserving…' : 'Continue'}</Button>
            <Button size="lg" variant="ghost" onClick={() => setStep(1)}>Back</Button>
          </div>
        </section>
      )}

      {step === 3 && identity && device && (() => {
        const saved = identity.status === 'SYNCED' || identity.status === 'ENROLLED';
        const failed = remote?.add?.status === 'failed' || remote?.enroll?.status === 'failed';
        const first = m.name.split(' ')[0];
        const auto = !!commandIds && !failed;
        const headline = saved ? 'Fingerprint saved' : failed ? 'The device didn’t accept it'
          : auto ? (remote?.enroll?.status === 'sent' || remote?.enroll?.status === 'done' ? `${first}: place a finger on the device` : 'Sending to the device…')
          : 'Waiting for device';
        const detail = saved ? `Saved on ${device.name} as user ${identity.deviceUserId}.`
          : failed ? `Enrol user ID ${identity.deviceUserId} on the device instead (Menu → User Mgt → New User), then confirm below.`
          : auto ? (remote?.enroll?.status === 'sent' || remote?.enroll?.status === 'done' ? `The device is waiting: ${first} places the same finger 3 times. This screen updates by itself.` : `Creating user ${identity.deviceUserId} on ${device.name} — a few seconds.`)
          : useExisting ? `Linked to user ${identity.deviceUserId}, already on the device. It’s confirmed the next time ${first} scans.`
          : `On ${device.name}, enrol user ID ${identity.deviceUserId} and ask ${first} to place their finger on the device.`;
        return (
          <section aria-label="Enrol on device">
            <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 text-center">
              <Fingerprint className={cn('mx-auto h-12 w-12', saved ? 'text-brand-fg' : failed ? 'text-red-300' : 'text-amber-200 motion-safe:animate-pulse')} aria-hidden />
              <p className="mt-3 font-display text-2xl font-bold uppercase text-white">{headline}</p>
              <p className="mt-1 text-sm text-ink-300">{detail}</p>
              <p className="mt-2 font-mono text-4xl font-bold text-white" aria-label={`Device user ID ${identity.deviceUserId}`}>{identity.deviceUserId}</p>
            </div>
            <ol className="mt-4 space-y-2 text-sm" aria-label="Enrolment status">
              <li className="flex items-center gap-2 text-white"><Check size={16} className="text-brand-fg" aria-hidden /> User ID reserved</li>
              {commandIds && <li className={cn('flex items-center gap-2', remote?.add?.status === 'done' ? 'text-white' : 'text-amber-100')}>{remote?.add?.status === 'done' ? <Check size={16} className="text-brand-fg" aria-hidden /> : <span className="ml-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />} Created on the device{remote?.add?.status === 'failed' ? ' — failed' : remote?.add?.status === 'done' ? '' : ' — waiting'}</li>}
              <li className={cn('flex items-center gap-2', saved ? 'text-white' : 'text-amber-100')}>{saved ? <Check size={16} className="text-brand-fg" aria-hidden /> : <span className="ml-1 h-2 w-2 rounded-full bg-amber-300" aria-hidden />} Fingerprint saved on device{saved ? (identity.status === 'ENROLLED' ? ' (confirmed by staff)' : ' (reported by the device)') : ' — waiting'}</li>
            </ol>
            {!online && !ACCESS_CONNECTED && <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3 text-xs text-amber-100">The device isn’t connected, so this screen can’t see it. When the device shows the fingerprint saved, confirm it here.</p>}
            {identity.status === 'PENDING' && (!auto || failed) && <Button size="lg" className="mt-5" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Fingerprint saved on device'}</Button>}
          </section>
        );
      })()}
    </div>
  );
};

export default EnrollWizard;
