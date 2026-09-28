import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Phones: participants register and open their pass; staff check people in.
// Plus a responsive sweep of every event screen. Emulator data only.
test.describe.configure({ mode: 'serial' });

const cats = [{ id: 'dl', name: 'Deadlift', scoring: 'weight', unit: 'kg', direction: 'higher' }];
const event = (status: string, extra: Record<string, unknown> = {}) => ({
  title: 'Mobile Test Meet', slug: 'mobile-test-meet', shortDescription: 'Test event', description: 'Test', coverImage: '',
  location: 'Crunch Fitness Club, Wakad', eventDate: '2030-07-01', startTime: '09:00', endTime: '12:00',
  registrationOpenAt: '', registrationCloseAt: '', capacity: null, registrationEnabled: true, status, categories: cats,
  eligibility: '', rules: '', currentCategoryId: 'dl', paused: false, registrationCount: 0, checkedInCount: 0, createdBy: 'test', ...extra,
});
const IGNORE = [/URI malformed/, /maps\.googleapis/, /Failed to load resource/];
const track = (page: Page) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => { if (!IGNORE.some((r) => r.test(e.message))) errs.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errs.push(m.text()); });
  return errs;
};
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
const signIn = async (page: Page) => {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
};

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('events/m1', event('registration_open'));
});

test('participant registers on a phone and opens the pass', async ({ page }) => {
  const errs = track(page);
  await page.goto('/events/mobile-test-meet');
  await noOverflow(page);
  await page.getByRole('link', { name: /Register now/ }).click();
  await page.getByLabel('Full name').fill('Phone Person');
  await page.getByLabel('Phone').fill('9000000009');
  await expect(page.getByLabel('Category')).toHaveCount(0);      // one category → no question
  const submit = page.getByRole('button', { name: 'Register' });
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await submit.click();
  await expect(page.getByText('You’re in.')).toBeVisible();
  await page.getByRole('link', { name: 'View pass' }).click();
  await expect(page.locator('#pass-name')).toHaveText('Phone Person');
  await noOverflow(page);
  await page.goto('/events/mobile-test-meet');
  await expect(page.getByRole('link', { name: 'My pass' })).toBeVisible();  // remembered on this device
  expect(errs).toEqual([]);
});

test('staff check someone in on a phone', async ({ page }) => {
  await seedDoc('events/m1', event('check_in', { registrationCount: 1 }));
  await signIn(page);
  await page.goto('/admin/events/m1/check-in');
  await noOverflow(page);
  await page.getByPlaceholder('Name, CR-number or phone').fill('phone');
  const btn = page.getByRole('button', { name: 'Check in Phone Person' });
  expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await btn.click();
  await expect(page.getByRole('status')).toContainText('Checked in');
  await expect(page.getByRole('status')).toContainText('#CR-001');
});

test('LIVE page renders fully with reduced motion', async ({ page }) => {
  await seedDoc('events/m1', event('live', { registrationCount: 1, checkedInCount: 1 }));
  await seedDoc('events/m1/results/1', { categoryId: 'dl', displayName: 'Phone Person', number: 1, score: 120, unit: 'kg', position: null, public: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/events/mobile-test-meet');
  await expect(page.getByText('Live now').first()).toBeVisible();
  await expect(page.getByRole('list', { name: 'Deadlift leaderboard' })).toContainText('120 kg');
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.m-line > *, .m-rise, .m-wipe-up')]
    .filter((el) => { const cs = getComputedStyle(el); return cs.opacity === '0' || cs.clipPath.includes('100%'); }).length);
  expect(hidden).toBe(0);
});

test('responsive sweep: no overflow, broken images or errors on any event screen', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'runs its own viewports');
  test.setTimeout(300_000);
  await seedDoc('events/m1/passes/p1', { registrationId: '1', number: 1, name: 'Phone Person', categoryId: 'dl' });
  const routes = ['/events', '/events/mobile-test-meet', '/events/mobile-test-meet/pass/p1', '/events/not-a-real-event',
    '/admin/events', '/admin/events/new', '/admin/events/m1', '/admin/events/m1?tab=results', '/admin/events/m1/check-in', '/admin/events/m1/live', '/admin/events/social'];
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const errs = track(page);
    await signIn(page);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('h1').first(), `${route} @ ${width}px has an h1`).toBeVisible();
      await page.waitForTimeout(300);
      const res = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src),
      }));
      expect(res, `${route} @ ${width}px`).toEqual({ overflow: 0, broken: [] });
    }
    expect(errs, `console errors @ ${width}px`).toEqual([]);
    await ctx.close();
  }
});
