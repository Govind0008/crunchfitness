import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/firebase-auth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { ADMIN_TABS, type AdminTab, type NavKey } from '@/components/admin/tabs';
import { EventAdminRoute } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import Seo from '@/components/site/Seo';
import AdminSearch from './AdminSearch';

const TAB_AREA: Record<AdminTab, string> = {
  posts: 'Content', team: 'Content', accounts: 'People', offers: 'Business', plans: 'Business', enquiries: 'Business', roster: 'Daily operations', schedule: 'Daily operations',
};

/** Which sidebar item and top-bar section a URL belongs to. */
function sectionOf(pathname: string, search: string): { nav: NavKey; area: string } {
  const p = pathname.replace(/\/$/, '');
  if (p === '/admin') return { nav: 'dashboard', area: 'Dashboard' };
  if (p.startsWith('/admin/members')) return { nav: 'members', area: 'People' };
  if (p.startsWith('/admin/trainers')) return { nav: 'trainers', area: 'People' };
  if (p.startsWith('/admin/attendance')) return { nav: 'attendance', area: 'Daily operations' };
  if (p.startsWith('/admin/events')) return { nav: 'events', area: 'Community' };
  if (p.startsWith('/admin/payments/dues')) return { nav: 'dues', area: 'Money' };
  if (p.startsWith('/admin/payments')) return { nav: 'payments', area: 'Money' };
  if (p.startsWith('/admin/revenue')) return { nav: 'revenue', area: 'Money' };
  if (p.startsWith('/admin/reports')) return { nav: 'reports', area: 'System' };
  if (p.startsWith('/admin/activity')) return { nav: 'activity', area: 'System' };
  if (p.startsWith('/admin/settings')) return { nav: 'settings', area: 'System' };
  const tab = new URLSearchParams(search).get('tab') as AdminTab | null;
  const t: AdminTab = tab && ADMIN_TABS.includes(tab) ? tab : 'posts';
  return { nav: t, area: TAB_AREA[t] };
}

const Frame = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const actor = useActor();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const main = useRef<HTMLElement>(null);
  const { nav, area } = sectionOf(pathname, search);

  // One small live query for the sidebar badge — not re-subscribed on navigation
  useEffect(() => onSnapshot(query(collection(db, 'enquiries'), where('read', '==', false)), (s) => setUnread(s.size), () => setUnread(0)), []);
  // New page → start at the top of the content area (the shell itself never scrolls away)
  useEffect(() => { main.current?.scrollTo({ top: 0 }); setMenuOpen(false); }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-white" data-admin-shell>
      <Seo title="Crunch admin" description="Staff area" noindex />
      <AdminSidebar active={nav} email={actor.email} open={menuOpen} onClose={() => setMenuOpen(false)} unreadEnquiries={unread}
        onLogout={async () => { await signOut(auth); navigate('/admin/login'); }} />
      <div className="flex h-screen w-full flex-1 flex-col overflow-hidden md:ml-60">
        <header className="z-20 flex h-16 flex-shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-900/95 px-4 backdrop-blur md:px-6">
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 text-gray-400 hover:bg-zinc-800 hover:text-white md:hidden" aria-label="Open menu"><Menu size={20} /></button>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-base font-bold text-white" data-admin-area>{area}</p>
            <p className="text-xs text-gray-500">Crunch Fitness Club — Admin</p>
          </div>
          <div className="ml-auto flex w-full justify-end sm:w-auto sm:flex-1"><AdminSearch /></div>
        </header>
        <main ref={main} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
            {/* Sections load inside the shell — the sidebar and header stay put */}
            <Suspense fallback={<div className="flex h-64 items-center justify-center" role="status" aria-label="Loading section"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" /></div>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

/**
 * The persistent admin shell for every /admin/* page (except login). Mounted once: the guard,
 * sidebar, header, search and auth state survive navigation; only the content area changes.
 */
const AdminLayout = () => <EventAdminRoute><Frame /></EventAdminRoute>;

export default AdminLayout;
