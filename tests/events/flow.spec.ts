import { test, expect, type Page, type Browser } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, ensureUser } from './emulator';

// The whole competition, end to end, against the emulators:
// ADMIN → FIREBASE → PUBLIC WEBSITE. One serial story; each step builds on the last.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'the full admin flow runs on desktop; mobile has its own specs');

const TITLE = 'Crunch Strength Test Meet';
const SLUG = 'crunch-strength-test-meet-2030';
let eventId = '';
let passUrl = '';

// A 1×1 PNG, generated in memory — test fixture only
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const errors: string[] = [];
const IGNORE = [/URI malformed/, /maps\.googleapis/, /Failed to load resource/, /gpteng/];
function watchErrors(page: Page) {
  page.on('pageerror', (e) => { if (!IGNORE.some((r) => r.test(e.message))) errors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE.some((r) => r.test(m.text()))) errors.push(m.text()); });
}

const cloudinaryUploads: string[] = [];
async function adminPage(browser: Browser) {
  const page = await browser.newPage();
  watchErrors(page);
  // Never upload to the real Cloudinary account from tests: answer locally with a gym photo
  await page.route('https://api.cloudinary.com/**', async (route) => {
    cloudinaryUploads.push(route.request().url());
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ secure_url: 'http://localhost:8091/images/deadlift-600.webp', public_id: `test/${cloudinaryUploads.length}` }) });
  });
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  await page.goto('/admin/events');
  await expect(page.getByRole('heading', { name: 'Events', level: 1 })).toBeVisible();
  return page;
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
});

test('a role-less account is told it cannot manage events', async ({ page }) => {
  await ensureUser('staff-norole@crunch.test');
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill('staff-norole@crunch.test');
  await page.getByLabel(/password/i).fill('crunch-test-pass');
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/\/admin\/dashboard/);
  await page.goto('/admin/events');
  await expect(page.getByRole('heading', { name: /can’t manage events yet/i })).toBeVisible();
});

test('public events page shows an intentional empty state', async ({ page }) => {
  watchErrors(page);
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: /nothing on the floor yet/i })).toBeVisible();
});

test('admin creates an event with the wizard and saves a draft', async ({ browser }) => {
  const page = await adminPage(browser);
  await expect(page.getByText('No events yet')).toBeVisible();
  await page.getByRole('link', { name: 'Create event' }).first().click();

  // Step 1 — validation speaks plainly
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Give the event a name.');
  await page.getByLabel('Event name').fill(TITLE);
  await page.getByLabel('Short description').fill('One day. Three lifts. Your best numbers.');
  await page.getByLabel('Description', { exact: true }).fill('A friendly strength meet on the Crunch floor.');
  await page.getByLabel('Date').fill('2030-06-14');
  await page.getByLabel('Start time').fill('08:00');
  await page.getByLabel('End time').fill('13:00');
  await page.getByLabel('Cover photo').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 2
  await page.getByLabel('Maximum participants').fill('50');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 3 — two categories with explicit scoring
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.getByLabel('Category name').first().fill('Deadlift');
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.getByLabel('Category name').nth(1).fill('Row 500m');
  await page.getByLabel('Scored by').nth(1).selectOption('time');
  await expect(page.getByLabel('Winner').nth(1)).toHaveValue('lower');   // time → fastest wins, stated explicitly
  await page.getByLabel('Rules').fill('Three attempts per lift.');
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step 4 — summary, then save as draft
  await expect(page.getByText('50 people')).toBeVisible();
  await expect(page.getByText(/Row 500m \(lowest time wins\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.waitForURL((u) => /^\/admin\/events\/[\w-]+$/.test(u.pathname) && !u.pathname.endsWith('/new'));
  eventId = page.url().split('/').pop()!;
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/only visible to staff/)).toBeVisible();
});

test('drafts are invisible to the public', async ({ page }) => {
  await page.goto(`/events/${SLUG}`);
  await expect(page.getByRole('heading', { name: /isn’t on the floor/i })).toBeVisible();
});

test('admin edits the event, then opens registration', async ({ browser }) => {
  const page = await adminPage(browser);
  await page.goto(`/admin/events/${eventId}`);
  await page.getByRole('link', { name: 'Edit details' }).click();
  await page.getByLabel('Short description').fill('One day. Two tests. Your best numbers.');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(new RegExp(`/admin/events/${eventId}$`));

  await page.getByRole('button', { name: 'Open registration' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('The event will appear on the website');
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(page.getByText('Registration open', { exact: true }).first()).toBeVisible();
});

test('a visitor registers and gets a pass', async ({ page }) => {
  watchErrors(page);
  await page.goto('/events');
  await page.getByRole('link', { name: new RegExp(TITLE, 'i') }).click();
  await expect(page).toHaveURL(`/events/${SLUG}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(TITLE);
  await expect(page.getByText('Registration open').first()).toBeVisible();
  await expect(page.getByText('One day. Two tests. Your best numbers.').first()).toBeVisible();

  await page.getByRole('link', { name: /Register now/ }).click();
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Phone').fill('+91 90000 00001');
  await page.getByLabel('Category').selectOption({ label: 'Deadlift' });
  await page.getByLabel(/Show my name/).check();
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('You’re in.')).toBeVisible();
  await expect(page.getByText('Registration #CR-001')).toBeVisible();

  await page.getByRole('link', { name: 'View pass' }).click();
  await expect(page).toHaveURL(new RegExp(`/events/${SLUG}/pass/[a-f0-9]{32}$`));
  passUrl = page.url();
  await expect(page.locator('#pass-name')).toHaveText('Asha Rao');
  await expect(page.getByText('#CR-001')).toBeVisible();
  await expect(page.getByRole('img', { name: /QR code for registration CR-001/ })).toBeVisible();
  // No contact details on the pass
  await expect(page.getByText('90000')).toHaveCount(0);

  // A second participant, name kept private
  await page.goto(`/events/${SLUG}#register`);
  await page.getByLabel('Full name').fill('Private Person');
  await page.getByLabel('Phone').fill('+91 90000 00002');
  await page.getByLabel('Category').selectOption({ label: 'Deadlift' });
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Registration #CR-002')).toBeVisible();
});

test('admin sees registrations and checks people in (double check-in is obvious)', async ({ browser }) => {
  const page = await adminPage(browser);
  await expect(page.getByText('2 registered')).toBeVisible();
  await page.goto(`/admin/events/${eventId}?tab=registrations`);
  await expect(page.getByText('Asha Rao')).toBeVisible();
  await page.getByPlaceholder('Search name, CR-number or phone').fill('private');
  await expect(page.getByText('1 of 2 shown')).toBeVisible();

  // Close registration and start check-in
  await page.getByRole('button', { name: 'Close registration' }).click();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await page.getByRole('button', { name: 'Start check-in' }).click();
  await expect(page.getByText('Check-in', { exact: true }).first()).toBeVisible();

  await page.getByRole('link', { name: 'Check in' }).first().click();
  await page.getByPlaceholder('Name, CR-number or phone').fill('CR-001');
  await page.getByRole('button', { name: 'Check in Asha Rao' }).click();
  await expect(page.getByRole('status')).toContainText('Checked in');
  await expect(page.getByRole('status')).toContainText('Registration #CR-001');
  await page.getByRole('status').click();

  await page.getByPlaceholder('Name, CR-number or phone').fill('asha');
  await page.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByRole('status')).toContainText('Already checked in');
  await expect(page.getByRole('status')).toContainText(ADMIN.email);
});

test('admin starts the competition; the public page goes LIVE with a leaderboard', async ({ browser }) => {
  const admin = await adminPage(browser);
  const pub = await browser.newPage();
  watchErrors(pub);
  await pub.goto(`/events/${SLUG}`);
  await expect(pub.getByText('Check-in open').first()).toBeVisible();

  await admin.goto(`/admin/events/${eventId}/live`);
  await admin.getByRole('button', { name: 'Start competition' }).click();
  await expect(admin.getByRole('alertdialog')).toContainText('The public website will now show the event as LIVE.');
  await admin.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(admin.getByText('Current category · 1 of 2')).toBeVisible();

  // Realtime: no reload on the public page
  await expect(pub.getByText('Live now').first()).toBeVisible();
  await expect(pub.getByRole('heading', { name: 'Live leaderboard' })).toBeVisible();
  await expect(pub.getByText(/first scores will appear/i)).toBeVisible();

  // Enter results — one on the live board, one kept off it
  await admin.getByRole('link', { name: 'Enter result' }).click();
  await admin.getByLabel('Score for Asha Rao').fill('140');
  await admin.getByRole('button', { name: 'Save result for Asha Rao' }).click();
  await expect(admin.getByRole('button', { name: 'Save result for Asha Rao' })).toContainText(/Saved|Update/);
  await admin.getByLabel('Score for Private Person').fill('150');
  await admin.getByRole('button', { name: 'Save result for Private Person' }).click();
  await expect(admin.getByRole('complementary', { name: 'Winners preview' })).toContainText('Athlete CR-002');

  const board = pub.getByRole('list', { name: 'Deadlift leaderboard' });
  await expect(board).toContainText('Asha Rao');
  await expect(board).toContainText('140 kg');
  await expect(board).toContainText('Athlete CR-002');     // opted out of showing their name
  await expect(board).not.toContainText('Private Person');
  await expect(board.locator('li').first()).toContainText('Athlete CR-002'); // 150 beats 140
});

test('results stay private until published, then the podium appears', async ({ browser }) => {
  const admin = await adminPage(browser);
  const pub = await browser.newPage();
  await pub.goto(`/events/${SLUG}`);

  await admin.goto(`/admin/events/${eventId}/live`);
  await admin.getByRole('button', { name: 'Complete event' }).click();
  await admin.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(pub.getByRole('heading', { name: /results aren’t in yet/i })).toBeVisible();
  await expect(pub.getByRole('list', { name: 'Deadlift leaderboard' })).toHaveCount(0);

  await admin.goto(`/admin/events/${eventId}?tab=results`);
  await admin.getByRole('button', { name: 'Publish results' }).first().click();
  await admin.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(admin.getByText('Results published', { exact: true }).first()).toBeVisible();

  await expect(pub.getByRole('heading', { name: 'The results' })).toBeVisible();
  await expect(pub.getByText('Results are in').first()).toBeVisible();
  const podium = pub.locator('#results');
  await expect(podium).toContainText('Athlete CR-002');
  await expect(podium).toContainText('150 kg');
  await expect(podium).toContainText('Asha Rao');
  await expect(podium).not.toContainText('+91');
});

test('admin uploads a photo, publishes it and it appears in "The day"', async ({ browser }) => {
  const admin = await adminPage(browser);
  const pub = await browser.newPage();
  await pub.goto(`/events/${SLUG}`);
  await expect(pub.getByText('The camera is ready.')).toBeVisible();

  await admin.goto(`/admin/events/${eventId}?tab=media`);
  await expect(admin.locator('li').filter({ hasText: 'Cover' })).toHaveCount(1);   // the wizard's cover upload
  await admin.getByLabel('Upload photos or videos').setInputFiles({ name: 'podium.png', mimeType: 'image/png', buffer: PNG });
  await expect(admin.getByText('Hidden', { exact: true })).toHaveCount(2);
  await admin.getByRole('button', { name: 'Show on website' }).last().click();
  await expect(admin.getByText('On website', { exact: true })).toHaveCount(1);

  await pub.reload();
  await expect(pub.getByRole('button', { name: /View larger/ })).toHaveCount(1);
  await pub.getByRole('button', { name: /View larger/ }).click();
  await expect(pub.getByRole('dialog')).toBeVisible();
  await pub.keyboard.press('Escape');
  await expect(pub.getByRole('dialog')).toBeHidden();
});

test('the activity log records every step', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.goto(`/admin/events/${eventId}?tab=activity`);
  const log = admin.getByRole('list', { name: 'Activity log' });
  for (const a of ['Event created', 'Event details updated', 'Registration opened', 'Registration closed', 'Check-in started',
    'Participant checked in', 'Competition started', 'Result entered', 'Event completed', 'Results published', 'Photo uploaded', 'Media published']) {
    await expect(log).toContainText(a);
  }
  await expect(log).toContainText(ADMIN.email);
});

test('archive: the event moves into Past events', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.goto(`/admin/events/${eventId}`);
  await admin.getByRole('button', { name: 'Archive event' }).click();
  await expect(admin.getByText('Archived', { exact: true }).first()).toBeVisible();
  const pub = await browser.newPage();
  await pub.goto('/events');
  await expect(pub.getByRole('heading', { name: 'Past events' })).toBeAttached();
  await expect(pub.locator('#past')).toContainText(TITLE);
  await pub.goto(passUrl);
  await expect(pub.getByText('Past event').first()).toBeVisible();
});

test('events live inside the admin layout, with the shared sidebar', async ({ browser }) => {
  const admin = await adminPage(browser);
  const nav = admin.getByRole('navigation', { name: 'Admin' });
  await expect(nav.getByRole('link', { name: /Events & competitions/ })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: /Blog Posts/ }).click();
  await expect(admin).toHaveURL(/\/admin\/dashboard\?tab=posts$/);
  await expect(admin.getByRole('heading', { name: 'Blog Posts' })).toBeVisible();
  await admin.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: /Events & competitions/ }).click();
  await expect(admin).toHaveURL(/\/admin\/events$/);
});

test('admin deletes an event with registrations (name must be typed)', async ({ browser }) => {
  const admin = await adminPage(browser);
  await admin.goto(`/admin/events/${eventId}`);
  await admin.getByRole('button', { name: 'Delete event' }).click();
  const dialog = admin.getByRole('alertdialog');
  await expect(dialog).toContainText('2 registrations');
  const confirm = dialog.getByRole('button', { name: 'Delete permanently' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Type the event name to confirm').fill(TITLE.toLowerCase());
  await confirm.click();
  await expect(admin).toHaveURL(/\/admin\/events$/);
  await expect(admin.getByText(TITLE)).toHaveCount(0);

  const pub = await browser.newPage();
  await pub.goto(`/events/${SLUG}`);
  await expect(pub.getByRole('heading', { name: /isn’t on the floor/i })).toBeVisible();
  await pub.goto(passUrl);
  await expect(pub.getByRole('heading', { name: 'Pass not found' })).toBeVisible();
});

test('no console errors across the flow', () => {
  expect(errors).toEqual([]);
  // cover (wizard) + one gallery upload, both to the site's Cloudinary image endpoint
  expect(cloudinaryUploads).toEqual(['https://api.cloudinary.com/v1_1/dkvlsn98d/image/upload', 'https://api.cloudinary.com/v1_1/dkvlsn98d/image/upload']);
});

