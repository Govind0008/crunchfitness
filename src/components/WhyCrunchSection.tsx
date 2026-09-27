import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section } from '@/components/site/Section';
import { Parallax, TickRail } from '@/components/motion';
import { useScrollVar } from '@/hooks/useScrollVar';

const PILLARS = [
  {
    title: 'Coaches on the floor',
    body: 'Certified trainers guide you from your first session — technique, programming and the push you need, at every experience level.',
  },
  {
    title: 'Equipment built for strength',
    body: 'Racks, free weights, selectorised machines, a dedicated cardio zone and a studio for group classes like Zumba.',
  },
  {
    title: 'Hours that fit real life',
    body: 'Open 6 AM to 10 PM Monday to Saturday and Sunday mornings, so training works around work and family.',
  },
];

const d = (ms: number) => ({ '--d': ms }) as CSSProperties;

const WhyCrunchSection = () => {
  // The pillar list's rail fills as the reader moves through it — sets completed
  const railRef = useScrollVar<HTMLOListElement>();

  return (
    <Section aria-labelledby="why-heading">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        {/* Layered imagery: three depths, each wiped in along a different axis */}
        <div className="relative order-last lg:order-first">
          <div className="grid grid-cols-5 gap-3">
            <Parallax depth={-36} className="col-span-3">
              <div className="m-wipe-up overflow-hidden rounded-2xl" style={d(100)}>
                <img
                  src="/images/coach-bench-640.webp"
                  srcSet="/images/coach-bench-640.webp 640w, /images/coach-bench-1200.webp 1200w"
                  sizes="(min-width: 1024px) 28vw, 60vw"
                  alt="Coach guiding a member through a dumbbell bench press"
                  loading="lazy"
                  width={640}
                  height={853}
                  className="m-settle aspect-[3/4] h-full w-full object-cover"
                  style={d(100)}
                />
              </div>
            </Parallax>
            <Parallax depth={28} className="col-span-2 flex flex-col gap-3 pt-10">
              <div className="m-wipe-left overflow-hidden rounded-2xl" style={d(320)}>
                <img
                  src="/images/squat-560.webp"
                  alt="Member squatting in the power rack"
                  loading="lazy"
                  width={560}
                  height={582}
                  className="m-settle aspect-square w-full object-cover"
                  style={d(320)}
                />
              </div>
              <div className="m-wipe-up overflow-hidden rounded-2xl" style={d(480)}>
                <img
                  src="/images/coach-cable-480.webp"
                  alt="Coach correcting form on the cable machine"
                  loading="lazy"
                  width={480}
                  height={568}
                  className="m-settle aspect-square w-full object-cover"
                  style={d(480)}
                />
              </div>
            </Parallax>
          </div>
        </div>

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

          <ol ref={railRef} className="relative mt-10 space-y-8">
            {/* Track + scroll-linked fill */}
            <span className="absolute bottom-2 left-[0.9rem] top-2 w-px bg-white/10" aria-hidden />
            <span className="scroll-fill-y absolute bottom-2 left-[0.9rem] top-2 w-px bg-brand-400" aria-hidden />
            {PILLARS.map((p, i) => (
              <li
                key={p.title}
                className="m-rack relative grid grid-cols-[2rem_1fr] gap-5"
                style={{ '--i': i, '--d': 300 } as CSSProperties}
              >
                <span
                  className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-ink-950 font-display text-sm font-bold text-brand-400 tabular-nums"
                  aria-hidden
                >
                  0{i + 1}
                </span>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold text-white">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-400 md:text-base">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="m-rise mt-10" style={d(600)}>
            <Link
              to="/team"
              className="link-drive inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400 transition-colors"
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
