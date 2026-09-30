import { cn } from '@/lib/utils';
import CardSkeleton from './CardSkeleton';
import TableSkeleton from './TableSkeleton';

const bar = 'animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none';

/**
 * A whole admin page while its code loads (the shell's Suspense fallback): the same header,
 * toolbar and content shape as the page that's coming, so the swap is quiet.
 */
const PageSkeleton = ({ variant = 'table' }: { variant?: 'table' | 'dashboard' | 'profile' }) => (
  <div className="flex flex-col gap-4" role="status" aria-label="Loading section">
    <div className="space-y-2"><div className={cn(bar, 'h-7 w-48')} /><div className={cn(bar, 'h-3 w-64 bg-white/[0.04]')} /></div>
    {variant === 'dashboard' && (
      <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
        <div className="grid gap-3 lg:grid-cols-5"><div className={cn(bar, 'h-56 rounded-2xl lg:col-span-3')} /><div className={cn(bar, 'h-56 rounded-2xl lg:col-span-2')} /></div>
      </>
    )}
    {variant === 'profile' && (
      <>
        <div className={cn(bar, 'h-40 rounded-2xl')} />
        <div className="flex gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className={cn(bar, 'h-4 w-16')} />)}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}</div>
      </>
    )}
    {variant === 'table' && (
      <>
        <div className="flex flex-wrap gap-2"><div className={cn(bar, 'h-10 min-w-[12rem] flex-1 rounded-xl')} /><div className={cn(bar, 'h-10 w-72 rounded-xl')} /></div>
        <TableSkeleton rows={8} columns={3} label="Loading rows" />
      </>
    )}
  </div>
);
export default PageSkeleton;
