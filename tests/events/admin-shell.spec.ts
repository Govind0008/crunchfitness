import { test, expect, type Page } from '@playwright/test';
import { ADMIN, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The admin behaves like an application frame: header and sidebar stay put, <main> is the one
// page scroll, data pages keep their toolbar and pagination on screen and scroll their table
// instead, nothing scrolls sideways — in both themes, from a 1024×768 laptop to 1920×1080, at
// 125% / 150% browser zoom (a smaller CSS viewport), and on a 390px phone.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'drives its own viewports');

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const SHOTS = process.env.SHOTS_DIR;
const at = (min: number) => new Date(Date.parse(`${today}T06:00:00+05:30`) + min * 60_000).toISOString();

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900@125', width: 1152, height: 720 },     // 1440×900 at 125% zoom
  { name: '1440x900@150', width: 960, height: 600 },      // 1440×900 at 150% zoom
  { name: '390x844', width: 390, height: 844 },
];
// Data pages: from 1024px wide the page itself doesn't scroll; the data region does
const PAGES: { path: string; name: string; data?: boolean }[] = [
  { path: '/admin', name: 'dashboard' },
  { path: '/admin/members', name: 'members', data: true },
  { path: '/admin/members/sm01', name: 'member-profile' },
  { path: '/admin/members/sm01?tab=attendance', name: 'member-attendance' },
  { path: '/admin/payments', name: 'payments', data: true },
  { path: '/admin/attendance', name: 'attendance', data: true },
  { path: '/admin/access?tab=activity', name: 'access-activity', data: true },
  { path: '/admin/trainers?tab=attendance', name: 'trainer-attendance', data: true },
  { path: '/admin/activity', name: 'activity-log', data: true },
  { path: '/admin/payments/dues', name: 'dues' },
  { path: '/admin/enquiries', name: 'enquiries' },
  { path: '/admin/settings', name: 'settings' },
];

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
const settle = async (page: Page) => {
  await expect(page.getByRole('status', { name: /^Loading/ })).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(400);
};

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await seedDoc('teamMembers/T2', { name: 'Coach Two', role: 'Strength coach' });
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'SN1', protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null });
  const names = ['Aarav Shah', 'Diya Patil', 'Kabir Rao', 'Isha Kulkarni', 'Rohan Deshmukh', 'Meera Joshi', 'Arjun Nair', 'Sara Khan', 'Vivaan Gupta', 'Anaya Iyer'];
  for (let i = 1; i <= 64; i++) {
    const id = `sm${String(i).padStart(2, '0')}`;
    const name = `${names[i % 10]} ${i}`;
    const end = i % 7 === 0 ? '2026-01-01' : '2099-12-31';
    await seedDoc(`members/${id}`, {
      name, nameLower: name.toLowerCase(), phone: `90000${String(10000 + i)}`, phoneKey: `90000${String(10000 + i)}`, email: '', emailLower: '', planId: 'p1',
      membershipStart: '2026-01-01', membershipEnd: end, status: 'active', activeUntil: end, trainerId: i % 3 ? 'T1' : null, trainerClient: null, notes: '', source: 'manual',
    });
    if (i <= 40) {
      await seedDoc(`checkins/${today}_${id}`, { gymId: 'crunch-wakad', memberId: id, memberName: name, memberPhoneKey: `90000${String(10000 + i)}`, date: today, method: 'biometric', sources: ['biometric'], by: 'adms-relay',
        deviceId: 'dev1', deviceUserId: String(i), at: ts(at(i * 3)), lastAt: ts(at(i * 3 + 60)), eventIds: [`ev${i}a`, `ev${i}b`], punchCount: 2 });
      for (const [k, m] of [['a', 0], ['b', 60]] as const) await seedDoc(`accessEvents/ev${i}${k}`, { gymId: 'crunch-wakad', deviceId: 'dev1', deviceUserId: String(i), personType: 'member', memberId: id, trainerId: null, at: at(i * 3 + m), result: 'granted', reason: '', verify: 'fingerprint', statusCode: '0', localDate: today, attendanceRef: `checkins/${today}_${id}`, source: 'adms-relay' });
    }
    await seedDoc(`payments/pay${i}`, { receiptNo: `CR-R-${String(i).padStart(4, '0')}`, receiptSeq: i, amountPaise: 300000, countedPaise: 300000, paidOn: today, status: 'paid', memberId: id, memberName: name, method: i % 2 ? 'upi' : 'cash', paymentType: 'membership', createdAt: ts(at(i)) });
  }
  await seedDoc(`trainerAttendance/${today}_T1`, { gymId: 'crunch-wakad', trainerId: 'T1', trainerName: 'Coach One', date: today, punchCount: 1, firstAt: ts(at(0)), lastAt: null, checkoutAt: null, durationMs: null, status: 'MISSING_CHECKOUT', exceptions: [] });
  for (let i = 0; i < 80; i++) await seedDoc(`activity/s${String(i).padStart(2, '0')}`, { action: 'Payment recorded', actorUid: 'x', actorEmail: 'desk@crunch.test', refType: 'member', refId: 'sm01', meta: { name: 'Aarav Shah 1', amount: '₹3,000' }, at: ts(new Date(Date.now() - i * 60_000).toISOString()) });
  await seedDoc('enquiries/e1', { name: 'Lead Person', phone: '9000000077', email: '', plan: '3 Months', message: 'Interested', status: 'new', read: false, submittedAt: ts(new Date().toISOString()) });
});

for (const theme of ['dark', 'light'] as const) {
  test(`${theme}: frame, scrolling and fit across viewports`, async ({ page }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon|net::ERR/.test(m.text())) errors.push(`${page.url()} ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((t) => { try { localStorage.setItem('crunch.admin.theme', t); } catch { /* */ } }, theme);
    await login(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const wide = vp.width >= 1024;
      for (const pg of PAGES) {
        await page.goto(pg.path);
        await settle(page);
        const m = await page.evaluate(() => {
          const main = document.querySelector('main')!;
          const doc = document.documentElement;
          const nav = [...document.querySelectorAll('nav[aria-label$=" pages"]')].at(-1)?.getBoundingClientRect();
          const text = document.body.innerText;
          return {
            docScrolls: doc.scrollHeight > window.innerHeight + 1,
            sideways: doc.scrollWidth > doc.clientWidth + 1 || main.scrollWidth > main.clientWidth + 1,
            mainScrolls: main.scrollHeight > main.clientHeight + 1,
            navBottom: nav ? nav.bottom : null,
            bad: /\b(undefined|NaN)\b|\[object Object\]/.test(text),
            culprits: [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > window.innerHeight + 1 && getComputedStyle(el).position !== 'static'; })
              .slice(0, 5).map((el) => `${el.tagName}.${String(el.className).slice(0, 80)} bottom=${Math.round(el.getBoundingClientRect().bottom)}`),
          };
        });
        const where = `${theme} ${vp.name} ${pg.path}`;
        expect(m.docScrolls, `${where}: the document scrolls (only <main> should) ${m.culprits.join(' | ')}`).toBe(false);
        expect(m.sideways, `${where}: scrolls sideways`).toBe(false);
        expect(m.bad, `${where}: shows undefined/NaN`).toBe(false);
        if (pg.data && wide && vp.height >= 720) {
          expect(m.mainScrolls, `${where}: the page scrolls instead of its data region`).toBe(false);
          if (m.navBottom != null) expect(m.navBottom, `${where}: pagination is below the fold`).toBeLessThanOrEqual(vp.height);
        }
        if (SHOTS && ['1920x1080', '1440x900', '1366x768', '1024x768', '390x844'].includes(vp.name)) await page.screenshot({ path: `${SHOTS}/${theme}-${vp.name}-${pg.name}.png` });
      }
    }
    // A long list scrolls inside its region, with the header row still visible
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/admin/members');
    await settle(page);
    const region = page.locator('main .lg\\:overflow-auto').first();
    const scrolled = await region.evaluate((el) => { el.scrollTop = 400; return el.scrollTop; });
    expect(scrolled).toBeGreaterThan(0);
    await expect(page.getByRole('navigation', { name: 'Members pages' })).toBeInViewport();
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('theme follows the system setting live when set to System', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('crunch.admin.theme', 'system'); sessionStorage.setItem('seeded', '1'); } } catch { /* */ } });
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page);
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  await expect.poll(theme).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(theme).toBe('light');                                    // no reload needed
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect.poll(theme).toBe('dark');
  await page.goto('/admin/members');
  await expect.poll(theme).toBe('dark');                                     // every admin page
  expect(await page.evaluate(() => localStorage.getItem('crunch.admin.theme'))).toBe('dark');
});
