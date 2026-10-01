import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Admin read caching: moving between pages doesn't re-read what was just loaded, yet anything
// staff save shows up at once everywhere.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'desktop flows');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Admin' });
async function go(page: Page, link: string, url: RegExp) {
  await nav(page).getByRole('link', { name: link, exact: true }).click();
  await page.waitForURL(url);
  await page.waitForTimeout(1500);   // let the page's queries finish
}
/** Firestore read requests the browser makes: count queries (REST) and listen/query traffic. */
function meter(page: Page) {
  const m = { counts: 0, reads: 0 };
  page.on('request', (r) => {
    const u = r.url();
    if (!u.includes(':8085') && !u.includes('firestore')) return;
    if (u.includes(':runAggregationQuery')) m.counts++;
    else if (u.includes(':runQuery') || u.includes(':batchGet') || u.includes('/Listen/channel')) m.reads++;
  });
  return m;
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  for (const [id, name] of [['T1', 'Coach One'], ['T2', 'Coach Two'], ['T3', 'Coach Three']]) await seedDoc(`teamMembers/${id}`, { name, role: 'Coach' });
  await seedDoc('members/m1', { name: 'Due Member', nameLower: 'due member', phone: '9000000101', phoneKey: '9000000101', status: 'active', membershipEnd: '2026-01-05', activeUntil: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), planId: null, trainerId: 'T1' });
  await seedDoc('enquiries/e1', { name: 'Lead Person', phone: '9000000077', email: '', plan: '3 Months', message: 'Interested', status: 'new', read: false, submittedAt: ts(new Date().toISOString()) });
});

test('going back and forth between pages re-uses what was just read', async ({ page }) => {
  await login(page);
  await page.waitForTimeout(3000);                                   // dashboard + background prefetch
  const m = meter(page);
  for (let i = 0; i < 2; i++) {
    await go(page, 'Trainers', /\/admin\/trainers$/);
    await go(page, 'Dues', /\/admin\/payments\/dues$/);
    await go(page, 'Members', /\/admin\/members$/);
    await go(page, 'Dashboard', /\/admin\/?$/);
  }
  console.log(`[admin-reads] 2 rounds of Trainers → Dues → Members → Dashboard: ${m.counts} count queries, ${m.reads} other read requests`);
  test.info().annotations.push({ type: 'reads', description: JSON.stringify(m) });
  // The second round is served from the cache; the first visit to Trainers is the only one that counts
  expect(m.counts).toBeLessThanOrEqual(12);
});

test('a save shows up at once: answering an enquiry clears the badge and the dashboard alert', async ({ page }) => {
  await login(page);
  const enquiries = nav(page).getByRole('link', { name: /^Enquiries/ });
  await expect(enquiries).toContainText('1');                       // unread badge
  await expect(page.getByText('1 new enquiry waiting for a reply')).toBeVisible();
  await enquiries.click();
  await page.waitForURL(/\/admin\/enquiries/);
  await page.getByText('Lead Person').first().click();               // opening it marks it read
  await page.getByRole('radio', { name: /contacted/i }).click();     // and answer it
  await expect(page.getByRole('radio', { name: /contacted/i })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(enquiries).not.toContainText('1');                   // badge gone without waiting for its 2-minute window
  await go(page, 'Dashboard', /\/admin\/?$/);
  await expect(page.getByText('new enquiry waiting')).toHaveCount(0);   // dashboard cache refreshed by the save
});

test('the team list cached by Access → Activity doesn’t break a trainer profile', async ({ page }) => {
  await login(page);
  await page.goto('/admin/access?tab=activity');
  await page.waitForTimeout(1500);
  await go(page, 'Trainers', /\/admin\/trainers$/);
  await page.getByRole('link', { name: /Coach One/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Coach One' })).toBeVisible();
});
