import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { balanceText } from '@/lib/admin/packages';
import { GYM } from '@/lib/gym';
import { SITE } from '@/lib/site';
import { METHOD_LABEL, PAYMENT_LABEL, TYPE_LABEL, amountInWords, paymentFor, paymentTypeOf, rupees, type Payment } from '@/lib/admin/payments';
import { formatPhone } from '@/lib/admin/phone';
import { fmtDate, fmtTime } from '@/features/admin/members/lookups';

export const PaymentStatus = ({ p }: { p: Pick<Payment, 'status'> }) => (
  <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-bold', p.status === 'paid' ? 'bg-brand-400/15 text-brand-fg' : 'bg-white/10 text-ink-400 line-through')}>
    {p.status === 'paid' ? 'Paid' : 'Void'}
  </span>
);

export const TypeTag = ({ p }: { p: Payment }) => (
  <span className="inline-block rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-ink-300">{TYPE_LABEL[paymentTypeOf(p)]}</span>
);

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn('text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500', className)}>{children}</p>
);
const website = SITE.url.replace(/^https?:\/\//, '');

/**
 * The printable receipt — the same layout as the PDF (receiptPdf.ts). Everything on it is a
 * snapshot taken when the payment was recorded. Only recorded figures are shown: balances aren't
 * tracked, so there is no "total due" or "balance" line.
 */
export const Receipt = ({ p }: { p: Payment }) => {
  const isVoid = p.status === 'void';
  const period = p.coversFrom && p.coversTo ? `${fmtDate(p.coversFrom)} – ${fmtDate(p.coversTo)}` : '—';
  return (
    <article className="receipt relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white text-ink-950 shadow-xl print:max-w-none print:rounded-none print:shadow-none" aria-label={p.receiptNo ? `Receipt ${p.receiptNo}` : 'Imported payment record'}>
      <div className="h-1.5 bg-brand-400" aria-hidden />
      <div className="p-6 sm:p-10 print:p-0 print:pt-6">
        <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-6 border-b-2 border-ink-950 pb-6">
          <div className="flex min-w-[15rem] flex-1 items-start gap-4">
            <div className="grid h-16 w-16 flex-shrink-0 place-items-center rounded-md bg-ink-950 p-1.5 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
              <img src={GYM.logo} alt="" className="h-auto w-full" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold uppercase leading-none tracking-wide">{GYM.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-500">{GYM.address.join(', ')}<br />{GYM.phone} · {GYM.email}<br />{website}</p>
            </div>
          </div>
          <div className="ml-auto min-w-[14rem] text-right">
            <p className="font-display text-3xl font-bold uppercase leading-none tracking-wide">{p.receiptNo ? 'Payment receipt' : 'Payment record'}</p>
            <dl className="ml-auto mt-3 grid w-64 max-w-full grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-left text-sm">
              <dt className="text-ink-500">Receipt no.</dt><dd className="whitespace-nowrap text-right font-mono font-bold">{p.receiptNo ?? 'Not issued (imported)'}</dd>
              <dt className="text-ink-500">Date</dt><dd className="text-right font-semibold">{fmtDate(p.paidOn)}</dd>
              <dt className="text-ink-500">Status</dt>
              <dd className="text-right"><span className={cn('inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] print:[print-color-adjust:exact]', isVoid ? 'bg-red-700 text-white' : 'bg-brand-400 text-ink-950')}>{isVoid ? 'Void' : 'Paid'}</span></dd>
            </dl>
          </div>
        </header>

        <div className="grid gap-8 py-8 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))] print:py-6">
          <section aria-label="Billed to">
            <Label>Billed to</Label>
            <p className="mt-2 break-words text-xl font-bold">{p.memberName}</p>
            <p className="mt-1 text-sm text-ink-600">{formatPhone(p.memberPhone)}</p>
            <p className="mt-1 [overflow-wrap:anywhere] text-xs text-ink-500">Member ID {p.memberId}</p>
          </section>
          <section aria-label="Payment details">
            <Label>Payment details</Label>
            <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-ink-500">Payment type</dt><dd>{PAYMENT_LABEL[paymentTypeOf(p)]}</dd>
              <dt className="text-ink-500">Paid by</dt><dd>{METHOD_LABEL[p.method]}</dd>
              <dt className="text-ink-500">Reference</dt><dd className="[overflow-wrap:anywhere]">{p.reference || '—'}</dd>
              <dt className="text-ink-500">Recorded by</dt><dd className="[overflow-wrap:anywhere]">{p.createdBy}{p.createdAt ? ` · ${fmtTime(p.createdAt)}` : ''}</dd>
            </dl>
          </section>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-ink-100 text-left print:[print-color-adjust:exact]">
              <th scope="col" className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">Description</th>
              <th scope="col" className="hidden px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500 sm:table-cell print:table-cell">Period</th>
              <th scope="col" className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-ink-500">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-200 align-top">
              <td className="px-3 py-4">
                <p className="break-words font-bold">{paymentFor(p)}</p>
                <p className="mt-0.5 text-xs text-ink-500">{PAYMENT_LABEL[paymentTypeOf(p)]}<span className="sm:hidden print:hidden"> · {period}</span></p>
              </td>
              <td className="hidden px-3 py-4 sm:table-cell print:table-cell">{period}</td>
              <td className="whitespace-nowrap px-3 py-4 text-right font-bold tabular-nums">{rupees(p.amountPaise)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex flex-wrap items-start gap-6 pt-6">
          <div className={cn('relative min-w-[13rem] flex-1', isVoid && 'min-h-28')}>
            <Label>Amount in words</Label>
            <p className="mt-2 text-sm">{amountInWords(p.amountPaise)}</p>
            {/* VOID across the empty space under the words, never over the figures */}
            {isVoid && <span className="pointer-events-none absolute left-6 top-12 rotate-[-12deg] rounded-lg border-4 border-red-600 px-4 py-1 font-display text-5xl font-extrabold uppercase text-red-600 opacity-80" aria-hidden>Void</span>}
          </div>
          <div className="ml-auto w-[17rem] max-w-full">
            {!!p.discountPaise && (
              <dl className="mb-3 space-y-1.5 text-sm">
                {p.listPricePaise != null && <div className="flex justify-between"><dt className="text-ink-600">Plan price</dt><dd className="tabular-nums">{rupees(p.listPricePaise)}</dd></div>}
                <div className="flex justify-between"><dt className="text-ink-600">Discount</dt><dd className="tabular-nums">−{rupees(p.discountPaise)}</dd></div>
              </dl>
            )}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 bg-brand-400 px-4 py-3.5 text-ink-950 print:[print-color-adjust:exact]">
              <div><Label className="text-ink-950">Amount paid</Label><p className="mt-1 text-xs">{METHOD_LABEL[p.method]}</p></div>
              <span className="ml-auto font-display text-4xl font-extrabold leading-none tabular-nums [overflow-wrap:anywhere]">{rupees(p.amountPaise)}</span>
            </div>
          </div>
        </div>

        {(p.notes || p.legacy || isVoid) && (
          <div className="mt-8 space-y-4 text-sm">
            {p.notes && <div><Label>Note</Label><p className="mt-1.5 whitespace-pre-line break-words text-ink-700">{p.notes}</p></div>}
            {p.legacy && (
              <div>
                <Label>Imported record</Label>
                <p className="mt-1.5 text-ink-700">
                  Imported from the old member sheet ({p.legacy.file}{p.legacy.sheet && p.legacy.sheet !== 'Sheet1' ? `, ${p.legacy.sheet} sheet` : ''}, row {p.legacy.row}{p.legacy.srNo ? `, Sr No ${p.legacy.srNo}` : ''}). No receipt number was issued at the time; {p.method === 'unknown' ? 'the payment method wasn’t recorded.' : `the sheet’s Mode said “${p.legacy.methodRaw ?? p.method}”.`}
                  {balanceText(p.legacy) && <> The sheet’s balance column said: “{balanceText(p.legacy)}” — kept as a note, not money owed.</>}
                </p>
              </div>
            )}
            {isVoid && <div><Label className="text-red-700">Void reason</Label><p className="mt-1.5 font-semibold text-red-700">Voided{p.voidReason ? ` — ${p.voidReason}` : ''}. This receipt is not valid.</p></div>}
          </div>
        )}

        <div className="mt-10 grid gap-4 bg-ink-100 p-5 text-sm [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))] print:mt-8 print:break-inside-avoid print:[print-color-adjust:exact]">
          <div>
            <Label>Opening hours</Label>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {GYM.hours.map((h) => <Fragment key={h.days}><dt className="text-ink-500">{h.days}</dt><dd>{h.time}</dd></Fragment>)}
            </dl>
          </div>
          <div>
            <Label>Questions about this receipt?</Label>
            <p className="mt-2">Call or WhatsApp {GYM.phone}</p>
            <p className="[overflow-wrap:anywhere] text-ink-500">{GYM.email}</p>
          </div>
        </div>

        <footer className="mt-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-1 border-t border-ink-200 pt-4 text-xs text-ink-500 print:break-inside-avoid">
          <div>
            <p className="text-sm font-bold text-ink-950">Thank you for training with Crunch.</p>
            {/* No GST registration is configured — never present this as a tax invoice */}
            {!GYM.payments.tax && <p className="mt-1">This is a payment receipt, not a tax invoice.</p>}
          </div>
          <p className="ml-auto text-right">{GYM.name} · {GYM.phone} · {website}</p>
        </footer>
      </div>
    </article>
  );
};
