import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// The staff app's boot screen — "The Rep": LOAD (the bar draws, plates slide on and settle)
// → LOCK (the lime line completes) → LIFT (a small lockout) → ENTER (the screen rises away and
// the shell settles in). Inline SVG + CSS keyframes on transform/opacity only; styles live in
// index.css under "Boot loader".
//
// It never delays the app on its own: it leaves as soon as `ready` is true AND the ~1s sequence
// has finished (no minimum at all with reduced motion). If the app takes longer, the line keeps
// a slow sweep so it never looks frozen; after 8s it offers a reload; after 25s it steps aside
// so whatever the app is showing (an error, a retry) is visible — it can't hang forever.

const SEQUENCE_MS = 1000;
const EXIT_MS = 320;
const SLOW_MS = 8000;
const GIVE_UP_MS = 25_000;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function CrunchBootLoader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduced = useRef(reducedMotion()).current;
  const [sequenced, setSequenced] = useState(reduced);
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const light = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light';

  // The sequence is a visual floor, not a delay: it runs while the app loads underneath
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setSequenced(true), SEQUENCE_MS);
    return () => clearTimeout(t);
  }, [reduced]);
  useEffect(() => {
    const s = setTimeout(() => setSlow(true), SLOW_MS);
    const g = setTimeout(() => setLeaving(true), GIVE_UP_MS);
    return () => { clearTimeout(s); clearTimeout(g); };
  }, []);
  useEffect(() => { if (ready && sequenced) setLeaving(true); }, [ready, sequenced]);
  useEffect(() => {
    if (!leaving) return;
    // The shell settles in underneath as the screen rises away
    document.documentElement.classList.add('boot-reveal');
    const t = setTimeout(onDone, reduced ? 120 : EXIT_MS);
    const r = setTimeout(() => document.documentElement.classList.remove('boot-reveal'), 900);
    return () => { clearTimeout(t); clearTimeout(r); };
  }, [leaving, onDone, reduced]);

  return (
    <div
      className={cn('boot-screen fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink-950 px-6 text-white', reduced && 'boot-reduced', sequenced && !ready && 'boot-waiting', leaving && 'boot-leaving')}
      role="status" aria-live="polite" aria-busy={!leaving} aria-label="Loading the Crunch admin"
      data-boot-loader
    >
      <div className="boot-stage flex w-full max-w-xs flex-col items-center">
        <img src={light ? '/images/logo-light.webp' : '/images/logo.webp'} alt="Crunch Fitness" width={406} height={light ? 257 : 286}
          className="boot-logo h-16 w-auto sm:h-[4.5rem]" decoding="async" />
        <p className="boot-eyebrow mt-3 font-sans text-[11px] font-bold uppercase tracking-[0.32em] text-ink-400">Admin</p>

        {/* The barbell: bar, sleeves, collars; heavy plates (lime) then light plates */}
        <svg viewBox="0 0 280 64" className="boot-barbell mt-7 h-auto w-60 overflow-visible sm:w-72" aria-hidden focusable="false">
          <g className="boot-lift">
            <g className="boot-bar" fill="currentColor">
              <rect x="30" y="30" width="220" height="4" rx="2" opacity="0.55" />
              <rect x="14" y="28.5" width="42" height="7" rx="2" opacity="0.8" />
              <rect x="224" y="28.5" width="42" height="7" rx="2" opacity="0.8" />
              <rect x="56" y="24" width="4" height="16" rx="1" />
              <rect x="220" y="24" width="4" height="16" rx="1" />
            </g>
            <g className="boot-plate boot-plate-l1"><rect x="44" y="6" width="11" height="52" rx="3" className="fill-brand-400" /></g>
            <g className="boot-plate boot-plate-r1"><rect x="225" y="6" width="11" height="52" rx="3" className="fill-brand-400" /></g>
            <g className="boot-plate boot-plate-l2" fill="currentColor"><rect x="34" y="14" width="8" height="36" rx="2.5" /></g>
            <g className="boot-plate boot-plate-r2" fill="currentColor"><rect x="238" y="14" width="8" height="36" rx="2.5" /></g>
          </g>
        </svg>

        <div className="boot-track relative mt-5 h-0.5 w-40 overflow-hidden rounded-full bg-white/[0.1]">
          <span className="boot-line absolute inset-0 origin-left rounded-full bg-brand-400" />
          <span className="boot-sweep absolute inset-y-0 left-0 w-1/3 rounded-full bg-brand-400/70" />
        </div>
        <p className="boot-caption mt-4 text-sm text-ink-400">{reduced ? 'Loading…' : 'Loading your workspace'}</p>
        {slow && !leaving && (
          <p className="mt-3 text-center text-xs text-ink-500">
            Taking longer than usual. <button type="button" onClick={() => window.location.reload()} className="font-semibold text-brand-fg underline-offset-2 hover:underline">Reload</button>
          </p>
        )}
      </div>
    </div>
  );
}
