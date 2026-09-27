import { useEffect, useRef } from 'react';
import { trackScroll } from '@/lib/motion';

/** Attach the shared scroll engine to an element; it receives `--sp` (0 → 1 through the viewport). */
export function useScrollVar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => (ref.current ? trackScroll(ref.current) : undefined), []);
  return ref;
}
