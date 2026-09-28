import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Hud, TickRail } from '@/components/motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { prefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Frame {
  word: string;
  title: string;
  body: string;
  image: { src: string; srcSet: string; alt: string; position?: string };
  /** Landscape photos get a wide frame — the strip's rhythm comes from varying widths */
  wide?: boolean;
}

// Real facts only — each set restates something the gym already publishes elsewhere on the site
const FRAMES: Frame[] = [
  {
    word: 'Foundation',
    title: 'Coached from day one',
    body: 'Certified trainers guide you from your first session — technique, programming and the push you need, at every experience level.',
    image: { src: '/images/coach-mobility-1600.webp', srcSet: '/images/coach-mobility-640.webp 640w, /images/coach-mobility-1600.webp 1600w', alt: 'Coach guiding a member through a mobility drill on the turf', position: '50% 55%' },
  },
  {
    word: 'Strength',
    title: 'The powerlifting platform',
    body: 'A dedicated powerlifting area with competition-standard equipment — Olympic-grade platforms, calibrated plates and professional barbells.',
    image: { src: '/images/deadlift-1200.webp', srcSet: '/images/deadlift-600.webp 600w, /images/deadlift-1200.webp 1200w', alt: 'Loaded barbell resting on the powerlifting platform', position: '50% 60%' },
  },
  {
    word: 'Performance',
    title: 'A coach for your goal',
    body: 'Strength, fat loss, functional training, nutrition and women’s fitness — specialists on the floor every day to guide your sessions.',
    image: { src: '/images/squat-1200.webp', srcSet: '/images/squat-560.webp 560w, /images/squat-1200.webp 1200w', alt: 'Member squatting a loaded barbell in the rack', position: '50% 40%' },
  },
  {
    word: 'Discipline',
    title: 'Hours that fit real life',
    body: 'Open 6 AM to 10 PM Monday to Saturday and Sunday mornings, so training works around work and family.',
    image: { src: '/images/cardio-1600.webp', srcSet: '/images/cardio-800.webp 800w, /images/cardio-1600.webp 1600w', alt: 'Treadmills and bikes along the windows in the cardio zone', position: '50% 50%' },
    wide: true,
  },
];

const pinTop = (section: HTMLElement) => parseFloat(getComputedStyle(section.querySelector('.film-pin')!).top) || 0;
const pad = (n: number) => String(n).padStart(2, '0');
const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

/** One set in the strip. Reveals as it slides (or scrolls) into view. */
const FilmFrame = ({ frame, index }: { frame: Frame; index: number }) => {
  const ref = useScrollReveal<HTMLLIElement>({ threshold: 0.25, rootMargin: '0px' });
  return (
    <li ref={ref} className={cn('film-frame', frame.wide && 'film-frame--wide')} data-frame={index}>
      <figure className="flex h-full flex-col">
        <div className="film-media m-wipe-up relative overflow-hidden rounded-2xl bg-ink-900 lg:rounded-none">
          {/* Depth: the photo drifts slightly against the strip's travel (lg, driven by --fx) */}
          <div className="film-depth absolute inset-0">
            <img
              src={frame.image.src}
              srcSet={frame.image.srcSet}
              sizes={frame.wide ? '(min-width: 1024px) 70vw, 100vw' : '(min-width: 1024px) 40vw, 100vw'}
              alt={frame.image.alt}
              loading="lazy"
              className="m-settle h-full w-full object-cover"
              style={{ objectPosition: frame.image.position }}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" aria-hidden />
          {/* Set number — typography as an object, sitting on the photo's base line */}
          <span className="film-num absolute bottom-0 left-4 font-display font-extrabold leading-[0.78] text-white lg:left-6" aria-hidden>
            <span className="m-line"><span style={d(250)}>{pad(index + 1)}</span></span>
          </span>
        </div>
        <figcaption className="mt-5 grid gap-2 lg:mt-6 xl:grid-cols-[auto_1fr] xl:gap-x-8">
          <p className="m-rise hud text-brand-400 xl:pt-1.5" style={d(300)}>{frame.word}</p>
          <div>
            <h3 className="m-rise font-display text-2xl font-bold uppercase text-white md:text-3xl" style={d(360)}>{frame.title}</h3>
            <p className="m-rise mt-2 max-w-md text-sm leading-relaxed text-ink-400 md:text-base" style={d(420)}>{frame.body}</p>
          </div>
        </figcaption>
      </figure>
    </li>
  );
};

/**
 * 01 BUILD — the signature horizontal chapter. On large screens (with motion allowed) the
 * section pins and vertical scroll drives the strip sideways like a film running through a
 * gate; each set wipes in as it arrives, and the HUD counts the sets. Everywhere else it is
 * a plain vertical story — no forced horizontal gesture on touch.
 */
const FilmStrip = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const introRef = useScrollReveal<HTMLDivElement>();
  const geom = useRef({ dist: 0, pinned: false, starts: [] as number[], centers: [] as number[], frames: [] as HTMLElement[] });

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;
    const mq = window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)');
    let frame = 0;

    const pin = section.querySelector<HTMLElement>('.film-pin')!;
    // The sticky offset, resolved to px (the navbar + offer banner height)
    const pageTop = () => pinTop(section);

    const update = () => {
      frame = 0;
      const g = geom.current;
      if (!g.pinned) return;
      const p = Math.min(1, Math.max(0, (pageTop() - section.getBoundingClientRect().top) / g.dist));
      const x = p * g.dist;
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      // Active set: the last frame whose left edge has crossed 55% of the viewport
      const edge = x + window.innerWidth * 0.55;
      let a = 0;
      g.starts.forEach((s, i) => { if (s <= edge) a = i; });
      // Depth: each photo is offset by its distance from the screen centre (-1 → 1)
      const vw = window.innerWidth;
      g.frames.forEach((el, i) => {
        const off = (g.centers[i] - x - vw / 2) / vw;
        el.style.setProperty('--fx', Math.max(-1.2, Math.min(1.2, off)).toFixed(3));
        // Spotlight: the frame in the gate is lit, the rest of the strip sits back
        el.dataset.state = i === a ? 'active' : 'rest';
      });
      setActive((cur) => (cur === a ? cur : a));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    const measure = () => {
      const g = geom.current;
      g.pinned = mq.matches && !prefersReducedMotion();
      if (!g.pinned) {
        section.style.height = '';
        track.style.transform = '';
        track.querySelectorAll<HTMLElement>('.film-frame').forEach((el) => delete el.dataset.state);
        return;
      }
      const vh = pin.offsetHeight;
      g.dist = Math.max(0, track.scrollWidth - window.innerWidth);
      g.frames = [...track.querySelectorAll<HTMLElement>('.film-frame')];
      g.starts = g.frames.map((el) => el.offsetLeft);
      g.centers = g.frames.map((el) => el.offsetLeft + el.offsetWidth / 2);
      // Scroll length = the horizontal travel, plus the pinned viewport itself
      section.style.height = `${g.dist + vh}px`;
      schedule();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    mq.addEventListener('change', measure);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mq.removeEventListener('change', measure);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Keyboard users: tabbing into an off-screen part of the strip scrolls the page to it
  const onFocus = useCallback((e: React.FocusEvent) => {
    const g = geom.current;
    const section = sectionRef.current;
    if (!g.pinned || !section || !trackRef.current) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>('li');
    if (!item) return;
    // Browsers without overflow:clip scroll the pin to the focused element — undo that
    const pin = section.querySelector<HTMLElement>('.film-pin');
    if (pin) pin.scrollLeft = 0;
    const x = Math.min(g.dist, Math.max(0, item.offsetLeft + item.offsetWidth - window.innerWidth * 0.9));
    const top = section.getBoundingClientRect().top + window.scrollY - pinTop(section);
    window.scrollTo({ top: top + x, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <section ref={sectionRef} id="method" aria-labelledby="method-heading" className="film relative">
      <div className="film-pin">
        {/* HUD: chapter, set counter and a progress rail that loads with the strip */}
        <div className="film-hud container hidden items-center gap-6" aria-hidden>
          <Hud index="01" label="Build" />
          <span className="relative h-px flex-1 bg-white/10">
            <span ref={fillRef} className="absolute inset-0 origin-left bg-brand-400" style={{ transform: 'scaleX(0)' }} />
          </span>
          <span className="hud text-white">
            Set <span key={active} className="inline-block animate-[rise-in_0.5s_var(--ease-drive)_both] text-brand-400">{pad(active + 1)}</span>
            <span className="text-ink-500">/ {pad(FRAMES.length)}</span>
            <span className="h-px w-5 bg-white/25" />
            <span key={`w-${active}`} className="inline-block min-w-[7.5rem] animate-[rise-in_0.5s_var(--ease-drive)_both]">{FRAMES[active].word}</span>
          </span>
        </div>

        {/* Title card behind the strip — the set's word, set huge in outline, changing with the set */}
        <p className="film-title pointer-events-none absolute inset-x-0 bottom-[-0.14em] hidden overflow-hidden" aria-hidden>
          <span key={active} className="film-title-word block whitespace-nowrap">{FRAMES[active].word}</span>
        </p>

        <ol ref={trackRef} className="film-track" onFocus={onFocus}>
          {/* Intro card — the chapter title */}
          <li className="film-intro">
            <div ref={introRef} className="reveal flex h-full flex-col justify-center">
              <Hud index="01" label="The Crunch method" className="m-rise lg:hidden" />
              <p className="chapter-word mt-4 text-white lg:mt-0" aria-hidden>
                <span className="m-line"><span style={d(80)}>Build<span className="text-brand-400">.</span></span></span>
              </p>
              <h2 id="method-heading" className="m-rise mt-6 max-w-md font-display text-display-sm font-bold uppercase text-white" style={d(200)}>
                More than a membership card
              </h2>
              <p className="m-rise mt-4 max-w-md text-base leading-relaxed text-ink-300 md:text-lg" style={d(280)}>
                We&apos;re a community gym in Wakad built around one idea: people get stronger faster when someone
                knowledgeable is in their corner.
              </p>
              <div className="film-hint m-rise mt-8 hidden items-center gap-3" style={d(360)} aria-hidden>
                <TickRail className="w-16" />
                <span className="hud">Scroll to train</span>
              </div>
            </div>
          </li>

          {FRAMES.map((frame, i) => <FilmFrame key={frame.word} frame={frame} index={i} />)}

          {/* Outro — releases the visitor back into the page */}
          <li className="film-outro">
            <div className="flex h-full flex-col justify-center">
              <p className="font-display text-display-md font-bold uppercase leading-none text-white">
                Four sets.<br /><span className="text-brand-400">One team.</span>
              </p>
              <Link
                to="/team"
                className="link-drive mt-8 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-brand-400"
              >
                Meet the coaches <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
};

export default FilmStrip;
