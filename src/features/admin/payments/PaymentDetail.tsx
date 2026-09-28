import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SITE, whatsappLink } from '@/lib/site';
import { METHOD_LABEL, getPayment, rupees, voidPayment, type Payment } from '@/lib/admin/payments';
import { phoneKey } from '@/lib/admin/phone';
import { AdminShell, Empty, inputCls } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { fmtDate, fmtTime } from '@/features/admin/members/lookups';
import { PaymentStatus, Receipt } from './ui';

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
  const load = () => getPayment(id).then(setP).catch(() => setP(null));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (p === undefined) return <AdminShell title="Payment" nav="payments" area="Money"><div className="h-64 animate-pulse rounded-2xl bg-ink-900" role="status" aria-label="Loading receipt" /></AdminShell>;
  if (p === null) return <AdminShell title="Payment not found" nav="payments" area="Money" back={{ to: '/admin/payments', label: 'Payments' }}><Empty title="No such payment" body="Check the link or search by receipt number." /></AdminShell>;

  const share = whatsappLink(
    `Payment received — ${SITE.name}\nReceipt ${p.receiptNo} · ${fmtDate(p.paidOn)}\n${p.memberName}: ${rupees(p.amountPaise)} (${METHOD_LABEL[p.method]}${p.reference ? ` · Ref ${p.reference}` : ''})${p.planName ? `\n${p.planName} membership${p.coversTo ? ` until ${fmtDate(p.coversTo)}` : ''}` : ''}\nThank you!`,
    `91${phoneKey(p.memberPhone)}`,
  );

  const doVoid = async () => {
    if (reason.trim().length < 3) { setError('Say briefly why this payment is being voided.'); return; }
    setBusy(true); setError(null);
    try { await voidPayment(p, reason, actor); setVoidOpen(false); await load(); }
    catch { setError('The payment could not be voided. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <AdminShell title={p.receiptNo} nav="payments" area="Money" back={{ to: '/admin/payments', label: 'Back to payments' }}
      actions={
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button onClick={() => window.print()}><Printer /> Print / save PDF</Button>
          {p.status === 'paid' && <Button asChild variant="outline"><a href={share} target="_blank" rel="noopener noreferrer"><MessageCircle /> Share on WhatsApp</a></Button>}
        </div>
      }>
      {params.get('new') && p.status === 'paid' && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-400/10 p-4 text-sm text-white print:hidden">
          <CheckCircle2 className="h-5 w-5 text-brand-400" aria-hidden /> Payment saved — receipt {p.receiptNo} is ready.
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="receipt-area"><Receipt p={p} /></div>
        <aside className="space-y-4 print:hidden" aria-label="Payment details">
          <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5 text-sm">
            <div className="flex items-center justify-between"><p className="font-semibold text-white">Details</p><PaymentStatus p={p} /></div>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3"><dt className="text-ink-400">Member</dt><dd><Link to={`/admin/members/${p.memberId}`} className="text-white hover:text-brand-400">{p.memberName}</Link></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-400">Recorded</dt><dd className="text-right text-white">{fmtTime(p.createdAt)}<br /><span className="text-xs text-ink-500">{p.createdBy}</span></dd></div>
              {p.status === 'void' && <div className="flex justify-between gap-3"><dt className="text-ink-400">Voided</dt><dd className="text-right text-white">{fmtTime(p.voidedAt)}<br /><span className="text-xs text-ink-500">{p.voidedBy} · {p.voidReason}</span></dd></div>}
            </dl>
          </div>
          {p.status === 'paid' && (
            <div className="rounded-2xl border border-white/[0.08] p-5 text-sm text-ink-400">
              <p className="font-semibold text-white">Sending the receipt</p>
              <p className="mt-1">“Share on WhatsApp” sends the receipt details as a message to the member’s number. For the PDF, choose “Print / save PDF” → Save as PDF, then attach the file in WhatsApp or email.</p>
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
            <AlertDialogTitle className="font-display text-2xl uppercase text-white">Void {p.receiptNo}?</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-300">{rupees(p.amountPaise)} from {p.memberName} will no longer count towards revenue. The receipt stays on record, marked void.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="block"><span className="text-sm text-white">Reason</span>
            <input className={`${inputCls} mt-2`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered twice" autoFocus /></label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy} className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={doVoid}>{busy ? 'Voiding…' : 'Void payment'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
};

export default PaymentDetail;
