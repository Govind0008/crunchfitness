// Public website content (plans, offers, team, blog list, Instagram highlights) kept in the
// visitor's browser for a while. The project runs on Firestore's free daily quota and every page
// view used to read these collections again (some through live listeners); now a visitor reads
// each one at most once per PUBLIC_CACHE_MS. Edits made in the admin reach returning visitors
// within that window. Only public, already-readable data is stored. Storage can be unavailable
// (private mode, blocked site data): then it simply reads, as before.

export const PUBLIC_CACHE_MS = 30 * 60_000;
const PREFIX = 'cf-public:';

interface Entry<T> { at: number; data: T }

/** The cached value if it's still fresh — lets a page render without waiting. */
export function peekPublic<T>(key: string, maxAgeMs = PUBLIC_CACHE_MS): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    return Date.now() - e.at < maxAgeMs ? e.data : null;
  } catch { return null; }
}

const inFlight = new Map<string, Promise<unknown>>();
/**
 * Fresh cached value, or load it once (concurrent callers on the same page share one read) and
 * keep it. Data must be plain JSON — Firestore timestamps come back as { seconds, nanoseconds }.
 */
export function readPublic<T>(key: string, load: () => Promise<T>, maxAgeMs = PUBLIC_CACHE_MS): Promise<T> {
  const kept = peekPublic<T>(key, maxAgeMs);
  if (kept !== null) return Promise.resolve(kept);
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = load().then((data) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data } satisfies Entry<T>)); } catch { /* full or blocked: still shown */ }
    return data;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
