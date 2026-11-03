import { test, expect, type Page } from '@playwright/test';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin, seedDoc } from './emulator';

// A live photo at the desk: Chrome's fake camera stands in for the webcam. Take, retake, use,
// save — the member gets a small private JPEG; a refused camera says so and offers upload.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'camera flow runs once');
test.use({ permissions: ['camera'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

const docs = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
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
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('members/cam1', {
    name: 'Neha Joshi', nameLower: 'neha joshi', phone: '9000000771', phoneKey: '9000000771', email: '', emailLower: '', planId: 'p1', membershipStart: '2026-10-01', membershipEnd: '2026-12-31',
    status: 'active', activeUntil: '2026-12-31', trainerId: null, trainerClient: null, notes: '', source: 'manual',
  });
});

test('edit member: take a live photo, retake, use it, save', async ({ page }) => {
  await login(page);
  await page.goto('/admin/members/cam1/edit');
  await page.getByRole('button', { name: 'Take photo' }).click();
  const cam = page.getByRole('dialog', { name: 'Take photo' });
  await expect(cam.getByRole('button', { name: 'Capture' })).toBeVisible();
  await page.screenshot({ path: 'test-results/camera-live.png' });
  await cam.getByRole('button', { name: 'Capture' }).click();
  await expect(cam.getByRole('img', { name: 'Photo just taken' })).toBeVisible();
  await cam.getByRole('button', { name: 'Retake' }).click();                        // the camera comes back
  await cam.getByRole('button', { name: 'Capture' }).click();
  await cam.getByRole('button', { name: 'Use photo' }).click();
  await expect(cam).toBeHidden();
  // The camera is off once the window closes
  expect(await page.evaluate(() => [...document.querySelectorAll('video')].every((v) => !(v.srcObject as MediaStream | null)?.active))).toBe(true);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(/\/admin\/members\/cam1$/);
  await expect(page.locator('img[src^="data:image/jpeg;base64,"]').first()).toBeVisible();
  const stored = await (await fetch(`${docs}/memberPhotos/cam1`, { headers: { Authorization: 'Bearer owner' } })).json();
  expect(Number(stored.fields.size.integerValue)).toBeLessThan(150_000);
  const m = await (await fetch(`${docs}/members/cam1`, { headers: { Authorization: 'Bearer owner' } })).json();
  expect(m.fields.photo.mapValue.fields.path.stringValue).toBe('memberPhotos/cam1');
});

test('add member drawer: the live photo is saved with the new member', async ({ page }) => {
  await login(page);
  await page.goto('/admin/members');
  await page.getByRole('button', { name: /Add member/ }).first().click();
  const form = page.getByRole('form', { name: 'New member' });
  await form.getByRole('button', { name: 'Take photo' }).click();
  const cam = page.getByRole('dialog', { name: 'Take photo' });
  await cam.getByRole('button', { name: 'Capture' }).click();
  await cam.getByRole('button', { name: 'Use photo' }).click();
  await page.screenshot({ path: 'test-results/camera-drawer.png' });
  await form.getByLabel('Full name').fill('Camera Test');
  await form.getByLabel('Mobile number').fill('9000000772');
  await form.getByRole('button', { name: 'Add member' }).click();
  await expect(page.getByRole('status')).toContainText('Camera Test');
  const list = await (await fetch(`${docs}/memberPhotos?pageSize=10`, { headers: { Authorization: 'Bearer owner' } })).json();
  expect(list.documents.length).toBe(2);
});

test('camera refused: a clear message, nothing saved, upload still available', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
  });
  await login(page);
  await page.goto('/admin/members/cam1');
  await page.getByRole('button', { name: 'Take photo' }).click();
  const cam = page.getByRole('dialog', { name: 'Take photo' });
  await expect(cam.getByRole('alert')).toContainText('Camera permission was refused');
  await cam.getByRole('button', { name: 'Close' }).first().click();
  await expect(cam).toBeHidden();
  await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();
});
