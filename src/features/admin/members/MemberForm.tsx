import { useEffect, useState, type FormEvent } from 'react';
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

const blank: MemberInput = { name: '', phone: '', email: '', planId: null, membershipStart: todayIST(), membershipEnd: null, status: 'active', trainerId: null, notes: '' };

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

  useEffect(() => {
    if (!id) return;
    getMember(id).then((m) => {
      if (!m) return;
      setExisting(m);
      setF({ name: m.name, phone: m.phone, email: m.email, planId: m.planId, membershipStart: m.membershipStart, membershipEnd: m.membershipEnd, status: m.status, trainerId: m.trainerId, notes: m.notes ?? '' });
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
      if (existing) { await updateMember(existing, f, actor); navigate(`/admin/members/${existing.id}`); }
      else navigate(`/admin/members/${await createMember(f, actor)}`);
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
