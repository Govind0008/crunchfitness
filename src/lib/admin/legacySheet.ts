// The old member sheet, understood — pure functions only (no database), so the same code runs in
// the browser importer and in tests against the real spreadsheet. See legacyImport.ts for the
// rules this follows and for the writing step.
import type { Member } from './members';
import { phoneKey } from './phone';
import type { XlsxCell } from './xlsx';
import { excelDate } from './xlsx';

/** Today in Pune, as YYYY-MM-DD. */
const todayIST = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

// ── 1. Columns ────────────────────────────────────────────────────────────────
export type Field = 'srNo' | 'name' | 'phone' | 'paidOn' | 'membership' | 'start' | 'end' | 'paid' | 'bal';
export const FIELDS: { key: Field; label: string; target: string; required: boolean }[] = [
  { key: 'name', label: 'Name', target: 'Member name', required: true },
  { key: 'phone', label: 'Mobile number', target: 'Member phone (used to match members)', required: true },
  { key: 'paidOn', label: 'Date of payment', target: 'Payment date', required: true },
  { key: 'membership', label: 'Membership', target: 'Membership or PT package', required: true },
  { key: 'start', label: 'Start date', target: 'Membership / PT start', required: true },
  { key: 'end', label: 'End date', target: 'Membership / PT end', required: true },
  { key: 'paid', label: 'Paid', target: 'Payment amount', required: true },
  { key: 'bal', label: 'bal', target: 'Old balance note (not a due)', required: false },
  { key: 'srNo', label: 'Sr No', target: 'Old serial number (kept for reference)', required: false },
];
export type Mapping = Record<Field, number>;

const ALIASES: Record<Field, string[]> = {
  srNo: ['sr no', 'sr. no', 'sr', 'sno', 's no', 'serial', 'serial no', 'no'],
  name: ['name', 'member name', 'full name'],
  phone: ['mob number', 'mobile', 'mobile number', 'mob', 'mob no', 'phone', 'phone number', 'contact', 'contact number'],
  paidOn: ['date of payment', 'payment date', 'paid on', 'date'],
  membership: ['membership', 'plan', 'package', 'membership type'],
  start: ['start date', 'start', 'from', 'joining date'],
  end: ['end date', 'end', 'to', 'expiry', 'expiry date', 'valid till'],
  paid: ['paid', 'amount', 'amount paid', 'fees', 'fee'],
  bal: ['bal', 'balance', 'bal.', 'pending'],
};
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function detectMapping(header: XlsxCell[]): Mapping {
  const h = header.map((c) => norm(c.value));
  const m = {} as Mapping;
  (Object.keys(ALIASES) as Field[]).forEach((f) => { m[f] = h.findIndex((x) => ALIASES[f].includes(x)); });
  return m;
}

// ── 2. Values ────────────────────────────────────────────────────────────────
/** A date cell → YYYY-MM-DD. Accepts Excel dates, YYYY-MM-DD and DD/MM/YYYY (Indian order). */
export function toDate(c: XlsxCell | undefined): string | null | 'bad' {
  if (!c || c.value == null || c.value === '') return null;
  if (typeof c.value === 'number') return c.value > 20000 && c.value < 80000 ? excelDate(c.value) : 'bad';
  const s = c.value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return 'bad';
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  const d = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) || Number(m[2]) > 12 || Number(m[1]) > 31 ? 'bad' : d;
}

/** Phone numbers arrive as numbers (9881715183), text with spaces/+91, or with a leading 0. */
export function toPhone(c: XlsxCell | undefined): string {
  if (!c || c.value == null) return '';
  return typeof c.value === 'number' ? c.value.toFixed(0) : c.value.trim();
}

/** Whole rupees or rupees.paise → paise; null if it isn't a clean positive amount. */
export function toAmountPaise(c: XlsxCell | undefined): number | null | 'bad' {
  if (!c || c.value == null || c.value === '') return null;
  const n = typeof c.value === 'number' ? c.value : Number(c.value.replace(/[₹,\s]|rs\.?/gi, ''));
  if (!Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return 'bad';
  return Math.round(n * 100);
}

export type PackageKind = 'membership' | 'pt' | 'unknown';
export interface PackageInfo { kind: PackageKind; months: number | null; label: string; raw: string }
/**
 * "01 month" → 1-month membership; "01 month pt" → 1-month PT package. Conservative: anything
 * that isn't clearly one of the two is 'unknown' and goes to review.
 */
export function classifyPackage(raw: unknown): PackageInfo {
  const text = String(raw ?? '').trim();
  const t = norm(text);
  const pt = /(^|[\s(-])(pt|p\.t\.?|personal training|personal trainer)([\s)]|$)/.test(t);
  const months = t.match(/(\d+)\s*(month|months|mon|mnth)s?\b/)?.[1] ?? (/\b(1\s*year|12\s*months?|annual|yearly)\b/.test(t) ? '12' : null);
  const n = months ? Number(months) : null;
  const rest = t.replace(/(\d+)\s*(months?|mon|mnth)s?/, '').replace(/\b(1\s*year|annual|yearly)\b/, '').replace(/\b(pt|p\.t\.?|personal training|personal trainer|gym|membership)\b/g, '').replace(/[\s().-]/g, '');
  if (!t || !n || rest) return { kind: 'unknown', months: n, label: text || '—', raw: text };
  const label = `${n} ${n === 1 ? 'Month' : 'Months'}`;
  return pt ? { kind: 'pt', months: n, label: `${label} PT`, raw: text } : { kind: 'membership', months: n, label, raw: text };
}

export type BalanceKind = 'none' | 'settled' | 'amount' | 'sessions' | 'note';
export interface BalanceInfo { kind: BalanceKind; amountPaise: number | null; note: string | null }
/**
 * The "bal" column is inconsistent: blank, "nill", "bal paid", "9000", "24 session"…
 * Only a bare number is a candidate amount — and even that is never treated as money owed.
 */
export function classifyBalance(c: XlsxCell | undefined): BalanceInfo {
  if (!c || c.value == null || String(c.value).trim() === '') return { kind: 'none', amountPaise: null, note: null };
  if (typeof c.value === 'number') return { kind: 'amount', amountPaise: Math.round(c.value * 100), note: String(c.value) };
  const text = c.value.trim(); const t = norm(text);
  if (/^[₹\s]*\d+(\.\d{1,2})?\s*(rs\.?|₹|\/-)?$/.test(t)) return { kind: 'amount', amountPaise: Math.round(Number(t.replace(/[^\d.]/g, '')) * 100), note: text };
  if (/^(nil+|none|0|-|paid|bal paid|balance paid|full paid|fully paid|clear|cleared)$/.test(t)) return { kind: 'settled', amountPaise: null, note: text };
  if (/\bsessions?\b/.test(t)) return { kind: 'sessions', amountPaise: null, note: text };
  return { kind: 'note', amountPaise: null, note: text };
}

// ── 3. Rows ──────────────────────────────────────────────────────────────────
export interface LegacyRow {
  row: number;                 // sheet row number (header = 1)
  srNo: string | null;
  name: string;
  phone: string;
  phoneKey: string;
  paidOn: string | null;
  pkg: PackageInfo;
  start: string | null;
  end: string | null;
  amountPaise: number | null;
  balance: BalanceInfo;
  highlight: string | null;
  key: string;
  /** Can't be imported at all (e.g. no phone number) */
  blockers: string[];
  /** Needs a person to look and approve before it's imported */
  review: string[];
  /** Imported as-is; worth knowing */
  warnings: string[];
}

const HIGHLIGHT_NAME: Record<string, string> = { '92D050': 'green', '00B0F0': 'blue', 'FFFF00': 'yellow', 'FF0000': 'red', 'FFC000': 'orange' };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const sameName = (a: string, b: string) => {
  const x = norm(a).replace(/[^a-z ]/g, ''), y = norm(b).replace(/[^a-z ]/g, '');
  return x === y || x.replace(/ /g, '') === y.replace(/ /g, '') || (x.split(' ')[0] === y.split(' ')[0] && (x.includes(y) || y.includes(x)));
};

/**
 * Deterministic key for a row: the same member, date, package, dates and amount give the same key,
 * whatever the file is called or wherever the row sits — so importing twice can't duplicate it.
 */
export const rowKey = (r: Pick<LegacyRow, 'phoneKey' | 'paidOn' | 'pkg' | 'start' | 'end' | 'amountPaise'>) =>
  ['lx', r.phoneKey || 'nophone', r.paidOn ?? 'nodate', r.pkg.kind, r.pkg.months ?? 'x', r.start ?? 'x', r.end ?? 'x', r.amountPaise ?? 'x'].join('_').replace(/[^A-Za-z0-9_-]/g, '');

export interface Analysis {
  file: string;
  sheet: string;
  header: string[];
  mapping: Mapping;
  missingColumns: Field[];
  rows: LegacyRow[];
  /** Blank rows at the end of the sheet, ignored */
  emptyRows: number;
}

export function analyse(file: string, sheet: string, grid: XlsxCell[][], mapping?: Mapping, overrides: Map<number, PackageKind> = new Map()): Analysis {
  const header = grid[0] ?? [];
  const map = mapping ?? detectMapping(header);
  const missingColumns = FIELDS.filter((f) => f.required && map[f.key] < 0).map((f) => f.key);
  const cell = (r: XlsxCell[], f: Field) => (map[f] >= 0 ? r[map[f]] : undefined);
  const rows: LegacyRow[] = [];
  let emptyRows = 0;

  grid.slice(1).forEach((r, i) => {
    if (!r.some((c) => c && c.value != null && String(c.value).trim() !== '')) { emptyRows++; return; }
    const rowNo = i + 2;
    const blockers: string[] = []; const review: string[] = []; const warnings: string[] = [];
    const name = String(cell(r, 'name')?.value ?? '').trim().replace(/\s+/g, ' ');
    const phone = toPhone(cell(r, 'phone'));
    const key10 = phoneKey(phone);
    const srRaw = cell(r, 'srNo')?.value;
    const srNo = srRaw == null || String(srRaw).trim() === '' ? null : String(typeof srRaw === 'number' ? Math.round(srRaw) : srRaw).trim();
    let pkg = classifyPackage(cell(r, 'membership')?.value);
    const forced = overrides.get(rowNo);
    if (forced && forced !== 'unknown' && pkg.months) pkg = { ...pkg, kind: forced, label: `${pkg.months} ${pkg.months === 1 ? 'Month' : 'Months'}${forced === 'pt' ? ' PT' : ''}` };
    const paidOn = toDate(cell(r, 'paidOn')); const start = toDate(cell(r, 'start')); const end = toDate(cell(r, 'end'));
    const amount = toAmountPaise(cell(r, 'paid'));
    const balance = classifyBalance(cell(r, 'bal'));
    const fill = r.find((c) => c?.fill)?.fill ?? null;

    if (name.length < 2) blockers.push('No name');
    if (!phone) blockers.push('No phone number — the member can’t be matched or added');
    else if (key10.length !== 10 || !/^[6-9]/.test(key10)) blockers.push(`Phone “${phone}” isn’t a 10-digit mobile number`);
    if (pkg.kind === 'unknown') review.push(`“${pkg.raw || 'blank'}” isn’t clearly a gym membership or a PT package — choose which`);
    if (forced && forced !== 'unknown' && pkg.kind === forced) warnings.push(`Type set by staff: ${forced === 'pt' ? 'personal training' : 'membership'}`);
    if (paidOn === 'bad') review.push('Payment date not understood');
    if (start === 'bad') review.push('Start date not understood');
    if (end === 'bad') review.push('End date not understood');
    if (paidOn === null) review.push('No payment date — no payment can be recorded');
    if (start === null || end === null) review.push('Start or end date missing');
    if (typeof start === 'string' && typeof end === 'string' && end < start) review.push('End date is before the start date');
    if (amount === 'bad') review.push(`Paid amount “${cell(r, 'paid')?.value}” isn’t a clean amount`);
    if (amount === null) review.push('No paid amount — no payment can be recorded');
    if (typeof paidOn === 'string' && typeof start === 'string' && daysBetween(start, paidOn) > 7)
      warnings.push(`Paid ${daysBetween(start, paidOn)} days after the start date — may be the rest of an earlier payment`);
    if (typeof paidOn === 'string' && paidOn > todayIST()) review.push('Payment date is in the future');
    if (balance.kind === 'amount') review.push(`“bal” says ${balance.note} — kept as an unconfirmed old balance, not a due`);
    if (balance.kind === 'sessions') warnings.push(`“bal” says “${balance.note}” — kept as a note; sessions aren’t set from it`);
    if (balance.kind === 'note') review.push(`“bal” says “${balance.note}” — kept as a note`);
    if (!srNo) warnings.push('No Sr No — the sheet row number is kept instead');
    if (fill) warnings.push(`Highlighted ${HIGHLIGHT_NAME[fill] ?? `#${fill}`} in the sheet (meaning not recorded)`);

    const row: LegacyRow = {
      row: rowNo, srNo, name, phone, phoneKey: key10, paidOn: typeof paidOn === 'string' ? paidOn : null, pkg,
      start: typeof start === 'string' ? start : null, end: typeof end === 'string' ? end : null,
      amountPaise: typeof amount === 'number' ? amount : null, balance, highlight: fill, key: '', blockers, review, warnings,
    };
    row.key = rowKey(row);
    rows.push(row);
  });

  // Across rows: the same phone with a different name is not merged without a person checking
  const byPhone = new Map<string, LegacyRow[]>();
  rows.filter((r) => r.phoneKey.length === 10).forEach((r) => byPhone.set(r.phoneKey, [...(byPhone.get(r.phoneKey) ?? []), r]));
  byPhone.forEach((list) => {
    const first = list[0];
    list.slice(1).forEach((r) => { if (!sameName(first.name, r.name)) r.review.push(`Same phone as row ${first.row} (“${first.name}”) but a different name`); });
  });
  // Exact repeats of a row (same key) are imported once
  const seen = new Map<string, number>();
  rows.forEach((r) => {
    const prev = seen.get(r.key);
    if (prev) r.blockers.push(`Repeats row ${prev} exactly — imported once`);
    else seen.set(r.key, r.row);
  });

  return { file, sheet, header: header.map((c) => String(c?.value ?? '').trim()), mapping: map, missingColumns, rows, emptyRows };
}

// ── 4. Plan (what would be written) ───────────────────────────────────────────
export interface PlanRef { id: string; duration: string }
export const monthsOfPlan = (duration: string) => {
  const t = norm(duration);
  const m = t.match(/(\d+)\s*month/); if (m) return Number(m[1]);
  const y = t.match(/(\d+)\s*year/); if (y) return Number(y[1]) * 12;
  return /annual|yearly/.test(t) ? 12 : null;
};

export interface PlannedMember {
  phoneKey: string;
  name: string;
  phone: string;
  existing: Member | null;
  rows: LegacyRow[];
  /** For new members: current plan/dates from the latest membership row */
  planId: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  conflicts: string[];
}
export interface ImportPlan {
  members: PlannedMember[];
  membersToCreate: number;
  membersMatched: number;
  memberships: number;
  ptPackages: number;
  payments: number;
  /** Rows already in the system from an earlier import */
  alreadyImported: LegacyRow[];
  needsReview: LegacyRow[];
  skipped: LegacyRow[];
  warnings: number;
  conflicts: number;
  /** Today's website plan with the same length, by months — linked for reference only */
  planByMonths: Record<number, string>;
}

/**
 * Decide what to write. `approved` = rows a person reviewed and accepted; everything flagged
 * for review and not approved stays out. `existing` = members already in the system, by phone.
 */
export function planImport(a: Analysis, existing: Map<string, Member>, alreadyImported: Set<string>, plans: PlanRef[], approved: Set<number>): ImportPlan {
  const skipped = a.rows.filter((r) => r.blockers.length);
  const importable = a.rows.filter((r) => !r.blockers.length);
  // Already in the system (from an earlier import) — whatever its review state was then
  const done = importable.filter((r) => alreadyImported.has(r.key));
  const fresh = importable.filter((r) => !alreadyImported.has(r.key));
  const needsReview = fresh.filter((r) => r.review.length && !approved.has(r.row));
  const todo = fresh.filter((r) => (!r.review.length || approved.has(r.row)) && r.pkg.kind !== 'unknown' && r.paidOn && r.start && r.end && r.amountPaise);

  const groups = new Map<string, LegacyRow[]>();
  todo.forEach((r) => groups.set(r.phoneKey, [...(groups.get(r.phoneKey) ?? []), r]));
  const members: PlannedMember[] = [...groups.entries()].map(([key, rows]) => {
    const ex = existing.get(key) ?? null;
    const latest = rows.filter((r) => r.pkg.kind === 'membership').sort((x, y) => (y.end ?? '').localeCompare(x.end ?? ''))[0];
    const plan = latest ? plans.find((p) => monthsOfPlan(p.duration) === latest.pkg.months) : undefined;
    const conflicts: string[] = [];
    if (ex && !sameName(ex.name, rows[0].name)) conflicts.push(`The member with this phone is “${ex.name}”; the sheet says “${rows[0].name}”. Nothing on the member is changed.`);
    if (ex && latest?.end && (!ex.membershipEnd || latest.end > ex.membershipEnd)) conflicts.push(`The sheet has a membership ending ${latest.end}, later than the member’s expiry (${ex.membershipEnd ?? 'none'}). The member’s expiry is not changed — update it by hand if the sheet is right.`);
    return {
      phoneKey: key, name: rows[0].name, phone: rows[0].phone, existing: ex, rows,
      planId: plan?.id ?? null, membershipStart: latest?.start ?? null, membershipEnd: latest?.end ?? null, conflicts,
    };
  }).sort((x, y) => x.name.localeCompare(y.name));

  return {
    members,
    membersToCreate: members.filter((m) => !m.existing).length,
    membersMatched: members.filter((m) => m.existing).length,
    memberships: todo.filter((r) => r.pkg.kind === 'membership').length,
    ptPackages: todo.filter((r) => r.pkg.kind === 'pt').length,
    payments: todo.length,
    alreadyImported: done,
    needsReview,
    skipped,
    warnings: todo.reduce((n, r) => n + r.warnings.length, 0),
    conflicts: members.reduce((n, m) => n + m.conflicts.length, 0),
    planByMonths: Object.fromEntries(plans.map((p) => [monthsOfPlan(p.duration), p.id]).filter(([k]) => k != null)),
  };
}

