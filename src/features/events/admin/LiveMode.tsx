import { Link, useParams } from 'react-router-dom';
import { ClipboardCheck, Pause, Play, SkipForward, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STATUS, setLiveState, setStatus } from '@/lib/events';
import { AdminShell, ConfirmButton, Stat, StatusPill } from './shared';
import { useActor } from './actor';
import { useEventData } from './useEventData';

/** The event-day screen: big numbers, the current category, and the few actions that matter. */
const LiveMode = () => {
  const { id } = useParams();
  const actor = useActor();
  const { event: ev, registrations, results } = useEventData(id);
  if (!ev) return <AdminShell title="Event day"><div className="h-40 animate-pulse rounded-3xl bg-ink-900" /></AdminShell>;

  const cats = ev.categories;
  const idx = Math.max(0, cats.findIndex((c) => c.id === ev.currentCategoryId));
  const cat = cats[idx];
  const inCat = registrations.filter((r) => r.categoryId === cat?.id && r.status !== 'no_show');
  const entered = results.filter((r) => r.categoryId === cat?.id).length;
  const nextCat = cats[idx + 1];

  return (
    <AdminShell title="Event day" back={{ to: `/admin/events/${ev.id}`, label: ev.title }}>
      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-3">
        <StatusPill status={ev.status} className="px-4 py-1.5 text-sm" />
        {ev.status === 'live' && ev.paused && <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase text-ink-950">Paused</span>}
        <span className="text-sm text-ink-400">The website shows: “{ev.paused && ev.status === 'live' ? 'Short break' : STATUS[ev.status].public}”</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Participants" value={ev.registrationCount} />
        <Stat label="Checked in" value={ev.checkedInCount} />
        <Stat label="Results entered" value={results.length} />
        <Stat label="Left in this category" value={Math.max(0, inCat.length - entered)} />
      </div>

      {cat && (
        <section aria-labelledby="cat-heading" className="mt-6 rounded-3xl border border-white/[0.08] bg-ink-900 p-6 sm:p-8">
          <p className="hud">Current category · {idx + 1} of {cats.length}</p>
          <h2 id="cat-heading" className="mt-3 font-display text-5xl font-bold uppercase leading-none text-white">{cat.name}</h2>
          <p className="mt-2 text-ink-400">{entered} of {inCat.length} results entered · {cat.direction === 'higher' ? 'highest' : 'lowest'} score wins</p>
        </section>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ev.status === 'check_in' && (
          <ConfirmButton className="h-16 text-lg sm:col-span-2" confirm={{ title: 'Start this event?', body: 'The public website will now show the event as LIVE.' }} onConfirm={() => setStatus(ev.id, ev.status, 'live', actor)}>
            <Play /> Start competition
          </ConfirmButton>
        )}
        {ev.status === 'live' && (
          <>
            <Button asChild size="lg" className="h-16 text-lg"><Link to={`/admin/events/${ev.id}?tab=results`}><Trophy /> Enter result</Link></Button>
            <Button size="lg" variant="outline" className="h-16 text-lg" disabled={!nextCat}
              onClick={() => nextCat && setLiveState(ev.id, { currentCategoryId: nextCat.id }, actor, `Moved to category: ${nextCat.name}`)}>
              <SkipForward /> {nextCat ? `Next category: ${nextCat.name}` : 'Last category'}
            </Button>
            <Button size="lg" variant="outline" className="h-16 text-lg" onClick={() => setLiveState(ev.id, { paused: !ev.paused }, actor, ev.paused ? 'Event resumed' : 'Event paused')}>
              {ev.paused ? <><Play /> Resume event</> : <><Pause /> Pause event</>}
            </Button>
            <ConfirmButton variant="secondary" className="h-16 text-lg" confirm={{ title: 'Complete the event?', body: 'The live leaderboard will be hidden until you publish the final results.' }} onConfirm={() => setStatus(ev.id, ev.status, 'results_pending', actor)}>
              Complete event
            </ConfirmButton>
          </>
        )}
        {ev.status === 'results_pending' && (
          <Button asChild size="lg" className="h-16 text-lg sm:col-span-2"><Link to={`/admin/events/${ev.id}?tab=results`}><Trophy /> Review winners and publish</Link></Button>
        )}
        {['check_in', 'live'].includes(ev.status) && (
          <Button asChild size="lg" variant="outline" className="h-16 text-lg sm:col-span-2"><Link to={`/admin/events/${ev.id}/check-in`}><ClipboardCheck /> Check in participants</Link></Button>
        )}
      </div>
    </AdminShell>
  );
};

export default LiveMode;
