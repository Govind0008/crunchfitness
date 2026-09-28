import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Hud } from '@/components/motion';
import type { CrunchEvent } from '@/lib/events';

/**
 * Homepage "on the floor" band — renders nothing unless a real event is live or open.
 * Firestore and the events module load only when the band's slot nears the viewport.
 */
const EventsTeaser = () => {
  const slot = useRef<HTMLDivElement>(null);
  const [ev, setEv] = useState<CrunchEvent | null>(null);

  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    let unsub = () => {};
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      import('@/lib/events').then(({ watchPublicEvents }) => {
        unsub = watchPublicEvents((list) => {
          const pick = list.find((x) => x.status === 'live')
            ?? list.filter((x) => x.status === 'registration_open').sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
          setEv(pick ?? null);
        }, () => setEv(null));
      });
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => { io.disconnect(); unsub(); };
  }, []);

  return (
    <div ref={slot}>
      {ev && (
        <section aria-labelledby="teaser-heading" className="container py-10">
          <Link to={`/events/${ev.slug}`} className="group relative block overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900">
            <img src={ev.coverImage || '/images/squat-1200.webp'} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform [transition-duration:900ms] ease-out-expo group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-transparent" aria-hidden />
            <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-10">
              <div>
                <p className="flex items-center gap-3">
                  {ev.status === 'live'
                    ? <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white"><span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden />Live now</span>
                    : <Hud index="Events" label="Registration open" />}
                </p>
                <h2 id="teaser-heading" className="mt-4 font-display text-4xl font-extrabold uppercase leading-[0.9] text-white md:text-6xl">{ev.title}</h2>
                {ev.shortDescription && <p className="mt-3 max-w-lg text-ink-300">{ev.shortDescription}</p>}
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
                {ev.status === 'live' ? 'Follow the leaderboard' : 'See the event'} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </div>
          </Link>
        </section>
      )}
    </div>
  );
};

export default EventsTeaser;
