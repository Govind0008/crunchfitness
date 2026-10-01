import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Fingerprint, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deviceHealth, enrollmentOf, type AccessDevice, type BiometricIdentity } from '@/lib/access';
import { DeviceUserTakenError, assignDeviceUser, listDevices, requestEnrollment, watchDeviceCommand, watchIdentity, type DeviceCommand } from '@/lib/access/store';
import { inputCls } from '@/features/events/admin/shared';
import { memberCode, type Member } from '@/lib/admin/members';
import Avatar from '@/features/admin/members/Avatar';
import { useActor } from '@/features/events/admin/actor';

/** Who is being enrolled: a member or a trainer (both resolve through the same identity record). */
export interface EnrollPerson { id: string; name: string; personType: 'member' | 'trainer'; code?: string; avatar?: React.ReactNode }
// eslint-disable-next-line react-refresh/only-export-components
export const memberPerson = (m: Member): EnrollPerson => ({ id: m.id, name: m.name, personType: 'member', code: memberCode(m.id), avatar: <Avatar m={m} size={56} /> });
type Step = 1 | 2 | 3;
const NO_ANSWER_MS = 120_000;

/**
 * Fingerprint enrolment on the X2008 — for a member or a trainer.
 *
 * New CRM user: the CRM gives a new device user ID, asks the device to create the user and to
 * open its enrolment screen (ENROLL_FP). Every status shown comes from the device: the request
 * picked up, the device's answer, and finally "Enrolled" — only when the device reports the
 * fingerprint or verifies a scan by fingerprint. Nothing is marked enrolled by a click.
 *
 * Someone already on the device (the old system): only a link for attendance is recorded. The
 * old system keeps control of their access, and nothing is sent to the device.
 */
const EnrollWizard = ({ person, existing, onDone, reenroll }: { person: EnrollPerson; existing: BiometricIdentity[]; onDone: () => void; reenroll?: BiometricIdentity }) => {
  const actor = useActor();
  const [step, setStep] = useState<Step>(reenroll ? 3 : 1);
  const [devices, setDevices] = useState<AccessDevice[] | null>(null);
  const [deviceId, setDeviceId] = useState(reenroll?.deviceId ?? '');
  const [useExisting, setUseExisting] = useState(false);
  const [existingId, setExistingId] = useState('');
  const [identity, setIdentity] = useState<BiometricIdentity | null>(reenroll ?? null);
  const [commandIds, setCommandIds] = useState<{ add?: string; enroll: string } | null>(null);
  const [cmds, setCmds] = useState<{ add: DeviceCommand | null; enroll: DeviceCommand | null }>({ add: null, enroll: null });
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listDevices().then((d) => { const on = d.filter((x) => x.enabled); setDevices(on); if (on.length === 1 && !deviceId) setDeviceId(on[0].id); }).catch(() => setDevices([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const device = devices?.find((d) => d.id === deviceId);
  const online = !!device && deviceHealth(device) === 'online';
  useEffect(() => {
    if (!deviceId || !commandIds) return;
    const off = [watchDeviceCommand(deviceId, commandIds.enroll, (c) => setCmds((x) => ({ ...x, enroll: c })))];
    if (commandIds.add) off.push(watchDeviceCommand(deviceId, commandIds.add, (c) => setCmds((x) => ({ ...x, add: c }))));
    return () => off.forEach((f) => f());
  }, [deviceId, commandIds]);
  useEffect(() => { if (!identity?.id) return; return watchIdentity(identity.id, (i) => { if (i) setIdentity(i); }); }, [identity?.id]);
  useEffect(() => { if (step !== 3) return; const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, [step]);
  const already = existing.find((i) => i.deviceId === deviceId && i.status !== 'REMOVED');

  const start = async () => {
    if (!device) return;
    setBusy(true); setError(null);
    try {
      const uid = await assignDeviceUser({ id: person.id, name: person.name, personType: person.personType }, device, actor, { method: 'fingerprint', existingId: useExisting ? existingId : undefined });
      const created = { id: `${device.id}_${uid}`, deviceId: device.id, deviceUserId: uid, personType: person.personType, memberId: person.personType === 'member' ? person.id : null, trainerId: person.personType === 'trainer' ? person.id : null, managedBy: useExisting ? 'legacy' : 'crm', status: 'PENDING', enrollment: useExisting ? 'unverified' : 'not_enrolled' } as BiometricIdentity;
      setIdentity(created);
      if (!useExisting) setCommandIds(await requestEnrollment(created, actor, person.name, { createUser: true }));
      setStep(3); onDone();
    } catch (e) {
      setError(e instanceof DeviceUserTakenError ? e.message : `Couldn’t start: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const again = async () => {
    if (!identity) return;
    setBusy(true); setError(null);
    try { setCmds({ add: null, enroll: null }); setCommandIds(await requestEnrollment(identity, actor, person.name)); onDone(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  // Re-enrol opens straight on the status step with a fresh request
  useEffect(() => { if (reenroll && !commandIds) void again(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const StepDot = ({ n, label }: { n: Step; label: string }) => (
    <li className="flex items-center gap-2">
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', step > n ? 'bg-brand-400 text-on-brand' : step === n ? 'bg-white text-ink-950' : 'bg-white/[0.08] text-ink-500')}>{step > n ? <Check size={14} aria-hidden /> : n}</span>
      <span className={cn('text-xs font-semibold', step === n ? 'text-white' : 'text-ink-500')}>{label}</span>
    </li>
  );

  return (
    <div>
      <ol className="mb-6 flex flex-wrap gap-4" aria-label="Enrolment steps">
        <StepDot n={1} label={person.personType === 'trainer' ? 'Confirm trainer' : 'Confirm member'} /><StepDot n={2} label="Choose device" /><StepDot n={3} label="Enrol on device" />
      </ol>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3 text-sm text-red-200">{error}</p>}

      {step === 1 && (
        <section aria-label={person.personType === 'trainer' ? 'Confirm trainer' : 'Confirm member'}>
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-ink-900 p-4">
            {person.avatar ?? <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-800 text-lg font-bold text-white" aria-hidden>{person.name[0]}</span>}
            <div><p className="font-display text-2xl font-bold uppercase leading-none text-white">{person.name}</p><p className="mt-1 text-xs text-ink-400">{person.personType === 'trainer' ? 'Trainer' : 'Member'}{person.code ? <> · <span className="font-mono">{person.code}</span></> : null}</p></div>
          </div>
          <Button size="lg" className="mt-5" onClick={() => setStep(2)}>Continue</Button>
        </section>
      )}

      {step === 2 && (
        <section aria-label="Choose device">
          {devices === null ? <div className="h-20 animate-pulse rounded-xl bg-ink-900" /> : devices.length === 0 ? (
            <p className="rounded-xl border border-white/[0.08] p-4 text-sm text-ink-300">No fingerprint device is set up yet. An admin can add it in <Link to="/admin/settings/access" className="font-semibold text-brand-fg hover:underline">Settings → Access devices</Link>.</p>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="Device">
              {devices.map((d) => {
                const h = deviceHealth(d);
                return (
                  <button key={d.id} type="button" role="radio" aria-checked={deviceId === d.id} onClick={() => setDeviceId(d.id)}
                    className={cn('flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors', deviceId === d.id ? 'border-brand-400 bg-brand-400/[0.06]' : 'border-white/[0.1] hover:border-white/25')}>
                    <Fingerprint className={deviceId === d.id ? 'text-brand-fg' : 'text-ink-500'} size={22} aria-hidden />
                    <span className="flex-1"><span className="block font-semibold text-white">{d.name}</span><span className="text-xs text-ink-400">{d.model}{d.location ? ` · ${d.location}` : ''}</span></span>
                    <span className={cn('text-xs font-semibold', h === 'online' ? 'text-brand-fg' : 'text-amber-200')}>{h === 'online' ? 'Online' : 'Device offline'}</span>
                  </button>
                );
              })}
            </div>
          )}
          {already && <p className="mt-3 text-sm text-amber-100">{person.name} already has user ID {already.deviceUserId} on this device — use Re-enrol on their profile instead.</p>}
          {devices && devices.length > 0 && (
            <div className="mt-4 rounded-xl border border-white/[0.08] p-4 text-sm">
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b0d43f]" checked={useExisting} onChange={(e) => setUseExisting(e.target.checked)} />
                <span><span className="block font-semibold text-white">Already on the device (old system)</span><span className="text-xs text-ink-400">Link their existing user ID for attendance. Nothing is sent to the device, and the old system keeps controlling their access.</span></span></label>
              {useExisting && <label className="mt-3 block text-xs text-ink-400">User ID on the device<input className={cn(inputCls, 'mt-1 h-11')} value={existingId} onChange={(e) => setExistingId(e.target.value.trim())} inputMode="numeric" /></label>}
            </div>
          )}
          {device && !online && !useExisting && <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3 text-xs text-amber-100">The device is offline. The request will be sent when it reconnects — or enrol later.</p>}
          <div className="mt-5 flex gap-2">
            <Button size="lg" disabled={!device || !!already || (useExisting && !existingId)} loading={busy} loadingText="Starting…" onClick={start}>{useExisting ? 'Link user ID' : 'Start enrolment'}</Button>
            <Button size="lg" variant="ghost" onClick={() => setStep(1)}>Back</Button>
          </div>
        </section>
      )}

      {step === 3 && identity && (() => {
        const first = person.name.split(' ')[0];
        const en = enrollmentOf(identity);
        const legacy = identity.managedBy !== 'crm';
        const enroll = cmds.enroll;
        const add = cmds.add;
        const failed = en === 'failed' || enroll?.status === 'failed' || add?.status === 'failed';
        const code = enroll?.status === 'failed' ? enroll.returnCode : add?.status === 'failed' ? add.returnCode : null;
        const sentAt = enroll?.sentAt?.toMillis();
        const noAnswer = !!sentAt && enroll?.status === 'sent' && now - sentAt > NO_ANSWER_MS;
        const confirmed = en === 'confirmed';
        const state = confirmed ? 'Enrolled' : legacy ? 'Linked' : failed ? 'Failed' : !device ? 'Waiting' : !online && enroll?.status === 'queued' ? 'Device offline'
          : noAnswer ? 'No answer' : en === 'device_accepted' || enroll?.status === 'done' ? 'Place finger' : enroll?.status === 'sent' ? 'Sent' : 'Sending…';
        const detail: Record<string, string> = {
          Enrolled: `The device confirmed ${first}’s fingerprint (${identity.enrollmentEvidence === 'fingerprint_scan' ? 'a scan verified by fingerprint' : 'it reported the saved fingerprint'}).`,
          Linked: `User ${identity.deviceUserId} is linked to ${first} for attendance. The old system still controls their access; it’s confirmed at their next fingerprint scan.`,
          Failed: `The device refused the request${code ? ` (code ${code})` : ''}. Remote enrolment may not be supported on this device: enrol user ID ${identity.deviceUserId} on the device itself (Menu → User Mgt → New User → Fingerprint). The CRM confirms it at ${first}’s first fingerprint scan.`,
          'Device offline': 'The device hasn’t been in touch in the last few minutes. The request is waiting and goes out when it reconnects.',
          'No answer': `The device took the request but hasn’t answered for 2 minutes. Check its screen; if nothing happened, enrol user ID ${identity.deviceUserId} on the device itself.`,
          'Place finger': `The device accepted the request: ${first} places the same finger on the device 3 times. This updates by itself when the device reports it.`,
          Sent: 'The device has the request — its enrolment screen should open within seconds.',
          'Sending…': 'Waiting for the device to collect the request (it checks in every few seconds).',
          Waiting: '',
        };
        const tone = confirmed || legacy ? 'text-brand-fg' : failed || noAnswer ? 'text-red-300' : 'text-amber-200';
        return (
          <section aria-label="Enrol on device">
            <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 text-center" role="status" aria-live="polite">
              {failed ? <X className={cn('mx-auto h-12 w-12', tone)} aria-hidden /> : <Fingerprint className={cn('mx-auto h-12 w-12', tone, !confirmed && !legacy && 'motion-safe:animate-pulse')} aria-hidden />}
              <p className="mt-3 font-display text-2xl font-bold uppercase text-white" data-enroll-state={state}>{state}</p>
              <p className="mt-1 text-sm text-ink-300">{detail[state]}</p>
              <p className="mt-2 font-mono text-4xl font-bold text-white" aria-label={`Device user ID ${identity.deviceUserId}`}>{identity.deviceUserId}</p>
            </div>
            {!legacy && (
              <ol className="mt-4 space-y-2 text-sm" aria-label="Enrolment status">
                <Line done label="User ID reserved in the CRM" />
                {commandIds?.add && <Line done={add?.status === 'done'} failed={add?.status === 'failed'} label={`User created on the device${add?.status === 'failed' ? ` — refused (code ${add.returnCode})` : add?.status === 'done' ? '' : ' — waiting for the device'}`} />}
                <Line done={en === 'device_accepted' || confirmed || enroll?.status === 'done'} failed={enroll?.status === 'failed'} label={`Enrolment screen opened on the device${enroll?.status === 'failed' ? ` — refused (code ${enroll.returnCode})` : enroll?.status === 'done' || en === 'device_accepted' || confirmed ? '' : ' — waiting for the device'}`} />
                <Line done={confirmed} label={`Fingerprint confirmed by the device${confirmed ? '' : ' — waiting'}`} />
              </ol>
            )}
            {!legacy && (failed || noAnswer) && <Button size="lg" className="mt-5" loading={busy} loadingText="Sending…" onClick={again}>Try again</Button>}
          </section>
        );
      })()}
    </div>
  );
};

const Line = ({ done, failed, label }: { done?: boolean; failed?: boolean; label: string }) => (
  <li className={cn('flex items-center gap-2', done ? 'text-white' : failed ? 'text-red-200' : 'text-amber-100')}>
    {done ? <Check size={16} className="text-brand-fg" aria-hidden /> : failed ? <X size={16} className="text-red-300" aria-hidden /> : <span className="ml-1 mr-0.5 h-2 w-2 rounded-full bg-amber-300" aria-hidden />} {label}
  </li>
);

export default EnrollWizard;
