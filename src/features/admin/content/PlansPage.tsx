import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMPTY_PLAN, GRADIENTS, PLAN_ICONS, deletePlan, savePlan, watchPlans, type Plan, type PlanInput } from '@/lib/admin/content';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { EmptyNote, ErrorNote, ListBox, Pill, SideDrawer, SkeletonRows } from '../kit';
import { useOpenFromParam } from '../useOpenFromParam';

/** Plans — the memberships sold at the gym and shown on the website’s Plans page. */
const PlansPage = () => {
  const actor = useActor();
  const [rows, setRows] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [f, setF] = useState<PlanInput>(EMPTY_PLAN);
  const [more, setMore] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => watchPlans(setRows, (e) => setError(e.message)), []);

  const openForm = (p: Plan | 'new') => {
    setEditing(p); setFormErr(null); setMore(false);
    setF(p === 'new' ? { ...EMPTY_PLAN, order: rows?.length ?? 0 } : { order: p.order, duration: p.duration, price: p.price, originalPrice: p.originalPrice || '', description: p.description, features: (p.features ?? []).join('\n'), idealFor: p.idealFor, savings: p.savings || '', badge: p.badge, isPopular: p.isPopular, gradient: p.gradient, iconName: p.iconName, ctaText: p.ctaText });
  };
  useOpenFromParam(() => openForm('new'));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.duration.trim() || !f.price.trim()) { setFormErr('A plan needs a name (its length, e.g. “3 Months”) and a price.'); return; }
    setBusy(true); setFormErr(null);
    try { await savePlan(f, actor, editing && editing !== 'new' ? editing.id : undefined); setEditing(null); }
    catch { setFormErr('The plan couldn’t be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  const set = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <AdminShell title="Plans" nav="plans" area="More" subtitle={rows ? `${rows.length} membership plan${rows.length === 1 ? '' : 's'} on the website` : '…'}
      actions={<Button onClick={() => openForm('new')}><Plus /> Add plan</Button>}>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load plans." error={error} /></div>}
      <p className="-mt-2 mb-5 text-sm text-ink-400">Prices here are what the website shows and what Collect payment suggests. A discount on one payment never changes a plan’s price.</p>
      {!rows ? <SkeletonRows rows={4} /> : rows.length === 0 ? (
        <EmptyNote title="No plans" body="Add the memberships you sell."><Button onClick={() => openForm('new')}><Plus /> Add plan</Button></EmptyNote>
      ) : (
        <ListBox label="Plans">
          {rows.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => openForm(p)} aria-label={`Edit ${p.duration}`} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-4 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto_auto]">
                <span className="min-w-0"><span className="block font-display text-2xl font-bold uppercase leading-none text-white">{p.duration}</span>{p.badge && <span className="mt-1 block text-xs text-ink-400">{p.badge}</span>}</span>
                <span className="order-last col-span-2 truncate text-sm text-ink-400 md:order-none md:col-span-1">{p.description || `${(p.features ?? []).length} feature${(p.features ?? []).length === 1 ? '' : 's'} listed`}</span>
                <span className="text-right"><span className="block font-display text-2xl font-bold tabular-nums text-white">{p.price}</span>{p.originalPrice && <span className="text-xs text-ink-500 line-through">{p.originalPrice}</span>}</span>
                <span className="hidden md:block">{p.isPopular ? <Pill tone="ok">Most popular</Pill> : <Pill tone="muted">On website</Pill>}</span>
              </button>
            </li>
          ))}
        </ListBox>
      )}

      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Add plan' : 'Edit plan'} description="Shown on the website’s Plans page">
        <form onSubmit={save} className="space-y-5" noValidate aria-label="Plan details">
          {formErr && <p role="alert" className="text-sm text-red-300">{formErr}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan" hint="Its length, e.g. 3 Months" htmlFor="pl-duration"><input id="pl-duration" className={inputCls} value={f.duration} onChange={(e) => set('duration', e.target.value)} /></Field>
            <Field label="Price" hint="As shown, e.g. ₹6,500" htmlFor="pl-price"><input id="pl-price" className={inputCls} value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
          </div>
          <Field label="One-line description" hint="Optional" htmlFor="pl-desc"><input id="pl-desc" className={inputCls} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="What’s included" hint="One per line" htmlFor="pl-features"><textarea id="pl-features" rows={5} className={cn(inputCls, 'h-auto py-3')} value={f.features} onChange={(e) => set('features', e.target.value)} /></Field>
          <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={f.isPopular} onChange={(e) => set('isPopular', e.target.checked)} /> Highlight as “Most popular”</label>
          <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-2 text-sm font-semibold text-ink-300 hover:text-white"><ChevronDown size={16} className={cn('transition-transform', !more && '-rotate-90')} aria-hidden /> More website details</button>
          {more && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Was (crossed-out price)" hint="Optional" htmlFor="pl-orig"><input id="pl-orig" className={inputCls} value={f.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} /></Field>
              <Field label="Savings text" hint="Optional" htmlFor="pl-save"><input id="pl-save" className={inputCls} value={f.savings} onChange={(e) => set('savings', e.target.value)} /></Field>
              <Field label="Badge" hint="Optional, e.g. Best Value" htmlFor="pl-badge"><input id="pl-badge" className={inputCls} value={f.badge} onChange={(e) => set('badge', e.target.value)} /></Field>
              <Field label="Ideal for" hint="Optional" htmlFor="pl-ideal"><input id="pl-ideal" className={inputCls} value={f.idealFor} onChange={(e) => set('idealFor', e.target.value)} /></Field>
              <Field label="Button text" htmlFor="pl-cta"><input id="pl-cta" className={inputCls} value={f.ctaText} onChange={(e) => set('ctaText', e.target.value)} /></Field>
              <Field label="Order on the page" htmlFor="pl-order"><input id="pl-order" type="number" className={inputCls} value={f.order} onChange={(e) => set('order', Number(e.target.value))} /></Field>
              <Field label="Icon" htmlFor="pl-icon"><select id="pl-icon" className={inputCls} value={f.iconName} onChange={(e) => set('iconName', e.target.value)}>{PLAN_ICONS.map((i) => <option key={i}>{i}</option>)}</select></Field>
              <Field label="Card colour" htmlFor="pl-grad"><select id="pl-grad" className={inputCls} value={f.gradient} onChange={(e) => set('gradient', e.target.value)}>{GRADIENTS.map((g) => <option key={g} value={g}>{g.replace('from-', '').replace(' to-', ' → ').replace(/-\d+/g, '')}</option>)}</select></Field>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
            <Button type="submit" loading={busy} loadingText="Saving…">{editing === 'new' ? 'Add plan' : 'Save plan'}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {editing && editing !== 'new' && <ConfirmButton size="default" variant="secondary" className="ml-auto" confirm={{ title: `Delete the ${editing.duration} plan?`, body: 'It disappears from the website. Members already on it keep their dates; their plan shows as “no longer exists”.' }} onConfirm={async () => { await deletePlan(editing, actor); setEditing(null); }}><Trash2 /><span className="sr-only">Delete plan</span></ConfirmButton>}
          </div>
        </form>
      </SideDrawer>
    </AdminShell>
  );
};

export default PlansPage;
