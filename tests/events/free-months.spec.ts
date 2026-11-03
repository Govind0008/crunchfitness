import { test, expect, type Page } from '@playwright/test';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin, seedDoc } from './emulator';

// "12 months + 2 free": free months are decided per sale, so they're typed in next to the plan —
// on the add-member form and when collecting a membership payment. The end date moves on by them,
// the receipt says so, and the membership record keeps them apart from the plan.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'data story runs once');

const docs = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p12', { duration: '12 Months', price: '₹15,000', order: 1 });
  await seedDoc('plans/p1d', { duration: '1 Day', price: '₹300', order: 2 });
});

test('add member: 12 + 2 sets the expiry; staff can still change the date', async ({ page }) => {
  await login(page);
  await page.goto('/admin/members');
  await page.getByRole('button', { name: /Add member/ }).first().click();
  const form = page.getByRole('form', { name: 'New member' });
  await form.getByLabel('Full name').fill('Karishma Test');
  await form.getByLabel('Mobile number').fill('9000000881');
  await expect(form.getByLabel('Free months', { exact: true })).toBeDisabled();                     // nothing to add to without a plan
  await form.getByLabel('Starts').fill('2026-10-27');
  await form.getByLabel('Plan', { exact: true }).selectOption({ label: '12 Months' });
  await expect(form.getByLabel('Expires')).toHaveValue('2027-10-26');
  await form.getByLabel('Free months', { exact: true }).fill('2');
  await expect(form.getByLabel('Expires')).toHaveValue('2027-12-26');
  await expect(form).toContainText('12 Months + 2 free months');
  await form.getByLabel('Starts').fill('2026-11-01');                              // a later start moves the end with it
  await expect(form.getByLabel('Expires')).toHaveValue('2027-12-31');
  await form.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('status')).toContainText('Membership until 31/12/2027');
});

test('collect payment: 12 + 2 on the receipt and the membership record', async ({ page }) => {
  await login(page);
  const r = await fetch(`${docs}/members?pageSize=10`, { headers: { Authorization: 'Bearer owner' } });
  const id = ((await r.json()) as { documents: { name: string }[] }).documents[0].name.split('/').pop();
  await page.goto(`/admin/payments/new?member=${id}`);
  await page.getByLabel('Plan', { exact: true }).selectOption({ label: '12 Months · ₹15,000' });
  await page.getByLabel('Covers from').fill('2028-01-01');
  await page.getByLabel('Free months', { exact: true }).fill('2');
  await expect(page.getByLabel('Covers until')).toHaveValue('2029-02-28');
  await page.getByLabel('Amount received (₹)').fill('15000');
  await page.getByRole('button', { name: /Collect membership payment · ₹15,000/ }).click();
  await expect(page.getByRole('article', { name: /Receipt/ })).toContainText('12 Months + 2 free months membership');
  const ms = await fetch(`${docs}/memberships?pageSize=10`, { headers: { Authorization: 'Bearer owner' } });
  const rec = ((await ms.json()) as { documents: { fields: Record<string, { stringValue?: string; integerValue?: string }> }[] }).documents[0].fields;
  expect(rec).toMatchObject({ planLabel: { stringValue: '12 Months + 2 free months' }, packageType: { stringValue: 'bonus' }, bonusMonths: { integerValue: '2' }, endDate: { stringValue: '2029-02-28' } });
});
