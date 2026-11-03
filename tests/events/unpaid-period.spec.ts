import { test, expect, type Page } from '@playwright/test';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin, seedDoc } from './emulator';

// A member added with a plan and dates, the money not collected yet: collecting pays for THAT
// period (not next year), the receipt is issued at that moment, and the member isn't extended.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'data story runs once');

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const start = addDays(today, -10);
const end = addDays(today, 355);

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
async function list(collection: string) {
  const r = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${collection}`, { headers: { Authorization: 'Bearer owner' } });
  return (((await r.json()) as { documents?: { fields: Record<string, { stringValue?: string; nullValue?: null }> }[] }).documents ?? []).map((d) => d.fields);
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/y', { duration: '12 Months', price: '₹12,000', order: 1 });
  await seedDoc('plans/q', { duration: '3 Months', price: '₹4,000', order: 2 });
  // Added with a yearly plan and dates — no payment, no paid period on record
  await seedDoc('members/u', { name: 'Uday Kale', nameLower: 'uday kale', phone: '9000000031', phoneKey: '9000000031', email: '', emailLower: '', planId: 'y',
    membershipStart: start, membershipEnd: end, status: 'active', activeUntil: end, trainerId: null, trainerClient: null, notes: '', source: 'manual' });
});

test('an unpaid current period: the profile says so, and collecting pays for that period with a receipt', async ({ page }) => {
  await login(page);
  await page.goto('/admin/members/u');
  const note = page.getByText('No payment recorded for this period').first();
  await expect(note).toBeVisible();
  await page.getByRole('button', { name: 'Collect payment' }).first().click();

  // The form offers this period first, with the member's own dates and plan price
  const period = page.getByRole('radiogroup', { name: 'Period paid for' });
  await expect(period.getByRole('radio', { name: /This period — not paid yet/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Covers from')).toHaveValue(start);
  await expect(page.getByLabel('Covers until')).toHaveValue(end);
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('12000');

  // Choosing the next period moves the dates on; choosing this period brings them back
  await period.getByRole('radio', { name: /The next period — renewal/ }).click();
  await expect(page.getByLabel('Covers from')).toHaveValue(addDays(end, 1));
  await period.getByRole('radio', { name: /This period — not paid yet/ }).click();
  await expect(page.getByLabel('Covers until')).toHaveValue(end);

  await page.getByRole('button', { name: /Collect membership payment · ₹12,000/ }).click();
  await expect(page.getByText('₹12,000 collected')).toBeVisible();                            // receipt issued at this moment

  // One payment, a NEW membership, for exactly that period; the member's dates are unchanged
  const pays = await list('payments');
  expect(pays).toHaveLength(1);
  expect(pays[0]).toMatchObject({ kind: { stringValue: 'new' }, coversFrom: { stringValue: start }, coversTo: { stringValue: end }, receiptNo: { stringValue: 'CR-R-0001' } });
  const periods = await list('memberships');
  expect(periods).toHaveLength(1);
  expect(periods[0]).toMatchObject({ startDate: { stringValue: start }, endDate: { stringValue: end } });
  const [member] = (await list('members'));
  expect(member).toMatchObject({ membershipEnd: { stringValue: end } });

  // Paid now: the note is gone, and the next payment is a renewal from the day after expiry
  await page.goto('/admin/members/u');
  await expect(page.getByRole('heading', { name: 'Uday Kale' })).toBeVisible();
  await expect(page.getByText('No payment recorded for this period')).toHaveCount(0);
  await page.goto('/admin/payments/new?member=u');
  await expect(page.getByLabel('Covers from')).toHaveValue(addDays(end, 1));
  await expect(page.getByRole('radiogroup', { name: 'Period paid for' })).toHaveCount(0);
});
