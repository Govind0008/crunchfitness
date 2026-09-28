import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Instagram } from 'lucide-react';
import Footer from '@/components/Footer';
import Seo from '@/components/site/Seo';
import { Section } from '@/components/site/Section';
import { Button } from '@/components/ui/button';
import { Hud, TickRail } from '@/components/motion';
import { useRevealOnMount, useScrollReveal } from '@/hooks/useScrollReveal';
import { SITE } from '@/lib/site';
import { formatEventDate, watchPublicEvents, type CrunchEvent } from '@/lib/events';
import { StatusMark } from './shared';
import { PAST, UPCOMING, coverOf } from './lib';

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;
const byDate = (dir: 1 | -1) => (a: CrunchEvent, b: CrunchEvent) => dir * a.eventDate.localeCompare(b.eventDate);

/** One event, set like a campaign frame: photo, big date, title. */
const EventFrame = ({ ev, index, large }: { ev: CrunchEvent; index: number; large?: boolean }) => {
  const ref = useScrollReveal<HTMLLIElement>();
  const cover = coverOf(ev);
  const [day, month] = formatEventDate(ev.eventDate, { day: '2-digit', month: 'short' }).split(' ');
  return (
    <li ref={ref} className={large ? 'lg:col-span-2' : undefined}>
      <Link to={`/events/${ev.slug}`} className="group block">
        <div className={`m-wipe-up relative overflow-hidden rounded-2xl bg-ink-900 ${large ? 'aspect-[4/5] sm:aspect-[16/9]' : 'aspect-[4/5] sm:aspect-[4/3]'}`} style={d(index * 90)}>
          <img src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 1024px) 60vw, 100vw" alt="" loading="lazy"
            className="m-settle h-full w-full object-cover transition-transform [transition-duration:900ms] ease-out-expo group-hover:scale-[1.04]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-transparent" aria-hidden />
          <div className="absolute left-4 top-4 sm:left-6 sm:top-6"><StatusMark ev={ev} /></div>
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-4 sm:inset-x-6 sm:bottom-6">
            <div className="min-w-0">
              <h3 className={`font-display font-extrabold uppercase leading-[0.9] text-white ${large ? 'text-[clamp(2.5rem,1.5rem+4vw,5.5rem)]' : 'text-4xl'}`}>{ev.title}</h3>
              {ev.shortDescription && <p className="mt-2 line-clamp-2 max-w-lg text-sm text-white/75 md:text-base">{ev.shortDescription}</p>}
            </div>
            <p className="shrink-0 text-right font-display font-bold uppercase leading-none text-white" aria-label={formatEventDate(ev.eventDate)}>
              <span className="block text-5xl">{day}</span><span className="block text-lg text-brand-400">{month}</span>
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
};

const Group = ({ id, index, title, events }: { id: string; index: string; title: string; events: CrunchEvent[] }) => (
  <Section id={id} aria-labelledby={`${id}-heading`}>
    <div className="mb-8 flex items-center gap-4">
      <Hud index={index} label={title} className="m-rise" />
      <TickRail className="w-24" />
    </div>
    <h2 id={`${id}-heading`} className="sr-only">{title}</h2>
    <ul className="grid gap-5 lg:grid-cols-2">
      {events.map((ev, i) => <EventFrame key={ev.id} ev={ev} index={i} large={i === 0 && id !== 'past'} />)}
    </ul>
  </Section>
);

const EventsPage = () => {
  const [events, setEvents] = useState<CrunchEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const heroRef = useRevealOnMount<HTMLElement>();
  useEffect(() => watchPublicEvents(setEvents, () => { setFailed(true); setEvents([]); }), []);

  const live = (events ?? []).filter((e) => e.status === 'live');
  const upcoming = (events ?? []).filter((e) => UPCOMING.includes(e.status)).sort(byDate(1));
  const past = (events ?? []).filter((e) => PAST.includes(e.status)).sort(byDate(-1));

  return (
    <div className="min-h-screen">
      <Seo title="Events & Competitions | Crunch Fitness Club, Wakad" description="Competitions and challenges at Crunch Fitness Club, Wakad, Pune — register, follow the live leaderboard and see the results." image="/images/squat-1200.webp" />
      <main>
        <header ref={heroRef} className="relative isolate overflow-hidden border-b border-white/[0.06]">
          <div className="absolute inset-0 -z-10" aria-hidden>
            <img src="/images/squat-1200.webp" srcSet="/images/squat-560.webp 560w, /images/squat-1200.webp 1200w" sizes="100vw" alt="" className="m-settle h-full w-full object-cover object-[50%_35%] opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
          </div>
          <div className="container pb-14 pt-16 md:pb-20 md:pt-28">
            <Hud index="Crunch" label="Events" className="m-rise" />
            <h1 className="mt-6 font-display text-[clamp(4rem,2rem+9vw,10rem)] font-extrabold uppercase leading-[0.84] text-white">
              <span className="m-line"><span style={d(80)}>On the</span></span>
              <span className="m-line"><span style={d(160)} className="text-brand-400">floor.</span></span>
            </h1>
            <p className="m-rise mt-6 max-w-lg text-base leading-relaxed text-ink-300 md:text-lg" style={d(260)}>
              Competitions and challenges at Crunch — sign up, follow the live leaderboard, and see who took the win.
            </p>
          </div>
          <span className="m-fill-x absolute inset-x-0 bottom-0 h-px bg-brand-400/60" style={d(300)} aria-hidden />
        </header>

        {!events && <div className="container py-section"><div className="aspect-[16/9] animate-pulse rounded-2xl bg-ink-900" aria-label="Loading events" /></div>}

        {live.length > 0 && <Group id="live" index="Live" title="Happening now" events={live} />}
        {upcoming.length > 0 && <Group id="upcoming" index="Next" title="Upcoming" events={upcoming} />}
        {past.length > 0 && <Group id="past" index="Archive" title="Past events" events={past} />}

        {events && !live.length && !upcoming.length && !past.length && (
          <Section aria-labelledby="none-heading">
            <div className="max-w-2xl">
              <h2 id="none-heading" className="font-display text-display-lg font-extrabold uppercase text-white">
                <span className="m-line"><span>Nothing on the floor yet.</span></span>
              </h2>
              <p className="m-rise mt-5 text-lg text-ink-300" style={d(150)}>
                {failed ? 'Events couldn’t load right now — please try again in a moment.' : 'New challenges are coming soon. Follow us to hear first.'}
              </p>
              <div className="m-rise mt-8 flex flex-col gap-3 sm:flex-row" style={d(250)}>
                <Button asChild size="lg" variant="outline"><a href={SITE.instagram} target="_blank" rel="noopener noreferrer"><Instagram /> Follow on Instagram</a></Button>
                <Button asChild size="lg" variant="ghost"><Link to="/plans">Explore memberships <ArrowRight /></Link></Button>
              </div>
            </div>
          </Section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default EventsPage;
