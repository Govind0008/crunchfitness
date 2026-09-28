// What a member has bought, period by period — kept apart from the member record itself:
//
//   memberships/{id}  — gym membership periods (history). The member document still holds the
//                       CURRENT plan/start/expiry, which drives status, counts, dues and access.
//   ptPackages/{id}   — personal training packages. PT is its own thing: it never extends a gym
//                       membership and never grants door access.
//
// Both are written by admins only (payment recording, or the legacy import), never deleted.
import { collection, getDocs, query, where, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Where a record came from, for imported history. */
export interface LegacyRef {
  file: string;
  sheet: string;
  row: number;               // spreadsheet row number (1 = header)
  srNo: string | null;       // the sheet's own "Sr No", when present
  key: string;               // deterministic migration key (same row → same key, every time)
  highlight: string | null;  // cell fill colour in the sheet (meaning not recorded)
}

/** The sheet's free-form "bal" column, kept as evidence — never treated as money owed. */
export interface LegacyBalance {
  /** A number found in the column: a CANDIDATE balance, unconfirmed */
  legacyBalanceAmountPaise?: number | null;
  /** The text as written ("bal paid", "nill", "24 session") */
  legacyBalanceNote?: string | null;
}

export interface MembershipRecord extends LegacyBalance {
  id: string;
  memberId: string;
  planId: string | null;
  /** What it was called at the time ("12 Months", or the sheet's "12 month") */
  planLabel: string;
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  paymentId: string | null;
  source: 'payment' | 'legacy_excel';
  legacy?: LegacyRef;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface PtPackage extends LegacyBalance {
  id: string;
  memberId: string;
  /** teamMembers id — only when actually known */
  trainerId: string | null;
  packageName: string;
  /** Only when stated; imported sheets don't say, so these stay empty */
  sessionsIncluded: number | null;
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
