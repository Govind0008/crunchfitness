import { cn } from '@/lib/utils';

const bar = 'animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none';

/** A KPI or summary card while its number loads: label, value, sub-line. */
const CardSkeleton = ({ className, lines = 1 }: { className?: string; lines?: number }) => (
  <div className={cn('rounded-2xl border border-white/[0.08] bg-ink-900 p-4', className)} aria-hidden>
    <div className={cn(bar, 'h-2.5 w-24')} />
    <div className={cn(bar, 'mt-3 h-7 w-16')} />
    {Array.from({ length: lines }).map((_, i) => <div key={i} className={cn(bar, 'mt-2 h-2.5 w-40 bg-white/[0.04]')} />)}
  </div>
);
export default CardSkeleton;
