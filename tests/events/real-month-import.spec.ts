import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { ADMIN, FS, PROJECT, resetFirestore, seedAdmin } from './emulator';

// The real June 2025 workbook through the import screen (EMULATOR only). It holds members' data, so
// it's never committed: the test runs only where the file is (REAL_MONTH_XLSX). Counts and sums only.
// Checks the PT and Freelancer sheets are used: gym + PT payments split into two payments that add
// up to the sheet's amount, PT packages carry their trainer, freelancer payments go to their client,
// and importing the same file again adds nothing.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'admin flow, runs once');
const FILE = process.env.REAL_MONTH_XLSX ?? '../crunchfitness/2025/JUNE-2025.xlsx';
test.skip(!existsSync(FILE), 'the real workbook is only on the gym’s machine');

const docs = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;
type V = { stringValue?: string; integerValue?: string; nullValue?: null; mapValue?: { fields: Record<string, V> }; booleanValue?: boolean };
async function list(col: string): Promise<Record<string, V>[]> {
  const out: Record<string, V>[] = []; let t = '';
  do {
    const r = await fetch(`${docs}/${col}?pageSize=300${t ? `&pageToken=${t}` : ''}`, { headers: { Authorization: 'Bearer owner' } });
    const j = (await r.json()) as { documents?: { fields: Record<string, V> }[]; nextPageToken?: string };
    out.push(...(j.documents ?? []).map((d) => d.fields)); t = j.nextPageToken ?? '';
  } while (t);
  return out;
}
const legacyField = (f: Record<string, V>, k: string) => f.legacy?.mapValue?.fields[k];
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
async function upload(page: Page) {
  await page.goto('/admin/members/import');
  await page.getByRole('tab', { name: 'From the old member sheet' }).click();
  await page.getByLabel('Old member sheet').setInputFiles(FILE);
}

test.beforeAll(async () => { await resetFirestore(); await seedAdmin(); });

test('June 2025: gym + PT splits, PT trainers, freelancer clients; re-import adds nothing', async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await upload(page);
  await expect(page.getByText(/Also read \(never imported on their own\): “PT-JUNE-25” .* “FREELANCING JUNE-25”/)).toBeVisible();
  const found = page.getByRole('region', { name: 'What was found' });
  await expect(found).toContainText('of 6 gym + PT rows split');
  await page.getByRole('button', { name: 'Import 102 new members · 133 payments' }).click();
  await expect(page.getByRole('status', { name: 'Import complete' })).toBeVisible({ timeout: 120_000 });

  const payments = await list('payments');
  expect(payments).toHaveLength(133);
  // Each split row: a gym part and a PT part that add up to the sheet's amount
  const parts = payments.filter((p) => legacyField(p, 'part'));
  expect(parts.filter((p) => legacyField(p, 'part')!.stringValue === 'pt')).toHaveLength(5);
  const byRow = new Map<string, Record<string, V>[]>();
  for (const p of parts) { const k = String(legacyField(p, 'row')!.integerValue); byRow.set(k, [...(byRow.get(k) ?? []), p]); }
  expect(byRow.size).toBe(5);
  for (const pair of byRow.values()) {
    expect(pair.map((p) => p.paymentType.stringValue).sort()).toEqual(['membership', 'pt']);
    const sum = pair.reduce((n, p) => n + Number(p.amountPaise.integerValue), 0);
    expect(sum).toBe(Number(legacyField(pair[0], 'rowAmountPaise')!.integerValue));
  }
  // PT packages carry the trainer from the PT sheet (or the freelancer)
  const pts = await list('ptPackages');
  expect(pts).toHaveLength(38);
  expect(pts.filter((p) => p.trainerName?.stringValue).length).toBe(35);
  // Freelancer payments: recorded for the client, the freelancer kept as the payer
  const freelance = payments.filter((p) => legacyField(p, 'paidBy'));
  expect(freelance).toHaveLength(3);
  for (const p of freelance) {
    expect(p.paymentType.stringValue).toBe('pt');
    expect(p.memberName.stringValue).not.toBe(legacyField(p, 'paidBy')!.stringValue);
  }
  // Day passes stay payments only
  expect(payments.filter((p) => p.dayPass?.booleanValue)).toHaveLength(14);

  // The same file again: nothing new
  await upload(page);
  await expect(page.getByRole('button', { name: 'Nothing new to import' })).toBeDisabled({ timeout: 30_000 });
  expect(await list('payments')).toHaveLength(133);
});
