import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, ImageOff, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatEventDate, watchAllEvents, type CrunchEvent } from '@/lib/events';
import { AdminShell, Empty, StatusPill } from '@/features/events/admin/shared';

/** Events as the public sees them — pick one to work on its page text and photos. */
const MarketingEvents = () => {
  const [events, setEvents] = useState<CrunchEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => watchAllEvents(setEvents, (e) => setError(e.message)), []);

  return (
    <AdminShell title="Events"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost"><Link to="/marketing/social"><Instagram /> Instagram highlights</Link></Button>
          <Button asChild><Link to="/marketing/events/new"><CalendarPlus /> Create event</Link></Button>
        </div>
      }>
      <p className="-mt-4 mb-8 max-w-2xl text-sm text-ink-400">Edit what each event page says and which photos it shows. Registrations, check-in and results are run by the gym’s admins.</p>
      {error && <p role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Couldn’t load events: {error}</p>}
      {!events && !error && <div className="h-40 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading events" />}
      {events && events.length === 0 && <Empty title="No events yet" body="Create a draft — an admin opens registration when it’s ready."><Button asChild><Link to="/marketing/events/new"><CalendarPlus /> Create event</Link></Button></Empty>}
      {events && events.length > 0 && (
        <ul className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link to={`/marketing/events/${ev.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-white/[0.03]">
                {ev.coverImage
                  ? <img src={ev.coverImage} alt="" className="h-14 w-20 flex-shrink-0 rounded-lg object-cover" loading="lazy" />
                  : <span className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-ink-900 text-ink-600" title="No cover photo"><ImageOff size={18} aria-hidden /><span className="sr-only">No cover photo</span></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-white">{ev.title}</span>
                  <span className="text-sm text-ink-400">{formatEventDate(ev.eventDate)}{ev.location ? ` · ${ev.location}` : ''}</span>
                </span>
                <StatusPill status={ev.status} className="hidden sm:inline-flex" />
                <ArrowRight className="h-4 w-4 text-ink-500" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
};

export default MarketingEvents;
