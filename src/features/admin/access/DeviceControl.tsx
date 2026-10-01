import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HEALTH_LABEL, deviceHealth, type AccessDevice, type BiometricIdentity } from '@/lib/access';
import { admsCall } from '@/lib/access/admsApi';
import { deviceUserCounts, identitiesOfMember, identitiesOfTrainer, recentCommands, syncDeviceUsers, type DeviceCommand } from '@/lib/access/store';
import { listTeam } from '@/lib/admin/trainerAttendance';
import type { Member } from '@/lib/admin/members';
import { fmtTime } from '@/features/admin/members/lookups';
import MemberPicker from '@/features/admin/members/MemberPicker';
import { useActor } from '@/features/events/admin/actor';
import { useCached } from '../useCached';
import { ListBox, Pill, SideDrawer, type Tone } from '../kit';
import EnrollWizard, { memberPerson, type EnrollPerson } from './EnrollWizard';

const COMMAND_LABEL: Record<DeviceCommand['type'], string> = { query_users: 'Send user list', add_user: 'Create user', enroll_fp: 'Fingerprint enrolment', unlock_door: 'Open door' };
/** A request's state, from what the device actually did — never assumed. */
function commandState(c: DeviceCommand, online: boolean): { label: string; tone: Tone } {
  if (c.status === 'done') return { label: 'Success', tone: 'ok' };
  if (c.status === 'failed') return { label: c.returnCode ? `Failed (code ${c.returnCode})` : c.error ?? 'Failed', tone: 'bad' };
  if (c.status === 'sent') return { label: 'Sent — waiting for the device’s answer', tone: 'info' };
  return online ? { label: 'Sending…', tone: 'warn' } : { label: 'Device offline — waits until it reconnects', tone: 'warn' };
}
interface Contact { sn: string; last: { kind: string; path: string; status: number } | null; lastSeenAt: string | null }

/** Access → one device: its real state, its users, and the operations it genuinely supports. */
const DeviceControl = ({ device, onChanged }: { device: AccessDevice; onChanged: () => void }) => {
  const actor = useActor();
  const h = deviceHealth(device);
  const online = h === 'online';
  const counts = useCached(['deviceUserCounts', device.id], () => deviceUserCounts(device.id));
  const cmds = useCached(['deviceCommands', device.id], () => recentCommands(device.id, 6));
  const contact = useCached(['admsContact', device.serialNumber], () => admsCall<{ contacts: Contact[] }>('status').then((s) => s.contacts.find((c) => c.sn.toUpperCase() === device.serialNumber.toUpperCase()) ?? null).catch(() => null));
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // Requests change state as the device answers: refresh while any is in flight
  const inFlight = (cmds.data ?? []).some((c) => c.status === 'queued' || c.status === 'sent');
  useEffect(() => { if (!inFlight) return; const t = setInterval(() => cmds.refetch(), 5000); return () => clearInterval(t); }, [inFlight]); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async () => {
    setSyncing(true); setNote(null);
    try { await syncDeviceUsers(device.id, actor); setNote(online ? 'Asked the device for its user list — it arrives within a minute.' : 'The device is offline: the request goes out when it reconnects.'); cmds.refetch(); }
    catch (e) { setNote(`Couldn’t send the request: ${(e as Error).message}`); }
    finally { setSyncing(false); }
  };
  const c = counts.data;

  return (
    <section aria-label={`Device ${device.name}`} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold uppercase leading-none text-white">{device.name}</p>
          <p className="mt-1 text-sm text-ink-400">{device.model} · Serial <span className="font-mono">{device.serialNumber || '—'}</span></p>
        </div>
        <Pill tone={online ? 'ok' : h === 'offline' ? 'bad' : 'muted'}>{HEALTH_LABEL[h]}</Pill>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
        <div><dt className="text-xs text-ink-500">Last communication</dt><dd className="text-white">{device.lastSeenAt ? fmtTime(device.lastSeenAt as never) : 'Never'}</dd></div>
        <div><dt className="text-xs text-ink-500">Last request</dt><dd className="truncate text-white">{contact.data?.last ? `${contact.data.last.kind} (${contact.data.last.status})` : '—'}</dd></div>
        <div><dt className="text-xs text-ink-500">Users on device</dt><dd className="text-white">{c ? c.onDevice : '…'}</dd></div>
        <div><dt className="text-xs text-ink-500">Managed by new CRM</dt><dd className="text-white">{c ? c.crm : '…'}</dd></div>
        <div><dt className="text-xs text-ink-500">Old system, linked</dt><dd className="text-white">{c ? c.legacyLinked : '…'}</dd></div>
        <div><dt className="text-xs text-ink-500">Not linked</dt><dd className="text-white">{c ? c.notLinked : '…'}</dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setOpen(true)}><Fingerprint /> Open Biometric</Button>
        <Button size="sm" variant="outline" loading={syncing} loadingText="Sending…" onClick={sync}><RefreshCw /> Sync user list</Button>
        <Button asChild size="sm" variant="outline"><Link to="/admin/settings/access"><Radio /> Test connection</Link></Button>
        <Button asChild size="sm" variant="ghost"><Link to={`/admin/settings/access/${device.id}/users`}>Match users</Link></Button>
      </div>
      {note && <p role="status" className="mt-3 text-sm text-ink-200">{note}</p>}

      <h3 className="mt-5 font-sans text-xs font-bold uppercase tracking-wider text-ink-400">Recent requests to the device</h3>
      {!cmds.data ? <div className="mt-2 h-10 animate-pulse rounded-xl bg-ink-800" /> : cmds.data.length === 0 ? <p className="mt-2 text-sm text-ink-500">None yet.</p> : (
        <div className="mt-2"><ListBox label="Device requests">
          {cmds.data.map((x) => { const st = commandState(x, online); return (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="min-w-0 text-white">{COMMAND_LABEL[x.type]}{x.deviceUserId ? <span className="text-ink-400"> · user {x.deviceUserId}</span> : null}</span>
              <span className="flex items-center gap-3"><span className="text-xs text-ink-500">{x.createdAt ? fmtTime({ toDate: () => new Date(x.createdAt!.toMillis()) } as never) : ''}</span><Pill tone={st.tone}>{st.label}</Pill></span>
            </li>
          ); })}
        </ListBox></div>
      )}
      <OpenBiometric open={open} onOpenChange={(o) => { setOpen(o); if (!o) { cmds.refetch(); counts.refetch(); onChanged(); } }} />
    </section>
  );
};

/**
 * Reception's "Open Biometric": choose who, then the device's own enrolment screen is opened
 * remotely (ADMS ENROLL_FP) — for a new CRM user. Shows exactly what the device reports.
 */
const OpenBiometric = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const [kind, setKind] = useState<'member' | 'trainer'>('member');
  const [person, setPerson] = useState<{ p: EnrollPerson; ids: BiometricIdentity[] } | null>(null);
  const team = useCached(['team'], listTeam, open && kind === 'trainer');
  useEffect(() => { if (!open) setPerson(null); }, [open]);
  const pickMember = async (m: Member) => setPerson({ p: memberPerson(m), ids: await identitiesOfMember(m.id).catch(() => []) });
  const pickTrainer = async (t: { id: string; name: string; role?: string }) => setPerson({ p: { id: t.id, name: t.name, personType: 'trainer', code: t.role }, ids: await identitiesOfTrainer(t.id).catch(() => []) });
  return (
    <SideDrawer open={open} onOpenChange={onOpenChange} title="Open Biometric" description={person ? person.p.name : 'Enroll a fingerprint on the device from here'}>
      {person ? (
        person.ids.some((i) => i.status !== 'REMOVED') ? (
          <p className="text-sm text-ink-300">{person.p.name} already has a device user. Open their profile to re-enroll or change access.{' '}
            <Link className="font-semibold text-brand-fg hover:underline" to={person.p.personType === 'member' ? `/admin/members/${person.p.id}?tab=access` : `/admin/trainers/${person.p.id}?tab=access`}>Open profile</Link></p>
        ) : <EnrollWizard person={person.p} existing={person.ids} onDone={() => {}} />
      ) : (
        <div>
          <div className="mb-4 flex gap-1 rounded-xl border border-white/[0.08] bg-ink-900 p-1" role="group" aria-label="Who">
            {(['member', 'trainer'] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn('flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold', kind === k ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>{k === 'member' ? 'Member' : 'Trainer'}</button>)}
          </div>
          {kind === 'member' ? <MemberPicker label="Which member?" onPick={pickMember} /> : (
            !team.data ? <div className="h-16 animate-pulse rounded-xl bg-ink-800" /> : (
              <ListBox label="Trainers">
                {team.data.map((t) => <li key={t.id}><button type="button" onClick={() => pickTrainer(t)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/[0.03]"><span className="font-semibold text-white">{t.name}</span><span className="text-xs text-ink-500">{t.role ?? ''}</span></button></li>)}
              </ListBox>
            )
          )}
        </div>
      )}
    </SideDrawer>
  );
};

export default DeviceControl;
