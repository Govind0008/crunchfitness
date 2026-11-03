// The receipt as a real PDF file, built in the browser from the payment record — the same facts
// as the on-screen receipt (ui.tsx), for every payment type. Nothing is uploaded or stored: the
// file exists only in this browser until staff share or download it.
//
// A small PDF writer, so no library is needed. Plain text uses the PDF standard fonts
// (Helvetica). Text those fonts can't show — the ₹ sign, Marathi/Devanagari names — is drawn by
// the browser itself (canvas, with the device's own fonts, so Devanagari is shaped correctly:
// matras, conjuncts) into a high-resolution image, with an invisible Unicode text layer on top so
// the PDF can still be searched, copied and read by screen readers. No font file is shipped or
// embedded. The gym's logo is drawn the same way once it has loaded (see preloadReceiptBrand).
//
// The layout fits one A4 page for every normal receipt; unusually long text (notes, a reference,
// a void reason) continues on another page instead of being clipped.
import { GYM } from '@/lib/gym';
import { SITE } from '@/lib/site';
import { METHOD_LABEL, PAYMENT_LABEL, amountInWords, paymentFor, paymentTypeOf, rupees, type Payment } from '@/lib/admin/payments';
import { formatPhone } from '@/lib/admin/phone';
import { fmtDate, fmtTime } from '@/features/admin/members/lookups';

// ── Text encoding (WinAnsi) and widths (Helvetica metrics, 1/1000 em, for ' '…'~') ──────────
const SPECIAL: Record<string, number> = { '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '…': 0x85, '€': 0x80 };
const normalize = (s: string) => s.replace(/\u2212/g, '-').replace(/\u00a0|\u202f/g, ' ');
const codeOf = (ch: string): number | null => {
  const c = ch.codePointAt(0)!;
  if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) return c;
  return SPECIAL[ch] ?? null;
};
/** Can the standard fonts show this text as it is? */
const standard = (s: string) => [...normalize(s)].every((ch) => codeOf(ch) != null);
function winAnsi(s: string): string {
  return [...normalize(s)].map((ch) => { const c = codeOf(ch); return c == null ? '?' : String.fromCharCode(c); }).join('');
}
const REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
type Font = 'F1' | 'F2';
const widthOf = (enc: string, font: Font, size: number, spacing = 0) =>
  [...enc].reduce((w, ch) => { const c = ch.charCodeAt(0); return w + ((font === 'F2' ? BOLD : REGULAR)[c - 32] ?? 556); }, 0) * size / 1000 + spacing * Math.max(0, enc.length - 1);
/** Lines of at most `max` points. A single word longer than a line (an email, a reference) is split. */
function wrap(text: string, font: Font, size: number, max: number): string[] {
  const fits = (s: string) => widthOf(winAnsi(s), font, size) <= max;
  const lines: string[] = [];
  let cur = '';
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (!fits(word)) {                  // break an over-long word at the last character that fits
      let n = word.length - 1;
      while (n > 1 && !fits(word.slice(0, n))) n--;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(word.slice(0, n));
      word = word.slice(n);
    }
    const next = cur ? `${cur} ${word}` : word;
    if (cur && !fits(next)) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ── Colours ──────────────────────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const WHITE: RGB = [1, 1, 1];
const INK: RGB = [0.067, 0.067, 0.078];          // near-black text
const TILE: RGB = [0.086, 0.086, 0.098];         // the logo's dark tile
const MUTED: RGB = [0.4, 0.4, 0.43];
const RULE: RGB = [0.86, 0.86, 0.88];
const PANEL: RGB = [0.957, 0.957, 0.965];
const LIME: RGB = [0.69, 0.831, 0.247];          // brand-400 #b0d43f — fills only, never text on white
const RED: RGB = [0.75, 0.1, 0.1];
const css = (c: RGB) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
const rg = (c: RGB) => c.map((v) => +v.toFixed(3)).join(' ');

// ── The browser draws what the standard fonts can't (₹, Devanagari) ──────────────────────────
/** Text the browser drew: a JPEG of it, and the Unicode it stands for. */
interface Drawn { jpeg: string; px: [number, number]; text: string; width: number; size: number }
const SCALE = 4;   // canvas pixels per point: sharp when printed or zoomed
function drawWithBrowser(s: string, font: Font, size: number, color: RGB, bg: RGB): Omit<Drawn, 'text' | 'size'> | null {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return null;
  const family = `${font === 'F2' ? '700' : '400'} ${size * SCALE}px Helvetica, Arial, "Noto Sans", "Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", "Mangal", sans-serif`;
  ctx.font = family;
  const w = Math.ceil(ctx.measureText(s).width) + 2, h = Math.ceil(size * SCALE * 1.7);
  canvas.width = w; canvas.height = h;
  ctx.font = family; ctx.fillStyle = css(bg); ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(color); ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, 1, Math.round(size * SCALE * 1.2));
  const url = canvas.toDataURL('image/jpeg', 0.95);
  if (!url.startsWith('data:image/jpeg')) return null;
  return { jpeg: atob(url.slice(url.indexOf(',') + 1)), px: [w, h], width: w / SCALE };
}

// ── The logo: drawn once on its dark tile, ready before anyone taps "Share" ──────────────────
interface Brand { jpeg: string; px: [number, number] }
let brand: Brand | null = null;
let brandLoading: Promise<void> | null = null;
/**
 * Load the gym's logo into a ready-to-embed image. The PDF is built synchronously (a share must
 * start inside the tap), so the logo has to be ready beforehand; until it is, the receipt shows
 * the name as a wordmark instead. Safe to call repeatedly.
 */
export function preloadReceiptBrand(src: string = GYM.logo): Promise<void> {
  if (brand || typeof document === 'undefined' || typeof Image === 'undefined') return Promise.resolve();
  brandLoading ??= new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = css(TILE); ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const url = canvas.toDataURL('image/jpeg', 0.92);
        if (url.startsWith('data:image/jpeg')) brand = { jpeg: atob(url.slice(url.indexOf(',') + 1)), px: [canvas.width, canvas.height] };
      } catch { /* a tainted or failed canvas: keep the wordmark */ }
      resolve();
    };
    img.onerror = () => { brandLoading = null; resolve(); };
    img.src = src;
  });
  return brandLoading;
}
if (typeof window !== 'undefined') void preloadReceiptBrand();

// ── Pages (A4, points, origin at the top-left for convenience) ───────────────────────────────
const W = 595.28, H = 841.89, M = 44;
const BOTTOM = H - 84;   // content stops here; the footer sits below
type TextOpts = { font?: Font; size?: number; color?: RGB; align?: 'left' | 'right' | 'center'; bg?: RGB; spacing?: number; maxWidth?: number };
class Doc {
  pages: string[][] = [[]];
  current = 0;   // the page being drawn on
  drawn: Drawn[] = [];
  usesBrand = false;
  get ops() { return this.pages[this.current]; }
  addPage() { this.current = this.pages.push([]) - 1; }
  /** One line of text. Browser-drawn text (₹, Devanagari) is shrunk to `maxWidth` if it's wider. */
  text(s: string, x: number, y: number, o: TextOpts = {}) {
    const font = o.font ?? 'F1', size = o.size ?? 10, color = o.color ?? INK;
    const place = (w: number) => (o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x);
    if (!standard(s) && this.drawn.length < 254) {   // one-byte codes for the invisible layer
      const d = drawWithBrowser(normalize(s), font, size, color, o.bg ?? WHITE);
      if (d) {
        const k = o.maxWidth && d.width > o.maxWidth ? o.maxWidth / d.width : 1;
        const w = d.width * k, h = (d.px[1] / SCALE) * k, sz = size * k;
        const n = this.drawn.push({ ...d, width: w, text: s, size: sz });
        const left = place(w);
        // The image (baseline 1.2 × size from its top), then the same text, invisible, for copy/search
        this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${left.toFixed(2)} ${(H - y - (h - sz * 1.2)).toFixed(2)} cm /Im${n} Do Q`);
        this.ops.push(`q BT 3 Tr /F3 ${sz.toFixed(2)} Tf ${left.toFixed(2)} ${(H - y).toFixed(2)} Td <${n.toString(16).padStart(2, '0')}> Tj ET Q`);   // q…Q: invisible mode (3 Tr) must not outlive this text
        return w;
      }
    }
    const enc = winAnsi(s);
    const w = widthOf(enc, font, size, o.spacing);
    const esc = enc.replace(/[\\()]/g, (c) => `\\${c}`);
    this.ops.push(`BT ${rg(color)} rg /${font} ${size} Tf ${o.spacing ?? 0} Tc ${place(w).toFixed(2)} ${(H - y).toFixed(2)} Td (${esc}) Tj ET`);
    return w;
  }
  /** A small spaced-out uppercase label. */
  label(s: string, x: number, y: number, o: TextOpts = {}) { return this.text(s.toUpperCase(), x, y, { font: 'F2', size: 7, color: MUTED, spacing: 0.9, ...o }); }
  box(x: number, y: number, w: number, h: number, color: RGB) { this.ops.push(`${rg(color)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
  line(x1: number, y: number, x2: number, color: RGB = RULE, width = 0.75) { this.ops.push(`${rg(color)} RG ${width} w ${x1.toFixed(2)} ${(H - y).toFixed(2)} m ${x2.toFixed(2)} ${(H - y).toFixed(2)} l S`); }
  logo(x: number, y: number, w: number, h: number) { this.usesBrand = true; this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(H - y - h).toFixed(2)} cm /Logo Do Q`); }
  /** A rotated outline stamp ("VOID") that leaves the text beneath it readable. */
  stamp(s: string, cx: number, cy: number, size: number, color: RGB) {
    const a = (-14 * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
    const w = widthOf(s, 'F2', size);
    const x = cx - (w / 2) * c + (size / 3) * sn, y = H - cy - (w / 2) * sn - (size / 3) * c;
    this.ops.push(`q ${rg(color)} RG 2.2 w BT 1 Tr /F2 ${size} Tf ${c.toFixed(4)} ${sn.toFixed(4)} ${(-sn).toFixed(4)} ${c.toFixed(4)} ${x.toFixed(2)} ${y.toFixed(2)} Tm (${s}) Tj ET Q`);
  }
}

/** The fields every receipt carries, whatever the payment type. */
export function receiptFields(p: Payment) {
  return {
    title: p.receiptNo ? `Payment receipt ${p.receiptNo}` : 'Payment record',
    type: PAYMENT_LABEL[paymentTypeOf(p)],
    for: paymentFor(p),
    period: p.coversFrom && p.coversTo ? `${fmtDate(p.coversFrom)} – ${fmtDate(p.coversTo)}` : '—',
    method: METHOD_LABEL[p.method],
    amount: rupees(p.amountPaise),
  };
}

const website = SITE.url.replace(/^https?:\/\//, '');

/** The receipt as PDF bytes. Synchronous, so a share can start inside the same tap. */
export function receiptPdf(p: Payment): Uint8Array<ArrayBuffer> {
  const f = receiptFields(p);
  const doc = new Doc();
  const right = W - M, full = W - 2 * M;
  const isVoid = p.status === 'void';
  const docTitle = p.receiptNo ? 'Payment receipt' : 'Payment record';

  // ── Header: brand on the left; what this document is, on the right ──
  const pageTop = () => doc.box(0, 0, W, 5, LIME);
  pageTop();
  const tile = 62;
  doc.box(M, 36, tile, tile, TILE);
  if (brand) {
    const lw = tile - 10, lh = lw * (brand.px[1] / brand.px[0]);
    doc.logo(M + 5, 36 + (tile - lh) / 2, lw, lh);
  } else {
    doc.text('CRUNCH', M + tile / 2, 36 + tile / 2 + 3, { font: 'F2', size: 11, color: LIME, align: 'center', bg: TILE });
  }
  const bx = M + tile + 16, bw = 222;
  doc.text(GYM.name.toUpperCase(), bx, 53, { font: 'F2', size: 16, maxWidth: bw });
  let y = 69;
  for (const l of wrap(GYM.address.join(', '), 'F1', 8.5, bw)) { doc.text(l, bx, y, { size: 8.5, color: MUTED }); y += 11; }
  for (const l of wrap(`${GYM.phone}  ·  ${GYM.email}`, 'F1', 8.5, bw)) { doc.text(l, bx, y, { size: 8.5, color: MUTED }); y += 11; }
  doc.text(website, bx, y, { size: 8.5, color: MUTED }); y += 11;

  doc.text(docTitle.toUpperCase(), right, 56, { font: 'F2', size: 18, spacing: 0.6, align: 'right' });
  const kx = right - 168;
  const meta: [string, string][] = [['Receipt no.', p.receiptNo ?? 'Not issued (imported)'], ['Date', fmtDate(p.paidOn)]];
  let my = 82;
  for (const [k, v] of meta) {
    doc.text(k, kx, my, { size: 8.5, color: MUTED });
    doc.text(v, right, my, { font: 'F2', size: 10, align: 'right', maxWidth: 110 });
    my += 16;
  }
  doc.text('Status', kx, my, { size: 8.5, color: MUTED });
  const pill = isVoid ? 'VOID' : 'PAID', pw = widthOf(pill, 'F2', 7.5, 0.9) + 14;
  doc.box(right - pw, my - 9.5, pw, 13, isVoid ? RED : LIME);
  doc.text(pill, right - pw / 2, my, { font: 'F2', size: 7.5, spacing: 0.9, align: 'center', color: isVoid ? WHITE : INK });
  my += 16;

  y = Math.max(y, my, 36 + tile) + 16;
  doc.line(M, y, right, INK, 1.2);

  // ── Who paid, and how ──
  y += 30;
  const gap = 28, colW = (full - gap) / 2, cx2 = M + colW + gap;
  let ly = y, ry = y;
  doc.label('Billed to', M, ly); ly += 21;
  if (standard(p.memberName)) for (const l of wrap(p.memberName, 'F2', 16, colW)) { doc.text(l, M, ly, { font: 'F2', size: 16 }); ly += 19; }
  else { doc.text(p.memberName, M, ly, { font: 'F2', size: 16, maxWidth: colW }); ly += 19; }
  if (p.memberPhone) { doc.text(formatPhone(p.memberPhone), M, ly, { size: 9.5, color: MUTED }); ly += 14; }
  for (const l of wrap(p.memberId ? `Member ID  ${p.memberId}` : 'Walk-in · day pass', 'F1', 8.5, colW)) { doc.text(l, M, ly, { size: 8.5, color: MUTED }); ly += 12; }

  doc.label('Payment details', cx2, ry); ry += 21;
  const kv = (k: string, v: string, color: RGB = INK) => {
    doc.text(k, cx2, ry, { size: 9, color: MUTED });
    const vx = cx2 + 82, vw = colW - 82;
    if (standard(v)) for (const l of wrap(v, 'F1', 9.5, vw)) { doc.text(l, vx, ry, { size: 9.5, color }); ry += 13; }
    else { doc.text(v, vx, ry, { size: 9.5, color, maxWidth: vw }); ry += 13; }
    ry += 3;
  };
  kv('Payment type', f.type);
  kv('Paid by', f.method);
  kv('Reference', p.reference || '—');
  kv('Recorded by', `${p.createdBy}${p.createdAt ? ` · ${fmtTime(p.createdAt)}` : ''}`);
  y = Math.max(ly, ry) + 24;

  // ── What it was for ──
  const c2 = M + full * 0.5, amountX = right - 12;
  doc.box(M, y, full, 24, PANEL);
  doc.label('Description', M + 12, y + 15.5);
  doc.label('Period', c2, y + 15.5);
  doc.label('Amount', amountX, y + 15.5, { align: 'right' });
  y += 24 + 22;
  const descLines = standard(f.for) ? wrap(f.for, 'F2', 10.5, c2 - M - 28) : [f.for];
  const periodLines = wrap(f.period, 'F1', 9.5, amountX - 90 - c2);
  descLines.forEach((l, i) => doc.text(l, M + 12, y + i * 15, { font: 'F2', size: 11, maxWidth: c2 - M - 28 }));
  doc.text(f.type, M + 12, y + descLines.length * 15 + 1, { size: 8.5, color: MUTED });
  periodLines.forEach((l, i) => doc.text(l, c2, y + i * 13, { size: 10 }));
  doc.text(f.amount, amountX, y, { font: 'F2', size: 11, align: 'right' });
  y += Math.max(descLines.length * 15 + 14, periodLines.length * 13) + 14;
  doc.line(M, y, right);

  // ── Summary: the recorded figures only (balances aren't tracked, so none is shown) ──
  y += 26;
  const sx = right - 236, sw = 236;
  let sy = y;
  if (p.discountPaise) {
    if (p.listPricePaise != null) { doc.text('Plan price', sx, sy, { size: 9.5, color: MUTED }); doc.text(rupees(p.listPricePaise), right, sy, { size: 9.5, align: 'right' }); sy += 17; }
    doc.text('Discount', sx, sy, { size: 9.5, color: MUTED }); doc.text(`-${rupees(p.discountPaise)}`, right, sy, { size: 9.5, align: 'right' }); sy += 12;
  }
  sy += 2;
  doc.box(sx, sy, sw, 52, LIME);
  doc.label('Amount paid', sx + 14, sy + 21, { color: INK });
  doc.text(f.method, sx + 14, sy + 36, { size: 9, color: INK, bg: LIME, maxWidth: 90 });
  doc.text(f.amount, right - 14, sy + 35, { font: 'F2', size: 23, align: 'right', bg: LIME, maxWidth: sw - 116 });
  sy += 52;
  // Amount in words, on the left of the summary
  let wy = y;
  doc.label('Amount in words', M, wy); wy += 15;
  for (const l of wrap(amountInWords(p.amountPaise), 'F1', 9.5, sx - M - 24)) { doc.text(l, M, wy, { size: 9.5 }); wy += 13; }
  // VOID across the empty space under the amount in words, never over the figures
  if (isVoid) doc.stamp('VOID', M + (sx - M) / 2 - 6, Math.max(wy, y + 30) + 34, 54, RED);
  y = Math.max(sy, wy + (isVoid ? 70 : 0)) + 30;

  // ── Notes, history, void reason: full width, continuing on a new page if they must ──
  const page2 = () => {
    doc.addPage(); pageTop();
    doc.text(`${GYM.name} — ${f.title} (continued)`, M, 40, { size: 8.5, color: MUTED });
    doc.line(M, 50, right);
    return 72;
  };
  const block = (title: string, body: string, color: RGB = INK, font: Font = 'F1') => {
    if (y + 34 > BOTTOM) y = page2();
    doc.label(title, M, y, { color: color === RED ? RED : MUTED }); y += 15;
    for (const l of wrap(body, font, 9.5, full)) {
      if (y > BOTTOM) y = page2();
      doc.text(l, M, y, { size: 9.5, color, font }); y += 13;
    }
    y += 12;
  };
  if (p.notes) block('Note', p.notes);
  if (p.legacy) block('Imported record', `Imported from the old member sheet (${p.legacy.file}, row ${p.legacy.row}). No receipt number was issued at the time.`);
  if (isVoid) block('Void reason', `VOIDED${p.voidReason ? ` — ${p.voidReason}` : ''}. This receipt is not valid.`, RED, 'F2');

  // ── Opening hours and how to reach the front desk (from the gym's settings), when there's room ──
  const bandTop = H - 62 - 18 - 62;
  if (y <= bandTop - 10 && GYM.hours.length) {
    doc.box(M, bandTop, full, 62, PANEL);
    doc.label('Opening hours', M + 16, bandTop + 20);
    GYM.hours.forEach((h, i) => { doc.text(h.days, M + 16, bandTop + 36 + i * 13, { size: 9, color: MUTED }); doc.text(h.time, M + 150, bandTop + 36 + i * 13, { size: 9 }); });
    const qx = M + full / 2 + 14;
    doc.label('Questions about this receipt?', qx, bandTop + 20);
    doc.text(`Call or WhatsApp ${GYM.phone}`, qx, bandTop + 36, { size: 9 });
    doc.text(GYM.email, qx, bandTop + 49, { size: 9, color: MUTED, maxWidth: full / 2 - 30 });
  }

  // ── Footer on every page ──
  const pages = doc.pages.length;
  doc.pages.forEach((_, i) => {
    doc.current = i;
    const fy = H - 62;
    doc.line(M, fy, right);
    doc.text('Thank you for training with Crunch.', M, fy + 17, { font: 'F2', size: 9 });
    if (!GYM.payments.tax) doc.text('This is a payment receipt, not a tax invoice.', M, fy + 30, { size: 7.5, color: MUTED });
    doc.text(`${GYM.name}  ·  ${GYM.phone}  ·  ${website}`, right, fy + 17, { size: 7.5, color: MUTED, align: 'right' });
    if (pages > 1) doc.text(`Page ${i + 1} of ${pages}`, right, fy + 30, { size: 7.5, color: MUTED, align: 'right' });
  });

  // ── File structure ──
  const info = winAnsi(`${GYM.name} — ${f.title}`).replace(/[\\()]/g, (c) => `\\${c}`);
  const d = doc.drawn;
  const objects: string[] = [];
  const add = (o: string) => objects.push(o);   // → its object number
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');                                        // 2: the page tree, filled in below
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const infoObj = add(`<< /Title (${info}) /Producer (Crunch admin) >>`);
  const images = d.map((x) => add(`<< /Type /XObject /Subtype /Image /Width ${x.px[0]} /Height ${x.px[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${x.jpeg.length} >>\nstream\n${x.jpeg}\nendstream`));
  const logoObj = doc.usesBrand && brand ? add(`<< /Type /XObject /Subtype /Image /Width ${brand.px[0]} /Height ${brand.px[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${brand.jpeg.length} >>\nstream\n${brand.jpeg}\nendstream`) : 0;
  // F3: an invisible font whose character n reads as the text of drawn image n (ToUnicode)
  let f3 = 0;
  if (d.length) {
    const utf16 = (t: string) => [...t].map((ch) => { const c = ch.codePointAt(0)!; return c > 0xffff ? [0xd800 + ((c - 0x10000) >> 10), 0xdc00 + ((c - 0x10000) & 0x3ff)] : [c]; }).flat().map((u) => u.toString(16).padStart(4, '0')).join('');
    const cmap = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange ${d.length} beginbfchar ${d.map((x, i) => `<${(i + 1).toString(16).padStart(2, '0')}> <${utf16(x.text)}>`).join(' ')} endbfchar endcmap CMapName currentdict /CMap defineresource pop end end`;
    const toUnicode = add(`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`);
    const proc = '0 0 0 0 0 0 d1';                // a glyph that draws nothing
    const empty = add(`<< /Length ${proc.length} >>\nstream\n${proc}\nendstream`);
    f3 = add(`<< /Type /Font /Subtype /Type3 /FontBBox [0 0 0 0] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << ${d.map((_, i) => `/g${i + 1} ${empty} 0 R`).join(' ')} >> /Encoding << /Type /Encoding /Differences [1 ${d.map((_, i) => `/g${i + 1}`).join(' ')}] >> /FirstChar 1 /LastChar ${d.length} /Widths [${d.map((x) => Math.round((x.width * 1000) / x.size)).join(' ')}] /Resources << >> /ToUnicode ${toUnicode} 0 R >>`);
  }
  const resources = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R${f3 ? ` /F3 ${f3} 0 R` : ''} >>${images.length || logoObj ? ` /XObject << ${images.map((n, i) => `/Im${i + 1} ${n} 0 R`).join(' ')}${logoObj ? ` /Logo ${logoObj} 0 R` : ''} >>` : ''} >>`;
  const kids = doc.pages.map((ops) => {
    const content = ops.join('\n');
    const c = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    return add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${resources} /Contents ${c} 0 R >>`);
  });
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character above is a single byte (WinAnsi), so offsets counted in characters are bytes
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}

export const receiptFileName = (p: Payment) => `Crunch-Fitness-${p.receiptNo ?? `payment-${p.id}`}.pdf`;
/** The receipt PDF as a File, ready for the share sheet or a download. */
export const generatePaymentReceipt = (p: Payment) => new File([receiptPdf(p)], receiptFileName(p), { type: 'application/pdf' });
