import { test, expect, type Page, type Browser } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The consistency pass: one design system on every active admin screen, Classes and the duty
// roster gone from the product, and every quick action starting the real task at once.
test.describe.configure({ mode: 'serial' });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const IGNORE = [/URI malformed/, /maps\.googleapis/, /Failed to load resource/];
const errors: string[] = [];

async function signIn(browser: Browser, width = 1440, height = 900) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => { if (!IGNORE.some((r) => r.test(e.message))) errors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push(m.text()); });
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
  return page;
}
const openMore = async (page: Page) => {
  const nav = page.getByRole('navigation', { name: 'Admin' });
  if (!(await nav.getByRole('link', { name: 'Blog', exact: true }).count())) await nav.getByRole('button', { name: 'More' }).click();
  return nav;
};

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1, features: ['Gym floor'], isPopular: false });
  await seedDoc('teamMembers/test', { name: 'test', role: 'Coach', order: 1, visible: true, image: '' });
  await seedDoc('classSessions/old', { title: 'Old Class', trainerId: 'test', date: today, startTime: '07:00', duration: 60, capacity: 10, pin: '1' });
  await seedDoc('duties/old', { trainerId: 'test', weekStart: today, shift: 'Morning', area: 'Floor', days: ['Mon'] });
  await seedDoc('offers/live', { title: 'Monsoon offer', description: '20% off', badge: 'LIMITED', color: 'green', startDate: addDays(today, -3), endDate: addDays(today, 10), active: true });
  await seedDoc('offers/gone', { title: 'Summer offer', description: '', badge: '', color: 'red', startDate: '2025-04-01', endDate: '2025-05-01', active: true });
  await seedDoc('posts/live', { title: 'Squat Basics', slug: 'squat-basics', excerpt: 'x', content: 'x', category: 'Fitness Tips', author: 'Crunch', tags: [], published: true, readTime: 1, publishedAt: ts('2026-01-01T00:00:00Z'), coverImage: '' });
  await seedDoc('members/en1', { name: 'Enrol Person', nameLower: 'enrol person', phone: '9000000091', phoneKey: '9000000091', email: '', emailLower: '', planId: 'p1',
    membershipStart: today, membershipEnd: addDays(today, 30), status: 'active', activeUntil: addDays(today, 30), trainerId: null, trainerClient: null, notes: '', source: 'manual' });
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL F22', serialNumber: 'X1', location: '', protocol: 'adms', enabled: true, nextUserId: 1,
    lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null, createdBy: 'seed' });
});

test('Classes and Duty roster are gone from the sidebar, More, the command palette and the dashboard', async ({ browser }) => {
  const page = await signIn(browser);
  const nav = await openMore(page);
  await expect(nav).not.toContainText(/Classes|Duty roster|Roster/);
  // More is grouped, in this order
  await expect(nav.getByRole('group', { name: 'Insights' }).getByRole('link')).toHaveText(['Revenue', 'Reports']);
  await expect(nav.getByRole('group', { name: 'Website' }).getByRole('link')).toHaveText(['Offers', 'Plans', 'Blog', 'Team']);
  await expect(nav.getByRole('group', { name: 'System' }).getByRole('link')).toHaveText(['Activity', 'Settings']);
  await expect(page.locator('main')).not.toContainText(/duty roster|class(es)?\b/i);   // seeded class and duty are not surfaced
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Quick actions' });
  await expect(palette).toBeVisible();
  await expect(palette).not.toContainText(/class|roster/i);
  await page.getByRole('combobox', { name: 'Command search' }).fill('class');
  await expect(palette.getByRole('option')).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Old links are retired, not broken
  for (const tab of ['schedule', 'roster']) {
    await page.goto(`/admin/dashboard?tab=${tab}`);
    await expect(page).toHaveURL(/\/admin\/?$/);
  }
  await page.close();
});

test('offers: Active / Scheduled / Expired / Draft, created and edited in a drawer', async ({ browser }) => {
  const page = await signIn(browser);
  await (await openMore(page)).getByRole('link', { name: 'Offers', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offers');
  await expect(page.getByText('1 showing on the website now')).toBeVisible();
  const list = page.getByRole('list', { name: 'Offers' });
  await expect(list.getByRole('button', { name: 'Edit Monsoon offer' })).toContainText('Active');
  await expect(list.getByRole('button', { name: 'Edit Summer offer' })).toContainText('Expired');

  await page.getByRole('button', { name: 'Create offer' }).click();
  const form = page.getByRole('dialog', { name: 'Create offer' });
  await form.getByLabel('Headline').fill('Diwali offer');
  await form.getByLabel('Starts').fill(addDays(today, 20));
  await form.getByLabel('Ends').fill(addDays(today, 40));
  await form.getByRole('button', { name: 'Create offer' }).click();
  await expect(list.getByRole('button', { name: 'Edit Diwali offer' })).toContainText('Scheduled');

  await list.getByRole('button', { name: 'Edit Diwali offer' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit offer' });
  await edit.getByRole('button', { name: 'Switch off' }).click();
  await expect(list.getByRole('button', { name: 'Edit Diwali offer' })).toContainText('Draft');
  await page.getByRole('group', { name: 'Filter offers' }).getByRole('button', { name: /Draft/ }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await page.close();
});

test('plans: a list with name, duration, price and status; add and edit in a drawer', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/plans');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plans');
  const list = page.getByRole('list', { name: 'Plans' });
  await expect(list.getByRole('button', { name: 'Edit 1 Month' })).toContainText('₹3,000');
  await page.getByRole('button', { name: 'Add plan' }).click();
  const form = page.getByRole('dialog', { name: 'Add plan' });
  await form.getByRole('button', { name: 'Add plan' }).click();
  await expect(form.getByRole('alert')).toContainText('needs a name');
  await form.getByLabel('Plan', { exact: true }).fill('6 Months');
  await form.getByLabel('Price').fill('₹11,000');
  await form.getByLabel('What’s included').fill('Gym floor\nDiet chart');
  await form.getByLabel(/Most popular/).check();
  await form.getByRole('button', { name: 'Add plan' }).click();
  await expect(list.getByRole('button', { name: 'Edit 6 Months' })).toContainText('Most popular');
  await expect(list.getByRole('button', { name: 'Edit 1 Month' })).toContainText('₹3,000');   // other prices untouched
  await page.close();
});

test('blog: cover, title, category, status, date and author; publish and unpublish', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/blog');
  const list = page.getByRole('list', { name: 'Posts' });
  const row = list.getByRole('button', { name: 'Edit Squat Basics' });
  await expect(row).toContainText('Fitness Tips · Crunch');
  await expect(row).toContainText('Published');
  await expect(list.getByRole('link', { name: 'Preview Squat Basics' })).toHaveAttribute('href', '/blog/squat-basics');
  await row.click();
  await page.getByRole('dialog', { name: 'Edit post' }).getByRole('button', { name: 'Unpublish' }).click();
  await expect(row).toContainText('Draft');
  await row.click();
  await page.getByRole('dialog', { name: 'Edit post' }).getByRole('button', { name: 'Publish' }).click();
  await expect(row).toContainText('Published');
  await expect(page.getByText('1 published · 0 drafts')).toBeVisible();
  await page.close();
});

test('team: staff profiles only, add with a photo, the “test” profile stays', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/team');
  await expect(page.getByText(/staff profiles, not gym members/)).toBeVisible();
  const list = page.getByRole('list', { name: 'Team' });
  await expect(list.getByRole('button', { name: 'Edit test' })).toContainText('On website');
  await expect(list).not.toContainText('Enrol Person');                               // gym members never appear here
  await page.getByRole('button', { name: 'Add team member' }).click();
  const form = page.getByRole('dialog', { name: 'Add team member' });
  await form.getByLabel('Name').fill('New Coach');
  await form.getByLabel('Role').fill('Coach');
  await form.getByRole('button', { name: 'Add team member' }).click();
  await expect(form.getByRole('alert')).toContainText('Add a photo');                // the website always shows one
  await page.keyboard.press('Escape');
  // Admins may remove a profile (behind a confirmation); we don't — "test" must stay
  await list.getByRole('button', { name: 'Edit test' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit profile' }).getByRole('button', { name: 'Remove profile' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list.getByRole('button', { name: 'Edit test' })).toBeVisible();
  await page.close();
});

test('Enroll access from the dashboard: pick a member, then straight into the enrolment wizard', async ({ browser }) => {
  const page = await signIn(browser);
  await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Enroll access' }).click();
  const drawer = page.getByRole('dialog', { name: 'Enroll access' });
  await expect(drawer.getByLabel('Who is enrolling?')).toBeFocused();
  await drawer.getByLabel('Who is enrolling?').fill('enrol');
  await drawer.getByRole('list', { name: 'Matching members' }).getByRole('button', { name: /Enrol Person/ }).click();
  const wiz = drawer.getByRole('region', { name: 'Confirm member' });
  await expect(wiz).toContainText('Enrol Person');
  await wiz.getByRole('button', { name: 'Continue' }).click();
  await drawer.getByRole('radio', { name: /Main entrance/ }).click();
  await drawer.getByRole('region', { name: 'Choose device' }).getByRole('button', { name: 'Start enrolment' }).click();
  const enrol = drawer.getByRole('region', { name: 'Enrol on device' });
  await expect(enrol).toContainText('Device offline');                             // honest: the test device never connected
  await expect(enrol).not.toContainText('Enrolled');
  await page.close();
});

test('command palette starts tasks directly', async ({ browser }) => {
  const page = await signIn(browser);
  await page.goto('/admin/members');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Members');     // shell mounted, shortcut listening
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Command search' }).fill('collect payment');
  await page.getByRole('option', { name: /Collect payment/ }).click();
  await expect(page.getByRole('dialog', { name: 'Collect payment' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Command search' }).fill('add enquiry');
  await page.getByRole('option', { name: /Add enquiry/ }).click();
  await expect(page.getByRole('dialog', { name: 'Add enquiry' })).toBeVisible();
  await page.close();
});

test('phones: new screens fit, drawers go full-screen, the bottom bar stays', async ({ browser }) => {
  test.setTimeout(240_000);
  for (const width of [360, 375, 390, 768]) {
    const page = await signIn(browser, width, 800);
    for (const route of ['/admin/enquiries', '/admin/offers', '/admin/plans', '/admin/blog', '/admin/team', '/admin/trainers', '/admin/attendance']) {
      await page.goto(route);
      await expect(page.locator('h1').first(), `${route} @ ${width}`).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow, `${route} @ ${width}px overflows`).toBeLessThanOrEqual(0);
      if (width < 768) await expect(page.getByRole('navigation', { name: 'Quick navigation' })).toBeVisible();
    }
    await page.goto('/admin');
    await page.getByRole('region', { name: 'Quick actions' }).getByRole('button', { name: 'Add member' }).click();
    const box = await page.getByRole('dialog', { name: 'Add member' }).boundingBox();
    if (width < 640) expect(Math.round(box!.width), `drawer @ ${width}`).toBe(width);       // full-screen on phones
    else expect(box!.width).toBeLessThan(width);                                            // a side panel on tablets
    await page.close();
  }
});

test('no console errors across the consistency pass', () => { expect(errors).toEqual([]); });
