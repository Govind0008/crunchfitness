import { cn } from '@/lib/utils';

/** The spinner inside a busy button (see <Button loading>). Still under reduced motion. */
const ButtonLoader = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={cn('animate-spin motion-reduce:animate-none', className)} aria-hidden focusable="false">
    <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
export default ButtonLoader;
