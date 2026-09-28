// Members — the gym's authoritative membership list (Firestore `members`).
//
// Definitions (used everywhere, never approximated):
//   Total members   every document in `members` (never Auth users, trainers, admins, enquiries or event sign-ups)
//   Active          status "active" AND (no expiry, or expiry ≥ today)
//   Expiring soon   active with an expiry within the next N days (Settings → expiringSoonDays)
//   Inactive        total − active (manually inactive, or expiry passed)
//
// `activeUntil` is derived on every write so all of the above are single-field range counts
// (no downloading the list, no counters that can drift):
//   active + expiry E → E · active, no expiry → "9999-12-31" · inactive → "0000-00-00"
import {
  collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp,
  startAfter, where, writeBatch, type QueryDocumentSnapshot, type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { phoneKey } from './phone';
import { logTo, type AdminActor } from './activity';

export type ManualStatus = 'active' | 'inactive';
export type MemberState = 'active' | 'expiring' | 'expired' | 'inactive';

export interface Member {
  id: string;
  name: string;
  phone: string;
  email: string;
  planId: string | null;
  membershipStart: string | null;   // YYYY-MM-DD
  membershipEnd: string | null;     // YYYY-MM-DD
  status: ManualStatus;
  activeUntil: string;
  trainerId: string | null;          // teamMembers id
  /** Link to the trainer portal's client record (training data lives there) */
  trainerClient: { trainerId: string; clientId: string } | null;
  notes: string;
  source: 'manual' | 'import' | 'trainer_client';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type MemberInput = Pick<Member, 'name' | 'phone' | 'email' | 'planId' | 'membershipStart' | 'membershipEnd' | 'status' | 'trainerId' | 'notes'>;

const FOREVER = '9999-12-31';
const NEVER = '0000-00-00';

/** Today in Pune, as YYYY-MM-DD. */
export const todayIST = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
export const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};

/** "3 Months" → 3 months after start; "1 Day" → same day. Only used as a suggestion. */
export function periodEnd(start: string, duration: string | undefined) {
  if (!start || !duration) return null;
  const m = duration.match(/(\d+)\s*(day|week|month|year)/i);
  if (!m) return null;
  const n = Number(m[1]); const unit = m[2].toLowerCase();
  const d = new Date(`${start}T00:00:00`);
  if (unit === 'day') d.setDate(d.getDate() + n - 1);
  if (unit === 'week') d.setDate(d.getDate() + n * 7 - 1);
  if (unit === 'month') { d.setMonth(d.getMonth() + n); d.setDate(d.getDate() - 1); }
  if (unit === 'year') { d.setFullYear(d.getFullYear() + n); d.setDate(d.getDate() - 1); }
  return new Intl.DateTimeFormat('en-CA').format(d);
}

export const activeUntilOf = (m: Pick<Member, 'status' | 'membershipEnd'>) =>
  m.status === 'inactive' ? NEVER : m.membershipEnd || FOREVER;

export function memberState(m: Pick<Member, 'status' | 'membershipEnd'>, expiringDays: number, today = todayIST()): MemberState {
  if (m.status === 'inactive') return 'inactive';
  if (m.membershipEnd && m.membershipEnd < today) return 'expired';
  if (m.membershipEnd && m.membershipEnd <= addDays(today, expiringDays)) return 'expiring';
  return 'active';
}

export const STATE_LABEL: Record<MemberState, string> = { active: 'Active', expiring: 'Expiring soon', expired: 'Expired', inactive: 'Inactive' };

const col = () => collection(db, 'members');
const toMember = (d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, ...d.data() }) as Member;

/** Fields derived from input — search keys and status range. */
function derived(input: MemberInput) {
  return {
    name: input.name.trim(),
    nameLower: input.name.trim().toLowerCase(),
    phone: input.phone.trim(),
    phoneKey: phoneKey(input.phone),
    email: input.email.trim(),
    emailLower: input.email.trim().toLowerCase(),
    planId: input.planId || null,
    membershipStart: input.membershipStart || null,
    membershipEnd: input.membershipEnd || null,
    status: input.status,
    activeUntil: activeUntilOf({ status: input.status, membershipEnd: input.membershipEnd || null }),
    trainerId: input.trainerId || null,
    notes: input.notes.trim(),
  };
}

export function validateMember(input: MemberInput): string[] {
  const e: string[] = [];
  if (input.name.trim().length < 2) e.push('Enter the member’s full name.');
  if (phoneKey(input.phone).length !== 10) e.push('Enter a 10-digit mobile number.');
  if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) e.push('The email address doesn’t look right.');
  if (input.membershipStart && input.membershipEnd && input.membershipEnd < input.membershipStart) e.push('The expiry date must be after the start date.');
  return e;
}

// ── Counts (server-side aggregation — nothing is downloaded) ──────────────────

export interface MemberCounts { total: number; active: number; inactive: number; expiring: number; withExpiry: number }

export async function memberCounts(expiringDays: number): Promise<MemberCounts> {
  const today = todayIST();
  const [total, active, expiring, withExpiry] = await Promise.all([
    getCountFromServer(col()),
    getCountFromServer(query(col(), where('activeUntil', '>=', today))),
    getCountFromServer(query(col(), where('activeUntil', '>=', today), where('activeUntil', '<=', addDays(today, expiringDays)))),
    getCountFromServer(query(col(), where('membershipEnd', '!=', null))),
  ]);
  const t = total.data().count, a = active.data().count;
  return { total: t, active: a, inactive: t - a, expiring: expiring.data().count, withExpiry: withExpiry.data().count };
}

// ── Lists & search (paged, indexed single-field queries) ──────────────────────

export type MemberFilter = 'all' | 'active' | 'expiring' | 'inactive';
export const PAGE = 50;

export async function listMembers(filter: MemberFilter, expiringDays: number, after?: QueryDocumentSnapshot) {
  const today = todayIST();
  const base = {
    all: query(col(), orderBy('nameLower')),
    active: query(col(), where('activeUntil', '>=', today), orderBy('activeUntil')),
    expiring: query(col(), where('activeUntil', '>=', today), where('activeUntil', '<=', addDays(today, expiringDays)), orderBy('activeUntil')),
    inactive: query(col(), where('activeUntil', '<', today), orderBy('activeUntil', 'desc')),
  }[filter];
  const snap = await getDocs(after ? query(base, startAfter(after), limit(PAGE)) : query(base, limit(PAGE)));
  return { members: snap.docs.map(toMember), last: snap.docs[snap.docs.length - 1], more: snap.size === PAGE };
}

/** Name / phone / email prefix search, or an exact member ID. Returns at most 20. */
export async function searchMembers(raw: string): Promise<Member[]> {
  const q = raw.trim();
  if (!q) return [];
  const prefix = (field: string, v: string) => getDocs(query(col(), orderBy(field), where(field, '>=', v), where(field, '<=', `${v}`), limit(20)));
  const digits = q.replace(/\D/g, '');
  const tasks: Promise<Member[]>[] = [];
  if (digits.length >= 3 && digits.length === q.replace(/[\s+()-]/g, '').length) {
    // Phone: stored as the last 10 digits — search from the start of the local number
    tasks.push(prefix('phoneKey', digits.slice(-10).replace(/^91(?=\d{10}$)/, '')).then((s) => s.docs.map(toMember)));
  } else if (q.includes('@')) {
    tasks.push(prefix('emailLower', q.toLowerCase()).then((s) => s.docs.map(toMember)));
  } else {
    tasks.push(prefix('nameLower', q.toLowerCase()).then((s) => s.docs.map(toMember)));
  }
  if (/^[A-Za-z0-9]{15,}$/.test(q)) tasks.push(getDoc(doc(col(), q)).then((s) => (s.exists() ? [toMember(s)] : [])));
  const all = (await Promise.all(tasks)).flat();
  return all.filter((m, i) => all.findIndex((x) => x.id === m.id) === i);
}

export async function getMember(id: string) {
  const s = await getDoc(doc(col(), id));
  return s.exists() ? toMember(s) : null;
}

/** Existing members with any of these phone keys (duplicate detection). */
export async function membersByPhoneKeys(keys: string[]): Promise<Map<string, Member>> {
  const found = new Map<string, Member>();
  const unique = [...new Set(keys.filter((k) => k.length === 10))];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await getDocs(query(col(), where('phoneKey', 'in', unique.slice(i, i + 30))));
    snap.docs.forEach((d) => found.set(d.data().phoneKey as string, toMember(d)));
  }
  return found;
}

/** Renewals due: memberships that have expired, or expire within the window — soonest / most overdue first.
 *  (Members with no expiry, or marked inactive, aren't "due".) */
export async function membersDue(expiringDays: number) {
  const snap = await getDocs(query(col(), where('activeUntil', '>', '0000-00-00'), where('activeUntil', '<=', addDays(todayIST(), expiringDays)), orderBy('activeUntil'), limit(500)));
  return snap.docs.map(toMember);
}

export async function membersOfTrainer(trainerId: string) {
  const snap = await getDocs(query(col(), where('trainerId', '==', trainerId), limit(200)));
  return snap.docs.map(toMember).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Writes (each commits with its activity entry) ─────────────────────────────

export class DuplicateMemberError extends Error {
  constructor(public existing: Member) { super(`${existing.name} already has this phone number.`); }
}

export async function createMember(input: MemberInput, actor: AdminActor, source: Member['source'] = 'manual', trainerClient: Member['trainerClient'] = null) {
  const dup = (await membersByPhoneKeys([phoneKey(input.phone)])).get(phoneKey(input.phone));
  if (dup) throw new DuplicateMemberError(dup);
  const ref = doc(col());
  const b = writeBatch(db);
  b.set(ref, { ...derived(input), trainerClient, source, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: actor.email });
  logTo(b, actor, 'Member created', 'member', ref.id, { name: input.name.trim(), source });
  await b.commit();
  return ref.id;
}

export async function updateMember(m: Member, input: MemberInput, actor: AdminActor) {
  const key = phoneKey(input.phone);
  if (key !== phoneKey(m.phone)) {
    const dup = (await membersByPhoneKeys([key])).get(key);
    if (dup && dup.id !== m.id) throw new DuplicateMemberError(dup);
  }
  const next = derived(input);
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => k !== 'nameLower' && k !== 'emailLower' && k !== 'phoneKey' && k !== 'activeUntil' && (m as unknown as Record<string, unknown>)[k] !== next[k]);
  const b = writeBatch(db);
  b.update(doc(col(), m.id), { ...next, updatedAt: serverTimestamp() });
  logTo(b, actor, 'Member updated', 'member', m.id, { name: next.name, fields: changed.join(', ') || 'none' });
  await b.commit();
}

export async function linkTrainerClient(m: Member, link: Member['trainerClient'], actor: AdminActor) {
  const b = writeBatch(db);
  b.update(doc(col(), m.id), { trainerClient: link, ...(link ? { trainerId: link.trainerId } : {}), updatedAt: serverTimestamp() });
  logTo(b, actor, link ? 'Linked to trainer client record' : 'Unlinked trainer client record', 'member', m.id, { name: m.name });
  await b.commit();
}

export async function deleteMember(m: Member, actor: AdminActor) {
  const b = writeBatch(db);
  b.delete(doc(col(), m.id));
  logTo(b, actor, 'Member deleted', 'member', m.id, { name: m.name });
  await b.commit();
}

/** Write many new members (already validated + de-duplicated by the caller). */
export async function importMembers(rows: (MemberInput & { trainerClient?: Member['trainerClient'] })[], actor: AdminActor, source: Member['source']) {
  let written = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const b = writeBatch(db);
    rows.slice(i, i + 400).forEach((r) => {
      b.set(doc(col()), { ...derived(r), trainerClient: r.trainerClient ?? null, source, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: actor.email });
    });
    logTo(b, actor, source === 'import' ? 'Members imported (CSV)' : 'Members added from trainer clients', 'member', null, { count: Math.min(400, rows.length - i) });
    await b.commit();
    written += Math.min(400, rows.length - i);
  }
  return written;
}

export async function setLinks(pairs: { member: Member; link: NonNullable<Member['trainerClient']> }[], actor: AdminActor) {
  for (let i = 0; i < pairs.length; i += 400) {
    const b = writeBatch(db);
    pairs.slice(i, i + 400).forEach(({ member, link }) => b.update(doc(col(), member.id), { trainerClient: link, trainerId: member.trainerId ?? link.trainerId, updatedAt: serverTimestamp() }));
    logTo(b, actor, 'Members linked to trainer client records', 'member', null, { count: Math.min(400, pairs.length - i) });
    await b.commit();
  }
}


/** Short, readable member ID for staff and members (derived from the record id — stable, no counter). */
export const memberCode = (id: string) => `M-${id.slice(0, 6).toUpperCase()}`;
