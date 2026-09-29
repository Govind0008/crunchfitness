import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { memberCode, membersByIds, searchMembers, todayIST, type Member } from '@/lib/admin/members';
import { accessEligibility } from '@/lib/access';
import { identityByDeviceUserId } from '@/lib/access/store';
import { fmtDate } from './members/lookups';
import { paymentByReceipt, rupees } from '@/lib/admin/payments';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/events';

interface Hit { group: 'Members' | 'Trainers' | 'Events' | 'Enquiries' | 'Payments'; id: string; title: string; sub: string; to: string }
interface Small { trainers: { id: string; name: string; role?: string }[]; events: { id: string; title: string; eventDate?: string; status?: string }[]; enquiries: { id: string; name: string; status?: string; plan?: string }[] }

/** "Active until 31 Oct 2026 · Access enabled" — context only, never the phone number. */
function memberSub(m: Member, via: string) {
  const today = todayIST();
  const a = accessEligibility(m, today);
  const status = m.membershipEnd ? (m.membershipEnd >= today ? `Active until ${fmtDate(m.membershipEnd)}` : `Expired ${fmtDate(m.membershipEnd)}`) : 'No membership';
  return [via || memberCode(m.id), status, a.eligible ? 'Access enabled' : 'Access disabled'].join(' · ');
}

/**
 * One search box for the whole admin: members (server-side prefix search), and the small
 * collections — trainers, events, recent enquiries — filtered in the browser.
 * Results show names and context only, never phone numbers or emails.
 */
const AdminSearch = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [small, setSmall] = useState<Small | null>(null);
  const [members, setMembers] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere in the admin
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadSmall = () => {
    if (small) return;
    Promise.all([
      getDocs(collection(db, 'teamMembers')).catch(() => null),
      getDocs(query(collection(db, 'events'), orderBy('eventDate', 'desc'), limit(100))).catch(() => null),
      getDocs(query(collection(db, 'enquiries'), orderBy('submittedAt', 'desc'), limit(300))).catch(() => null),
    ]).then(([t, e, n]) => setSmall({
      trainers: t?.docs.map((d) => ({ id: d.id, ...(d.data() as { name: string; role?: string }) })) ?? [],
      events: e?.docs.map((d) => ({ id: d.id, ...(d.data() as { title: string; eventDate?: string; status?: string }) })) ?? [],
      enquiries: n?.docs.map((d) => ({ id: d.id, ...(d.data() as { name: string; status?: string; plan?: string }) })) ?? [],
    }));
  };

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setMembers([]); return; }
    const t = setTimeout(() => {
      // "CR-R-0012" → that receipt; anything else → members
      if (/^cr-r-\d+$/i.test(term)) paymentByReceipt(term).then((p) => setMembers(p ? [{ group: 'Payments', id: p.id, title: `${rupees(p.amountPaise)} · ${p.receiptNo ?? 'Imported payment'}`, sub: `Payment · ${p.memberName} · ${p.paidOn}`, to: `/admin/payments/${p.id}` }] : [])).catch(() => setMembers([]));
      else {
        // A bare number can also be a device user ID on a biometric device
        const devUser = /^\d{1,8}$/.test(term) ? identityByDeviceUserId(term).then((ids) => membersByIds(ids.map((i) => i.memberId)).then((ms) => ms.map((m) => ({ m, via: `Device user ${term}` })))).catch(() => []) : Promise.resolve([]);
        Promise.all([searchMembers(term).catch(() => [] as Member[]), devUser]).then(([ms, byDevice]) => {
          const all = [...byDevice, ...ms.map((m) => ({ m, via: '' }))].filter((x, i, arr) => arr.findIndex((y) => y.m.id === x.m.id) === i);
          setMembers(all.map(({ m, via }) => ({ group: 'Members', id: m.id, title: m.name, sub: memberSub(m, via), to: `/admin/members/${m.id}` })));
        });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const hits = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2 || !small) return members;
    const has = (s?: string) => !!s && s.toLowerCase().includes(term);
    return [
      ...members,
      ...small.trainers.filter((t) => has(t.name)).slice(0, 5).map((t): Hit => ({ group: 'Trainers', id: t.id, title: t.name, sub: t.role ?? 'Trainer', to: '/admin/trainers' })),
      ...small.events.filter((e) => has(e.title)).slice(0, 5).map((e): Hit => ({ group: 'Events', id: e.id, title: e.title, sub: `Event${e.status && e.status in STATUS ? ` · ${STATUS[e.status as keyof typeof STATUS].admin}` : ''}${e.eventDate ? ` · ${e.eventDate}` : ''}`, to: `/admin/events/${e.id}` })),
      ...small.enquiries.filter((e) => has(e.name)).slice(0, 5).map((e): Hit => ({ group: 'Enquiries', id: e.id, title: e.name, sub: `Enquiry · ${e.status ?? 'new'}${e.plan ? ` · ${e.plan}` : ''}`, to: '/admin/enquiries' })),
    ];
  }, [q, small, members]);
  useEffect(() => setCursor(0), [hits.length]);

  // Close when clicking elsewhere
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const go = (h: Hit) => { setOpen(false); setQ(''); navigate(h.to); };

  return (
    <div ref={box} className="relative w-full max-w-md">
      <label className="relative block">
        <span className="sr-only">Search members, trainers, events and enquiries</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
        <input
          ref={input}
          role="combobox"
          aria-expanded={open && q.trim().length >= 2}
          aria-controls="admin-search-results"
          value={q}
          onFocus={() => { setOpen(true); loadSmall(); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
            if (e.key === 'Enter' && hits[cursor]) go(hits[cursor]);
            if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }}
          aria-label="Search members, trainers, events, payments and device user IDs"
          placeholder="Search members, payments, events…  ( / )"
          className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-800 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none"
        />
      </label>
      {open && q.trim().length >= 2 && (
        <ul id="admin-search-results" role="listbox" className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1 shadow-2xl">
          {hits.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">No matches for “{q.trim()}”</li>}
          {hits.map((h, i) => (
            <li key={`${h.group}-${h.id}`} role="option" aria-selected={i === cursor}>
              <button type="button" onMouseEnter={() => setCursor(i)} onClick={() => go(h)}
                className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === cursor ? 'bg-zinc-800' : '')}>
                <span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">{h.group}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{h.title}</span><span className="block truncate text-xs text-gray-500">{h.sub}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminSearch;
