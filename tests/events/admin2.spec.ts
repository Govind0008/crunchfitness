import { test, expect, type Page, type Browser } from '@playwright/test';
import { ADMIN, ensureUser, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Admin 2.0 end to end, against the emulators (never production).
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'the admin story runs on desktop; the sweep covers phone widths');

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const IGNORE = [/URI malformed/, /maps\.googleapis/, /Failed to load resource/];
const errors: string[] = [];
const watch = (p: Page) => {
  p.on('pageerror', (e) => { if (!IGNORE.some((r) => r.test(e.message))) errors.push(e.message); });
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push(m.text()); });
};
async function signIn(browser: Browser, email = ADMIN.email, password = ADMIN.password, width = 1440) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  watch(page);
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/?$/);
  return page;
}
const metric = (p: Page, label: string) => p.getByRole('region', { name: 'Today at a glance' }).getByRole('link').filter({ has: p.getByText(label, { exact: true }) });

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('trainer@crunch.test')}`, { role: 'trainer', trainerId: 'T1', name: 'Coach One' });
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('plans/p3', { duration: '3 Months', price: '₹6,500', order: 2 });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Strength coach' });
  await seedDoc('trainerData/T1/clients/C1', { name: 'Client One', phone: '+91 90000 00009', email: '', goal: 'Strength', trainerId: 'T1' });
  await seedDoc('classSessions/s1', { title: 'Strength Class', trainerId: 'T1', trainerName: 'Coach One', area: 'Main floor', date: today, startTime: '18:00', duration: 60, capacity: 20, pin: '4321', pinValidFrom: `${today}T00:00`, pinValidTo: `${today}T23:59` });
  await seedDoc('enquiries/e1', { name: 'New Lead Person', phone: '9000000077', email: '', plan: '3 Months', message: 'Interested', status: 'new', read: false, submittedAt: ts(new Date().toISOString()) });
});

test('dashboard shows real zeros and real alerts — nothing invented', async ({ browser }) => {
  const page = await signIn(browser);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
  await expect(metric(page, 'Today’s collection')).toContainText('₹0');
  await expect(metric(page, 'Today’s collection')).toContainText('No payments yet today');
  await expect(metric(page, 'Active members')).toContainText('No members added yet');
  await expect(metric(page, 'Check-ins today')).toContainText('1 class today');
  // The four front-desk jobs are one click away
  for (const a of ['Add member', 'Record payment', 'Check in', 'View dues']) await expect(page.getByRole('region', { name: 'Quick actions' }).getByRole('link', { name: a, exact: true })).toBeVisible();
  const attention = page.getByRole('region', { name: 'Needs attention' });
  await expect(attention).toContainText('1 new enquiry waiting for a reply');
  await expect(attention).toContainText('No members in the system yet');
  await expect(attention).toContainText('No trainer duty roster set for this week');
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
});

test('add a member; the same phone number cannot be added twice', async ({ browser }) => {
  const page = await signIn(browser);
  await page.getByRole('link', { name: 'Add member' }).first().click();
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Mobile number').fill('+91 90000 00001');
  await page.getByLabel('Start date').fill('2026-09-01');
  await page.getByLabel('Membership plan').selectOption({ label: '3 Months' });
  await expect(page.getByLabel('Expiry date')).toHaveValue('2026-11-30');           // suggested from the plan's own duration
  await page.getByLabel('Expiry date').fill('2099-12-31');
  await page.getByLabel('Trainer', { exact: true }).selectOption({ label: 'Coach One' });
  await page.getByRole('button', { name: 'Add member' }).click();
  await page.waitForURL(/\/admin\/members\/[\w]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asha Rao');
  const membership = page.getByRole('region', { name: 'Membership' });
  await expect(membership).toContainText('3 Months');
  await expect(membership).toContainText('Active');
  await expect(page.getByRole('region', { name: 'Trainer' })).toContainText('Coach One');

  await page.goto('/admin/members/new');
  await page.getByLabel('Full name').fill('Asha Again');
  await page.getByLabel('Mobile number').fill('9000000001');
  await page.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('alert')).toContainText('Asha Rao already has this phone number');
});

test('members list: counts, filters and search by name or phone', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/members');
  const filters = page.getByRole('group', { name: 'Filter members' });
  await expect(filters.getByRole('button', { name: /Total members/ })).toContainText('1');
  await expect(filters.getByRole('button', { name: /Active/ })).toContainText('1');
  await page.getByPlaceholder('Search by name, phone, email or member ID').fill('ash');
  await expect(page.getByText('1 match for “ash”')).toBeVisible();
  await page.getByPlaceholder('Search by name, phone, email or member ID').fill('90000');
  await expect(page.getByRole('link', { name: 'Asha Rao' }).first()).toBeVisible();
  await page.getByPlaceholder('Search by name, phone, email or member ID').fill('zzz');
  await expect(page.getByText('No matches')).toBeVisible();
});

test('CSV import: preview, duplicates, validation, explicit confirm', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/members/import');
  const csv = [
    'Name,Mobile,Email,Plan,Start,Expiry,Status',
    'Ravi Kumar,9000000002,ravi@example.com,1 Month,01/09/2026,30/09/2099,active',
    'Asha Duplicate,+91 90000 00001,,,,,',                 // already a member
    'Ravi Twice,9000000002,,,,,',                         // repeated in the file
    ',9000000003,,,,,',                                   // missing name
  ].join('\n');
  await page.getByLabel('Choose CSV file').setInputFiles({ name: 'members.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('4 rows found in members.csv')).toBeVisible();
  const summary = page.getByRole('list', { name: 'Import summary' });
  await expect(summary).toContainText('1 ready');
  await expect(summary).toContainText('1 already members');
  await expect(summary).toContainText('1 repeated in file');
  await expect(summary).toContainText('1 missing information');
  await page.getByRole('button', { name: 'Import 1 member' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 member');
  await page.goto('/admin/members');
  await expect(page.getByRole('group', { name: 'Filter members' }).getByRole('button', { name: /Total members/ })).toContainText('2');
  await expect(page.getByRole('link', { name: 'Ravi Kumar' }).first()).toBeVisible();
});

test('bring in trainer clients: added as members and linked to their training data', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/members/import');
  await page.getByRole('tab', { name: 'From trainer clients' }).click();
  await page.getByRole('button', { name: 'Find trainer clients' }).click();
  await expect(page.getByText(/1 client records · 1 to add · 0 to link/)).toBeVisible();
  await page.getByRole('button', { name: 'Add 1 · link 0' }).click();
  await expect(page.getByRole('status')).toContainText('Added 1 member');
  await page.goto('/admin/members');
  await page.getByRole('link', { name: 'Client One' }).first().click();
  await expect(page.getByRole('region', { name: 'Training' })).toContainText('Strength');
  await expect(page.getByRole('region', { name: 'Trainer' })).toContainText('Linked to the trainer portal');
});

test('self check-in at /checkin: works once, duplicate is refused, admin sees it', async ({ browser }) => {
  const kiosk = await browser.newPage();
  watch(kiosk);
  const checkIn = async () => {
    await kiosk.goto('/checkin');
    await kiosk.getByLabel('Class PIN').fill('4321');
    await kiosk.getByRole('button', { name: /Verify PIN/ }).click();
    await kiosk.getByLabel('Your Name').fill('Asha Rao');
    await kiosk.getByLabel('Phone Number').fill('90000 00001');
    await kiosk.getByRole('button', { name: /Mark Attendance/ }).click();
  };
  await checkIn();
  await expect(kiosk.getByRole('heading', { name: 'You’re Checked In!'.replace('’', "'") })).toBeVisible();
  await checkIn();
  await expect(kiosk.getByRole('heading', { name: 'Already Checked In' })).toBeVisible();

  const page = await signIn(browser);
  await expect(metric(page, 'Check-ins today')).toContainText('1');
  await page.goto('/admin/attendance');
  await expect(page.getByText('Asha Rao').first()).toBeVisible();
  await page.getByRole('button', { name: /Strength Class/ }).click();
  await expect(page.getByRole('list', { name: 'Strength Class attendees' })).toContainText('Asha Rao');
  // The member profile finds the check-in by phone, even though it was typed differently
  await page.goto('/admin/members');
  await page.getByRole('link', { name: 'Asha Rao' }).first().click();
  const att = page.getByRole('region', { name: 'Attendance' });
  await expect(att).toContainText('Total check-ins: 1');
  await expect(att.getByRole('list', { name: 'Recent check-ins' })).toContainText('Strength Class');
});

test('enquiries: pipeline status and notes', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/dashboard?tab=enquiries');
  await page.getByLabel('Status for New Lead Person').selectOption('follow_up');
  await page.getByRole('button', { name: /Follow-up \(1\)/ }).click();
  await expect(page.getByText('New Lead Person', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Open message and notes' }).click();
  await page.getByPlaceholder(/Called on Monday/).fill('Visiting Saturday for a tour');
  await page.getByPlaceholder(/Called on Monday/).blur();
  await page.reload();
  await expect(page.getByText('Note: Visiting Saturday for a tour')).toBeVisible();
});

test('activity log records admin actions, append-only', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/activity');
  const log = page.getByRole('list', { name: 'Activity log' });
  for (const a of ['Member created', 'Members imported (CSV)', 'Members added from trainer clients', 'Enquiry status changed']) await expect(log).toContainText(a);
  await expect(log).toContainText(ADMIN.email);
});

test('global search finds members, trainers and enquiries', async ({ browser }) => {
  const page = await signIn(browser);
  const box = page.getByRole('combobox', { name: /Search members, trainers/ });
  await box.fill('coach');
  await expect(page.getByRole('listbox')).toContainText('Coach One');
  await box.fill('new lead');
  await expect(page.getByRole('listbox')).toContainText('New Lead Person');
  await box.fill('ravi');
  await page.getByRole('option').filter({ hasText: 'Ravi Kumar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ravi Kumar');
});

test('trainers page connects people, classes and roster', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/trainers');
  const card = page.getByRole('listitem').filter({ hasText: 'Coach One' });
  await expect(card).toContainText('Portal login');
  await expect(card).toContainText('18:00 Strength Class');
  await expect(card).toContainText(/2\s*Members/);   // Asha (assigned) + Client One (linked)
});

test('a trainer account cannot open the admin', async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill('trainer@crunch.test');
  await page.getByLabel('Password', { exact: true }).fill('crunch-test-pass');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.goto('/admin/members');
  await expect(page.getByRole('heading', { name: /can’t use the admin yet/i })).toBeVisible();
  await expect(page.getByText('Asha Rao')).toHaveCount(0);
});

test('responsive sweep of the new admin screens', async ({ browser }) => {
  test.setTimeout(300_000);
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    const page = await signIn(browser, ADMIN.email, ADMIN.password, width);
    for (const route of ['/admin', '/admin/members', '/admin/members/new', '/admin/members/import', '/admin/attendance', '/admin/trainers', '/admin/activity', '/admin/settings']) {
      await page.goto(route);
      await expect(page.locator('h1').first(), `${route} @ ${width}`).toBeVisible();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${route} @ ${width}px overflows`).toBeLessThanOrEqual(0);
    }
    await page.close();
  }
});

test('no console errors across the admin story', () => { expect(errors).toEqual([]); });
