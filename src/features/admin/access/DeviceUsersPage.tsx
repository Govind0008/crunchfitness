import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link2, Search, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { allMembers, memberCode, type Member } from '@/lib/admin/members';
import { assignDeviceUser, deviceUsersOf, identitiesOfDevice, listDevices, DeviceUserTakenError, type DeviceUserRow } from '@/lib/access/store';
import { BIOMETRIC_LABEL, type AccessDevice, type BiometricIdentity } from '@/lib/access';
import { AdminShell, ConfirmButton } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import MemberPicker from '@/features/admin/members/MemberPicker';
import { EmptyNote, ErrorNote, ListBox, ListToolbar, Pill, SideDrawer, SkeletonRows } from '../kit';

// ── Name matching ────────────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter(Boolean);
/** How well a device name ("RAVI K", often short or upper-case) fits a member's full name. */
function score(deviceName: string, memberName: string) {
  const a = norm(deviceName), b = norm(memberName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const dt = tokens(deviceName), mt = tokens(memberName);
  // First names must agree; every other word on the device starts a later word of the member's
  // name, in order ("ravi k" → "ravi kumar", never "sneha priya")
  if (mt[0] !== dt[0]) return 0;
  if (dt.length === 1) return 50;
  let j = 1;
  for (const t of dt.slice(1)) {
    while (j < mt.length && !mt[j].startsWith(t)) j++;
    if (j === mt.length) return 0;
    j++;
  }
  return 85;
}
interface Row { user: DeviceUserRow; identity?: BiometricIdentity; member?: Member; suggestion?: Member; others: number }
type Filter = 'todo' | 'suggested' | 'none' | 'linked' | 'all';

/**
 * Match the device's users (uploaded by the access reader) to CRM members. Linking stores the
 * existing device user ID — nothing is changed or re-enrolled on the device.
 */
const DeviceUsersPage = () => {
  const { deviceId = '' } = useParams();
  const actor = useActor();
  const [device, setDevice] = useState<AccessDevice | null | undefined>(undefined);
  const [users, setUsers] = useState<DeviceUserRow[] | null>(null);
  const [ids, setIds] = useState<BiometricIdentity[] | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [picking, setPicking] = useState<DeviceUserRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadIds = () => identitiesOfDevice(deviceId).then(setIds);
  useEffect(() => {
    Promise.all([
      listDevices().then((d) => setDevice(d.find((x) => x.id === deviceId) ?? null)),
      deviceUsersOf(deviceId).then(setUsers),
      loadIds(),
      allMembers().then(setMembers),
    ]).catch((e) => setError((e as Error).message));
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<Row[] | null>(() => {
    if (!users || !ids || !members) return null;
    const byId = new Map(members.map((m) => [m.id, m]));
    const linkedMember = new Set(ids.filter((i) => i.status !== 'REMOVED').map((i) => i.memberId));
    return users.map((user) => {
      const identity = ids.find((i) => i.deviceUserId === user.deviceUserId && i.status !== 'REMOVED');
      if (identity) return { user, identity, member: byId.get(identity.memberId), others: 0 };
      const scored = members.filter((m) => !linkedMember.has(m.id)).map((m) => ({ m, s: score(user.name, m.name) })).filter((x) => x.s >= 50).sort((x, y) => y.s - x.s);
      const top = scored[0];
      const tied = top ? scored.filter((x) => x.s === top.s).length : 0;
      // Only a clear, single best match is suggested; anything ambiguous is left to staff
      return { user, suggestion: top && top.s >= 85 && tied === 1 ? top.m : undefined, others: tied };
    }).sort((a, b) => Number(a.user.deviceUserId) - Number(b.user.deviceUserId));
  }, [users, ids, members]);

  const count = (f: Filter) => (rows ?? []).filter((r) => matches(r, f)).length;
  function matches(r: Row, f: Filter) {
    if (f === 'all') return true;
    if (f === 'linked') return !!r.identity;
    if (f === 'suggested') return !r.identity && !!r.suggestion;
    if (f === 'none') return !r.identity && !r.suggestion;
    return !r.identity;
  }
  const shown = (rows ?? []).filter((r) => matches(r, filter) && (!q.trim() || r.user.name.toLowerCase().includes(q.trim().toLowerCase()) || r.user.deviceUserId.includes(q.trim())));

  const link = async (user: DeviceUserRow, m: Member) => {
    if (!device) return;
    setBusy(user.deviceUserId); setNote(null);
    try {
      await assignDeviceUser(m, device, actor, { existingId: user.deviceUserId, method: 'fingerprint' });
      await loadIds();
    } catch (e) {
      setNote(e instanceof DeviceUserTakenError ? e.message : `Couldn’t link ${user.name}: ${(e as Error).message}`);
    } finally { setBusy(null); }
  };
  const linkAllSuggested = async () => {
    const todo = (rows ?? []).filter((r) => !r.identity && r.suggestion);
    setBulk({ done: 0, total: todo.length });
    for (const [i, r] of todo.entries()) {
      try { if (device) await assignDeviceUser(r.suggestion!, device, actor, { existingId: r.user.deviceUserId, method: 'fingerprint' }); } catch { /* shown as still unlinked */ }
      setBulk({ done: i + 1, total: todo.length });
    }
    await loadIds();
    setBulk(null);
    setNote(`Linked ${todo.length} suggested match${todo.length === 1 ? '' : 'es'}. The reader confirms each one against the device within a minute.`);
  };
  const linked = count('linked');

  if (device === null) return <AdminShell title="Device not found" nav="settings" area="Settings" back={{ to: '/admin/settings/access', label: 'Access devices' }}><EmptyNote title="No such device" body="It may have been removed." /></AdminShell>;

  return (
    <AdminShell title="Match device users" nav="settings" area="Settings" back={{ to: '/admin/settings/access', label: 'Access devices' }}
      subtitle={rows ? `${device?.name ?? 'Device'} · ${rows.length} users on the device · ${linked} linked to members` : '…'}
      actions={rows && count('suggested') > 0 ? (
        <ConfirmButton confirm={{ title: `Link ${count('suggested')} suggested matches?`, body: 'Each device user is linked to the member whose name matches clearly. Nothing changes on the device. You can unlink anyone later from their profile.' }}
          onConfirm={linkAllSuggested}><UserCheck /> Link {count('suggested')} suggested</ConfirmButton>
      ) : undefined}>
      <p className="-mt-2 mb-5 max-w-3xl text-sm text-ink-400">The device’s own user list, read by the access reader on the gym PC. Linking tells the CRM who each device user ID belongs to, so their scans show on the right member. Nothing is changed or re-enrolled on the device.</p>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load the device users." error={error} /></div>}
      {note && <p role="status" className="mb-4 text-sm text-ink-200">{note}</p>}
      {bulk && <p role="status" className="mb-4 text-sm text-brand-300">Linking… {bulk.done} of {bulk.total}</p>}

      <ListToolbar search={q} onSearch={setQ} placeholder="Search device users by name or ID" label="Filter device users" value={filter} onChange={(k) => setFilter(k as Filter)}
        segments={[{ id: 'todo', label: 'Not linked', count: rows ? count('todo') : undefined }, { id: 'suggested', label: 'Suggested', count: rows ? count('suggested') : undefined }, { id: 'none', label: 'No match', count: rows ? count('none') : undefined }, { id: 'linked', label: 'Linked', count: rows ? linked : undefined }, { id: 'all', label: 'All' }]} />

      {!rows ? <SkeletonRows rows={6} /> : users?.length === 0 ? (
        <EmptyNote title="No device users yet" body="Start the access reader on the gym PC — it uploads the device’s user list within a minute." />
      ) : shown.length === 0 ? <EmptyNote title="Nothing here" body="No device users match this filter." /> : (
        <ListBox label="Device users">
          {shown.slice(0, 300).map((r) => (
            <li key={r.user.deviceUserId} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
              <span className="font-mono text-sm tabular-nums text-ink-300">#{r.user.deviceUserId}</span>
              <span className="min-w-0"><span className="block truncate font-semibold text-white">{r.user.name || 'No name on device'}</span>{r.user.admin && <span className="text-xs text-amber-200">Device admin</span>}</span>
              <span className="col-span-2 min-w-0 text-sm md:col-span-1">
                {r.identity ? (
                  <span className="flex flex-wrap items-center gap-2"><Pill tone={r.identity.status === 'SYNCED' ? 'ok' : r.identity.status === 'SYNC_FAILED' ? 'bad' : 'info'}>{BIOMETRIC_LABEL[r.identity.status]}</Pill><span className="truncate text-white">{r.member?.name ?? 'Member'}</span>{r.member && <span className="font-mono text-xs text-ink-500">{memberCode(r.member.id)}</span>}</span>
                ) : r.suggestion ? (
                  <span className="flex flex-wrap items-center gap-2"><span className="text-ink-400">Suggested:</span><span className="truncate text-white">{r.suggestion.name}</span><span className="font-mono text-xs text-ink-500">{memberCode(r.suggestion.id)}</span></span>
                ) : <span className="text-ink-500">{r.others > 1 ? `${r.others} possible members — choose one` : 'No matching member'}</span>}
              </span>
              <span className={cn('col-span-2 flex gap-2 md:col-span-1 md:justify-end', r.identity && 'hidden md:flex')}>
                {!r.identity && r.suggestion && <Button size="sm" disabled={busy === r.user.deviceUserId} onClick={() => link(r.user, r.suggestion!)}><Link2 /> Link</Button>}
                {!r.identity && <Button size="sm" variant="outline" onClick={() => setPicking(r.user)}><Search /> {r.suggestion ? 'Someone else' : 'Choose member'}</Button>}
              </span>
            </li>
          ))}
        </ListBox>
      )}
      {shown.length > 300 && <p className="mt-3 text-xs text-ink-500">Showing the first 300 — search to find others.</p>}

      <SideDrawer open={!!picking} onOpenChange={(o) => !o && setPicking(null)} title={picking ? `Device user #${picking.deviceUserId}` : 'Choose member'} description={picking ? `“${picking.name || 'No name'}” on the device` : undefined}>
        {picking && <MemberPicker label="Which member is this?" onPick={async (m) => { const u = picking; setPicking(null); await link(u, m); }} />}
      </SideDrawer>
    </AdminShell>
  );
};

export default DeviceUsersPage;
