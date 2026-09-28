import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SCORING, deleteResult, formatScore, parseScore, passNumber, rankCategory, saveResult, setStatus,
  type Category, type CrunchEvent, type Registration, type Result,
} from '@/lib/events';
import { ConfirmButton, Empty, inputCls } from './shared';
import { useActor } from './actor';

/** One participant's score row — saves on its own so nothing is lost mid-event. */
const ResultRow = ({ ev, cat, reg, result }: { ev: CrunchEvent; cat: Category; reg: Registration; result?: Result }) => {
  const actor = useActor();
  const [score, setScore] = useState(result ? String(cat.scoring === 'time' ? formatScore(result.score, cat).replace(/s$/, '') : result.score) : '');
  const [position, setPosition] = useState(result?.position != null ? String(result.position) : '');
  const [pub, setPub] = useState(result?.public ?? true);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (state === 'saved') { const t = setTimeout(() => setState('idle'), 1800); return () => clearTimeout(t); } }, [state]);

  const save = async () => {
    const value = parseScore(score, cat.scoring);
    if (value == null) { setState('error'); setMsg(cat.scoring === 'time' ? 'Enter a time like 1:05.3 or 65.3' : 'Enter a number'); return; }
    const pos = position.trim() ? Number(position) : null;
    if (pos != null && (!Number.isInteger(pos) || pos < 1)) { setState('error'); setMsg('Position must be 1 or more'); return; }
    setState('saving');
    try { await saveResult(ev, reg, cat, value, pos, pub, actor, !!result); setState('saved'); }
    catch (e) { setState('error'); setMsg((e as Error).message); }
  };

  return (
    <li className="grid gap-3 p-4 sm:grid-cols-[1fr_9rem_6rem_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{reg.name}</p>
        <p className="text-xs text-ink-500">{passNumber(reg.number)} · {reg.status === 'checked_in' ? 'Checked in' : 'Not checked in'}</p>
      </div>
      <label>
        <span className="sr-only">Score for {reg.name}</span>
        <input className={cn(inputCls, 'h-11')} inputMode="decimal" placeholder={cat.scoring === 'time' ? '1:05.3' : cat.unit} value={score}
          onChange={(e) => setScore(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-invalid={state === 'error'} />
      </label>
      <label>
        <span className="sr-only">Position for {reg.name} (optional)</span>
        <input className={cn(inputCls, 'h-11')} inputMode="numeric" placeholder="Pos." title="Optional — only to break ties" value={position} onChange={(e) => setPosition(e.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-300">
          <input type="checkbox" className="h-4 w-4 accent-[#b0d43f]" checked={pub} onChange={(e) => setPub(e.target.checked)} />
          Live board
        </label>
        <Button size="sm" onClick={save} disabled={state === 'saving'} aria-label={`Save result for ${reg.name}`}>
          {state === 'saved' ? <><Check /> Saved</> : state === 'saving' ? 'Saving…' : result ? 'Update' : 'Save'}
        </Button>
      </div>
      {state === 'error' && <p role="alert" className="text-sm text-red-300 sm:col-span-4">{msg}</p>}
    </li>
  );
};

const ORD = ['1st', '2nd', '3rd'];

const ResultsTab = ({ ev, registrations, results }: { ev: CrunchEvent; registrations: Registration[]; results: Result[] }) => {
  const actor = useActor();
  const [catId, setCatId] = useState(ev.currentCategoryId ?? ev.categories[0]?.id);
  const cat = ev.categories.find((c) => c.id === catId) ?? ev.categories[0];
  const entrants = useMemo(
    () => registrations.filter((r) => r.categoryId === cat?.id && r.status !== 'no_show')
      .sort((a, b) => Number(b.status === 'checked_in') - Number(a.status === 'checked_in') || a.number - b.number),
    [registrations, cat?.id],
  );
  const ranked = cat ? rankCategory(results, cat) : [];
  const canEnter = ['check_in', 'live', 'results_pending', 'results_published'].includes(ev.status);

  if (!ev.categories.length) return <Empty title="No categories" body="Add categories in Edit details → Competition." />;

  return (
    <div>
      {ev.status === 'results_pending' && (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-brand-400/30 bg-brand-400/[0.06] p-5">
          <p className="flex-1 text-sm text-white">Check each category’s winners below. When everything looks right, publish the results to the website.</p>
          <ConfirmButton size="default" confirm={{ title: 'Publish results?', body: 'Winners and all results will be shown on the website.' }} onConfirm={() => setStatus(ev.id, ev.status, 'results_published', actor)}>
            Publish results
          </ConfirmButton>
        </div>
      )}
      {!canEnter && <p className="mb-6 rounded-xl bg-ink-900 p-4 text-sm text-ink-300">Results can be entered once check-in has started.</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        {ev.categories.map((c) => (
          <button key={c.id} type="button" onClick={() => setCatId(c.id)} aria-pressed={c.id === cat.id}
            className={cn('rounded-full border px-4 py-2 text-sm font-semibold', c.id === cat.id ? 'border-white bg-white text-ink-950' : 'border-white/15 text-ink-300 hover:text-white')}>
            {c.name} <span className="ml-1 opacity-60">{results.filter((r) => r.categoryId === c.id).length}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-400">Scored by {SCORING[cat.scoring].label.toLowerCase()} — <strong className="text-white">{cat.direction === 'higher' ? 'highest' : 'lowest'} score wins</strong>. Leave position empty unless you need to break a tie.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        {canEnter ? (
          entrants.length ? (
            <ul className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
              {entrants.map((r) => <ResultRow key={`${cat.id}-${r.id}`} ev={ev} cat={cat} reg={r} result={results.find((x) => x.id === r.id)} />)}
            </ul>
          ) : <Empty title="No one in this category" body="Participants who registered for this category will appear here." />
        ) : <div />}

        <aside aria-labelledby="podium-heading" className="h-fit rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
          <h3 id="podium-heading" className="hud text-white">Winners preview</h3>
          {ranked.length ? (
            <ol className="mt-4 space-y-3">
              {ranked.slice(0, 3).map((r, i) => (
                <li key={r.id} className="flex items-baseline gap-3">
                  <span className={cn('w-10 font-display text-2xl font-bold', i === 0 ? 'text-brand-400' : 'text-ink-400')}>{ORD[r.rank - 1] ?? `${r.rank}th`}</span>
                  <span className="min-w-0 flex-1 truncate text-white">{r.displayName}</span>
                  <span className="text-sm tabular-nums text-ink-300">{formatScore(r.score, cat)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-sm text-ink-500">Winners appear here as you enter scores.</p>}
          {ranked.length > 3 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-ink-400">Full ranking ({ranked.length})</summary>
              <ol className="mt-2 space-y-1 text-ink-300">
                {ranked.map((r) => <li key={r.id} className="flex justify-between gap-2"><span>{r.rank}. {r.displayName}</span><span className="tabular-nums">{formatScore(r.score, cat)}</span></li>)}
              </ol>
            </details>
          )}
          {ranked.length > 0 && ev.status !== 'results_published' && (
            <p className="mt-4 text-xs text-ink-500">Not public yet — winners show on the website only after you publish results.</p>
          )}
          {ranked.map((r) => r.id).length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-ink-500">Remove a result</summary>
              <ul className="mt-2 space-y-1">
                {ranked.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-ink-300">
                    <span className="truncate">{r.displayName}</span>
                    <button type="button" className="text-red-300 hover:underline" onClick={() => deleteResult(ev, r.id, actor)}>Remove</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
};

export default ResultsTab;
