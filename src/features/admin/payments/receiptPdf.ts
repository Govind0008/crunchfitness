// The receipt as a real PDF file, built in the browser from the payment record — the same facts
// as the on-screen receipt (ui.tsx), for every payment type. Nothing is uploaded or stored: the
// file exists only in this browser until staff share or download it.
//
// A small single-page PDF writer, so no library is needed. Plain text uses the PDF standard
// fonts (Helvetica). Text those fonts can't show — the ₹ sign, Marathi/Devanagari names — is
// drawn by the browser itself (canvas, with the device's own fonts, so Devanagari is shaped
// correctly: matras, conjuncts) into a high-resolution image, with an invisible Unicode text
// layer on top so the PDF can still be searched, copied and read by screen readers. No font file
// is shipped or embedded.
import { GYM } from '@/lib/gym';
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
const widthOf = (enc: string, font: Font, size: number) =>
  [...enc].reduce((w, ch) => { const c = ch.charCodeAt(0); return w + ((font === 'F2' ? BOLD : REGULAR)[c - 32] ?? 556); }, 0) * size / 1000;
function wrap(text: string, font: Font, size: number, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && widthOf(winAnsi(next), font, size) > max) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── Page drawing (A4, points, origin at the top-left for convenience) ────────────────────────
const W = 595.28, H = 841.89, M = 48;
type RGB = [number, number, number];
const WHITE: RGB = [1, 1, 1];
const INK: RGB = [0.07, 0.07, 0.09], MUTED: RGB = [0.42, 0.42, 0.46], RULE: RGB = [0.85, 0.85, 0.87], RED: RGB = [0.75, 0.1, 0.1], PANEL: RGB = [0.95, 0.95, 0.96];
type TextOpts = { font?: Font; size?: number; color?: RGB; align?: 'left' | 'right'; bg?: RGB };
const css = (c: RGB) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;
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
class Page {
  ops: string[] = [];
  drawn: Drawn[] = [];
  text(s: string, x: number, y: number, o: TextOpts = {}) {
    const font = o.font ?? 'F1', size = o.size ?? 10;
    if (!standard(s) && this.drawn.length < 254) {   // one-byte codes for the invisible layer
      const d = drawWithBrowser(normalize(s), font, size, o.color ?? INK, o.bg ?? WHITE);
      if (d) {
        const n = this.drawn.push({ ...d, text: s, size });
        const left = o.align === 'right' ? x - d.width : x;
        const [, ph] = d.px;
        // The image (baseline 1.2 × size from its top), then the same text, invisible, for copy/search
        this.ops.push(`q ${d.width.toFixed(2)} 0 0 ${(ph / SCALE).toFixed(2)} ${left.toFixed(2)} ${(H - y - (ph / SCALE - size * 1.2)).toFixed(2)} cm /Im${n} Do Q`);
        this.ops.push(`q BT 3 Tr /F3 ${size} Tf ${left.toFixed(2)} ${(H - y).toFixed(2)} Td <${n.toString(16).padStart(2, '0')}> Tj ET Q`);   // q…Q: invisible mode (3 Tr) must not outlive this text
        return;
      }
    }
    const enc = winAnsi(s);
    const left = o.align === 'right' ? x - widthOf(enc, font, size) : x;
    const esc = enc.replace(/[\\()]/g, (c) => `\\${c}`);
    this.ops.push(`BT ${(o.color ?? INK).join(' ')} rg /${font} ${size} Tf ${left.toFixed(2)} ${(H - y).toFixed(2)} Td (${esc}) Tj ET`);
  }
  rule(y: number) { this.ops.push(`${RULE.join(' ')} RG 0.75 w ${M} ${(H - y).toFixed(2)} m ${W - M} ${(H - y).toFixed(2)} l S`); }
  box(x: number, y: number, w: number, h: number, color: RGB) { this.ops.push(`${color.join(' ')} rg ${x} ${(H - y - h).toFixed(2)} ${w} ${h} re f`); }
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

/** The receipt as PDF bytes. Synchronous, so a share can start inside the same tap. */
export function receiptPdf(p: Payment): Uint8Array<ArrayBuffer> {
  const f = receiptFields(p);
  const pg = new Page();
  const right = W - M;
  // Header: the gym on the left, the receipt number and date on the right
  pg.text(GYM.name.toUpperCase(), M, 70, { font: 'F2', size: 20 });
  let y = 88;
  for (const line of wrap(GYM.address.join(', '), 'F1', 8.5, 300)) { pg.text(line, M, y, { size: 8.5, color: MUTED }); y += 11; }
  pg.text(`${GYM.phone} · ${GYM.email}`, M, y, { size: 8.5, color: MUTED });
  pg.text(p.receiptNo ? 'PAYMENT RECEIPT' : 'PAYMENT RECORD', right, 62, { size: 8, color: MUTED, align: 'right' });
  pg.text(p.receiptNo ?? 'Imported', right, 82, { font: 'F2', size: 15, align: 'right' });
  pg.text(fmtDate(p.paidOn), right, 98, { size: 10, color: MUTED, align: 'right' });
  y = Math.max(y + 18, 122);
  pg.rule(y);
  // Who paid
  y += 26;
  pg.text('RECEIVED FROM', M, y, { size: 8, color: MUTED });
  pg.text(p.memberName, M, y + 18, { font: 'F2', size: 15 });
  pg.text(formatPhone(p.memberPhone), M, y + 33, { size: 10, color: MUTED });
  // The facts, two columns
  y += 62;
  const col2 = M + (W - 2 * M) / 2 + 8;
  const cell = (label: string, value: string, x: number, at: number, color: RGB = INK) => {
    pg.text(label.toUpperCase(), x, at, { size: 8, color: MUTED });
    (standard(value) ? wrap(value, 'F2', 10.5, (W - 2 * M) / 2 - 16) : [value]).forEach((l, i) => pg.text(l, x, at + 15 + i * 13, { font: 'F2', size: 10.5, color }));
  };
  cell('Payment type', f.type, M, y); cell('For', f.for, col2, y);
  y += 44;
  cell('Period', f.period, M, y); cell('Paid by', f.method, col2, y);
  y += 44;
  cell('Reference', p.reference || '—', M, y); cell('Status', p.status === 'paid' ? 'Paid' : 'Void', col2, y, p.status === 'void' ? RED : INK);
  y += 48;
  if (p.discountPaise) {
    if (p.listPricePaise != null) { pg.text('Plan price', M, y, { color: MUTED }); pg.text(rupees(p.listPricePaise), right, y, { align: 'right' }); y += 15; }
    pg.text('Discount', M, y, { color: MUTED }); pg.text(`-${rupees(p.discountPaise)}`, right, y, { align: 'right' }); y += 20;
  }
  // The amount
  pg.box(M, y, W - 2 * M, 72, PANEL);
  pg.text('AMOUNT RECEIVED', M + 18, y + 30, { font: 'F2', size: 9, color: MUTED });
  pg.text(f.amount, right - 18, y + 36, { font: 'F2', size: 24, align: 'right', bg: PANEL });
  pg.text(amountInWords(p.amountPaise), M + 18, y + 56, { size: 9.5, color: MUTED });
  y += 96;
  const para = (s: string, color: RGB = MUTED, font: Font = 'F1') => { for (const l of wrap(s, font, 9.5, W - 2 * M)) { pg.text(l, M, y, { size: 9.5, color, font }); y += 13; } y += 6; };
  if (p.notes) para(`Note: ${p.notes}`);
  if (p.legacy) para(`Imported from the old member sheet (${p.legacy.file}, row ${p.legacy.row}). No receipt number was issued at the time.`);
  if (p.status === 'void') para(`VOIDED${p.voidReason ? ` — ${p.voidReason}` : ''}. This receipt is not valid.`, RED, 'F2');
  // Footer
  y = Math.max(y + 10, 560);
  pg.rule(y);
  pg.text(`Recorded by ${p.createdBy}${p.createdAt ? ` · ${fmtTime(p.createdAt)}` : ''}`, M, y + 18, { size: 8.5, color: MUTED });
  pg.text('Thank you for training with Crunch.', right, y + 18, { size: 8.5, color: MUTED, align: 'right' });
  if (!GYM.payments.tax) pg.text('This is a payment receipt, not a tax invoice.', M, y + 34, { size: 7.5, color: MUTED });

  // ── File structure ──
  const content = pg.ops.join('\n');
  const info = winAnsi(`${GYM.name} — ${f.title}`).replace(/[\\()]/g, (c) => `\\${c}`);
  const d = pg.drawn;
  const objects: string[] = [];
  const add = (o: string) => objects.push(o);   // → its object number
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add('');                                        // 3: the page, filled in below
  const contents = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const infoObj = add(`<< /Title (${info}) /Producer (Crunch admin) >>`);
  const images = d.map((x) => add(`<< /Type /XObject /Subtype /Image /Width ${x.px[0]} /Height ${x.px[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${x.jpeg.length} >>\nstream\n${x.jpeg}\nendstream`));
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
  objects[2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R${f3 ? ` /F3 ${f3} 0 R` : ''} >>${images.length ? ` /XObject << ${images.map((n, i) => `/Im${i + 1} ${n} 0 R`).join(' ')} >>` : ''} >> /Contents ${contents} 0 R >>`;
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
