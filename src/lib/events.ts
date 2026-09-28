// Crunch Events — one source of truth for the event model, lifecycle, ranking and every
// Firestore read/write. Admin screens and public pages both go through this module.
import {
  collection, doc, getDocs, increment, limit, onSnapshot, orderBy, query, runTransaction,
  serverTimestamp, where, writeBatch, type DocumentData, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Model ──────────────────────────────────────────────────────────────────────

export type EventStatus =
  | 'draft' | 'registration_open' | 'registration_closed' | 'check_in'
  | 'live' | 'results_pending' | 'results_published' | 'archived';

export type ScoringType = 'weight' | 'reps' | 'time' | 'distance' | 'points';

export interface Category {
  id: string;
  name: string;
  scoring: ScoringType;
  unit: string;
  /** Which score wins — never assumed: set explicitly per category */
  direction: 'higher' | 'lower';
}

export interface CrunchEvent {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImage: string;
  location: string;
  /** YYYY-MM-DD */
  eventDate: string;
  /** HH:mm */
  startTime: string;
  endTime: string;
  /** datetime-local strings (local time), optional */
  registrationOpenAt: string;
  registrationCloseAt: string;
  capacity: number | null;
  registrationEnabled: boolean;
  status: EventStatus;
  categories: Category[];
  eligibility: string;
  rules: string;
  currentCategoryId: string | null;
  paused: boolean;
  registrationCount: number;
  checkedInCount: number;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  publishedAt?: Timestamp | null;
  resultsPublishedAt?: Timestamp | null;
}

export type RegistrationStatus = 'registered' | 'checked_in' | 'no_show';

export interface Registration {
  id: string;
  number: number;
  name: string;
  phone: string;
  email: string;
  categoryId: string;
  status: RegistrationStatus;
  /** Participant agreed to show their name on public leaderboards/results */
  showName: boolean;
  passId: string;
  createdAt?: Timestamp;
  checkedInAt?: Timestamp | null;
  checkedInBy?: string | null;
}

export interface Pass {
  id: string;
  registrationId: string;
  number: number;
  name: string;
  categoryId: string;
}

export interface Result {
  /** = registration id: one result per participant */
  id: string;
  categoryId: string;
  /** What the public sees — the name only if the participant agreed, else "Athlete CR-024" */
  displayName: string;
  number: number;
  score: number;
  unit: string;
  /** Manual position; null = ranked automatically from the score */
  position: number | null;
  /** Shown on the live leaderboard while the event is LIVE */
  public: boolean;
  updatedAt?: Timestamp;
}

export interface Media {
  id: string;
  type: 'photo' | 'video';
  url: string;
  storagePath: string;
  caption: string;
  kind: 'highlight' | 'winner';
  visible: boolean;
  createdAt?: Timestamp;
}

export interface Activity {
  id: string;
  action: string;
  actorUid: string;
  actorEmail: string;
  refId: string | null;
  meta: Record<string, string | number | boolean | null>;
  at?: Timestamp;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

export const PUBLIC_STATUSES: EventStatus[] = [
  'registration_open', 'registration_closed', 'check_in', 'live', 'results_pending', 'results_published', 'archived',
];

/** Plain-language labels. `admin` is what staff see; `public` is the event page badge. */
export const STATUS: Record<EventStatus, { admin: string; public: string }> = {
  draft:               { admin: 'Draft',               public: 'Coming soon' },
  registration_open:   { admin: 'Registration open',   public: 'Registration open' },
  registration_closed: { admin: 'Registration closed', public: 'Registration closed' },
  check_in:            { admin: 'Check-in',            public: 'Check-in open' },
  live:                { admin: 'Live',                public: 'Live now' },
  results_pending:     { admin: 'Results pending',     public: 'Results coming soon' },
  results_published:   { admin: 'Results published',   public: 'Results are in' },
  archived:            { admin: 'Archived',            public: 'Past event' },
};

export interface NextStep {
  /** What the admin should do next, in one sentence */
  explain: string;
  action?: { label: string; to: EventStatus; confirm?: { title: string; body: string } };
}

/** The one thing to do next for each stage — the admin never has to guess. */
export function nextStep(ev: CrunchEvent): NextStep {
  switch (ev.status) {
    case 'draft':
      return {
        explain: 'This event is only visible to staff. Open registration when the details are final.',
        action: { label: 'Open registration', to: 'registration_open', confirm: { title: 'Open registration?', body: 'The event will appear on the website and people can sign up.' } },
      };
    case 'registration_open':
      return {
        explain: 'People can sign up on the website. Close registration when entries are complete.',
        action: { label: 'Close registration', to: 'registration_closed', confirm: { title: 'Close registration?', body: 'No one else will be able to sign up. You can reopen it later.' } },
      };
    case 'registration_closed':
      return {
        explain: 'Entries are closed. On event day, start check-in as participants arrive.',
        action: { label: 'Start check-in', to: 'check_in' },
      };
    case 'check_in':
      return {
        explain: 'Check participants in as they arrive. Start the competition when you are ready.',
        action: { label: 'Start competition', to: 'live', confirm: { title: 'Start this event?', body: 'The public website will now show the event as LIVE.' } },
      };
    case 'live':
      return {
        explain: 'The event is live on the website. Enter results as each category finishes.',
        action: { label: 'Complete event', to: 'results_pending', confirm: { title: 'Complete the event?', body: 'The live leaderboard will be hidden until you publish the final results.' } },
      };
    case 'results_pending':
      return {
        explain: 'Check the results and winners, then publish them to the website.',
        action: { label: 'Publish results', to: 'results_published', confirm: { title: 'Publish results?', body: 'Winners and all results will be shown on the website.' } },
      };
    case 'results_published':
      return {
        explain: 'Results are live on the website. Add photos from the day, then archive the event when you are done.',
        action: { label: 'Archive event', to: 'archived' },
      };
    case 'archived':
      return { explain: 'This event is in the public archive with its results and photos.' };
  }
}

// ── Formatting & ranking ───────────────────────────────────────────────────────

export const SCORING: Record<ScoringType, { label: string; unit: string; direction: Category['direction']; hint: string }> = {
  weight:   { label: 'Weight lifted', unit: 'kg',   direction: 'higher', hint: 'Heaviest wins' },
  reps:     { label: 'Repetitions',   unit: 'reps', direction: 'higher', hint: 'Most reps wins' },
  time:     { label: 'Time',          unit: 'time', direction: 'lower',  hint: 'Fastest wins' },
  distance: { label: 'Distance',      unit: 'm',    direction: 'higher', hint: 'Furthest wins' },
  points:   { label: 'Points',        unit: 'pts',  direction: 'higher', hint: 'Most points wins' },
};

/** "Heaviest wins", "Fastest wins" … or a literal rule when the direction is non-standard. */
export function winsLabel(cat: Pick<Category, 'scoring' | 'direction'>) {
  const s = SCORING[cat.scoring];
  if (cat.direction === s.direction) return s.hint;
  return cat.direction === 'higher' ? 'Highest score wins' : 'Lowest score wins';
}

export const passNumber = (n: number) => `CR-${String(n).padStart(3, '0')}`;

/** "1:05.3" style times are stored as seconds */
export function parseScore(input: string, scoring: ScoringType): number | null {
  const v = input.trim();
  if (!v) return null;
  if (scoring === 'time' && v.includes(':')) {
    const parts = v.split(':').map(Number);
    if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatScore(score: number, cat: Pick<Category, 'scoring' | 'unit'>) {
  if (cat.scoring === 'time') {
    const m = Math.floor(score / 60);
    const s = score - m * 60;
    const ss = s.toFixed(s % 1 ? 1 : 0).padStart(s % 1 ? 4 : 2, '0');
    return m ? `${m}:${ss}` : `${ss}s`;
  }
  const n = Number.isInteger(score) ? String(score) : score.toFixed(1);
  return `${n} ${cat.unit}`.trim();
}

export interface Ranked extends Result { rank: number }

/**
 * Rank one category's results. Manual positions win; otherwise results are ordered by
 * score in the category's explicit direction, with ties sharing a rank (1, 2, 2, 4).
 */
export function rankCategory(results: Result[], cat: Category): Ranked[] {
  const mine = results.filter((r) => r.categoryId === cat.id);
  const sign = cat.direction === 'higher' ? -1 : 1;
  const sorted = [...mine].sort((a, b) => {
    if (a.position != null || b.position != null) return (a.position ?? Infinity) - (b.position ?? Infinity);
    return sign * (a.score - b.score) || a.number - b.number;
  });
  let prev: Ranked | null = null;
  return sorted.map((r, i) => {
    const rank = r.position ?? (prev && prev.position == null && prev.score === r.score ? prev.rank : i + 1);
    prev = { ...r, rank };
    return prev;
  });
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);

export function formatEventDate(date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
}

export function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Why registration can't be used right now (null = it can). Rules enforce status + capacity. */
export function registrationBlocker(ev: CrunchEvent, now = new Date()): string | null {
  if (ev.status !== 'registration_open' || !ev.registrationEnabled) return 'Registration is closed.';
  if (ev.registrationOpenAt && now < new Date(ev.registrationOpenAt)) return `Registration opens ${new Date(ev.registrationOpenAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`;
  if (ev.registrationCloseAt && now > new Date(ev.registrationCloseAt)) return 'Registration has closed.';
  if (ev.capacity != null && ev.registrationCount >= ev.capacity) return 'This event is full.';
  return null;
}

// ── Reads ──────────────────────────────────────────────────────────────────────

const eventsCol = () => collection(db, 'events');
const withId = <T,>(d: { id: string; data: () => DocumentData }) => ({ id: d.id, ...d.data() }) as T;

export function normalizeEvent(e: Partial<CrunchEvent> & { id: string }): CrunchEvent {
  return {
    title: '', slug: '', shortDescription: '', description: '', coverImage: '', location: '',
    eventDate: '', startTime: '', endTime: '', registrationOpenAt: '', registrationCloseAt: '',
    capacity: null, registrationEnabled: true, status: 'draft', categories: [], eligibility: '', rules: '',
    currentCategoryId: null, paused: false, registrationCount: 0, checkedInCount: 0, createdBy: '',
    ...e,
  };
}

/** Public list — every event except drafts (the rules require this exact constraint). */
export function watchPublicEvents(cb: (events: CrunchEvent[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(eventsCol(), where('status', 'in', PUBLIC_STATUSES)),
    (snap) => cb(snap.docs.map((d) => normalizeEvent(withId(d)))),
    onError,
  );
}

/** One public event by slug, live — the page re-renders the moment staff change its status. */
export function watchEventBySlug(slug: string, cb: (ev: CrunchEvent | null) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(eventsCol(), where('slug', '==', slug), where('status', 'in', PUBLIC_STATUSES), limit(1)),
    (snap) => cb(snap.empty ? null : normalizeEvent(withId(snap.docs[0]))),
    onError,
  );
}

/** Public results: only leaderboard-flagged ones while LIVE, everything once published. */
export function watchPublicResults(ev: CrunchEvent, cb: (r: Result[]) => void): Unsubscribe | null {
  const col = collection(db, 'events', ev.id, 'results');
  if (ev.status === 'live') return onSnapshot(query(col, where('public', '==', true)), (s) => cb(s.docs.map((d) => withId<Result>(d))), () => cb([]));
  if (ev.status === 'results_published' || ev.status === 'archived') return onSnapshot(col, (s) => cb(s.docs.map((d) => withId<Result>(d))), () => cb([]));
  return null;
}

export async function getPublicMedia(eventId: string): Promise<Media[]> {
  const snap = await getDocs(query(collection(db, 'events', eventId, 'media'), where('visible', '==', true)));
  return snap.docs.map((d) => withId<Media>(d)).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
}

export async function getPass(eventId: string, passId: string): Promise<Pass | null> {
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'events', eventId, 'passes', passId));
  return snap.exists() ? withId<Pass>(snap) : null;
}

// Admin reads (the rules only allow these for admins)
export const watchAllEvents = (cb: (e: CrunchEvent[]) => void, onError?: (e: Error) => void) =>
  onSnapshot(query(eventsCol(), orderBy('eventDate', 'desc')), (s) => cb(s.docs.map((d) => normalizeEvent(withId(d)))), onError);
export const watchEvent = (id: string, cb: (e: CrunchEvent | null) => void, onError?: (e: Error) => void) =>
  onSnapshot(doc(db, 'events', id), (s) => cb(s.exists() ? normalizeEvent(withId(s)) : null), onError);
export const watchRegistrations = (id: string, cb: (r: Registration[]) => void) =>
  onSnapshot(query(collection(db, 'events', id, 'registrations'), orderBy('number', 'asc')), (s) => cb(s.docs.map((d) => withId<Registration>(d))));
export const watchResults = (id: string, cb: (r: Result[]) => void) =>
  onSnapshot(collection(db, 'events', id, 'results'), (s) => cb(s.docs.map((d) => withId<Result>(d))));
export const watchMedia = (id: string, cb: (m: Media[]) => void) =>
  onSnapshot(query(collection(db, 'events', id, 'media'), orderBy('createdAt', 'asc')), (s) => cb(s.docs.map((d) => withId<Media>(d))));
export const watchActivity = (id: string, cb: (a: Activity[]) => void) =>
  onSnapshot(query(collection(db, 'events', id, 'activity'), orderBy('at', 'desc'), limit(200)), (s) => cb(s.docs.map((d) => withId<Activity>(d))));

// ── Public registration ────────────────────────────────────────────────────────

export interface RegistrationInput { name: string; phone: string; email: string; categoryId: string; showName: boolean }

const randomId = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Register in one transaction: bump the event's count by one and create the registration
 * (id = the new count) and its public pass together. The rules only accept exactly this
 * shape, so numbers can't collide and capacity can't be exceeded.
 */
export async function register(eventId: string, input: RegistrationInput): Promise<{ number: number; passId: string }> {
  const passId = randomId();
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'events', eventId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This event no longer exists.');
    const ev = normalizeEvent(withId(snap));
    const blocked = registrationBlocker(ev);
    if (blocked) throw new Error(blocked);
    const n = ev.registrationCount + 1;
    const regId = String(n);
    tx.update(ref, { registrationCount: n });
    tx.set(doc(db, 'events', eventId, 'registrations', regId), {
      name: input.name.trim(), phone: input.phone.trim(), phoneKey: input.phone.replace(/\D/g, '').slice(-10), email: input.email.trim(), categoryId: input.categoryId,
      number: n, status: 'registered', showName: input.showName, passId, createdAt: serverTimestamp(),
    });
    tx.set(doc(db, 'events', eventId, 'passes', passId), {
      registrationId: regId, number: n, name: input.name.trim(), categoryId: input.categoryId, createdAt: serverTimestamp(),
    });
    return { number: n, passId };
  });
}

// ── Admin writes — every change and its activity entry commit together ─────────

export interface Actor { uid: string; email: string }

type Batch = ReturnType<typeof writeBatch>;
function log(b: Batch, eventId: string, actor: Actor, action: string, refId: string | null = null, meta: Activity['meta'] = {}) {
  b.set(doc(collection(db, 'events', eventId, 'activity')), {
    action, actorUid: actor.uid, actorEmail: actor.email, refId, meta, at: serverTimestamp(),
  });
}

export type EventDraft = Omit<CrunchEvent, 'id' | 'status' | 'registrationCount' | 'checkedInCount' | 'createdBy' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'resultsPublishedAt' | 'currentCategoryId' | 'paused'>;

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base || 'event';
  for (let i = 2; i < 50; i++) {
    const snap = await getDocs(query(eventsCol(), where('slug', '==', slug), limit(1)));
    if (snap.empty || snap.docs[0].id === ignoreId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createEvent(draft: EventDraft, actor: Actor, openNow: boolean): Promise<string> {
  const ref = doc(eventsCol());
  const slug = await uniqueSlug(slugify(draft.slug || `${draft.title} ${draft.eventDate.slice(0, 4)}`));
  const b = writeBatch(db);
  b.set(ref, {
    ...draft, slug, status: 'draft', registrationCount: 0, checkedInCount: 0, currentCategoryId: draft.categories[0]?.id ?? null,
    paused: false, createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), publishedAt: null, resultsPublishedAt: null,
  });
  log(b, ref.id, actor, 'Event created', ref.id, { title: draft.title });
  await b.commit();
  if (openNow) await setStatus(ref.id, 'draft', 'registration_open', actor);
  return ref.id;
}

export async function updateEvent(id: string, draft: EventDraft, actor: Actor) {
  const slug = await uniqueSlug(slugify(draft.slug || draft.title), id);
  const b = writeBatch(db);
  b.update(doc(db, 'events', id), { ...draft, slug, updatedAt: serverTimestamp() });
  log(b, id, actor, 'Event details updated', id);
  await b.commit();
}

/** Public-facing copy only — what the marketing desk edits on any event (the rules allow exactly these fields). */
export type EventContent = Pick<CrunchEvent, 'title' | 'shortDescription' | 'description' | 'location' | 'eligibility' | 'rules'>;
export async function updateEventContent(id: string, content: EventContent, actor: Actor) {
  const b = writeBatch(db);
  b.update(doc(db, 'events', id), { ...content, title: content.title.trim(), updatedAt: serverTimestamp() });
  log(b, id, actor, 'Event page text updated', id);
  await b.commit();
}

const STATUS_ACTIVITY: Partial<Record<EventStatus, string>> = {
  registration_open: 'Registration opened', registration_closed: 'Registration closed', check_in: 'Check-in started',
  live: 'Competition started', results_pending: 'Event completed', results_published: 'Results published', archived: 'Event archived',
};

export async function setStatus(id: string, from: EventStatus, to: EventStatus, actor: Actor) {
  const b = writeBatch(db);
  const patch: DocumentData = { status: to, updatedAt: serverTimestamp() };
  if (from === 'draft' && to === 'registration_open') patch.publishedAt = serverTimestamp();
  if (to === 'results_published') patch.resultsPublishedAt = serverTimestamp();
  if (to === 'live') patch.paused = false;
  b.update(doc(db, 'events', id), patch);
  log(b, id, actor, (from === 'results_published' && to === 'results_pending') ? 'Results unpublished' : STATUS_ACTIVITY[to] ?? `Status changed to ${STATUS[to].admin}`, id, { from, to });
  await b.commit();
}

export async function setLiveState(id: string, patch: { currentCategoryId?: string; paused?: boolean }, actor: Actor, label: string) {
  const b = writeBatch(db);
  b.update(doc(db, 'events', id), { ...patch, updatedAt: serverTimestamp() });
  log(b, id, actor, label, id, patch as Activity['meta']);
  await b.commit();
}

export async function setRegistrationStatus(ev: CrunchEvent, reg: Registration, to: RegistrationStatus, actor: Actor) {
  const b = writeBatch(db);
  const was = reg.status;
  b.update(doc(db, 'events', ev.id, 'registrations', reg.id), {
    status: to,
    checkedInAt: to === 'checked_in' ? serverTimestamp() : null,
    checkedInBy: to === 'checked_in' ? actor.email : null,
  });
  const delta = (to === 'checked_in' ? 1 : 0) - (was === 'checked_in' ? 1 : 0);
  if (delta) b.update(doc(db, 'events', ev.id), { checkedInCount: increment(delta) });
  const action = to === 'checked_in' ? 'Participant checked in' : to === 'no_show' ? 'Marked as no-show' : 'Check-in undone';
  log(b, ev.id, actor, action, reg.id, { name: reg.name, number: passNumber(reg.number) });
  await b.commit();
}

export async function saveResult(ev: CrunchEvent, reg: Registration, cat: Category, score: number, position: number | null, isPublic: boolean, actor: Actor, existed: boolean) {
  const b = writeBatch(db);
  b.set(doc(db, 'events', ev.id, 'results', reg.id), {
    categoryId: cat.id, displayName: reg.showName ? reg.name : `Athlete ${passNumber(reg.number)}`, number: reg.number,
    score, unit: cat.unit, position, public: isPublic, updatedAt: serverTimestamp(),
  });
  log(b, ev.id, actor, existed ? 'Result updated' : 'Result entered', reg.id, { name: reg.name, category: cat.name, score: formatScore(score, cat) });
  await b.commit();
}

export async function deleteResult(ev: CrunchEvent, resultId: string, actor: Actor) {
  const b = writeBatch(db);
  b.delete(doc(db, 'events', ev.id, 'results', resultId));
  log(b, ev.id, actor, 'Result removed', resultId);
  await b.commit();
}

// ── Media (the site's existing Cloudinary account, loaded only here) ──────────

export async function uploadMedia(ev: CrunchEvent, file: File, kind: Media['kind'], actor: Actor, onProgress?: (pct: number) => void): Promise<Media> {
  const { uploadToCloudinary } = await import('@/lib/cloudinary');
  const type: Media['type'] = file.type.startsWith('video/') ? 'video' : 'photo';
  const { url, publicId } = await uploadToCloudinary(file, onProgress);
  const b = writeBatch(db);
  const mref = doc(collection(db, 'events', ev.id, 'media'));
  const media = { type, url, storagePath: publicId, caption: '', kind, visible: false };
  b.set(mref, { ...media, createdAt: serverTimestamp() });
  log(b, ev.id, actor, type === 'video' ? 'Video uploaded' : 'Photo uploaded', mref.id, { file: file.name });
  await b.commit();
  return { id: mref.id, ...media };
}

export async function updateMedia(ev: CrunchEvent, m: Media, patch: Partial<Pick<Media, 'visible' | 'caption' | 'kind'>>, actor: Actor, label: string) {
  const b = writeBatch(db);
  b.update(doc(db, 'events', ev.id, 'media', m.id), patch);
  log(b, ev.id, actor, label, m.id);
  await b.commit();
}

export async function setCover(ev: CrunchEvent, m: Media, actor: Actor) {
  const b = writeBatch(db);
  b.update(doc(db, 'events', ev.id), { coverImage: m.url, updatedAt: serverTimestamp() });
  log(b, ev.id, actor, 'Cover photo changed', m.id);
  await b.commit();
}

/** Removes the photo from the event and the website. (The file stays in the Cloudinary library —
 *  unsigned browser uploads can't delete; remove it there if it must be gone entirely.) */
export async function deleteMedia(ev: CrunchEvent, m: Media, actor: Actor) {
  const b = writeBatch(db);
  b.delete(doc(db, 'events', ev.id, 'media', m.id));
  if (ev.coverImage === m.url) b.update(doc(db, 'events', ev.id), { coverImage: '', updatedAt: serverTimestamp() });
  log(b, ev.id, actor, 'Media deleted', m.id);
  await b.commit();
}

/**
 * Delete an event and everything under it — registrations, passes, results, photos, activity.
 * The event goes in the first batch; the rules only allow its records to be removed with it.
 * (Uploaded files stay in the Cloudinary library.)
 */
export async function deleteEvent(ev: CrunchEvent) {
  const subs = ['registrations', 'passes', 'results', 'media', 'activity'];
  const snaps = await Promise.all(subs.map((c) => getDocs(collection(db, 'events', ev.id, c))));
  const refs = [doc(db, 'events', ev.id), ...snaps.flatMap((s) => s.docs.map((d) => d.ref))];
  for (let i = 0; i < refs.length; i += 450) {
    const b = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => b.delete(r));
    await b.commit();
  }
}
