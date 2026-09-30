import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, IdCard, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addDays, getMember, periodEnd, searchMembers, todayIST, type Member } from '@/lib/admin/members';
import { formatPhone } from '@/lib/admin/phone';
import { METHOD_LABEL, OTHER_CATEGORIES, PAYMENT_LABEL, RECORDABLE_METHODS, type OtherCategory, parsePrice, recordPayment, rupees, toPaise, validatePayment, type PaymentMethod, type PaymentType } from '@/lib/admin/payments';
import { Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate, useLookups } from '@/features/admin/members/lookups';
import { ptPackagesOf, ptPaid, type PtPackage } from '@/lib/admin/packages';

/** "membership payment" / "PT payment" / "other payment" — for use mid-sentence. */
const inSentence = (t: PaymentType) => (t === 'pt' ? PAYMENT_LABEL.pt : PAYMENT_LABEL[t].toLowerCase());

const TYPES: { t: PaymentType; title: string; sub: string; icon: ReactNode }[] = [
  { t: 'membership', title: 'Membership', sub: 'Gym membership — join or renew', icon: <IdCard size={20} /> },
  { t: 'pt', title: 'Personal training', sub: 'A PT package with a trainer', icon: <Dumbbell size={20} /> },
  { t: 'other', title: 'Other', sub: 'Locker, merchandise, fees…', icon: <ShoppingBag size={20} /> },
];
// Each type has its own colour in the confirmation line, so a PT payment never looks like a membership one
const TYPE_TONE: Record<PaymentType, string> = {
  membership: 'border-brand-400/30 bg-brand-400/[0.06] text-brand-100',
  pt: 'border-sky-300/30 bg-sky-300/[0.06] text-sky-100',
  other: 'border-white/15 bg-white/[0.03] text-ink-200',
};

export interface PaymentFormProps {
  initial: { memberId?: string | null; type?: PaymentType; packageId?: string | null };
  /** Single-column layout for side drawers */
  compact?: boolean;
  onSaved: (paymentId: string, summary: { type: PaymentType; amount: string; member: string }) => void;
  onCancel?: () => void;
}

/** Collect money. The amount is what staff actually took — the plan price is only a suggestion. */
const PaymentForm = ({ initial, compact, onSaved, onCancel }: PaymentFormProps) => {
  const grid2 = compact ? '' : 'sm:grid-cols-2';
  const grid3 = compact ? '' : 'sm:grid-cols-3';
  const actor = useActor();
  const { plans, trainers } = useLookups();
  // What the money is for: gym membership, personal training, or anything else (?type=pt from a PT link)
  const [paymentType, setPaymentType] = useState<PaymentType>(initial.type ?? 'membership');
  const [ptName, setPtName] = useState('');
  const [ptTrainer, setPtTrainer] = useState('');
  const [ptSessions, setPtSessions] = useState('');
  // Pay for an existing PT package (?package=<id> from the profile), or '' for a new one
  const [ptPackageId, setPtPackageId] = useState(initial.packageId ?? '');
  const [memberPt, setMemberPt] = useState<PtPackage[]>([]);
  const [otherCategory, setOtherCategory] = useState<OtherCategory | ''>('');
  const [otherDesc, setOtherDesc] = useState('');
  const ptEndTouched = useRef(false);
  const [member, setMember] = useState<Member | null>(null);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Member[]>([]);
  const [planId, setPlanId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(todayIST());
  // PT starts today by default (a PT link opens the form with the PT type already chosen)
  const [coversFrom, setCoversFrom] = useState(() => (initial.type === 'pt' ? todayIST() : ''));
  const [coversTo, setCoversTo] = useState('');
  const [notes, setNotes] = useState('');
  const [extend, setExtend] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // The member's PT packages, so a PT payment can go against one already set up
  useEffect(() => { if (member) ptPackagesOf(member.id).then(setMemberPt).catch(() => setMemberPt([])); else setMemberPt([]); }, [member]);
  // Arriving from a member profile or the dues list: ?member=<id>
  useEffect(() => { if (initial.memberId) getMember(initial.memberId).then((m) => m && choose(m)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (member || q.trim().length < 2) { setMatches([]); return; }
    const t = setTimeout(() => searchMembers(q).then(setMatches).catch(() => setMatches([])), 250);
    return () => clearTimeout(t);
  }, [q, member]);

  /** Period suggestion: from the day after their current expiry (or today), for the plan's length. */
  const suggest = (m: Member | null, pid: string) => {
    const plan = plans.get(pid);
    const today = todayIST();
    const from = m?.membershipEnd && m.membershipEnd >= today ? addDays(m.membershipEnd, 1) : today;
    setCoversFrom(from);
    setCoversTo(periodEnd(from, plan?.duration) ?? '');
    const price = parsePrice(plan?.price);
    // Never overwrite what staff typed: a late-arriving suggestion must not change a real amount
    if (price != null && !amountTouched.current) setAmount(String(Math.max(0, price - (Number(discount) || 0))));
  };
  const choose = (m: Member) => { setMember(m); setQ(''); };
  const choosePlan = (pid: string) => { setPlanId(pid); suggest(member, pid); };
  // Suggest once per chosen member, when both the member and the plans have loaded (either can
  // arrive first) — and never again for that member, so typed amounts aren't overwritten.
  const suggestedFor = useRef<string | null>(null);
  const amountTouched = useRef(false);
  useEffect(() => {
    if (paymentType !== 'membership' || !member || !plans.size || suggestedFor.current === member.id) return;
    suggestedFor.current = member.id;
    const pid = member.planId ?? '';
    setPlanId(pid);
    suggest(member, pid);
  }, [member, plans, paymentType]); // eslint-disable-line react-hooks/exhaustive-deps

  const amountRupees = Number(amount);
  const discountRupees = Number(discount) || 0;
  const planName = plans.get(planId)?.duration ?? '';
  const listPrice = paymentType === 'membership' && planId ? parsePrice(plans.get(planId)?.price) : null;
  const changeType = (t: PaymentType) => {
    setPaymentType(t);
    // A membership price must never be suggested for PT or other payments
    if (t !== 'membership' && !amountTouched.current) setAmount('');
    if (t === 'membership' && member) { suggestedFor.current = null; amountTouched.current = false; }
    if (t === 'other') { setCoversFrom(''); setCoversTo(''); }
    if (t === 'pt' && !coversFrom) setCoversFrom(todayIST());
  };
  const afterDiscount = listPrice != null ? Math.max(0, listPrice - discountRupees) : null;
  const changeDiscount = (v: string) => {
    const clean = v.replace(/[^\d.]/g, '');
    setDiscount(clean);
    if (listPrice != null && !amountTouched.current) setAmount(String(Math.max(0, listPrice - (Number(clean) || 0))));
  };
  const preview = useMemo(() => (Number.isFinite(amountRupees) && amountRupees > 0 ? rupees(toPaise(amountRupees)) : '—'), [amountRupees]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = {
      member, paymentType, planId: paymentType === 'membership' ? planId || null : null, planName: paymentType === 'membership' ? planName : '',
      pt: paymentType === 'pt' ? { packageId: ptPackageId || null, packageName: ptName, trainerId: ptTrainer || null, sessionsIncluded: ptSessions ? Number(ptSessions) : null } : undefined,
      other: paymentType === 'other' && otherCategory ? { category: otherCategory, description: otherDesc } : undefined,
      amountRupees, listPriceRupees: listPrice, discountRupees: paymentType === 'membership' ? discountRupees : 0, method, reference, paidOn,
      coversFrom: paymentType === 'other' ? null : coversFrom || null, coversTo: paymentType === 'other' ? null : coversTo || null, notes,
      extendMembership: paymentType === 'membership' && extend,
    };
    const errs = validatePayment(input);
    setErrors(errs);
    if (errs.length || !member) return;
    setSaving(true);
    try {
      const id = await recordPayment({ ...input, member }, actor);
      onSaved(id, { type: paymentType, amount: preview, member: member.name });
    } catch {
      setErrors(['Payment could not be saved. Please try again.']);
      setSaving(false);
    }
  };

  return (
      <form onSubmit={submit} className={cn('space-y-6', !compact && 'max-w-2xl')} noValidate aria-label="Collect payment">
        {errors.length > 0 && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{errors.map((x) => <p key={x}>{x}</p>)}</div>}

        {member ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-ink-900 p-4">
            <div>
              <p className="font-semibold text-white">{member.name}</p>
              <p className="text-sm text-ink-400">{formatPhone(member.phone)} · {member.membershipEnd ? `expires ${fmtDate(member.membershipEnd)}` : 'no expiry set'}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setMember(null); setAmount(''); suggestedFor.current = null; amountTouched.current = false; }}>Change</Button>
          </div>
        ) : (
          <Field label="Member" hint="Search by name or phone" htmlFor="pay-member">
            <input id="pay-member" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a name or number" autoComplete="off" />
            {matches.length > 0 && (
              <ul className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-ink-900" aria-label="Matching members">
                {matches.map((m) => (
                  <li key={m.id}><button type="button" onClick={() => choose(m)} className="flex w-full justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04]">
                    <span className="text-white">{m.name}</span><span className="text-sm tabular-nums text-ink-400">{formatPhone(m.phone)}</span>
                  </button></li>
                ))}
              </ul>
            )}
            {q.trim().length >= 2 && !matches.length && <p className="mt-2 text-xs text-ink-500">No member found. <Link to="/admin/members/new" className="underline">Add them first</Link>.</p>}
          </Field>
        )}

        <fieldset>
          <legend className="font-display text-xl font-bold uppercase tracking-wide text-white">What is this payment for?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Payment for">
            {TYPES.map(({ t, title, sub, icon }) => (
              <button key={t} type="button" role="radio" aria-checked={paymentType === t} onClick={() => changeType(t)}
                className={cn('flex items-start gap-3 rounded-xl border p-4 text-left transition-colors motion-reduce:transition-none', paymentType === t ? 'border-brand-400 bg-brand-400/[0.08]' : 'border-white/[0.1] hover:border-white/25')}>
                <span className={cn('mt-0.5', paymentType === t ? 'text-brand-fg' : 'text-ink-500')}>{icon}</span>
                <span><span className="block font-semibold text-white">{title}</span><span className="text-xs text-ink-400">{sub}</span></span>
              </button>
            ))}
          </div>
        </fieldset>

        {paymentType === 'pt' && memberPt.length > 0 && (
          <Field label="PT package" hint="Pay for a package already set up, or start a new one" htmlFor="pay-pt-pick">
            <select id="pay-pt-pick" className={inputCls} value={ptPackageId} onChange={(e) => setPtPackageId(e.target.value)}>
              <option value="">New PT package</option>
              {memberPt.map((x) => <option key={x.id} value={x.id}>{x.packageName} · {x.startDate ? `${fmtDate(x.startDate)} – ${fmtDate(x.endDate)}` : 'no dates'}{ptPaid(x) ? ' · already has a payment' : ' · not paid yet'}</option>)}
            </select>
          </Field>
        )}
        {paymentType === 'pt' && !ptPackageId && (
          <div className={`grid gap-6 ${grid3}`}>
            <Field label="Package name" hint="e.g. 1 Month PT" htmlFor="pay-pt-name"><input id="pay-pt-name" className={inputCls} value={ptName} onChange={(e) => {
              setPtName(e.target.value);
              // "1 Month PT" → suggest the end date from the start (never overwrites a typed date)
              const end = periodEnd(coversFrom || todayIST(), e.target.value);
              if (end && !ptEndTouched.current) setCoversTo(end);
            }} /></Field>
            <Field label="Trainer" hint="Optional" htmlFor="pay-pt-trainer">
              <select id="pay-pt-trainer" className={inputCls} value={ptTrainer} onChange={(e) => setPtTrainer(e.target.value)}>
                <option value="">Not set</option>
                {[...trainers.values()].map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Sessions" hint="Optional — only if agreed" htmlFor="pay-pt-sessions"><input id="pay-pt-sessions" className={inputCls} inputMode="numeric" value={ptSessions} onChange={(e) => setPtSessions(e.target.value.replace(/\D/g, ''))} /></Field>
          </div>
        )}

        {paymentType === 'other' && (
          <div className={`grid gap-6 ${grid2}`}>
            <Field label="Category" htmlFor="pay-other-cat">
              <select id="pay-other-cat" className={inputCls} value={otherCategory} onChange={(e) => setOtherCategory(e.target.value as OtherCategory)}>
                <option value="">Choose…</option>
                {OTHER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Description" hint={otherCategory === 'Other' ? 'Required' : 'Optional'} htmlFor="pay-other-desc"><input id="pay-other-desc" className={inputCls} value={otherDesc} onChange={(e) => setOtherDesc(e.target.value)} /></Field>
          </div>
        )}

        {paymentType === 'membership' && <div className={`grid gap-6 ${grid2}`}>
          <Field label="Plan" htmlFor="pay-plan">
            <select id="pay-plan" className={inputCls} value={planId} onChange={(e) => choosePlan(e.target.value)}>
              <option value="">No plan</option>
              {[...plans.values()].map((p) => <option key={p.id} value={p.id}>{p.duration}{p.price ? ` · ${p.price}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Discount (₹)" hint={listPrice != null ? `Plan price ${rupees(toPaise(listPrice))} — the plan’s price itself isn’t changed` : 'Optional'} htmlFor="pay-discount">
            <input id="pay-discount" className={inputCls} inputMode="decimal" value={discount} onChange={(e) => changeDiscount(e.target.value)} placeholder="0" />
          </Field>
        </div>}
        <Field label="Amount received (₹)" hint={paymentType === 'membership' ? 'What the member actually paid — pre-filled from the plan price minus any discount' : 'What the member actually paid'} htmlFor="pay-amount">
          <input id="pay-amount" className={cn(inputCls, 'text-2xl font-bold tabular-nums')} inputMode="decimal" value={amount} onChange={(e) => { amountTouched.current = true; setAmount(e.target.value.replace(/[^\d.]/g, '')); }} />
          {afterDiscount != null && amountRupees > 0 && amountRupees < afterDiscount && (
            <p className="mt-2 text-xs text-amber-200">{rupees(toPaise(afterDiscount - amountRupees))} less than the price after discount. Balances aren’t tracked yet — add a note, and record the rest as another payment when it’s paid.</p>
          )}
        </Field>
        <div className={`grid gap-6 ${grid3}`}>
          <Field label="Method" htmlFor="pay-method">
            <select id="pay-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {RECORDABLE_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
          <Field label="Reference" hint={method === 'cash' ? 'Optional' : 'UPI / card / transfer ID'} htmlFor="pay-ref"><input id="pay-ref" className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Received on" htmlFor="pay-date"><input id="pay-date" type="date" className={inputCls} value={paidOn} max={todayIST()} onChange={(e) => setPaidOn(e.target.value)} /></Field>
        </div>
        {paymentType !== 'other' && !(paymentType === 'pt' && ptPackageId) && <div className={`grid gap-6 ${grid2}`}>
          <Field label={paymentType === 'pt' ? 'PT starts' : 'Covers from'} hint="Optional" htmlFor="pay-from"><input id="pay-from" type="date" className={inputCls} value={coversFrom} onChange={(e) => setCoversFrom(e.target.value)} /></Field>
          <Field label={paymentType === 'pt' ? 'PT ends' : 'Covers until'} hint="Optional" htmlFor="pay-to"><input id="pay-to" type="date" className={inputCls} value={coversTo} onChange={(e) => { ptEndTouched.current = true; setCoversTo(e.target.value); }} /></Field>
        </div>}
        {paymentType === 'pt' && <p className="-mt-3 text-xs text-ink-500">Personal training doesn’t change the gym membership or door access.</p>}
        {paymentType === 'membership' && <label className={cn('flex items-start gap-3 rounded-xl border p-4', extend && coversTo ? 'border-brand-400/40 bg-brand-400/[0.05]' : 'border-white/15')}>
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#b0d43f]" checked={extend} onChange={(e) => setExtend(e.target.checked)} />
          <span><span className="block font-semibold text-white">Extend membership{coversTo ? ` to ${fmtDate(coversTo)}` : ''}</span>
            <span className="text-sm text-ink-400">Updates the member’s plan and expiry date in the same save.</span></span>
        </label>}
        <Field label="Notes" hint="Optional" htmlFor="pay-notes"><input id="pay-notes" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

        {member && (
          <p className={cn('rounded-xl border px-4 py-3 text-sm', TYPE_TONE[paymentType])} aria-live="polite">
            This is a <strong>{inSentence(paymentType)}</strong> from {member.name}{paymentType === 'membership' && extend && coversTo ? `, extending the membership to ${fmtDate(coversTo)}` : paymentType === 'pt' ? ' — it doesn’t change the gym membership' : ''}.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-6">
          <Button type="submit" size="lg" disabled={saving}>{saving ? 'Saving…' : `Collect ${inSentence(paymentType)} · ${preview}`}</Button>
          {onCancel ? <Button type="button" variant="ghost" size="lg" onClick={onCancel}>Cancel</Button> : <Button asChild variant="ghost" size="lg"><Link to="/admin/payments">Cancel</Link></Button>}
          <p className="text-xs text-ink-500">A receipt number is issued when you collect.</p>
        </div>
      </form>
  );
};

export default PaymentForm;
