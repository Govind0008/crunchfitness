// Legacy member import — the gym's old spreadsheets (the "Membership" sheet of the monthly
// workbook, or the older "Member details" sheet) → members, membership periods, PT packages and
// payments. A migration, not an upload:
//
//   read → map columns → understand each row → group rows into people and records → review only
//   what's ambiguous → preview → confirm → write
//
// Rules this module keeps:
// - A row is a payment, not a member. People are matched by phone; one membership paid in two
//   instalments is one membership record with two payments. Repeated rows are never deleted.
// - Nothing is invented: no dates, trainer, PT sessions or price unless the sheet says. The
//   method is the sheet's "Mode", or "Not recorded".
// - PT is its own record and never extends a gym membership.
// - The balance column is evidence, never debt: kept as text (plus a candidate number). No dues.
// - History stays history: an imported member is active only if a period actually runs today.
// - Idempotent: every payment's id comes from file + sheet + row + its fields, and a fingerprint
//   (member, date, package, dates, amount) recognises the same payment from any file or row.
// - Existing records are never overwritten — differences are shown as conflicts.
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { activeUntilOf } from './members';
import { logTo, type AdminActor } from './activity';
import type { LegacyRef } from './packages';
import type { Analysis, ImportPlan, ImportedRef, LegacyRow, PlannedRecord, RowOutcome } from './legacySheet';

export * from './legacySheet';

// ── 5. Write ─────────────────────────────────────────────────────────────────
export const LEGACY_SOURCE = 'legacy_excel';
const paymentId = (r: LegacyRow) => `${r.key}_p`;

/**
 * Payments already in the system for these rows, by fingerprint. Also finds payments from earlier
 * imports, which were stored under the fingerprint as their key.
 */
export async function importedPayments(fingerprints: string[]): Promise<Map<string, ImportedRef>> {
  const found = new Map<string, ImportedRef>();
  const unique = [...new Set(fingerprints)];
  for (const field of ['legacy.fingerprint', 'legacy.key']) {
    for (let i = 0; i < unique.length; i += 30) {
      const snap = await getDocs(query(collection(db, 'payments'), where(field, 'in', unique.slice(i, i + 30))));
      snap.docs.forEach((d) => {
        const l = d.data().legacy as LegacyRef;
        found.set(field === 'legacy.key' ? l.key : l.fingerprint!, { key: l.key, file: l.file, sheet: l.sheet, row: l.row });
      });
    }
  }
  return found;
}

export type TraceOutcome = 'imported' | 'already_imported' | 'needs_review' | 'cannot_import';
/** One line of the import report: what happened to a sheet row, and where it went. */
export interface TraceRow {
  row: number;
  name: string;
  phone: string;
  packageRaw: string;
  type: 'membership' | 'pt' | 'unknown';
  amountPaise: number | null;
  paidOn: string | null;
  outcome: TraceOutcome;
  memberId: string | null;
  recordId: string | null;
  paymentId: string | null;
  note: string;
}

export interface ImportResult {
  id: string;
  file: string;
  sheet: string;
  rows: number;
  membersCreated: number;
  membersMatched: number;
  memberships: number;
  ptPackages: number;
  payments: number;
  skipped: number;
  needsReview: number;
  duplicatesPrevented: number;
  warnings: number;
  conflicts: number;
  /** Sheet rows by what happened to them (stored with the import log) */
  rowsImported?: number[];
  rowsAlreadyImported?: number[];
  rowsNeedingReview?: number[];
  rowsNotImported?: number[];
  /** Row-by-row report (this session only) */
  trace?: TraceRow[];
}

const recordFields = (rec: PlannedRecord) => ({
  originalPackageLabel: rec.pkg.raw, normalizedDuration: rec.pkg.normalizedDuration, packageType: rec.pkg.packageType,
  baseMonths: rec.pkg.baseMonths, bonusMonths: rec.pkg.bonusMonths, totalMonths: rec.pkg.months, days: rec.pkg.days,
});
const legacyOf = (a: Analysis, r: LegacyRow): LegacyRef => ({
  file: a.file, sheet: a.sheet, row: r.row, srNo: r.srNo, key: r.key, fingerprint: r.fingerprint, highlight: r.highlight,
  packageRaw: r.pkg.raw, methodRaw: r.methodRaw, comment: r.comment, feedback: r.feedback,
});
const balanceOf = (r: LegacyRow) => ({ legacyBalanceText: r.balance.note, legacyBalanceAmountPaise: r.balance.kind === 'amount' ? r.balance.amountPaise : null });
const notesOf = (r: LegacyRow) => [r.comment && `Sheet comment: ${r.comment}`, r.feedback && `Feedback: ${r.feedback}`].filter(Boolean).join(' · ');

/**
 * Write the plan. One transaction per member: the member (if new), each membership / PT record (if
 * not already there) and each payment — all or nothing for that member. Every id is deterministic
 * and each document is created only if it doesn't exist, so a second run (or a run interrupted
 * halfway) never duplicates anything.
 */
export async function runImport(a: Analysis, plan: ImportPlan, actor: AdminActor, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  let created = 0, matched = 0, memberships = 0, pts = 0, payments = 0;
  const written = new Map<number, { memberId: string; recordId: string; paymentId: string }>();
  const raced = new Set<number>();
  let n = 0;
  for (const m of plan.members) {
    const memberRef = doc(db, 'members', m.id);
    // Counted from the attempt that commits (a transaction can be retried)
    const t = await runTransaction(db, async (tx) => {
      const recs = m.records.map((rec) => ({ rec, ref: doc(db, rec.kind === 'pt' ? 'ptPackages' : 'memberships', rec.id) }));
      const pays = m.records.flatMap((rec) => rec.rows.map((r) => ({ rec, r, ref: doc(db, 'payments', paymentId(r)) })));
      const [memberSnap, ...snaps] = await Promise.all([tx.get(memberRef), ...recs.map((x) => tx.get(x.ref)), ...pays.map((x) => tx.get(x.ref))]);
      const recSnaps = snaps.slice(0, recs.length), paySnaps = snaps.slice(recs.length);
      let madeMember = false, nm = 0, np = 0, npay = 0;
      const rowsDone: typeof written = new Map();
      const alreadyThere = new Set<number>();
      if (!m.existing && !memberSnap.exists()) {
        // History stays history: active only if the latest gym membership runs today. People with
        // only PT, day passes or undated rows have no dated gym membership, so they're inactive.
        const hasMembership = !!m.membershipEnd;
        const status = hasMembership ? 'active' as const : 'inactive' as const;
        tx.set(memberRef, {
          name: m.name, nameLower: m.name.toLowerCase(), phone: m.phone, phoneKey: m.phoneKey, email: '', emailLower: '',
          planId: m.planId, membershipStart: m.membershipStart, membershipEnd: m.membershipEnd, status,
          activeUntil: activeUntilOf({ status, membershipEnd: m.membershipEnd }), trainerId: null, trainerClient: null,
          notes: hasMembership ? '' : `Imported from ${a.file} (${a.sheet}) — no dated gym membership on record (personal training, day passes or dates not in the sheet).`,
          source: LEGACY_SOURCE, legacy: { file: a.file, sheet: a.sheet, firstRow: m.outcomes[0]?.row.row ?? null },
          createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        madeMember = true;
      }
      const memberName = m.existing?.name ?? (memberSnap.exists() ? (memberSnap.data().name as string) : m.name);
      const newPays = pays.filter((x, i) => { if (paySnaps[i].exists()) { alreadyThere.add(x.r.row); return false; } return true; });
      recs.forEach(({ rec, ref }, i) => {
        const rows = newPays.filter((x) => x.rec === rec).map((x) => x.r);
        if (recSnaps[i].exists() || !rows.length) return;       // already there (an earlier instalment) — never overwritten
        const first = rows[0];
        const legacy: LegacyRef = { ...legacyOf(a, first), key: rec.id, rows: rows.map((r) => r.row) };
        const base = { memberId: memberRef.id, paymentId: paymentId(first), source: LEGACY_SOURCE, legacy, ...balanceOf(first), ...recordFields(rec), createdBy: actor.email, createdAt: serverTimestamp() };
        if (rec.kind === 'pt') {
          tx.set(ref, { ...base, trainerId: null, packageName: rec.pkg.label, sessionsIncluded: null, sessionsRemaining: null, startDate: rec.start, endDate: rec.end, notes: notesOf(first), updatedAt: serverTimestamp() });
          np++;
        } else {
          const months = rec.pkg.packageType === 'bonus' ? rec.pkg.baseMonths : rec.pkg.months;
          tx.set(ref, { ...base, planId: (months && plan.planByMonths[months]) || null, planLabel: rec.pkg.label, startDate: rec.start, endDate: rec.end });
          nm++;
        }
      });
      newPays.forEach(({ rec, r, ref }) => {
        const isPt = rec.kind === 'pt';
        tx.set(ref, {
          receiptNo: null, receiptSeq: null, paymentType: isPt ? 'pt' : 'membership', source: LEGACY_SOURCE,
          membershipId: isPt ? null : rec.id, ptPackageId: isPt ? rec.id : null,
          memberId: memberRef.id, memberName, memberPhone: m.phone, memberPhoneKey: m.phoneKey,
          planId: null, planName: rec.pkg.label, amountPaise: r.amountPaise, countedPaise: r.amountPaise,
          listPricePaise: null, discountPaise: 0, kind: null,
          method: r.method, reference: '', paidOn: r.paidOn, coversFrom: rec.start, coversTo: rec.end,
          notes: notesOf(r), status: 'paid', legacy: { ...legacyOf(a, r), ...balanceOf(r), sheetName: r.name },
          createdBy: actor.email, createdAt: serverTimestamp(),
        });
        rowsDone.set(r.row, { memberId: memberRef.id, recordId: rec.id, paymentId: paymentId(r) });
        npay++;
      });
      if (madeMember || npay) logTo(tx, actor, 'Legacy records imported', 'member', memberRef.id, { name: memberName, rows: npay, newMember: madeMember, file: a.file });
      return { madeMember, nm, np, npay, rowsDone, alreadyThere, existed: !!m.existing || memberSnap.exists() };
    });
    if (t.madeMember) created++; else if (t.existed) matched++;
    memberships += t.nm; pts += t.np; payments += t.npay;
    t.rowsDone.forEach((v, k) => written.set(k, v));
    t.alreadyThere.forEach((row) => raced.add(row));
    onProgress?.(++n, plan.members.length);
  }

  const trace = traceOf(plan, written, raced);
  const logRef = doc(collection(db, 'imports'));
  const rowsOf = (o: TraceOutcome) => trace.filter((t) => t.outcome === o).map((t) => t.row);
  const result: ImportResult = {
    id: logRef.id, file: a.file, sheet: a.sheet, rows: a.rows.length, membersCreated: created, membersMatched: matched,
    memberships, ptPackages: pts, payments, skipped: plan.skipped.length, needsReview: plan.needsReview.length,
    duplicatesPrevented: rowsOf('already_imported').length, warnings: plan.warnings, conflicts: plan.summary.conflicts,
    rowsImported: rowsOf('imported'), rowsAlreadyImported: rowsOf('already_imported'), rowsNeedingReview: rowsOf('needs_review'), rowsNotImported: rowsOf('cannot_import'),
  };
  const b = writeBatch(db);
  const { id: _id, ...counts } = result; void _id;
  b.set(logRef, { ...counts, kind: 'legacy_member_sheet', createdBy: actor.email, actorUid: actor.uid, createdAt: serverTimestamp() });
  logTo(b, actor, 'Legacy import finished', 'import', logRef.id, { file: a.file, sheet: a.sheet, created, matched, payments });
  await b.commit();
  return { ...result, trace };
}

/** Every sheet row, with what happened to it — the import report. */
export function traceOf(plan: ImportPlan, written = new Map<number, { memberId: string; recordId: string; paymentId: string }>(), raced = new Set<number>()): TraceRow[] {
  return plan.outcomes.map((o: RowOutcome) => {
    const r = o.row;
    const w = written.get(r.row);
    const outcome: TraceOutcome = w ? 'imported' : o.status === 'imported' || raced.has(r.row) ? 'already_imported' : o.status === 'review' ? 'needs_review' : o.status === 'blocked' ? 'cannot_import' : 'already_imported';
    const note = outcome === 'already_imported' ? (o.importedFrom ? `Already imported from ${o.importedFrom.file}, row ${o.importedFrom.row}` : 'Already imported')
      : outcome === 'imported' ? [o.attachTo && `Added to ${o.attachTo.name} (no phone in the sheet)`, r.groupWith && `Same record as row ${r.groupWith}`].filter(Boolean).join(' · ')
      : o.reasons.join(' · ');
    return {
      row: r.row, name: r.name, phone: r.phone, packageRaw: r.pkg.raw, type: r.pkg.kind, amountPaise: r.amountPaise, paidOn: r.paidOn,
      outcome, memberId: w?.memberId ?? (outcome === 'already_imported' ? o.personId : null), recordId: w?.recordId ?? null, paymentId: w?.paymentId ?? null, note,
    };
  });
}

export async function importHistory(): Promise<(ImportResult & { createdBy: string; createdAt?: { toDate: () => Date } })[]> {
  const snap = await getDocs(collection(db, 'imports'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ImportResult & { createdBy: string; createdAt?: { toDate: () => Date } })
    .sort((x, y) => (y.createdAt?.toDate().getTime() ?? 0) - (x.createdAt?.toDate().getTime() ?? 0));
}
