import { useState, type ReactNode } from 'react';
import { ActorContext, useActor } from './actor';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { NavKey } from '@/components/admin/tabs';
import { useRole } from '@/hooks/useRole';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { STATUS, type EventStatus } from '@/lib/events';
import Seo from '@/components/site/Seo';


/**
 * Event admin guard. Matches the security rules exactly: only accounts whose
 * userRoles document says role "admin" can manage events.
 */
export const EventAdminRoute = ({ children }: { children: ReactNode }) => {
  const { role, loading, user } = useRole();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-ink-950" role="status" aria-label="Loading"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" /></div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (role?.role !== 'admin') {
    const marketing = role?.role === 'marketing';
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
        <Seo title="Admin | Crunch Fitness" description="Staff area" noindex />
        <div className="max-w-md">
          <p className="hud text-brand-fg">Crunch admin</p>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase text-white">{marketing ? 'This is a marketing account' : 'This account can’t use the admin yet'}</h1>
          <p className="mt-4 text-ink-300">
            You’re signed in as <strong className="text-white">{user.email}</strong>.{' '}
            {marketing
              ? 'Marketing accounts use the Creative Desk for the blog, events, offers and social content. Members and payments stay with the gym’s admins.'
              : 'Ask the gym owner to give this account admin access in Settings → Staff access.'}
          </p>
          {marketing
            ? <Button asChild className="mt-8"><Link to="/marketing">Go to the Creative Desk <ArrowRight /></Link></Button>
            : <Button asChild variant="outline" className="mt-8"><Link to="/"><ArrowLeft /> Back to the website</Link></Button>}
        </div>
      </div>
    );
  }
  return <ActorContext.Provider value={{ uid: user.uid, email: user.email ?? 'admin' }}>{children}</ActorContext.Provider>;
};

/**
 * Page content inside the persistent AdminLayout (which owns the sidebar, header and guard).
 * `nav` / `area` are kept for call-site compatibility; the layout derives both from the URL.
 */
export const AdminShell = ({ title, subtitle, back, children, actions, bare, fill, width = 'wide' }: {
  title: string; back?: { to: string; label: string }; children: ReactNode; actions?: ReactNode;
  /** One line under the title: "14 total · 1 active" */
  subtitle?: ReactNode;
  nav?: NavKey; area?: string;
  /** The page draws its own heading (e.g. the member profile's header) */
  bare?: boolean;
  /**
   * A data page (list/table): from 1024px wide the page stays within the viewport and its
   * <DataRegion> scrolls instead, so the toolbar and pagination never scroll away. Phones and
   * short windows scroll the page as usual.
   */
  fill?: boolean;
  /** 'wide' uses the whole content area (lists, dashboards); 'form' keeps a readable measure */
  width?: 'wide' | 'form';
}) => (
  <div className={cn('flex flex-col pb-24 md:pb-6', fill && 'lg:min-h-0 lg:flex-1', width === 'form' && 'w-full max-w-4xl')}>
    <Seo title={`${title} | Crunch admin`} description="Staff area" noindex />
    {back && (
      <Link to={back.to} className="mb-3 inline-flex w-fit items-center gap-1.5 text-sm text-ink-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {back.label}
      </Link>
    )}
    {!bare && (
      <div className="mb-4 flex flex-shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

const PILL: Record<EventStatus, string> = {
  draft: 'bg-white/10 text-ink-200',
  registration_open: 'bg-brand-400 text-on-brand',
  registration_closed: 'bg-white/15 text-white',
  check_in: 'bg-sky-400/20 text-sky-200',
  live: 'bg-red-500 text-white',
  results_pending: 'bg-amber-400/20 text-amber-200',
  results_published: 'bg-brand-400/20 text-brand-200',
  archived: 'bg-white/5 text-ink-400',
};

export const StatusPill = ({ status, className }: { status: EventStatus; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider', PILL[status], className)}>
    {status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />}
    {STATUS[status].admin}
  </span>
);

export const Stat = ({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) => (
  <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <p className="text-sm text-ink-400">{label}</p>
    <p className="mt-1 font-display text-4xl font-bold leading-none tabular-nums text-white">{value}</p>
    {sub && <p className="mt-2 text-xs text-ink-500">{sub}</p>}
  </div>
);

/** Confirm anything that changes what the public sees. */
export const ConfirmButton = ({
  children, confirm, onConfirm, variant = 'default', size = 'lg', className, disabled,
}: {
  children: ReactNode; confirm?: { title: string; body: string }; onConfirm: () => Promise<void> | void;
  variant?: 'default' | 'outline' | 'secondary' | 'destructive'; size?: 'default' | 'lg' | 'sm'; className?: string; disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); setOpen(false); } };
  return (
    <>
      <Button variant={variant} size={size} className={className} disabled={disabled || busy} onClick={() => (confirm ? setOpen(true) : run())}>
        {children}
      </Button>
      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent className="border-white/10 bg-ink-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-2xl uppercase text-white">{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-ink-300">{confirm.body}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/5">Cancel</AlertDialogCancel>
              <AlertDialogAction className="rounded-full bg-brand-400 text-on-brand hover:bg-brand-300" onClick={(e) => { e.preventDefault(); run(); }} disabled={busy}>
                {busy ? 'Working…' : 'Yes, continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};

export const Field = ({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) => (
  <div>
    <label htmlFor={htmlFor} className="text-sm font-semibold text-white">{label}</label>
    {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    <div className="mt-2">{children}</div>
  </div>
);

export const inputCls = 'h-12 w-full rounded-xl border border-white/15 bg-field px-4 text-base text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30';

export const Empty = ({ title, body, children }: { title: string; body: string; children?: ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
    <p className="font-display text-2xl font-bold uppercase text-white">{title}</p>
    <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">{body}</p>
    {children && <div className="mt-6">{children}</div>}
  </div>
);
