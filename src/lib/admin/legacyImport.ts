// Legacy member import — the gym's old "Member details" spreadsheet → members, membership
// periods, PT packages and payments. A migration, not an upload:
//
//   read → map columns → classify each row (membership / PT / needs review) → preview → confirm → write
//
// Rules this module keeps:
// - Nothing is invented. No payment method, trainer, PT sessions or PT price unless the sheet says.
// - "01 month pt" is a PT package, never a gym membership plan.
// - The "bal" column is evidence, never debt: a number is kept as a candidate balance (and the row
//   is flagged), text is kept as a note. Dues are not created from it.
// - History stays history: an imported member is active only if a period actually runs today.
// - Idempotent: every row has a deterministic key; re-importing the same sheet creates nothing new.
// - Existing records are never overwritten — differences are shown as conflicts.
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { activeUntilOf } from './members';
import { logTo, type AdminActor } from './activity';
import type { LegacyRef } from './packages';
import type { Analysis, ImportPlan } from './legacySheet';

export * from './legacySheet';


// ── 5. Write ─────────────────────────────────────────────────────────────────
export const LEGACY_SOURCE = 'legacy_excel';
const ids = (key: string) => ({ membership: `${key}_m`, pt: `${key}_pt`, payment: `${key}_p` });
export const legacyMemberId = (phoneKey: string) => `lx_${phoneKey}`;

/** Which of these rows are already in the system (their payment document exists). */
export async function importedKeys(keys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const unique = [...new Set(keys)];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await getDocs(query(collection(db, 'payments'), where('legacy.key', 'in', unique.slice(i, i + 30))));
    snap.docs.forEach((d) => found.add(d.data().legacy.key as string));
  }
  return found;
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
}

/**
 * Write the plan. One transaction per member: the member (if new), then each row's membership
 * period or PT package and its payment — all or nothing for that member. Every document id is
 * derived from the row key, and each is created only if it doesn't exist yet, so a second run
 * (or a run interrupted halfway) never duplicates anything.
 */
export async function runImport(a: Analysis, plan: ImportPlan, actor: AdminActor, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  let created = 0, matched = 0, memberships = 0, pts = 0, payments = 0, prevented = plan.alreadyImported.length;
  let n = 0;
  for (const m of plan.members) {
    const memberRef = doc(db, 'members', m.existing?.id ?? legacyMemberId(m.phoneKey));
    await runTransaction(db, async (tx) => {
      const rowRefs = m.rows.map((r) => ({ r, ids: ids(r.key) }));
      const [memberSnap, ...paySnaps] = await Promise.all([tx.get(memberRef), ...rowRefs.map((x) => tx.get(doc(db, 'payments', x.ids.payment)))]);
      let madeMember = false;
      if (!m.existing && !memberSnap.exists()) {
        // History stays history: active only if the latest membership runs today. PT-only
        // people have no gym membership on record, so they're added as inactive members.
        const hasMembership = !!m.membershipEnd;
        const status = hasMembership ? 'active' as const : 'inactive' as const;
        tx.set(memberRef, {
          name: m.name, nameLower: m.name.toLowerCase(), phone: m.phone, phoneKey: m.phoneKey, email: '', emailLower: '',
          planId: m.planId, membershipStart: m.membershipStart, membershipEnd: m.membershipEnd, status,
          activeUntil: activeUntilOf({ status, membershipEnd: m.membershipEnd }), trainerId: null, trainerClient: null,
          notes: hasMembership ? '' : 'Imported from the old member sheet — personal training only, no gym membership on record.',
          source: LEGACY_SOURCE, legacy: { file: a.file, sheet: a.sheet, firstRow: m.rows[0].row },
          createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        madeMember = true;
      }
      const memberName = m.existing?.name ?? (memberSnap.exists() ? (memberSnap.data().name as string) : m.name);
      let rowsWritten = 0;
      rowRefs.forEach(({ r, ids: id }, i) => {
        if (paySnaps[i].exists()) { prevented++; return; }
        const legacy: LegacyRef = { file: a.file, sheet: a.sheet, row: r.row, srNo: r.srNo, key: r.key, highlight: r.highlight };
        const bal = { legacyBalanceAmountPaise: r.balance.kind === 'amount' ? r.balance.amountPaise : null, legacyBalanceNote: r.balance.note };
        const isPt = r.pkg.kind === 'pt';
        if (isPt) {
          tx.set(doc(db, 'ptPackages', id.pt), {
            memberId: memberRef.id, trainerId: null, packageName: r.pkg.label, sessionsIncluded: null, sessionsRemaining: null,
            startDate: r.start, endDate: r.end, notes: '', paymentId: id.payment, source: LEGACY_SOURCE, legacy, ...bal,
            createdBy: actor.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(doc(db, 'memberships', id.membership), {
            memberId: memberRef.id, planId: (r.pkg.months && plan.planByMonths[r.pkg.months]) || null,
            planLabel: r.pkg.label, startDate: r.start, endDate: r.end, paymentId: id.payment, source: LEGACY_SOURCE, legacy, ...bal,
            createdBy: actor.email, createdAt: serverTimestamp(),
          });
        }
        tx.set(doc(db, 'payments', id.payment), {
          receiptNo: null, receiptSeq: null, paymentType: isPt ? 'pt' : 'membership', source: LEGACY_SOURCE,
          membershipId: isPt ? null : id.membership, ptPackageId: isPt ? id.pt : null,
          memberId: memberRef.id, memberName, memberPhone: r.phone, memberPhoneKey: r.phoneKey,
          planId: null, planName: r.pkg.label, amountPaise: r.amountPaise, countedPaise: r.amountPaise,
          listPricePaise: null, discountPaise: 0, kind: null,
          method: 'unknown', reference: '', paidOn: r.paidOn, coversFrom: r.start, coversTo: r.end,
          notes: '', status: 'paid', legacy: { ...legacy, ...bal },
          createdBy: actor.email, createdAt: serverTimestamp(),
        });
        rowsWritten++;
        if (isPt) pts++; else memberships++;
        payments++;
      });
      if (madeMember || rowsWritten) {
        logTo(tx, actor, 'Legacy records imported', 'member', memberRef.id, { name: memberName, rows: rowsWritten, newMember: madeMember });
      }
      if (madeMember) created++; else if (m.existing || memberSnap.exists()) matched++;
    });
    onProgress?.(++n, plan.members.length);
  }

  const logRef = doc(collection(db, 'imports'));
  const result: ImportResult = {
    id: logRef.id, file: a.file, sheet: a.sheet, rows: a.rows.length, membersCreated: created, membersMatched: matched,
    memberships, ptPackages: pts, payments, skipped: plan.skipped.length, needsReview: plan.needsReview.length,
    duplicatesPrevented: prevented, warnings: plan.warnings, conflicts: plan.conflicts,
  };
  const b = writeBatch(db);
  const { id: _id, ...counts } = result; void _id;
  b.set(logRef, { ...counts, kind: 'legacy_member_sheet', createdBy: actor.email, actorUid: actor.uid, createdAt: serverTimestamp() });
  logTo(b, actor, 'Legacy import finished', 'import', logRef.id, { file: a.file, created, matched, payments });
  await b.commit();
  return result;
}

export async function importHistory(): Promise<(ImportResult & { createdBy: string; createdAt?: { toDate: () => Date } })[]> {
  const snap = await getDocs(collection(db, 'imports'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ImportResult & { createdBy: string; createdAt?: { toDate: () => Date } })
    .sort((x, y) => (y.createdAt?.toDate().getTime() ?? 0) - (x.createdAt?.toDate().getTime() ?? 0));
}
