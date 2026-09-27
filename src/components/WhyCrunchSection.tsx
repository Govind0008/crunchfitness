import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section } from '@/components/site/Section';
import { ChapterMark, TickRail } from '@/components/motion';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    title: 'Coaches on the floor',
    body: 'Certified trainers guide you from your first session — technique, programming and the push you need, at every experience level.',
    image: { src: '/images/coach-bench-1600.webp', mobile: '/images/coach-bench-640.webp', alt: 'Coach guiding a member through a dumbbell bench press', position: '50% 40%' },
  },
  {
    title: 'Equipment built for strength',
    body: 'Racks, free weights, selectorised machines, a dedicated cardio zone and a studio for group classes like Zumba.',
    image: { src: '/images/deadlift-1200.webp', mobile: '/images/deadlift-600.webp', alt: 'Loaded barbell on the powerlifting platform', position: '50% 50%' },
  },
  {
    title: 'Hours that fit real life',
    body: 'Open 6 AM to 10 PM Monday to Saturday and Sunday mornings, so training works around work and family.',
    image: { src: '/images/cardio-1600.webp', mobile: '/images/cardio-800.webp', alt: 'Treadmills and bikes along the windows in the cardio zone', position: '50% 50%' },
  },
];

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

/**
 * BUILD — the training journey. On large screens the image stage stays pinned while the
 * three "sets" scroll past: the set reaching mid-screen becomes active, its photo loads
 * over the previous one (bottom-up wipe), and the rail fills set by set.
 * Small screens get a vertical story: every set carries its own photo.
 */
const WhyCrunchSection = () => {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Active set = the step crossing the middle band of the viewport (IntersectionObserver, no scroll loop)
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <Section aria-labelledby="why-heading">
      <ChapterMark index="01" word="Build" />

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        {/* Pinned image stage (lg+) */}
        <div className="relative hidden lg:block">
          <div className="sticky top-[calc(var(--page-top)+2rem)] h-[min(78svh,720px)]">
            <div className="m-wipe-up relative h-full overflow-hidden rounded-2xl bg-ink-900" style={d(100)}>
              {STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className="journey-frame absolute inset-0"
                  data-state={i < active ? 'past' : i === active ? 'active' : 'next'}
                  style={{ zIndex: i }}
                >
                  <img
                    src={step.image.src}
                    alt={i === active ? step.image.alt : ''}
                    aria-hidden={i !== active}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className="h-full w-full object-cover"
                    style={{ objectPosition: step.image.position }}
                  />
                </div>
              ))}
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
              {/* Set counter */}
              <div className="absolute bottom-6 left-6 right-6 z-10 flex items-end justify-between gap-6" aria-hidden>
                <p className="font-display text-7xl font-extrabold leading-none text-white tabular-nums">
                  <span key={active} className="inline-block animate-[rise-in_0.6s_var(--ease-drive)_both]">0{active + 1}</span>
                  <span className="text-2xl text-white/40"> / 0{STEPS.length}</span>
                </p>
                <p className="max-w-[14rem] text-right text-sm font-medium text-white/80">{STEPS[active].title}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div>
          <p className="eyebrow mb-4">
            <TickRail className="w-8" />
            <span className="m-rise" style={d(120)}>Why Crunch</span>
          </p>
          <h2 id="why-heading" className="font-display text-display-md font-bold uppercase text-white text-balance">
            <span className="m-line"><span style={d(80)}>More than a</span></span>
            <span className="m-line"><span style={d(160)}>membership card</span></span>
          </h2>
          <p className="m-rise mt-4 max-w-xl text-base leading-relaxed text-ink-300 md:text-lg" style={d(260)}>
            We&apos;re a community gym in Wakad built around one idea: people get stronger faster when someone
            knowledgeable is in their corner.
          </p>

          <ol className="relative mt-12">
            {/* Rail: track + fill that loads one set at a time */}
            <span className="absolute bottom-6 left-[0.95rem] top-6 w-px bg-white/10" aria-hidden />
            <span
              className="absolute bottom-6 left-[0.95rem] top-6 w-px origin-top bg-brand-400 transition-transform duration-700 ease-out-expo"
              style={{ transform: `scaleY(${(active + 1) / STEPS.length})` }}
              aria-hidden
            />
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                ref={(el) => { stepRefs.current[i] = el; }}
                data-step={i}
                aria-current={i === active ? 'step' : undefined}
                className="journey-step relative grid grid-cols-[2rem_1fr] gap-5 py-6 lg:min-h-[52svh] lg:items-center"
                data-state={i < active ? 'past' : i === active ? 'active' : 'next'}
              >
                <span
                  className="journey-dot relative z-10 flex h-8 w-8 items-center justify-center self-start rounded-full border bg-ink-950 font-display text-sm font-bold tabular-nums lg:self-center"
                  aria-hidden
                >
                  0{i + 1}
                </span>
                <div className="journey-copy">
                  {/* Small screens: each set carries its own photo */}
                  <div className="m-wipe-up mb-5 overflow-hidden rounded-2xl lg:hidden">
                    <img
                      src={step.image.mobile}
                      alt={step.image.alt}
                      loading="lazy"
                      className="m-settle aspect-[4/3] w-full object-cover"
                      style={{ objectPosition: step.image.position }}
                    />
                  </div>
                  <h3 className="font-display text-2xl font-bold uppercase text-white md:text-3xl">{step.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-400 md:text-base">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="m-rise mt-6" style={d(200)}>
            <Link
              to="/team"
              className={cn('link-drive inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-brand-400')}
            >
              Meet the coaches <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default WhyCrunchSection;
