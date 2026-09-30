import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Dumbbell, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { memberCode, membersByIds, type Member } from '@/lib/admin/members';
import { listTeam } from '@/lib/admin/trainerAttendance';
import { assignDeviceUser, deviceUsersOf, identitiesOfDevice, listDevices, queueDeviceCommand, DeviceUserTakenError, type DeviceUserRow } from '@/lib/access/store';
import { BIOMETRIC_LABEL, type AccessDevice, type BiometricIdentity } from '@/lib/access';
import { AdminShell } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import MemberPicker from '@/features/admin/members/MemberPicker';
import { EmptyNote, ErrorNote, ListBox, ListToolbar, Pill, SideDrawer, SkeletonRows } from '../kit';

interface Trainer { id: string; name: string; role?: string }
interface Row { user: DeviceUserRow; identity?: BiometricIdentity; member?: Member; trainer?: Trainer }
type Filter = 'todo' | 'members' | 'trainers' | 'all';

/**
 * Link the device's users (uploaded by the device through the relay) to CRM members or trainers.
 * Every link is an explicit choice by staff — the name on the device is shown only to help them
 * find the right person; nothing is ever linked because two names look alike. Linking stores the
 * existing device user ID — nothing is changed or re-enrolled on the device.
 */
const DeviceUsersPage = () => {
  const { deviceId = '' } = useParams();
  const actor = useActor();
  const [device, setDevice] = useState<AccessDevice | null | undefined>(undefined);
  const [users, setUsers] = useState<DeviceUserRow[] | null>(null);
  const [ids, setIds] = useState<BiometricIdentity[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [team, setTeam] = useState<Trainer[] | null>(null);
  const [pickKind, setPickKind] = useState<'member' | 'trainer'>('member');
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [picking, setPicking] = useState<DeviceUserRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Ask the device to send its full user list (it arrives within a minute)
  const refreshList = async () => {
    if (!device) return;
    setRefreshing(true);
    try {
      await queueDeviceCommand(device.id, { type: 'query_users' }, actor);
      setNote('Asked the device for its user list. It arrives within a minute — this list updates by itself.');
      const until = Date.now() + 90_000;
      const t = setInterval(async () => { await deviceUsersOf(deviceId).then(setUsers).catch(() => {}); if (Date.now() > until) { clearInterval(t); setRefreshing(false); } }, 10_000);
    } catch (e) { setNote(`Couldn’t ask the device: ${(e as Error).message}`); setRefreshing(false); }
  };

  // Only the linked members are read (by id) — never the whole members collection
  const loadIds = () => identitiesOfDevice(deviceId).then(async (list) => {
    setIds(list);
    setMembers(await membersByIds([...new Set(list.map((i) => i.memberId).filter((x): x is string => !!x))]));
  });
  useEffect(() => {
    Promise.all([
      listDevices().then((d) => setDevice(d.find((x) => x.id === deviceId) ?? null)),
      deviceUsersOf(deviceId).then(setUsers),
      loadIds(),
      listTeam().then(setTeam),
    ]).catch((e) => setError((e as Error).message));
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<Row[] | null>(() => {
    if (!users || !ids || !members || !team) return null;
    const byId = new Map(members.map((m) => [m.id, m]));
    const byTrainer = new Map(team.map((t) => [t.id, t]));
    return users.map((user): Row => {
      const identity = ids.find((i) => i.deviceUserId === user.deviceUserId && i.status !== 'REMOVED');
      if (!identity) return { user };
      return identity.personType === 'trainer' ? { user, identity, trainer: byTrainer.get(identity.trainerId ?? '') } : { user, identity, member: byId.get(identity.memberId ?? '') };
    }).sort((a, b) => Number(a.user.deviceUserId) - Number(b.user.deviceUserId));
  }, [users, ids, members, team]);

  const matches = (r: Row, f: Filter) => f === 'all' || (f === 'todo' ? !r.identity : f === 'trainers' ? r.identity?.personType === 'trainer' : !!r.identity && r.identity.personType !== 'trainer');
  const count = (f: Filter) => (rows ?? []).filter((r) => matches(r, f)).length;
  const shown = (rows ?? []).filter((r) => matches(r, filter) && (!q.trim() || r.user.name.toLowerCase().includes(q.trim().toLowerCase()) || r.user.deviceUserId.includes(q.trim())));

  const link = async (user: DeviceUserRow, p: { id: string; name: string }, personType: 'member' | 'trainer') => {
    if (!device) return;
    setBusy(user.deviceUserId); setNote(null);
    try {
      await assignDeviceUser({ id: p.id, name: p.name, personType }, device, actor, { existingId: user.deviceUserId, method: 'fingerprint' });
      await loadIds();
      setNote(`Device user #${user.deviceUserId} is now linked to ${p.name} (${personType}).`);
    } catch (e) {
      setNote(e instanceof DeviceUserTakenError ? e.message : `Couldn’t link ${user.name}: ${(e as Error).message}`);
    } finally { setBusy(null); }
  };
  const linked = count('members') + count('trainers');

  if (device === null) return <AdminShell title="Device not found" nav="settings" area="Settings" back={{ to: '/admin/settings/access', label: 'Access devices' }}><EmptyNote title="No such device" body="It may have been removed." /></AdminShell>;

  return (
    <AdminShell title="Match device users" nav="settings" area="Settings" back={{ to: '/admin/settings/access', label: 'Access devices' }}
      subtitle={rows ? `${device?.name ?? 'Device'} · ${rows.length} users on the device · ${count('members')} linked to members · ${count('trainers')} to trainers` : '…'}>
      <div className="-mt-2 mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-ink-400">The device’s own user list, as the device reports it. Linking tells the CRM who each device user ID belongs to: a member’s punches become their visits, a trainer’s become staff attendance. Choose the person yourself — check the phone number or member code; a similar name is not enough. Nothing is changed or re-enrolled on the device.</p>
        <Button size="sm" variant="outline" disabled={!device || refreshing} onClick={refreshList}><RefreshCw /> {refreshing ? 'Asked the device…' : 'Refresh list'}</Button>
      </div>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load the device users." error={error} /></div>}
      {note && <p role="status" className="mb-4 text-sm text-ink-200">{note}</p>}

      <ListToolbar search={q} onSearch={setQ} placeholder="Search device users by name or ID" label="Filter device users" value={filter} onChange={(k) => setFilter(k as Filter)}
        segments={[{ id: 'todo', label: 'Not linked', count: rows ? count('todo') : undefined }, { id: 'members', label: 'Members', count: rows ? count('members') : undefined }, { id: 'trainers', label: 'Trainers', count: rows ? count('trainers') : undefined }, { id: 'all', label: 'All', count: rows ? rows.length : undefined }]} />

      {!rows ? <SkeletonRows rows={6} /> : users?.length === 0 ? (
        <EmptyNote title="No device users yet" body="Once the device is online, press Refresh list — the device sends its user list within a minute." />
      ) : shown.length === 0 ? <EmptyNote title="Nothing here" body="No device users match this filter." /> : (
        <ListBox label="Device users">
          {shown.slice(0, 300).map((r) => (
            <li key={r.user.deviceUserId} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
              <span className="font-mono text-sm tabular-nums text-ink-300">#{r.user.deviceUserId}</span>
              <span className="min-w-0"><span className="block truncate font-semibold text-white">{r.user.name || 'No name on device'}</span>{r.user.admin && <span className="text-xs text-amber-200">Device admin</span>}</span>
              <span className="col-span-2 min-w-0 text-sm md:col-span-1">
                {r.identity ? (
                  <span className="flex flex-wrap items-center gap-2"><Pill tone={r.identity.status === 'SYNCED' ? 'ok' : r.identity.status === 'SYNC_FAILED' ? 'bad' : 'info'}>{BIOMETRIC_LABEL[r.identity.status]}</Pill>
                    {r.identity.personType === 'trainer'
                      ? <><span className="truncate text-white">{r.trainer?.name ?? 'Trainer (profile removed)'}</span><span className="text-xs text-ink-500">Trainer</span></>
                      : <><span className="truncate text-white">{r.member?.name ?? 'Member (not found)'}</span>{r.member && <span className="font-mono text-xs text-ink-500">{memberCode(r.member.id)}</span>}</>}
                  </span>
                ) : <span className="text-ink-500">Not linked — punches are kept as unresolved</span>}
              </span>
              <span className={cn('col-span-2 flex gap-2 md:col-span-1 md:justify-end', r.identity && 'hidden md:flex')}>
                {!r.identity && <Button size="sm" variant="outline" disabled={busy === r.user.deviceUserId} onClick={() => { setPickKind('member'); setPicking(r.user); }}><Search /> Choose member</Button>}
                {!r.identity && <Button size="sm" variant="outline" disabled={busy === r.user.deviceUserId} onClick={() => { setPickKind('trainer'); setPicking(r.user); }}><Dumbbell /> Trainer</Button>}
              </span>
            </li>
          ))}
        </ListBox>
      )}
      {shown.length > 300 && <p className="mt-3 text-xs text-ink-500">Showing the first 300 — search to find others.</p>}

      <SideDrawer open={!!picking} onOpenChange={(o) => !o && setPicking(null)} title={picking ? `Device user #${picking.deviceUserId}` : 'Choose member'} description={picking ? `“${picking.name || 'No name'}” on the device` : undefined}>
        {picking && pickKind === 'member' && <MemberPicker label="Which member is this?" onPick={async (m) => { const u = picking; setPicking(null); await link(u, m, 'member'); }} />}
        {picking && pickKind === 'trainer' && (
          !team?.length ? <EmptyNote title="No trainers" body="Add trainer profiles under Team first." /> : (
            <div>
              <p className="mb-3 text-sm text-ink-400">Which trainer is this? Their punches will record trainer attendance (first punch = check-in, last = check-out), never member visits.</p>
              <ListBox label="Trainers">
                {team.filter((t) => !(ids ?? []).some((i) => i.personType === 'trainer' && i.trainerId === t.id && i.status !== 'REMOVED')).map((t) => (
                  <li key={t.id}><button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/[0.03]" onClick={async () => { const u = picking; setPicking(null); await link(u, t, 'trainer'); }}>
                    <span className="font-semibold text-white">{t.name}</span><span className="text-xs text-ink-500">{t.role ?? ''}</span>
                  </button></li>
                ))}
              </ListBox>
            </div>
          )
        )}
      </SideDrawer>
    </AdminShell>
  );
};

export default DeviceUsersPage;
