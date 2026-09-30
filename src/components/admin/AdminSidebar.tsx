import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlarmClock, BarChart3, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardCheck, CreditCard,
  Dumbbell, FileSpreadsheet, FileText, Fingerprint, Inbox, IndianRupee, LayoutDashboard, Megaphone, Menu, Settings, Trophy, UserSquare, Users, X,
} from 'lucide-react';
import type { NavKey } from './tabs';

interface Item { key: NavKey; label: string; icon: ReactNode; to: string }
interface Group { id: string; title?: string; items: Item[] }

/**
 * What front-desk staff use every day, in plain sight. Everything else is one click away under
 * "More", which opens by itself when you're on one of its pages.
 */
const PRIMARY: Group[] = [
  { id: 'home', items: [{ key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, to: '/admin' }] },
  { id: 'people', title: 'People', items: [
    { key: 'members', label: 'Members', icon: <Users size={18} />, to: '/admin/members' },
    { key: 'trainers', label: 'Trainers', icon: <Dumbbell size={18} />, to: '/admin/trainers' },
  ] },
  { id: 'operations', title: 'Operations', items: [
    { key: 'attendance', label: 'Attendance', icon: <ClipboardCheck size={18} />, to: '/admin/attendance' },
    { key: 'access', label: 'Access', icon: <Fingerprint size={18} />, to: '/admin/access' },
  ] },
  { id: 'money', title: 'Money', items: [
    { key: 'payments', label: 'Payments', icon: <IndianRupee size={18} />, to: '/admin/payments' },
    { key: 'dues', label: 'Dues', icon: <AlarmClock size={18} />, to: '/admin/payments/dues' },
  ] },
  { id: 'growth', title: 'Growth', items: [
    { key: 'events', label: 'Events', icon: <Trophy size={18} />, to: '/admin/events' },
    { key: 'enquiries', label: 'Enquiries', icon: <Inbox size={18} />, to: '/admin/enquiries' },
  ] },
];
/** Less frequent sections, grouped: money reports, marketing content, then system. */
const MORE: Group[] = [
  { id: 'insights', title: 'Insights', items: [
    { key: 'revenue', label: 'Revenue', icon: <BarChart3 size={16} />, to: '/admin/revenue' },
    { key: 'reports', label: 'Reports', icon: <FileSpreadsheet size={16} />, to: '/admin/reports' },
  ] },
  { id: 'website', title: 'Website', items: [
    { key: 'offers', label: 'Offers', icon: <Megaphone size={16} />, to: '/admin/offers' },
    { key: 'plans', label: 'Plans', icon: <CreditCard size={16} />, to: '/admin/plans' },
    { key: 'posts', label: 'Blog', icon: <FileText size={16} />, to: '/admin/blog' },
    { key: 'team', label: 'Team', icon: <UserSquare size={16} />, to: '/admin/team' },
  ] },
  { id: 'system', title: 'System', items: [
    { key: 'activity', label: 'Activity', icon: <Activity size={16} />, to: '/admin/activity' },
    { key: 'settings', label: 'Settings', icon: <Settings size={16} />, to: '/admin/settings' },
  ] },
];
const MORE_ITEMS = MORE.flatMap((g) => g.items);
const MORE_KEY = 'crunch.admin.nav.more';

interface Props {
  active: NavKey;
  open: boolean;
  onClose: () => void;
  /** Desktop: icons only */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  unreadEnquiries?: number;
}

const AdminSidebar = ({ active, open, onClose, collapsed, onToggleCollapsed, unreadEnquiries = 0 }: Props) => {
  const current = active;
  const inMore = MORE_ITEMS.some((i) => i.key === current);
  const [moreOpen, setMoreOpen] = useState(() => { try { return localStorage.getItem(MORE_KEY) === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem(MORE_KEY, moreOpen ? '1' : '0'); } catch { /* per-viewer convenience only */ } }, [moreOpen]);
  const showMore = moreOpen || inMore;
  // The mobile drawer always shows labels
  const icons = collapsed && !open;

  const link = (item: Item, small = false) => {
    const on = current === item.key;
    const badge = item.key === 'enquiries' && unreadEnquiries > 0
      ? <span className={icons ? 'absolute right-1.5 top-1 h-2 w-2 rounded-full bg-red-500' : 'ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white'}>{icons ? <span className="sr-only">{unreadEnquiries} unread</span> : unreadEnquiries}</span>
      : null;
    const cls = `group relative flex w-full items-center gap-3 rounded-lg ${icons ? 'justify-center px-0 py-2.5' : small ? 'px-3 py-1.5' : 'px-3 py-2'} ${small ? 'text-[13px]' : 'text-sm'} font-semibold transition-colors motion-reduce:transition-none ${on
      ? 'bg-brand-400/[0.12] text-brand-fg before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-brand-400'
      : small ? 'text-ink-500 hover:bg-white/[0.04] hover:text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'}`;
    const inner = (
      <>
        {item.icon}
        <span className={icons ? 'sr-only' : ''}>{item.label}</span>
        {badge}
        {icons && <span role="tooltip" className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink-950 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>{item.label}</span>}
      </>
    );
    return <Link key={item.key} to={item.to} onClick={onClose} className={cls} aria-current={on ? 'page' : undefined}>{inner}</Link>;
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden />}
      <aside className={`fixed left-0 top-0 z-40 flex h-[100dvh] flex-col border-r border-white/[0.08] bg-rail transition-[transform,width] duration-300 motion-reduce:transition-none ${icons ? 'md:w-16' : 'md:w-60'} w-64 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className={`flex h-14 flex-shrink-0 items-center border-b border-white/[0.08] ${icons ? 'justify-center px-2' : 'justify-between px-5'}`}>
          {icons
            ? <img src="/images/logo.webp" alt="Crunch Fitness" className="h-8 w-8 object-contain" />
            : <div className="min-w-0"><p className="font-display text-xl font-bold uppercase leading-none tracking-wide text-white">Crunch Fitness</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-fg">Gym admin</p></div>}
          <button onClick={onClose} className="p-1 text-ink-400 hover:text-white md:hidden" aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav aria-label="Admin" className={`flex-1 overflow-y-auto py-3 ${icons ? 'px-2' : 'px-3'}`}>
          {PRIMARY.map((g) => (
            <div key={g.id} className={g.title ? 'mt-4' : ''}>
              {g.title && !icons && <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500">{g.title}</p>}
              {g.title && icons && <div className="mx-3 mb-2 border-t border-white/[0.06]" aria-hidden />}
              <div className="space-y-0.5">{g.items.map((i) => link(i))}</div>
            </div>
          ))}

          <div className="mt-5 border-t border-white/[0.06] pt-3">
            <button type="button" onClick={() => setMoreOpen(!moreOpen)} aria-expanded={showMore} aria-controls="nav-more" disabled={inMore}
              className={`flex w-full items-center rounded-lg text-[10px] font-bold uppercase tracking-[0.18em] text-ink-500 hover:text-ink-300 disabled:cursor-default ${icons ? 'justify-center py-2' : 'justify-between px-3 py-1'}`}>
              {icons ? <Menu size={16} aria-hidden /> : 'More'}
              {icons ? <span className="sr-only">More</span> : <ChevronDown size={12} className={`transition-transform motion-reduce:transition-none ${showMore ? '' : '-rotate-90'}`} aria-hidden />}
            </button>
            {showMore && (
              <div id="nav-more" className="mt-1 space-y-3">
                {MORE.map((g) => (
                  <div key={g.id} role="group" aria-label={g.title}>
                    {!icons && <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500" aria-hidden>{g.title}</p>}
                    <div className="space-y-0.5">{g.items.map((i) => link(i, true))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden border-t border-white/[0.06] p-2 md:block">
          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-ink-500 hover:bg-white/[0.04] hover:text-white ${icons ? 'justify-center px-0' : ''}`}>
            {collapsed ? <ChevronsRight size={16} aria-hidden /> : <><ChevronsLeft size={16} aria-hidden /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  );
};

/** Phones: the four things staff reach for most, one tap away. Everything else is under "More". */
const BOTTOM: { key: NavKey; label: string; icon: ReactNode; to: string }[] = [
  { key: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} />, to: '/admin' },
  { key: 'members', label: 'Members', icon: <Users size={20} />, to: '/admin/members' },
  { key: 'attendance', label: 'Attendance', icon: <ClipboardCheck size={20} />, to: '/admin/attendance' },
  { key: 'payments', label: 'Payments', icon: <IndianRupee size={20} />, to: '/admin/payments' },
];
export const AdminBottomNav = ({ active, onMore }: { active: NavKey; onMore: () => void }) => (
  <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/[0.08] bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
    {BOTTOM.map((b) => {
      const on = active === b.key || (b.key === 'payments' && (active === 'dues' || active === 'revenue')) || (b.key === 'attendance' && active === 'access');
      return (
        <Link key={b.key} to={b.to} aria-current={on ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${on ? 'text-brand-fg' : 'text-ink-400'}`}>
          {b.icon}{b.label}
        </Link>
      );
    })}
    <button type="button" onClick={onMore} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-ink-400" aria-label="More sections"><Menu size={20} />More</button>
  </nav>
);

export default AdminSidebar;
