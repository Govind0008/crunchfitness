import { cn } from '@/lib/utils';

const bar = 'animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none';

/**
 * Placeholder rows shaped like the list or table that's loading: a person column (avatar, name,
 * detail) and, for `columns`, that many short cells — so nothing jumps when the rows arrive.
 */
const TableSkeleton = ({ rows = 4, columns = 0, className, label = 'Loading' }: { rows?: number; columns?: number; className?: string; label?: string }) => (
  <div className={cn('space-y-2', className)} role="status" aria-label={label}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-xl bg-ink-900 p-3">
        <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" />
        <div className="min-w-0 flex-1 space-y-2"><div className={cn(bar, 'h-3 w-1/3')} /><div className={cn(bar, 'h-2.5 w-1/2 bg-white/[0.04]')} /></div>
        {Array.from({ length: columns }).map((__, c) => <div key={c} className={cn(bar, 'hidden h-3 w-20 md:block')} />)}
      </div>
    ))}
  </div>
);
export default TableSkeleton;
