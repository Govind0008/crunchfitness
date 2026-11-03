import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin } from './emulator';

// Old member sheet import: single-day passes ("1 day") are recorded as payments only — no member
// profile and no membership — even without a phone. Everything else imports as before. Made-up
// data only (a CSV written by the test). Its "Amt Paid" heading (the January–November 2025
// workbooks) is recognised as the amount.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'admin flow, runs once');

const DIR = join(process.cwd(), 'test-results', 'day-pass-import');
const CSV = join(DIR, 'TEST-MONTH-2025.csv');
const docs = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
type F = Record<string, { stringValue?: string; integerValue?: string; booleanValue?: boolean; nullValue?: null }>;
async function list(col: string): Promise<{ id: string; f: F }[]> {
  const r = await fetch(`${docs}/${col}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
  return (((await r.json()) as { documents?: { name: string; fields: F }[] }).documents ?? []).map((d) => ({ id: d.name.split('/').pop()!, f: d.fields }));
}
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
async function upload(page: Page) {
  await page.goto('/admin/members/import');
  await page.getByRole('tab', { name: 'From the old member sheet' }).click();
  await page.getByLabel('Old member sheet').setInputFiles(CSV);
  // “Amt Paid” (the Jan–Nov heading) is recognised as the amount — nothing to choose
  await expect(page.getByText('All columns recognised')).toBeVisible();
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CSV, [
    'Sr.No,Members Name,Mob Number,Date of payment,Membership,Start Date,End Date,Amt Paid,Bal Amt,Mode,comment',
    '1,Test Regular,9000000111,05-01-2025,1 month,05-01-2025,05-02-2025,1500,,cash,',
    '2,Walk In One,9000000222,06-01-2025,1 day,06-01-2025,06-01-2025,200,,upi,',
    '3,Walk In Two,,07-01-2025,1 day,07-01-2025,07-01-2025,250,,cash,came with a friend',
    '4,Short Pass,9000000333,08-01-2025,10 days,08-01-2025,18-01-2025,800,,cash,',
  ].join('\n'));
});

test('day passes are payments only; the regular row and the 10-day pass create members; re-import adds nothing', async ({ page }) => {
  await login(page);
  await upload(page);
  await expect(page.getByText('single-day passes (payment only)')).toBeVisible();
  const button = page.getByRole('button', { name: /^Import \d+ new members? · 4 payments$/ });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByText('day passes recorded (payment only)')).toBeVisible({ timeout: 20_000 });

  const payments = await list('payments');
  const dayPasses = payments.filter((p) => p.f.dayPass?.booleanValue);
  expect(dayPasses).toHaveLength(2);
  for (const p of dayPasses) {
    expect(p.f).toMatchObject({ memberId: { stringValue: '' }, paymentType: { stringValue: 'other' }, category: { stringValue: 'Day pass' }, source: { stringValue: 'legacy_excel' }, membershipId: { nullValue: null } });
    expect(p.id).toMatch(/^lx_.+_p$/);
  }
  expect(dayPasses.map((p) => p.f.memberName.stringValue).sort()).toEqual(['Walk In One', 'Walk In Two']);
  expect(dayPasses.find((p) => p.f.memberName.stringValue === 'Walk In Two')!.f.notes.stringValue).toContain('came with a friend');
  expect(payments).toHaveLength(4);

  // Members only for the regular row and the 10-day pass; nobody for the walk-ins
  const members = await list('members');
  expect(members.map((m) => m.f.name.stringValue).sort()).toEqual(['Short Pass', 'Test Regular']);
  expect(members.some((m) => m.f.phoneKey?.stringValue === '9000000222')).toBe(false);
  // Memberships: the regular one and the 10-day pass; none for day passes
  const memberships = await list('memberships');
  expect(memberships).toHaveLength(2);
  expect(memberships.every((m) => m.f.memberId.stringValue)).toBe(true);

  // Importing the same file again writes nothing new
  await upload(page);
  await expect(page.getByRole('button', { name: 'Nothing new to import' })).toBeDisabled();
  expect(await list('payments')).toHaveLength(4);

  // The payment page and the receipt show the walk-in, with no member link
  await page.goto(`/admin/payments/${dayPasses[0].id}`);
  await expect(page.getByRole('complementary', { name: 'Payment details' })).toContainText('Walk-in · day pass');
  await expect(page.getByRole('complementary', { name: 'Payment details' }).getByRole('link', { name: dayPasses[0].f.memberName.stringValue! })).toHaveCount(0);
  await expect(page.getByText('Walk-in · day pass').first()).toBeVisible();
});
