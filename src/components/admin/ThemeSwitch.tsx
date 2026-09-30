import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemePref } from '@/lib/theme';

const OPTIONS: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }, { id: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / System, as a compact segmented control. */
const ThemeSwitch = ({ value, onChange, className }: { value: ThemePref; onChange: (p: ThemePref) => void; className?: string }) => (
  <div role="radiogroup" aria-label="Theme" className={cn('flex gap-1 rounded-xl border border-white/[0.08] bg-ink-950 p-1', className)}>
    {OPTIONS.map(({ id, label, icon: Icon }) => (
      <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)} title={label}
        className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors', value === id ? 'bg-white text-ink-950' : 'text-ink-400 hover:text-white')}>
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </button>
    ))}
  </div>
);

export default ThemeSwitch;
