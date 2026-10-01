// What a member has bought, period by period — kept apart from the member record itself:
//
//   memberships/{id}  — gym membership periods (history). The member document still holds the
//                       CURRENT plan/start/expiry, which drives status, counts, dues and access.
//   ptPackages/{id}   — personal training packages. PT is its own thing: it never extends a gym
//                       membership and never grants door access.
//
// Both are written by admins only (payment recording, or the legacy import), never deleted.
import { collection, doc as fsDoc, getDocs, increment, limit, query, serverTimestamp, where, type Timestamp } from 'firebase/firestore';
import { writeBatch } from '@/lib/admin/writes';
import { logTo, type AdminActor } from './activity';
import { db } from '@/lib/firebase';

/** Where a record came from, for imported history. */
export interface LegacyRef {
  file: string;
  sheet: string;
  row: number;               // spreadsheet row number (1 = header)
  srNo: string | null;       // the sheet's own "Sr No", when present (not unique in every sheet)
  key: string;               // deterministic migration key (file + sheet + row + the row's own fields)
  /** Same payment whatever file or row it came from — how a copy in another file is recognised */
  fingerprint?: string;
  highlight: string | null;  // cell fill colour in the sheet (meaning not recorded)
  /** Every sheet row behind this record (a membership paid in two instalments has two) */
  rows?: number[];
  /** The sheet's own words, kept as written */
  packageRaw?: string;
  methodRaw?: string | null;
  comment?: string | null;
  feedback?: string | null;
}

/** The sheet's free-form "bal" / "Bal Amt" column, kept as evidence — never treated as money owed. */
export interface LegacyBalance {
  /** A number found in the column: a CANDIDATE balance, unconfirmed */
  legacyBalanceAmountPaise?: number | null;
  /** The text as written ("AM(A/C)", "2000 bal", "nill", "bal paid") */
  legacyBalanceText?: string | null;
  /** Older imports stored the same text under this name */
  legacyBalanceNote?: string | null;
}
export const balanceText = (b: LegacyBalance | undefined) => b?.legacyBalanceText ?? b?.legacyBalanceNote ?? null;

/** How the sheet described the package — the original wording is always kept alongside. */
export interface LegacyPackage {
  originalPackageLabel?: string;
  /** "8 months", "1 day" */
  normalizedDuration?: string | null;
  packageType?: 'regular' | 'bonus' | 'upgrade' | 'day' | null;
  baseMonths?: number | null;
  bonusMonths?: number | null;
  totalMonths?: number | null;
  days?: number | null;
}

export interface MembershipRecord extends LegacyBalance, LegacyPackage {
  id: string;
  memberId: string;
  planId: string | null;
  /** What it was called at the time ("12 Months", or the sheet's "12 month") */
  planLabel: string;
  /** YYYY-MM-DD. Only imported history can lack dates (a day pass the sheet gave no dates for). */
  startDate: string | null;
  endDate: string | null;
  paymentId: string | null;
  source: 'payment' | 'legacy_excel';
  legacy?: LegacyRef;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface PtPackage extends LegacyBalance, LegacyPackage {
  id: string;
  memberId: string;
  /** teamMembers id — only when actually known */
  trainerId: string | null;
  packageName: string;
  /** Only when stated; imported sheets don't say, so these stay empty */
  sessionsIncluded: number | null;
  /** Sessions done so far (packages with a session count) */
  sessionsUsed?: number;
  /** Only from imported history when a sheet stated it; otherwise derived — see sessionsLeft() */
  sessionsRemaining: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string;
  paymentId: string | null;
  source: 'payment' | 'legacy_excel';
  legacy?: LegacyRef;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PeriodState = 'current' | 'upcoming' | 'past' | 'unknown';
/** Current / past from the dates alone — an old record never looks active. */
export function periodState(r: { startDate: string | null; endDate: string | null }, today: string): PeriodState {
  if (!r.endDate) return 'unknown';
  if (r.endDate < today) return 'past';
  if (r.startDate && r.startDate > today) return 'upcoming';
  return 'current';
}
export const PERIOD_LABEL: Record<PeriodState, string> = { current: 'Current', upcoming: 'Starts later', past: 'Ended', unknown: 'Dates not recorded' };

const byEndDesc = <T extends { endDate: string | null; startDate: string | null }>(a: T, b: T) =>
  (b.endDate ?? '').localeCompare(a.endDate ?? '') || (b.startDate ?? '').localeCompare(a.startDate ?? '');

export async function membershipsOf(memberId: string): Promise<MembershipRecord[]> {
  const snap = await getDocs(query(collection(db, 'memberships'), where('memberId', '==', memberId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipRecord).sort(byEndDesc);
}
export async function ptPackagesOf(memberId: string): Promise<PtPackage[]> {
  const snap = await getDocs(query(collection(db, 'ptPackages'), where('memberId', '==', memberId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PtPackage).sort(byEndDesc);
}

/** The PT package running today, if any (the latest-ending one). */
export const currentPt = (list: PtPackage[], today: string) => list.find((p) => periodState(p, today) === 'current') ?? null;

// ── PT package lifecycle ──────────────────────────────────────────────────────

/** Sessions left, when the package has a session count; otherwise unknown. */
export const sessionsLeft = (p: Pick<PtPackage, 'sessionsIncluded' | 'sessionsUsed' | 'sessionsRemaining'>) =>
  p.sessionsIncluded != null ? Math.max(0, p.sessionsIncluded - (p.sessionsUsed ?? 0)) : p.sessionsRemaining ?? null;
/** Paid = a payment is linked to the package. Imported packages always came with their payment. */
export const ptPaid = (p: Pick<PtPackage, 'paymentId'>) => !!p.paymentId;

export interface PtPackageInput {
  packageName: string;
  trainerId: string | null;
  sessionsIncluded: number | null;
  startDate: string;
  endDate: string;
  notes: string;
}
export function validatePtPackage(i: PtPackageInput): string[] {
  const e: string[] = [];
  if (!i.packageName.trim()) e.push('Name the PT package (e.g. “1 Month PT”).');
  if (!i.startDate || !i.endDate) e.push('Add when the PT package starts and ends.');
  if (i.startDate && i.endDate && i.endDate < i.startDate) e.push('The PT end date must be after the start.');
  if (i.sessionsIncluded != null && (!Number.isInteger(i.sessionsIncluded) || i.sessionsIncluded < 1)) e.push('Sessions must be a whole number.');
  return e;
}

/** A PT package agreed before it's paid (the payment is linked when it comes in). Never touches the gym membership. */
export async function createPtPackage(memberId: string, memberName: string, i: PtPackageInput, actor: AdminActor) {
  const ref = fsDoc(collection(db, 'ptPackages'));
  const b = writeBatch(db);
  b.set(ref, {
    memberId, trainerId: i.trainerId || null, packageName: i.packageName.trim(), sessionsIncluded: i.sessionsIncluded, sessionsUsed: 0, sessionsRemaining: null,
    startDate: i.startDate, endDate: i.endDate, notes: i.notes.trim(), paymentId: null, source: 'payment', createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  logTo(b, actor, 'PT package created', 'member', memberId, { name: memberName, package: i.packageName.trim() });
  await b.commit();
  return ref.id;
}

/** One PT session done. Refused once a session-count package is used up. */
export async function logPtSession(p: PtPackage, memberName: string, actor: AdminActor) {
  if (p.sessionsIncluded != null && (p.sessionsUsed ?? 0) >= p.sessionsIncluded) throw new Error('All sessions in this package are used.');
  const b = writeBatch(db);
  b.update(fsDoc(db, 'ptPackages', p.id), { sessionsUsed: increment(1), updatedAt: serverTimestamp() });
  logTo(b, actor, 'PT session logged', 'member', p.memberId, { name: memberName, package: p.packageName, used: (p.sessionsUsed ?? 0) + 1 });
  await b.commit();
}

/** PT packages for a page of members (≤30 per query), grouped by member. */
export async function ptForMembers(memberIds: string[]): Promise<Map<string, PtPackage[]>> {
  const out = new Map<string, PtPackage[]>();
  const ids = [...new Set(memberIds)];
  for (let i = 0; i < ids.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'ptPackages'), where('memberId', 'in', ids.slice(i, i + 30))));
    snap.docs.forEach((d) => { const p = { id: d.id, ...d.data() } as PtPackage; out.set(p.memberId, [...(out.get(p.memberId) ?? []), p]); });
  }
  return out;
}
/** Members with a PT package running today (for the "PT" filter). */
export async function membersWithCurrentPt(today: string, n = 500): Promise<string[]> {
  const snap = await getDocs(query(collection(db, 'ptPackages'), where('endDate', '>=', today), limit(n)));
  return [...new Set(snap.docs.map((d) => d.data() as PtPackage).filter((p) => !p.startDate || p.startDate <= today).map((p) => p.memberId))];
}
