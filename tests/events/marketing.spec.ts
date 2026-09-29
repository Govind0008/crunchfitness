import { test, expect, type Page } from '@playwright/test';
import { ADMIN, ensureUser, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The Creative Desk: its own login and persistent shell, real counts, content tools only —
// and no way into members, phone numbers or money.
test.describe.configure({ mode: 'serial' });

const MARKETING = { email: 'desk@crunch.test', password: 'crunch-test-pass' };
const CLIENT = 'desk-client@crunch.test';
const EVENT = {
  title: 'Deadlift Day', slug: 'deadlift-day', shortDescription: 'Pull heavy', description: 'Old copy', coverImage: '', location: 'Main floor',
  eventDate: '2030-06-01', startTime: '18:00', endTime: '20:00', registrationOpenAt: '', registrationCloseAt: '', capacity: 40,
  registrationEnabled: true, categories: [], eligibility: '', rules: '', currentCategoryId: null, paused: false,
  status: 'registration_open', registrationCount: 1, checkedInCount: 0, createdBy: 'x',
};

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser(MARKETING.email)}`, { role: 'marketing', email: MARKETING.email });
  await seedDoc(`userRoles/${await ensureUser(CLIENT)}`, { role: 'client', trainerId: 'T1', clientId: 'c1' });
  await seedDoc('posts/live', { title: 'Squat Basics', slug: 'squat-basics', excerpt: 'x', content: 'x', category: 'Fitness Tips', author: 'Crunch', tags: [], published: true, readTime: 1, publishedAt: ts('2026-01-01T00:00:00Z') });
  await seedDoc('posts/draft', { title: 'Secret Draft', slug: 'secret-draft', excerpt: 'x', content: 'x', category: 'Fitness Tips', author: 'Crunch', tags: [], published: false, readTime: 1, publishedAt: ts('2026-01-02T00:00:00Z') });
  await seedDoc('teamMembers/test', { name: 'test', role: 'Coach', order: 1, visible: true });
  await seedDoc('events/ev1', EVENT);
  await seedDoc('members/m1', { name: 'Private Member', nameLower: 'private member', phone: '9000000001', phoneKey: '9000000001', status: 'active', activeUntil: '2030-01-01' });
});

async function deskLogin(page: Page, email = MARKETING.email) {
  await page.goto('/marketing/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(MARKETING.password);
  await page.getByRole('button', { name: 'Enter Marketing Desk' }).click();
}

test('the Creative Desk login, then real numbers — never invented', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/marketing');
  await page.waitForURL(/\/marketing\/login$/);                         // signed out → sign in first
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Build the brand.');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tell the story.');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide, 'login page scrolls sideways').toBe(false);
  await deskLogin(page);
  await page.waitForURL(/\/marketing$/);
  const glance = page.getByRole('region', { name: 'Content at a glance' });
  await expect(glance.getByRole('link').filter({ hasText: 'Published posts' })).toContainText('1');
  await expect(glance.getByRole('link').filter({ hasText: 'Drafts' })).toContainText('1');
  await expect(glance.getByRole('link').filter({ hasText: 'Upcoming events' })).toContainText('1');
  await expect(glance.getByRole('link').filter({ hasText: 'Active promotions' })).toContainText('0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'desk scrolls sideways').toBe(false);
  expect(errors).toEqual([]);
});

test('marketing navigation stays inside one shell; blog, events, offers, team, social', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop navigation story');
  await deskLogin(page);
  await page.waitForURL(/\/marketing$/);
  await expect(page.getByRole('navigation', { name: 'Marketing' })).toBeVisible();
  const loads = { n: 0 };
  page.on('load', () => loads.n++);
  await page.evaluate(() => { (window as unknown as { __spa: string }).__spa = 'alive'; document.querySelector('[data-marketing-shell] aside')!.setAttribute('data-mark', 'shell'); });
  const nav = page.getByRole('navigation', { name: 'Marketing' });
  for (const [label, url, heading] of [
    ['Blog', /\/marketing\/blog$/, 'Blog'], ['Events', /\/marketing\/events$/, 'Events'], ['Offers', /\/marketing\/offers$/, 'Offers'],
    ['Team profiles', /\/marketing\/team$/, 'Team'], ['Instagram', /\/marketing\/social$/, 'Instagram highlights'], ['Desk', /\/marketing$/, /Build the brand/],
  ] as const) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/marketing\/social$/);
  const kept = await page.evaluate(() => (window as unknown as { __spa?: string }).__spa === 'alive' && document.querySelector('[data-marketing-shell] aside')?.getAttribute('data-mark') === 'shell');
  expect(kept, 'shell remounted or page reloaded').toBe(true);
  expect(loads.n).toBe(0);
});

test('marketing writes a draft, edits an event page, and can’t remove the “test” team member', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop data story');
  await deskLogin(page);
  await page.waitForURL(/\/marketing$/);
  // Blog: quick action opens the new-post form
  await page.getByRole('link', { name: 'New blog post' }).click();
  const post = page.getByRole('dialog', { name: 'New post' });
  await post.getByLabel('Title').fill('Monsoon Training Plan');
  await post.getByLabel('Summary').fill('Stay consistent through the rains.');
  await post.getByLabel('Content').fill('Train indoors, keep it simple.');
  await post.getByRole('button', { name: /Link, tags and search appearance/ }).click();
  await post.getByLabel('Search title').fill('Monsoon training at Crunch Wakad');
  await post.getByRole('button', { name: 'Save draft' }).click();
  const posts = page.getByRole('list', { name: 'Posts' });
  await expect(posts.getByRole('button', { name: 'Edit Monsoon Training Plan' })).toContainText('Draft');
  // Edit it again
  await posts.getByRole('button', { name: 'Edit Monsoon Training Plan' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit post' });
  await edit.getByRole('button', { name: /Link, tags and search appearance/ }).click();
  await expect(edit.getByLabel('Search title')).toHaveValue('Monsoon training at Crunch Wakad');
  await edit.getByRole('button', { name: 'Cancel' }).click();

  // Events: text only — registration and capacity aren't offered
  await page.getByRole('navigation', { name: 'Marketing' }).getByRole('link', { name: 'Events' }).click();
  await page.getByRole('link', { name: /Deadlift Day/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deadlift Day');
  await page.getByLabel('Description', { exact: true }).fill('Bring chalk and a belt.');
  await page.getByRole('button', { name: 'Save page text' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Photos & video' }).getByText('Upload photos or videos')).toBeVisible();

  // Team: edit yes, remove no
  await page.getByRole('navigation', { name: 'Marketing' }).getByRole('link', { name: 'Team profiles' }).click();
  await page.getByRole('list', { name: 'Team' }).getByRole('button', { name: 'Edit test' }).click();
  const profile = page.getByRole('dialog', { name: 'Edit profile' });
  await expect(profile.getByRole('button', { name: 'Save profile' })).toBeVisible();
  await expect(profile.getByRole('button', { name: 'Remove profile' })).toHaveCount(0);  // marketing edits, never removes
});

test('marketing is kept out of the admin — no member or money data renders', async ({ page }) => {
  await deskLogin(page);
  await page.waitForURL(/\/marketing$/);
  for (const path of ['/admin', '/admin/members', '/admin/payments', '/admin/revenue', '/admin/members/m1']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'This is a marketing account' })).toBeVisible();
    await expect(page.getByText('Private Member')).toHaveCount(0);
    await expect(page.locator('[data-admin-shell]')).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Go to the Creative Desk' }).click();
  await expect(page).toHaveURL(/\/marketing$/);
});

test('other accounts are turned away from the desk; admins can use it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await ensureUser(CLIENT);
  await deskLogin(page, CLIENT);
  await expect(page.getByRole('alert')).toContainText('isn’t on the marketing team');
  await expect(page).toHaveURL(/\/marketing\/login$/);
  // An admin signing in at the desk gets in, with a way back to the gym admin
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Enter Marketing Desk' }).click();
  await page.waitForURL(/\/marketing$/);
  await expect(page.getByRole('link', { name: 'Gym admin' })).toBeVisible();
});

test('a marketing login signing in at /admin/login lands on the desk', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(MARKETING.email);
  await page.getByLabel('Password', { exact: true }).fill(MARKETING.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/marketing$/);
});

test('admins add a marketing login in Settings → Staff access', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  if (!(await nav.getByRole('link', { name: 'Settings' }).count())) await nav.getByRole('button', { name: 'More' }).click();   // secondary pages live under More
  await nav.getByRole('link', { name: 'Settings' }).click();
  const staff = page.getByRole('region', { name: 'Staff access' });
  await expect(staff.getByRole('list', { name: 'Staff accounts' })).toContainText(MARKETING.email);
  await staff.getByRole('button', { name: 'Add marketing login' }).click();
  await staff.getByLabel('Name').fill('Nisha');
  await staff.getByLabel('Email').fill(`new-desk-${Date.now()}@crunch.test`);
  await staff.getByLabel('Password').fill('long-enough-pass');
  await staff.getByRole('button', { name: 'Create marketing login' }).click();
  await expect(staff.getByRole('status')).toContainText('can now sign in at /marketing/login');
  await expect(staff.getByRole('list', { name: 'Staff accounts' })).toContainText('Nisha');
  // The admin is still signed in as themselves (the login was created on a side connection)
  await expect(page.getByRole('navigation', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('button', { name: `Account: ${ADMIN.email}` })).toBeVisible();   // still signed in as the admin
  // Gym setup shows real progress
  await page.goto('/admin/settings/setup');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gym setup');
  await expect(page.getByText('Waiting on device details')).toBeVisible();
});
