import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Attendance in the admin: member visits from fingerprint punches, integrity warnings instead of
// a silent 0, unresolved punches, trainer attendance with manual check-out and leave, paging,
// explicit trainer linking, and the light/dark theme.
test.describe.configure({ mode: 'serial' });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const SHOTS = process.env.SHOTS_DIR;
const at = (hhmm: string, day = today) => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
const member = (id: string, name: string, phone: string) => seedDoc(`members/${id}`, {
  name, nameLower: name.toLowerCase(), phone, phoneKey: phone, email: '', emailLower: '', planId: 'p1', membershipStart: '2026-01-01', membershipEnd: '2099-12-31',
  status: 'active', activeUntil: '2099-12-31', trainerId: null, trainerClient: null, notes: '', source: 'manual',
});
const event = (id: string, extra: Record<string, string | null>) => seedDoc(`accessEvents/${id}`, {
  gymId: 'crunch-wakad', deviceId: 'dev1', verify: 'fingerprint', statusCode: '0', reason: '', source: 'adms-relay', localDate: today, ...extra,
} as Record<string, string | null>);

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await seedDoc('teamMembers/T2', { name: 'Coach Two', role: 'Coach' });
  await seedDoc('teamMembers/T3', { name: 'Coach Three', role: 'Coach' });
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'SN1', protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null });
  await member('am1', 'Riya Kulkarni', '9000000071');
  await member('am2', 'Om Pawar', '9000000072');
  // Riya: two punches today → one visit, recorded by the relay
  await event('ev-r1', { deviceUserId: '11', personType: 'member', memberId: 'am1', trainerId: null, at: at('06:10'), result: 'granted', attendanceRef: `checkins/${today}_am1` });
  await event('ev-r2', { deviceUserId: '11', personType: 'member', memberId: 'am1', trainerId: null, at: at('07:40'), result: 'granted', attendanceRef: `checkins/${today}_am1` });
  await seedDoc(`checkins/${today}_am1`, { gymId: 'crunch-wakad', memberId: 'am1', memberName: 'Riya Kulkarni', memberPhoneKey: '9000000071', date: today, method: 'biometric', sources: ['biometric'], by: 'adms-relay',
    deviceId: 'dev1', deviceUserId: '11', at: ts(at('06:10')), lastAt: ts(at('07:40')), eventIds: ['ev-r1', 'ev-r2'], punchCount: 2 });
  // Om: a punch with no attendance record (stored before attendance existed)
  await event('ev-o1', { deviceUserId: '12', personType: 'member', memberId: 'am2', trainerId: null, at: at('08:00'), result: 'granted', attendanceRef: null });
  // Unlinked device user
  await event('ev-u1', { deviceUserId: '44', personType: 'unknown', memberId: null, trainerId: null, at: at('08:30'), result: 'unknown_user', deviceUserName: 'RAVI K', attendanceRef: null });
  // Trainers today: one checked in only, one completed; T3 no punch
  await seedDoc(`trainerAttendance/${today}_T1`, { gymId: 'crunch-wakad', trainerId: 'T1', trainerName: 'Coach One', date: today, punches: [Date.parse(at('06:00'))], punchCount: 1, firstAt: ts(at('06:00')), lastAt: null, checkoutAt: null, durationMs: null, status: 'MISSING_CHECKOUT', exceptions: [] });
  await seedDoc(`trainerAttendance/${today}_T2`, { gymId: 'crunch-wakad', trainerId: 'T2', trainerName: 'Coach Two', date: today, punchCount: 3, firstAt: ts(at('05:45')), lastAt: ts(at('13:15')), checkoutAt: ts(at('13:15')), durationMs: 27_000_000, status: 'COMPLETED', exceptions: [] });
  await seedDoc('gyms/crunch-wakad/devices/dev1/deviceUsers/44', { deviceUserId: '44', name: 'RAVI K', admin: false, hasCard: false });
  await seedDoc('gyms/crunch-wakad/devices/dev1/deviceUsers/45', { deviceUserId: '45', name: 'Coach Three', admin: false, hasCard: false });
  // Enough activity entries for two pages
  for (let i = 0; i < 60; i++) await seedDoc(`activity/a${String(i).padStart(2, '0')}`, { action: `Seeded entry ${i}`, actorUid: 'x', actorEmail: 'staff@crunch.test', refType: 'member', refId: null, meta: {}, at: ts(new Date(Date.now() - i * 60_000).toISOString()) });
});

test('member profile: visits come from attendance records; punches missing from attendance are flagged, never a silent 0', async ({ page }) => {
  await login(page);
  await page.goto('/admin/members/am1?tab=attendance');
  const sum = page.getByLabel('Attendance summary').getByRole('definition').first();
  await expect(page.getByLabel('Attendance summary')).toContainText('This month');
  await expect(sum).toHaveText('1');
  await expect(page.getByLabel('Attendance summary')).toContainText('Total visits');
  const list = page.getByRole('list', { name: 'Attendance history' });
  await expect(list.getByRole('listitem')).toHaveCount(1);                              // two punches, one visit
  await expect(list).toContainText('Fingerprint');
  await expect(list).toContainText('2 punches');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await shot(page, 'member-attendance-dark');

  await page.goto('/admin/members/am2?tab=attendance');
  const warn = page.getByRole('alert').filter({ hasText: 'Attendance processing issue' });
  await expect(warn).toContainText('1 fingerprint punch');
  await expect(warn.getByRole('link', { name: /Review and repair/ })).toHaveAttribute('href', '/admin/access?tab=integrity');
});

test('attendance page: one row per visit, with its source; the fingerprint filter', async ({ page }) => {
  await login(page);
  await page.goto('/admin/attendance');
  const visits = page.getByRole('list', { name: 'Visits' });
  await expect(visits).toContainText('Riya Kulkarni');
  await expect(visits.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Front desk' }).click();
  await expect(page.getByText('No visits yet today')).toBeVisible();
  await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: 'Fingerprint' }).click();
  await expect(visits).toContainText('Riya Kulkarni');
  await shot(page, 'attendance-dark');
});

test('access activity: every punch with who it resolved to; unresolved ones filterable', async ({ page }) => {
  await login(page);
  await page.goto('/admin/access?tab=activity');
  const list = page.getByRole('list', { name: 'Access activity' });
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await expect(list).toContainText('“RAVI K” on the device');
  await page.getByRole('group', { name: 'Whose punches' }).getByRole('button', { name: 'Unresolved' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByRole('link', { name: 'Link this user' })).toBeVisible();
  await shot(page, 'access-activity-dark');
});

test('trainers → attendance: counts, statuses, manual check-out with a reason', async ({ page }) => {
  await login(page);
  await page.goto('/admin/trainers?tab=attendance');
  const summary = page.getByLabel('Attendance summary');
  await expect(summary).toContainText('Present today2');
  await expect(summary).toContainText('Completed1');
  await expect(summary).toContainText('Missing check-out1');
  await expect(summary).toContainText('No attendance recorded1');
  const list = page.getByRole('list', { name: 'Trainer attendance' });
  await expect(list.getByRole('listitem').filter({ hasText: 'Coach Three' })).toContainText('No attendance recorded');
  await expect(list).not.toContainText(/absent/i);
  await shot(page, 'trainer-attendance-dark');
  await list.getByRole('listitem').filter({ hasText: 'Coach One' }).getByRole('button', { name: 'Add check-out' }).click();
  const drawer = page.getByRole('dialog', { name: 'Add check-out' });
  await drawer.getByLabel('Left at').fill('05:00');
  await drawer.getByLabel('Reason').fill('Forgot to punch out');
  await drawer.getByRole('button', { name: 'Add check-out' }).click();
  await expect(drawer.getByRole('alert')).toContainText('after the check-in');           // 05:00 is before 06:00
  await drawer.getByLabel('Left at').fill('14:00');
  await drawer.getByRole('button', { name: 'Add check-out' }).click();
  await expect(drawer).toBeHidden();
  await expect(list.getByRole('listitem').filter({ hasText: 'Coach One' })).toContainText('Check-out added by staff');
  await expect(summary).toContainText('Completed2');
});

test('trainer profile: attendance by day and leave', async ({ page }) => {
  await login(page);
  await page.goto('/admin/trainers/T1?tab=leave');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Coach One');
  await page.getByRole('button', { name: 'Record leave' }).click();
  const drawer = page.getByRole('dialog', { name: 'Record leave' });
  await drawer.getByLabel('First day').fill('2030-01-10');
  await drawer.getByLabel('Last day').fill('2030-01-12');
  await drawer.getByLabel('Type').selectOption('sick');
  await drawer.getByRole('button', { name: 'Record leave' }).click();
  await expect(page.getByRole('list', { name: 'Leave' })).toContainText('Sick');
  await page.getByRole('tab', { name: 'Attendance' }).click();
  await expect(page.getByRole('list', { name: 'Attendance by day' }).getByRole('listitem').first()).toContainText('Completed');
  await shot(page, 'trainer-profile-dark');
});

test('match users: a trainer is linked by explicit choice; no bulk name matching', async ({ page }) => {
  await login(page);
  await page.goto('/admin/settings/access/dev1/users');
  await expect(page.getByRole('button', { name: /suggested/i })).toHaveCount(0);
  const row = page.getByRole('list', { name: 'Device users' }).getByRole('listitem').filter({ hasText: '#45' });
  await expect(row).not.toContainText('Suggested');                                       // same name as a trainer — still not matched
  await row.getByRole('button', { name: 'Trainer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Coach Three/ }).click();
  await expect(page.getByRole('status')).toContainText('linked to Coach Three (trainer)');
  await page.getByRole('group', { name: 'Filter device users' }).getByRole('button', { name: /Trainers/ }).click();
  await expect(page.getByRole('list', { name: 'Device users' })).toContainText('Coach Three');
});

test('activity log pages with a cursor: next, previous, page size', async ({ page }) => {
  await login(page);
  await page.goto('/admin/activity');
  const log = page.getByRole('list', { name: 'Activity log' });
  await expect(log.getByRole('listitem')).toHaveCount(50);
  const nav = page.getByRole('navigation', { name: 'Activity log pages' });
  await expect(nav.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next' }).click();
  await expect(nav).toContainText('Showing 51–');                                          // 60 seeded + what earlier tests logged
  expect(await log.getByRole('listitem').count()).toBeLessThan(50);
  await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Previous' }).click();
  await expect(log.getByRole('listitem')).toHaveCount(50);
  await nav.getByLabel('Rows per page').selectOption('25');
  await expect(log.getByRole('listitem')).toHaveCount(25);
  await expect(nav).toContainText('Page 1');
});

test('theme: light is chosen from the account menu, remembered, and never leaks to the public site', async ({ page, isMobile }) => {
  await login(page);
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  await expect.poll(theme).toBe('dark');                                                  // dark by default
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('menuitemradio', { name: 'Light' }).click();
  await expect.poll(theme).toBe('light');
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('main') ?? document.body).backgroundColor);
  await page.reload();
  await expect.poll(theme).toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('crunch.admin.theme'))).toBe('light');
  expect(bg).not.toBe('rgb(10, 10, 11)');
  for (const [path, name] of [['/admin', 'dashboard'], ['/admin/members/am1?tab=attendance', 'member-attendance'], ['/admin/attendance', 'attendance'], ['/admin/access?tab=activity', 'access-activity'], ['/admin/trainers?tab=attendance', 'trainer-attendance'], ['/admin/members', 'members']] as const) {
    await page.goto(path);
    await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
    await page.waitForTimeout(800);                                                      // let the numbers settle for the screenshot
    await shot(page, `${name}-light${isMobile ? '-mobile' : ''}`);
    // Nothing runs off the side of the screen (the shell scrolls inside <main>)
    const overflow = await page.evaluate(() => [document.documentElement, document.querySelector('main')].filter(Boolean).some((el) => el!.scrollWidth > el!.clientWidth + 1));
    expect(overflow, `${path} scrolls sideways`).toBe(false);
  }
  // The public site stays dark
  await page.goto('/');
  await expect.poll(theme).toBeUndefined();
  await page.evaluate(() => localStorage.setItem('crunch.admin.theme', 'dark'));
});
