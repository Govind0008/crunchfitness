import { useSyncExternalStore } from 'react';

// Whether the staff app has finished booting in this page load. The branded boot screen covers
// the first entry into the admin only; once it has handed over, every later navigation uses
// skeletons. `ready` is set by the app itself (see markBootReady) — never by a timer.
let ready = false;
let done = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called when the first admin screen can actually be shown (access checked, page code loaded). */
export function markBootReady() { if (!ready) { ready = true; emit(); } }
/** Called by the boot screen once its exit transition has finished. */
export function markBootDone() { if (!done) { done = true; emit(); } }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useBootState = () => useSyncExternalStore(subscribe, () => (done ? 'done' : ready ? 'ready' : 'booting'));
