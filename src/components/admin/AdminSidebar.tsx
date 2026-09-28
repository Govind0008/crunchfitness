import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Crown, FileText, Inbox, LogOut, Megaphone, Sparkles, Trophy, Users, X } from 'lucide-react';

import type { AdminTab } from './tabs';

const ITEMS: { key: AdminTab; label: string; icon: ReactNode; section?: string }[] = [
  { key: 'posts', label: 'Blog Posts', icon: <FileText size={16} /> },
  { key: 'team', label: 'Team & Trainers', icon: <Users size={16} /> },
  { key: 'offers', label: 'Offers & Promos', icon: <Megaphone size={16} /> },
  { key: 'plans', label: 'Membership Plans', icon: <CreditCard size={16} /> },
  { key: 'enquiries', label: 'Enquiries', icon: <Inbox size={16} /> },
  { key: 'roster', label: 'Duty Roster', icon: <Calendar size={16} />, section: 'Trainer Portal' },
  { key: 'schedule', label: 'Class Schedule', icon: <Sparkles size={16} /> },
  { key: 'accounts', label: 'Trainer Accounts', icon: <Crown size={16} /> },
];

const itemCls = (active: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active ? 'bg-green-400/15 text-green-400' : 'text-gray-400 hover:bg-zinc-800 hover:text-white'}`;

interface Props {
  active: AdminTab | 'events';
  email?: string | null;
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  /** Inside the dashboard: switch tabs in place. Elsewhere (events) items link back to the dashboard tab. */
  onSelect?: (tab: AdminTab) => void;
  counts?: Partial<Record<AdminTab, number>>;
  unreadEnquiries?: number;
}

/** The one admin sidebar — shared by the dashboard and the events screens. */
const AdminSidebar = ({ active, email, open, onClose, onLogout, onSelect, counts = {}, unreadEnquiries = 0 }: Props) => (
  <>
    {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden />}
    <aside className={`fixed top-0 left-0 h-screen w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <img src="/lovable-uploads/crunch.png" alt="logo" className="h-10 w-auto object-contain" />
          <p className="text-xs text-gray-500 mt-1 truncate">{email}</p>
        </div>
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white p-1" aria-label="Close menu"><X size={18} /></button>
      </div>

      <nav aria-label="Admin" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {ITEMS.map((item) => {
          const badge = item.key === 'enquiries' && unreadEnquiries > 0
            ? <span className="ml-auto text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadEnquiries}</span>
            : counts[item.key] != null ? <span className="ml-auto text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full text-gray-400">{counts[item.key]}</span> : null;
          const inner = <>{item.icon} {item.label}{badge}</>;
          return (
            <div key={item.key}>
              {item.section && <p className="px-3 pt-4 pb-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{item.section}</p>}
              {onSelect
                ? <button onClick={() => { onSelect(item.key); onClose(); }} className={itemCls(active === item.key)} aria-current={active === item.key ? 'page' : undefined}>{inner}</button>
                : <Link to={`/admin/dashboard?tab=${item.key}`} className={itemCls(false)}>{inner}</Link>}
            </div>
          );
        })}
        <p className="px-3 pt-4 pb-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Community</p>
        <Link to="/admin/events" onClick={onClose} className={itemCls(active === 'events')} aria-current={active === 'events' ? 'page' : undefined}>
          <Trophy size={16} /> Events &amp; competitions
        </Link>
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  </>
);

export default AdminSidebar;
