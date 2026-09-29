import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc } from './emulator';

// The receptionist test: find a member, check membership, check them in, take a payment with a
// discount, hand over the receipt, then see dues, today's collection and attendance.
test.describe.configure({ mode: 'serial' });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

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
  await seedDoc('plans/p3', { duration: '3 Months', price: '₹6,500', order: 1 });
  const expired = addDays(today, -2);
  await seedDoc('members/desk1', { name: 'Kiran Patil', nameLower: 'kiran patil', phone: '9000000031', phoneKey: '9000000031', email: '', emailLower: '', planId: 'p3',
    membershipStart: '2026-01-01', membershipEnd: expired, status: 'active', activeUntil: expired, trainerId: null, trainerClient: null, notes: '', source: 'manual' });
});

test('receptionist: find → check membership → check in → payment with discount → receipt → dues → collection', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/URI malformed/.test(e.message)) errors.push(e.message); });
  await login(page);

  // Check in from the dashboard's quick action: a drawer, no class to choose
  await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Check in', exact: true }).click();
  const desk = page.getByRole('dialog', { name: 'Check in' });
  await desk.getByPlaceholder('Name or phone number').fill('Kir');
  await desk.getByRole('button', { name: /Kiran Patil/ }).click();
  await expect(desk).toContainText('membership isn’t active');                       // expired: warned, still allowed to record the visit
  await desk.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(desk.getByRole('status')).toContainText('Kiran Patil is checked in.');
  await page.keyboard.press('Escape');

  // Member profile: the essentials at a glance, and the same check-in can't happen twice
  await page.goto('/admin/members/desk1');
  await expect(page.getByText('M-DESK1').first()).toBeVisible();                       // member ID under the name
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText('Expired');
  await expect(page.getByRole('region', { name: 'Overview' })).toContainText('Not allowed');   // entry access follows the membership
  await page.getByRole('tab', { name: 'Membership', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Membership' })).toContainText('door device isn’t connected yet');
  // Common tasks open in a drawer — the profile stays where it is
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Check in' });
  await expect(drawer).toContainText('Kiran Patil');
  await drawer.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(drawer.getByRole('alert')).toContainText('already checked in today');
  await page.keyboard.press('Escape');

  // Payment with a discount — the plan's own price is untouched
  await page.goto('/admin/members/desk1');
  await page.getByRole('button', { name: 'Renew', exact: true }).click();
  const pay = page.getByRole('dialog', { name: 'Renew membership' });
  await expect(pay.getByRole('radio', { name: /Membership/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('6500');
  await page.getByLabel('Discount (₹)').fill('500');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('6000');
  await page.getByLabel('Method').selectOption('upi');
  await page.getByLabel('Reference').fill('UPI-777');
  await expect(pay).toContainText('This is a membership payment from Kiran Patil');
  await page.getByRole('button', { name: /Collect membership payment · ₹6,000/ }).click();
  await expect(pay.getByRole('status')).toContainText('₹6,000 collected');
  await pay.getByRole('link', { name: 'View receipt' }).click();
  await page.waitForURL(/\/admin\/payments\/[\w]+\?new=1$/);
  const receipt = page.getByRole('article', { name: /Receipt CR-R-0001/ });
  await expect(receipt).toContainText('Payment receipt');
  await expect(receipt).toContainText('₹6,500');
  await expect(receipt).toContainText('−₹500');
  await expect(receipt).toContainText('₹6,000');
  await expect(receipt).toContainText('UPI-777');
  await expect(receipt).toContainText('Paid');
  await expect(receipt).toContainText('not a tax invoice');
  const share = page.getByRole('link', { name: 'Share on WhatsApp' });
  await expect(share).toHaveAttribute('href', /wa\.me\/919000000031\?text=.*CR-R-0001/);
  await expect(page.getByText('For the PDF, choose “Print / save PDF”')).toBeVisible();

  // Dues: estimates are labelled as estimates; today's collection and the renewal split are real
  await page.goto('/admin/payments/dues');
  await expect(page.getByText('Nothing due')).toBeVisible();                       // renewed → no longer due
  await page.goto('/admin');
  const glance = page.getByRole('region', { name: 'Today at a glance' });
  await expect(glance.getByRole('link').filter({ hasText: 'Today’s collection' })).toContainText('₹6,000');
  await expect(glance.getByRole('link').filter({ hasText: 'Check-ins today' })).toContainText('1');
  if (!isMobile) {
    await page.goto('/admin/revenue');
    await expect(page.getByRole('region', { name: 'New vs renewal' })).toContainText('Renewal');
  }
  expect(errors).toEqual([]);
});
