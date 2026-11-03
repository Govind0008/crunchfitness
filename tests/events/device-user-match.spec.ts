import { test, expect, type Page } from '@playwright/test';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Linking the old system's device users to CRM members in bulk: "Find matches by name" suggests the
// member with EXACTLY the device's name — only when one member and one device user have it — with
// phone and expiry shown; staff tick and link (scans become visits; access stays with the old
// system until staff take them over). A shared name,
// a similar name, or a member already linked is never suggested.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'admin flow, runs once');

const docs = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
const member = (id: string, name: string, phone: string, end: string) => seedDoc(`members/${id}`, {
  name, nameLower: name.toLowerCase(), phone, phoneKey: phone, email: '', emailLower: '', planId: null, membershipStart: '2026-01-01', membershipEnd: end,
  status: 'active', activeUntil: end, trainerId: null, trainerClient: null, notes: '', source: 'legacy_excel',
});
const deviceUser = (id: string, name: string) => seedDoc(`gyms/crunch-wakad/devices/devX/deviceUsers/${id}`, { deviceUserId: id, name, admin: false, hasCard: false });

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('gyms/crunch-wakad/devices/devX', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'JJA1254700696', location: '', protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null });
  await deviceUser('10039', 'devidas Sonawane');      // exact name (other case) → suggested
  await deviceUser('3120', 'Priya  Shah');            // exact name (extra space) → suggested
  await deviceUser('2201', 'Rahul Patil');            // two members called Rahul Patil → staff choose
  await deviceUser('2202', 'Sam K');                  // similar to "Sam Kulkarni" only → nothing
  await deviceUser('2203', 'Old Linked');             // that member is already linked to another ID → nothing
  await member('m1', 'Devidas Sonawane', '9000000101', '2099-12-31');
  await member('m2', 'Priya Shah', '9000000102', '2020-01-31');
  await member('m3', 'Rahul Patil', '9000000103', '2099-12-31');
  await member('m4', 'Rahul Patil', '9000000104', '2099-12-31');
  await member('m5', 'Sam Kulkarni', '9000000105', '2099-12-31');
  await member('m6', 'Old Linked', '9000000106', '2099-12-31');
  await seedDoc('biometricIdentities/devX_777', { gymId: 'crunch-wakad', personType: 'member', memberId: 'm6', trainerId: null, deviceId: 'devX', deviceUserId: '777', method: 'fingerprint', status: 'SYNCED' });
});

test('find matches by name → tick → linked (old system keeps access); shared or similar names are never suggested', async ({ page }) => {
  await login(page);
  await page.goto('/admin/settings/access/devX/users');
  await page.getByRole('button', { name: 'Find matches by name' }).click();
  await expect(page.getByRole('status')).toContainText('2 device users have a member with exactly the same name');
  const list = page.getByRole('list', { name: 'Device users' });
  await expect(list.getByRole('listitem')).toHaveCount(2);                              // the "Suggested" view
  await expect(list.getByRole('listitem').filter({ hasText: '#10039' })).toContainText('Devidas Sonawane');
  await expect(list.getByRole('listitem').filter({ hasText: '#3120' })).toContainText('expired');   // phone and expiry to check

  await page.getByRole('group', { name: 'Filter device users' }).getByRole('button', { name: /Not linked/ }).click();
  await expect(list.getByRole('listitem').filter({ hasText: '#2201' })).toContainText('Several people share this name');
  await expect(list.getByRole('listitem').filter({ hasText: '#2202' })).toContainText('Not linked');
  await expect(list.getByRole('listitem').filter({ hasText: '#2203' })).toContainText('Not linked');
  await page.getByRole('group', { name: 'Filter device users' }).getByRole('button', { name: /Suggested/ }).click();

  // Only what staff tick is linked
  await page.getByLabel('Link #10039 to Devidas Sonawane').check();
  await page.getByRole('button', { name: 'Link 1' }).click();
  await expect(page.getByRole('status')).toContainText('Linked 1 device users to their members');
  const id = await (await fetch(`${docs}/biometricIdentities/devX_10039`, { headers: { Authorization: 'Bearer owner' } })).json() as { fields: Record<string, { stringValue?: string }> };
  expect(id.fields).toMatchObject({ memberId: { stringValue: 'm1' }, deviceUserId: { stringValue: '10039' }, managedBy: { stringValue: 'legacy' } });
  expect((await fetch(`${docs}/biometricIdentities/devX_3120`, { headers: { Authorization: 'Bearer owner' } })).status).toBe(404);

  // Tick all the rest
  await page.getByRole('button', { name: 'Tick all shown' }).click();
  await page.getByRole('button', { name: 'Link 1' }).click();
  await expect(page.getByRole('status')).toContainText('Linked 1 device users');
  await page.getByRole('group', { name: 'Filter device users' }).getByRole('button', { name: /Members/ }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByRole('listitem').filter({ hasText: '#3120' })).toContainText('Old system');
});
