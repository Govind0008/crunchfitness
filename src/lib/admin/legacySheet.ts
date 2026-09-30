// The gym's old spreadsheets, understood — pure functions only (no database), so the same code runs
// in the browser importer and in tests against the real workbooks. See legacyImport.ts for the
// writing step, and LEGACY_MEMBER_IMPORT.md for what each sheet contains.
//
// A ROW IS NOT A MEMBER. One person can have several rows: instalments of one membership, an
// upgrade, a PT package, repeated day passes. Rows are grouped by phone into people, and rows with
// the same package and dates into one membership / PT record with several payments. Nothing is
// merged away: every row stays one payment, traceable to its sheet row.
import type { Member } from './members';
import type { PaymentMethod } from './payments';
import { phoneKey } from './phone';
import type { XlsxCell, XlsxSheet } from './xlsx';
import { excelDate } from './xlsx';

/** Today in Pune, as YYYY-MM-DD. */
const todayIST = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

// ── 1. Sheet and columns ──────────────────────────────────────────────────────
/** The sheet this importer reads. Other sheets in the workbook (enquiries, PT, renewals) are left alone. */
export const IMPORT_SHEET = 'Membership';
export function pickSheet(sheets: XlsxSheet[]): XlsxSheet | undefined {
  return sheets.find((s) => norm(s.name) === norm(IMPORT_SHEET)) ?? sheets.find((s) => s.rows.length > 1) ?? sheets[0];
}

export type Field = 'srNo' | 'name' | 'phone' | 'paidOn' | 'membership' | 'start' | 'end' | 'paid' | 'bal' | 'mode' | 'comment' | 'feedback';
export const FIELDS: { key: Field; label: string; target: string; required: boolean }[] = [
  { key: 'name', label: 'Name', target: 'Member name', required: true },
  { key: 'phone', label: 'Mobile number', target: 'Member phone (used to match members)', required: true },
  { key: 'paidOn', label: 'Date of payment', target: 'Payment date', required: true },
  { key: 'membership', label: 'Membership', target: 'Membership or PT package', required: true },
  { key: 'start', label: 'Start date', target: 'Membership / PT start', required: true },
  { key: 'end', label: 'End date', target: 'Membership / PT end', required: true },
  { key: 'paid', label: 'Paid', target: 'Payment amount', required: true },
  { key: 'mode', label: 'Mode', target: 'Payment method', required: false },
  { key: 'bal', label: 'Bal Amt', target: 'Old balance note (never a due)', required: false },
  { key: 'comment', label: 'comment', target: 'Comment (kept as a note)', required: false },
  { key: 'feedback', label: 'Feedback comment', target: 'Feedback (kept as a note)', required: false },
  { key: 'srNo', label: 'Sr No', target: 'Old serial number (kept for reference)', required: false },
];
export type Mapping = Record<Field, number>;

const ALIASES: Record<Field, string[]> = {
  srNo: ['sr no', 'sr. no', 'sr.no', 'sr no.', 'sr. no.', 'sr', 'sno', 's no', 'serial', 'serial no', 'no'],
  name: ['name', 'member name', 'members name', 'member’s name', "member's name", 'full name'],
  phone: ['mob number', 'mobile', 'mobile number', 'mob', 'mob no', 'phone', 'phone number', 'contact', 'contact number'],
  paidOn: ['date of payment', 'payment date', 'paid on', 'date'],
  membership: ['membership', 'plan', 'package', 'membership type'],
  start: ['start date', 'start', 'from', 'joining date'],
  end: ['end date', 'end', 'to', 'expiry', 'expiry date', 'valid till'],
  paid: ['paid', 'amount', 'amount paid', 'fees', 'fee'],
  bal: ['bal', 'balance', 'bal.', 'bal amt', 'bal amount', 'balance amount', 'pending'],
  mode: ['mode', 'payment mode', 'mode of payment', 'method', 'payment method'],
  comment: ['comment', 'comments', 'remark', 'remarks', 'note', 'notes'],
  feedback: ['feedback comment', 'feedback'],
};
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export function detectMapping(header: XlsxCell[]): Mapping {
  const h = header.map((c) => norm(c?.value));
  const m = {} as Mapping;
  (Object.keys(ALIASES) as Field[]).forEach((f) => { m[f] = h.findIndex((x) => ALIASES[f].includes(x)); });
  return m;
}

// ── 2. Values ────────────────────────────────────────────────────────────────
/** A date cell → YYYY-MM-DD. Accepts Excel dates, YYYY-MM-DD and DD/MM/YYYY (Indian order). Blank → null. */
export function toDate(c: XlsxCell | undefined): string | null | 'bad' {
  if (!c || c.value == null) return null;
  if (typeof c.value === 'number') return c.value > 20000 && c.value < 80000 ? excelDate(c.value) : 'bad';
  const s = c.value.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!m) return 'bad';
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  const d = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Number.isNaN(new Date(`${d}T00:00:00Z`).getTime()) || Number(m[2]) > 12 || Number(m[1]) > 31 ? 'bad' : d;
}
const rawText = (c: XlsxCell | undefined) => (c?.value == null ? null : String(c.value).trim() || null);

/** Phone numbers arrive as numbers (9000000001) or text ("9000000001", "+91 90000 00001"). */
export function toPhone(c: XlsxCell | undefined): string {
  if (!c || c.value == null) return '';
  return typeof c.value === 'number' ? c.value.toFixed(0) : c.value.trim();
}

/** Whole rupees or rupees.paise → paise; null if blank, 'bad' if it isn't a clean positive amount. */
export function toAmountPaise(c: XlsxCell | undefined): number | null | 'bad' {
  if (!c || c.value == null || String(c.value).trim() === '') return null;
  const n = typeof c.value === 'number' ? c.value : Number(c.value.replace(/[₹,\s]|rs\.?/gi, ''));
  if (!Number.isFinite(n) || n <= 0 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return 'bad';
  return Math.round(n * 100);
}

/** "upi", "UPI ", "CASH", "card" → the payment method; blank → Not recorded. The raw text is kept too. */
export function toMethod(c: XlsxCell | undefined): { method: PaymentMethod; raw: string | null; recognised: boolean } {
  const raw = rawText(c);
  const t = norm(raw);
  if (!t) return { method: 'unknown', raw: null, recognised: true };
  if (/^(upi|gpay|g pay|google pay|phonepe|phone pe|paytm|bhim)$/.test(t)) return { method: 'upi', raw, recognised: true };
  if (/^cash$/.test(t)) return { method: 'cash', raw, recognised: true };
  if (/^(card|debit card|credit card|swipe|pos)$/.test(t)) return { method: 'card', raw, recognised: true };
  if (/^(bank|bank transfer|neft|imps|rtgs|transfer|online transfer)$/.test(t)) return { method: 'bank_transfer', raw, recognised: true };
  return { method: 'other', raw, recognised: false };
}

// Packages ────────────────────────────────────────────────────────────────────
export type PackageKind = 'membership' | 'pt' | 'unknown';
/** regular "6 months" · bonus "6+2 months" · upgrade "12 months upgrade" · day "1 day" */
export type PackageType = 'regular' | 'bonus' | 'upgrade' | 'day';
export interface PackageInfo {
  kind: PackageKind;
  packageType: PackageType | null;
  /** Total months (base + bonus); null for day passes and unclear packages */
  months: number | null;
  baseMonths: number | null;
  bonusMonths: number | null;
  days: number | null;
  /** Tidy name: "6 + 2 Months", "12 Months upgrade", "3 Months PT", "1 Day" */
  label: string;
  /** "8 months", "1 day" */
  normalizedDuration: string | null;
  /** Exactly as written in the sheet */
  raw: string;
}

const PT_RE = /(^|[\s(-])(pt|p\.t\.?|personal training|personal trainer)(?=[\s)]|$)/;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * "01 month pt" → 1-month PT; "6+2 months" → 6 months + 2 bonus; "12 months upgrade" → an upgrade;
 * "1day" → a day pass. Conservative: anything that isn't clearly one of these is 'unknown' and goes
 * to review. The original wording is always kept in `raw`.
 */
export function classifyPackage(raw: unknown): PackageInfo {
  const text = String(raw ?? '').trim();
  const t = norm(text);
  const unknown = (): PackageInfo => ({
    kind: 'unknown', packageType: null, months: Number(t.match(/(\d+)\s*(?:months?|mon|mnths?)\b/)?.[1]) || null,
    baseMonths: null, bonusMonths: null, days: null, label: text || '—', normalizedDuration: null, raw: text,
  });
  if (!t) return unknown();
  const pt = PT_RE.test(t);
  const upgrade = /\bupgraded?\b/.test(t);
  const s = t.replace(new RegExp(PT_RE.source, 'g'), ' ').replace(/\bupgraded?\b/g, ' ').replace(/\b(gym|membership)\b/g, ' ')
    .replace(/[().]/g, ' ').replace(/\s+/g, ' ').trim();
  let base: number | null = null, bonus: number | null = null, days: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)\s*\+\s*(\d+)\s*(?:months?|mon|mnths?)?$/))) { base = Number(m[1]); bonus = Number(m[2]); }
  else if ((m = s.match(/^(\d+)\s*(?:months?|mon|mnths?)$/))) base = Number(m[1]);
  else if ((m = s.match(/^(\d+)\s*days?$/))) days = Number(m[1]);
  else if (/^(1\s*year|annual|yearly)$/.test(s)) base = 12;
  else return unknown();
  if ((base != null && (base < 1 || base > 36)) || (bonus != null && bonus > 12) || (days != null && (days < 1 || days > 31)) || (upgrade && days != null)) return unknown();

  const kind: PackageKind = pt ? 'pt' : 'membership';
  const suffix = pt ? ' PT' : '';
  if (days != null) return { kind, packageType: 'day', months: null, baseMonths: null, bonusMonths: null, days, label: `${plural(days, 'Day')}${suffix}`, normalizedDuration: plural(days, 'day'), raw: text };
  const total = base! + (bonus ?? 0);
  const label = bonus ? `${base} + ${bonus} Months` : plural(base!, 'Month');
  return {
    kind, packageType: upgrade ? 'upgrade' : bonus ? 'bonus' : 'regular', months: total, baseMonths: base, bonusMonths: bonus,
    days: null, label: `${label}${suffix}${upgrade ? ' upgrade' : ''}`, normalizedDuration: plural(total, 'month'), raw: text,
  };
}

// Balance ─────────────────────────────────────────────────────────────────────
export type BalanceKind = 'none' | 'settled' | 'amount' | 'sessions' | 'note';
export interface BalanceInfo { kind: BalanceKind; amountPaise: number | null; note: string | null }
/**
 * The balance column is inconsistent: "AM(A/C)", "2000 bal", "nil", "nill AM(A/C)", "bal paid",
 * "17000 AM(A/C)", "9000", "24 session"… The text is always kept as written. A leading number is
 * kept as a CANDIDATE old balance — it is never treated as money owed, and never becomes a due.
 */
export function classifyBalance(c: XlsxCell | undefined): BalanceInfo {
  if (!c || c.value == null || String(c.value).trim() === '') return { kind: 'none', amountPaise: null, note: null };
  if (typeof c.value === 'number') return c.value > 0 ? { kind: 'amount', amountPaise: Math.round(c.value * 100), note: String(c.value) } : { kind: 'settled', amountPaise: null, note: String(c.value) };
  const text = c.value.trim(); const t = norm(text);
  if (/\bsessions?\b/.test(t)) return { kind: 'sessions', amountPaise: null, note: text };
  if (/^(nil+|none|0|-|paid|bal paid|balance paid|full paid|fully paid|clear|cleared)\b/.test(t)) return { kind: 'settled', amountPaise: null, note: text };
  const n = t.match(/^(?:bal\.?\s*)?₹?\s*(\d[\d,]*(?:\.\d{1,2})?)(?![\d/])/);
  const amount = n ? Number(n[1].replace(/,/g, '')) : 0;
  if (amount > 0) return { kind: 'amount', amountPaise: Math.round(amount * 100), note: text };
  return { kind: 'note', amountPaise: null, note: text };
}

// ── 3. Rows ──────────────────────────────────────────────────────────────────
export interface LegacyRow {
  row: number;                 // sheet row number (header = 1)
  srNo: string | null;
  name: string;
  /** Lower-case, single-spaced: the only name form used for matching */
  nameKey: string;
  phone: string;
  phoneKey: string;
  /** A usable 10-digit mobile */
  hasPhone: boolean;
  paidOn: string | null;
  pkg: PackageInfo;
  start: string | null;
  end: string | null;
  /** The cells as written, when they couldn't be read as dates */
  startRaw: string | null;
  endRaw: string | null;
  amountPaise: number | null;
  balance: BalanceInfo;
  method: PaymentMethod;
  methodRaw: string | null;
  comment: string | null;
  feedback: string | null;
  highlight: string | null;
  /** Payment key: file + sheet + row + the row's own fields */
  key: string;
  /** The same payment whatever file or row it's in (member, date, package, dates, amount) */
  fingerprint: string;
  /** The membership / PT record this row pays for; several rows can share one */
  recordId: string;
  /** Earlier row this one shares a record with (same member, package and dates) */
  groupWith: number | null;
  /** Dates are unreadable or don't fit the package — a person picks what to use */
  dateIssue: boolean;
  /** Start + the package's months, offered as the alternative when dateIssue */
  suggestedEnd: string | null;
  /** A phone-less row that may be this person already in the sheet (same exact name) */
  sheetCandidate: { phoneKey: string; name: string; row: number } | null;
  /** Can't be imported (e.g. no payment date) */
  blockers: string[];
  /** Needs a person to look and decide before it's imported */
  review: string[];
  /** Imported as-is; worth knowing */
  warnings: string[];
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
/** Same day of the month, n months later (clamped to the month's last day) — the sheet's own convention. */
export function addMonths(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}
const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const rs = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Same person written differently: "asha rao" / "Asha  Rao ", "Amit Shah" / "Amit Shaw", "Asha R." / "asha rao". */
export const sameName = (a: string, b: string) => {
  const x = norm(a).replace(/[^a-z ]/g, ''), y = norm(b).replace(/[^a-z ]/g, '');
  if (x === y || x.replace(/ /g, '') === y.replace(/ /g, '')) return true;
  const [fx, ...rx] = x.split(' '), [fy, ...ry] = y.split(' ');
  if (fx !== fy) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const lx = rx.join(''), ly = ry.join('');
  return !!lx && !!ly && (lx.startsWith(ly) || ly.startsWith(lx) || editDistance(lx, ly) <= 2);
};

/** Short, stable hash for ids (FNV-1a, two seeds). */
export function hashKey(s: string) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
/** "SEPTEMBER2026.xlsx", "september2026 .XLSX" → "september2026" */
export const fileId = (file: string) => norm(file).replace(/\.(xlsx|xls|csv)$/, '').replace(/[^a-z0-9]+/g, '');
const clean = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '');

/**
 * The same payment gives the same fingerprint whatever file or row it sits in: member, payment date,
 * type, months, dates, amount. (Also the key older imports were stored under, so they're recognised.)
 */
export const rowKey = (r: Pick<LegacyRow, 'phoneKey' | 'paidOn' | 'pkg' | 'start' | 'end' | 'amountPaise'> & { nameKey?: string }) =>
  clean(['lx', r.phoneKey.length === 10 ? r.phoneKey : `np-${(r.nameKey ?? '').replace(/ /g, '-')}`, r.paidOn ?? 'nodate', r.pkg.kind,
    r.pkg.months ?? (r.pkg.days != null ? `d${r.pkg.days}` : 'x'), r.start ?? 'x', r.end ?? 'x', r.amountPaise ?? 'x'].join('_'));

export interface Analysis {
  file: string;
  sheet: string;
  header: string[];
  mapping: Mapping;
  missingColumns: Field[];
  rows: LegacyRow[];
  /** Blank rows (e.g. the empty rows under the data), ignored */
  emptyRows: number;
}

/** What staff decided for a row that needed review. Rows without a decision stay out. */
export type Decision = 'include' | 'package_dates' | 'membership' | 'pt';

export function analyse(file: string, sheet: string, grid: XlsxCell[][], mapping?: Mapping, decisions: Map<number, Decision> = new Map()): Analysis {
  const header = grid[0] ?? [];
  const map = mapping ?? detectMapping(header);
  const missingColumns = FIELDS.filter((f) => f.required && map[f.key] < 0).map((f) => f.key);
  const cell = (r: XlsxCell[], f: Field) => (map[f] >= 0 ? r[map[f]] : undefined);
  const rows: LegacyRow[] = [];
  let emptyRows = 0;
  const today = todayIST();
  const src = fileId(file);

  grid.slice(1).forEach((r, i) => {
    if (!r.some((c) => c && c.value != null && String(c.value).trim() !== '')) { emptyRows++; return; }
    const rowNo = i + 2;
    const blockers: string[] = []; const review: string[] = []; const warnings: string[] = [];
    const name = String(cell(r, 'name')?.value ?? '').trim().replace(/\s+/g, ' ');
    const phone = toPhone(cell(r, 'phone'));
    const key10 = phoneKey(phone);
    const hasPhone = key10.length === 10 && /^[6-9]/.test(key10);
    const srRaw = cell(r, 'srNo')?.value;
    const srNo = srRaw == null || String(srRaw).trim() === '' ? null : String(typeof srRaw === 'number' ? Math.round(srRaw) : srRaw).trim();
    let pkg = classifyPackage(cell(r, 'membership')?.value);
    const forced = decisions.get(rowNo);
    const forcedKind = pkg.kind === 'unknown' && (forced === 'membership' || forced === 'pt') && pkg.months ? forced : null;
    if (forcedKind) pkg = { ...pkg, kind: forcedKind, packageType: 'regular', baseMonths: pkg.months, bonusMonths: null, label: `${plural(pkg.months!, 'Month')}${forcedKind === 'pt' ? ' PT' : ''}`, normalizedDuration: plural(pkg.months!, 'month') };
    const paidOn = toDate(cell(r, 'paidOn')); const start = toDate(cell(r, 'start')); const end = toDate(cell(r, 'end'));
    const amount = toAmountPaise(cell(r, 'paid'));
    const balance = classifyBalance(cell(r, 'bal'));
    const pay = toMethod(cell(r, 'mode'));
    const comment = rawText(cell(r, 'comment')); const feedback = rawText(cell(r, 'feedback'));
    const fill = r.find((c) => c?.fill)?.fill ?? null;
    // 'bad' is a string too — only real dates go further
    const s = start === 'bad' ? null : start, e = end === 'bad' ? null : end;
    const p = paidOn === 'bad' ? null : paidOn;

    // Can't be imported at all
    if (name.length < 2) blockers.push('No name');
    if (phone && !hasPhone) blockers.push(`Phone “${phone}” isn’t a 10-digit mobile number`);
    if (paidOn === null) blockers.push('No payment date — a payment can’t be recorded without one. Add it in the sheet and import again.');
    if (paidOn === 'bad') blockers.push(`Payment date “${rawText(cell(r, 'paidOn'))}” isn’t a date — correct it in the sheet and import again.`);
    if (amount === null) blockers.push('No paid amount — there’s no payment to record.');
    if (amount === 'bad') blockers.push(`Paid “${cell(r, 'paid')?.value}” isn’t a clean amount.`);

    // Needs a person
    if (pkg.kind === 'unknown') review.push(`“${pkg.raw || 'blank'}” isn’t clearly a gym membership or a PT package — choose which`);
    if (forcedKind) warnings.push(`Type set by staff: ${forcedKind === 'pt' ? 'personal training' : 'gym membership'}`);
    let dateIssue = false;
    if (start === 'bad') { dateIssue = true; review.push(`Start date “${rawText(cell(r, 'start'))}” isn’t a date`); }
    if (end === 'bad') { dateIssue = true; review.push(`End date “${rawText(cell(r, 'end'))}” isn’t a date`); }
    if (s && e && e < s) { dateIssue = true; review.push('End date is before the start date'); }
    else if (s && e && pkg.months && pkg.packageType !== 'upgrade') {
      const days = daysBetween(s, e), expected = daysBetween(s, addMonths(s, pkg.months));
      if (Math.abs(days - expected) > 10) { dateIssue = true; review.push(`${fmt(s)} – ${fmt(e)} is ${days} days, but “${pkg.raw}” is about ${expected}`); }
    }
    if (pkg.kind === 'membership' && pkg.packageType !== 'day' && (!s || !e) && start !== 'bad' && end !== 'bad')
      review.push(`${!s && !e ? 'No start or end date' : !s ? 'No start date' : 'No end date'} — the membership would be recorded without ${!s && !e ? 'dates' : 'it'}, so it can’t count as active`);
    if (pkg.kind === 'pt' && (!s || !e) && start !== 'bad' && end !== 'bad') warnings.push('PT dates not in the sheet — recorded without them');
    if (pkg.packageType === 'upgrade' && s && e && pkg.months && Math.abs(daysBetween(s, e) - daysBetween(s, addMonths(s, pkg.months))) > 10)
      warnings.push(`Upgrade dates (${fmt(s)} – ${fmt(e)}) kept as written`);
    const suggestedEnd = dateIssue && s && pkg.months ? addMonths(s, pkg.months) : null;
    if (p && p > today) review.push('Payment date is in the future');
    if (p && s && daysBetween(p, s) > 45) review.push(`Paid on ${fmt(p)}, ${daysBetween(p, s)} days before the start (${fmt(s)}) — check the payment date`);
    if (p && s && daysBetween(s, p) > 7) warnings.push(`Paid ${daysBetween(s, p)} days after the start date — may be the rest of an earlier payment`);
    if (comment && /\bpaid\s+(for|by|on behalf of)\b/i.test(comment)) review.push(`Comment says “${comment}” — the payment stays with ${name || 'this row’s name'} (the Members Name column); check who it was for`);
    if (balance.kind === 'amount') warnings.push(`Bal Amt says “${balance.note}” — ${rs(balance.amountPaise!)} kept as an unconfirmed old balance, never a due`);
    if (!pay.recognised) warnings.push(`Mode “${pay.raw}” isn’t a known method — recorded as Other`);
    if (!srNo) warnings.push('No Sr No — the sheet row number is kept instead');

    const row: LegacyRow = {
      row: rowNo, srNo, name, nameKey: norm(name), phone, phoneKey: key10, hasPhone, paidOn: p, pkg, start: s, end: e,
      startRaw: start === 'bad' ? rawText(cell(r, 'start')) : null, endRaw: end === 'bad' ? rawText(cell(r, 'end')) : null,
      amountPaise: typeof amount === 'number' ? amount : null, balance, method: pay.method, methodRaw: pay.raw, comment, feedback, highlight: fill,
      key: '', fingerprint: '', recordId: '', groupWith: null, dateIssue, suggestedEnd, sheetCandidate: null, blockers, review, warnings,
    };
    row.key = clean(`lx_${hasPhone ? key10 : 'np'}_${p ?? 'nodate'}_r${rowNo}_${hashKey([src, norm(sheet), rowNo, row.nameKey, key10, p, pkg.raw, s, e, row.amountPaise].join('|'))}`);
    row.fingerprint = rowKey(row);
    rows.push(row);
  });

  // ── Across rows ──
  const byPhone = new Map<string, LegacyRow[]>();
  rows.filter((r) => r.hasPhone).forEach((r) => byPhone.set(r.phoneKey, [...(byPhone.get(r.phoneKey) ?? []), r]));
  // Same phone: one person. A spelling variant is noted; a clearly different name waits for a person.
  byPhone.forEach((list) => {
    const first = list[0];
    list.slice(1).forEach((r) => {
      if (r.nameKey === first.nameKey) return;
      if (sameName(first.name, r.name)) r.warnings.push(`Name written “${r.name}” here and “${first.name}” in row ${first.row} — same phone, kept as one member`);
      else r.review.push(`Same phone as row ${first.row} (“${first.name}”) but a different name — check it’s the same person`);
    });
  });
  // Same exact name under different phones: never merged — each phone is its own member unless a person decides
  const phonesByName = new Map<string, Map<string, number>>();
  rows.filter((r) => r.hasPhone).forEach((r) => {
    const m = phonesByName.get(r.nameKey) ?? new Map<string, number>();
    if (!m.has(r.phoneKey)) m.set(r.phoneKey, r.row);
    phonesByName.set(r.nameKey, m);
  });
  rows.filter((r) => r.hasPhone && (phonesByName.get(r.nameKey)?.size ?? 0) > 1).forEach((r) => {
    const others = [...phonesByName.get(r.nameKey)!.entries()].filter(([k]) => k !== r.phoneKey).map(([k, row]) => `${k} (row ${row})`);
    r.review.push(`Same name also appears with another phone: ${others.join(', ')} — would be a separate member`);
  });
  // No phone: a possible match by exact name only — never merged without a person deciding
  rows.filter((r) => !r.phone).forEach((r) => {
    const matches = [...byPhone.values()].filter((list) => list.some((x) => x.nameKey === r.nameKey));
    if (matches.length === 1) {
      const x = matches[0].find((y) => y.nameKey === r.nameKey)!;
      r.sheetCandidate = { phoneKey: x.phoneKey, name: x.name, row: x.row };
    } else if (matches.length > 1) r.blockers.push(`No phone number, and ${matches.length} people in the sheet are called “${r.name}” — can’t tell which`);
  });

  // Records: rows of one person with the same package and the same dates are ONE membership / PT
  // package paid in several payments (instalments, "bal paid"). Day passes are always separate visits.
  const firstOf = new Map<string, LegacyRow>();
  const recordSuffix = (r: LegacyRow) => (r.pkg.kind === 'pt' ? 'pt' : 'm');
  rows.forEach((r) => {
    r.recordId = `${r.key}_${recordSuffix(r)}`;
    if (!r.hasPhone || r.pkg.kind === 'unknown' || r.pkg.packageType === 'day' || r.dateIssue || r.blockers.length) return;
    const dated = !!(r.start && r.end);
    // Undated rows only group for PT (a package and its balance payment); an undated membership stays separate
    if (!dated && (r.pkg.kind !== 'pt' || r.start || r.end)) return;
    const gk = [r.phoneKey, r.pkg.kind, r.pkg.packageType, r.pkg.months, r.pkg.bonusMonths ?? 0, r.start ?? 'nodates', r.end ?? 'nodates'].join('|');
    const first = firstOf.get(gk);
    if (!first) {
      firstOf.set(gk, r);
      r.recordId = dated ? clean(`lx_${r.phoneKey}_${r.start}_${r.end}_${hashKey(gk)}_${recordSuffix(r)}`) : r.recordId;
      return;
    }
    r.recordId = first.recordId;
    r.groupWith = first.row;
    const what = r.pkg.kind === 'pt' ? 'PT package' : 'membership';
    if (!dated) r.review.push(`Same PT package as row ${first.row}, with no dates — would be recorded as a further payment for that package`);
    else r.warnings.push(`Another payment for the same ${what} as row ${first.row} (same package and dates) — one ${what}, several payments`);
  });

  // Exact repeats (same member, date, package, dates and amount) are NOT dropped: they may be real
  // payments. They get their own key and wait for a person.
  const seen = new Map<string, LegacyRow>();
  rows.forEach((r) => {
    const prev = seen.get(r.fingerprint);
    if (!prev) { seen.set(r.fingerprint, r); return; }
    let n = 2; while (seen.has(`${r.fingerprint}_${n}`)) n++;
    r.fingerprint = `${r.fingerprint}_${n}`;
    seen.set(r.fingerprint, r);
    r.review.push(`Looks the same as row ${prev.row} (same member, date, package and amount) — imported as a separate payment only if you include it`);
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

/** A payment already in the system, found by its fingerprint. */
export interface ImportedRef { key: string; file: string; sheet: string; row: number }

export type RowStatus = 'ready' | 'review' | 'blocked' | 'imported';
export interface RowOutcome {
  row: LegacyRow;
  status: RowStatus;
  /** Why it's blocked / needs review */
  reasons: string[];
  /** The person this row belongs to (null when it can't be placed) */
  personId: string | null;
  /** Dates that will be written (the sheet's, or start + months when staff chose that) */
  start: string | null;
  end: string | null;
  /** Where it was imported before, when status is 'imported' */
  importedFrom: ImportedRef | null;
  /** For phone-less rows: who they'd be added to */
  attachTo: { name: string; phone: string; existing: boolean } | null;
}

export interface PlannedRecord {
  id: string;
  kind: 'membership' | 'pt';
  pkg: PackageInfo;
  start: string | null;
  end: string | null;
  /** Payment rows to write for it in this import */
  rows: LegacyRow[];
}

export interface Person {
  /** members/{id} — the existing member's id, or lx_<phone> for someone new */
  id: string;
  phoneKey: string;
  name: string;
  phone: string;
  existing: Member | null;
  /** Every sheet row that belongs to this person, whatever its status */
  outcomes: RowOutcome[];
  /** What will be written (ready rows only) */
  records: PlannedRecord[];
  /** For new members: current plan/dates from the latest dated gym membership */
  planId: string | null;
  membershipStart: string | null;
  membershipEnd: string | null;
  /** Differences with an existing member — nothing on them is changed */
  conflicts: string[];
}

export interface ImportPlan {
  /** Everyone found in the sheet (for the member-level preview) */
  people: Person[];
  /** Every row, in sheet order, with what will happen to it */
  outcomes: RowOutcome[];
  /** People with something to write */
  members: Person[];
  membersToCreate: number;
  membersMatched: number;
  memberships: number;
  ptPackages: number;
  payments: number;
  alreadyImported: RowOutcome[];
  needsReview: RowOutcome[];
  skipped: RowOutcome[];
  warnings: number;
  conflicts: number;
  planByMonths: Record<number, string>;
  summary: SheetSummary;
}

/** The numbers shown before importing. */
export interface SheetSummary {
  rows: number;
  uniqueMembers: number;
  rowsWithPhone: number;
  rowsWithoutPhone: number;
  gymRows: number;
  ptRows: number;
  unclearRows: number;
  /** People already in the system (by phone) + phone-less rows that may be someone known */
  possibleExisting: number;
  /** Identity conflicts in the sheet + differences with existing members */
  conflicts: number;
  needsReview: number;
  blocked: number;
  alreadyImported: number;
}

export const legacyMemberId = (phoneKey: string) => `lx_${phoneKey}`;

/**
 * Decide what to write. `decisions` = what staff chose for rows that needed review; flagged rows
 * without a decision stay out. `existing` = members already in the system by phone; `byName` = by
 * exact lower-case name (only used for rows with no phone). `imported` = payments already in the
 * system, by fingerprint.
 */
export function planImport(
  a: Analysis, existing: Map<string, Member>, imported: Map<string, ImportedRef> | Set<string>, plans: PlanRef[],
  decisions: Map<number, Decision> = new Map(), byName: Map<string, Member[]> = new Map(),
): ImportPlan {
  const importedRef = (r: LegacyRow): ImportedRef | null => {
    if (imported instanceof Set) return imported.has(r.fingerprint) || imported.has(r.key) ? { key: r.key, file: a.file, sheet: a.sheet, row: r.row } : null;
    return imported.get(r.fingerprint) ?? null;
  };
  const planByMonths: Record<number, string> = Object.fromEntries(plans.map((p) => [monthsOfPlan(p.duration), p.id]).filter(([k]) => k != null));
  const people = new Map<string, Person>();
  const personFor = (phoneKey: string, name: string, phone: string): Person => {
    const ex = existing.get(phoneKey) ?? null;
    const id = ex?.id ?? legacyMemberId(phoneKey);
    let p = people.get(id);
    if (!p) {
      p = { id, phoneKey, name: ex?.name ?? name, phone: ex?.phone ?? phone, existing: ex, outcomes: [], records: [], planId: null, membershipStart: null, membershipEnd: null, conflicts: [] };
      people.set(id, p);
    }
    if (!p.phone && phone) p.phone = phone;
    return p;
  };
  // Phone-less rows that can't be placed are still people in the sheet (counted, shown), just not importable
  const loose = new Map<string, Person>();

  const outcomes: RowOutcome[] = a.rows.map((r) => {
    const reasons: string[] = [...r.blockers];
    let person: Person | null = null;
    let attachTo: RowOutcome['attachTo'] = null;
    if (r.hasPhone) person = personFor(r.phoneKey, r.name, r.phone);
    else if (!r.phone) {
      const known = byName.get(r.nameKey) ?? [];
      if (r.sheetCandidate) {
        person = personFor(r.sheetCandidate.phoneKey, r.sheetCandidate.name, '');
        attachTo = { name: person.name, phone: person.phone || r.sheetCandidate.phoneKey, existing: !!person.existing };
      } else if (known.length === 1) {
        person = personFor(phoneKey(known[0].phone), known[0].name, known[0].phone);
        attachTo = { name: known[0].name, phone: known[0].phone, existing: true };
      } else reasons.push(known.length > 1
        ? `No phone number, and ${known.length} existing members are called “${r.name}” — can’t tell which. Add the phone in the sheet.`
        : 'No phone number, and no member with this exact name — add the phone in the sheet (or add the member by hand) and import again.');
    }
    const review = [...r.review];
    if (attachTo) review.unshift(`No phone number — possibly ${attachTo.existing ? 'the existing member' : 'the same person as'} ${attachTo.name} (${attachTo.phone}${r.sheetCandidate ? `, row ${r.sheetCandidate.row}` : ''}), by exact name`);

    const d = decisions.get(r.row);
    const usePackageDates = d === 'package_dates' && !!r.suggestedEnd;
    const start = r.start, end = usePackageDates ? r.suggestedEnd : r.end;
    const done = importedRef(r);
    let status: RowStatus;
    if (done) status = 'imported';
    else if (reasons.length || !person) status = 'blocked';
    else if (r.pkg.kind === 'unknown') status = 'review';
    else if (review.length && !d) status = 'review';
    else status = 'ready';
    const o: RowOutcome = { row: r, status, reasons: status === 'blocked' ? reasons : status === 'review' ? review : [], personId: person?.id ?? null, start, end, importedFrom: done, attachTo };
    if (person) person.outcomes.push(o);
    else {
      const lp = loose.get(r.nameKey) ?? { id: `np:${r.nameKey}`, phoneKey: '', name: r.name, phone: '', existing: null, outcomes: [], records: [], planId: null, membershipStart: null, membershipEnd: null, conflicts: [] };
      lp.outcomes.push(o); loose.set(r.nameKey, lp);
    }
    return o;
  });

  // Records and the member's current membership, per person
  people.forEach((p) => {
    const byRecord = new Map<string, PlannedRecord>();
    p.outcomes.filter((o) => o.status === 'ready').forEach((o) => {
      const r = o.row;
      const rec = byRecord.get(r.recordId) ?? { id: r.recordId, kind: r.pkg.kind as 'membership' | 'pt', pkg: r.pkg, start: o.start, end: o.end, rows: [] };
      rec.rows.push(r); byRecord.set(r.recordId, rec);
    });
    p.records = [...byRecord.values()];
    const latest = p.records.filter((x) => x.kind === 'membership' && x.end).sort((x, y) => (y.end ?? '').localeCompare(x.end ?? ''))[0];
    if (latest) {
      const months = latest.pkg.packageType === 'bonus' ? latest.pkg.baseMonths : latest.pkg.months;
      p.planId = (months && planByMonths[months]) || null;
      p.membershipStart = latest.start; p.membershipEnd = latest.end;
    }
    const ex = p.existing;
    const sheetName = p.outcomes[0]?.row.name ?? p.name;
    if (ex && !sameName(ex.name, sheetName)) p.conflicts.push(`The member with this phone is “${ex.name}”; the sheet says “${sheetName}”. Nothing on the member is changed.`);
    if (ex && latest?.end && (!ex.membershipEnd || latest.end > ex.membershipEnd)) p.conflicts.push(`The sheet has a membership ending ${latest.end}, later than the member’s expiry (${ex.membershipEnd ?? 'none'}). The member’s expiry is not changed — update it by hand if the sheet is right.`);
  });

  const sortByName = (x: Person, y: Person) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' });
  const all = [...people.values(), ...loose.values()].sort(sortByName);
  const members = [...people.values()].filter((p) => p.records.length).sort(sortByName);
  const ready = outcomes.filter((o) => o.status === 'ready');
  const records = members.flatMap((m) => m.records);
  const identityConflicts = outcomes.filter((o) => o.row.review.some((x) => /different name|another phone/.test(x))).length;
  const memberConflicts = all.reduce((n, p) => n + p.conflicts.length, 0);

  return {
    people: all,
    outcomes,
    members,
    membersToCreate: members.filter((m) => !m.existing).length,
    membersMatched: members.filter((m) => m.existing).length,
    memberships: records.filter((x) => x.kind === 'membership').length,
    ptPackages: records.filter((x) => x.kind === 'pt').length,
    payments: ready.length,
    alreadyImported: outcomes.filter((o) => o.status === 'imported'),
    needsReview: outcomes.filter((o) => o.status === 'review'),
    skipped: outcomes.filter((o) => o.status === 'blocked'),
    warnings: ready.reduce((n, o) => n + o.row.warnings.length, 0),
    conflicts: memberConflicts,
    planByMonths,
    summary: {
      rows: a.rows.length,
      uniqueMembers: all.length,
      rowsWithPhone: a.rows.filter((r) => r.hasPhone).length,
      rowsWithoutPhone: a.rows.filter((r) => !r.phone).length,
      gymRows: a.rows.filter((r) => r.pkg.kind === 'membership').length,
      ptRows: a.rows.filter((r) => r.pkg.kind === 'pt').length,
      unclearRows: a.rows.filter((r) => r.pkg.kind === 'unknown').length,
      possibleExisting: [...people.values()].filter((p) => p.existing).length + outcomes.filter((o) => o.attachTo).length,
      conflicts: identityConflicts + memberConflicts,
      needsReview: outcomes.filter((o) => o.status === 'review').length,
      blocked: outcomes.filter((o) => o.status === 'blocked').length,
      alreadyImported: outcomes.filter((o) => o.status === 'imported').length,
    },
  };
}
