import { cn } from '@/lib/utils';

/**
 * A small "in progress" mark for a panel or a line of text — a short lime bar travelling along
 * a track (the rep-bar), not a spinner. Announces its label to screen readers.
 */
const InlineLoader = ({ label = 'Loading', className }: { label?: string; className?: string }) => (
  <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-ink-400', className)}>
    <span className="relative h-0.5 w-10 overflow-hidden rounded-full bg-white/[0.1]" aria-hidden>
      <span className="inline-loader-bar absolute inset-y-0 left-0 w-1/2 rounded-full bg-brand-400" />
    </span>
    {label}…
  </span>
);
export default InlineLoader;
