import { useState } from 'react';
import { useEventData } from './useEventData';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ClipboardCheck, ExternalLink, Pencil, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  formatEventDate, formatTime, nextStep, setStatus, type CrunchEvent,
} from '@/lib/events';
import { AdminShell, ConfirmButton, Empty, Stat, StatusPill } from './shared';
import { useActor } from './actor';
import RegistrationsTab from './RegistrationsTab';
import ResultsTab from './ResultsTab';
import MediaTab from './MediaTab';
import ActivityTab from './ActivityTab';
import DeleteEvent from './DeleteEvent';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'registrations', label: 'Registrations' },
  { id: 'results', label: 'Results' },
  { id: 'media', label: 'Photos' },
  { id: 'activity', label: 'Activity' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** The steps the admin can move back through, shown quietly under the main action. */
const SECONDARY: Partial<Record<CrunchEvent['status'], { label: string; to: CrunchEvent['status']; confirm: { title: string; body: string } }>> = {
  registration_closed: { label: 'Reopen registration', to: 'registration_open', confirm: { title: 'Reopen registration?', body: 'People will be able to sign up on the website again.' } },
  results_pending: { label: 'Back to live', to: 'live', confirm: { title: 'Go back to live?', body: 'The website will show the event as LIVE again.' } },
  results_published: { label: 'Unpublish results', to: 'results_pending', confirm: { title: 'Unpublish results?', body: 'Results and winners will be hidden from the website.' } },
  archived: { label: 'Move out of archive', to: 'results_published', confirm: { title: 'Move out of the archive?', body: 'The event will show as a recent event again.' } },
};

const EventControl = () => {
  const { id } = useParams();
  const actor = useActor();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as Tab;
  const { event: ev, registrations, results } = useEventData(id);
  const [error, setError] = useState<string | null>(params.get('notice') === 'cover-failed' ? 'The event was saved, but the cover photo couldn’t be uploaded. Try again in Photos.' : null);

  if (ev === undefined) return <AdminShell title="Loading…"><div className="h-40 animate-pulse rounded-3xl bg-ink-900" /></AdminShell>;
  if (ev === null) return <AdminShell title="Event not found" back={{ to: '/admin/events', label: 'All events' }}><Empty title="This event doesn’t exist" body="It may have been deleted." /></AdminShell>;

  const next = nextStep(ev);
  const back = SECONDARY[ev.status];
  const move = async (to: CrunchEvent['status']) => {
    setError(null);
    try { await setStatus(ev.id, ev.status, to, actor); } catch (e) { setError(`Couldn’t change the status: ${(e as Error).message}`); }
  };
  const blockOpen = ev.status === 'draft' && !ev.categories.length;

  return (
    <AdminShell title={ev.title} back={{ to: '/admin/events', label: 'All events' }}
      actions={
        <div className="flex flex-wrap gap-2">
          {ev.status !== 'draft' && <Button asChild variant="ghost"><a href={`/events/${ev.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink /> View on website</a></Button>}
          <Button asChild variant="outline"><Link to={`/admin/events/${ev.id}/edit`}><Pencil /> Edit details</Link></Button>
        </div>
      }
    >
      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-3 text-sm text-ink-400">
        <StatusPill status={ev.status} />
        <span>{formatEventDate(ev.eventDate)}{ev.startTime && ` · ${formatTime(ev.startTime)}`}</span>
        <span>· {ev.location}</span>
      </div>

      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      {/* Next step — the admin never has to guess */}
      <section aria-labelledby="next-heading" className="rounded-3xl border border-brand-400/30 bg-brand-400/[0.06] p-6 sm:p-8">
        <p id="next-heading" className="hud text-brand-400">Next step</p>
        <p className="mt-3 max-w-2xl text-lg text-white">{next.explain}</p>
        {blockOpen && <p className="mt-2 text-sm text-amber-200">Add at least one category (Edit details → Competition) before opening registration.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {next.action && (
            <ConfirmButton confirm={next.action.confirm} onConfirm={() => move(next.action!.to)} disabled={blockOpen}>
              {next.action.label}
            </ConfirmButton>
          )}
          {['registration_open', 'registration_closed', 'check_in', 'live'].includes(ev.status) && (
            <Button asChild size="lg" variant="outline"><Link to={`/admin/events/${ev.id}/check-in`}><ClipboardCheck /> Check in</Link></Button>
          )}
          {['check_in', 'live', 'results_pending'].includes(ev.status) && (
            <Button asChild size="lg" variant="outline"><Link to={`/admin/events/${ev.id}/live`}><Radio /> Event day screen</Link></Button>
          )}
          {back && <ConfirmButton variant="secondary" size="default" confirm={back.confirm} onConfirm={() => move(back.to)}>{back.label}</ConfirmButton>}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered" value={ev.registrationCount} sub={ev.capacity ? `of ${ev.capacity} places` : 'No limit'} />
        <Stat label="Checked in" value={ev.checkedInCount} />
        <Stat label="Categories" value={ev.categories.length} />
        <Stat label="Results entered" value={results.length} />
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Event sections" className="-mx-4 mt-10 flex gap-1 overflow-x-auto border-b border-white/[0.08] px-4 hide-scrollbar sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'overview' ? {} : { tab: t.id }, { replace: true })}
            className={cn('shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors', tab === t.id ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}
          >
            {t.label}
            {t.id === 'registrations' && <span className="ml-2 text-ink-500">{registrations.length}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-8">
        {tab === 'overview' && (<>
          <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[
              ['Short description', ev.shortDescription || '—'],
              ['Public page', ev.status === 'draft' ? 'Not public yet' : `/events/${ev.slug}`],
              ['Registration', !ev.registrationEnabled ? 'In person only' : `${ev.registrationOpenAt ? new Date(ev.registrationOpenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'When opened'} → ${ev.registrationCloseAt ? new Date(ev.registrationCloseAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'until closed'}`],
              ['Categories', ev.categories.map((c) => `${c.name} (${c.direction === 'higher' ? 'highest' : 'lowest'} wins)`).join(' · ') || 'None yet'],
              ['Who can take part', ev.eligibility || '—'],
              ['Created by', ev.createdBy || '—'],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-sm text-ink-400">{k}</dt><dd className="mt-1 text-white">{v}</dd></div>
            ))}
          </dl>
          <DeleteEvent ev={ev} />
        </>)}
        {tab === 'registrations' && <RegistrationsTab ev={ev} registrations={registrations} />}
        {tab === 'results' && <ResultsTab ev={ev} registrations={registrations} results={results} />}
        {tab === 'media' && <MediaTab ev={ev} />}
        {tab === 'activity' && <ActivityTab ev={ev} />}
      </div>
    </AdminShell>
  );
};

export default EventControl;
