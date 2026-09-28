import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlarmClock, BarChart3, CalendarDays, CalendarRange, ClipboardCheck, CreditCard, Dumbbell, FileSpreadsheet, FileText, Inbox,
  IndianRupee, LayoutDashboard, LogOut, Megaphone, Settings, Trophy, UserSquare, Users, X,
} from 'lucide-react';
import type { AdminTab, NavKey } from './tabs';

interface Item { key: NavKey; label: string; icon: ReactNode; to?: string }
/** Home → People → Daily operations → Money → Community → Business → Content → System */
const GROUPS: { title?: string; items: Item[] }[] = [
  { items: [{ key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, to: '/admin' }] },
  { title: 'People', items: [
    { key: 'members', label: 'Members', icon: <Users size={16} />, to: '/admin/members' },
    { key: 'trainers', label: 'Trainers', icon: <Dumbbell size={16} />, to: '/admin/trainers' },
  ] },
  { title: 'Daily operations', items: [
    { key: 'attendance', label: 'Check-ins', icon: <ClipboardCheck size={16} />, to: '/admin/attendance' },
    { key: 'schedule', label: 'Classes', icon: <CalendarDays size={16} /> },
    { key: 'roster', label: 'Duty roster', icon: <CalendarRange size={16} /> },
  ] },
  { title: 'Money', items: [
    { key: 'payments', label: 'Payments', icon: <IndianRupee size={16} />, to: '/admin/payments' },
    { key: 'dues', label: 'Dues', icon: <AlarmClock size={16} />, to: '/admin/payments/dues' },
    { key: 'revenue', label: 'Revenue', icon: <BarChart3 size={16} />, to: '/admin/revenue' },
  ] },
  { title: 'Community', items: [{ key: 'events', label: 'Events', icon: <Trophy size={16} />, to: '/admin/events' }] },
  { title: 'Business', items: [
    { key: 'enquiries', label: 'Enquiries', icon: <Inbox size={16} /> },
    { key: 'offers', label: 'Offers', icon: <Megaphone size={16} /> },
    { key: 'plans', label: 'Plans', icon: <CreditCard size={16} /> },
  ] },
  { title: 'Content', items: [
    { key: 'posts', label: 'Blog', icon: <FileText size={16} /> },
    { key: 'team', label: 'Team', icon: <UserSquare size={16} /> },
  ] },
  { title: 'System', items: [
    { key: 'reports', label: 'Reports', icon: <FileSpreadsheet size={16} />, to: '/admin/reports' },
    { key: 'activity', label: 'Activity', icon: <Activity size={16} />, to: '/admin/activity' },
    { key: 'settings', label: 'Settings', icon: <Settings size={16} />, to: '/admin/settings' },
  ] },
];

// Legacy tabs that belong to a sidebar entry without having their own
const PARENT: Partial<Record<NavKey, NavKey>> = { accounts: 'trainers' };

const itemCls = (active: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`;

interface Props {
  active: NavKey;
  email?: string | null;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  /** Inside the dashboard: switch legacy tabs in place. Elsewhere they link to /admin/dashboard?tab= */
  onSelect?: (tab: AdminTab) => void;
  counts?: Partial<Record<NavKey, number>>;
  unreadEnquiries?: number;
}

/** The one admin sidebar — shared by the dashboard, Admin 2.0 pages and the events screens. */
const AdminSidebar = ({ active, email, open, onClose, onLogout, onSelect, counts = {}, unreadEnquiries = 0 }: Props) => {
  const current = PARENT[active] ?? active;
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden />}
      <aside className={`fixed top-0 left-0 h-screen w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="min-w-0">
            <img src="/lovable-uploads/crunch.png" alt="Crunch Fitness" className="h-9 w-auto object-contain" />
            <p className="text-xs text-gray-500 mt-1 truncate">{email}</p>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white p-1" aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav aria-label="Admin" className="flex-1 px-3 py-3 overflow-y-auto">
          {GROUPS.map((g, gi) => (
            <div key={gi} className={gi ? 'mt-3' : ''}>
              {g.title && <p className="px-3 pb-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{g.title}</p>}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const on = current === item.key;
                  const badge = item.key === 'enquiries' && unreadEnquiries > 0
                    ? <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadEnquiries}</span>
                    : counts[item.key] != null ? <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{counts[item.key]}</span> : null;
                  const inner = <>{item.icon} {item.label}{badge}</>;
                  if (item.to) return <Link key={item.key} to={item.to} onClick={onClose} className={itemCls(on)} aria-current={on ? 'page' : undefined}>{inner}</Link>;
                  const tab = item.key as AdminTab;
                  return onSelect
                    ? <button key={item.key} onClick={() => { onSelect(tab); onClose(); }} className={itemCls(on)} aria-current={on ? 'page' : undefined}>{inner}</button>
                    : <Link key={item.key} to={`/admin/dashboard?tab=${tab}`} onClick={onClose} className={itemCls(on)} aria-current={on ? 'page' : undefined}>{inner}</Link>;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-zinc-800">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
