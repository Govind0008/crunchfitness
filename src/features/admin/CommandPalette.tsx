import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock, BarChart3, CalendarPlus, ClipboardCheck, CreditCard, Dumbbell, FileText, Fingerprint, Inbox, IndianRupee, LayoutDashboard, Megaphone, Settings, Trophy, User, UserPlus, UserSquare, Users,
} from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { searchMembers, type Member } from '@/lib/admin/members';

interface Action { label: string; to: string; icon: ReactNode; hint?: string }
const ACTIONS: Action[] = [
  { label: 'Add member', to: '/admin?task=add', icon: <UserPlus /> },
  { label: 'Collect payment', to: '/admin?task=pay', icon: <IndianRupee /> },
  { label: 'Record PT payment', to: '/admin/payments/new?type=pt', icon: <Dumbbell /> },
  { label: 'Check in member', to: '/admin?task=checkin', icon: <ClipboardCheck /> },
  { label: 'Enroll access', to: '/admin?task=enroll', icon: <Fingerprint /> },
  { label: 'Add enquiry', to: '/admin/enquiries?add=1', icon: <Inbox /> },
  { label: 'Create event', to: '/admin/events/new', icon: <CalendarPlus /> },
];
const PLACES: Action[] = [
  { label: 'Dashboard', to: '/admin', icon: <LayoutDashboard /> },
  { label: 'Members', to: '/admin/members', icon: <Users /> },
  { label: 'Attendance', to: '/admin/attendance', icon: <ClipboardCheck /> },
  { label: 'Members expiring soon', to: '/admin/members?filter=expiring', icon: <AlarmClock /> },
  { label: 'Dues', to: '/admin/payments/dues', icon: <AlarmClock /> },
  { label: 'Today’s collection', to: '/admin/revenue', icon: <BarChart3 /> },
  { label: 'Events', to: '/admin/events', icon: <Trophy /> },
  { label: 'Enquiries', to: '/admin/enquiries', icon: <Inbox /> },
  { label: 'Offers', to: '/admin/offers', icon: <Megaphone /> },
  { label: 'Plans', to: '/admin/plans', icon: <CreditCard /> },
  { label: 'Blog', to: '/admin/blog', icon: <FileText /> },
  { label: 'Team', to: '/admin/team', icon: <UserSquare /> },
  { label: 'Settings', to: '/admin/settings', icon: <Settings /> },
];

/** ⌘K / Ctrl+K — jump to any task or member. Everything here is also reachable by clicking. */
const CommandPalette = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onOpenChange(!open); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);
  useEffect(() => { if (!open) { setQ(''); setMembers([]); } }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setMembers([]); return; }
    const t = setTimeout(() => searchMembers(q.trim()).then((m) => setMembers(m.slice(0, 6))).catch(() => setMembers([])), 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (to: string) => { onOpenChange(false); navigate(to); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-white/10 bg-ink-900 p-0 text-white">
        <DialogTitle className="sr-only">Quick actions</DialogTitle>
        <DialogDescription className="sr-only">Search for a task or a member</DialogDescription>
        <Command className="bg-transparent text-white [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-ink-500 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:gap-3 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3 [&_[cmdk-item][data-selected=true]]:bg-white/[0.08] [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
        <CommandInput placeholder="Type a task or a member’s name…" value={q} onValueChange={setQ} aria-label="Command search" />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>Nothing matches. Try a member’s name or a task like “payment”.</CommandEmpty>
          {members.length > 0 && (
            <CommandGroup heading="Members">
              {members.map((m) => (
                <CommandItem key={m.id} value={`member ${m.name} ${m.phone}`} onSelect={() => go(`/admin/members/${m.id}`)}><User /> {m.name}</CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Actions">
            {ACTIONS.map((a) => <CommandItem key={a.label} value={a.label} onSelect={() => go(a.to)}>{a.icon} {a.label}{a.hint && <CommandShortcut className="normal-case tracking-normal">{a.hint}</CommandShortcut>}</CommandItem>)}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {PLACES.map((a) => <CommandItem key={a.label} value={`go ${a.label}`} onSelect={() => go(a.to)}>{a.icon} {a.label}</CommandItem>)}
          </CommandGroup>
        </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
