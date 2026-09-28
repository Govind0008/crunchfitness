import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { readXlsx, type XlsxCell } from '@/lib/admin/xlsx';
import { parseCsv } from '@/lib/admin/csv';
import { membersByPhoneKeys, type Member } from '@/lib/admin/members';
import { formatPhone } from '@/lib/admin/phone';
import { rupees } from '@/lib/admin/payments';
import {
  FIELDS, analyse, detectMapping, importHistory, importedKeys, planImport, runImport,
  type Analysis, type ImportResult, type Mapping, type PackageKind,
} from '@/lib/admin/legacyImport';
import { useActor } from '@/features/events/admin/actor';
import { inputCls } from '@/features/events/admin/shared';
import { fmtDate, useLookups } from './lookups';

interface Loaded { file: string; sheet: string; grid: XlsxCell[][] }

const csvGrid = (text: string): XlsxCell[][] => parseCsv(text).map((r) => r.map((v) => ({ value: v, date: false, fill: null })));

const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <section aria-labelledby={`lx-step-${n}`} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-5">
    <h2 id={`lx-step-${n}`} className="flex items-center gap-3 font-semibold text-white"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-xs">{n}</span>{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

const Count = ({ n, label, tone }: { n: number; label: string; tone?: 'warn' | 'bad' }) => (
  <div className="rounded-xl bg-ink-800 p-3">
    <p className={cn('font-display text-3xl font-bold tabular-nums', tone === 'warn' ? 'text-amber-200' : tone === 'bad' ? 'text-red-300' : 'text-white')}>{n}</p>
    <p className="text-xs text-ink-400">{label}</p>
  </div>
);

/**
 * The old member sheet → members, memberships, PT packages and payments. Nothing is written until
 * the last step; rows that need a person's judgement stay out until someone ticks them.
 */
const LegacyImport = () => {
  const actor = useActor();
  const { plans } = useLookups();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [overrides, setOverrides] = useState<Map<number, PackageKind>>(new Map());
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [existing, setExisting] = useState<Map<string, Member> | null>(null);
  const [already, setAlready] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof importHistory>> | null>(null);
  const loadHistory = () => importHistory().then(setHistory).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setResult(null); setLoaded(null); setExisting(null); setAlready(null); setApproved(new Set()); setOverrides(new Map());
    try {
      if (/\.csv$/i.test(file.name)) {
        const grid = csvGrid(await file.text());
        setLoaded({ file: file.name, sheet: 'CSV', grid }); setMapping(detectMapping(grid[0] ?? []));
      } else {
        const sheets = await readXlsx(await file.arrayBuffer());
        const sheet = sheets.find((s) => s.rows.length > 1) ?? sheets[0];
        if (!sheet) throw new Error('The file has no sheets.');
        setLoaded({ file: file.name, sheet: sheet.name, grid: sheet.rows }); setMapping(detectMapping(sheet.rows[0] ?? []));
      }
    } catch (e) { setError((e as Error).message || 'The file couldn’t be read.'); }
  };

  const analysis: Analysis | null = useMemo(() => (loaded && mapping ? analyse(loaded.file, loaded.sheet, loaded.grid, mapping, overrides) : null), [loaded, mapping, overrides]);

  // Who's already a member, and which rows were imported before — looked up by phone / row key
  useEffect(() => {
    if (!analysis || analysis.missingColumns.length) return;
    let off = false;
    setExisting(null); setAlready(null);
    Promise.all([membersByPhoneKeys(analysis.rows.map((r) => r.phoneKey)), importedKeys(analysis.rows.map((r) => r.key))])
      .then(([m, k]) => { if (!off) { setExisting(m); setAlready(k); } })
      .catch((e) => !off && setError(`Couldn’t check existing members: ${e.message}`));
    return () => { off = true; };
  }, [analysis]);

  const plan = useMemo(() => (analysis && existing && already ? planImport(analysis, existing, already, [...plans.values()], approved) : null), [analysis, existing, already, plans, approved]);

  const run = async () => {
    if (!analysis || !plan) return;
    setBusy('Importing…'); setError(null);
    try {
      const r = await runImport(analysis, plan, actor, (d, t) => setBusy(`Importing… ${d} of ${t} members`));
      setResult(r); setLoaded(null); loadHistory();
    } catch (e) { setError(`The import stopped: ${(e as Error).message}. Anything already saved is kept and won’t be duplicated — you can run it again.`); }
    finally { setBusy(null); }
  };

  const toggle = (row: number) => setApproved((s) => { const n = new Set(s); if (n.has(row)) n.delete(row); else n.add(row); return n; });
  const kindLabel = (k: PackageKind) => (k === 'pt' ? 'Personal training' : k === 'membership' ? 'Gym membership' : 'Not sure');

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-ink-300">For the gym’s old member spreadsheet (Name, Mob Number, Date of payment, Membership, Start/End Date, Paid, bal). Each row becomes the member’s membership or personal-training record and the payment — as history. Nothing is saved until you confirm, and importing the same sheet again never adds anything twice.</p>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      {result && (
        <section role="status" aria-label="Import complete" className="rounded-2xl border border-brand-400/30 bg-brand-400/[0.06] p-5">
          <p className="flex items-center gap-2 font-display text-2xl font-bold uppercase text-white"><CheckCircle2 className="h-6 w-6 text-brand-400" aria-hidden /> Import complete</p>
          <p className="mt-1 text-sm text-ink-300">{result.file} · {result.rows} rows</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count n={result.membersCreated} label="members added" /><Count n={result.membersMatched} label="existing members matched" />
            <Count n={result.memberships} label="membership records" /><Count n={result.ptPackages} label="PT records" />
            <Count n={result.payments} label="payments" /><Count n={result.skipped} label="skipped" tone={result.skipped ? 'bad' : undefined} />
            <Count n={result.needsReview} label="left for review" tone={result.needsReview ? 'warn' : undefined} /><Count n={result.duplicatesPrevented} label="already imported (not added again)" />
          </div>
          <Link to="/admin/members" className="mt-4 inline-block text-sm font-semibold text-brand-400 hover:underline">View members →</Link>
        </section>
      )}

      <Step n={1} title="Choose the file">
        <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/20 p-5 hover:border-white/40 focus-within:border-brand-400">
          <FileUp className="h-7 w-7 text-brand-400" aria-hidden />
          <span className="text-sm"><span className="block font-semibold text-white">{loaded ? loaded.file : 'Choose the Excel (.xlsx) or CSV file'}</span>
            <span className="text-ink-400">{loaded ? `Sheet “${loaded.sheet}” · ${analysis?.rows.length ?? 0} rows · ${analysis?.header.filter(Boolean).length ?? 0} columns` : 'It stays on this computer until you confirm the import.'}</span></span>
          <input type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Old member sheet" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </Step>

      {analysis && mapping && (
        <Step n={2} title="Check the columns">
          <p className="mb-3 text-sm text-ink-400">Each column of the sheet and where it goes. Change any that are wrong.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs text-ink-400">{f.target}{f.required ? '' : ' (optional)'}
                <select className={cn(inputCls, 'mt-1 h-11')} value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}>
                  <option value={-1}>— not in this sheet —</option>
                  {analysis.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {analysis.missingColumns.length > 0 && <p role="alert" className="mt-3 text-sm text-red-300">Choose a column for: {analysis.missingColumns.map((k) => FIELDS.find((f) => f.key === k)!.target).join(', ')}.</p>}
        </Step>
      )}

      {analysis && !analysis.missingColumns.length && (
        <Step n={3} title="Check each row">
          {!plan ? <div className="h-24 animate-pulse rounded-xl bg-ink-800" role="status" aria-label="Checking against existing members" /> : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="What was found">
                <Count n={new Set(analysis.rows.filter((r) => r.phoneKey.length === 10).map((r) => r.phoneKey)).size} label="members found" />
                <Count n={analysis.rows.filter((r) => r.pkg.kind === 'membership').length} label="membership records" />
                <Count n={analysis.rows.filter((r) => r.pkg.kind === 'pt').length} label="PT records found" />
                <Count n={analysis.rows.filter((r) => r.review.length && !r.blockers.length).length} label="need review" tone="warn" />
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08]">
                <table className="w-full min-w-[56rem] text-left text-sm">
                  <thead className="border-b border-white/[0.08] text-xs uppercase tracking-wider text-ink-500">
                    <tr>{['Row', 'Member', 'Type', 'Period', 'Paid', 'Status'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {analysis.rows.map((r) => {
                      const done = already?.has(r.key);
                      const needs = !r.blockers.length && r.review.length > 0;
                      return (
                        <tr key={r.row} className={cn(r.blockers.length ? 'bg-red-500/[0.04]' : needs ? 'bg-amber-400/[0.04]' : '')}>
                          <td className="px-3 py-2 align-top tabular-nums text-ink-400">{r.row}{r.srNo ? <span className="block text-[11px] text-ink-600">Sr {r.srNo}</span> : null}</td>
                          <td className="px-3 py-2 align-top"><span className="block text-white">{r.name || '—'}</span><span className="text-xs tabular-nums text-ink-500">{r.phone ? formatPhone(r.phone) : 'No phone'}{existing?.get(r.phoneKey) ? ` · already a member (${existing.get(r.phoneKey)!.name})` : ''}</span></td>
                          <td className="px-3 py-2 align-top">
                            {r.pkg.kind === 'unknown' || overrides.has(r.row) ? (
                              <select aria-label={`Type for row ${r.row}`} className="rounded-lg border border-white/15 bg-ink-900 px-2 py-1 text-sm text-white" value={overrides.get(r.row) ?? 'unknown'}
                                onChange={(e) => setOverrides((m) => { const n = new Map(m); if (e.target.value === 'unknown') n.delete(r.row); else n.set(r.row, e.target.value as PackageKind); return n; })}>
                                <option value="unknown">Not sure</option><option value="membership">Gym membership</option><option value="pt">Personal training</option>
                              </select>
                            ) : <span className={r.pkg.kind === 'pt' ? 'font-semibold text-sky-200' : 'text-white'}>{kindLabel(r.pkg.kind)}</span>}
                            <span className="block text-xs text-ink-500">“{r.pkg.raw}”{r.pkg.kind !== 'unknown' ? ` → ${r.pkg.label}` : ''}</span>
                          </td>
                          <td className="px-3 py-2 align-top text-ink-300">{r.start ? fmtDate(r.start) : '?'} – {r.end ? fmtDate(r.end) : '?'}<span className="block text-xs text-ink-500">Paid on {r.paidOn ? fmtDate(r.paidOn) : '?'}</span></td>
                          <td className="px-3 py-2 align-top tabular-nums text-white">{r.amountPaise ? rupees(r.amountPaise) : '—'}{r.balance.note && <span className="block text-xs text-ink-500">bal: {r.balance.note}</span>}</td>
                          <td className="px-3 py-2 align-top text-xs">
                            {done ? <span className="font-semibold text-ink-300">Already imported</span>
                              : r.blockers.length ? <span className="text-red-300">Can’t import: {r.blockers.join('; ')}</span>
                              : needs ? (
                                <label className="flex items-start gap-2 text-amber-100">
                                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#b0d43f]" checked={approved.has(r.row)} onChange={() => toggle(r.row)} aria-label={`Include row ${r.row}`} />
                                  <span><span className="block font-semibold">{approved.has(r.row) ? 'Checked — will be imported' : 'Needs review — tick to include'}</span>{r.review.map((x) => <span key={x} className="block">{x}</span>)}</span>
                                </label>
                              ) : <span className="font-semibold text-brand-300">Ready</span>}
                            {!done && r.warnings.length > 0 && <span className="mt-1 block text-ink-500">{r.warnings.join(' · ')}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Step>
      )}

      {plan && analysis && !analysis.missingColumns.length && (
        <Step n={4} title="Confirm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Import preview">
            <Count n={plan.membersToCreate} label="new members" /><Count n={plan.membersMatched} label="existing members" />
            <Count n={plan.memberships} label="membership records" /><Count n={plan.ptPackages} label="PT records" />
            <Count n={plan.payments} label="payments" /><Count n={plan.alreadyImported.length} label="already imported" />
            <Count n={plan.needsReview.length} label="waiting for review" tone={plan.needsReview.length ? 'warn' : undefined} /><Count n={plan.skipped.length} label="can’t be imported" tone={plan.skipped.length ? 'bad' : undefined} />
          </div>
          {plan.members.some((m) => m.conflicts.length) && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden /> Differences with existing members — nothing on them is changed</p>
              <ul className="mt-2 space-y-1">{plan.members.flatMap((m) => m.conflicts.map((c) => <li key={m.phoneKey + c}>{formatPhone(m.phone)}: {c}</li>))}</ul>
            </div>
          )}
          <ul className="mt-4 space-y-1 text-sm text-ink-400">
            <li>Imported people are active only if a membership runs today — every period in this sheet is kept as history.</li>
            <li>Personal-training rows become PT records, not gym plans. Trainer and number of sessions stay empty (the sheet doesn’t say).</li>
            <li>“bal” is kept as a note. It never becomes a due.</li>
            <li>Payments are recorded without a receipt number, and the payment method as “Not recorded”.</li>
          </ul>
          <Button size="lg" className="mt-5" disabled={!!busy || plan.payments === 0} onClick={run}>
            {busy ?? (plan.payments === 0 ? 'Nothing new to import' : `Import ${plan.membersToCreate} new member${plan.membersToCreate === 1 ? '' : 's'} · ${plan.payments} payment${plan.payments === 1 ? '' : 's'}`)}
          </Button>
        </Step>
      )}

      <section aria-labelledby="lx-history" className="pt-2">
        <h2 id="lx-history" className="text-xs font-bold uppercase tracking-wider text-ink-400">Earlier imports</h2>
        {!history ? <div className="mt-2 h-10 animate-pulse rounded bg-ink-900" /> : history.length === 0 ? <p className="mt-2 text-sm text-ink-500">None yet.</p> : (
          <ul className="mt-2 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] text-sm" aria-label="Import history">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="text-white">{h.file}<span className="ml-2 text-xs text-ink-500">{h.createdAt?.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {h.createdBy}</span></span>
                <span className="text-xs text-ink-400">{h.membersCreated} added · {h.membersMatched} matched · {h.payments} payments · {h.duplicatesPrevented} already imported · {h.needsReview} left for review</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default LegacyImport;
