import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/admin/phone';
import { METHOD_LABEL, downloadCsv, rupees, toCsv } from '@/lib/admin/payments';
import type { Decision, ImportPlan, ImportResult, Person, RowOutcome, RowStatus, TraceOutcome } from '@/lib/admin/legacyImport';
import { ListToolbar, Pill, type Tone } from '@/features/admin/kit';
import { fmtDate } from './lookups';

// The pieces of the old-sheet importer that show what will happen: the review queue, the
// member-by-member preview and the report after importing. Every line names its sheet row.

export const Count = ({ n, label, tone }: { n: number; label: string; tone?: 'warn' | 'bad' }) => (
  <div className="rounded-xl bg-ink-800 p-3">
    <p className={cn('font-display text-3xl font-bold tabular-nums', tone === 'warn' ? 'text-amber-200' : tone === 'bad' ? 'text-red-300' : 'text-white')}>{n}</p>
    <p className="text-xs text-ink-400">{label}</p>
  </div>
);

const STATUS: Record<RowStatus, { tone: Tone; label: string }> = {
  ready: { tone: 'ok', label: 'Will import' },
  review: { tone: 'warn', label: 'Needs review' },
  blocked: { tone: 'bad', label: 'Can’t import' },
  imported: { tone: 'muted', label: 'Already imported' },
};
const typeWord = (o: RowOutcome) => (o.row.pkg.kind === 'pt' ? 'PT' : o.row.pkg.kind === 'membership' ? 'Membership' : 'Not sure');
const period = (start: string | null, end: string | null) => (start || end ? `${start ? fmtDate(start) : '?'} – ${end ? fmtDate(end) : '?'}` : 'No dates in the sheet');
const paidLine = (o: RowOutcome) => [o.row.amountPaise ? rupees(o.row.amountPaise) : 'No amount', METHOD_LABEL[o.row.method], o.row.paidOn ? `paid ${fmtDate(o.row.paidOn)}` : 'no payment date'].join(' · ');

/** The sheet's own words for a row, kept visible so nothing reads as invented. */
const SheetWords = ({ o }: { o: RowOutcome }) => {
  const r = o.row;
  const bits = [
    r.balance.note && `Bal Amt “${r.balance.note}”`,
    r.comment && `comment “${r.comment}”`,
    r.feedback && `feedback “${r.feedback}”`,
    r.startRaw && `start “${r.startRaw}”`,
    r.endRaw && `end “${r.endRaw}”`,
  ].filter(Boolean);
  return bits.length ? <p className="text-xs text-ink-500">{bits.join(' · ')}</p> : null;
};

// ── Review queue ──────────────────────────────────────────────────────────────
function decisionOptions(o: RowOutcome, d: Decision | ''): { value: Decision; label: string }[] {
  const r = o.row;
  // Unclear package: staff choose the type (once chosen the row is re-read as that type)
  if (r.pkg.kind === 'unknown' || d === 'membership' || d === 'pt') {
    return r.pkg.months ? [{ value: 'membership', label: `Import as a gym membership (${r.pkg.months} months)` }, { value: 'pt', label: `Import as personal training (${r.pkg.months} months)` }] : [];
  }
  const opts: { value: Decision; label: string }[] = [];
  const include = o.attachTo ? `Add to ${o.attachTo.name}`
    : r.startRaw || r.endRaw ? 'Import without the unreadable date'
    : r.dateIssue ? `Keep the sheet’s dates (${period(r.start, r.end)})`
    : 'Import as written';
  opts.push({ value: 'include', label: include });
  if (r.suggestedEnd && r.start) opts.push({ value: 'package_dates', label: `Use start + ${r.pkg.months} months (${fmtDate(r.start)} – ${fmtDate(r.suggestedEnd)})` });
  return opts;
}

export function ReviewQueue({ plan, decisions, onDecide }: { plan: ImportPlan; decisions: Map<number, Decision>; onDecide: (row: number, d: Decision | null) => void }) {
  const items = plan.outcomes.filter((o) => o.status === 'review' || (o.status === 'ready' && decisions.has(o.row.row)));
  const blocked = plan.skipped;
  if (!items.length && !blocked.length) return <p className="text-sm text-ink-300">Nothing needs a decision — every row was understood.</p>;
  return (
    <div className="space-y-5">
      {items.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-ink-400">Only the rows below need a person. Everything else is imported as it is. A row you don’t decide on stays out, and can be imported later.</p>
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-amber-400/20 bg-ink-900" aria-label="Rows needing review">
            {items.map((o) => {
              const r = o.row;
              const d = decisions.get(r.row) ?? '';
              const opts = decisionOptions(o, d);
              const reasons = o.status === 'review' ? o.reasons : [...(o.attachTo ? [`No phone — added to ${o.attachTo.name} by exact name`] : []), ...r.review];
              return (
                <li key={r.row} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm"><span className="font-mono text-xs text-ink-500">Row {r.row}</span> <span className="font-semibold text-white">{r.name || '—'}</span> <span className="tabular-nums text-ink-400">{r.phone ? formatPhone(r.phone) : 'no phone'}</span></p>
                    <p className="text-sm text-ink-300">{typeWord(o)} — “{r.pkg.raw}”{r.pkg.kind !== 'unknown' && r.pkg.raw !== r.pkg.label ? ` → ${r.pkg.label}` : ''} · {period(r.start, r.end)}</p>
                    <p className="text-xs tabular-nums text-ink-400">{paidLine(o)}</p>
                    <SheetWords o={o} />
                    <ul className="space-y-0.5 pt-1 text-xs text-amber-100">{reasons.map((x) => <li key={x}>• {x}</li>)}</ul>
                  </div>
                  <label className="block text-xs text-ink-400">Decision
                    <select aria-label={`Decision for row ${r.row}`} value={d} onChange={(e) => onDecide(r.row, (e.target.value || null) as Decision | null)}
                      className={cn('mt-1 h-11 w-full rounded-xl border bg-ink-950 px-3 text-sm text-white focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30', d ? 'border-brand-400/50' : 'border-white/15')}>
                      <option value="">Leave out for now</option>
                      {opts.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {blocked.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">Can’t be imported yet ({blocked.length})</h3>
          <p className="mt-1 text-sm text-ink-400">These rows are missing something the system needs. They’re listed in the report; fix them in the sheet and import it again — nothing is added twice.</p>
          <ul className="mt-3 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-red-500/20 bg-ink-900" aria-label="Rows that can’t be imported">
            {blocked.map((o) => (
              <li key={o.row.row} className="space-y-1 p-4 text-sm">
                <p><span className="font-mono text-xs text-ink-500">Row {o.row.row}</span> <span className="font-semibold text-white">{o.row.name || '—'}</span> <span className="text-ink-400">· “{o.row.pkg.raw}” · {paidLine(o)}</span></p>
                <ul className="text-xs text-red-200">{o.reasons.map((x) => <li key={x}>• {x}</li>)}</ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Member-level preview ─────────────────────────────────────────────────────
type PeopleFilter = 'all' | 'several' | 'new' | 'existing' | 'attention';
const needsAttention = (p: Person) => p.outcomes.some((o) => o.status === 'review' || o.status === 'blocked') || p.conflicts.length > 0;
const willExist = (o: RowOutcome) => o.status === 'ready' || o.status === 'imported';

/** One person's sheet rows, grouped the way they'll be stored: record → its payments. */
function PersonTree({ p }: { p: Person }) {
  const groups = new Map<string, RowOutcome[]>();
  p.outcomes.forEach((o) => groups.set(o.row.recordId, [...(groups.get(o.row.recordId) ?? []), o]));
  return (
    <ul className="space-y-3 border-l border-white/10 pl-4" aria-label={`Records for ${p.name}`}>
      {[...groups.values()].map((list) => {
        const first = list[0];
        return (
          <li key={first.row.recordId} className="relative before:absolute before:-left-4 before:top-2.5 before:h-px before:w-3 before:bg-white/15">
            <p className="text-sm text-white">
              <span className={first.row.pkg.kind === 'pt' ? 'font-semibold text-sky-200' : 'font-semibold'}>{typeWord(first)}</span> — {first.row.pkg.label}
              <span className="text-ink-400"> · {period(first.start, first.end)}</span>
            </p>
            {first.row.pkg.raw !== first.row.pkg.label && <p className="text-xs text-ink-500">Sheet says “{first.row.pkg.raw}”{first.row.pkg.packageType === 'bonus' ? ` — ${first.row.pkg.baseMonths} months + ${first.row.pkg.bonusMonths} bonus` : ''}</p>}
            <ul className="mt-1.5 space-y-1.5 border-l border-white/10 pl-4">
              {list.map((o) => (
                <li key={o.row.row} className="relative text-sm before:absolute before:-left-4 before:top-2.5 before:h-px before:w-3 before:bg-white/15">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="tabular-nums text-white">{paidLine(o)}</span>
                    <span className="font-mono text-xs text-ink-500">row {o.row.row}</span>
                    {o.status !== 'ready' && <Pill tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Pill>}
                  </div>
                  <SheetWords o={o} />
                  {o.attachTo && <p className="text-xs text-ink-500">No phone in the sheet — matched by exact name</p>}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function PersonItem({ p }: { p: Person }) {
  const shown = p.outcomes.filter(willExist);
  const mem = [...new Map(shown.filter((o) => o.row.pkg.kind === 'membership').map((o) => [o.row.recordId, o.row.pkg.label])).values()];
  const pt = [...new Map(shown.filter((o) => o.row.pkg.kind === 'pt').map((o) => [o.row.recordId, o.row.pkg.label])).values()];
  const total = shown.reduce((s, o) => s + (o.row.amountPaise ?? 0), 0);
  const rows = p.outcomes.length;
  const placeable = !p.id.startsWith('np:');
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-500 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-white">{p.name}</span>
              <span className="text-xs tabular-nums text-ink-400">{p.phone ? formatPhone(p.phone) : p.phoneKey ? formatPhone(p.phoneKey) : 'No phone'}</span>
              {!placeable ? <Pill tone="bad">Can’t be added</Pill> : p.existing ? <Pill tone="info">Existing member</Pill> : <Pill tone="muted">New member</Pill>}
              {rows > 1 && <Pill tone="muted">{rows} sheet rows → 1 member</Pill>}
              {needsAttention(p) && placeable && <Pill tone="warn">Needs a look</Pill>}
            </span>
            <span className="mt-1 block text-xs text-ink-400">
              Membership: {mem.length ? mem.join(', ') : 'none'} · PT: {pt.length ? pt.join(', ') : 'none'} · {shown.length ? `${rupees(total)} in ${shown.length} payment${shown.length === 1 ? '' : 's'}` : 'no payments to import'}
            </span>
          </span>
        </summary>
        <div className="space-y-3 px-4 pb-4 pl-11">
          {p.existing && <p className="text-xs text-ink-400">Already a member as <Link to={`/admin/members/${p.existing.id}`} className="text-brand-400 hover:underline">{p.existing.name}</Link>. Rows are added as their history; nothing on the member changes.</p>}
          {p.conflicts.map((c) => <p key={c} className="text-xs text-amber-100">{c}</p>)}
          <PersonTree p={p} />
        </div>
      </details>
    </li>
  );
}

export function PeoplePreview({ plan }: { plan: ImportPlan }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const test = (p: Person, f: PeopleFilter) => f === 'all' || (f === 'several' ? p.outcomes.length > 1 : f === 'new' ? !p.existing && !p.id.startsWith('np:') : f === 'existing' ? !!p.existing : needsAttention(p));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase(); const digits = t.replace(/\D/g, '');
    return plan.people.filter((p) => test(p, filter) && (!t || p.name.toLowerCase().includes(t) || (digits.length >= 3 && (p.phoneKey.includes(digits) || p.outcomes.some((o) => String(o.row.row) === digits)))));
  }, [plan, q, filter]);
  const n = (f: PeopleFilter) => plan.people.filter((p) => test(p, f)).length;
  const segments: { id: PeopleFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: n('all') }, { id: 'several', label: 'Several rows', count: n('several') }, { id: 'new', label: 'New', count: n('new') },
    { id: 'existing', label: 'Existing', count: n('existing') }, { id: 'attention', label: 'Needs a look', count: n('attention') },
  ];
  return (
    <div>
      <p className="mb-3 text-sm text-ink-400">Each person once, with every sheet row under them. Open a person to see how their rows are stored: a membership or PT package, and the payments made for it.</p>
      <ListToolbar search={q} onSearch={setQ} placeholder="Search by name, phone or row number" label="Show" segments={segments} value={filter} onChange={(k) => setFilter(k as typeof filter)} />
      {shown.length === 0 ? <p className="text-sm text-ink-500">No one matches.</p> : (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900" aria-label="Members in the sheet">
          {shown.map((p) => <PersonItem key={p.id} p={p} />)}
        </ul>
      )}
    </div>
  );
}

// ── Report ────────────────────────────────────────────────────────────────────
const OUTCOME: Record<TraceOutcome, { tone: Tone; label: string }> = {
  imported: { tone: 'ok', label: 'Imported' },
  already_imported: { tone: 'muted', label: 'Already imported' },
  needs_review: { tone: 'warn', label: 'Left for review' },
  cannot_import: { tone: 'bad', label: 'Not imported' },
};

export function ImportReport({ result, children }: { result: ImportResult; children?: ReactNode }) {
  const [filter, setFilter] = useState<'all' | TraceOutcome>('all');
  const [q, setQ] = useState('');
  const trace = result.trace ?? [];
  const shown = trace.filter((t) => (filter === 'all' || t.outcome === filter) && (!q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()) || String(t.row) === q.trim()));
  const count = (o: TraceOutcome) => trace.filter((t) => t.outcome === o).length;
  const segments: { id: 'all' | TraceOutcome; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: trace.length }, ...(Object.keys(OUTCOME) as TraceOutcome[]).map((o) => ({ id: o, label: OUTCOME[o].label, count: count(o) })),
  ];
  const csv = () => downloadCsv(`import-report-${result.file.replace(/\.[^.]+$/, '')}-${result.sheet}.csv`, toCsv([
    ['Sheet row', 'Name', 'Phone', 'Package (as in sheet)', 'Type', 'Paid (₹)', 'Paid on', 'Outcome', 'Member id', 'Record id', 'Payment id', 'Note'],
    ...trace.map((t) => [t.row, t.name, t.phone, t.packageRaw, t.type, t.amountPaise != null ? t.amountPaise / 100 : '', t.paidOn ?? '', OUTCOME[t.outcome].label, t.memberId ?? '', t.recordId ?? '', t.paymentId ?? '', t.note]),
  ]));
  return (
    <section role="status" aria-label="Import complete" className="rounded-2xl border border-brand-400/30 bg-brand-400/[0.04] p-5">
      {children}
      <p className="mt-1 text-sm text-ink-300">{result.file} · sheet “{result.sheet}” · {result.rows} rows</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count n={result.membersCreated} label="members created" /><Count n={result.membersMatched} label="existing members matched" />
        <Count n={result.memberships} label="membership records created" /><Count n={result.ptPackages} label="PT records created" />
        <Count n={result.payments} label="payments created" /><Count n={result.duplicatesPrevented} label="skipped as exact duplicate" />
        <Count n={result.needsReview} label="left for review" tone={result.needsReview ? 'warn' : undefined} /><Count n={result.conflicts} label="conflicts" tone={result.conflicts ? 'warn' : undefined} />
      </div>
      {result.skipped > 0 && <p className="mt-2 text-sm text-red-200">{result.skipped} row{result.skipped === 1 ? '' : 's'} couldn’t be imported — see below.</p>}
      {trace.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">Every sheet row</h3>
            <Button size="sm" variant="outline" onClick={csv}><Download /> Download report (CSV)</Button>
          </div>
          <ListToolbar search={q} onSearch={setQ} placeholder="Find a name or row number" label="Show rows" segments={segments} value={filter} onChange={(k) => setFilter(k as typeof filter)} />
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900" aria-label="Import report">
            {shown.map((t) => (
              <li key={t.row} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_9rem] sm:items-baseline sm:gap-3">
                <span className="font-mono text-xs text-ink-500">Row {t.row}</span>
                <span className="min-w-0">
                  {t.memberId && !t.memberId.startsWith('np:') ? <Link to={`/admin/members/${t.memberId}`} className="font-semibold text-white hover:text-brand-400">{t.name}</Link> : <span className="font-semibold text-white">{t.name}</span>}
                  <span className="text-ink-400"> · “{t.packageRaw}” · {t.amountPaise ? rupees(t.amountPaise) : '—'}{t.paidOn ? ` · ${fmtDate(t.paidOn)}` : ''}</span>
                  {t.note && <span className="block text-xs text-ink-500">{t.note}</span>}
                </span>
                <span className="sm:text-right"><Pill tone={OUTCOME[t.outcome].tone}>{OUTCOME[t.outcome].label}</Pill></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
