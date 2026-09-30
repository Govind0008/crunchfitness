import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { readXlsx, type XlsxCell } from '../../src/lib/admin/xlsx';
import { analyse, classifyBalance, classifyPackage, planImport, rowKey, toDate, toPhone } from '../../src/lib/admin/legacySheet';
import { phoneKey } from '../../src/lib/admin/phone';

// The old member sheet, read and understood — run against the REAL workbook the gym supplied.
// It holds real names and phone numbers, so it lives in tests/fixtures (git-ignored) and these
// tests skip when it isn't there. Copy it in: tests/fixtures/member-details.xlsx
export const FIXTURE = process.env.LEGACY_XLSX ?? 'tests/fixtures/member-details.xlsx';
test.skip(({ isMobile }) => isMobile, 'logic tests run once');

const cell = (value: XlsxCell['value'], date = false): XlsxCell => ({ value, date, fill: null });
async function load() {
  const b = readFileSync(FIXTURE);
  return readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
}

test.describe('the real workbook', () => {
  test.skip(!existsSync(FIXTURE), `real sheet not found at ${FIXTURE}`);

  test('A · reads the sheet: 15 rows under the known header, all columns mapped', async () => {
    const sheets = await load();
    expect(sheets.map((s) => s.name)).toEqual(['Sheet1']);
    const a = analyse('Member details.xlsx', 'Sheet1', sheets[0].rows);
    expect(a.header).toEqual(['Sr No', 'Name', 'Mob Number', 'Date of payment', 'Membership', 'Start Date', 'End Date', 'Paid', 'bal']);
    expect(a.missingColumns).toEqual([]);
    expect(a.rows).toHaveLength(15);
    expect(a.emptyRows).toBe(0);
    // Excel dates and phone numbers stored as numbers come out right
    const first = a.rows[0];
    expect(first).toMatchObject({ row: 2, srNo: '1', name: 'aditya ajayshankar', phoneKey: '9881715183', paidOn: '2022-09-01', start: '2022-09-02', end: '2022-10-02', amountPaise: 200000 });
  });

  test('C/D · PT rows are personal training, never a gym plan; the rest are memberships', async () => {
    const a = analyse('Member details.xlsx', 'Sheet1', (await load())[0].rows);
    const pt = a.rows.filter((r) => r.pkg.kind === 'pt');
    expect(pt.map((r) => r.row)).toEqual([3, 4, 8, 16]);
    expect(pt.every((r) => r.pkg.raw === '01 month pt' && r.pkg.label === '1 Month PT')).toBe(true);
    const ms = a.rows.filter((r) => r.pkg.kind === 'membership');
    expect(ms).toHaveLength(11);
    expect(new Set(ms.map((r) => r.pkg.label))).toEqual(new Set(['1 Month', '6 Months', '12 Months']));
    expect(a.rows.some((r) => r.pkg.kind === 'unknown')).toBe(false);
    // The green highlight on PT rows is kept as evidence, not interpreted
    expect(pt.every((r) => r.highlight === '92D050')).toBe(true);
  });

  test('E/F · members are matched by phone: 13 people, two with more than one record', async () => {
    const a = analyse('Member details.xlsx', 'Sheet1', (await load())[0].rows);
    const phones = new Map<string, number>();
    a.rows.forEach((r) => phones.set(r.phoneKey, (phones.get(r.phoneKey) ?? 0) + 1));
    expect(phones.size).toBe(13);
    expect([...phones.entries()].filter(([, n]) => n > 1).map(([k]) => k).sort()).toEqual(['7038617597', '9881715183']);
    expect(a.rows.every((r) => r.blockers.length === 0)).toBe(true);           // every row has a usable name and phone
  });

  test('J · “bal” is evidence, never debt', async () => {
    const a = analyse('Member details.xlsx', 'Sheet1', (await load())[0].rows);
    const by = (row: number) => a.rows.find((r) => r.row === row)!;
    expect(by(5).balance).toEqual({ kind: 'settled', amountPaise: null, note: 'bal paid' });
    expect(by(7).balance.kind).toBe('settled');                                   // "nill"
    expect(by(8).balance).toEqual({ kind: 'amount', amountPaise: 900000, note: '9000' });
    expect(by(8).review).toEqual([]);                                             // a number is kept as legacy info, not a question
    expect(by(8).warnings.join()).toMatch(/unconfirmed old balance, never a due/);
    expect(by(16).balance).toEqual({ kind: 'sessions', amountPaise: null, note: '24 session' });
    expect(by(16).review).toEqual([]);                                            // kept as a note only
    // Nothing in this sheet needs a person; three blue rows carry a "paid after start" warning
    expect(a.rows.filter((r) => r.review.length).map((r) => r.row)).toEqual([]);
    expect(a.rows.filter((r) => r.warnings.some((w) => /days after the start date/.test(w))).map((r) => r.row)).toEqual([5, 7, 12]);
    expect(by(15).srNo).toBeNull();
    expect(by(15).warnings.join()).toMatch(/No Sr No/);
  });

  test('G/H/I · the plan: history stays history, PT stays PT, review rows wait', async () => {
    const a = analyse('Member details.xlsx', 'Sheet1', (await load())[0].rows);
    const plans = [{ id: 'p1', duration: '1 Month' }, { id: 'p12', duration: '12 Months' }];
    const p = planImport(a, new Map(), new Set(), plans);
    expect(p).toMatchObject({ membersToCreate: 13, membersMatched: 0, memberships: 11, ptPackages: 4, payments: 15, skipped: [], needsReview: [] });
    // Every membership in this sheet ended in 2022–2023: nobody comes out active
    expect(p.members.every((m) => !m.membershipEnd || m.membershipEnd < '2024-01-01')).toBe(true);
    // PT-only people get no gym membership dates
    expect(p.members.find((m) => m.phoneKey === '9545550048')).toMatchObject({ membershipStart: null, membershipEnd: null, planId: null });
    // A plan is linked only where today's website has one of the same length (6 months: none)
    expect(p.members.find((m) => m.phoneKey === '7038617597')).toMatchObject({ planId: null, membershipEnd: '2023-03-06' });
    expect(p.members.find((m) => m.phoneKey === '9004095185')?.planId).toBe('p12');
  });

  test('K/L · idempotent: rows already imported are recognised, not planned again', async () => {
    const a = analyse('Member details.xlsx', 'Sheet1', (await load())[0].rows);
    expect(new Set(a.rows.map((r) => r.key)).size).toBe(15);                     // every row has its own key
    const all = new Set(a.rows.map((r) => r.fingerprint));
    const again = planImport(a, new Map(), all, []);
    expect(again).toMatchObject({ payments: 0, membersToCreate: 0 });
    expect(again.alreadyImported).toHaveLength(15);
    // The payment key names the source (file + sheet + row); the fingerprint doesn't, so a renamed
    // or re-ordered copy is still recognised as already imported
    const moved = analyse('renamed copy.xlsx', 'Sheet1', [(await load())[0].rows[0], ...(await load())[0].rows.slice(1).reverse()]);
    expect(moved.rows.some((r) => all.has(r.key))).toBe(false);
    expect(new Set(moved.rows.map((r) => r.fingerprint))).toEqual(all);
    // Imports made before the fingerprint existed stored it as their key — still recognised
    expect(a.rows[0].fingerprint).toBe('lx_9881715183_2022-09-01_membership_1_2022-09-02_2022-10-02_200000');
  });
});

test('F · phone numbers normalise the same way whatever the format', () => {
  for (const v of ['9881715183', '+91 98817 15183', '+919881715183', '098817-15183', '91-9881715183', '(988) 171 5183']) expect(phoneKey(v)).toBe('9881715183');
  expect(toPhone(cell(9881715183))).toBe('9881715183');
});

test('C · package wording: conservative classification', () => {
  expect(classifyPackage('01 month pt')).toMatchObject({ kind: 'pt', months: 1 });
  expect(classifyPackage('3 Months PT')).toMatchObject({ kind: 'pt', months: 3 });
  expect(classifyPackage('personal training 1 month')).toMatchObject({ kind: 'pt', months: 1 });
  expect(classifyPackage('01 month ')).toMatchObject({ kind: 'membership', months: 1, label: '1 Month' });
  expect(classifyPackage('12 month')).toMatchObject({ kind: 'membership', months: 12 });
  expect(classifyPackage('Annual')).toMatchObject({ kind: 'membership', months: 12 });
  for (const v of ['pt', 'gym + pt 3 month', 'couple 3 month', 'zumba', '', '3 month trial']) expect(classifyPackage(v).kind, v).toBe('unknown');
});

test('J · balance wording', () => {
  expect(classifyBalance(cell(null)).kind).toBe('none');
  expect(classifyBalance(cell('nill')).kind).toBe('settled');
  expect(classifyBalance(cell('NIL')).kind).toBe('settled');
  expect(classifyBalance(cell('bal paid')).kind).toBe('settled');
  expect(classifyBalance(cell(9000))).toMatchObject({ kind: 'amount', amountPaise: 900000 });
  expect(classifyBalance(cell('₹2,000'.replace(',', '')))).toMatchObject({ kind: 'amount', amountPaise: 200000 });
  expect(classifyBalance(cell('24 session'))).toMatchObject({ kind: 'sessions', amountPaise: null });
  expect(classifyBalance(cell('will pay next week'))).toMatchObject({ kind: 'note', amountPaise: null });
});

test('dates: Excel days, ISO, and Indian day/month order', () => {
  expect(toDate(cell(44805, true))).toBe('2022-09-01');
  expect(toDate(cell('2022-09-01'))).toBe('2022-09-01');
  expect(toDate(cell('01/09/2022'))).toBe('2022-09-01');
  expect(toDate(cell('1-9-22'))).toBe('2022-09-01');
  expect(toDate(cell('13/13/2022'))).toBe('bad');
  expect(toDate(cell('sept'))).toBe('bad');
  expect(toDate(cell(null))).toBeNull();
});

test('E · same phone, different name → review; exact repeats → review, never dropped; no phone → can’t import', () => {
  const header = ['Sr No', 'Name', 'Mob Number', 'Date of payment', 'Membership', 'Start Date', 'End Date', 'Paid', 'bal'].map((h) => cell(h));
  const row = (sr: number, name: string, phone: XlsxCell['value']) => [cell(sr), cell(name), cell(phone), cell(44805, true), cell('01 month'), cell(44806, true), cell(44836, true), cell(2000), cell(null)];
  const a = analyse('x.xlsx', 'Sheet1', [header, row(1, 'asha rao', 9000000001), row(2, 'meera iyer', 9000000001), row(3, 'asha rao', 9000000001), row(4, 'no phone', null), row(5, 'Asha  Rao ', '+91 90000 00001')]);
  expect(a.rows[1].review.join()).toMatch(/different name/);                     // phone matches, name doesn't
  expect(a.rows[2].blockers).toEqual([]);                                         // an exact repeat may be a real payment…
  expect(a.rows[2].review.join()).toMatch(/Looks the same as row 2/);             // …so a person decides
  expect(a.rows[2].fingerprint).not.toBe(a.rows[0].fingerprint);                  // and it can't collide with row 2
  expect(a.rows[4].review.join()).toMatch(/Looks the same as row 2/);             // same person, other formatting, same payment
  expect(a.rows[4].review.join()).not.toMatch(/different name/);
  const p0 = planImport(a, new Map(), new Set(), []);
  expect(p0.outcomes[3].status).toBe('blocked');
  expect(p0.outcomes[3].reasons.join()).toMatch(/No phone number, and no member with this exact name/);
  // An existing member with the same phone but another name is a conflict, never overwritten
  const p = planImport(a, new Map([['9000000001', { id: 'm1', name: 'Asha R.', phone: '9000000001', membershipEnd: '2030-01-01' } as never]]), new Set(), [], new Map([[3, 'include']]));
  expect(p.membersMatched).toBe(1);
  expect(p.members[0].conflicts).toEqual([]);                                     // "Asha R." vs "asha rao": same first name
  expect(rowKey(a.rows[0])).toBe(a.rows[0].fingerprint);
});
