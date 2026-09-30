import { cn } from '@/lib/utils';
import { STATE_LABEL, type MemberState } from '@/lib/admin/members';

const PILL: Record<MemberState, string> = {
  active: 'bg-brand-400/15 text-brand-fg',
  expiring: 'bg-amber-400/15 text-amber-200',
  expired: 'bg-red-500/15 text-red-200',
  inactive: 'bg-white/10 text-ink-300',
};
export const StatePill = ({ state, className }: { state: MemberState; className?: string }) => (
  <span className={cn('inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', PILL[state], className)}>{STATE_LABEL[state]}</span>
);
