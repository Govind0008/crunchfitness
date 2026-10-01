import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The admin is one SPA: internal navigation must never reload the document or remount the shell.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'desktop navigation story; mobile menu covered below');

// Expired a few days ago — inside the Dues window (older expiries are former members, not dues)
const expiredRecently = (() => { const d = new Date(Date.now() + 5.5 * 3600e3); d.setUTCDate(d.getUTCDate() - 10); return d.toISOString().slice(0, 10); })();

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await seedDoc('members/mSpa', { name: 'Money Member', nameLower: 'money member', phone: '9000000044', phoneKey: '9000000044', email: '', emailLower: '', planId: 'p1',
    membershipStart: '2026-01-01', membershipEnd: expiredRecently, status: 'active', activeUntil: expiredRecently, trainerId: null, trainerClient: null, notes: '', source: 'manual' });
  await seedDoc('enquiries/e1', { name: 'Lead', phone: '9000000077', status: 'new', read: false, submittedAt: ts(new Date().toISOString()) });
});

/** Instrument the page: count real document loads, mark the window and the shell's DOM nodes,
 *  and record if the full-screen auth guard spinner ever reappears. */
async function instrument(page: Page) {
  const loads = { n: 0 };
  page.on('load', () => loads.n++);
  await page.evaluate(() => {
    const w = window as unknown as { __spa: string; __guardFlash: number };
    w.__spa = 'alive'; w.__guardFlash = 0;
    document.querySelector('[data-admin-shell] aside')!.setAttribute('data-mark', 'shell');
    document.querySelector('[data-admin-shell] header')!.setAttribute('data-mark', 'shell');
    new MutationObserver(() => {
      // The guard's full-screen loader is a direct child of the page, outside the shell
      if (document.querySelector('.page-transition > div[role=status][aria-label=Loading]')) w.__guardFlash++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  return async (where: string) => {
    const s = await page.evaluate(() => {
      const w = window as unknown as { __spa?: string; __guardFlash?: number };
      return {
        windowKept: w.__spa === 'alive',
        sidebarKept: document.querySelector('[data-admin-shell] aside')?.getAttribute('data-mark') === 'shell',
        headerKept: document.querySelector('[data-admin-shell] header')?.getAttribute('data-mark') === 'shell',
        guardFlashes: w.__guardFlash ?? -1,
      };
    });
    expect(s, `after ${where}`).toEqual({ windowKept: true, sidebarKept: true, headerKept: true, guardFlashes: 0 });
    expect(loads.n, `document reloaded during ${where}`).toBe(0);
  };
}

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
}

test('every sidebar section opens inside the same shell, with no reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => { if (!/URI malformed/.test(e.message)) errors.push(e.message); });
  await login(page);
  const check = await instrument(page);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  const SECTIONS: [string, RegExp, RegExp | string][] = [
    ['Members', /\/admin\/members$/, 'Members'],
    ['Trainers', /\/admin\/trainers$/, 'Trainers'],
    ['Attendance', /\/admin\/attendance$/, 'Attendance'],
    ['Access', /\/admin\/access$/, 'Access control'],
    ['Events', /\/admin\/events$/, 'Events'],
    ['Payments', /\/admin\/payments$/, 'Payments'],
    ['Dues', /\/admin\/payments\/dues$/, 'Dues'],
    ['Revenue', /\/admin\/revenue$/, 'Revenue'],
    ['Reports', /\/admin\/reports$/, 'Reports'],
    ['Plans', /\/admin\/plans$/, 'Plans'],
    ['Offers', /\/admin\/offers$/, 'Offers'],
    ['Enquiries', /\/admin\/enquiries$/, 'Enquiries'],
    ['Blog', /\/admin\/blog$/, 'Blog'],
    ['Team', /\/admin\/team$/, 'Team'],
    ['Activity', /\/admin\/activity$/, 'Activity'],
    ['Settings', /\/admin\/settings$/, 'Settings'],
    ['Dashboard', /\/admin\/?$/, /Good (morning|afternoon|evening)/],
  ];
  // Match the start of the name: some items carry a live badge ("Enquiries 1")
  const item = (label: string) => nav.getByRole('link', { name: new RegExp(`^${label}(\\s+\\d+)?$`) });
  for (const [label, url, heading] of SECTIONS) {
    // Secondary pages live under "More" (it stays open once opened)
    if (!(await item(label).count())) await nav.getByRole('button', { name: 'More' }).click();
    await item(label).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(item(label)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-admin-area]')).toBeVisible();
    await check(label);
  }
  // Browser back/forward stay in-app too
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/?$/);
  await check('back/forward');
  expect(errors).toEqual([]);
});

test('in-page actions keep the shell: add member, filter, search, CSV preview, back', async ({ page }) => {
  await login(page);
  const check = await instrument(page);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await nav.getByRole('link', { name: 'Members', exact: true }).click();
  await page.getByRole('button', { name: 'Add member' }).first().click();               // a drawer, not a new page
  const add = page.getByRole('dialog', { name: 'Add member' });
  await add.getByLabel('Full name').fill('Spa Tester');
  await add.getByLabel('Mobile number').fill('9000000055');
  await add.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('dialog', { name: 'Member added' })).toContainText('Spa Tester is added');
  await page.getByRole('button', { name: 'Open profile' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spa Tester');       // saved → profile, in place
  await check('saving a member');

  await page.getByRole('link', { name: 'Members' }).first().click();                    // back link
  await page.getByRole('group', { name: 'Filter members' }).getByRole('button', { name: /Active/ }).click();
  await expect(page).toHaveURL(/filter=active/);
  await page.getByPlaceholder('Search by name, phone, email or member ID').fill('spa');
  await expect(page.getByText('1 match for “spa”')).toBeVisible();
  await check('filtering and searching');

  await page.getByRole('link', { name: 'Import' }).click();
  await page.getByLabel('Choose CSV file').setInputFiles({ name: 'm.csv', mimeType: 'text/csv', buffer: Buffer.from('name,phone\nCsv Person,9000000056\n') });
  await expect(page.getByText('1 rows found in m.csv')).toBeVisible();
  await page.getByRole('link', { name: 'Members' }).first().click();
  await expect(page).toHaveURL(/\/admin\/members$/);
  await check('CSV preview and back');

  // Global search jumps within the app
  await page.getByRole('combobox', { name: /Search members/ }).fill('spa');
  await page.getByRole('option').filter({ hasText: 'Spa Tester' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spa Tester');
  await check('global search');
});

test('mobile menu navigates in place and closes', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await login(page);
  const check = await instrument(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Attendance', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Attendance');
  await expect(page.getByRole('button', { name: 'Close menu' })).not.toBeInViewport();
  await check('mobile menu');
});

test('money workflow stays in the shell: record → receipt → print → back → filters → back/forward', async ({ page }) => {
  await login(page);
  await page.evaluate(() => { (window as unknown as { __printed: number }).__printed = 0; window.print = () => { (window as unknown as { __printed: number }).__printed++; }; });
  const check = await instrument(page);
  const nav = page.getByRole('navigation', { name: 'Admin' });

  await nav.getByRole('link', { name: 'Dues', exact: true }).click();
  await expect(page.getByText('Money Member').first()).toBeVisible();
  await page.getByRole('link', { name: 'Record payment' }).first().click();                     // from dues, member prefilled
  await expect(page.getByText('Money Member').first()).toBeVisible();
  await check('opening record payment');

  await page.getByLabel('Amount received (₹)').fill('3000');
  await page.getByLabel('Method').selectOption('cash');
  await page.getByRole('button', { name: /Collect (membership|PT|other) payment/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Payment saved' })).toBeVisible();
  await expect(page.getByRole('article', { name: /Receipt CR-R-0001/ })).toContainText('Three thousand rupees only');
  await check('saving a payment');

  await page.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await check('printing a receipt');

  await page.getByRole('link', { name: 'Back to payments' }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(page.getByRole('link', { name: 'CR-R-0001' })).toBeVisible();
  await page.getByLabel('Method').selectOption('upi');
  await expect(page).toHaveURL(/method=upi/);
  await expect(page.getByText('No payments match')).toBeVisible();
  await page.getByRole('button', { name: 'Last 7 days' }).click();
  await expect(page).toHaveURL(/range=7d/);
  await check('filtering payments');

  await page.goBack();                                   // back to method=upi, this month
  await expect(page).toHaveURL(/method=upi(?!.*range)/);
  await page.goBack();                                   // back to unfiltered
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(page.getByRole('link', { name: 'CR-R-0001' })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/method=upi/);
  await check('back/forward through filters');

  await page.goBack();
  await page.getByRole('link', { name: 'CR-R-0001' }).click();                                   // payment details
  await expect(page.getByRole('complementary', { name: 'Payment details' })).toContainText('Money Member');
  await check('opening payment details');
});
