import { cn } from '@/lib/utils';
import { STATUS, type CrunchEvent } from '@/lib/events';

/** The public status mark — LIVE pulses (a real, admin-set state; never a timer). */
export const StatusMark = ({ ev, className }: { ev: CrunchEvent; className?: string }) => {
  const live = ev.status === 'live';
  const label = live && ev.paused ? 'Live · short break' : STATUS[ev.status].public;
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em]',
      live ? 'bg-red-500 text-white' : ev.status === 'registration_open' ? 'bg-brand-400 text-ink-950' : ev.status === 'results_published' ? 'bg-white text-ink-950' : 'bg-white/10 text-white backdrop-blur-sm',
      className,
    )}>
      {live && <span className="live-dot h-2 w-2 rounded-full bg-white" aria-hidden />}
      {label}
    </span>
  );
};
