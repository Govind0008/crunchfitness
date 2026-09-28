import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, FileText, Instagram, LayoutGrid, LogOut, Megaphone, Menu, UserSquare, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-auth';
import { useRole } from '@/hooks/useRole';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Seo from '@/components/site/Seo';
import { ActorContext } from '@/features/events/admin/actor';
import { AreaContext } from '@/features/events/admin/area';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/marketing', label: 'Desk', icon: <LayoutGrid size={16} />, end: true },
  { to: '/marketing/blog', label: 'Blog', icon: <FileText size={16} /> },
  { to: '/marketing/events', label: 'Events', icon: <CalendarDays size={16} /> },
  { to: '/marketing/offers', label: 'Offers', icon: <Megaphone size={16} /> },
  { to: '/marketing/team', label: 'Team profiles', icon: <UserSquare size={16} /> },
  { to: '/marketing/social', label: 'Instagram', icon: <Instagram size={16} /> },
];

const Spinner = () => (
  <div className="flex min-h-screen items-center justify-center bg-ink-950" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
  </div>
);

/**
 * Guard for /marketing/*: marketing accounts (and admins) only, decided from the role document
 * before anything renders. The Firestore rules enforce the same boundary server-side.
 */
const MarketingRoute = ({ children }: { children: ReactNode }) => {
  const { role, loading, user } = useRole();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/marketing/login" replace />;
  if (role?.role !== 'marketing' && role?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
        <Seo title="Creative Desk | Crunch Fitness" description="Staff area" noindex />
        <div className="max-w-md">
          <p className="hud text-brand-400">The Creative Desk</p>
          <h1 className="mt-4 font-display text-4xl font-bold uppercase text-white">No marketing access</h1>
          <p className="mt-4 text-ink-300">You’re signed in as <strong className="text-white">{user.email}</strong>. Ask the gym owner to add this account to the marketing team in Settings → Staff access.</p>
          <Button variant="outline" className="mt-8" onClick={() => signOut(auth)}>Sign out</Button>
        </div>
      </div>
    );
  }
  return (
    <ActorContext.Provider value={{ uid: user.uid, email: user.email ?? 'marketing' }}>
      <AreaContext.Provider value="/marketing">{children}</AreaContext.Provider>
    </ActorContext.Provider>
  );
};

const Frame = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, user } = useRole();
  const [open, setOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  useEffect(() => { main.current?.scrollTo({ top: 0 }); setOpen(false); }, [pathname]);
  const current = (to: string, end?: boolean) => (end ? pathname.replace(/\/$/, '') === to : pathname.startsWith(to));

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-white" data-marketing-shell>
      <Seo title="Creative Desk | Crunch Fitness" description="Staff area" noindex />
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={cn('fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-white/[0.06] bg-ink-900 transition-transform duration-300 md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-5">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold uppercase leading-none tracking-wide text-white">Creative Desk</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-400">Crunch Fitness</p>
            <p className="mt-2 truncate text-xs text-ink-500">{user?.email}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-1 text-ink-400 hover:text-white md:hidden" aria-label="Close menu"><X size={18} /></button>
        </div>
        <nav aria-label="Marketing" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {NAV.map((n) => {
            const on = current(n.to, n.end);
            return (
              <Link key={n.to} to={n.to} aria-current={on ? 'page' : undefined}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors', on ? 'bg-brand-400/15 text-brand-300' : 'text-ink-400 hover:bg-white/[0.04] hover:text-white')}>
                {n.icon} {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-0.5 border-t border-white/[0.06] px-3 py-3">
          {role?.role === 'admin' && (
            <Link to="/admin" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink-400 hover:bg-white/[0.04] hover:text-white"><ArrowLeft size={16} /> Gym admin</Link>
          )}
          <button type="button" onClick={async () => { await signOut(auth); navigate('/marketing/login'); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink-400 hover:bg-red-500/10 hover:text-red-300">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex h-screen w-full flex-1 flex-col overflow-hidden md:ml-60">
        <header className="z-20 flex h-14 flex-shrink-0 items-center gap-3 border-b border-white/[0.06] bg-ink-950/95 px-4 md:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-ink-400 hover:bg-white/[0.06] hover:text-white" aria-label="Open menu"><Menu size={20} /></button>
          <p className="font-display text-lg font-bold uppercase tracking-wide">Creative Desk</p>
        </header>
        <main ref={main} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
            <Suspense fallback={<div className="flex h-64 items-center justify-center" role="status" aria-label="Loading section"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" /></div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

/** The persistent marketing shell for /marketing/* (except login) — mounted once, content swaps inside. */
const MarketingLayout = () => <MarketingRoute><Frame /></MarketingRoute>;

export default MarketingLayout;
