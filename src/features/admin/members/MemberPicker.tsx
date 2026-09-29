import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { memberState, searchMembers, type Member } from '@/lib/admin/members';
import { DEFAULT_SETTINGS } from '@/lib/admin/settings';
import { formatPhone } from '@/lib/admin/phone';
import { StatePill } from './shared';
import Avatar from './Avatar';

/** Find one member by name or phone — the first step of any task started without a member. */
const MemberPicker = ({ onPick, label = 'Find the member' }: { onPick: (m: Member) => void; label?: string }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Member[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setHits(null); return; }
    const t = setTimeout(() => searchMembers(q.trim()).then(setHits).catch(() => setHits([])), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <label className="relative block">
        <span className="text-sm font-semibold text-white">{label}</span>
        <Search className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 text-ink-500" aria-hidden />
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or phone number" autoComplete="off"
          className="mt-2 h-12 w-full rounded-xl border border-white/15 bg-ink-900 pl-11 pr-4 text-base text-white placeholder:text-ink-500 focus:border-brand-400 focus:outline-none" />
      </label>
      {hits && (hits.length === 0 ? <p className="mt-4 text-sm text-ink-400">No member matches “{q.trim()}”.</p> : (
        <ul className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.08]" aria-label="Matching members">
          {hits.slice(0, 8).map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
                <Avatar m={m} size={36} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{m.name}</span><span className="text-xs tabular-nums text-ink-400">{formatPhone(m.phone)}</span></span>
                <StatePill state={memberState(m, DEFAULT_SETTINGS.expiringSoonDays)} />
              </button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
};

export default MemberPicker;
