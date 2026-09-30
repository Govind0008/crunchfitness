import { cn } from '@/lib/utils';
import { balanceText } from '@/lib/admin/packages';
import { GYM } from '@/lib/gym';
import { METHOD_LABEL, TYPE_LABEL, amountInWords, paymentFor, paymentTypeOf, rupees, type Payment } from '@/lib/admin/payments';
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

/** The printable receipt. Everything on it is a snapshot taken when the payment was recorded. */
export const Receipt = ({ p }: { p: Payment }) => (
  <article className="receipt relative mx-auto max-w-xl overflow-hidden rounded-2xl bg-white p-8 text-ink-950 shadow-xl print:max-w-none print:rounded-none print:shadow-none" aria-label={p.receiptNo ? `Receipt ${p.receiptNo}` : 'Imported payment record'}>
    {p.status === 'void' && (
      <span className="pointer-events-none absolute right-6 top-24 rotate-[-12deg] rounded-lg border-4 border-red-600 px-4 py-1 font-display text-5xl font-extrabold uppercase text-red-600 opacity-80" aria-hidden>Void</span>
    )}
    <header className="flex items-start justify-between gap-6 border-b border-ink-200 pb-6">
      <div>
        <img src={GYM.logo} alt="" className="h-12 w-auto" />
        <p className="mt-3 font-display text-2xl font-bold uppercase leading-none">{GYM.name}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">{GYM.address.join(', ')}<br />{GYM.phone} · {GYM.email}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500">{p.receiptNo ? 'Payment receipt' : 'Payment record'}</p>
        <p className="mt-1 whitespace-nowrap font-mono text-lg font-bold">{p.receiptNo ?? 'Imported'}</p>
        <p className="mt-1 text-sm text-ink-600">{fmtDate(p.paidOn)}</p>
      </div>
    </header>

    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-6 text-sm">
      <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-ink-500">Received from</dt><dd className="mt-1 text-lg font-semibold">{p.memberName}</dd><dd className="text-ink-600">{formatPhone(p.memberPhone)}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-ink-500">For</dt><dd className="mt-1 font-semibold">{paymentFor(p)}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-ink-500">Period</dt><dd className="mt-1 font-semibold">{p.coversFrom && p.coversTo ? `${fmtDate(p.coversFrom)} – ${fmtDate(p.coversTo)}` : '—'}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-ink-500">Paid by</dt><dd className="mt-1 font-semibold">{METHOD_LABEL[p.method]}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-ink-500">Reference</dt><dd className="mt-1 break-all font-semibold">{p.reference || '—'}</dd></div>
      <div><dt className="text-xs uppercase tracking-wider text-ink-500">Status</dt><dd className={cn('mt-1 font-semibold', p.status === 'void' && 'text-red-700')}>{p.status === 'paid' ? 'Paid' : 'Void'}</dd></div>
    </dl>

    {!!p.discountPaise && (
      <dl className="mb-3 space-y-1 text-sm">
        {p.listPricePaise != null && <div className="flex justify-between"><dt className="text-ink-600">Plan price</dt><dd className="tabular-nums">{rupees(p.listPricePaise)}</dd></div>}
        <div className="flex justify-between"><dt className="text-ink-600">Discount</dt><dd className="tabular-nums">−{rupees(p.discountPaise)}</dd></div>
      </dl>
    )}

    <div className="rounded-xl bg-ink-100 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-semibold uppercase tracking-wider text-ink-600">Amount received</span>
        <span className="font-display text-4xl font-extrabold tabular-nums">{rupees(p.amountPaise)}</span>
      </div>
      <p className="mt-2 text-sm text-ink-600">{amountInWords(p.amountPaise)}</p>
    </div>

    {p.notes && <p className="mt-4 text-sm text-ink-600">Note: {p.notes}</p>}
    {p.legacy && (
      <p className="mt-4 text-sm text-ink-600">
        Imported from the old member sheet ({p.legacy.file}{p.legacy.sheet && p.legacy.sheet !== 'Sheet1' ? `, ${p.legacy.sheet} sheet` : ''}, row {p.legacy.row}{p.legacy.srNo ? `, Sr No ${p.legacy.srNo}` : ''}). No receipt number was issued at the time; {p.method === 'unknown' ? 'the payment method wasn’t recorded.' : `the sheet’s Mode said “${p.legacy.methodRaw ?? p.method}”.`}
        {balanceText(p.legacy) && <> The sheet’s balance column said: “{balanceText(p.legacy)}” — kept as a note, not money owed.</>}
      </p>
    )}
    {p.status === 'void' && <p className="mt-4 text-sm font-semibold text-red-700">Voided{p.voidReason ? ` — ${p.voidReason}` : ''}. This receipt is not valid.</p>}
    <footer className="mt-8 flex items-end justify-between gap-6 border-t border-ink-200 pt-4 text-xs text-ink-500">
      <p>Recorded by {p.createdBy}{p.createdAt ? ` · ${fmtTime(p.createdAt)}` : ''}</p>
      <p>Thank you for training with Crunch.</p>
    </footer>
    {/* No GST registration is configured — never present this as a tax invoice */}
    {!GYM.payments.tax && <p className="mt-3 text-[11px] text-ink-400">This is a payment receipt, not a tax invoice.</p>}
  </article>
);
