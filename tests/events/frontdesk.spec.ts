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
  await seedDoc('classSessions/desk-s1', { title: 'Morning Strength', trainerId: 'T1', trainerName: 'Coach One', area: 'Main floor', date: today, startTime: '07:00', duration: 60, capacity: 20, checkedInCount: 0, pin: '1111' });
});

test('receptionist: find → check membership → check in → payment with discount → receipt → dues → collection', async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/URI malformed/.test(e.message)) errors.push(e.message); });
  await login(page);

  // Check in from the dashboard's quick action
  await page.getByRole('region', { name: 'Quick actions' }).getByRole('link', { name: 'Check in', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/attendance\?checkin=1$/);
  const desk = page.getByRole('region', { name: 'Check in a member' });
  await desk.getByPlaceholder('Name or phone number').fill('Kir');
  await desk.getByRole('button', { name: /Kiran Patil/ }).click();
  await expect(desk.getByRole('combobox')).toHaveValue('desk-s1');                 // today's only class is chosen for you
  await desk.getByRole('button', { name: 'Check in' }).click();
  await expect(desk.getByRole('status')).toContainText('Kiran Patil is checked in to Morning Strength');

  // Member profile: the essentials at a glance, and the same check-in can't happen twice
  await page.goto('/admin/members/desk1');
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText('M-DESK1');
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText('Expired');
  await expect(page.getByRole('region', { name: 'Membership' })).toContainText('Not allowed');   // entry access follows the membership
  await expect(page.getByRole('region', { name: 'Membership' })).toContainText('door device isn’t connected yet');
  await page.getByRole('link', { name: 'Check in' }).click();
  await expect(page).toHaveURL(/member=desk1/);
  await expect(page.getByRole('region', { name: 'Check in a member' })).toContainText('Kiran Patil');
  await page.getByRole('region', { name: 'Check in a member' }).getByRole('button', { name: 'Check in' }).click();
  await expect(page.getByRole('region', { name: 'Check in a member' }).getByRole('alert')).toContainText('already checked in');

  // Payment with a discount — the plan's own price is untouched
  await page.goto('/admin/members/desk1');
  await page.getByRole('link', { name: 'Record payment' }).first().click();
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('6500');
  await page.getByLabel('Discount (₹)').fill('500');
  await expect(page.getByLabel('Amount received (₹)')).toHaveValue('6000');
  await page.getByLabel('Method').selectOption('upi');
  await page.getByLabel('Reference').fill('UPI-777');
  await page.getByRole('button', { name: /Save payment · ₹6,000/ }).click();
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
