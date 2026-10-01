import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Download, MessageCircle, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SITE, whatsappLink } from '@/lib/site';
import { METHOD_LABEL, getPayment, paymentFor, rupees, voidPayment, type Payment } from '@/lib/admin/payments';
import { phoneKey } from '@/lib/admin/phone';
import { AdminShell, Empty, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate, fmtTime } from '@/features/admin/members/lookups';
import { PaymentStatus, Receipt } from './ui';
import { generatePaymentReceipt } from './receiptPdf';
import { canShareFiles, downloadFile, shareReceipt, type ShareOutcome } from './shareReceipt';

/** Payment details + receipt preview. Print uses the browser's print dialog (receipt only, no shell). */
const PaymentDetail = () => {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const actor = useActor();
  const [p, setP] = useState<Payment | null | undefined>(undefined);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Receipt PDF: what this browser can do, and what happened on the last tap
  const [fileShare] = useState(() => canShareFiles());
  const [sending, setSending] = useState<'preparing' | 'opening' | null>(null);
  const [sent, setSent] = useState<ShareOutcome | 'download' | 'failed' | null>(null);
  const load = () => getPayment(id).then(setP).catch(() => setP(null));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (p === undefined) return <AdminShell title="Payment" nav="payments" area="Money"><div className="h-64 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading receipt" /></AdminShell>;
  if (p === null) return <AdminShell title="Payment not found" nav="payments" area="Money" back={{ to: '/admin/payments', label: 'Payments' }}><Empty title="No such payment" body="Check the link or search by receipt number." /></AdminShell>;

  const share = whatsappLink(
    `Payment received — ${SITE.name}\nReceipt ${p.receiptNo} · ${fmtDate(p.paidOn)}\n${p.memberName}: ${rupees(p.amountPaise)} (${METHOD_LABEL[p.method]}${p.reference ? ` · Ref ${p.reference}` : ''})\n${paymentFor(p)}${p.coversTo ? ` until ${fmtDate(p.coversTo)}` : ''}\nThank you!`,
    `91${phoneKey(p.memberPhone)}`,
  );

  const sharePdf = async () => {
    setSent(null); setSending('preparing');
    try {
      const run = shareReceipt(p);            // the PDF is built here, inside the tap
      setSending('opening');
      setSent(await run);
    } catch { setSent('failed'); }
    finally { setSending(null); }
  };
  const downloadPdf = () => {
    setSent(null);
    try { downloadFile(generatePaymentReceipt(p)); setSent('download'); } catch { setSent('failed'); }
  };
  const SENT_TEXT: Record<NonNullable<typeof sent>, string> = {
    shared: 'Receipt PDF shared.',
    cancelled: 'Sharing cancelled — nothing was sent.',
    downloaded: 'This browser can’t attach files to WhatsApp directly, so the PDF was downloaded — attach it in WhatsApp.',
    download: 'PDF downloaded — attach it in WhatsApp.',
    failed: 'The receipt PDF couldn’t be prepared. Try again, or use Print.',
  };
  const canSend = p.status === 'paid' && !!p.receiptNo;

  const doVoid = async () => {
    if (reason.trim().length < 3) { setError('Say briefly why this payment is being voided.'); return; }
    setBusy(true); setError(null);
    try { await voidPayment(p, reason, actor); setVoidOpen(false); await load(); }
    catch { setError('The payment could not be voided. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title={p.receiptNo ?? 'Imported payment'} nav="payments" area="Money" back={{ to: '/admin/payments', label: 'Back to payments' }}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          {canSend && (fileShare
            ? <Button onClick={sharePdf} disabled={!!sending} aria-busy={!!sending || undefined}><Share2 /> {sending === 'preparing' ? 'Preparing receipt…' : sending === 'opening' ? 'Opening share…' : 'Share receipt PDF'}</Button>
            : <Button onClick={downloadPdf}><Download /> Download receipt PDF</Button>)}
          {canSend && fileShare && <Button variant="outline" onClick={downloadPdf}><Download /> Download PDF</Button>}
          <Button variant={canSend ? 'outline' : 'default'} onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      }>
      {params.get('new') && p.status === 'paid' && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-400/10 p-4 text-sm text-white print:hidden">
          <CheckCircle2 className="h-5 w-5 text-brand-fg" aria-hidden /> Payment saved — receipt {p.receiptNo} is ready.
        </p>
      )}
      <p role="status" aria-label="Receipt sharing" className={sent ? `mb-6 rounded-xl border p-4 text-sm print:hidden ${sent === 'failed' ? 'border-red-500/30 bg-red-500/10 text-red-100' : 'border-white/[0.1] bg-ink-900 text-white'}` : 'sr-only'}>
        {sent ? SENT_TEXT[sent] : ''}
        {(sent === 'downloaded' || sent === 'download') && <> <a href={share} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-fg underline-offset-2 hover:underline">Open WhatsApp chat with {p.memberName}</a> <span className="text-ink-400">(opens the chat with a text message; attach the PDF there)</span></>}
      </p>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="receipt-area"><Receipt p={p} /></div>
        <aside className="space-y-4 print:hidden" aria-label="Payment details">
          <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 text-sm">
            <div className="flex items-center justify-between"><p className="font-semibold text-white">Details</p><PaymentStatus p={p} /></div>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-ink-400">Member</dt><dd><Link to={`/admin/members/${p.memberId}`} className="text-white hover:text-brand-fg">{p.memberName}</Link></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-400">Recorded</dt><dd className="text-right text-white">{fmtTime(p.createdAt)}<br /><span className="text-xs text-ink-500">{p.createdBy}</span></dd></div>
              {p.status === 'void' && <div className="flex justify-between gap-3"><dt className="text-ink-400">Voided</dt><dd className="text-right text-white">{fmtTime(p.voidedAt)}<br /><span className="text-xs text-ink-500">{p.voidedBy} · {p.voidReason}</span></dd></div>}
            </dl>
          </div>
          {p.status === 'paid' && p.receiptNo && (
            <div className="rounded-2xl border border-white/[0.08] p-5 text-sm text-ink-400">
              <p className="font-semibold text-white">Sending the receipt</p>
              {fileShare
                ? <p className="mt-1">“Share receipt PDF” opens this device’s share sheet with the PDF attached — choose WhatsApp, then the member’s chat.</p>
                : <p className="mt-1">This browser can’t hand files to WhatsApp. Download the PDF, then attach it in the member’s WhatsApp chat (or WhatsApp Web).</p>}
              <a href={share} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-brand-fg"><MessageCircle size={16} aria-hidden /> Message only (no PDF) on WhatsApp</a>
            </div>
          )}
          {p.status === 'paid' && (
            <div className="rounded-2xl border border-red-500/25 p-5 text-sm">
              <p className="font-semibold text-white">Recorded by mistake?</p>
              <p className="mt-1 text-ink-400">Payments can’t be edited or deleted. Void it (with a reason) and record it again. The member’s expiry isn’t changed automatically.</p>
              <Button variant="destructive" size="sm" className="mt-3" onClick={() => { setVoidOpen(true); setReason(''); setError(null); }}>Void payment</Button>
            </div>
          )}
        </aside>
      </div>

      <AlertDialog open={voidOpen} onOpenChange={(o) => !busy && setVoidOpen(o)}>
        <AlertDialogContent className="border-white/10 bg-ink-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl uppercase text-white">Void {p.receiptNo ?? 'this imported payment'}?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-300">{rupees(p.amountPaise)} from {p.memberName} will no longer count towards revenue. The receipt stays on record, marked void.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block"><span className="text-sm text-white">Reason</span>
            <input className={`${inputCls} mt-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" autoFocus /></label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <Button variant="destructive" loading={busy} loadingText="Voiding…" onClick={doVoid}>Void payment</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
};

export default PaymentDetail;
