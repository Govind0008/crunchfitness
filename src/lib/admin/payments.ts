// Payments — a ledger of money the gym actually received (no gateway, no invented amounts).
//
// Money is stored in paise (integers) so totals never drift from floating-point rounding.
// `countedPaise` = amountPaise while paid, 0 once voided: every revenue total is one server-side
// sum over a single-field date range (no composite indexes, no counters that can drift).
// Payments are never edited or deleted — a mistake is voided with a reason (the rules enforce it).
//
// Not modelled yet (next controlled enhancement, see PRODUCTION_CONFIGURATION.md): part payments
// with a tracked outstanding balance. Today each payment is money received; a balance paid later
// is simply another payment. Discounts are recorded as a snapshot on the payment only — a plan's
// stored price never changes because one member got a discount.
import {
  collection, count, doc, getAggregateFromServer, getDoc, getDocs, limit, orderBy, query, runTransaction,
  serverTimestamp, sum, where, type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { receiptNumber } from '@/lib/gym';
import { activeUntilOf, todayIST, type Member } from './members';
import { phoneKey } from './phone';
import type { AdminActor } from './activity';
import type { LegacyBalance, LegacyRef } from './packages';

/** 'unknown' exists only for imported history whose method was never written down. */
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other' | 'unknown';
export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank_transfer: 'Bank transfer', other: 'Other', unknown: 'Not recorded' };
/** Methods staff can choose when recording a payment */
export const RECORDABLE_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'bank_transfer', 'other'];

/** What the money was for. Older payments have no type — see paymentTypeOf(). */
export type PaymentType = 'membership' | 'pt' | 'other';
export const TYPE_LABEL: Record<PaymentType, string> = { membership: 'Membership', pt: 'Personal training', other: 'Other' };

export interface Payment {
  id: string;
  /** CR-R-0001 — sequential, never reused. null for imported history (no receipt was issued here). */
  receiptNo: string | null;
  receiptSeq: number | null;   // the number behind receiptNo (the rules check it against the counter)
  paymentType?: PaymentType;
  /** The membership period or PT package this payment was for */
  membershipId?: string | null;
  ptPackageId?: string | null;
  source?: 'admin' | 'legacy_excel';
  /** For "other" payments */
  category?: string | null;
  legacy?: LegacyRef & LegacyBalance;
  memberId: string;
  // Snapshots: a receipt must keep showing what was true when it was issued
  memberName: string;
  memberPhone: string;
  memberPhoneKey: string;
  planId: string | null;
  planName: string;
  amountPaise: number;
  countedPaise: number;        // amountPaise while paid, 0 once voided
  /** Plan's price when the payment was taken, and any discount given (snapshots; absent on older payments) */
  listPricePaise?: number | null;
  discountPaise?: number;
  /** First membership payment or a renewal (absent on older payments) */
  kind?: 'new' | 'renewal' | 'other' | null;
  method: PaymentMethod;
  reference: string;           // UPI / card / transfer reference
  paidOn: string;              // YYYY-MM-DD (Pune)
  coversFrom: string | null;
  coversTo: string | null;
  notes: string;
  status: 'paid' | 'void';
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: Timestamp;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface PtInput {
  /** Pay for a package that already exists (created earlier, not yet paid); otherwise a new one */
  packageId?: string | null;
  packageName: string;
  trainerId: string | null;
  sessionsIncluded: number | null;
}
/** Kinds of "other" payment — labels only, no prices attached */
export const OTHER_CATEGORIES = ['Registration fee', 'Locker', 'Merchandise', 'Supplements', 'Other'] as const;
export type OtherCategory = (typeof OTHER_CATEGORIES)[number];

export interface PaymentInput {
  member: Member;
  paymentType: PaymentType;
  /** Personal training package details (paymentType 'pt') */
  pt?: PtInput;
  /** What an "other" payment was for (paymentType 'other') */
  other?: { category: OtherCategory; description: string };
  planId: string | null;
  planName: string;
  amountRupees: number;
  /** Plan price shown to staff at the time (a snapshot for the receipt), if known */
  listPriceRupees: number | null;
  discountRupees: number;
  method: PaymentMethod;
  reference: string;
  paidOn: string;
  coversFrom: string | null;
  coversTo: string | null;
  notes: string;
  /** Also move the member's plan/expiry to this payment's period */
  extendMembership: boolean;
}

const col = () => collection(db, 'payments');

/** Type of any payment: explicit on new ones; older ones were membership (with a plan) or other. */
export const paymentTypeOf = (p: Pick<Payment, 'paymentType' | 'planId' | 'kind'>): PaymentType =>
  p.paymentType ?? (p.planId && p.kind !== 'other' ? 'membership' : 'other');
/** What a payment was for, in words: "3 Months membership", "Personal training — 1 Month PT", "Other payment". */
export function paymentFor(p: Payment) {
  const t = paymentTypeOf(p);
  if (t === 'pt') return `Personal training${p.planName ? ` — ${p.planName}` : ''}`;
  if (t === 'membership') return p.planName ? `${p.planName} membership` : 'Membership';
  return p.category && p.planName && p.planName !== p.category ? `${p.category} — ${p.planName}` : p.planName || p.category || 'Other payment';
}
/** Explicit names wherever the type matters: "Membership payment", "PT payment", "Other payment". */
export const PAYMENT_LABEL: Record<PaymentType, string> = { membership: 'Membership payment', pt: 'PT payment', other: 'Other payment' };

/** Receipt number, or a plain label for imported history. */
export const receiptLabel = (p: Pick<Payment, 'receiptNo'>) => p.receiptNo ?? 'Imported';
/** Newest first; ties broken by receipt number (imported records have none). */
const newestFirst = (a: Payment, b: Payment) => b.paidOn.localeCompare(a.paidOn) || (b.receiptNo ?? '').localeCompare(a.receiptNo ?? '');
const toPayment = (d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, ...d.data() }) as Payment;

export const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
export const toPaise = (r: number) => Math.round(r * 100);

/** "₹6,500" / "6500" / "Rs. 6,500.00" → 6500 (null if it isn't a clean amount). A suggestion only. */
export function parsePrice(price: string | undefined): number | null {
  if (!price) return null;
  const m = price.replace(/,/g, '').match(/(\d+(?:\.\d{1,2})?)/);
  return m ? Number(m[1]) : null;
}

/** Indian-English amount in words for receipts: 106500 paise → "One thousand sixty-five rupees only". */
export function amountInWords(paise: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const two = (n: number) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`);
  const three = (n: number) => [n >= 100 ? `${ones[Math.floor(n / 100)]} hundred` : '', n % 100 ? two(n % 100) : ''].filter(Boolean).join(' ');
  const words = (n: number): string => {
    if (n === 0) return 'zero';
    const parts: string[] = [];
    const crore = Math.floor(n / 1e7), lakh = Math.floor((n % 1e7) / 1e5), thousand = Math.floor((n % 1e5) / 1e3), rest = n % 1e3;
    if (crore) parts.push(`${words(crore)} crore`);
    if (lakh) parts.push(`${two(lakh)} lakh`);
    if (thousand) parts.push(`${two(thousand)} thousand`);
    if (rest) parts.push(three(rest));
    return parts.join(' ');
  };
  const r = Math.floor(paise / 100), p = paise % 100;
  const s = `${words(r)} rupees${p ? ` and ${two(p)} paise` : ''} only`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function validatePayment(i: Omit<PaymentInput, 'member'> & { member: Member | null }): string[] {
  const e: string[] = [];
  if (!i.member) e.push('Choose the member who paid.');
  if (!Number.isFinite(i.amountRupees) || i.amountRupees <= 0) e.push('Enter the amount received.');
  if (Math.abs(i.amountRupees * 100 - Math.round(i.amountRupees * 100)) > 1e-6) e.push('Amounts can have at most 2 decimal places.');
  if (!i.paidOn) e.push('Enter the date the money was received.');
  if (i.paidOn && i.paidOn > todayIST()) e.push('The payment date can’t be in the future.');
  if (i.coversFrom && i.coversTo && i.coversTo < i.coversFrom) e.push('The period must end after it starts.');
  if (i.extendMembership && !i.coversTo) e.push('Add the “covers until” date to extend the membership.');
  if (!Number.isFinite(i.discountRupees) || i.discountRupees < 0) e.push('The discount can’t be negative.');
  if (i.listPriceRupees != null && i.discountRupees > i.listPriceRupees) e.push('The discount can’t be more than the plan price.');
  if (i.paymentType === 'pt' && !i.pt?.packageId && !i.pt?.packageName.trim()) e.push('Name the PT package (e.g. “1 Month PT”).');
  if (i.paymentType === 'other' && !i.other?.category) e.push('Choose what the payment is for.');
  if (i.paymentType === 'other' && i.other?.category === 'Other' && !i.other.description.trim()) e.push('Describe what the payment is for.');
  if (i.paymentType === 'pt' && !i.pt?.packageId && (!i.coversFrom || !i.coversTo)) e.push('Add when the PT package starts and ends.');
  if (i.paymentType === 'pt' && i.pt?.sessionsIncluded != null && (!Number.isInteger(i.pt.sessionsIncluded) || i.pt.sessionsIncluded < 1)) e.push('Sessions must be a whole number.');
  if (i.paymentType !== 'membership' && i.extendMembership) e.push('Only a membership payment can extend the membership.');
  return e;
}

/** New member, renewal, or a payment that isn't for a plan — decided from the member record before the payment. */
export const paymentKind = (member: Pick<Member, 'membershipEnd' | 'membershipStart'>, planId: string | null): NonNullable<Payment['kind']> =>
  !planId ? 'other' : member.membershipEnd || member.membershipStart ? 'renewal' : 'new';
/** New vs renewal applies to membership payments only — never to PT. */
export const kindFor = (i: Pick<PaymentInput, 'paymentType' | 'member' | 'planId'>): Payment['kind'] =>
  i.paymentType === 'membership' ? paymentKind(i.member, i.planId) : null;
export const KIND_LABEL: Record<NonNullable<Payment['kind']>, string> = { new: 'New membership', renewal: 'Renewal', other: 'Other payment' };

/**
 * Record a payment. One transaction: take the next receipt number, write the payment, optionally
 * move the member's plan and expiry to the paid period, and log it — all or nothing.
 */
export async function recordPayment(i: PaymentInput, actor: AdminActor): Promise<string> {
  const counterRef = doc(db, 'counters', 'receipts');
  const payRef = doc(col());
  // A membership period or PT package is recorded alongside the payment it came from
  const membershipRef = i.paymentType === 'membership' && i.coversFrom && i.coversTo ? doc(collection(db, 'memberships')) : null;
  const existingPt = i.paymentType === 'pt' && i.pt?.packageId ? doc(db, 'ptPackages', i.pt.packageId) : null;
  const ptRef = i.paymentType === 'pt' && !existingPt ? doc(collection(db, 'ptPackages')) : null;
  await runTransaction(db, async (tx) => {
    const c = await tx.get(counterRef);
    const pkg = existingPt ? await tx.get(existingPt) : null;
    if (existingPt && !pkg?.exists()) throw new Error('That PT package no longer exists.');
    const next = ((c.data()?.next as number | undefined) ?? 0) + 1;
    tx.set(counterRef, { next });
    const amountPaise = toPaise(i.amountRupees);
    tx.set(payRef, {
      receiptNo: receiptNumber(next), receiptSeq: next, paymentType: i.paymentType, source: 'admin',
      membershipId: membershipRef?.id ?? null, ptPackageId: ptRef?.id ?? existingPt?.id ?? null,
      category: i.paymentType === 'other' ? i.other!.category : null,
      memberId: i.member.id, memberName: i.member.name, memberPhone: i.member.phone, memberPhoneKey: phoneKey(i.member.phone),
      planId: i.paymentType === 'membership' ? i.planId : null,
      planName: i.paymentType === 'pt' ? (pkg?.data()?.packageName as string | undefined) ?? i.pt!.packageName.trim()
        : i.paymentType === 'other' ? (i.other!.description.trim() || i.other!.category) : i.planName,
      amountPaise, countedPaise: amountPaise,
      listPricePaise: i.listPriceRupees != null ? toPaise(i.listPriceRupees) : null, discountPaise: toPaise(i.discountRupees || 0),
      kind: kindFor(i),
      method: i.method, reference: i.reference.trim(), paidOn: i.paidOn, coversFrom: i.coversFrom, coversTo: i.coversTo,
      notes: i.notes.trim(), status: 'paid', createdBy: actor.email, createdAt: serverTimestamp(),
    });
    if (membershipRef) {
      tx.set(membershipRef, {
        memberId: i.member.id, planId: i.planId, planLabel: i.planName, startDate: i.coversFrom, endDate: i.coversTo,
        paymentId: payRef.id, source: 'payment', createdBy: actor.email, createdAt: serverTimestamp(),
      });
    }
    // First payment for an existing package links it; later ones (instalments) just reference it
    if (existingPt && !pkg!.data()!.paymentId) tx.update(existingPt, { paymentId: payRef.id, updatedAt: serverTimestamp() });
    if (ptRef) {
      tx.set(ptRef, {
        memberId: i.member.id, trainerId: i.pt!.trainerId || null, packageName: i.pt!.packageName.trim(),
        sessionsIncluded: i.pt!.sessionsIncluded, sessionsUsed: 0, sessionsRemaining: null, startDate: i.coversFrom, endDate: i.coversTo,
        notes: '', paymentId: payRef.id, source: 'payment', createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    // Only a membership payment moves the gym membership — PT never does
    if (i.paymentType === 'membership' && i.extendMembership && i.coversTo) {
      const patch = {
        planId: i.planId ?? i.member.planId, membershipEnd: i.coversTo, status: 'active' as const,
        membershipStart: i.member.membershipStart ?? i.coversFrom, updatedAt: serverTimestamp(),
      };
      tx.update(doc(db, 'members', i.member.id), { ...patch, activeUntil: activeUntilOf({ status: 'active', membershipEnd: i.coversTo }) });
    }
    tx.set(doc(collection(db, 'activity')), {
      action: 'Payment recorded', actorUid: actor.uid, actorEmail: actor.email, refType: 'payment', refId: payRef.id,
      meta: { name: i.member.name, amount: rupees(amountPaise), for: TYPE_LABEL[i.paymentType], method: METHOD_LABEL[i.method], receipt: receiptNumber(next), extended: i.paymentType === 'membership' && i.extendMembership && !!i.coversTo },
      at: serverTimestamp(),
    });
  });
  return payRef.id;
}

export async function voidPayment(p: Payment, reason: string, actor: AdminActor) {
  await runTransaction(db, async (tx) => {
    tx.update(doc(col(), p.id), { status: 'void', countedPaise: 0, voidReason: reason.trim(), voidedBy: actor.email, voidedAt: serverTimestamp() });
    tx.set(doc(collection(db, 'activity')), {
      action: 'Payment voided', actorUid: actor.uid, actorEmail: actor.email, refType: 'payment', refId: p.id,
      meta: { name: p.memberName, amount: rupees(p.amountPaise), receipt: receiptLabel(p), reason: reason.trim() }, at: serverTimestamp(),
    });
  });
}

export async function getPayment(id: string) {
  const s = await getDoc(doc(col(), id));
  return s.exists() ? toPayment(s) : null;
}

export const LIST_LIMIT = 500;
/** Payments in a date range, newest first (single-field range — no composite index). */
export async function paymentsBetween(from: string, to: string) {
  const snap = await getDocs(query(col(), where('paidOn', '>=', from), where('paidOn', '<=', to), orderBy('paidOn', 'desc'), limit(LIST_LIMIT)));
  return snap.docs.map(toPayment).sort(newestFirst);
}
export async function paymentsOfMember(memberId: string) {
  const snap = await getDocs(query(col(), where('memberId', '==', memberId), limit(100)));
  return snap.docs.map(toPayment).sort(newestFirst);
}
export async function paymentByReceipt(receiptNo: string) {
  const snap = await getDocs(query(col(), where('receiptNo', '==', receiptNo.toUpperCase()), limit(1)));
  return snap.empty ? null : toPayment(snap.docs[0]);
}

/** Revenue (voided payments excluded) and payment count for a date range, summed by the server. */
export async function revenueBetween(from: string, to: string) {
  const q = query(col(), where('paidOn', '>=', from), where('paidOn', '<=', to));
  // One round trip for both numbers. `payments` counts every receipt in the range, void ones too.
  const agg = await getAggregateFromServer(q, { total: sum('countedPaise'), payments: count() });
  return { paise: agg.data().total ?? 0, payments: agg.data().payments };
}

// ── Periods (Pune dates) ─────────────────────────────────────────────────────
export const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;
export function monthEnd(ymd: string) {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
export function shiftMonth(ymd: string, n: number) {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
export const monthLabel = (ymd: string) => new Date(`${ymd.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

/** Everything grouped by one key, for a period's breakdown (the caller's list is already bounded). */
export function groupTotals<K extends string>(payments: Payment[], key: (p: Payment) => K) {
  const m = new Map<K, { paise: number; count: number }>();
  payments.filter((p) => p.status === 'paid').forEach((p) => {
    const k = key(p); const cur = m.get(k) ?? { paise: 0, count: 0 };
    m.set(k, { paise: cur.paise + p.amountPaise, count: cur.count + 1 });
  });
  return [...m.entries()].sort((a, b) => b[1].paise - a[1].paise);
}

/** CSV text with proper quoting (reports). */
/** Save CSV text as a file (in the browser — nothing is uploaded anywhere). The byte-order mark makes Excel read ₹ and Indian names correctly. */
export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}
