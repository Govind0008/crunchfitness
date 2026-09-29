import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { ADMIN, resetFirestore, seedAdmin, seedDoc } from './emulator';

// The real old member sheet, imported through the admin — into the EMULATOR only.
// Needs tests/fixtures/member-details.xlsx (git-ignored: real names and numbers).
const FIXTURE = process.env.LEGACY_XLSX ?? 'tests/fixtures/member-details.xlsx';
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'migration story runs once');
test.skip(!existsSync(FIXTURE), `real sheet not found at ${FIXTURE}`);


async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
async function openImporter(page: Page) {
  await page.goto('/admin/members/import');
  await page.getByRole('tab', { name: 'From the old member sheet' }).click();
  await page.getByLabel('Old member sheet').setInputFiles(FIXTURE);
}
const count = (page: Page, region: string, label: string) =>
  page.getByRole('region', { name: region }).locator('div').filter({ has: page.getByText(label, { exact: true }) }).locator('p').first();

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('plans/p12', { duration: '12 Months', price: '₹12,000', order: 2 });
  await seedDoc('teamMembers/test', { name: 'test', role: 'Coach', order: 1, visible: true });
  // An existing member with the same phone as a sheet row — must be matched, never overwritten
  await seedDoc('members/existing1', { name: 'Ankit Naik', nameLower: 'ankit naik', phone: '+91 70386 17597', phoneKey: '7038617597', email: '', emailLower: '', planId: 'p12',
    membershipStart: '2026-01-01', membershipEnd: '2030-01-01', status: 'active', activeUntil: '2030-01-01', trainerId: null, trainerClient: null, notes: 'Front desk note', source: 'manual' });
});

test('preview → review → import → re-import changes nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/URI malformed/.test(e.message)) errors.push(e.message); });
  await login(page);
  await openImporter(page);
  await expect(page.getByText('Sheet “Sheet1” · 15 rows · 9 columns')).toBeVisible();
  // What was found, in plain words
  const found = page.getByLabel('What was found');
  await expect(found).toContainText('13members found');
  await expect(found).toContainText('11membership records');
  await expect(found).toContainText('4PT records found');
  await expect(found).toContainText('1need review');
  await expect(page.getByRole('row', { name: /ankit naik/ }).first()).toContainText('already a member (Ankit Naik)');
  // Preview: nothing flagged goes in until someone ticks it
  const preview = page.getByLabel('Import preview');
  await expect(preview).toContainText('11new members');
  await expect(preview).toContainText('1existing members');
  await expect(preview).toContainText('14payments');
  await expect(preview).toContainText('1waiting for review');
  await page.getByLabel('Include row 8').check();
  await expect(preview).toContainText('12new members');
  await expect(preview).toContainText('15payments');
  await expect(preview).toContainText('4PT records');
  await page.getByRole('button', { name: 'Import 12 new members · 15 payments' }).click();

  const done = page.getByRole('status', { name: 'Import complete' });
  await expect(done).toContainText('12members added');
  await expect(done).toContainText('1existing members matched');
  await expect(done).toContainText('11membership records');
  await expect(done).toContainText('4PT records');
  await expect(done).toContainText('15payments');
  await expect(page.getByRole('list', { name: 'Import history' })).toContainText(basename(FIXTURE));

  // The same file again: every row is recognised, nothing can be added twice
  await page.getByLabel('Old member sheet').setInputFiles(FIXTURE);
  await expect(page.getByLabel('Import preview')).toContainText('15already imported');
  await expect(page.getByRole('button', { name: 'Nothing new to import' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('history stays history: nobody imported is active, nothing becomes a due', async ({ page }) => {
  await login(page);
  // Dashboard: no "expired and due for renewal" from 2022–23 records
  await expect(page.getByRole('region', { name: 'Needs attention' })).not.toContainText('due for renewal');
  await page.goto('/admin/payments/dues');
  await expect(page.getByText('Nothing due')).toBeVisible();
  // Members: the 12 imported people are counted, none active (only the existing member is)
  await page.goto('/admin/members?filter=active');
  await expect(page.getByRole('main')).toContainText('Ankit Naik');
  await expect(page.getByRole('main')).not.toContainText('pravin katare');
});

test('member profile separates membership, PT and payments; existing data untouched', async ({ page }) => {
  await login(page);
  await page.goto('/admin/members/existing1');
  const summary = page.locator('dl[aria-label="Member summary"]');
  await expect(summary).toContainText('1 Jan 2030');                                // the member's own expiry is not replaced
  await expect(summary).toContainText('No active package');
  await page.getByRole('tab', { name: 'Membership', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Membership history' })).toContainText('6 Months');
  await expect(page.getByRole('list', { name: 'Membership history' })).toContainText('Ended');
  await page.getByRole('tab', { name: 'PT', exact: true }).click();
  const ptHistory = page.getByRole('list', { name: 'PT packages' });
  await expect(ptHistory).toContainText('1 Month PT');
  await expect(ptHistory).toContainText('Trainer not recorded');
  await expect(ptHistory).toContainText('24 session');
  await page.getByRole('tab', { name: 'Payments', exact: true }).click();
  const pay = page.getByRole('region', { name: 'Payments' });
  await pay.getByRole('button', { name: 'PT' }).click();
  await expect(pay.getByRole('list', { name: 'Payment history' }).getByRole('listitem')).toHaveCount(1);
  await expect(pay).toContainText('₹15,000');
  await pay.getByRole('button', { name: 'Membership' }).click();
  await expect(pay).toContainText('₹8,000');

  // A PT-only person: added as inactive, PT history kept, no gym entry
  await page.goto('/admin/members/lx_9545550048');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('vishal varuka');
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText('Inactive');
  await expect(page.getByRole('region', { name: 'Overview' })).toContainText('Not allowed');
  await page.getByRole('tab', { name: 'PT', exact: true }).click();
  await expect(page.getByRole('list', { name: 'PT packages' })).toContainText('1 Month PT');

  // The unconfirmed "bal 9000" on the reviewed row is a note, never a due
  await page.goto('/admin/members/lx_9511611353');
  await page.getByRole('tab', { name: 'PT', exact: true }).click();
  await expect(page.getByRole('list', { name: 'PT packages' })).toContainText('not confirmed — not shown as due');
});

test('imported payments are records, not receipts; revenue splits membership / PT / other', async ({ page }) => {
  await login(page);
  await page.goto('/admin/payments?range=custom&from=2022-08-01&to=2022-09-30');
  await expect(page.getByText('₹89,000 received · 15 payments')).toBeVisible();
  await page.getByLabel('For').selectOption('pt');
  await expect(page.getByText('₹34,000 received · 4 payments')).toBeVisible();
  await page.getByRole('link', { name: 'Imported' }).first().click();
  const record = page.getByRole('article', { name: 'Imported payment record' });
  await expect(record).toContainText('Payment record');
  await expect(record).toContainText('Personal training');
  await expect(record).toContainText('Not recorded');                                // method never invented
  await expect(record).toContainText('Imported from the old member sheet');
  await expect(page.getByRole('link', { name: 'Share on WhatsApp' })).toHaveCount(0);

  // A new PT payment today: its own receipt, PT on the receipt, and in the PT column
  await page.goto('/admin/payments/new?member=lx_9545550048&type=pt');
  await expect(page.getByRole('radio', { name: 'Personal training' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('');              // no membership price suggested for PT
  await page.getByLabel('Package name').fill('1 Month PT');
  await expect(page.getByLabel('PT starts')).not.toHaveValue('');                    // starts today by default
  await expect(page.getByLabel('PT ends')).not.toHaveValue('');                      // one month, from the package name
  await page.getByLabel('Trainer', { exact: true }).selectOption({ label: 'test' });
  await page.getByLabel('Amount received (₹)').fill('7000');
  await page.getByLabel('Reference').fill('UPI-PT-1');
  await page.getByRole('button', { name: /Collect PT payment · ₹7,000/ }).click();
  await page.waitForURL(/\/admin\/payments\/[\w]+\?new=1$/);
  const receipt = page.getByRole('article', { name: /Receipt CR-R-0001/ });
  await expect(receipt).toContainText('Personal training — 1 Month PT');
  await page.goto('/admin/revenue');
  const split = page.getByRole('table', { name: 'Revenue by type' });
  await expect(split.getByRole('row', { name: /This month/ })).toContainText('₹7,000');
  await expect(page.getByRole('region', { name: 'New vs renewal' })).not.toContainText('Renewal');   // PT isn't a renewal
  await page.goto('/admin');
  await expect(page.getByRole('region', { name: 'Today at a glance' })).toContainText('PT ₹7,000');
  // PT doesn't give gym entry, and didn't touch the membership
  await page.goto('/admin/members/lx_9545550048');
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText('Active · test');
  await page.getByRole('tab', { name: 'Membership', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Membership' })).toContainText('Personal training alone doesn’t give gym entry');
});
