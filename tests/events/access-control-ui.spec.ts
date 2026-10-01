import { test, expect, type Page } from '@playwright/test';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Reception's view of access control: the device's real state and users, "Open Biometric" for a
// trainer or member, and every status taken from what the device reported — including a refusal.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'desktop flows');

const DOCS = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Strength coach' });
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'JJA1254700696', location: '', protocol: 'adms', enabled: true, nextUserId: 900, lastSeenAt: ts(new Date().toISOString()), lastSyncAt: null, firmware: null, lastError: null });
  await seedDoc('gyms/crunch-wakad/devices/dev2', { gymId: 'crunch-wakad', name: 'Back door', model: 'eSSL X2008', serialNumber: 'BACKDOOR01', location: '', protocol: 'adms', enabled: true, nextUserId: 1, lastSeenAt: ts(new Date(Date.now() - 3 * 3600_000).toISOString()), lastSyncAt: null, firmware: null, lastError: null });
  for (const [id, name] of [['7', 'OLD MEMBER'], ['8', 'ANOTHER OLD'], ['9', 'THIRD OLD']]) await seedDoc(`gyms/crunch-wakad/devices/dev1/deviceUsers/${id}`, { deviceUserId: id, name, admin: false, hasCard: false });
  await seedDoc('members/m7', { name: 'Old Member', nameLower: 'old member', phone: '9000000707', phoneKey: '9000000707', status: 'active', membershipEnd: '2099-12-31', activeUntil: '2099-12-31', planId: null, trainerId: null });
  await seedDoc('biometricIdentities/dev1_7', { gymId: 'crunch-wakad', personType: 'member', memberId: 'm7', trainerId: null, deviceId: 'dev1', deviceUserId: '7', method: 'fingerprint', status: 'SYNCED' });   // old system
});

test('the device card shows its real state, its users by who manages them, and an offline device as offline', async ({ page }) => {
  await login(page);
  await page.goto('/admin/access');
  const main = page.getByRole('region', { name: 'Device Main entrance' });
  await expect(main).toContainText('Online');
  await expect(main).toContainText('JJA1254700696');
  const stat = (label: string) => main.locator('div', { has: page.getByText(label, { exact: true }) }).locator('dd');
  await expect(stat('Users on device')).toHaveText('3');
  await expect(stat('Managed by new CRM')).toHaveText('0');
  await expect(stat('Old system, linked')).toHaveText('1');
  await expect(stat('Not linked')).toHaveText('2');
  await expect(page.getByRole('region', { name: 'Device Back door' })).toContainText('Offline');
  // Sync is a read-only request, shown with its real status
  await main.getByRole('button', { name: 'Sync user list' }).click();
  await expect(main.getByRole('list', { name: 'Device requests' })).toContainText('Send user list');
  await expect(main.getByRole('list', { name: 'Device requests' })).toContainText('Sending…');
});

test('Open Biometric for a trainer: each step is the device’s answer — a refusal shows its code and a retry', async ({ page }) => {
  await login(page);
  await page.goto('/admin/access');
  const main = page.getByRole('region', { name: 'Device Main entrance' });
  await main.getByRole('button', { name: 'Open Biometric' }).click();
  const drawer = page.getByRole('dialog', { name: 'Open Biometric' });
  await drawer.getByRole('group', { name: 'Who' }).getByRole('button', { name: 'Trainer' }).click();
  await drawer.getByRole('list', { name: 'Trainers' }).getByRole('button', { name: /Coach One/ }).click();
  await expect(drawer.getByRole('region', { name: 'Confirm trainer' })).toContainText('Coach One');
  await drawer.getByRole('button', { name: 'Continue' }).click();
  await drawer.getByRole('radio', { name: /Main entrance/ }).click();
  await drawer.getByRole('button', { name: 'Start enrolment' }).click();
  const enrol = drawer.getByRole('region', { name: 'Enrol on device' });
  await expect(enrol).toContainText('Sending…');                                   // waiting for the device to collect it
  await expect(enrol.getByLabel('Device user ID 900')).toBeVisible();              // a new ID, never one already on the device
  await expect(enrol).not.toContainText('Enrolled');
  // The device refuses remote enrolment
  const cmds = await (await fetch(`${DOCS}/gyms/crunch-wakad/devices/dev1/commands`, { headers: owner })).json() as { documents: { name: string; fields: { type: { stringValue: string } } }[] };
  const enrollCmd = cmds.documents.find((d) => d.fields.type.stringValue === 'enroll_fp')!.name.split('/documents/')[1];
  await fetch(`${DOCS}/${enrollCmd}?updateMask.fieldPaths=status&updateMask.fieldPaths=returnCode`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { status: { stringValue: 'failed' }, returnCode: { stringValue: '-1002' } } }) });
  await expect(enrol).toContainText('Failed');
  await expect(enrol).toContainText('code -1002');
  await expect(enrol).toContainText('enrol user ID 900 on the device itself');
  await expect(enrol.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('trainer profile → Biometric: the same facts, and an accepted request is not “enrolled” until the device confirms', async ({ page }) => {
  await login(page);
  await page.goto('/admin/trainers/T1?tab=access');
  const panel = page.getByRole('region', { name: 'Biometric access' });
  await expect(panel).toContainText('900');
  await expect(panel).toContainText('New CRM');
  await expect(panel).toContainText('Enabled');
  await fetch(`${DOCS}/biometricIdentities/dev1_900?updateMask.fieldPaths=enrollment`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { enrollment: { stringValue: 'device_accepted' } } }) });
  await page.reload();
  await expect(panel).toContainText('Device is enrolling — waiting for the fingerprint');
  await fetch(`${DOCS}/biometricIdentities/dev1_900?updateMask.fieldPaths=enrollment&updateMask.fieldPaths=enrollmentEvidence`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { enrollment: { stringValue: 'confirmed' }, enrollmentEvidence: { stringValue: 'fingerprint_template_reported' } } }) });
  await page.reload();
  await expect(panel).toContainText('Enrolled (confirmed by the device)');
  // Turning access off is recorded and explained — it doesn't pretend to lock the door
  await panel.getByRole('button', { name: 'Disable access' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('The door itself is opened by the device');
  await page.getByRole('button', { name: 'Yes, continue' }).click();
  await expect(panel).toContainText('Disabled');
  await page.goto('/admin/activity');
  await expect(page.getByRole('list', { name: 'Activity log' })).toContainText('Access turned off');
});

test('header “Open door”: one click, on every admin page; “released” only when the device answers; offline sends nothing', async ({ page }) => {
  await login(page);
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'JJA1254700696', location: '', protocol: 'adms', enabled: true, nextUserId: 901, lastSeenAt: ts(new Date().toISOString()), lastSyncAt: null, firmware: null, lastError: null });
  await page.goto('/admin/members');
  const button = page.getByRole('button', { name: 'Open door' });
  await expect(button).toBeVisible();
  await page.goto('/admin/trainers');
  await expect(button).toBeVisible();
  await button.click();                                                               // no dialog, no form, no confirmation
  await expect(button).toContainText('Opening…');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  const cmds = async () => ((await (await fetch(`${DOCS}/gyms/crunch-wakad/devices/dev1/commands`, { headers: owner })).json()) as { documents: { name: string; fields: Record<string, { stringValue?: string }> }[] }).documents.filter((d) => d.fields.type.stringValue === 'unlock_door');
  await expect.poll(async () => (await cmds()).length).toBe(1);
  const [cmd] = await cmds();
  expect(cmd.fields.deviceUserId).toBeUndefined();                                    // the door, not a person
  expect(cmd.fields.status.stringValue).toBe('queued');
  await page.waitForTimeout(1500);
  await expect(button).not.toContainText('Door released');                            // queued is not opened
  // The device answers Return=0 (as the relay records it)
  const path = cmd.name.split('/documents/')[1];
  await fetch(`${DOCS}/${path}?updateMask.fieldPaths=status&updateMask.fieldPaths=returnCode`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { status: { stringValue: 'done' }, returnCode: { stringValue: '0' } } }) });
  await expect(button).toContainText('Door released');
  // A refusal shows the device's code
  await expect(button).not.toContainText('Door released', { timeout: 8000 });
  await button.click();
  await expect.poll(async () => (await cmds()).filter((d) => d.fields.status.stringValue === 'queued').length).toBe(1);
  const second = (await cmds()).find((d) => d.fields.status.stringValue === 'queued')!.name.split('/documents/')[1];
  await fetch(`${DOCS}/${second}?updateMask.fieldPaths=status&updateMask.fieldPaths=returnCode`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: { status: { stringValue: 'failed' }, returnCode: { stringValue: '-1' } } }) });
  await expect(button).toContainText('Not opened (code -1)');
  // Device out of touch: nothing is queued (it must never open later, unexpectedly)
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', serialNumber: 'JJA1254700696', location: '', protocol: 'adms', enabled: true, nextUserId: 901, lastSeenAt: ts(new Date(Date.now() - 3 * 3600_000).toISOString()), lastSyncAt: null, firmware: null, lastError: null });
  await expect(button).not.toContainText('Not opened', { timeout: 10000 });
  await button.click();
  await expect(button).toContainText('Device offline');
  expect(await cmds()).toHaveLength(2);
  await page.goto('/admin/activity');
  await expect(page.getByRole('list', { name: 'Activity log' })).toContainText('Door release requested');
});
