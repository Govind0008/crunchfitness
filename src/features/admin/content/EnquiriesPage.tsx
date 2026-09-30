import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageCircle, Phone, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { whatsappLink } from '@/lib/site';
import { formatPhone, phoneKey } from '@/lib/admin/phone';
import {
  ENQUIRY_SOURCES, ENQUIRY_STATUS, addEnquiry, deleteEnquiry, enquirySource, markEnquiryRead, saveEnquiryDetails, setEnquiryStatus, watchEnquiries,
  type Enquiry, type EnquiryStatus,
} from '@/lib/admin/content';
import { AdminShell, ConfirmButton, Field, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate } from '@/features/admin/members/lookups';
import { DataRegion, EmptyNote, ErrorNote, ListToolbar, Pill, SideDrawer, SkeletonRows, type Tone } from '../kit';
import { useOpenFromParam } from '../useOpenFromParam';

const TONE: Record<EnquiryStatus, Tone> = { new: 'ok', contacted: 'info', follow_up: 'warn', converted: 'muted', closed: 'muted' };
const when = (t: Enquiry['submittedAt']) => (t ? new Date(t.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const blank = { name: '', phone: '', email: '', plan: '', message: '', source: 'Walk-in', followUpOn: '' };

/** Enquiries — people interested in joining, and where each one stands. */
const EnquiriesPage = () => {
  const actor = useActor();
  const [rows, setRows] = useState<Enquiry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'open' | EnquiryStatus | 'all'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  useOpenFromParam(() => setAdding(true));
  const [f, setF] = useState(blank);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  useEffect(() => watchEnquiries(setRows, (e) => setError(e.message)), []);

  const open = rows?.find((e) => e.id === openId) ?? null;
  useEffect(() => { if (open) { setNotes(open.notes ?? ''); markEnquiryRead(open).catch(() => {}); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = (s: EnquiryStatus) => (rows ?? []).filter((e) => (e.status ?? 'new') === s).length;
  const openCount = count('new') + count('contacted') + count('follow_up');
  const shown = useMemo(() => (rows ?? []).filter((e) => {
    const s = e.status ?? 'new';
    if (status === 'open' ? !['new', 'contacted', 'follow_up'].includes(s) : status !== 'all' && s !== status) return false;
    const t = q.trim().toLowerCase();
    return !t || e.name?.toLowerCase().includes(t) || phoneKey(e.phone ?? '').includes(t.replace(/\D/g, '') || '~');
  }), [rows, status, q]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (f.name.trim().length < 2 || phoneKey(f.phone).length !== 10) { setFormErr('Add a name and a 10-digit mobile number.'); return; }
    setBusy(true); setFormErr(null);
    try { await addEnquiry(f, actor); setAdding(false); setF(blank); }
    catch { setFormErr('The enquiry couldn’t be saved. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title="Enquiries" nav="enquiries" area="Growth" fill subtitle={rows ? `${count('new')} awaiting reply · ${openCount} open` : '…'}
      actions={<Button onClick={() => { setAdding(true); setFormErr(null); }}><Plus /> Add enquiry</Button>}>
      {error && <div className="mb-5"><ErrorNote what="Couldn’t load enquiries." error={error} /></div>}
      <ListToolbar search={q} onSearch={setQ} placeholder="Search by name or phone" label="Filter enquiries" value={status} onChange={(k) => setStatus(k as typeof status)}
        segments={[{ id: 'open', label: 'Open', count: rows ? openCount : undefined }, { id: 'new', label: 'New', count: rows ? count('new') : undefined }, { id: 'follow_up', label: 'Follow-up', count: rows ? count('follow_up') : undefined }, { id: 'converted', label: 'Converted' }, { id: 'all', label: 'All' }]} />

      {!rows ? <SkeletonRows rows={5} /> : shown.length === 0 ? (
        rows.length === 0
          ? <EmptyNote title="No enquiries" body="No enquiries waiting for follow-up."><Button onClick={() => setAdding(true)}><Plus /> Add enquiry</Button></EmptyNote>
          : <EmptyNote title="Nothing here" body="No enquiries match this filter." />
      ) : (
        <DataRegion>
        <ul className="divide-y divide-white/[0.06]" aria-label="Enquiries">
          {shown.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setOpenId(e.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 truncate font-semibold text-white">{!e.read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" aria-label="Unread" />}{e.name}</span>
                  <span className="block truncate text-xs text-ink-400">{formatPhone(e.phone ?? '')}{e.plan ? ` · ${e.plan}` : ''}</span>
                </span>
                <span className="md:order-last"><Pill tone={TONE[e.status ?? 'new']}>{ENQUIRY_STATUS[e.status ?? 'new']}</Pill></span>
                <span className="hidden text-sm text-ink-300 md:block">{enquirySource(e)} · {when(e.submittedAt)}</span>
                <span className="hidden text-sm text-ink-400 md:block">{e.followUpOn ? `Follow up ${fmtDate(e.followUpOn)}` : e.lastContactAt ? `Contacted ${when(e.lastContactAt)}` : '—'}</span>
              </button>
            </li>
          ))}
        </ul>
        </DataRegion>
      )}

      <SideDrawer open={!!open} onOpenChange={(o) => !o && setOpenId(null)} title={open?.name ?? 'Enquiry'} description={open ? `${enquirySource(open)} · ${when(open.submittedAt)}` : undefined}>
        {open && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {open.phone && <Button asChild variant="outline" size="sm"><a href={`tel:${open.phone}`}><Phone /> {formatPhone(open.phone)}</a></Button>}
              {open.phone && <Button asChild variant="outline" size="sm"><a href={whatsappLink(`Hi ${open.name.split(' ')[0]}, thanks for your interest in Crunch Fitness.`, `91${phoneKey(open.phone)}`)} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></Button>}
              {open.email && <Button asChild variant="ghost" size="sm"><a href={`mailto:${open.email}`}>{open.email}</a></Button>}
            </div>
            {(open.plan || open.message) && <div className="rounded-xl border border-white/[0.08] bg-ink-900 p-4 text-sm">{open.plan && <p className="text-ink-400">Interested in <span className="text-white">{open.plan}</span></p>}{open.message && <p className="mt-2 whitespace-pre-line text-ink-200">{open.message}</p>}</div>}
            <fieldset>
              <legend className="text-sm font-semibold text-white">Status</legend>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`Status for ${open.name}`}>
                {(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={(open.status ?? 'new') === s} onClick={() => setEnquiryStatus(open, s, actor)}
                    className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors', (open.status ?? 'new') === s ? 'border-white bg-white text-ink-950' : 'border-white/15 text-ink-300 hover:text-white')}>{ENQUIRY_STATUS[s]}</button>
                ))}
              </div>
              {open.lastContactAt && <p className="mt-2 text-xs text-ink-500">Last contact {when(open.lastContactAt)}</p>}
            </fieldset>
            <Field label="Follow up on" hint="Optional" htmlFor="enq-follow"><input id="enq-follow" type="date" className={inputCls} value={open.followUpOn ?? ''} onChange={(e) => saveEnquiryDetails(open, { followUpOn: e.target.value || null })} /></Field>
            <Field label="Notes" hint="Saved when you leave the box" htmlFor="enq-notes"><textarea id="enq-notes" rows={4} className={cn(inputCls, 'h-auto py-3')} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if ((open.notes ?? '') !== notes) saveEnquiryDetails(open, { notes }); }} /></Field>
            <ConfirmButton size="sm" variant="secondary" confirm={{ title: `Delete ${open.name}’s enquiry?`, body: 'This can’t be undone.' }} onConfirm={async () => { await deleteEnquiry(open, actor); setOpenId(null); }}><Trash2 /> Delete enquiry</ConfirmButton>
          </div>
        )}
      </SideDrawer>

      <SideDrawer open={adding} onOpenChange={setAdding} title="Add enquiry" description="A walk-in, call or message">
        <form onSubmit={add} className="space-y-5" noValidate aria-label="New enquiry">
          {formErr && <p role="alert" className="text-sm text-red-300">{formErr}</p>}
          <Field label="Name" htmlFor="ne-name"><input id="ne-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Mobile number" htmlFor="ne-phone"><input id="ne-phone" type="tel" inputMode="tel" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Email" hint="Optional" htmlFor="ne-email"><input id="ne-email" type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Came through" htmlFor="ne-source">
            <select id="ne-source" className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{ENQUIRY_SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Interested in" hint="Optional, e.g. 3 Months" htmlFor="ne-plan"><input id="ne-plan" className={inputCls} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} /></Field>
          <Field label="Note" hint="Optional" htmlFor="ne-msg"><textarea id="ne-msg" rows={3} className={cn(inputCls, 'h-auto py-3')} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
          <Field label="Follow up on" hint="Optional" htmlFor="ne-follow"><input id="ne-follow" type="date" className={inputCls} value={f.followUpOn} onChange={(e) => setF({ ...f, followUpOn: e.target.value })} /></Field>
          <div className="flex gap-2"><Button type="submit" loading={busy} loadingText="Saving…">Add enquiry</Button><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
        </form>
      </SideDrawer>
    </AdminShell>
  );
};

export default EnquiriesPage;
