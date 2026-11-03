import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Dumbbell, Link2, RefreshCw, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { memberCode, membersByIds, membersByNames, type Member } from '@/lib/admin/members';
import { formatPhone } from '@/lib/admin/phone';
import { fmtDate } from '@/features/admin/members/lookups';
import { listTeam } from '@/lib/admin/trainerAttendance';
import { onAdminDataChanged } from '@/lib/queryClient';
import { assignDeviceUser, deviceUsersOf, deviceUsersSeenAt, identitiesByIds, identitiesOfDevice, listDevices, queueDeviceCommand, DeviceUserTakenError, type DeviceUserRow } from '@/lib/access/store';
import { ENROLLMENT_LABEL, MANAGED_LABEL, enrollmentOf, identityId, managedByOf, type AccessDevice, type BiometricIdentity } from '@/lib/access';
import { AdminShell } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import MemberPicker from '@/features/admin/members/MemberPicker';
import { EmptyNote, ErrorNote, ListBox, ListToolbar, Pill, SideDrawer, SkeletonRows } from '../kit';

interface Trainer { id: string; name: string; role?: string }
interface Row { user: DeviceUserRow; identity?: BiometricIdentity; member?: Member; trainer?: Trainer }
type Filter = 'todo' | 'suggested' | 'members' | 'trainers' | 'all';
/** A member with exactly the device's name — a suggestion staff confirm, never a link by itself */
interface Suggestion { member?: Member; several: number }
const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Link the device's users (uploaded by the device through the relay) to CRM members or trainers.
 * Every link is an explicit choice by staff. "Find matches by name" suggests the CRM member with
 * exactly the device's name — only when that name belongs to one member and one device user — with
 * their phone and expiry to check; staff tick the ones they recognise. Nothing is linked because
 * two names look alike. A link records their scans as visits; their access stays with the old
 * system (which still blocks expired members) until staff take them over. Nothing is changed or
 * re-enrolled on the device.
 */
/**
 * The page's data (570+ device users, their links and members ≈ 1,600 reads) kept for this
 * browser tab, so coming back to the page doesn't read it all again. Kept 10 minutes; anything
 * saved elsewhere in the admin clears it. Links made on this page update it directly.
 */
type PageData = { users: DeviceUserRow[]; ids: BiometricIdentity[]; members: Member[]; at: number };
const pageCache = new Map<string, PageData>();
const PAGE_CACHE_MS = 10 * 60_000;
onAdminDataChanged(() => pageCache.clear());

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
  const [suggest, setSuggest] = useState<Map<string, Suggestion> | null>(null);
  const [finding, setFinding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  // Ask the device to send its full user list (it arrives within a minute)
  const refreshList = async () => {
    if (!device) return;
    setRefreshing(true);
    try {
      await queueDeviceCommand(device.id, { type: 'query_users' }, actor);
      setNote('Asked the device for its user list. It arrives within a minute — this list updates by itself.');
      // Watch one field (one read per check) and re-read the 500+ users once, when the new list is in
      const until = Date.now() + 120_000;
      const before = await deviceUsersSeenAt(deviceId).catch(() => 0);
      const t = setInterval(async () => {
        const seen = await deviceUsersSeenAt(deviceId).catch(() => before);
        const done = seen > before || Date.now() > until;
        if (seen > before) await deviceUsersOf(deviceId).then(setUsers).catch(() => {});
        if (done) { clearInterval(t); setRefreshing(false); }
      }, 10_000);
    } catch (e) { setNote(`Couldn’t ask the device: ${(e as Error).message}`); setRefreshing(false); }
  };

  // Only the linked members are read (by id) — never the whole members collection
  const loadIds = () => identitiesOfDevice(deviceId).then(async (list) => {
    setIds(list);
    setMembers(await membersByIds([...new Set(list.map((i) => i.memberId).filter((x): x is string => !!x))]));
  });
  /**
   * After linking, read only the new links and their members (2 reads per link) — re-reading every
   * link and member after each click cost ~1,000 reads and used up the free daily quota
   */
  const addLinked = async (deviceUserIds: string[]) => {
    if (!device || !deviceUserIds.length) return;
    const fresh = await identitiesByIds(deviceUserIds.map((u) => identityId(device.id, u)));
    const known = new Set((members ?? []).map((m) => m.id));
    const more = await membersByIds(fresh.map((i) => i.memberId).filter((x): x is string => !!x && !known.has(x)));
    const ids = new Set(fresh.map((i) => i.id));
    setIds((cur) => [...(cur ?? []).filter((i) => !ids.has(i.id)), ...fresh]);
    setMembers((cur) => [...(cur ?? []), ...more]);
  };
  // Remember what's on screen for the next visit (see pageCache)
  useEffect(() => {
    if (users && ids && members) pageCache.set(deviceId, { users, ids, members, at: pageCache.get(deviceId)?.at ?? Date.now() });
  }, [deviceId, users, ids, members]);
  useEffect(() => {
    const kept = pageCache.get(deviceId);
    const fresh = kept && Date.now() - kept.at < PAGE_CACHE_MS ? kept : null;
    if (fresh) { setUsers(fresh.users); setIds(fresh.ids); setMembers(fresh.members); } else pageCache.delete(deviceId);
    Promise.all([
      listDevices().then((d) => setDevice(d.find((x) => x.id === deviceId) ?? null)),
      fresh ? null : deviceUsersOf(deviceId).then(setUsers),
      fresh ? null : loadIds(),
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

  const matches = (r: Row, f: Filter) => f === 'all' || (f === 'todo' ? !r.identity : f === 'suggested' ? !r.identity && !!suggest?.get(r.user.deviceUserId)?.member : f === 'trainers' ? r.identity?.personType === 'trainer' : !!r.identity && r.identity.personType !== 'trainer');
  const count = (f: Filter) => (rows ?? []).filter((r) => matches(r, f)).length;
  const shown = (rows ?? []).filter((r) => matches(r, filter) && (!q.trim() || r.user.name.toLowerCase().includes(q.trim().toLowerCase()) || r.user.deviceUserId.includes(q.trim())));

  const link = async (user: DeviceUserRow, p: { id: string; name: string }, personType: 'member' | 'trainer') => {
    if (!device) return;
    setBusy(user.deviceUserId); setNote(null);
    try {
      await assignDeviceUser({ id: p.id, name: p.name, personType }, device, actor, { existingId: user.deviceUserId, method: 'fingerprint' });
      await addLinked([user.deviceUserId]);
      setNote(`Device user #${user.deviceUserId} is now linked to ${p.name} (${personType}).`);
    } catch (e) {
      setNote(e instanceof DeviceUserTakenError ? e.message : `Couldn’t link ${user.name}: ${(e as Error).message}`);
    } finally { setBusy(null); }
  };
  const linked = count('members') + count('trainers');

  /** Members whose name is exactly a not-yet-linked device user's name (reads only those members) */
  const findMatches = async () => {
    if (!rows) return;
    setFinding(true); setNote(null);
    try {
      const todo = rows.filter((r) => !r.identity && nameKey(r.user.name).length > 1);
      const found = await membersByNames(todo.map((r) => r.user.name));
      const linkedMembers = new Set((ids ?? []).filter((i) => i.status !== 'REMOVED').map((i) => i.memberId));
      const sameName = new Map<string, number>();
      for (const r of todo) sameName.set(nameKey(r.user.name), (sameName.get(nameKey(r.user.name)) ?? 0) + 1);
      const out = new Map<string, Suggestion>();
      for (const r of todo) {
        const ms = (found.get(nameKey(r.user.name)) ?? []).filter((m) => !linkedMembers.has(m.id));
        if (!ms.length) continue;
        // One member, one device user with that name: a suggestion. Anything else: staff choose.
        out.set(r.user.deviceUserId, ms.length === 1 && sameName.get(nameKey(r.user.name)) === 1 ? { member: ms[0], several: 1 } : { several: Math.max(ms.length, sameName.get(nameKey(r.user.name)) ?? 1) });
      }
      setSuggest(out); setSelected(new Set());
      const n = [...out.values()].filter((x) => x.member).length;
      setNote(n ? `${n} device users have a member with exactly the same name. Check each phone and expiry, tick the ones you recognise, then link them.` : 'No device user has a member with exactly the same name. Use “Choose member” to link them one by one.');
      if (n) setFilter('suggested');
    } catch (e) { setNote(`Couldn’t look for matches: ${(e as Error).message}`); }
    finally { setFinding(false); }
  };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const suggestedShown = shown.filter((r) => !r.identity && suggest?.get(r.user.deviceUserId)?.member);
  const linkSelected = async () => {
    if (!device || !rows) return;
    const todo = rows.filter((r) => selected.has(r.user.deviceUserId) && !r.identity && suggest?.get(r.user.deviceUserId)?.member);
    setBulk({ done: 0, total: todo.length }); setNote(null);
    const failed: string[] = [];
    const done: string[] = [];
    for (const [n, r] of todo.entries()) {
      try { await assignDeviceUser(suggest!.get(r.user.deviceUserId)!.member!, device, actor, { existingId: r.user.deviceUserId, method: 'fingerprint' }); done.push(r.user.deviceUserId); }
      catch (e) { failed.push(`#${r.user.deviceUserId}: ${(e as Error).message}`); }
      setBulk({ done: n + 1, total: todo.length });
    }
    await addLinked(done).catch(() => {});
    setSelected(new Set()); setBulk(null);
    setNote(failed.length ? `Linked ${todo.length - failed.length} of ${todo.length}. Not linked — ${failed.join('; ')}` : `Linked ${todo.length} device users to their members. Their scans now count as visits; the old system still controls their access.`);
  };

  if (device === null) return <AdminShell title="Device not found" nav="settings" area="Settings" back={{ to: '/admin/settings/access', label: 'Access devices' }}><EmptyNote title="No such device" body="It may have been removed." /></AdminShell>;

  return (
    <AdminShell title="Match device users" nav="settings" area="Settings" back={{ to: '/admin/settings/access', label: 'Access devices' }}
      subtitle={rows ? `${device?.name ?? 'Device'} · ${rows.length} users on the device · ${count('members')} linked to members · ${count('trainers')} to trainers` : '…'}>
      <div className="-mt-2 mb-5 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-ink-400">The device’s own user list, as the device reports it. Linking tells the CRM who each device user ID belongs to: a member’s punches become their visits, a trainer’s become staff attendance. Choose the person yourself — check the phone number or member code; a similar name is not enough. Nothing is changed or re-enrolled on the device.</p>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!rows || finding || !!bulk} onClick={findMatches}><Sparkles /> {finding ? 'Looking…' : 'Find matches by name'}</Button>
          <Button size="sm" variant="outline" disabled={!device || refreshing} onClick={refreshList}><RefreshCw /> {refreshing ? 'Asked the device…' : 'Refresh list'}</Button>
        </span>
      </div>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load the device users." error={error} /></div>}
      {note && <p role="status" className="mb-4 text-sm text-ink-200">{note}</p>}

      <ListToolbar search={q} onSearch={setQ} placeholder="Search device users by name or ID" label="Filter device users" value={filter} onChange={(k) => setFilter(k as Filter)}
        segments={[{ id: 'todo', label: 'Not linked', count: rows ? count('todo') : undefined }, ...(suggest ? [{ id: 'suggested' as Filter, label: 'Suggested', count: count('suggested') }] : []), { id: 'members', label: 'Members', count: rows ? count('members') : undefined }, { id: 'trainers', label: 'Trainers', count: rows ? count('trainers') : undefined }, { id: 'all', label: 'All', count: rows ? rows.length : undefined }]} />

      {suggestedShown.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-400/30 bg-brand-400/[0.05] px-4 py-3 text-sm" role="group" aria-label="Link suggested matches">
          <span className="text-ink-200">{selected.size} of {suggestedShown.length} suggestions ticked</span>
          <Button size="sm" variant="ghost" disabled={!!bulk} onClick={() => setSelected(selected.size === suggestedShown.length ? new Set() : new Set(suggestedShown.map((r) => r.user.deviceUserId)))}>{selected.size === suggestedShown.length ? 'Untick all' : 'Tick all shown'}</Button>
          <Button size="sm" className="ml-auto" disabled={!selected.size || !!bulk} onClick={linkSelected}><Link2 /> {bulk ? `Linking ${bulk.done} of ${bulk.total}…` : `Link ${selected.size}`}</Button>
        </div>
      )}

      {!rows ? <SkeletonRows rows={6} /> : users?.length === 0 ? (
        <EmptyNote title="No device users yet" body="Once the device is online, press Refresh list — the device sends its user list within a minute." />
      ) : shown.length === 0 ? <EmptyNote title="Nothing here" body="No device users match this filter." /> : (
        <ListBox label="Device users">
          {shown.slice(0, 300).map((r) => (
            <li key={r.user.deviceUserId} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
              <span className="font-mono text-sm tabular-nums text-ink-300">#{r.user.deviceUserId}</span>
              <span className="min-w-0"><span className="block truncate font-semibold text-white">{r.user.name || 'No name on device'}</span>{r.user.admin && <span className="text-xs text-amber-200">Device admin</span>}
                {!r.identity && suggest?.get(r.user.deviceUserId)?.several && !suggest.get(r.user.deviceUserId)!.member && <span className="block text-xs text-amber-200">Several people share this name — choose the member yourself</span>}</span>
              <span className="col-span-2 min-w-0 text-sm md:col-span-1">
                {r.identity ? (
                  <span className="flex flex-wrap items-center gap-2"><Pill tone={r.identity.managedBy === 'crm' ? 'ok' : 'muted'}>{MANAGED_LABEL[managedByOf(r.identity)]}</Pill><Pill tone={enrollmentOf(r.identity) === 'confirmed' ? 'ok' : enrollmentOf(r.identity) === 'failed' ? 'bad' : 'info'}>{ENROLLMENT_LABEL[enrollmentOf(r.identity)]}</Pill>
                    {r.identity.personType === 'trainer'
                      ? <><span className="truncate text-white">{r.trainer?.name ?? 'Trainer (profile removed)'}</span><span className="text-xs text-ink-500">Trainer</span></>
                      : <><span className="truncate text-white">{r.member?.name ?? 'Member (not found)'}</span>{r.member && <span className="font-mono text-xs text-ink-500">{memberCode(r.member.id)}</span>}</>}
                  </span>
                ) : suggest?.get(r.user.deviceUserId)?.member ? (() => { const m = suggest.get(r.user.deviceUserId)!.member!; return (
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-[#b0d43f]" checked={selected.has(r.user.deviceUserId)} disabled={!!bulk} onChange={() => toggle(r.user.deviceUserId)} aria-label={`Link #${r.user.deviceUserId} to ${m.name}`} />
                    <span className="min-w-0"><span className="block truncate text-white">{m.name} <span className="font-mono text-xs text-ink-500">{memberCode(m.id)}</span></span>
                      <span className="block text-xs text-ink-400">{formatPhone(m.phone)} · {m.membershipEnd ? `${m.membershipEnd < new Date().toISOString().slice(0, 10) ? 'expired' : 'until'} ${fmtDate(m.membershipEnd)}` : 'no expiry'}</span></span>
                  </label>); })()
                : <span className="text-ink-500">Not linked — punches are kept as unresolved</span>}
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
