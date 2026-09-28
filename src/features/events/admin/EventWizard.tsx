import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SITE } from '@/lib/site';
import {
  SCORING, createEvent, formatEventDate, formatTime, setCover, updateEvent, uploadMedia, watchEvent,
  type Category, type CrunchEvent, type EventDraft, type ScoringType,
} from '@/lib/events';
import { AdminShell, Field, inputCls } from './shared';
import { useActor } from './actor';

const STEPS = ['Basics', 'Registration', 'Competition', 'Review'] as const;

const blank: EventDraft = {
  title: '', slug: '', shortDescription: '', description: '', coverImage: '',
  location: `${SITE.name}, Wakad`, eventDate: '', startTime: '', endTime: '',
  registrationOpenAt: '', registrationCloseAt: '', capacity: null, registrationEnabled: true,
  categories: [], eligibility: '', rules: '',
};

const newCategory = (): Category => ({ id: Math.random().toString(36).slice(2, 9), name: '', scoring: 'weight', unit: 'kg', direction: 'higher' });

const toDraft = (ev: CrunchEvent): EventDraft => {
  const { id: _i, status: _s, registrationCount: _r, checkedInCount: _c, createdBy: _b, createdAt: _ca, updatedAt: _u, publishedAt: _p, resultsPublishedAt: _rp, currentCategoryId: _cc, paused: _pa, ...d } = ev;
  return d;
};

/** Create or edit an event in four short steps. */
const EventWizard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const actor = useActor();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<EventDraft>(blank);
  const [existing, setExisting] = useState<CrunchEvent | null>(null);
  const [cover, setCoverFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    return watchEvent(id, (ev) => { if (ev && !existing) { setExisting(ev); setD(toDraft(ev)); } });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof EventDraft>(k: K, v: EventDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setCat = (i: number, patch: Partial<Category>) => set('categories', d.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const coverPreview = useMemo(() => (cover ? URL.createObjectURL(cover) : d.coverImage), [cover, d.coverImage]);

  // Each step checks only its own fields, in plain language
  const validate = (s: number): string[] => {
    const e: string[] = [];
    if (s === 0) {
      if (!d.title.trim()) e.push('Give the event a name.');
      if (!d.eventDate) e.push('Choose the event date.');
      if (!d.startTime) e.push('Add a start time.');
      if (d.endTime && d.startTime && d.endTime <= d.startTime) e.push('The end time must be after the start time.');
      if (!d.location.trim()) e.push('Add the location.');
    }
    if (s === 1) {
      if (d.capacity != null && d.capacity < 1) e.push('Maximum participants must be at least 1 (or leave it empty for no limit).');
      if (d.registrationOpenAt && d.registrationCloseAt && d.registrationCloseAt <= d.registrationOpenAt) e.push('Registration must close after it opens.');
    }
    if (s === 2) {
      d.categories.forEach((c, i) => { if (!c.name.trim()) e.push(`Category ${i + 1} needs a name.`); });
    }
    return e;
  };
  const go = (to: number) => {
    const e = to > step ? validate(step) : [];
    setErrors(e);
    if (!e.length) { setStep(to); window.scrollTo({ top: 0 }); }
  };

  const save = async (openNow: boolean) => {
    const all = [0, 1, 2].flatMap(validate);
    if (openNow && !d.categories.length) all.push('Add at least one category before opening registration.');
    setErrors(all);
    if (all.length) return;
    setBusy(openNow ? 'Opening registration…' : 'Saving…');
    try {
      const clean: EventDraft = { ...d, title: d.title.trim(), categories: d.categories.map((c) => ({ ...c, name: c.name.trim() })) };
      let eventId = id;
      if (existing) await updateEvent(existing.id, clean, actor);
      else eventId = await createEvent(clean, actor, openNow);
      if (cover && eventId) {
        setBusy('Uploading cover photo…');
        const ev = { ...(existing ?? {}), ...clean, id: eventId } as CrunchEvent;
        try {
          await setCover(ev, await uploadMedia(ev, cover, 'highlight', actor), actor);
        } catch {
          setBusy(null);
          navigate(`/admin/events/${eventId}?notice=cover-failed`);
          return;
        }
      }
      navigate(`/admin/events/${eventId}`);
    } catch (err) {
      setErrors([`Couldn’t save: ${(err as Error).message}`]);
      setBusy(null);
    }
  };

  return (
    <AdminShell title={existing ? 'Edit event' : 'Create event'} back={{ to: existing ? `/admin/events/${existing.id}` : '/admin/events', label: existing ? existing.title : 'All events' }}>
      {/* Step indicator */}
      <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i < step && go(i)} disabled={i > step} aria-current={i === step ? 'step' : undefined} className="w-full text-left">
              <span className={cn('block h-1 rounded-full', i <= step ? 'bg-brand-400' : 'bg-white/10')} />
              <span className={cn('mt-2 block text-xs font-semibold sm:text-sm', i === step ? 'text-white' : 'text-ink-500')}>
                <span className="tabular-nums">{i + 1}.</span> {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="max-w-2xl">
        {errors.length > 0 && (
          <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}

        {step === 0 && (
          <div className="space-y-6">
            <Field label="Event name" htmlFor="title"><input id="title" className={inputCls} value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Crunch Strength Challenge" /></Field>
            <Field label="Short description" hint="One line for the events page" htmlFor="short"><input id="short" className={inputCls} maxLength={140} value={d.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></Field>
            <Field label="Description" htmlFor="desc"><textarea id="desc" rows={5} className={cn(inputCls, 'h-auto py-3')} value={d.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Cover photo" hint="Optional — you can also add it later in Photos" htmlFor="cover">
              <label htmlFor="cover" className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/20 p-4 hover:border-white/40">
                {coverPreview ? <img src={coverPreview} alt="" className="h-16 w-24 rounded-lg object-cover" /> : <ImagePlus className="h-8 w-8 text-ink-500" aria-hidden />}
                <span className="text-sm text-ink-300">{cover ? cover.name : coverPreview ? 'Change photo' : 'Choose a photo'}</span>
              </label>
              <input id="cover" type="file" accept="image/*" className="sr-only" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="grid gap-6 sm:grid-cols-3">
              <Field label="Date" htmlFor="date"><input id="date" type="date" className={inputCls} value={d.eventDate} onChange={(e) => set('eventDate', e.target.value)} /></Field>
              <Field label="Start time" htmlFor="start"><input id="start" type="time" className={inputCls} value={d.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
              <Field label="End time" htmlFor="end"><input id="end" type="time" className={inputCls} value={d.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
            </div>
            <Field label="Location" htmlFor="loc"><input id="loc" className={inputCls} value={d.location} onChange={(e) => set('location', e.target.value)} /></Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <label className="flex items-center gap-3 rounded-xl border border-white/15 p-4">
              <input type="checkbox" className="h-5 w-5 accent-[#b0d43f]" checked={d.registrationEnabled} onChange={(e) => set('registrationEnabled', e.target.checked)} />
              <span><span className="block font-semibold text-white">People can register on the website</span><span className="text-sm text-ink-400">Turn off if you’re taking entries in person only.</span></span>
            </label>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Registration opens" hint="Optional — leave empty to open straight away" htmlFor="ro"><input id="ro" type="datetime-local" className={inputCls} value={d.registrationOpenAt} onChange={(e) => set('registrationOpenAt', e.target.value)} /></Field>
              <Field label="Registration closes" hint="Optional" htmlFor="rc"><input id="rc" type="datetime-local" className={inputCls} value={d.registrationCloseAt} onChange={(e) => set('registrationCloseAt', e.target.value)} /></Field>
            </div>
            <Field label="Maximum participants" hint="Leave empty for no limit" htmlFor="cap">
              <input id="cap" type="number" min={1} inputMode="numeric" className={inputCls} value={d.capacity ?? ''} onChange={(e) => set('capacity', e.target.value === '' ? null : Number(e.target.value))} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-white">Categories</p>
              <p className="mt-0.5 text-xs text-ink-500">Each category is ranked separately. Say clearly how it’s scored and what wins.</p>
              <ul className="mt-4 space-y-4">
                {d.categories.map((c, i) => (
                  <li key={c.id} className="rounded-2xl border border-white/[0.1] bg-ink-900 p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid flex-1 gap-4 sm:grid-cols-2">
                        <Field label="Category name" htmlFor={`cn-${c.id}`}><input id={`cn-${c.id}`} className={inputCls} value={c.name} onChange={(e) => setCat(i, { name: e.target.value })} placeholder="e.g. Deadlift — Men" /></Field>
                        <Field label="Scored by" htmlFor={`cs-${c.id}`}>
                          <select id={`cs-${c.id}`} className={inputCls} value={c.scoring} onChange={(e) => { const s = e.target.value as ScoringType; setCat(i, { scoring: s, unit: SCORING[s].unit, direction: SCORING[s].direction }); }}>
                            {(Object.keys(SCORING) as ScoringType[]).map((s) => <option key={s} value={s}>{SCORING[s].label}</option>)}
                          </select>
                        </Field>
                        <Field label="Winner" htmlFor={`cd-${c.id}`}>
                          <select id={`cd-${c.id}`} className={inputCls} value={c.direction} onChange={(e) => setCat(i, { direction: e.target.value as Category['direction'] })}>
                            <option value="higher">Highest score wins</option>
                            <option value="lower">Lowest score wins (e.g. fastest time)</option>
                          </select>
                        </Field>
                        {c.scoring !== 'time' && (
                          <Field label="Unit" htmlFor={`cu-${c.id}`}><input id={`cu-${c.id}`} className={inputCls} value={c.unit} onChange={(e) => setCat(i, { unit: e.target.value })} /></Field>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" aria-label={`Remove category ${c.name || i + 1}`} onClick={() => set('categories', d.categories.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </div>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-4" onClick={() => set('categories', [...d.categories, newCategory()])}><Plus /> Add category</Button>
            </div>
            <Field label="Who can take part" hint="Optional, e.g. age, experience or membership" htmlFor="elig"><textarea id="elig" rows={3} className={cn(inputCls, 'h-auto py-3')} value={d.eligibility} onChange={(e) => set('eligibility', e.target.value)} /></Field>
            <Field label="Rules" hint="Optional — shown on the event page" htmlFor="rules"><textarea id="rules" rows={5} className={cn(inputCls, 'h-auto py-3')} value={d.rules} onChange={(e) => set('rules', e.target.value)} /></Field>
          </div>
        )}

        {step === 3 && (
          <div>
            <dl className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
              {[
                ['Event', d.title],
                ['Date', `${formatEventDate(d.eventDate)} · ${formatTime(d.startTime)}${d.endTime ? ` – ${formatTime(d.endTime)}` : ''}`],
                ['Location', d.location],
                ['Categories', d.categories.length ? d.categories.map((c) => `${c.name} (${c.direction === 'higher' ? 'highest' : 'lowest'} ${SCORING[c.scoring].label.toLowerCase()} wins)`).join(' · ') : 'None yet'],
                ['Capacity', d.capacity ? `${d.capacity} people` : 'No limit'],
                ['Registration', !d.registrationEnabled ? 'In person only' : `${d.registrationOpenAt ? new Date(d.registrationOpenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'As soon as it’s opened'} → ${d.registrationCloseAt ? new Date(d.registrationCloseAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'until you close it'}`],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 p-4 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-sm text-ink-400">{k}</dt>
                  <dd className="text-sm font-medium text-white">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 text-sm text-ink-400">
              {existing ? 'Changes appear on the website straight away if the event is already public.' : 'A draft is only visible to staff. Opening registration puts the event on the website.'}
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-6">
          {step > 0 && <Button variant="ghost" size="lg" onClick={() => go(step - 1)}><ArrowLeft /> Back</Button>}
          <div className="ml-auto flex flex-wrap gap-3">
            {step < 3 && <Button size="lg" onClick={() => go(step + 1)}>Continue <ArrowRight /></Button>}
            {step === 3 && existing && <Button size="lg" disabled={!!busy} onClick={() => save(false)}>{busy ?? 'Save changes'}</Button>}
            {step === 3 && !existing && (
              <>
                <Button size="lg" variant="outline" disabled={!!busy} onClick={() => save(false)}>{busy === 'Saving…' ? busy : 'Save draft'}</Button>
                <Button size="lg" disabled={!!busy} onClick={() => save(true)}>{busy && busy !== 'Saving…' ? busy : 'Open registration'}</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
};

export default EventWizard;
