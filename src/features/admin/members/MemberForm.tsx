import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DuplicateMemberError, createMember, getMember, periodEnd, todayIST, updateMember, validateMember,
  type Member, type MemberInput,
} from '@/lib/admin/members';
import { AdminShell, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { useLookups } from './lookups';
import Avatar from './Avatar';
import { uploadMemberPhoto, removeMemberPhoto, validatePhoto } from '@/lib/admin/photos';

const blank: MemberInput = { name: '', phone: '', email: '', planId: null, membershipStart: todayIST(), membershipEnd: null, status: 'active', trainerId: null, notes: '', emergencyName: '', emergencyPhone: '' };

/** Add or edit a member. Short on purpose: only what the front desk actually uses. */
const MemberForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const actor = useActor();
  const { plans, trainers } = useLookups();
  const [existing, setExisting] = useState<Member | null>(null);
  const [f, setF] = useState<MemberInput>(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const [dup, setDup] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);

  useEffect(() => {
    if (!id) return;
    getMember(id).then((m) => {
      if (!m) return;
      setExisting(m);
      setF({ name: m.name, phone: m.phone, email: m.email, planId: m.planId, membershipStart: m.membershipStart, membershipEnd: m.membershipEnd, status: m.status, trainerId: m.trainerId, notes: m.notes ?? '', emergencyName: m.emergencyName ?? '', emergencyPhone: m.emergencyPhone ?? '' });
    });
  }, [id]);

  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const choosePlan = (planId: string) => {
    const end = periodEnd(f.membershipStart ?? '', plans.get(planId)?.duration);
    setF((x) => ({ ...x, planId: planId || null, membershipEnd: end ?? x.membershipEnd }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateMember(f);
    setErrors(errs); setDup(null);
    if (errs.length) return;
    setBusy(true);
    try {
      const memberId = existing ? (await updateMember(existing, f, actor), existing.id) : await createMember(f, actor);
      // The photo goes up after the member is saved; if it fails, the member is still saved
      let photoNote = '';
      try {
        if (photo) await uploadMemberPhoto(memberId, photo, actor);
        else if (dropPhoto && existing?.photo) await removeMemberPhoto(memberId, actor);
      } catch (e) { photoNote = (e as Error).message; }
      navigate(`/admin/members/${memberId}${photoNote ? `?notice=${encodeURIComponent(photoNote)}` : ''}`);
    } catch (err) {
      if (err instanceof DuplicateMemberError) setDup(err.existing);
      else setErrors([`Couldn’t save: ${(err as Error).message}`]);
    } finally { setBusy(false); }
  };

  return (
    <AdminShell title={existing ? 'Edit member' : 'Add member'} nav="members" area="People" back={{ to: existing ? `/admin/members/${existing.id}` : '/admin/members', label: existing ? existing.name : 'Members' }}>
      <form onSubmit={submit} className="max-w-2xl space-y-6" noValidate>
        {errors.length > 0 && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{errors.map((e) => <p key={e}>{e}</p>)}</div>}
        {dup && (
          <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <strong>{dup.name}</strong> already has this phone number. <Link to={`/admin/members/${dup.id}`} className="font-semibold underline">Open their profile</Link> instead of adding them twice.
          </div>
        )}
        <div className="flex items-center gap-4">
          {preview ? <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" /> : <Avatar m={{ id: existing?.id ?? 'new', name: f.name || '?', photo: dropPhoto ? null : existing?.photo }} size={80} />}
          <div className="text-sm">
            <label className="inline-flex cursor-pointer items-center rounded-full border border-white/20 px-4 py-2 font-semibold text-white hover:border-white/40 focus-within:border-brand-400">
              {existing?.photo || photo ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Member photo"
                onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const bad = validatePhoto(file); if (bad) { setErrors([bad]); return; } setPhoto(file); setDropPhoto(false); }} />
            </label>
            {(photo || (existing?.photo && !dropPhoto)) && <button type="button" className="ml-3 text-xs text-ink-400 hover:text-white" onClick={() => { setPhoto(null); setDropPhoto(true); }}>Remove</button>}
            <p className="mt-2 text-xs text-ink-500">Private — only admins can see it. Optional.</p>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Full name" htmlFor="m-name"><input id="m-name" className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></Field>
          <Field label="Mobile number" htmlFor="m-phone"><input id="m-phone" className={inputCls} type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        </div>
        <Field label="Email" hint="Optional" htmlFor="m-email"><input id="m-email" className={inputCls} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Membership plan" htmlFor="m-plan">
            <select id="m-plan" className={inputCls} value={f.planId ?? ''} onChange={(e) => choosePlan(e.target.value)}>
              <option value="">No plan</option>
              {[...plans.values()].map((p) => <option key={p.id} value={p.id}>{p.duration}</option>)}
            </select>
          </Field>
          <Field label="Start date" htmlFor="m-start"><input id="m-start" type="date" className={inputCls} value={f.membershipStart ?? ''} onChange={(e) => set('membershipStart', e.target.value || null)} /></Field>
          <Field label="Expiry date" hint="Leave empty if none" htmlFor="m-end"><input id="m-end" type="date" className={inputCls} value={f.membershipEnd ?? ''} onChange={(e) => set('membershipEnd', e.target.value || null)} /></Field>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Trainer" hint="Optional" htmlFor="m-trainer">
            <select id="m-trainer" className={inputCls} value={f.trainerId ?? ''} onChange={(e) => set('trainerId', e.target.value || null)}>
              <option value="">No trainer</option>
              {[...trainers.values()].map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <div>
            <p className="text-sm font-semibold text-white">Status</p>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Status">
              {(['active', 'inactive'] as const).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={f.status === s} onClick={() => set('status', s)}
                  className={cn('h-12 flex-1 rounded-xl border text-sm font-semibold capitalize', f.status === s ? 'border-brand-400 bg-brand-400/10 text-white' : 'border-white/15 text-ink-400')}>{s}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Emergency contact" hint="Optional — name" htmlFor="m-em-name"><input id="m-em-name" className={inputCls} value={f.emergencyName ?? ''} onChange={(e) => set('emergencyName', e.target.value)} /></Field>
          <Field label="Emergency contact number" hint="Optional" htmlFor="m-em-phone"><input id="m-em-phone" className={inputCls} type="tel" inputMode="tel" value={f.emergencyPhone ?? ''} onChange={(e) => set('emergencyPhone', e.target.value)} /></Field>
        </div>
        <Field label="Notes" hint="Optional — visible to staff only" htmlFor="m-notes"><textarea id="m-notes" rows={3} className={cn(inputCls, 'h-auto py-3')} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <p className="text-xs text-ink-500">Adding a member doesn’t create a login. Client-portal logins are still created by the member’s trainer in the trainer portal.</p>
        <div className="flex gap-3 border-t border-white/[0.08] pt-6">
          <Button type="submit" size="lg" disabled={busy}>{busy ? 'Saving…' : existing ? 'Save changes' : 'Add member'}</Button>
          <Button asChild variant="ghost" size="lg"><Link to={existing ? `/admin/members/${existing.id}` : '/admin/members'}>Cancel</Link></Button>
        </div>
      </form>
    </AdminShell>
  );
};

export default MemberForm;
