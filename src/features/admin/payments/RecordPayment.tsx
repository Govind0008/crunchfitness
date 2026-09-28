import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { addDays, getMember, periodEnd, searchMembers, todayIST, type Member } from '@/lib/admin/members';
import { formatPhone } from '@/lib/admin/phone';
import { METHOD_LABEL, parsePrice, recordPayment, rupees, toPaise, validatePayment, type PaymentMethod } from '@/lib/admin/payments';
import { AdminShell, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate, useLookups } from '@/features/admin/members/lookups';

/** Record money received. Amount is what staff actually took — the plan price is only a suggestion. */
const RecordPayment = () => {
  const navigate = useNavigate();
  const actor = useActor();
  const [params] = useSearchParams();
  const { plans } = useLookups();
  const [member, setMember] = useState<Member | null>(null);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Member[]>([]);
  const [planId, setPlanId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(todayIST());
  const [coversFrom, setCoversFrom] = useState('');
  const [coversTo, setCoversTo] = useState('');
  const [notes, setNotes] = useState('');
  const [extend, setExtend] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Arriving from a member profile or the dues list: ?member=<id>
  useEffect(() => { const id = params.get('member'); if (id) getMember(id).then((m) => m && choose(m)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (!member || !plans.size || suggestedFor.current === member.id) return;
    suggestedFor.current = member.id;
    const pid = member.planId ?? '';
    setPlanId(pid);
    suggest(member, pid);
  }, [member, plans]); // eslint-disable-line react-hooks/exhaustive-deps

  const amountRupees = Number(amount);
  const discountRupees = Number(discount) || 0;
  const planName = plans.get(planId)?.duration ?? '';
  const listPrice = planId ? parsePrice(plans.get(planId)?.price) : null;
  const afterDiscount = listPrice != null ? Math.max(0, listPrice - discountRupees) : null;
  const changeDiscount = (v: string) => {
    const clean = v.replace(/[^\d.]/g, '');
    setDiscount(clean);
    if (listPrice != null && !amountTouched.current) setAmount(String(Math.max(0, listPrice - (Number(clean) || 0))));
  };
  const preview = useMemo(() => (Number.isFinite(amountRupees) && amountRupees > 0 ? rupees(toPaise(amountRupees)) : '—'), [amountRupees]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = { member, planId: planId || null, planName, amountRupees, listPriceRupees: listPrice, discountRupees, method, reference, paidOn, coversFrom: coversFrom || null, coversTo: coversTo || null, notes, extendMembership: extend };
    const errs = validatePayment(input);
    setErrors(errs);
    if (errs.length || !member) return;
    setSaving(true);
    try {
      const id = await recordPayment({ ...input, member }, actor);
      navigate(`/admin/payments/${id}?new=1`);
    } catch {
      setErrors(['Payment could not be saved. Please try again.']);
      setSaving(false);
    }
  };

  return (
    <AdminShell title="Record payment" nav="payments" area="Money" back={{ to: member ? `/admin/members/${member.id}` : '/admin/payments', label: member ? member.name : 'Payments' }}>
      <form onSubmit={submit} className="max-w-2xl space-y-6" noValidate>
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

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Plan" htmlFor="pay-plan">
            <select id="pay-plan" className={inputCls} value={planId} onChange={(e) => choosePlan(e.target.value)}>
              <option value="">No plan (other payment)</option>
              {[...plans.values()].map((p) => <option key={p.id} value={p.id}>{p.duration}{p.price ? ` · ${p.price}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Discount (₹)" hint={listPrice != null ? `Plan price ${rupees(toPaise(listPrice))} — the plan’s price itself isn’t changed` : 'Optional'} htmlFor="pay-discount">
            <input id="pay-discount" className={inputCls} inputMode="decimal" value={discount} onChange={(e) => changeDiscount(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field label="Amount received (₹)" hint="What the member actually paid — pre-filled from the plan price minus any discount" htmlFor="pay-amount">
          <input id="pay-amount" className={cn(inputCls, 'text-2xl font-bold tabular-nums')} inputMode="decimal" value={amount} onChange={(e) => { amountTouched.current = true; setAmount(e.target.value.replace(/[^\d.]/g, '')); }} />
          {afterDiscount != null && amountRupees > 0 && amountRupees < afterDiscount && (
            <p className="mt-2 text-xs text-amber-200">{rupees(toPaise(afterDiscount - amountRupees))} less than the price after discount. Balances aren’t tracked yet — add a note, and record the rest as another payment when it’s paid.</p>
          )}
        </Field>
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Method" htmlFor="pay-method">
            <select id="pay-method" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </Field>
          <Field label="Reference" hint={method === 'cash' ? 'Optional' : 'UPI / card / transfer ID'} htmlFor="pay-ref"><input id="pay-ref" className={inputCls} value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Received on" htmlFor="pay-date"><input id="pay-date" type="date" className={inputCls} value={paidOn} max={todayIST()} onChange={(e) => setPaidOn(e.target.value)} /></Field>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Covers from" hint="Optional" htmlFor="pay-from"><input id="pay-from" type="date" className={inputCls} value={coversFrom} onChange={(e) => setCoversFrom(e.target.value)} /></Field>
          <Field label="Covers until" hint="Optional" htmlFor="pay-to"><input id="pay-to" type="date" className={inputCls} value={coversTo} onChange={(e) => setCoversTo(e.target.value)} /></Field>
        </div>
        <label className={cn('flex items-start gap-3 rounded-xl border p-4', extend && coversTo ? 'border-brand-400/40 bg-brand-400/[0.05]' : 'border-white/15')}>
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#b0d43f]" checked={extend} onChange={(e) => setExtend(e.target.checked)} />
          <span><span className="block font-semibold text-white">Extend membership{coversTo ? ` to ${fmtDate(coversTo)}` : ''}</span>
            <span className="text-sm text-ink-400">Updates the member’s plan and expiry date in the same save.</span></span>
        </label>
        <Field label="Notes" hint="Optional" htmlFor="pay-notes"><input id="pay-notes" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

        <div className="flex flex-wrap items-center gap-4 border-t border-white/[0.08] pt-6">
          <Button type="submit" size="lg" disabled={saving}>{saving ? 'Saving payment…' : `Save payment · ${preview}`}</Button>
          <Button asChild variant="ghost" size="lg"><Link to="/admin/payments">Cancel</Link></Button>
          <p className="text-xs text-ink-500">A receipt number is issued when you save.</p>
        </div>
      </form>
    </AdminShell>
  );
};

export default RecordPayment;
