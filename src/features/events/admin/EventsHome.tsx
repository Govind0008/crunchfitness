import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, ClipboardCheck, Instagram, Radio, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatEventDate, nextStep, watchAllEvents, watchResults, type CrunchEvent, type Result } from '@/lib/events';
import { AdminShell, Empty, Stat, StatusPill } from './shared';

// Which event deserves the dashboard's attention right now
const PRIORITY: CrunchEvent['status'][] = ['live', 'check_in', 'results_pending', 'registration_open', 'registration_closed', 'draft'];

/** "What needs attention" — derived from real counts, never guessed. */
function attention(ev: CrunchEvent, results: Result[]): string[] {
  const items: string[] = [];
  const waiting = ev.registrationCount - ev.checkedInCount;
  if ((ev.status === 'check_in' || ev.status === 'live') && waiting > 0) items.push(`${waiting} ${waiting === 1 ? 'person has' : 'people have'} not checked in yet`);
  if (ev.status === 'results_pending') items.push(results.length ? `${results.length} results entered — review and publish them` : 'No results entered yet');
  if (ev.status === 'live' && ev.paused) items.push('The event is paused');
  if (ev.status === 'draft' && !ev.categories.length) items.push('Add at least one category before opening registration');
  if (ev.status === 'registration_open' && ev.capacity != null && ev.registrationCount >= ev.capacity) items.push('The event is full');
  if (!ev.coverImage && ev.status !== 'archived') items.push('No cover photo yet — the website uses a gym photo instead');
  return items;
}

const EventsHome = () => {
  const [events, setEvents] = useState<CrunchEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => watchAllEvents(setEvents, (e) => setError(e.message)), []);
  const current = events && PRIORITY.map((s) => events.find((e) => e.status === s)).find(Boolean);
  useEffect(() => (current ? watchResults(current.id, setResults) : undefined), [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminShell
      title="Events"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" variant="ghost"><Link to="/admin/events/social"><Instagram /> Instagram highlights</Link></Button>
          <Button asChild size="lg"><Link to="/admin/events/new"><CalendarPlus /> Create event</Link></Button>
        </div>
      }
    >
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Couldn’t load events: {error}</p>}
      {!events && !error && <div className="h-48 animate-pulse rounded-3xl bg-ink-900" aria-label="Loading events" />}

      {events && !current && (
        <Empty title="No events yet" body="Create your first event. It stays private as a draft until you open registration.">
          <Button asChild size="lg"><Link to="/admin/events/new"><CalendarPlus /> Create event</Link></Button>
        </Empty>
      )}

      {current && (
        <section aria-labelledby="current-heading" className="rounded-3xl border border-white/[0.08] bg-ink-900 p-6 sm:p-8">
          <p className="hud">Happening now</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 id="current-heading" className="font-display text-3xl font-bold uppercase leading-none text-white sm:text-4xl">{current.title}</h2>
            <StatusPill status={current.status} />
          </div>
          <p className="mt-2 text-sm text-ink-400">{formatEventDate(current.eventDate)} · {current.location}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Registered" value={current.registrationCount} sub={current.capacity ? `of ${current.capacity} places` : 'No limit'} />
            <Stat label="Checked in" value={current.checkedInCount} />
            <Stat label="Results entered" value={results.length} />
          </div>

          {attention(current, results).length > 0 && (
            <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-5">
              <p className="text-sm font-semibold text-amber-200">Needs attention</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-200">
                {attention(current, results).map((a) => <li key={a}>• {a}</li>)}
              </ul>
            </div>
          )}

          <p className="mt-6 text-base text-ink-200"><span className="font-semibold text-white">Next: </span>{nextStep(current).explain}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild size="lg"><Link to={`/admin/events/${current.id}`}>Manage event <ArrowRight /></Link></Button>
            {['registration_open', 'registration_closed', 'check_in', 'live'].includes(current.status) && (
              <Button asChild size="lg" variant="outline"><Link to={`/admin/events/${current.id}/check-in`}><ClipboardCheck /> Check in</Link></Button>
            )}
            {['check_in', 'live'].includes(current.status) && (
              <Button asChild size="lg" variant="outline"><Link to={`/admin/events/${current.id}/live`}><Radio /> Event day screen</Link></Button>
            )}
            {['live', 'results_pending'].includes(current.status) && (
              <Button asChild size="lg" variant="outline"><Link to={`/admin/events/${current.id}?tab=results`}><Trophy /> Enter results</Link></Button>
            )}
          </div>
        </section>
      )}

      {events && events.length > 0 && (
        <section aria-labelledby="all-heading" className="mt-12">
          <h2 id="all-heading" className="font-display text-2xl font-bold uppercase text-white">All events</h2>
          <ul className="mt-4 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
            {events.map((ev) => (
              <li key={ev.id}>
                <Link to={`/admin/events/${ev.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-white/[0.03] sm:p-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">{ev.title}</span>
                    <span className="text-sm text-ink-400">{formatEventDate(ev.eventDate)} · {ev.registrationCount} registered</span>
                  </span>
                  <StatusPill status={ev.status} />
                  <ArrowRight className="h-4 w-4 text-ink-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminShell>
  );
};

export default EventsHome;
