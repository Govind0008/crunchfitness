import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADMIN, resetFirestore, seedAdmin, seedDoc } from './emulator';

// The receipt PDF for every payment type, and how it reaches WhatsApp:
// - where the browser can share files, the real PDF goes to the share sheet;
// - where it can't (this headless Chromium), the PDF is downloaded and the screen says so.
// The share sheet itself is a browser/OS feature: it is MOCKED here (navigator.share/canShare
// replaced in the page). A real phone + WhatsApp test is still needed — see the report.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'desktop flows; share capability is mocked explicitly');

const dir = mkdtempSync(join(tmpdir(), 'receipts-'));
/** The PDF's text, read by poppler — proves the file is a valid PDF, not just bytes. */
function pdfText(bytes: Buffer, name: string) {
  const f = join(dir, name);
  writeFileSync(f, bytes);
  expect(execFileSync('pdfinfo', [f]).toString()).toMatch(/Pages:\s+1/);
  return execFileSync('pdftotext', ['-layout', f, '-']).toString();
}
async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/admin\/?$/);
}
/** How much of the page is printed ink — text that vanished (e.g. left invisible) shows up here. */
function inkFraction(pdf: string) {
  execFileSync('pdftoppm', ['-gray', '-r', '24', '-singlefile', pdf, `${pdf}.ink`]);
  const pgm = readFileSync(`${pdf}.ink.pgm`);
  const header = pgm.toString('latin1', 0, 32).match(/^P5\s+(\d+)\s+(\d+)\s+255\s/)!;
  const px = pgm.subarray(header[0].length);
  let dark = 0;
  for (const v of px) if (v < 160) dark++;
  return dark / px.length;
}
/** Replace the browser's share capability with a recorder (or a refusal). */
async function mockShare(page: Page, mode: 'accept' | 'abort' | 'refuse') {
  await page.addInitScript((m) => {
    const w = window as unknown as { __shared?: unknown };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: (d: ShareData) => !!d.files?.length && d.files.every((f) => f.type === 'application/pdf') });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d: ShareData) => {
        if (m === 'abort') throw new DOMException('Share canceled', 'AbortError');
        if (m === 'refuse') throw new DOMException('Not allowed', 'NotAllowedError');
        const f = d.files![0];
        const bytes = Array.from(new Uint8Array(await f.arrayBuffer()));
        w.__shared = { name: f.name, type: f.type, title: d.title, text: d.text, bytes };
      },
    });
  }, mode);
}
const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared?: { name: string; type: string; title: string; text: string; bytes: number[] } }).__shared ?? null);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc('plans/p3', { duration: '3 Months', price: '₹6,500', order: 1 });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await seedDoc('members/a', { name: 'Asha Rao', nameLower: 'asha rao', phone: '9000000001', phoneKey: '9000000001', email: '', emailLower: '', planId: 'p3',
    membershipStart: '2026-01-01', membershipEnd: today, status: 'active', activeUntil: today, trainerId: null, trainerClient: null, notes: '', source: 'manual' });
  // A Marathi name: ि is written before its consonant, श्र is a conjunct — both need real text shaping
  await seedDoc('members/m', { name: MARATHI, nameLower: MARATHI, phone: '9000000002', phoneKey: '9000000002', email: '', emailLower: '', planId: 'p3',
    membershipStart: '2026-01-01', membershipEnd: today, status: 'active', activeUntil: today, trainerId: null, trainerClient: null, notes: '', source: 'manual' });
});
const MARATHI = 'किरण श्रेया पाटील';

const receipts: Record<string, string> = {};
async function collect(page: Page, type: 'Membership' | 'Personal training' | 'Other', fill: () => Promise<void>, amount: string, member = 'a') {
  await page.goto(`/admin/payments/new?member=${member}`);
  await page.getByRole('radiogroup', { name: 'Payment for' }).getByRole('radio', { name: new RegExp(`^${type}`) }).click();
  await fill();
  await page.getByLabel('Amount received (₹)').fill(amount);
  await page.getByRole('button', { name: /^Collect .* payment/ }).click();
  await page.waitForURL(/\/admin\/payments\/[^/]+\?new=1/);
  const no = (await page.getByRole('article', { name: /Receipt CR-R-/ }).getAttribute('aria-label'))!.replace('Receipt ', '');
  if (member === 'a') receipts[type] = no;
  return no;
}

test('membership: saved, and the shared file is the real PDF with type, member, amount and receipt number', async ({ page }) => {
  await mockShare(page, 'accept');
  await login(page);
  const no = await collect(page, 'Membership', async () => { await page.getByLabel('Reference').fill('UPI-1'); }, '6500');
  await expect(page.getByRole('article', { name: `Receipt ${no}` })).toContainText('₹6,500');       // payment saved as before
  await page.getByRole('button', { name: 'Share receipt PDF' }).click();
  await expect(page.getByRole('status', { name: 'Receipt sharing' })).toHaveText('Receipt PDF shared.');
  const s = (await shared(page))!;
  expect(s.type).toBe('application/pdf');
  expect(s.name).toBe(`Crunch-Fitness-${no}.pdf`);
  expect(s.text).toContain(no);
  const text = pdfText(Buffer.from(s.bytes), 'membership.pdf');
  expect(text).toContain('Membership payment');
  expect(text).toContain('3 Months membership');
  expect(text).toContain('Asha Rao');
  expect(text).toContain('₹6,500');
  expect(text).toContain('Six thousand five hundred rupees only');
  expect(text).toContain(no);
  expect(text).toContain('UPI');
});

test('PT: the PDF says PT payment with the package', async ({ page }) => {
  await mockShare(page, 'accept');
  await login(page);
  const no = await collect(page, 'Personal training', async () => { await page.getByLabel('Package name').fill('1 Month PT'); }, '4000');
  await page.getByRole('button', { name: 'Share receipt PDF' }).click();
  await expect(page.getByRole('status', { name: 'Receipt sharing' })).toHaveText('Receipt PDF shared.');
  const text = pdfText(Buffer.from((await shared(page))!.bytes), 'pt.pdf');
  expect(text).toContain('PT payment');
  expect(text).toContain('Personal training — 1 Month PT');
  expect(text).toContain('Asha Rao');
  expect(text).toContain('₹4,000');
  expect(text).toContain(no);
  expect(text).not.toContain('Membership payment');
});

test('other: the PDF says Other payment with the category', async ({ page }) => {
  await mockShare(page, 'accept');
  await login(page);
  const no = await collect(page, 'Other', async () => {
    await page.getByLabel('Category').selectOption('Locker');
    await page.getByLabel('Description').fill('Locker 12, October');
  }, '500');
  await page.getByRole('button', { name: 'Share receipt PDF' }).click();
  await expect(page.getByRole('status', { name: 'Receipt sharing' })).toHaveText('Receipt PDF shared.');
  const text = pdfText(Buffer.from((await shared(page))!.bytes), 'other.pdf');
  expect(text).toContain('Other payment');
  expect(text).toContain('Locker');
  expect(text).toContain('₹500');
  expect(text).toContain(no);
});

test('a Marathi (Devanagari) name and ₹ amounts, for all three payment types: shown correctly and readable as text', async ({ page }) => {
  await mockShare(page, 'accept');
  await login(page);
  const cases = [
    { type: 'Membership' as const, label: 'Membership payment', fill: async () => {}, amount: '6500', shown: '₹6,500' },
    { type: 'Personal training' as const, label: 'PT payment', fill: async () => { await page.getByLabel('Package name').fill('1 Month PT'); }, amount: '4000', shown: '₹4,000' },
    { type: 'Other' as const, label: 'Other payment', fill: async () => { await page.getByLabel('Category').selectOption('Merchandise'); }, amount: '750', shown: '₹750' },
  ];
  for (const c of cases) {
    const no = await collect(page, c.type, c.fill, c.amount, 'm');
    await page.getByRole('button', { name: 'Share receipt PDF' }).click();
    await expect(page.getByRole('status', { name: 'Receipt sharing' })).toHaveText('Receipt PDF shared.');
    const bytes = Buffer.from((await shared(page))!.bytes);
    const text = pdfText(bytes, `marathi-${c.label.split(' ')[0]}.pdf`);
    expect(text).toContain(MARATHI);                                                  // the exact Unicode name, not "?"
    expect(text).not.toMatch(/\?{3,}/);
    expect(text).toContain(c.shown);
    expect(text).toContain(c.label);
    expect(text).toContain(no);
    // The name is drawn by the browser (an image in the PDF), never as unshaped glyphs
    expect(bytes.toString('latin1')).toContain('/Subtype /Image');
    // Everything after the browser-drawn name still renders: as much ink as the English receipt
    expect(inkFraction(join(dir, `marathi-${c.label.split(' ')[0]}.pdf`))).toBeGreaterThan(inkFraction(join(dir, 'membership.pdf')) * 0.8);
  }
});

test('closing the share sheet is “cancelled”, never “shared”', async ({ page }) => {
  await mockShare(page, 'abort');
  await login(page);
  await page.goto('/admin/payments');
  await page.getByRole('link', { name: new RegExp(receipts.Membership) }).first().click();
  await page.getByRole('button', { name: 'Share receipt PDF' }).click();
  await expect(page.getByRole('status', { name: 'Receipt sharing' })).toHaveText('Sharing cancelled — nothing was sent.');
});

test('a refused share falls back to downloading the PDF, and says so', async ({ page }) => {
  await mockShare(page, 'refuse');
  await login(page);
  await page.goto('/admin/payments');
  await page.getByRole('link', { name: new RegExp(receipts['Personal training']) }).first().click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share receipt PDF' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toBe(`Crunch-Fitness-${receipts['Personal training']}.pdf`);
  expect(pdfText(readFileSync((await d.path())!), 'refused.pdf')).toContain('PT payment');
  const status = page.getByRole('status', { name: 'Receipt sharing' });
  await expect(status).toContainText('PDF was downloaded — attach it in WhatsApp');
  await expect(status).not.toContainText('shared.');
});

test('no file sharing in this browser (real headless Chromium): honest download, plus a text-only chat link', async ({ page }) => {
  await login(page);
  const capable = await page.evaluate(() => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] }));
  test.skip(capable, 'this browser can share files');
  await page.goto('/admin/payments');
  await page.getByRole('link', { name: new RegExp(receipts.Other) }).first().click();
  await expect(page.getByRole('button', { name: 'Share receipt PDF' })).toHaveCount(0);       // never offered where it can't work
  await expect(page.getByText('This browser can’t hand files to WhatsApp')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download receipt PDF' }).click();
  const text = pdfText(readFileSync((await (await download).path())!), 'desktop.pdf');
  expect(text).toContain('Other payment');
  const status = page.getByRole('status', { name: 'Receipt sharing' });
  await expect(status).toContainText('PDF downloaded — attach it in WhatsApp.');
  const chat = status.getByRole('link', { name: 'Open WhatsApp chat with Asha Rao' });
  await expect(chat).toHaveAttribute('href', /^https:\/\/wa\.me\/919000000001\?text=/);         // a text message only — labelled as such
  await expect(page.getByRole('link', { name: 'Message only (no PDF) on WhatsApp' })).toBeVisible();
});

test('a void receipt offers no sharing, and print still works as before', async ({ page }) => {
  await login(page);
  await page.goto('/admin/payments');
  await page.getByRole('link', { name: new RegExp(receipts.Other) }).first().click();
  await page.getByRole('button', { name: 'Void payment' }).click();
  await page.getByRole('alertdialog').getByRole('textbox').fill('Entered twice');
  await page.getByRole('alertdialog').getByRole('button', { name: /void/i }).last().click();
  await expect(page.getByRole('article', { name: /Receipt/ })).toContainText('This receipt is not valid');
  await expect(page.getByRole('button', { name: /Share receipt PDF|Download receipt PDF/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Print' })).toBeVisible();
});

// The receipt layout itself, built by the real module in the browser: one A4 page with the brand,
// who paid, how, what for and the amount paid; nothing invented (no balance or total line); very
// long text continues on a second page instead of being cut off.
test('layout: branded single A4 page with every section; long text flows to a second page, never clipped', async ({ page }) => {
  await page.goto('/');
  const build = (payments: Record<string, unknown>[]) => page.evaluate(async (list) => {
    const m = await import('/src/features/admin/payments/receiptPdf.ts');
    await m.preloadReceiptBrand();
    return list.map((p) => Array.from(m.receiptPdf({ ...p, createdAt: { toDate: () => new Date('2026-09-28T04:50:28Z'), toMillis: () => Date.parse('2026-09-28T04:50:28Z') } } as never)));
  }, payments);
  const base = { id: 'x', receiptSeq: 1, paymentType: 'membership', memberId: '3644', memberPhone: '9000000123', memberPhoneKey: '9000000123', planId: 'p3', kind: 'new',
    method: 'cash', reference: '', notes: '', status: 'paid', createdBy: 'frontdesk@crunch.test', countedPaise: 600000, paidOn: '2026-09-28', coversFrom: '2026-10-05', coversTo: '2027-01-04' };
  const longNote = 'Paid in two parts as agreed with the member. '.repeat(120);
  const [example, long, voided] = await build([
    { ...base, receiptNo: 'CR-R-7434', memberName: 'Aakash Ojha', planName: '03 Month', amountPaise: 600000, listPricePaise: 650000, discountPaise: 50000 },
    { ...base, receiptNo: 'CR-R-7435', memberName: 'Aakash Ojha', planName: '03 Month', amountPaise: 600000, notes: `${longNote}END-OF-NOTE` },
    { ...base, receiptNo: 'CR-R-7436', memberName: 'Aakash Ojha', planName: '03 Month', amountPaise: 600000, status: 'void', voidReason: 'Entered twice' },
  ]);
  const bytes = Buffer.from(example);
  const text = pdfText(bytes, 'layout.pdf');                                        // one page (checked inside)
  for (const s of ['CRUNCH FITNESS CLUB', 'PAYMENT RECEIPT', 'CR-R-7434', 'BILLED TO', 'Aakash Ojha', 'Member ID 3644', 'PAYMENT DETAILS', 'Membership payment', 'Cash',
    '03 Month membership', '5 Oct 2026 – 4 Jan 2027', 'Plan price', '₹6,500', 'Discount', '₹500', 'AMOUNT PAID', '₹6,000', 'Six thousand rupees only', 'PAID',
    'OPENING HOURS', 'Thank you for training with Crunch.', 'This is a payment receipt, not a tax invoice.', 'www.crunnchhfitness.com']) expect(text, s).toContain(s);
  expect(text).not.toMatch(/balance|total due|amount due/i);                        // balances aren't tracked: none is shown
  expect(bytes.toString('latin1')).toContain('/Logo');                               // the logo is embedded once it has loaded
  // Very long notes: a second page, every word kept, the footer on both pages
  const f = join(dir, 'long.pdf');
  writeFileSync(f, Buffer.from(long));
  expect(execFileSync('pdfinfo', [f]).toString()).toMatch(/Pages:\s+2/);
  const longText = execFileSync('pdftotext', [f, '-']).toString().replace(/\s+/g, ' ');
  expect(longText).toContain('END-OF-NOTE');
  expect(longText.match(/\bagreed\b/g)?.length).toBe(120);                          // every repetition kept (the page break may fall mid-sentence)
  expect(longText).toContain('Page 1 of 2');
  expect(longText).toContain('Page 2 of 2');
  expect(longText).toContain('(continued)');
  // Void: the status says so, the reason is printed and the VOID stamp is drawn
  const voidText = pdfText(Buffer.from(voided), 'void-layout.pdf');
  expect(voidText).toContain('VOID');
  expect(voidText).toContain('Entered twice. This receipt is not valid.');
});
