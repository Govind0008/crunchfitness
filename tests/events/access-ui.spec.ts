import { test, expect, type Page } from '@playwright/test';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin, seedDoc } from './emulator';

const FS_DOCS = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

// The command-center flows: devices, biometric enrolment (honest statuses only), staff blocks,
// PT as its own lifecycle, "other" payments, member photos, filters and navigation.
test.describe.configure({ mode: 'serial' });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (ymd: string, n: number) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
// A real 1×1 PNG, so the browser can decode and shrink it
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
const member = (id: string, name: string, phone: string, end: string | null) => seedDoc(`members/${id}`, {
  name, nameLower: name.toLowerCase(), phone, phoneKey: phone, email: '', emailLower: '', planId: 'p1', membershipStart: '2026-01-01', membershipEnd: end,
  status: 'active', activeUntil: end ?? '9999-12-31', trainerId: null, trainerClient: null, notes: '', source: 'manual',
});

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await member('ac1', 'Riya Kulkarni', '9000000061', addDays(today, 60));
  await member('ac2', 'Om Pawar', '9000000062', addDays(today, 60));
});

test('devices: add the F22 — it waits for first contact, nothing claims to be online', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await page.goto('/admin/access');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Access control');
  await page.getByRole('link', { name: 'Devices' }).click();
  await page.getByRole('button', { name: 'Add device' }).click();
  await page.getByLabel('Name').fill('Main entrance');
  await page.getByLabel('Serial number').fill('bocd201460001');
  await page.getByRole('form', { name: 'New device' }).getByRole('button', { name: 'Add device' }).click();
  const list = page.getByRole('list', { name: 'Devices' });
  await expect(list).toContainText('Main entrance');
  await expect(list).toContainText('eSSL X2008 · Serial BOCD201460001');
  await expect(list).toContainText('Waiting for first contact');                     // online only once the reader reports it
  await expect(list).toContainText('Never');
  await list.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'hasn’t reported in yet' })).toBeVisible();
});

test('enrolment shows only what the device reports; “Enrolled” needs the device’s confirmation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await page.goto('/admin/members/ac1');
  // Guided, in a drawer: confirm member → choose device → enrol on the device
  await page.getByRole('button', { name: 'Access', exact: true }).click();
  const wiz = page.getByRole('dialog', { name: 'Enroll access' });
  await expect(wiz.getByRole('region', { name: 'Confirm member' })).toContainText('Riya Kulkarni');
  await wiz.getByRole('button', { name: 'Continue' }).click();
  await expect(wiz.getByRole('radio', { name: /Main entrance/ })).toHaveAttribute('aria-checked', 'true');   // the only device
  await expect(wiz.getByRole('radio', { name: /Main entrance/ })).toContainText('Device offline');          // it never connected
  await expect(wiz).not.toContainText('ADMS');                                                               // no protocol talk for staff
  await wiz.getByRole('button', { name: 'Start enrolment' }).click();
  const enrol = wiz.getByRole('region', { name: 'Enrol on device' });
  await expect(enrol).toContainText('Device offline');
  await expect(enrol.getByLabel('Device user ID 1')).toBeVisible();
  await expect(enrol).not.toContainText('Enrolled');
  await expect(enrol.getByRole('button', { name: /Fingerprint saved/ })).toHaveCount(0);                     // no "trust me" button
  // The device confirms (as the relay would record it): only now is it enrolled
  const ids = await (await fetch(`${FS_DOCS}/biometricIdentities`, { headers: { Authorization: 'Bearer owner' } })).json() as { documents: { name: string }[] };
  const path = ids.documents.map((d) => d.name.split('/documents/')[1]).find((n) => n.endsWith('_1'))!;
  // exactly what the relay writes on a fingerprint-verified scan (api/_lib/ingest.ts)
  await fetch(`${FS_DOCS}/${path}?updateMask.fieldPaths=enrollment&updateMask.fieldPaths=enrollmentEvidence&updateMask.fieldPaths=status`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { enrollment: { stringValue: 'confirmed' }, enrollmentEvidence: { stringValue: 'fingerprint_scan' }, status: { stringValue: 'SYNCED' } } }),
  });
  await expect(enrol).toContainText('Enrolled');
  await expect(enrol).toContainText('a scan verified by fingerprint');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Access', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Biometric access' });
  await expect(panel).toContainText('Enrolled (confirmed by the device)');
  await expect(panel).toContainText('New CRM');
  await expect(panel.getByRole('button', { name: 'Re-enroll' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Disable access' })).toBeVisible();
  // An old-system member: their existing ID is linked for attendance only, and it can't be given twice
  await page.goto('/admin/members/ac2');
  await page.getByRole('button', { name: 'Access', exact: true }).click();
  const wiz2 = page.getByRole('dialog', { name: 'Enroll access' });
  await wiz2.getByRole('button', { name: 'Continue' }).click();
  await wiz2.getByLabel(/Already on the device/).check();
  await wiz2.getByLabel('User ID on the device').fill('1');
  await wiz2.getByRole('button', { name: 'Link user ID' }).click();
  await expect(wiz2.getByRole('alert')).toContainText('Device user 1 is already linked to someone on Main entrance');
  await wiz2.getByLabel('User ID on the device').fill('207');
  await wiz2.getByRole('button', { name: 'Link user ID' }).click();
  await expect(wiz2.getByLabel('Device user ID 207')).toBeVisible();
  await expect(wiz2.getByRole('region', { name: 'Enrol on device' })).toContainText('old system still controls their access');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Access', exact: true }).click();
  const legacy = page.getByRole('region', { name: 'Biometric access' });
  await expect(legacy).toContainText('Old system');
  await expect(legacy).toContainText('Controlled by the old system');
  await expect(legacy.getByRole('button', { name: 'Disable access' })).toHaveCount(0);                       // never switched off by the new CRM
  await expect(legacy.getByRole('button', { name: 'Re-enroll' })).toHaveCount(0);
  await expect(legacy.getByRole('button', { name: 'Manage access in the new CRM' })).toBeVisible();         // only by an explicit step
  // Search finds a member by device user ID
  await page.getByRole('combobox', { name: /Search members/ }).fill('207');
  await expect(page.getByRole('option', { name: /Om Pawar/ })).toContainText('Device user 207');
});

test('a staff block stops access despite an active membership, and can be lifted', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await page.goto('/admin/members/ac1?tab=access');
  const ac = page.getByRole('region', { name: 'Access control' });
  await expect(ac).toContainText('ALLOWED');
  await ac.getByLabel('Stop access').fill('Card shared with a friend');
  await ac.getByRole('button', { name: 'Block member' }).click();
  await expect(ac).toContainText('NOT ALLOWED');
  await expect(ac).toContainText('Blocked by staff — Card shared with a friend');
  await page.goto('/admin/members?filter=access_disabled');
  await expect(page.getByRole('main')).toContainText('Riya Kulkarni');
  await page.goto('/admin/members/ac1?tab=access');
  await page.getByRole('button', { name: 'Enable access' }).click();
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(page.getByRole('region', { name: 'Access control' })).toContainText('ALLOWED');
});

test('PT is its own lifecycle: package → sessions → PT payment; the membership is untouched', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await page.goto('/admin/members/ac2?tab=pt');
  await page.getByRole('button', { name: 'Add PT package' }).click();
  const form = page.getByRole('form', { name: 'New PT package' });
  await form.getByLabel('Package').fill('1 Month PT');
  await expect(form.getByLabel('Ends')).not.toHaveValue('');                                        // one month, from the name
  await form.getByLabel('Trainer').selectOption({ label: 'Coach One' });
  await form.getByLabel('Sessions').fill('10');
  await form.getByRole('button', { name: 'Save PT package' }).click();
  const pkgs = page.getByRole('list', { name: 'PT packages' });
  await expect(pkgs).toContainText('Not paid yet');
  await pkgs.getByRole('button', { name: 'Log a session' }).click();
  await expect(pkgs).toContainText('1 used · 9 left of 10');
  await pkgs.getByRole('button', { name: 'Record PT payment' }).click();
  const payPt = page.getByRole('dialog', { name: 'Collect payment' });
  await expect(payPt.getByRole('radio', { name: /Personal training/ })).toHaveAttribute('aria-checked', 'true');
  await expect(payPt.getByLabel('PT package', { exact: true })).not.toHaveValue('');               // the package is preselected
  await payPt.getByLabel('Amount received (₹)').fill('6000');
  await payPt.getByRole('button', { name: /Collect PT payment · ₹6,000/ }).click();
  await payPt.getByRole('link', { name: 'View receipt' }).click();
  await page.waitForURL(/\/admin\/payments\/[\w]+\?new=1$/);
  await expect(page.getByRole('article', { name: /Receipt CR-R-/ })).toContainText('Personal training — 1 Month PT');
  await page.goto('/admin/members/ac2?tab=pt');
  await expect(page.getByRole('list', { name: 'PT packages' })).toContainText('Paid');
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText('Active · Coach One');
  await expect(page.locator('dl[aria-label="Member summary"]')).toContainText(new Date(`${addDays(today, 60)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
  await page.goto('/admin/members?filter=pt');
  await expect(page.getByRole('main')).toContainText('Om Pawar');
});

test('other payments carry a category; revenue keeps membership, PT and other apart', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await page.goto('/admin/payments/new?member=ac1&type=other');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Collect payment');
  await page.getByLabel('Category').selectOption('Locker');
  await page.getByLabel('Amount received (₹)').fill('500');
  await page.getByRole('button', { name: /Collect other payment · ₹500/ }).click();
  await page.waitForURL(/\/admin\/payments\/[\w]+\?new=1$/);
  await expect(page.getByRole('article', { name: /Receipt CR-R-/ })).toContainText('Locker');
  await page.goto('/admin/revenue');
  const row = page.getByRole('table', { name: 'Revenue by type' }).getByRole('row', { name: /This month/ });
  await expect(row).toContainText('₹6,000');                                                          // the PT payment
  await expect(row).toContainText('₹500');                                                            // the locker
  await expect(row).toContainText('₹6,500');                                                          // total
});

test('member photo: private upload, shown as the avatar', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await page.goto('/admin/members/ac1/edit');
  await page.getByLabel('Member photo').setInputFiles({ name: 'riya.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(/\/admin\/members\/ac1$/);
  await expect(page.locator('img[src*="members%2Fac1%2Fphoto"]').first()).toBeVisible();
});

test('dashboard: access widget, attention and quick actions from real records', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  await login(page);
  await expect(page.getByRole('region', { name: 'Today at a glance' })).toContainText('Today’s collection');
  await expect(page.getByRole('region', { name: 'Needs attention' })).toContainText('biometric enrolment is waiting for the device');
  const acc = page.getByRole('region', { name: 'Access control' });
  await expect(acc).toContainText('0 / 1');
  await expect(acc).toContainText('enrolment');
  await expect(page.getByRole('region', { name: 'Recent activity' })).toContainText('Payment recorded');
});

test('navigation: grouped sidebar collapses; phones get the bottom bar', async ({ page, isMobile }) => {
  await login(page);
  if (isMobile) {
    const bar = page.getByRole('navigation', { name: 'Quick navigation' });
    for (const l of ['Home', 'Members', 'Attendance', 'Payments']) await expect(bar.getByRole('link', { name: l })).toBeVisible();
    await bar.getByRole('link', { name: 'Attendance' }).click();
    await expect(page).toHaveURL(/\/admin\/attendance$/);
    await bar.getByRole('button', { name: 'More sections' }).click();
    const menu = page.getByRole('navigation', { name: 'Admin' });
    await expect(menu.getByRole('link', { name: 'Access' })).toBeVisible();
    await menu.getByRole('button', { name: 'More' }).click();
    await expect(menu.getByRole('link', { name: 'Reports' })).toBeVisible();
    return;
  }
  const nav = page.getByRole('navigation', { name: 'Admin' });
  // Secondary pages are tucked under "More"
  const blog = nav.getByRole('link', { name: 'Blog' });
  if (await blog.count()) await nav.getByRole('button', { name: 'More' }).click();
  await expect(blog).toHaveCount(0);
  await nav.getByRole('button', { name: 'More' }).click();
  await expect(blog).toBeVisible();
  // Icons-only sidebar, remembered
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  // Command palette
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Command search' }).fill('attendance');
  await page.getByRole('option', { name: /Attendance/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/attendance/);
  // Old URLs still work
  await page.goto('/admin/dashboard?tab=posts');
  await expect(page).toHaveURL(/\/admin\/blog$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blog');
});

test('match device users: the device’s user list, each link chosen by staff — never by a similar name', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop');
  // What the access reader on the gym PC uploads: the device and its own user list
  await seedDoc('gyms/crunch-wakad/devices/devM', { gymId: 'crunch-wakad', name: 'Gym door', model: 'eSSL X2008', serialNumber: 'JJA1254700696', location: '', protocol: 'sdk', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  await seedDoc('gyms/crunch-wakad/devices/devM/deviceUsers/501', { deviceUserId: '501', name: 'MEERA I', admin: false, hasCard: false });
  await seedDoc('gyms/crunch-wakad/devices/devM/deviceUsers/502', { deviceUserId: '502', name: 'ZZ NOBODY', admin: false, hasCard: false });
  await member('mm1', 'Meera Iyer', '9000000501', '2099-12-31');
  await login(page);
  await page.goto('/admin/settings/access/devM/users');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Match device users');
  const list = page.getByRole('list', { name: 'Device users' });
  const meera = list.getByRole('listitem').filter({ hasText: '#501' });
  await expect(meera).not.toContainText('Meera Iyer');                                  // a similar name is not a link
  await expect(page.getByRole('button', { name: /suggested/i })).toHaveCount(0);
  await expect(list.getByRole('listitem').filter({ hasText: '#502' })).toContainText('Not linked');
  await meera.getByRole('button', { name: 'Choose member' }).click();
  const picker = page.getByRole('dialog', { name: 'Device user #501' });
  await picker.getByLabel('Which member is this?').fill('Meera');
  await picker.getByRole('list', { name: 'Matching members' }).getByRole('button', { name: /Meera Iyer/ }).click();
  await expect(list.getByRole('listitem').filter({ hasText: '#501' })).toHaveCount(0);   // done: it leaves "Not linked"
  await page.getByRole('group', { name: 'Filter device users' }).getByRole('button', { name: /Members/ }).click();
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByRole('listitem').filter({ hasText: '#501' })).toContainText('Old system');                      // an existing device user stays the old system's
  await expect(list.getByRole('listitem').filter({ hasText: '#501' })).toContainText('Not confirmed by the device yet');
});
