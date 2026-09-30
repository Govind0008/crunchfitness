import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Dumbbell, Fingerprint, IndianRupee, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DuplicateMemberError, createMember, getMember, periodEnd, todayIST, validateMember, type Member, type MemberInput } from '@/lib/admin/members';
import { uploadMemberPhoto, validatePhoto } from '@/lib/admin/photos';
import { Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import PaymentForm from '@/features/admin/payments/PaymentForm';
import { SideDrawer } from '../kit';
import { useLookups } from './lookups';
import Avatar from './Avatar';
import PtPackageForm from './PtPackageForm';
import EnrollWizard from './EnrollWizard';

const blank = (): MemberInput => ({ name: '', phone: '', email: '', planId: null, membershipStart: todayIST(), membershipEnd: null, status: 'active', trainerId: null, notes: '', emergencyName: '', emergencyPhone: '' });

/** A form section; optional ones start folded so the essentials fit on one screen. */
const Section = ({ n, title, hint, open, onToggle, children }: { n: number; title: string; hint?: string; open?: boolean; onToggle?: () => void; children: ReactNode }) => (
  <fieldset className="border-t border-white/[0.08] pt-5 first:border-t-0 first:pt-0">
    {onToggle ? (
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-ink-300" aria-hidden>{n}</span>
        <span className="flex-1"><legend className="font-sans text-sm font-bold text-white">{title}</legend>{hint && <span className="block text-xs text-ink-500">{hint}</span>}</span>
        <ChevronDown size={16} className={cn('text-ink-400 transition-transform motion-reduce:transition-none', !open && '-rotate-90')} aria-hidden />
      </button>
    ) : (
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-400 text-xs font-bold text-on-brand" aria-hidden>{n}</span>
        <legend className="font-sans text-sm font-bold text-white">{title}</legend>
      </div>
    )}
    {(open ?? true) && <div className="mt-4 space-y-4">{children}</div>}
  </fieldset>
);

type Step = 'form' | 'done' | 'pay' | 'pt' | 'access';

/**
 * Add member without leaving the page: essentials first, the rest folded away, then the
 * natural next step (payment, PT, fingerprint) in the same drawer.
 */
const AddMemberDrawer = ({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded?: (m: Member) => void }) => {
  const actor = useActor();
  const navigate = useNavigate();
  const { plans, trainers } = useLookups();
  const [f, setF] = useState<MemberInput>(blank);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dup, setDup] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState({ pt: false, contact: false, access: false });
  const [wantPt, setWantPt] = useState(false);
  const [wantAccess, setWantAccess] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [saved, setSaved] = useState<Member | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // A fresh form each time the drawer opens
  useEffect(() => {
    if (!open) return;
    setF(blank()); setPhoto(null); setErrors([]); setDup(null); setStep('form'); setSaved(null); setNote(null);
    setMore({ pt: false, contact: false, access: false }); setWantPt(false); setWantAccess(false);
  }, [open]);

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
      const id = await createMember(f, actor);
      try { if (photo) await uploadMemberPhoto(id, photo, actor); } catch (err) { setNote(`Member saved, but the photo didn’t upload: ${(err as Error).message}`); }
      const m = await getMember(id);
      if (m) { setSaved(m); onAdded?.(m); }
      setStep(wantPt ? 'pt' : wantAccess ? 'access' : 'done');
    } catch (err) {
      if (err instanceof DuplicateMemberError) setDup(err.existing);
      else setErrors([`Couldn’t save: ${(err as Error).message}`]);
    } finally { setBusy(false); }
  };

  const title = step === 'form' ? 'Add member' : step === 'pay' ? 'Collect payment' : step === 'pt' ? 'Add PT package' : step === 'access' ? 'Enroll access' : 'Member added';
  const planPrice = f.planId ? plans.get(f.planId)?.price : undefined;

  return (
    <SideDrawer open={open} onOpenChange={onOpenChange} title={title} description={saved ? saved.name : 'Name and number are all you need — everything else can wait'}>
      {step === 'form' && (
        <form onSubmit={submit} className="space-y-5" noValidate aria-label="New member">
          {errors.length > 0 && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{errors.map((x) => <p key={x}>{x}</p>)}</div>}
          {dup && (
            <div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              <strong>{dup.name}</strong> already has this phone number. <Link to={`/admin/members/${dup.id}`} onClick={() => onOpenChange(false)} className="font-semibold underline">Open their profile</Link> instead of adding them twice.
            </div>
          )}

          <Section n={1} title="Basic details">
            <div className="flex items-center gap-4">
              {preview ? <img src={preview} alt="" className="h-16 w-16 rounded-full object-cover" /> : <Avatar m={{ id: 'new', name: f.name || '?', photo: null }} size={64} />}
              <label className="inline-flex cursor-pointer items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white/40 focus-within:border-brand-400">
                {photo ? 'Change photo' : 'Add photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Member photo"
                  onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const bad = validatePhoto(file); if (bad) { setErrors([bad]); return; } setPhoto(file); }} />
              </label>
              <span className="text-xs text-ink-500">Optional · admins only</span>
            </div>
            <Field label="Full name" htmlFor="am-name"><input id="am-name" className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" /></Field>
            <Field label="Mobile number" htmlFor="am-phone"><input id="am-phone" className={inputCls} type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          </Section>

          <Section n={2} title="Membership">
            <Field label="Plan" hint={planPrice ? `Current price ${planPrice}` : 'Pick one to fill in the expiry date'} htmlFor="am-plan">
              <select id="am-plan" className={inputCls} value={f.planId ?? ''} onChange={(e) => choosePlan(e.target.value)}>
                <option value="">No plan yet</option>
                {[...plans.values()].map((p) => <option key={p.id} value={p.id}>{p.duration}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts" htmlFor="am-start"><input id="am-start" type="date" className={inputCls} value={f.membershipStart ?? ''} onChange={(e) => set('membershipStart', e.target.value || null)} /></Field>
              <Field label="Expires" hint="Leave empty if none" htmlFor="am-end"><input id="am-end" type="date" className={inputCls} value={f.membershipEnd ?? ''} onChange={(e) => set('membershipEnd', e.target.value || null)} /></Field>
            </div>
          </Section>

          <Section n={3} title="Personal training" hint="Optional — trainer and PT package" open={more.pt} onToggle={() => setMore({ ...more, pt: !more.pt })}>
            <Field label="Trainer" hint="Optional" htmlFor="am-trainer">
              <select id="am-trainer" className={inputCls} value={f.trainerId ?? ''} onChange={(e) => set('trainerId', e.target.value || null)}>
                <option value="">No trainer</option>
                {[...trainers.values()].map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={wantPt} onChange={(e) => setWantPt(e.target.checked)} /> Add a PT package straight after saving</label>
          </Section>

          <Section n={4} title="Contact" hint="Optional — email, emergency contact, notes" open={more.contact} onToggle={() => setMore({ ...more, contact: !more.contact })}>
            <Field label="Email" hint="Optional" htmlFor="am-email"><input id="am-email" className={inputCls} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Emergency contact" hint="Name" htmlFor="am-em-name"><input id="am-em-name" className={inputCls} value={f.emergencyName ?? ''} onChange={(e) => set('emergencyName', e.target.value)} /></Field>
              <Field label="Emergency number" htmlFor="am-em-phone"><input id="am-em-phone" className={inputCls} type="tel" inputMode="tel" value={f.emergencyPhone ?? ''} onChange={(e) => set('emergencyPhone', e.target.value)} /></Field>
            </div>
            <Field label="Notes" hint="Staff only" htmlFor="am-notes"><textarea id="am-notes" rows={3} className={cn(inputCls, 'h-auto py-3')} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          </Section>

          <Section n={5} title="Access" hint="Optional — fingerprint enrolment" open={more.access} onToggle={() => setMore({ ...more, access: !more.access })}>
            <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={wantAccess} onChange={(e) => setWantAccess(e.target.checked)} /> Enroll their fingerprint after saving</label>
            <p className="text-xs text-ink-500">Access follows the membership: an active plan lets them in, an expired one doesn’t.</p>
          </Section>

          <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-white/[0.08] bg-ink-950 px-6 py-4">
            <Button type="submit" size="lg" disabled={busy}><UserPlus /> {busy ? 'Saving…' : 'Add member'}</Button>
            <Button type="button" size="lg" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {step === 'done' && saved && (
        <div role="status" className="space-y-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-brand-fg" aria-hidden />
            <p className="mt-3 font-display text-3xl font-bold uppercase text-white">{saved.name} is added</p>
            <p className="mt-1 text-sm text-ink-300">{saved.membershipEnd ? `Membership until ${saved.membershipEnd.split('-').reverse().join('/')}` : 'No membership dates yet'}</p>
            {note && <p className="mt-2 text-xs text-amber-200">{note}</p>}
          </div>
          <div className="grid gap-2">
            <Button size="lg" onClick={() => setStep('pay')}><IndianRupee /> Collect payment</Button>
            <Button size="lg" variant="outline" onClick={() => setStep('access')}><Fingerprint /> Enroll access</Button>
            <Button size="lg" variant="outline" onClick={() => setStep('pt')}><Dumbbell /> Add PT package</Button>
          </div>
          <div className="flex justify-center gap-4 text-sm">
            <button type="button" className="font-semibold text-ink-300 hover:text-white" onClick={() => { onOpenChange(false); navigate(`/admin/members/${saved.id}`); }}>Open profile</button>
            <button type="button" className="font-semibold text-ink-300 hover:text-white" onClick={() => { setF(blank()); setPhoto(null); setSaved(null); setStep('form'); }}>Add another</button>
          </div>
        </div>
      )}
      {step === 'pay' && saved && (
        <PaymentForm compact initial={{ memberId: saved.id, type: 'membership' }} onCancel={() => setStep('done')}
          onSaved={(pid) => { onOpenChange(false); navigate(`/admin/payments/${pid}?new=1`); }} />
      )}
      {step === 'pt' && saved && (
        <PtPackageForm m={saved} trainers={trainers} onCancel={() => setStep('done')} onSaved={() => setStep(wantAccess ? 'access' : 'done')} />
      )}
      {step === 'access' && saved && (
        <div className="space-y-4">
          <EnrollWizard m={saved} existing={[]} onDone={() => {}} />
          <Button variant="ghost" onClick={() => setStep('done')}>Back</Button>
        </div>
      )}
    </SideDrawer>
  );
};

export default AddMemberDrawer;
