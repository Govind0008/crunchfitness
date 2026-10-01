// Sharing the receipt PDF itself. A wa.me link can only carry text, so the file goes through the
// browser's share sheet (Web Share API with files — Android Chrome, iOS Safari, Windows/ChromeOS
// Chrome and Edge), where staff pick WhatsApp. Where a browser can't share files, the PDF is
// downloaded instead and the result says so; it never reports "shared" unless the browser
// accepted the file for sharing.
import { SITE } from '@/lib/site';
import { rupees, type Payment } from '@/lib/admin/payments';
import { generatePaymentReceipt } from './receiptPdf';

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';
type ShareNav = Pick<Navigator, 'share' | 'canShare'>;

export const receiptMessage = (p: Payment) => `${SITE.name} — receipt ${p.receiptNo} for ${p.memberName}: ${rupees(p.amountPaise)}. Thank you!`;

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Can this browser hand a PDF file to other apps? */
export function canShareFiles(nav: Partial<ShareNav> = navigator, file?: File): boolean {
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try { return nav.canShare({ files: [file ?? new File([''], 'receipt.pdf', { type: 'application/pdf' })] }); } catch { return false; }
}

/**
 * Hand the receipt PDF to the share sheet, or download it where that isn't possible. Must be
 * called straight from a tap: the PDF is built synchronously so the browser still counts the
 * share as user-initiated.
 */
export async function shareReceipt(p: Payment, nav: Partial<ShareNav> = navigator): Promise<ShareOutcome> {
  const file = generatePaymentReceipt(p);
  if (canShareFiles(nav, file)) {
    try {
      await nav.share!({ files: [file], title: `Receipt ${p.receiptNo}`, text: receiptMessage(p) });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Refused (e.g. no user activation, or the type isn't allowed here): fall back to the file
    }
  }
  downloadFile(file);
  return 'downloaded';
}
