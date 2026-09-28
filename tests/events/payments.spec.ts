import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Payments data is right: suggestions, receipt numbers, member renewal, revenue totals, voids, reports.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'data story runs once');

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('plans/p3', { duration: '3 Months', price: '₹6,500', order: 2 });
  const expired = addDays(today, -5);
  await seedDoc('members/a', { name: 'Asha Rao', nameLower: 'asha rao', phone: '9000000001', phoneKey: '9000000001', email: '', emailLower: '', planId: 'p3',
    membershipStart: '2026-01-01', membershipEnd: expired, status: 'active', activeUntil: expired, trainerId: null, trainerClient: null, notes: '', source: 'manual' });
  await seedDoc('members/b', { name: 'Bina Shah', nameLower: 'bina shah', phone: '9000000002', phoneKey: '9000000002', email: '', emailLower: '', planId: 'p1',
    membershipStart: '2026-01-01', membershipEnd: addDays(today, 3), status: 'active', activeUntil: addDays(today, 3), trainerId: null, trainerClient: null, notes: '', source: 'manual' });
});

test('dues come from real expiry dates, priced at the current plan price', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('region', { name: 'Needs attention' })).toContainText('1 membership has expired and is due for renewal');
  await page.goto('/admin/payments/dues');
  const overdue = page.getByRole('region', { name: /Overdue · 1/ });
  await expect(overdue).toContainText('Asha Rao');
  await expect(overdue).toContainText('5 days overdue');
  await expect(overdue).toContainText('₹6,500');
  await expect(page.getByRole('region', { name: /Due in the next 14 days · 1/ })).toContainText('Bina Shah');
});

test('recording a payment: suggestion, receipt, renewal — all in one save', async ({ page }) => {
  await login(page);
  await page.goto('/admin/payments/new?member=a');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('6500');                  // plan price suggestion
  await expect(page.getByLabel('Covers from')).toHaveValue(today);                           // expired → from today
  await expect(page.getByLabel('Covers until')).not.toHaveValue('');
  const until = await page.getByLabel('Covers until').inputValue();
  await page.getByLabel('Amount received (₹)').fill('6000');                                 // they actually paid less
  await page.getByLabel('Reference').fill('UPI-12345');
  await page.getByRole('button', { name: /Save payment · ₹6,000/ }).click();
  const receipt = page.getByRole('article', { name: /Receipt CR-R-0001/ });
  await expect(receipt).toContainText('Asha Rao');
  await expect(receipt).toContainText('₹6,000');
  await expect(receipt).toContainText('Six thousand rupees only');
  await expect(receipt).toContainText('3 Months membership');
  await expect(receipt).toContainText('UPI-12345');
  // Membership moved to the paid period; Asha is no longer due
  await page.getByRole('link', { name: 'Asha Rao' }).click();
  await expect(page.getByRole('region', { name: 'Membership' })).toContainText(new Date(`${until}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
  await expect(page.getByRole('list', { name: 'Payment history' })).toContainText('CR-R-0001');
  await page.goto('/admin/payments/dues');
  await expect(page.getByRole('region', { name: /Overdue/ })).not.toContainText('Asha Rao');
  // Validation speaks plainly and nothing is saved
  await page.goto('/admin/payments/new?member=b');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('3000');
  await page.getByLabel('Amount received (₹)').fill('');
  await page.getByRole('button', { name: /Save payment/ }).click();
  await expect(page.getByRole('alert')).toContainText('Enter the amount received.');
});

test('second payment gets the next receipt number; revenue sums; a void stops counting', async ({ page }) => {
  await login(page);
  await page.goto('/admin/payments/new?member=b');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('3000');                  // wait for the suggestion, as a person would
  await page.getByLabel('Amount received (₹)').fill('3000');
  await page.getByLabel('Method').selectOption('cash');
  await page.getByRole('button', { name: /Save payment/ }).click();
  await expect(page.getByRole('article', { name: /Receipt CR-R-0002/ })).toBeVisible();
  await page.goto('/admin/payments/new?member=b');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('3000');
  await page.getByLabel('Amount received (₹)').fill('10');
  await expect(page.getByRole('button', { name: 'Save payment · ₹10' })).toBeVisible();      // the button confirms the exact amount
  await page.getByLabel('Extend membership', { exact: false }).uncheck();
  await page.getByRole('button', { name: /Save payment/ }).click();
  await expect(page.getByRole('article', { name: /Receipt CR-R-0003/ })).toBeVisible();

  await page.goto('/admin/revenue');
  const totals = page.getByRole('region', { name: 'Revenue totals' });
  await expect(totals).toContainText('₹9,010');                                              // 6000 + 3000 + 10 today
  // Void the ₹10 entry
  await page.goto('/admin/payments');
  await page.getByRole('link', { name: 'CR-R-0003' }).click();
  await page.getByRole('button', { name: 'Void payment' }).click();
  await page.getByPlaceholder('e.g. Entered twice').fill('Entered by mistake');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Void payment' }).click();
  await expect(page.getByRole('article', { name: /Receipt CR-R-0003/ })).toContainText('This receipt is not valid');
  await page.goto('/admin/revenue');
  await expect(page.getByRole('region', { name: 'Revenue totals' })).toContainText('₹9,000');
  await expect(page.getByRole('region', { name: 'This month by method' })).toContainText('UPI');
  await expect(page.getByRole('region', { name: 'This month by method' })).toContainText('Cash');
  // Payments list totals exclude the void and say so
  await page.goto('/admin/payments');
  await expect(page.getByText(/₹9,000\s*received · 2 payments · 1 void \(not counted\)/)).toBeVisible();
});

test('reports: payments CSV has every payment, void marked', async ({ page }) => {
  await login(page);
  await page.goto('/admin/reports');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download payments' }).click()]);
  const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
  expect(text).toContain('Receipt,Date,Member');
  expect(text).toContain('CR-R-0001');
  expect(text).toMatch(/CR-R-0003.*,void,Entered by mistake/);
  await expect(page.getByRole('status')).toContainText('Downloaded 3 payments (2 paid, 1 void).');
});

test('global search finds a payment by receipt number', async ({ page }) => {
  await login(page);
  await page.getByRole('combobox', { name: /Search members, trainers/ }).fill('CR-R-0002');
  await page.getByRole('option').filter({ hasText: 'CR-R-0002' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('CR-R-0002');
});

test('typing before the plan price arrives is never overwritten', async ({ page }) => {
  await login(page);
  // Slow the plans read so the suggestion lands after the person has typed
  await page.route('**/google.firestore.v1.Firestore/**', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue().catch(() => {}); });
  await page.goto('/admin/payments/new?member=b');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('');                     // suggestion not here yet
  await page.getByLabel('Amount received (₹)').pressSequentially('25');
  await page.waitForTimeout(2500);
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('25');
  await expect(page.getByRole('button', { name: 'Save payment · ₹25' })).toBeVisible();
});
