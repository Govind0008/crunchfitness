import { useEffect, useRef } from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref.
 * When the element enters the viewport, adds the 'revealed' class
 * which triggers the CSS reveal animation defined in index.css.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el); // animate once
        }
      },
      { threshold: 0.12, ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
