import { useState, type ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Small shared pieces for the admin: side drawers, status dots, friendly errors, skeletons.

/** A task in a side panel — the page underneath stays put. Full width on phones. */
export const SideDrawer = ({ open, onOpenChange, title, description, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode;
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto border-white/[0.08] bg-ink-950 p-0 text-white sm:max-w-xl [&>button:last-child]:z-20 [&>button:last-child]:top-5 [&>button:last-child]:rounded-lg [&>button:last-child]:p-1.5 [&>button:last-child]:text-white [&>button:last-child]:opacity-80 [&>button:last-child>svg]:h-5 [&>button:last-child>svg]:w-5">
      <SheetHeader className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-950/95 py-5 pl-6 pr-14 text-left backdrop-blur">
        <SheetTitle className="font-display text-3xl font-bold uppercase leading-none text-white">{title}</SheetTitle>
        {description ? <SheetDescription className="text-sm text-ink-400">{description}</SheetDescription> : <SheetDescription className="sr-only">{title}</SheetDescription>}
      </SheetHeader>
      <div className="px-6 py-6">{children}</div>
    </SheetContent>
  </Sheet>
);

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'info';
const DOT: Record<Tone, string> = { ok: 'bg-brand-400', warn: 'bg-amber-300', bad: 'bg-red-400', muted: 'bg-ink-500', info: 'bg-sky-300' };
const TEXT: Record<Tone, string> = { ok: 'text-brand-fg', warn: 'text-amber-100', bad: 'text-red-200', muted: 'text-ink-300', info: 'text-sky-200' };
/** "● Access enabled" — colour plus words, never colour alone. */
export const StatusDot = ({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', TEXT[tone], className)}>
    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', DOT[tone])} aria-hidden />{children}
  </span>
);

/** Plain-words error with a retry; the technical message only behind "Details". */
export const ErrorNote = ({ what, error, onRetry }: { what: string; error?: string | null; onRetry?: () => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-red-100">{what}</p>
        <div className="flex gap-2">
          {error && <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-xs text-red-200/70 hover:text-red-100">Details</button>}
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RotateCcw /> Try again</Button>}
        </div>
      </div>
      {open && error && <p className="mt-2 break-words font-mono text-[11px] text-red-200/70">{error}</p>}
    </div>
  );
};

/** Placeholder rows shaped like the list that's loading. */
export const SkeletonRows = ({ rows = 4, className }: { rows?: number; className?: string }) => (
  <div className={cn('space-y-2', className)} role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 rounded-xl bg-ink-900 p-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" />
        <div className="flex-1 space-y-2"><div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" /><div className="h-2.5 w-1/2 animate-pulse rounded bg-white/[0.04] motion-reduce:animate-none" /></div>
      </div>
    ))}
  </div>
);

/** An empty state that reads as intentional, with the next step. */
export const EmptyNote = ({ title, body, children }: { title: string; body: string; children?: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-white/[0.1] px-5 py-6 text-center">
    <p className="font-display text-xl font-bold uppercase tracking-wide text-white">{title}</p>
    <p className="mt-1 text-sm text-ink-400">{body}</p>
    {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
  </div>
);

/**
 * The list toolbar every admin list uses: search, a compact segmented status filter with
 * counts, and (optionally) a Filters button for anything secondary.
 */
export function ListToolbar<K extends string>({ search, onSearch, placeholder, segments, value, onChange, label, extra }: {
  search: string; onSearch: (v: string) => void; placeholder: string;
  segments?: { id: K; label: string; count?: number }[]; value?: K; onChange?: (k: K) => void; label?: string; extra?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-shrink-0 flex-col gap-2 lg:flex-row lg:items-center">
      <label className="relative block flex-1">
        <span className="sr-only">{placeholder}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-white/15 bg-field pl-11 pr-4 text-sm text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none" />
      </label>
      {segments && onChange && (
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-ink-900 p-1" role="group" aria-label={label ?? 'Filter'}>
          {segments.map((s) => (
            <button key={s.id} type="button" onClick={() => onChange(s.id)} aria-pressed={value === s.id}
              className={cn('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors', value === s.id ? 'bg-white text-ink-950' : 'text-ink-300 hover:text-white')}>
              {s.label}{s.count != null && <span className={cn('ml-1 tabular-nums', value === s.id ? 'text-ink-600' : 'text-ink-500')}>{s.count}</span>}
            </button>
          ))}
        </div>
      )}
      {extra}
    </div>
  );
}

/** Status pill used by every list: one shape, one set of tones. */
export const Pill = ({ tone, children }: { tone: Tone; children: ReactNode }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', {
    ok: 'bg-brand-400/15 text-brand-fg', warn: 'bg-amber-400/15 text-amber-100', bad: 'bg-red-500/15 text-red-200', muted: 'bg-white/[0.06] text-ink-300', info: 'bg-sky-300/15 text-sky-100',
  }[tone])}>{children}</span>
);

/**
 * Previous / Next for a cursor-paginated list (see usePaged). Pages are numbered as you walk them;
 * there's no "page 7 of 40" because counting a large collection costs a read per document.
 */
export const Pagination = ({ p, label, count }: {
  p: { page: number; size: number; hasPrev: boolean; hasNext: boolean; loading: boolean; prev: () => void; next: () => void; setSize: (s: 25 | 50 | 100) => void };
  label: string; count?: number;
}) => {
  if (!p.hasPrev && !p.hasNext && (count ?? 0) < 25) return null;   // one short page: nothing to page through
  const from = (p.page - 1) * p.size + 1;
  return (
    <nav aria-label={`${label} pages`} className="mt-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 text-sm">
      <p className="tabular-nums text-ink-400" aria-live="polite">
        {count ? <>Showing <span className="text-white">{from}–{from + count - 1}</span></> : `Page ${p.page}`}{p.loading && <span className="ml-2 text-ink-500">Loading…</span>}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-ink-400">
          <span className="hidden sm:inline">Per page</span>
          <select value={p.size} onChange={(e) => p.setSize(Number(e.target.value) as 25 | 50 | 100)} aria-label="Rows per page"
            className="h-9 rounded-lg border border-white/15 bg-field px-2 text-white focus:border-brand-400 focus:outline-none">
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <Button size="sm" variant="outline" onClick={p.prev} disabled={!p.hasPrev || p.loading}>Previous</Button>
        <span className="min-w-[4.5rem] text-center tabular-nums text-ink-300">Page {p.page}</span>
        <Button size="sm" variant="outline" onClick={p.next} disabled={!p.hasNext || p.loading}>Next</Button>
      </div>
    </nav>
  );
};

/**
 * The scrolling part of a data page. Inside an AdminShell with `fill`, it takes the height left
 * over and scrolls on its own (from 1024px wide); pagination goes after it, outside the scroll.
 * Give header rows `sticky top-0` (see <HeadRow>) so they stay visible.
 */
export const DataRegion = ({ children, className, label }: { children: ReactNode; className?: string; label?: string }) => (
  <div className={cn('overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 lg:flex lg:min-h-[14rem] lg:flex-1 lg:flex-col', className)}>
    <div className="relative lg:min-h-0 lg:flex-1 lg:overflow-auto lg:overscroll-contain" {...(label ? { role: 'region', 'aria-label': label, tabIndex: 0 } : {})}>{children}</div>
  </div>
);
/** Column labels for a list inside a DataRegion: hidden on phones (rows become cards), sticky above. */
export const HeadRow = ({ className, children }: { className: string; children: ReactNode }) => (
  <div aria-hidden className={cn('sticky top-0 z-10 hidden gap-x-3 border-b border-white/[0.08] bg-ink-850 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500 md:grid', className)}>{children}</div>
);

/** The shared list container: one bordered surface, hairline dividers. */
export const ListBox = ({ label, children }: { label: string; children: ReactNode }) => (
  <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900" aria-label={label}>{children}</ul>
);

