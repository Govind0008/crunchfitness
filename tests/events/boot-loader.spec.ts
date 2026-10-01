import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc } from './emulator';

// The branded boot screen ("The Rep") covers the first entry into the admin only, hands over
// when the app is actually ready, never hangs, respects reduced motion and the saved theme —
// and in-app navigation shows skeletons, never the boot screen again.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'drives its own viewports');

const SHOTS = process.env.SHOTS_DIR;
const LOADER = '[data-boot-loader]';

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
/** Records whether the boot screen ever appears, from before the app's first script runs. */
const watchLoader = (page: Page) => page.addInitScript(() => {
  (window as unknown as { __bootSeen: number }).__bootSeen = 0;
  new MutationObserver(() => { if (document.querySelector('[data-boot-loader]')) (window as unknown as { __bootSeen: number }).__bootSeen++; })
    .observe(document, { childList: true, subtree: true });
});
const seen = (page: Page) => page.evaluate(() => (window as unknown as { __bootSeen: number }).__bootSeen);
/** Hold back the first admin page's code by `ms`: the boot screen waits for it (and nothing else changes). */
const PAGE_CODE = /\/src\/features\/admin\/index\.tsx/;
const slowPageCode = (page: Page, ms: number) => page.route(PAGE_CODE, async (r) => { await new Promise((res) => setTimeout(res, ms)); await r.continue().catch(() => {}); });
/** Hold back the app's database traffic (Firestore emulator) by `ms`. */
const slowDb = (page: Page, ms: number) => page.route(/127\.0\.0\.1:8085/, async (r) => { await new Promise((res) => setTimeout(res, ms)); await r.continue().catch(() => {}); });

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
});

test('hard load: the boot screen shows, then hands over to the shell — and doesn’t linger', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text()); });
  await login(page);
  await watchLoader(page);
  const t0 = Date.now();
  await page.reload();
  await expect(page.locator(LOADER)).toBeVisible();
  await expect(page.locator(LOADER)).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator(LOADER).getByRole('img', { name: 'Crunch Fitness' })).toBeVisible();   // the real logo
  await expect(page.locator(LOADER)).toBeHidden({ timeout: 6000 });
  const took = Date.now() - t0;
  expect(took, 'boot screen should be short once the app is ready').toBeLessThan(6000);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('in-app navigation never shows the boot screen again (skeletons instead)', async ({ page }) => {
  await login(page);
  await watchLoader(page);
  await page.reload();
  await expect(page.locator(LOADER)).toBeHidden({ timeout: 6000 });
  const before = await seen(page);
  // Slow the database so the next pages have to show their loading state
  await slowDb(page, 1200);
  const nav = page.getByRole('navigation', { name: 'Admin' });
  await nav.getByRole('link', { name: 'Trainers' }).click();
  await expect(page.getByRole('status', { name: 'Loading' }).first()).toBeVisible();             // the table skeleton
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trainers');
  await expect(page.getByRole('list', { name: 'Trainers' })).toContainText('Coach One', { timeout: 10_000 });
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
  for (const name of ['Members', 'Payments', 'Attendance', 'Dashboard']) await nav.getByRole('link', { name }).click();
  await page.waitForTimeout(500);
  expect(await seen(page), 'boot screen appeared during navigation').toBe(before);
  await page.unroute(/127\.0\.0\.1:8085/);
});

test('a busy button shows it is working and can’t submit twice', async ({ page }) => {
  await login(page);
  await page.goto('/admin/enquiries');
  await expect(page.locator(LOADER)).toBeHidden({ timeout: 6000 });
  await page.getByRole('button', { name: 'Add enquiry' }).first().click();
  const form = page.getByRole('form', { name: 'New enquiry' });
  await form.getByLabel('Name').fill('Double Click Test');
  await form.getByLabel('Mobile number').fill('9000000555');
  await slowDb(page, 1500);
  const submit = form.getByRole('button', { name: 'Add enquiry' });
  await submit.click();
  const busy = form.getByRole('button', { name: /Saving…/ });
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  await busy.click({ force: true }).catch(() => {});                                               // a second click does nothing
  await page.unroute(/127\.0\.0\.1:8085/);
  await expect(page.getByRole('list', { name: 'Enquiries' })).toContainText('Double Click Test', { timeout: 15_000 });
  await expect(page.getByRole('list', { name: 'Enquiries' }).getByText('Double Click Test')).toHaveCount(1);
});

test('reduced motion: a still barbell and “Loading…”, then straight in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  await slowPageCode(page, 1500);
  await page.reload();
  const loader = page.locator(LOADER);
  await expect(loader).toBeVisible();
  await expect(loader).toContainText('Loading…');
  expect(await loader.locator('.boot-bar').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.unroute(PAGE_CODE);
  await expect(loader).toBeHidden({ timeout: 15_000 });
});

test('the boot screen uses the saved theme from the first frame — light and dark', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  for (const theme of ['light', 'dark'] as const) {
    await page.evaluate((t) => localStorage.setItem('crunch.admin.theme', t), theme);
    await slowPageCode(page, 1500);
    await page.reload();
    await expect(page.locator(LOADER)).toBeVisible();
    // Set before any app code ran (index.html), so nothing flashes the other theme
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    const bg = await page.locator(LOADER).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe(theme === 'light' ? 'rgb(238, 238, 230)' : 'rgb(10, 10, 11)');                 // the app background token, never pure white
    const logo = await page.locator(LOADER).getByRole('img', { name: 'Crunch Fitness' }).getAttribute('src');
    expect(logo).toBe(theme === 'light' ? '/images/logo-light.webp' : '/images/logo.webp');
    await page.unroute(PAGE_CODE);
    await expect(page.locator(LOADER)).toBeHidden({ timeout: 15_000 });           // after the held-back requests recover
  }
});

test('slow start: never an endless spinner — it says so and offers a reload', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await page.route(/127\.0\.0\.1:8085/, () => { /* hold every database request */ });
  await page.reload();
  const loader = page.locator(LOADER);
  await expect(loader).toBeVisible();
  await expect(loader).toContainText('Taking longer than usual', { timeout: 12_000 });
  await expect(loader.getByRole('button', { name: 'Reload' })).toBeVisible();
  await loader.getByRole('button', { name: 'Reload' }).click();                     // reloads the page…
  await expect(page.locator(LOADER)).toBeVisible();                                    // …and boots again
  await page.unroute(/127\.0\.0\.1:8085/);
  await expect(page.locator(LOADER)).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/);
});

test('fits every screen: no overflow, logo and bar centred', async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  for (const theme of ['dark', 'light'] as const) {
    await page.evaluate((t) => localStorage.setItem('crunch.admin.theme', t), theme);
    for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 768], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await slowPageCode(page, 1600);
      await page.reload();
      const loader = page.locator(LOADER);
      await expect(loader).toBeVisible();
      await page.waitForTimeout(450);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/boot-${theme}-${w}x${h}-a.png` });
      await page.waitForTimeout(650);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/boot-${theme}-${w}x${h}-b.png` });
      const m = await page.evaluate(() => {
        const bar = document.querySelector('.boot-barbell')!.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, centre: Math.abs(bar.left + bar.width / 2 - innerWidth / 2), inView: bar.top > 0 && bar.bottom < innerHeight };
      });
      expect(m.overflow, `${theme} ${w}x${h} overflow`).toBe(false);
      expect(m.centre, `${theme} ${w}x${h} barbell centred`).toBeLessThan(2);
      expect(m.inView, `${theme} ${w}x${h} barbell on screen`).toBe(true);
      await page.unroute(PAGE_CODE);
      await expect(loader).toBeHidden({ timeout: 15_000 });
    }
  }
});
