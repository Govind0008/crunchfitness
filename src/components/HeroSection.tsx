import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountUp, Hud } from '@/components/motion';
import { useScrollVar } from '@/hooks/useScrollVar';
import { cn } from '@/lib/utils';
import { getOpenStatus, getTodayHours } from '@/lib/site';

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

/**
 * Today's opening window on a 24-hour measurement rail, with a live "now" marker.
 * Real data from the posted hours — the one metric every visitor actually needs.
 */
const HoursTrack = ({ className }: { className?: string }) => {
  const [status, setStatus] = useState(getOpenStatus);
  useEffect(() => {
    const id = setInterval(() => setStatus(getOpenStatus()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { open, close, label } = getTodayHours();
  const nowPct = (status.hourNow / 24) * 100;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-white">
          <span className={cn('h-2 w-2 rounded-full', status.open ? 'bg-brand-400' : 'bg-ink-500')} aria-hidden />
          {status.label}
        </span>
        <span className="whitespace-nowrap text-ink-400">Today · {label}</span>
      </div>
      <div className="relative mt-3" aria-hidden>
        <span className="tick-rail block">
          <span
            className="tick-fill hero-bar"
            style={{ left: `${(open / 24) * 100}%`, right: `${100 - (close / 24) * 100}%`, ...d(1150) }}
          />
        </span>
        <span
          className="hero-drop absolute -top-1.5 h-[20px] w-0.5 -translate-x-1/2 rounded-full bg-white"
          style={{ left: `${nowPct}%`, ...d(1400) }}
        />
      </div>
    </div>
  );
};

/**
 * ARRIVE — the opening shot. One sequence (~1.2s; CTAs are clickable from the first frame):
 *   0.0  black field
 *   0.15 LOAD   — a lime floor line draws across the platform
 *   0.25        — CRUNCH / 01 identity marks appear
 *   0.35 DRIVE  — the photo lifts out of the floor line and settles
 *   0.55        — the headline drives up through its masks; STRENGTH wipes in sideways
 *   0.85        — supporting copy and CTAs settle
 *   1.0  LOCKOUT— the instrument strip below the floor loads (hours, members, coaches)
 * On scroll-out the camera pushes into the photo while the copy lifts away.
 */
const HeroSection = () => {
  const cameraRef = useScrollVar<HTMLElement>();
  return (
    <section
      ref={cameraRef}
      id="home"
      aria-labelledby="hero-heading"
      className="hero relative isolate overflow-hidden bg-ink-950"
    >
      {/* Photo frame — full-bleed at the top on small screens; the right half, down to the floor, on large */}
      <div className="hero-media absolute inset-x-0 top-0 -z-10 lg:left-auto">
        <div className="hero-camera-in h-full">
          <div className="hero-lift relative h-full overflow-hidden bg-ink-900" style={d(350)}>
            <img
              src="/images/hero-deadlift-640.webp"
              srcSet="/images/hero-deadlift-640.webp 640w, /images/hero-deadlift-1200.webp 1200w"
              sizes="(min-width: 1024px) 54vw, 100vw"
              alt="Member deadlifting a loaded barbell on the Crunch Fitness gym floor"
              width={1179}
              height={1239}
              {...{ fetchpriority: 'high' }}
              className="hero-settle h-full w-full object-cover object-[50%_30%] lg:object-[50%_40%]"
            />
            {/* Blend the frame into the black field so the headline can cross it */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-ink-950/10 lg:bg-gradient-to-r lg:from-ink-950 lg:via-ink-950/20 lg:to-transparent" />
            <div className="absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-ink-950/80 to-transparent lg:block" />
          </div>
        </div>
      </div>

      <div className="container relative flex min-h-[calc(100svh-var(--page-top))] flex-col">
        {/* Identity marks */}
        <div className="flex items-center justify-between pt-5 lg:pt-10">
          <Hud index="Crunch / 01" label="Wakad · Pune" className="hero-rise" style={d(250)} />
          {/* Performance rail — the instrument the rest of the site keeps returning to */}
          <span className="hero-rise hidden items-center gap-3 md:inline-flex" style={d(800)} aria-hidden>
            <span className="hud text-white/70">Strength</span>
            <span className="relative flex h-px w-28 items-center bg-white/20">
              <span className="hero-bar absolute inset-y-0 left-0 w-3/4 bg-brand-400" style={d(900)} />
              <span className="hero-drop absolute left-3/4 h-2 w-2 -translate-x-1/2 rounded-full bg-brand-400" style={d(1250)} />
            </span>
            <span className="hud text-white/70">Performance</span>
          </span>
        </div>

        {/* Headline + copy, standing on the floor line */}
        <div className="hero-copy hero-camera-out mt-auto">
          <h1
            id="hero-heading"
            className="font-display text-[clamp(3.5rem,1.2rem+9.6vw,10.5rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.01em] text-white"
          >
            <span className="m-line hero-line"><span style={d(550)}>Transform</span></span>
            <span className="m-line hero-line">
              <span style={d(630)}>
                your{' '}
                <span className="relative inline-block text-brand-400">
                  {/* The key word arrives on a different axis — driven in sideways */}
                  <span className="hero-wipe-x" style={d(780)}>strength</span>
                </span>
              </span>
            </span>
          </h1>

          <div className="mt-6 grid gap-7 pb-8 lg:mt-8 lg:max-w-[46%] lg:pb-10">
            <p className="hero-rise max-w-md text-base leading-relaxed text-ink-300 sm:text-lg" style={d(850)}>
              A strength-first gym with certified coaches on the floor, modern equipment and flexible
              memberships — whether it&apos;s your first session or your next PR.
            </p>
            <div className="hero-rise flex flex-col gap-3 sm:flex-row" style={d(930)}>
              <Button asChild size="lg">
                <Link to="/plans">
                  View membership plans
                  <ArrowRight className="transition-transform duration-200 group-hover/btn:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-ink-950/40 backdrop-blur-sm">
                <Link to="/contact">Book a free tour</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Instrument strip below the floor — real numbers only */}
        <div className="hero-strip relative grid grid-cols-2 gap-x-6 gap-y-6 py-6 lg:grid-cols-12 lg:items-center lg:gap-8 lg:py-0">
          {/* The platform — one full-bleed lime line the whole composition stands on */}
          <span className="hero-floor absolute top-0 h-px bg-brand-400" style={{ left: 'calc(50% - 50vw)', width: '100vw', ...d(150) }} aria-hidden />
          <HoursTrack className="hero-rise col-span-2 lg:col-span-5" />
          <dl className="hero-rise col-span-2 grid grid-cols-2 gap-6 lg:col-span-4 lg:col-start-7" style={d(1000)}>
            <div className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-ink-400">Members training</dt>
              <dd className="font-display text-4xl font-bold leading-none text-white"><CountUp value={500} suffix="+" delay={1050} /></dd>
            </div>
            <div className="flex flex-col-reverse border-l border-white/10 pl-6">
              <dt className="mt-1 text-sm text-ink-400">Certified coaches</dt>
              <dd className="font-display text-4xl font-bold leading-none text-white"><CountUp value={10} suffix="+" delay={1150} duration={1000} /></dd>
            </div>
          </dl>
          <div className="hero-rise hidden items-end justify-end gap-3 xl:col-span-2 xl:col-start-11 xl:flex" style={d(1100)} aria-hidden>
            <span className="hud">Scroll</span>
            <span className="hero-cue flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white">
              <ArrowDown className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

    </section>
  );
};

export default HeroSection;
