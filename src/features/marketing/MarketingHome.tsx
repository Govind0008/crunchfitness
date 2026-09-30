import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarPlus, FileText, ImagePlus, Instagram, Megaphone } from 'lucide-react';
import { collection, getCountFromServer, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { todayIST } from '@/lib/admin/members';
import { STATUS, formatEventDate, normalizeEvent, type CrunchEvent, type EventStatus } from '@/lib/events';
import Seo from '@/components/site/Seo';

const UPCOMING: EventStatus[] = ['draft', 'registration_open', 'registration_closed', 'check_in', 'live'];

interface Offer { id: string; title: string; active: boolean; startDate: string; endDate: string }
interface Numbers { published: number; drafts: number; featured: number }

const Figure = ({ label, value, sub, to }: { label: string; value: ReactNode; sub: string; to: string }) => (
  <Link to={to} className="group block border-t border-white/10 pt-4 transition-colors hover:border-brand-400">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{label}</p>
    <p className="mt-2 font-display text-5xl font-bold leading-none tabular-nums text-white sm:text-6xl">{value}</p>
    <p className="mt-2 text-xs text-ink-500 group-hover:text-ink-300">{sub}</p>
  </Link>
);

/** The marketing workspace: what's live, what's in draft, what's coming — real counts only. */
const MarketingHome = () => {
  const [n, setN] = useState<Numbers | null>(null);
  const [events, setEvents] = useState<CrunchEvent[] | null>(null);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const posts = collection(db, 'posts');
    Promise.all([
      getCountFromServer(query(posts, where('published', '==', true))),
      getCountFromServer(query(posts, where('published', '==', false))),
      getCountFromServer(query(collection(db, 'socialHighlights'), where('visible', '==', true))),
    ]).then(([p, d, f]) => setN({ published: p.data().count, drafts: d.data().count, featured: f.data().count })).catch((e) => setError(e.message));
    getDocs(query(collection(db, 'events'), where('status', 'in', UPCOMING)))
      .then((s) => setEvents(s.docs.map((d) => normalizeEvent({ id: d.id, ...(d.data() as object) } as CrunchEvent)).sort((a, b) => a.eventDate.localeCompare(b.eventDate))))
      .catch((e) => { setEvents([]); setError(e.message); });
    getDocs(collection(db, 'offers')).then((s) => setOffers(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Offer))).catch(() => setOffers([]));
  }, []);

  const today = todayIST();
  const live = (offers ?? []).filter((o) => o.active && o.startDate <= today && o.endDate >= today);

  return (
    <>
      <Seo title="Creative Desk | Crunch Fitness" description="Staff area" noindex />
      <header>
        <p className="hud text-brand-fg">The Creative Desk</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold uppercase leading-[0.9] text-white sm:text-6xl">Build the brand. Tell the story.</h1>
      </header>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Some numbers couldn’t load — {error}</p>}

      <section aria-label="Content at a glance" className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-5">
        <Figure label="Published posts" value={n?.published ?? '—'} sub="Live on the blog" to="/marketing/blog" />
        <Figure label="Drafts" value={n?.drafts ?? '—'} sub="Not public yet" to="/marketing/blog" />
        <Figure label="Upcoming events" value={events?.length ?? '—'} sub="Not finished yet" to="/marketing/events" />
        <Figure label="Active promotions" value={offers ? live.length : '—'} sub="Showing on the website today" to="/marketing/offers" />
        <Figure label="Featured posts" value={n?.featured ?? '—'} sub="Instagram highlights shown" to="/marketing/social" />
      </section>

      <section aria-labelledby="make-h" className="mt-14">
        <h2 id="make-h" className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Make something</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { to: '/marketing/blog?new=1', label: 'New blog post', icon: <FileText size={18} /> },
            { to: '/marketing/events/new', label: 'Create event', icon: <CalendarPlus size={18} /> },
            { to: '/marketing/offers?new=1', label: 'Add promotion', icon: <Megaphone size={18} /> },
            { to: '/marketing/events', label: 'Upload event media', icon: <ImagePlus size={18} /> },
            { to: '/marketing/social', label: 'Manage social', icon: <Instagram size={18} /> },
          ].map((a) => (
            <Link key={a.label} to={a.to} className="flex min-h-[3.5rem] items-center gap-3 rounded-xl bg-white/[0.05] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-400 hover:text-on-brand [&:hover_span]:text-on-brand">
              <span className="text-brand-fg">{a.icon}</span>{a.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="ev-h">
          <div className="flex items-baseline justify-between"><h2 id="ev-h" className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Coming up</h2><Link to="/marketing/events" className="text-xs text-ink-400 hover:text-white">All events →</Link></div>
          {!events ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-900" /> : events.length === 0 ? <p className="mt-4 text-sm text-ink-400">No upcoming events.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {events.slice(0, 5).map((e) => (
                <li key={e.id}><Link to={`/marketing/events/${e.id}`} className="group flex items-center gap-4 py-3">
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white group-hover:text-brand-fg">{e.title}</span><span className="text-xs text-ink-500">{formatEventDate(e.eventDate)}{e.coverImage ? '' : ' · no cover photo yet'}</span></span>
                  <span className="text-xs font-semibold text-ink-300">{STATUS[e.status].admin}</span>
                  <ArrowRight className="h-4 w-4 text-ink-600" aria-hidden />
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="of-h">
          <div className="flex items-baseline justify-between"><h2 id="of-h" className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-ink-400">Promotions live today</h2><Link to="/marketing/offers" className="text-xs text-ink-400 hover:text-white">All offers →</Link></div>
          {!offers ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-ink-900" /> : live.length === 0 ? <p className="mt-4 text-sm text-ink-400">No promotion is showing on the website today.</p> : (
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {live.map((o) => <li key={o.id} className="flex items-center justify-between gap-4 py-3"><span className="truncate font-semibold text-white">{o.title}</span><span className="text-xs text-ink-500">until {formatEventDate(o.endDate, { day: 'numeric', month: 'short' })}</span></li>)}
            </ul>
          )}
        </section>
      </div>
    </>
  );
};

export default MarketingHome;
