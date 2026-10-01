import { Suspense, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Command, LogOut, Menu, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useStaffTheme, type ThemePref } from '@/lib/theme';
import { markBootReady } from '@/components/loading/bootState';
import PageSkeleton from '@/components/loading/PageSkeleton';
import CommandPalette from './CommandPalette';
import OpenDoorButton from '@/components/admin/OpenDoorButton';
import { signOut } from 'firebase/auth';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { adminDataChanged } from '@/lib/queryClient';
import { auth } from '@/lib/firebase-auth';
import AdminSidebar, { AdminBottomNav } from '@/components/admin/AdminSidebar';
import type { NavKey } from '@/components/admin/tabs';
import { EventAdminRoute } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import Seo from '@/components/site/Seo';
import AdminSearch from './AdminSearch';

// Start loading the admin pages as soon as the shell loads, not after the guard has finished
void import('./index').catch(() => {});

/** Which sidebar item and top-bar section a URL belongs to. */
function sectionOf(pathname: string): { nav: NavKey; area: string } {
  const p = pathname.replace(/\/$/, '');
  if (p === '/admin') return { nav: 'dashboard', area: 'Home' };
  if (p.startsWith('/admin/members')) return { nav: 'members', area: 'People' };
  if (p.startsWith('/admin/trainers')) return { nav: 'trainers', area: 'People' };
  if (p.startsWith('/admin/attendance')) return { nav: 'attendance', area: 'Operations' };
  if (p.startsWith('/admin/access')) return { nav: 'access', area: 'Operations' };
  if (p.startsWith('/admin/events')) return { nav: 'events', area: 'Growth' };
  if (p.startsWith('/admin/payments/dues')) return { nav: 'dues', area: 'Money' };
  if (p.startsWith('/admin/payments')) return { nav: 'payments', area: 'Money' };
  if (p.startsWith('/admin/revenue')) return { nav: 'revenue', area: 'Money' };
  if (p.startsWith('/admin/reports')) return { nav: 'reports', area: 'More' };
  if (p.startsWith('/admin/activity')) return { nav: 'activity', area: 'More' };
  if (p.startsWith('/admin/settings/access')) return { nav: 'settings', area: 'Settings' };
  if (p.startsWith('/admin/settings')) return { nav: 'settings', area: 'More' };
  if (p.startsWith('/admin/enquiries')) return { nav: 'enquiries', area: 'Growth' };
  if (p.startsWith('/admin/offers')) return { nav: 'offers', area: 'Website' };
  if (p.startsWith('/admin/blog')) return { nav: 'posts', area: 'Website' };
  if (p.startsWith('/admin/team')) return { nav: 'team', area: 'Website' };
  if (p.startsWith('/admin/plans')) return { nav: 'plans', area: 'Website' };
  return { nav: 'dashboard', area: 'Home' };
}

const LABEL: Partial<Record<NavKey, string>> = {
  dashboard: 'Dashboard', members: 'Members', trainers: 'Trainers', attendance: 'Attendance', access: 'Access', events: 'Events',
  payments: 'Payments', dues: 'Dues', revenue: 'Revenue', reports: 'Reports', activity: 'Activity', settings: 'Settings',
  posts: 'Blog', team: 'Team', offers: 'Offers', plans: 'Plans', enquiries: 'Enquiries',
};
const COLLAPSE_KEY = 'crunch.admin.sidebar.collapsed';

/** Mounts only once the first page's code has loaded (same Suspense boundary as the Outlet):
 *  that's when the boot screen may hand over. The page's own data shows skeletons from here. */
const BootReady = () => { useEffect(() => { markBootReady(); }, []); return null; };

const Frame = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const actor = useActor();
  const [menuOpen, setMenuOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const theme = useStaffTheme();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } });
  const main = useRef<HTMLElement>(null);
  const { nav, area } = sectionOf(pathname);
  const section = LABEL[nav] ?? area;
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* convenience only */ } return !c; });

  // Sidebar badge: a count (not a live listener, which would queue ahead of the page's own
  // queries). Cached for 2 minutes and re-read every 5; opening or answering an enquiry
  // refreshes it at once (every admin save does — see adminDataChanged).
  const unread = useQuery({
    queryKey: ['admin', 'unreadEnquiries'],
    queryFn: () => getCountFromServer(query(collection(db, 'enquiries'), where('read', '==', false))).then((c) => c.data().count),
    refetchInterval: 5 * 60_000,
  }).data ?? 0;
  // Screens whose writes don't go through the admin data modules (the member imports, and access
  // control's own device and enrolment writes): leaving one refreshes the rest of the admin
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname && /^\/admin\/(members\/import|access|settings\/access)/.test(lastPath.current)) adminDataChanged();
    lastPath.current = pathname;
  }, [pathname]);
  // New page → start at the top of the content area (the shell itself never scrolls away)
  useEffect(() => { main.current?.scrollTo({ top: 0 }); setMenuOpen(false); }, [pathname]);

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-ink-950 text-white" data-admin-shell>
      <Seo title="Crunch admin" description="Staff area" noindex />
      <AdminSidebar active={nav} open={menuOpen} onClose={() => setMenuOpen(false)} unreadEnquiries={unread} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className={`flex h-[100dvh] min-w-0 w-full flex-1 flex-col overflow-hidden transition-[margin] duration-300 motion-reduce:transition-none ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
        <header className="z-20 flex h-14 flex-shrink-0 items-center gap-3 border-b border-white/[0.08] bg-ink-950 px-4 md:px-5 lg:px-6">
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 text-ink-400 hover:bg-white/[0.06] hover:text-white md:hidden" aria-label="Open menu"><Menu size={20} /></button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
            {area !== section && <><span className="text-ink-500" data-admin-area>{area}</span><ChevronRight size={14} className="text-ink-600" aria-hidden /></>}
            <span className="truncate font-semibold text-white" {...(area === section ? { 'data-admin-area': true } : {})}>{section}</span>
          </nav>
          <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto sm:flex-1">
            <AdminSearch />
            <OpenDoorButton />
            <button type="button" onClick={() => setPalette(true)} className="hidden h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/[0.1] px-3 text-sm text-ink-300 hover:border-white/25 hover:text-white xl:flex" aria-label="Quick actions (Ctrl K)">
              <Command size={14} aria-hidden /> Quick actions <kbd className="rounded bg-white/[0.08] px-1.5 text-[10px] text-ink-400">Ctrl K</kbd>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-300 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400" aria-label={`Theme: ${theme.pref}`}>
                  {theme.resolved === 'light' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 border-white/10 bg-ink-900 text-white">
                <DropdownMenuLabel className="text-xs font-normal text-ink-500">Theme</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme.pref} onValueChange={(v) => theme.choose(v as ThemePref)} aria-label="Theme">
                  <DropdownMenuRadioItem value="light"><Sun className="mr-2 h-4 w-4" /> Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" /> Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system"><Monitor className="mr-2 h-4 w-4" /> System</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold text-white hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400" aria-label={`Account: ${actor.email}`}>
                  {(actor.email[0] ?? 'A').toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 border-white/10 bg-ink-900 text-white">
                <DropdownMenuLabel className="font-normal"><span className="block text-xs text-ink-500">Signed in as</span><span className="block truncate text-sm">{actor.email}</span></DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onSelect={() => navigate('/admin/settings')}><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPalette(true)}><Command className="mr-2 h-4 w-4" /> Quick actions</DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem className="text-red-300 focus:text-red-200" onSelect={async () => { await signOut(auth); window.location.assign('/admin/login'); /* full reload: clears every in-memory cache on shared desks */ }}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {/* The one page-level scroll container. Data pages in "fill" mode (AdminShell) keep it
            still on wide screens and scroll their own data region instead. */}
        <main ref={main} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex h-full w-full max-w-[1760px] flex-col px-4 pt-4 sm:px-5 lg:px-6 lg:pt-5 xl:px-8">
            {/* Sections load inside the shell — the sidebar and header stay put */}
            <Suspense fallback={<PageSkeleton variant={nav === 'dashboard' ? 'dashboard' : /^\/admin\/(members|trainers)\/[^/]+$/.test(pathname) && !pathname.endsWith('/new') && !pathname.endsWith('/import') ? 'profile' : 'table'} />}>
              <Outlet />
              <BootReady />
            </Suspense>
          </div>
        </main>
      </div>
      <AdminBottomNav active={nav} onMore={() => setMenuOpen(true)} />
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
};

/**
 * The persistent admin shell for every /admin/* page (except login). Mounted once: the guard,
 * sidebar, header, search and auth state survive navigation; only the content area changes.
 */
const AdminLayout = () => <EventAdminRoute><Frame /></EventAdminRoute>;

export default AdminLayout;
