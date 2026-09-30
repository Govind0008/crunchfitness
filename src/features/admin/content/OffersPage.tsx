import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { todayIST } from '@/lib/admin/members';
import { OFFER_COLORS, OFFER_SWATCH, deleteOffer, offerStatus, saveOffer, setOfferActive, watchOffers, type Offer, type OfferInput, type OfferStatus } from '@/lib/admin/content';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate } from '@/features/admin/members/lookups';
import { EmptyNote, ErrorNote, ListBox, ListToolbar, Pill, SideDrawer, SkeletonRows, type Tone } from '../kit';
import { useOpenFromParam } from '../useOpenFromParam';

const LABEL: Record<OfferStatus, string> = { active: 'Active', scheduled: 'Scheduled', expired: 'Expired', draft: 'Draft' };
const TONE: Record<OfferStatus, Tone> = { active: 'ok', scheduled: 'info', expired: 'muted', draft: 'muted' };
const blank = (): OfferInput => ({ title: '', description: '', badge: '🔥 LIMITED TIME', color: 'green', startDate: todayIST(), endDate: todayIST(), active: true });

/** Offers — the promotions shown on the website banner. Banner text only; prices live in Plans. */
const OffersPage = () => {
  const actor = useActor();
  const today = todayIST();
  const [rows, setRows] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | OfferStatus>('all');
  const [editing, setEditing] = useState<Offer | 'new' | null>(null);
  const [f, setF] = useState<OfferInput>(blank);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => watchOffers(setRows, (e) => setError(e.message)), []);

  const count = (s: OfferStatus) => (rows ?? []).filter((o) => offerStatus(o, today) === s).length;
  const shown = useMemo(() => (rows ?? []).filter((o) => (filter === 'all' || offerStatus(o, today) === filter) && (!q.trim() || o.title.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.startDate.localeCompare(a.startDate)), [rows, filter, q, today]);
  const openForm = (o: Offer | 'new') => { setEditing(o); setFormErr(null); setF(o === 'new' ? blank() : { title: o.title, description: o.description, badge: o.badge, color: o.color, startDate: o.startDate, endDate: o.endDate, active: o.active }); };
  useOpenFromParam(() => openForm('new'));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) { setFormErr('Give the offer a headline.'); return; }
    if (f.endDate < f.startDate) { setFormErr('The end date must be after the start date.'); return; }
    setBusy(true); setFormErr(null);
    try { await saveOffer(f, actor, editing && editing !== 'new' ? editing.id : undefined); setEditing(null); }
    catch { setFormErr('The offer couldn’t be saved. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title="Offers" nav="offers" area="Growth" subtitle={rows ? `${count('active')} showing on the website now` : '…'}
      actions={<Button onClick={() => openForm('new')}><Plus /> Create offer</Button>}>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load offers." error={error} /></div>}
      <ListToolbar search={q} onSearch={setQ} placeholder="Search offers" label="Filter offers" value={filter} onChange={(k) => setFilter(k as typeof filter)}
        segments={[{ id: 'all', label: 'All', count: rows?.length }, { id: 'active', label: 'Active', count: rows ? count('active') : undefined }, { id: 'scheduled', label: 'Scheduled', count: rows ? count('scheduled') : undefined }, { id: 'draft', label: 'Draft', count: rows ? count('draft') : undefined }, { id: 'expired', label: 'Expired', count: rows ? count('expired') : undefined }]} />
      {!rows ? <SkeletonRows rows={4} /> : shown.length === 0 ? (
        rows.length === 0 ? <EmptyNote title="No offers" body="Create your first offer for members."><Button onClick={() => openForm('new')}><Plus /> Create offer</Button></EmptyNote>
          : <EmptyNote title="Nothing here" body="No offers match this filter." />
      ) : (
        <ListBox label="Offers">
          {shown.map((o) => {
            const st = offerStatus(o, today);
            return (
              <li key={o.id}>
                <button type="button" onClick={() => openForm(o)} aria-label={`Edit ${o.title}`} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1fr)_auto]">
                  <span className={cn('h-9 w-1.5 rounded-full', OFFER_SWATCH[o.color] ?? 'bg-brand-400')} aria-hidden />
                  <span className="min-w-0"><span className="block truncate font-semibold text-white">{o.title}</span><span className="block truncate text-xs text-ink-400">{o.badge ? `${o.badge} · ` : ''}{o.description}</span></span>
                  <span className="hidden text-sm text-ink-300 md:block">{fmtDate(o.startDate)} – {fmtDate(o.endDate)}</span>
                  <Pill tone={TONE[st]}>{LABEL[st]}</Pill>
                </button>
              </li>
            );
          })}
        </ListBox>
      )}

      <SideDrawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === 'new' ? 'Create offer' : 'Edit offer'} description="Shown in the banner at the top of the website">
        <form onSubmit={save} className="space-y-5" noValidate aria-label="Offer">
          {formErr && <p role="alert" className="text-sm text-red-300">{formErr}</p>}
          <Field label="Headline" htmlFor="of-title"><input id="of-title" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Monsoon offer: 20% off 6 months" /></Field>
          <Field label="Details" hint="Optional" htmlFor="of-desc"><textarea id="of-desc" rows={3} className={cn(inputCls, 'h-auto py-3')} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="of-start"><input id="of-start" type="date" className={inputCls} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Ends" htmlFor="of-end"><input id="of-end" type="date" className={inputCls} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          </div>
          <Field label="Badge" hint="Short tag, e.g. 🔥 LIMITED TIME" htmlFor="of-badge"><input id="of-badge" className={inputCls} value={f.badge} onChange={(e) => setF({ ...f, badge: e.target.value })} /></Field>
          <fieldset><legend className="text-sm font-semibold text-white">Colour</legend>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Colour">
              {OFFER_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })} className={cn('h-9 w-9 rounded-full ring-offset-2 ring-offset-ink-950', OFFER_SWATCH[c], f.color === c && 'ring-2 ring-white')} />)}
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Show on the website between these dates (untick to keep it as a draft)</label>
          <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-5">
            <Button type="submit" loading={busy} loadingText="Saving…">{editing === 'new' ? 'Create offer' : 'Save offer'}</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            {editing && editing !== 'new' && <>
              <Button type="button" variant="outline" className="ml-auto" onClick={async () => { await setOfferActive(editing, !editing.active); setEditing(null); }}>{editing.active ? 'Switch off' : 'Switch on'}</Button>
              <ConfirmButton size="default" variant="secondary" confirm={{ title: `Delete “${editing.title}”?`, body: 'It disappears from the website. This can’t be undone.' }} onConfirm={async () => { await deleteOffer(editing, actor); setEditing(null); }}><Trash2 /><span className="sr-only">Delete offer</span></ConfirmButton>
            </>}
          </div>
        </form>
      </SideDrawer>
    </AdminShell>
  );
};

export default OffersPage;
