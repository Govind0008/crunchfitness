import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMPTY_TEAM, OBJECT_POSITIONS, deleteTeamProfile, saveTeamProfile, setTeamVisible, uploadImage, watchTeam, type TeamInput, type TeamProfile } from '@/lib/admin/content';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { EmptyNote, ErrorNote, ListBox, ListToolbar, Pill, SideDrawer, SkeletonRows } from '../kit';
import { useOpenFromParam } from '../useOpenFromParam';
import ImagePick from './ImagePick';

/**
 * Team — staff profiles on the website (owners, trainers, coaches). Not gym members.
 * The marketing desk edits profiles but can’t remove one (that also removes a trainer’s login).
 */
const TeamPage = ({ canRemove = true }: { canRemove?: boolean }) => {
  const actor = useActor();
  const [rows, setRows] = useState<TeamProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [editing, setEditing] = useState<TeamProfile | 'new' | null>(null);
  const [f, setF] = useState<TeamInput>(EMPTY_TEAM);
  const [photo, setPhoto] = useState<File | null>(null);
  const [more, setMore] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => watchTeam(setRows, (e) => setError(e.message)), []);

  const visible = (rows ?? []).filter((t) => t.visible !== false).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((t) => (filter === 'all' || (filter === 'visible') === (t.visible !== false)) && (!s || t.name.toLowerCase().includes(s) || t.role.toLowerCase().includes(s)));
  }, [rows, filter, q]);
  const openForm = (t: TeamProfile | 'new') => {
    setEditing(t); setPhoto(null); setFormErr(null); setMore(false);
    if (t === 'new') setF({ ...EMPTY_TEAM, order: rows?.length ?? 0 });
    else { const { id: _id, image: _img, ...rest } = t; setF({ ...EMPTY_TEAM, ...rest }); }
  };
  useOpenFromParam(() => openForm('new'));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.role.trim()) { setFormErr('Add a name and a role.'); return; }
    const existing = editing && editing !== 'new' ? editing : null;
    if (!photo && !existing?.image) { setFormErr('Add a photo — every profile on the website shows one.'); return; }
    setBusy(true); setFormErr(null);
    try {
      const image = photo ? await uploadImage(photo) : existing!.image;
      await saveTeamProfile(f, image, actor, existing?.id);
      setEditing(null);
    } catch { setFormErr('The profile couldn’t be saved. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title="Team" nav="team" area="More" subtitle={rows ? `${visible} of ${rows.length} shown on the website · staff profiles, not gym members` : '…'}
      actions={<Button onClick={() => openForm('new')}><Plus /> Add team member</Button>}>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load the team." error={error} /></div>}
      <ListToolbar search={q} onSearch={setQ} placeholder="Search team" label="Filter team" value={filter} onChange={(k) => setFilter(k as typeof filter)}
        segments={[{ id: 'all', label: 'All', count: rows?.length }, { id: 'visible', label: 'On website', count: rows ? visible : undefined }, { id: 'hidden', label: 'Hidden', count: rows ? rows.length - visible : undefined }]} />
      {!rows ? <SkeletonRows rows={4} /> : shown.length === 0 ? (
        rows.length === 0 ? <EmptyNote title="No team profiles" body="Add the people members will meet at the gym."><Button onClick={() => openForm('new')}><Plus /> Add team member</Button></EmptyNote>
          : <EmptyNote title="Nothing here" body="No profiles match this filter." />
      ) : (
        <ListBox label="Team">
          {shown.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => openForm(t)} aria-label={`Edit ${t.name}`} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-ink-800">{t.image ? <img src={t.image} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: t.objectPosition || 'center' }} /> : <UserRound className="h-5 w-5 text-ink-500" aria-hidden />}</span>
                <span className="min-w-0"><span className="block truncate font-semibold text-white">{t.name}</span><span className="block truncate text-xs text-ink-400">{t.role}{t.isOwner ? ' · Owner' : ''}</span></span>
                <span className="hidden truncate text-sm text-ink-400 md:block">{t.specialization}</span>
                <Pill tone={t.visible !== false ? 'ok' : 'muted'}>{t.visible !== false ? 'On website' : 'Hidden'}</Pill>
              </button>
            </li>
          ))}
        </ListBox>
      )}

      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Add team member' : 'Edit profile'} description="A staff profile on the website’s team section">
        <form onSubmit={save} className="space-y-5" noValidate aria-label="Team profile">
          {formErr && <p role="alert" className="text-sm text-red-300">{formErr}</p>}
          <ImagePick label="Photo" shape="portrait" current={editing && editing !== 'new' ? editing.image : ''} onPick={setPhoto} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="tm-name"><input id="tm-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Role" hint="e.g. Head coach" htmlFor="tm-role"><input id="tm-role" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></Field>
          </div>
          <Field label="Speciality" hint="Optional" htmlFor="tm-spec"><input id="tm-spec" className={inputCls} value={f.specialization} onChange={(e) => setF({ ...f, specialization: e.target.value })} /></Field>
          <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={f.visible !== false} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Show on the website</label>
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-2 text-sm font-semibold text-ink-300 hover:text-white"><ChevronDown size={16} className={cn('transition-transform', !more && '-rotate-90')} aria-hidden /> Bio and more</button>
          {more && (
            <div className="space-y-4">
              <Field label="Bio" htmlFor="tm-bio"><textarea id="tm-bio" rows={4} className={cn(inputCls, 'h-auto py-3')} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Experience" hint="e.g. 8 years" htmlFor="tm-exp"><input id="tm-exp" className={inputCls} value={f.experience} onChange={(e) => setF({ ...f, experience: e.target.value })} /></Field>
                <Field label="Instagram" hint="Handle or link" htmlFor="tm-ig"><input id="tm-ig" className={inputCls} value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} /></Field>
                <Field label="Photo focus" htmlFor="tm-pos"><select id="tm-pos" className={inputCls} value={f.objectPosition} onChange={(e) => setF({ ...f, objectPosition: e.target.value })}>{OBJECT_POSITIONS.map((p) => <option key={p}>{p}</option>)}</select></Field>
                <Field label="Order on the page" htmlFor="tm-order"><input id="tm-order" type="number" className={inputCls} value={f.order} onChange={(e) => setF({ ...f, order: Number(e.target.value) })} /></Field>
              </div>
              <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={f.isOwner} onChange={(e) => setF({ ...f, isOwner: e.target.checked })} /> Owner / founder</label>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
            <Button type="submit" loading={busy} loadingText="Saving…">{editing === 'new' ? 'Add team member' : 'Save profile'}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {editing && editing !== 'new' && <>
              <Button type="button" variant="outline" className="ml-auto" onClick={async () => { await setTeamVisible(editing, editing.visible === false); setEditing(null); }}>{editing.visible === false ? 'Show on website' : 'Hide from website'}</Button>
              {canRemove && <ConfirmButton size="default" variant="secondary" confirm={{ title: `Remove ${editing.name}?`, body: 'Their profile leaves the website. If they have a trainer login, it is removed too. This can’t be undone.' }} onConfirm={async () => { await deleteTeamProfile(editing, actor); setEditing(null); }}><Trash2 /><span className="sr-only">Remove profile</span></ConfirmButton>}
            </>}
          </div>
        </form>
      </SideDrawer>
    </AdminShell>
  );
};

export default TeamPage;
