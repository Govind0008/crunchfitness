import type { CrunchEvent } from '@/lib/events';

/** Real gym photography used when an event has no cover yet (never presented as event photos). */
export const FALLBACK_COVER = { src: '/images/squat-1200.webp', srcSet: '/images/squat-560.webp 560w, /images/squat-1200.webp 1200w' };

export const coverOf = (ev: CrunchEvent) => (ev.coverImage ? { src: ev.coverImage, srcSet: undefined } : FALLBACK_COVER);

export const UPCOMING: CrunchEvent['status'][] = ['registration_open', 'registration_closed', 'check_in'];
export const PAST: CrunchEvent['status'][] = ['results_pending', 'results_published', 'archived'];

/** Remember passes on this device so a participant can find theirs again. */
export const savedPass = {
  get: (eventId: string) => { try { return localStorage.getItem(`crunch-pass:${eventId}`); } catch { return null; } },
  set: (eventId: string, passId: string) => { try { localStorage.setItem(`crunch-pass:${eventId}`, passId); } catch { /* private mode */ } },
};
