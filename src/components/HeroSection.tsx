import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountUp, Parallax, TickRail } from '@/components/motion';
import { useScrollVar } from '@/hooks/useScrollVar';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/utils';
import { getOpenStatus, getTodayHours } from '@/lib/site';

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

/**
 * Today's opening window on a 24-hour measurement rail, with a live "now" marker.
 * Real data from the posted hours — the one metric every visitor actually needs.
 */
const HoursTrack = () => {
  const [status, setStatus] = useState(getOpenStatus);
  useEffect(() => {
    const id = setInterval(() => setStatus(getOpenStatus()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { open, close, label } = getTodayHours();
  const nowPct = (status.hourNow / 24) * 100;

  return (
      <div className="hero-rise mt-8 max-w-lg" style={d(900)}>
        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
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
              style={{ left: `${(open / 24) * 100}%`, right: `${100 - (close / 24) * 100}%`, ...d(1050) }}
            />
          </span>
          <span
            className="hero-drop absolute -top-1.5 h-[20px] w-0.5 -translate-x-1/2 rounded-full bg-white"
            style={{ left: `${nowPct}%`, ...d(1350) }}
          />
          <div className="mt-2 flex justify-between text-[11px] tabular-nums text-ink-500">
            <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * ARRIVE — the opening chapter. Sequence (≈1.4s, CTAs clickable from frame one):
   * dark platform → lime floor line draws → the deadlift rises out of it → headline drives
   * through masks (STRENGTH wipes in sideways) → rail completes → metrics settle.
   * On scroll-out the camera pushes into the photo while the copy lifts away.
   */
  const HeroSection = () => {
    const cameraRef = useScrollVar<HTMLElement>();
  // Below lg the image column reveals on scroll (see .hero-lift media rules)
  const imageRef = useScrollReveal<HTMLDivElement>({ threshold: 0.2 });
    return (
    <section ref={cameraRef} id="home" aria-labelledby="hero-heading" className="relative overflow-hidden">
      {/* Background floor photo: fades up from black, drifts, and carries a little scroll weight */}
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <Parallax depth={80} className="hero-fade absolute -inset-y-12 inset-x-0">
          <img
            src="/images/floor-960.webp"
            srcSet="/images/floor-960.webp 960w, /images/floor-1920.webp 1920w"
            sizes="100vw"
            alt=""
            className="hero-drift h-full w-full object-cover opacity-[0.12] grayscale"
          />
        </Parallax>
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/40 via-ink-950/80 to-ink-950" />
      </div>

      <div className="container grid items-center gap-12 pb-16 pt-10 md:pt-14 lg:min-h-[calc(100svh-var(--page-top))] lg:grid-cols-12 lg:gap-8 lg:py-16">
        {/* Copy */}
        <div className="hero-camera-out lg:col-span-7 xl:col-span-6">
          <p className="eyebrow mb-6">
            <TickRail mode="hero" className="w-10" />
            <span className="hero-rise inline-flex items-center gap-2" style={d(150)}>
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Wakad, Pune
            </span>
          </p>

          {/* Kinetic headline — each line drives up out of its own mask */}
          <h1 id="hero-heading" className="font-display text-display-xl font-extrabold uppercase text-white">
            <span className="m-line hero-line"><span style={d(300)}>Transform</span></span>
            <span className="m-line hero-line">
              <span style={d(380)}>
                your{' '}
                <span className="relative inline-block text-brand-400">
                  {/* The key word arrives on a different axis — driven in sideways */}
                  <span className="hero-wipe-x" style={d(540)}>strength</span>
                  {/* A measurement rail loads beneath the word once it lands */}
                  <TickRail mode="hero" delay={880} className="absolute -bottom-2 left-0 w-full md:-bottom-3" />
                </span>
              </span>
            </span>
          </h1>

          <p className="hero-rise mt-7 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg" style={d(620)}>
            Crunch Fitness Club is a strength-first gym with certified coaches on the floor, modern
            equipment and flexible memberships — whether it&apos;s your first session or your next PR.
          </p>

          <div className="hero-rise mt-9 flex flex-col gap-3 sm:flex-row" style={d(700)}>
            <Button asChild size="lg">
              <Link to="/plans">
                View membership plans
                <ArrowRight className="transition-transform duration-200 group-hover/btn:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">Book a free tour</Link>
            </Button>
          </div>

          <dl className="hero-rise mt-12 grid max-w-lg grid-cols-2 gap-6 border-t border-white/10 pt-6" style={d(800)}>
            <div className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-ink-400">Members training</dt>
              <dd className="font-display text-4xl font-bold text-white sm:text-5xl"><CountUp value={500} suffix="+" delay={850} /></dd>
            </div>
            <div className="flex flex-col-reverse border-l border-white/10 pl-6">
              <dt className="mt-1 text-sm text-ink-400">Certified coaches</dt>
              <dd className="font-display text-4xl font-bold text-white sm:text-5xl"><CountUp value={10} suffix="+" delay={950} duration={1000} /></dd>
            </div>
          </dl>

          <HoursTrack />
        </div>

        {/* Imagery — the photo is lifted into frame, then settles; layers move at different depths */}
        <div ref={imageRef} className="relative lg:col-span-5 xl:col-span-6">
          <div className="hero-camera-in relative">
            <div className="hero-lift relative aspect-square w-full overflow-hidden rounded-2xl bg-ink-900 sm:aspect-[16/10] lg:aspect-[4/5] xl:aspect-[5/6]">
              <Parallax depth={-60} className="absolute -inset-y-10 inset-x-0">
                <img
                  src="/images/hero-deadlift-640.webp"
                  srcSet="/images/hero-deadlift-640.webp 640w, /images/hero-deadlift-1200.webp 1200w"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  alt="Member deadlifting a loaded barbell on the Crunch Fitness gym floor"
                  width={1179}
                  height={1239}
                  {...{ fetchpriority: 'high' }}
                  className="hero-settle h-full w-full object-cover object-[50%_35%] sm:object-[50%_72%] lg:object-[50%_35%]"
                />
              </Parallax>
            </div>
            {/* The platform: a lime floor line is drawn first, and the photo rises out of it */}
            <span className="hero-floor absolute -bottom-3 left-0 right-0 h-0.5 rounded-full bg-brand-400/80" style={d(0)} aria-hidden />
          </div>

          <Parallax depth={40} className="absolute -bottom-8 -left-2 hidden w-40 sm:block md:w-48 lg:-left-10 xl:w-56">
            <figure className="hero-wipe overflow-hidden rounded-xl border-4 border-ink-950" style={d(1000)}>
              <img
                src="/images/coach-spot-480.webp"
                alt="Crunch coach spotting a member on the incline press"
                width={480}
                height={534}
                className="aspect-[4/5] w-full object-cover"
              />
              <figcaption className="bg-ink-950 px-3 py-2 text-xs font-medium text-ink-300">Coached, not left alone</figcaption>
            </figure>
          </Parallax>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
