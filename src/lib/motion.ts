// Motion runtime — deliberately tiny. CSS does the animating; JS only decides *when*
// (reveal triggers) and *how far* (a single shared scroll loop writing --sp).

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Shared scroll engine ────────────────────────────────────────────────────────
// One passive scroll listener + one rAF for the whole page. Only elements currently
// near the viewport are measured, and the only write is a CSS custom property.

const tracked = new Set<HTMLElement>();
const active = new Set<HTMLElement>();
let observer: IntersectionObserver | null = null;
let frame = 0;
let listening = false;

const measure = () => {
  frame = 0;
  const vh = window.innerHeight;
  active.forEach((el) => {
    const r = el.getBoundingClientRect();
    const p = (vh - r.top) / (vh + r.height);
    el.style.setProperty('--sp', Math.min(1, Math.max(0, p)).toFixed(4));
  });
};

const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };

const ensureListening = () => {
  if (listening) return;
  listening = true;
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) active.add(el); else active.delete(el);
      });
      schedule();
    },
    { rootMargin: '20% 0px 20% 0px' },
  );
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
};

/** Register an element to receive `--sp` (0 → 1 as it crosses the viewport). */
export function trackScroll(el: HTMLElement) {
  if (prefersReducedMotion()) return () => {};
  ensureListening();
  tracked.add(el);
  observer!.observe(el);
  schedule();
  return () => {
    tracked.delete(el);
    active.delete(el);
    observer?.unobserve(el);
  };
}

// ── Count-up ───────────────────────────────────────────────────────────────────
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Animate `onUpdate(0 → target)`; resolves immediately under reduced motion. */
export function countUp(target: number, duration: number, onUpdate: (v: number) => void) {
  if (prefersReducedMotion()) { onUpdate(target); return () => {}; }
  let raf = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    onUpdate(Math.round(target * easeOutExpo(t)));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
