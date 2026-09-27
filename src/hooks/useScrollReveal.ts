import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * Adds `.revealed` to the element once it enters the viewport, which releases the
 * motion primitives (.m-rise, .m-line, .m-wipe-*, …) declared inside it.
 * Fires slightly before the element is fully in view so motion finishes as it's read.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);
  const opts = useRef(options);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('revealed');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el); // once — motion marks arrival, it doesn't repeat
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px', ...opts.current },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Reveal on mount (next frame) — for above-the-fold content like page headers. */
export function useRevealOnMount<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => el.classList.add('revealed'));
    return () => cancelAnimationFrame(id);
  }, []);
  return ref;
}
