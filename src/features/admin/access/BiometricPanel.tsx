import { useEffect, useState } from 'react';
import { Fingerprint, RotateCcw, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ENROLLMENT_LABEL, MANAGED_LABEL, enrollmentOf, managedByOf, type AccessDevice, type BiometricIdentity, type Enrollment,
} from '@/lib/access';
import { listDevices, setIdentityAccess, setIdentityStatus, setManagedBy, watchIdentity } from '@/lib/access/store';
import { ConfirmButton } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { SideDrawer } from '../kit';
import EnrollWizard, { type EnrollPerson } from './EnrollWizard';

const ENROLL_TONE: Record<Enrollment, string> = {
  confirmed: 'bg-brand-400/15 text-brand-fg', failed: 'bg-red-500/15 text-red-200', device_accepted: 'bg-amber-400/15 text-amber-100',
  requested: 'bg-amber-400/15 text-amber-100', unverified: 'bg-white/[0.06] text-ink-300', not_enrolled: 'bg-white/[0.06] text-ink-300',
};

/**
 * BIOMETRIC ACCESS for one person (member or trainer). Keeps four things apart: the fingerprint
 * enrolment (confirmed only by the device), who controls access (new CRM or old system), the
 * CRM's access switch, and the device user itself. Old-system users are shown but never changed
 * here — unless staff explicitly hand their access to the new CRM.
 */
const BiometricPanel = ({ person, identities, onChange, membership, startEnrol }: {
  person: EnrollPerson; identities: BiometricIdentity[] | null; onChange: () => void;
  /** Open the enrolment wizard straight away (e.g. from a "Enroll access" shortcut) */
  startEnrol?: boolean;
  /** Members only: the membership line shown next to access ("Active until 31 Dec 2026") */
  membership?: { label: string; ok: boolean };
}) => {
  const actor = useActor();
  const [devices, setDevices] = useState<AccessDevice[]>([]);
  const [wizard, setWizard] = useState<{ reenroll?: BiometricIdentity } | null>(startEnrol ? {} : null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { listDevices().then(setDevices).catch(() => setDevices([])); }, []);
  // Live: the device's answers (enrolment confirmed, failed…) appear without a reload
  const [fresh, setFresh] = useState<Map<string, BiometricIdentity>>(new Map());
  const ids = (identities ?? []).map((i) => i.id).join(',');
  useEffect(() => {
    if (!ids) return;
    const offs = ids.split(',').map((id) => watchIdentity(id, (i) => { if (i) setFresh((m) => new Map(m).set(id, i)); }));
    return () => offs.forEach((f) => f());
  }, [ids]);
  const live = (identities ?? []).map((i) => fresh.get(i.id) ?? i).filter((i) => i.status !== 'REMOVED');
  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? 'Device';
  const act = async (f: () => Promise<void>) => { setErr(null); try { await f(); onChange(); } catch (e) { setErr((e as Error).message); } };

  return (
    <section aria-label="Biometric access" className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-sm font-bold uppercase tracking-wider text-white">Biometric access</h2>
        {live.length === 0 && <Button size="sm" onClick={() => setWizard({})}><Fingerprint /> Enroll fingerprint</Button>}
      </div>
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
      {membership && <p className="mt-3 text-sm"><span className="text-ink-400">Membership: </span><span className={membership.ok ? 'text-white' : 'text-red-200'}>{membership.label}</span></p>}

      {identities === null ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-ink-800" /> : live.length === 0 ? (
        <p className="mt-4 text-sm text-ink-400">Not enrolled on any device.</p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label="Device users">
          {live.map((i) => {
            const en = enrollmentOf(i);
            const crm = managedByOf(i) === 'crm';
            const on = i.accessEnabled !== false && i.status !== 'DISABLED';
            return (
              <li key={i.id} className="rounded-xl border border-white/[0.08] p-4 text-sm">
                <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2">
                  <dt className="text-ink-500">Enrollment</dt><dd><span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', ENROLL_TONE[en])}>{ENROLLMENT_LABEL[en]}</span>{en === 'failed' && i.enrollmentError ? <span className="ml-2 text-xs text-red-200">{i.enrollmentError}</span> : null}</dd>
                  <dt className="text-ink-500">Device</dt><dd className="text-white">{deviceName(i.deviceId)}</dd>
                  <dt className="text-ink-500">Device UID</dt><dd className="font-mono text-white">{i.deviceUserId}</dd>
                  <dt className="text-ink-500">Managed by</dt><dd className="text-white">{MANAGED_LABEL[managedByOf(i)]}</dd>
                  <dt className="text-ink-500">Access</dt>
                  <dd>{crm ? <span className={on ? 'text-brand-fg' : 'text-red-200'}>{on ? 'Enabled' : 'Disabled'}</span> : <span className="text-ink-300">Controlled by the old system</span>}</dd>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {crm && <Button size="sm" variant="outline" onClick={() => setWizard({ reenroll: i })}><RotateCcw /> {en === 'confirmed' ? 'Re-enroll' : 'Enroll again'}</Button>}
                  {crm && on && <ConfirmButton size="sm" variant="outline" confirm={{ title: `Turn off ${person.name}’s access?`, body: 'Every scan by this fingerprint will be recorded as not allowed and flagged. The door itself is opened by the device — see “About door control” below.' }} onConfirm={() => act(() => setIdentityAccess(i, false, actor, person.name))}><ShieldOff /> Disable access</ConfirmButton>}
                  {crm && !on && <ConfirmButton size="sm" variant="outline" confirm={{ title: `Turn on ${person.name}’s access?`, body: person.personType === 'member' ? 'Their scans are allowed again whenever the membership is valid.' : 'Their scans are allowed again.' }} onConfirm={() => act(() => setIdentityAccess(i, true, actor, person.name))}><ShieldCheck /> Enable access</ConfirmButton>}
                  {!crm && <ConfirmButton size="sm" variant="outline" confirm={{ title: 'Let the new CRM manage this person’s access?', body: `From now on the new CRM decides whether device user ${i.deviceUserId}’s scans are allowed, from ${person.personType === 'member' ? 'their membership and ' : ''}the access switch. Do this only once the person has moved off the old system. Nothing is changed on the device.` }} onConfirm={() => act(() => setManagedBy(i, 'crm', actor, person.name))}>Manage access in the new CRM</ConfirmButton>}
                  <ConfirmButton size="sm" variant="secondary" confirm={{ title: `Remove the link to device user ${i.deviceUserId}?`, body: 'Their scans will show as unknown. Nothing is changed or deleted on the device.' }} onConfirm={() => act(() => setIdentityStatus(i, 'REMOVED', actor, person.name))}>Remove link</ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <details className="mt-4 text-xs text-ink-500">
        <summary className="cursor-pointer font-semibold text-ink-400">About door control</summary>
        <p className="mt-2">The fingerprint device opens the door itself the moment it recognises a fingerprint, then tells the CRM. So turning access off, or an expired membership, is recorded and flagged on every scan — but it doesn’t lock the door yet. Locking needs a device-side setting that is still being tested (see ACCESS_CONTROL.md). People managed by the old system are never changed by the new CRM.</p>
      </details>

      <SideDrawer open={!!wizard} onOpenChange={(o) => !o && setWizard(null)} title={wizard?.reenroll ? 'Re-enroll fingerprint' : 'Enroll fingerprint'} description={person.name}>
        {wizard && <EnrollWizard person={person} existing={identities ?? []} reenroll={wizard.reenroll} onDone={onChange} />}
      </SideDrawer>
    </section>
  );
};

export default BiometricPanel;
