import { test, expect } from '@playwright/test';
import { analyse, planImport } from '../../src/lib/admin/legacySheet';

// Instalments: rows for the same person, package and written dates are one record with several
// payments — also when those dates don't fit the package (flagged for review), as long as both
// dates are readable and identical. Made-up rows only.
test.skip(({ isMobile }) => isMobile, 'logic test runs once');

const c = (value: string | number | null) => ({ value }) as never;
const header = ['Sr.No', 'Members Name', 'Mob Number', 'Date of payment', 'Membership', 'Start Date', 'End Date', 'Paid', 'Bal Amt', 'Mode', 'comment'].map(c);
const row = (sr: number, phone: string, paidOn: string, pkg: string, start: string, end: string, paid: number, comment = '') =>
  [sr, 'Test Person', phone, paidOn, pkg, start, end, paid, '', 'upi', comment].map((v) => c(v as never));

test('date-flagged instalments with the same written dates share one record; different dates stay separate', () => {
  const a = analyse('TEST.xlsx', 'Membership', [header,
    row(1, '9000000501', '02-01-2025', '03 months pt', '09-01-2025', '09-03-2025', 13000, '2nd bill'),   // 59 days for a 3-month PT: flagged
    row(2, '9000000501', '31-01-2025', '03 months pt', '09-01-2025', '09-03-2025', 13000, '1st bill'),   // same dates: the other instalment
    row(3, '9000000501', '15-02-2025', '03 months pt', '09-01-2025', '09-04-2025', 5000),               // different dates: its own record
  ]);
  const [r1, r2, r3] = a.rows;
  expect(r1.dateIssue && r2.dateIssue).toBe(true);
  expect(r2.recordId).toBe(r1.recordId);
  expect(r2.groupWith).toBe(r1.row);                                                   // sheet row numbers: the header is row 1
  expect(r3.recordId).not.toBe(r1.recordId);
  // Once approved, it imports as one PT record with both payments
  const p = planImport(a, new Map(), new Map(), [], new Map([[2, 'include'], [3, 'include'], [4, 'include']]));
  const recs = p.members[0].records;
  expect(recs.map((r) => r.rows.map((x) => x.row))).toEqual([[2, 3], [4]]);
  expect(p.payments).toBe(3);
});
