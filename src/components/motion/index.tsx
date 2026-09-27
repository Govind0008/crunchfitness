import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { countUp, prefersReducedMotion } from '@/lib/motion';
import { useScrollVar } from '@/hooks/useScrollVar';

/** Content that drifts a few pixels against the scroll — weight, not parallax. */
export const Parallax = ({ depth, className, children }: { depth: number; className?: string; children: ReactNode }) => {
  const ref = useScrollVar<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('parallax', className)} style={{ '--depth': depth } as CSSProperties}>
      {children}
    </div>
  );
};

interface TickRailProps {
  /** 0 → 1, how much of the rail is loaded */
  fill?: number;
  className?: string;
  /** 'reveal' waits for a `.revealed` ancestor; 'hero' plays on load */
  mode?: 'reveal' | 'hero';
  delay?: number;
}

/** The progression motif: measurement ticks with a lime fill that loads in. */
export const TickRail = ({ fill = 1, className, mode = 'reveal', delay = 0 }: TickRailProps) => (
  <span className={cn('tick-rail block', className)} aria-hidden>
    <span
      className={cn('tick-fill', mode === 'hero' ? 'hero-bar' : 'm-fill-x')}
      style={(mode === 'hero'
        ? { '--d': delay, right: `${(1 - fill) * 100}%` }
        : { '--d': delay, '--fill': fill }) as unknown as CSSProperties}
    />
  </span>
);

interface CountUpProps {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
  /** Delay (ms) after entering view */
  delay?: number;
}

/**
 * Counts from 0 to a real value when it scrolls into view. Width is reserved by an
 * invisible copy of the final value so digits never cause layout shift.
 */
export const CountUp = ({ value, suffix = '', duration = 1400, className, delay = 0 }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) { setDisplay(value); return; }
    let stop = () => {};
    let timer = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      timer = window.setTimeout(() => { stop = countUp(value, duration, setDisplay); }, delay);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); stop(); };
  }, [value, duration, delay]);

  return (
    <span ref={ref} className={cn('inline-grid tabular-nums', className)}>
      <span className="invisible col-start-1 row-start-1" aria-hidden>{value}{suffix}</span>
      <span className="col-start-1 row-start-1" aria-hidden>{display}{suffix}</span>
      <span className="sr-only">{value}{suffix}</span>
    </span>
  );
};

/**
 * Editorial chapter opener for the homepage's signature sections (Training Journey).
 * Decorative: the section's real heading follows it. The large word drifts a little
 * against the scroll, like a title card sliding past the camera.
 */
export const ChapterMark = ({ index, word, className }: { index: string; word: string; className?: string }) => {
  const ref = useScrollVar<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('mb-10 md:mb-14', className)} aria-hidden>
      <div className="flex items-center gap-4">
        <span className="m-rise font-display text-sm font-bold tabular-nums tracking-[0.2em] text-brand-400">{index}</span>
        <TickRail className="w-24 md:w-40" />
      </div>
      <div className="chapter-word mt-3">
        <span className="m-line"><span className="text-outline" style={{ '--d': 120 } as CSSProperties}>{word}</span></span>
      </div>
    </div>
  );
};
