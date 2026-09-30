import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatEventDate, updateEventContent, watchEvent, type CrunchEvent, type EventContent } from '@/lib/events';
import { AdminShell, Empty, Field, StatusPill, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import MediaTab from '@/features/events/admin/MediaTab';

const pick = (ev: CrunchEvent): EventContent => ({
  title: ev.title, shortDescription: ev.shortDescription ?? '', description: ev.description ?? '',
  location: ev.location ?? '', eligibility: ev.eligibility ?? '', rules: ev.rules ?? '',
});

/** One event's public page: its words and its photos. Nothing operational. */
const MarketingEvent = () => {
  const { id = '' } = useParams();
  const actor = useActor();
  const [ev, setEv] = useState<CrunchEvent | null | undefined>(undefined);
  const [form, setForm] = useState<EventContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => watchEvent(id, (e) => { setEv(e); setForm((f) => f ?? (e ? pick(e) : null)); }, () => setEv(null)), [id]);

  if (ev === undefined) return <AdminShell title="Event"><div className="h-40 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading event" /></AdminShell>;
  if (ev === null || !form) return <AdminShell title="Event not found" back={{ to: '/marketing/events', label: 'Events' }}><Empty title="This event doesn’t exist" body="It may have been deleted." /></AdminShell>;

  const set = (k: keyof EventContent, v: string) => { setForm({ ...form, [k]: v }); setMsg(null); };
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(ev));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setMsg({ ok: false, text: 'The event needs a name.' }); return; }
    setSaving(true); setMsg(null);
    try { await updateEventContent(ev.id, form, actor); setMsg({ ok: true, text: 'Saved — the event page is updated.' }); }
    catch { setMsg({ ok: false, text: 'Couldn’t save. Please try again.' }); }
    finally { setSaving(false); }
  };

  return (
    <AdminShell title={ev.title} back={{ to: '/marketing/events', label: 'Events' }}
      actions={
        <div className="flex flex-wrap gap-2">
          {ev.status !== 'draft' && <Button asChild variant="ghost"><a href={`/events/${ev.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink /> View on website</a></Button>}
          {ev.status === 'draft' && <Button asChild variant="outline"><Link to={`/marketing/events/${ev.id}/edit`}><Pencil /> Edit all details</Link></Button>}
        </div>
      }>
      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-3 text-sm text-ink-400">
        <StatusPill status={ev.status} /><span>{formatEventDate(ev.eventDate)}</span>
        {ev.status === 'draft' && <span>Private until an admin opens registration.</span>}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={save} className="space-y-6" aria-labelledby="copy-h">
          <h2 id="copy-h" className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Page text</h2>
          <Field label="Event name" htmlFor="mk-title"><input id="mk-title" className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Short description" hint="One line for the events page" htmlFor="mk-short"><input id="mk-short" className={inputCls} maxLength={140} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></Field>
          <Field label="Description" htmlFor="mk-desc"><textarea id="mk-desc" rows={6} className={cn(inputCls, 'h-auto py-3')} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Location" htmlFor="mk-loc"><input id="mk-loc" className={inputCls} value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Who can take part" htmlFor="mk-elig"><textarea id="mk-elig" rows={3} className={cn(inputCls, 'h-auto py-3')} value={form.eligibility} onChange={(e) => set('eligibility', e.target.value)} /></Field>
          <Field label="Rules" htmlFor="mk-rules"><textarea id="mk-rules" rows={5} className={cn(inputCls, 'h-auto py-3')} value={form.rules} onChange={(e) => set('rules', e.target.value)} /></Field>
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-brand-fg' : 'text-sm text-red-300'}>{msg.text}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save page text'}</Button>
            <p className="text-xs text-ink-500">Date, registration and capacity are set by an admin.</p>
          </div>
        </form>
        <section aria-labelledby="photos-h">
          <h2 id="photos-h" className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Photos & video</h2>
          <MediaTab ev={ev} />
        </section>
      </div>
    </AdminShell>
  );
};

export default MarketingEvent;
