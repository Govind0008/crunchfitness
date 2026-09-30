import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { readXlsx, type XlsxCell } from '@/lib/admin/xlsx';
import { parseCsv } from '@/lib/admin/csv';
import { membersByNames, membersByPhoneKeys, type Member } from '@/lib/admin/members';
import { formatPhone } from '@/lib/admin/phone';
import {
  FIELDS, analyse, detectMapping, importHistory, importedPayments, pickSheet, planImport, runImport,
  type Analysis, type Decision, type ImportResult, type ImportedRef, type Mapping,
} from '@/lib/admin/legacyImport';
import { useActor } from '@/features/events/admin/actor';
import { inputCls } from '@/features/events/admin/shared';
import { useLookups } from './lookups';
import { Count, ImportReport, PeoplePreview, ReviewQueue } from './LegacyPreview';

interface Loaded { file: string; sheet: string; grid: XlsxCell[][]; otherSheets: string[] }
interface Lookup { existing: Map<string, Member>; byName: Map<string, Member[]>; imported: Map<string, ImportedRef> }

const csvGrid = (text: string): XlsxCell[][] => parseCsv(text).map((r) => r.map((v) => ({ value: v, date: false, fill: null })));
const hasData = (rows: XlsxCell[][]) => rows.slice(1).some((r) => r.some((c) => c && c.value != null && String(c.value).trim() !== ''));

const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
  <section aria-labelledby={`lx-step-${n}`} className="rounded-2xl border border-white/[0.08] bg-ink-900 p-4 sm:p-5">
    <h2 id={`lx-step-${n}`} className="flex items-center gap-3 font-semibold text-white"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs">{n}</span>{title}</h2>
    <div className="mt-4">{children}</div>
  </section>
);

/**
 * The gym's old spreadsheets → members, memberships, PT packages and payments. Reads the
 * "Membership" sheet of the monthly workbook (other sheets are left alone). Obvious rows import
 * as they are; only ambiguous ones wait for a decision. Nothing is written until the last step.
 */
const LegacyImport = () => {
  const actor = useActor();
  const { plans } = useLookups();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [decisions, setDecisions] = useState<Map<number, Decision>>(new Map());
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof importHistory>> | null>(null);
  const loadHistory = () => importHistory().then(setHistory).catch(() => setHistory([]));
  useEffect(() => { loadHistory(); }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setResult(null); setLoaded(null); setLookup(null); setDecisions(new Map());
    try {
      if (/\.csv$/i.test(file.name)) {
        const grid = csvGrid(await file.text());
        setLoaded({ file: file.name, sheet: 'CSV', grid, otherSheets: [] }); setMapping(detectMapping(grid[0] ?? []));
      } else {
        const sheets = await readXlsx(await file.arrayBuffer());
        const sheet = pickSheet(sheets);
        if (!sheet) throw new Error('The file has no sheets.');
        const otherSheets = sheets.filter((s) => s !== sheet && hasData(s.rows)).map((s) => s.name);
        setLoaded({ file: file.name, sheet: sheet.name, grid: sheet.rows, otherSheets }); setMapping(detectMapping(sheet.rows[0] ?? []));
      }
    } catch (e) { setError((e as Error).message || 'The file couldn’t be read.'); }
  };

  // Only a type decision changes how a row is read; the others only change the plan
  const typeDecisions = useMemo(() => new Map([...decisions].filter(([, d]) => d === 'membership' || d === 'pt')), [decisions]);
  const typeKey = [...typeDecisions].join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analysis: Analysis | null = useMemo(() => (loaded && mapping ? analyse(loaded.file, loaded.sheet, loaded.grid, mapping, typeDecisions) : null), [loaded, mapping, typeKey]);

  // Who's already a member (by phone; by exact name only for rows with no phone), and which
  // payments were imported before (by fingerprint — from this file or any other)
  const lookupKey = analysis && !analysis.missingColumns.length ? analysis.rows.map((r) => r.fingerprint).join() : '';
  useEffect(() => {
    if (!analysis || analysis.missingColumns.length) return;
    let off = false;
    setLookup(null);
    Promise.all([
      membersByPhoneKeys(analysis.rows.filter((r) => r.hasPhone).map((r) => r.phoneKey)),
      membersByNames(analysis.rows.filter((r) => !r.phone).map((r) => r.nameKey)),
      importedPayments(analysis.rows.map((r) => r.fingerprint)),
    ]).then(([existing, byName, imported]) => { if (!off) setLookup({ existing, byName, imported }); })
      .catch((e) => !off && setError(`Couldn’t check existing members: ${e.message}`));
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  const plan = useMemo(() => (analysis && lookup ? planImport(analysis, lookup.existing, lookup.imported, [...plans.values()], decisions, lookup.byName) : null), [analysis, lookup, plans, decisions]);

  const run = async () => {
    if (!analysis || !plan) return;
    setBusy('Importing…'); setError(null);
    try {
      const r = await runImport(analysis, plan, actor, (d, t) => setBusy(`Importing… ${d} of ${t} members`));
      setResult(r); setLoaded(null); setLookup(null); loadHistory();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(`The import stopped: ${(e as Error).message}. Anything already saved is kept and won’t be duplicated — you can run it again.`); }
    finally { setBusy(null); }
  };

  const decide = (row: number, d: Decision | null) => setDecisions((m) => { const n = new Map(m); if (d) n.set(row, d); else n.delete(row); return n; });
  const ready = analysis && !analysis.missingColumns.length;
  const s = plan?.summary;

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-ink-300">For the gym’s monthly workbook — its <strong className="font-semibold text-white">Membership</strong> sheet (Members Name, Mob Number, Date of payment, Membership, Start/End Date, Paid, Bal Amt, Mode, comment). Each row is a payment: rows are grouped by phone into one member, and into one membership or PT record when the package and dates match. Nothing is saved until you confirm, and importing the same sheet again never adds anything twice.</p>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      {result && (
        <ImportReport result={result}>
          <p className="flex items-center gap-2 font-display text-2xl font-bold uppercase text-white"><CheckCircle2 className="h-6 w-6 text-brand-400" aria-hidden /> Import complete</p>
        </ImportReport>
      )}

      <Step n={1} title="Choose the file">
        <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-white/20 p-4 hover:border-white/40 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-400/30 sm:p-5">
          <FileUp className="h-7 w-7 flex-shrink-0 text-brand-400" aria-hidden />
          <span className="min-w-0 text-sm"><span className="block break-words font-semibold text-white">{loaded ? loaded.file : 'Choose the Excel (.xlsx) or CSV file'}</span>
            <span className="text-ink-400">{loaded ? `Sheet “${loaded.sheet}” · ${analysis?.rows.length ?? 0} rows · ${analysis?.header.filter(Boolean).length ?? 0} columns` : 'It stays on this computer until you confirm the import.'}</span></span>
          <input type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Old member sheet" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {loaded && loaded.otherSheets.length > 0 && (
          <p className="mt-3 text-xs text-ink-400">Only “{loaded.sheet}” is imported. Not read: {loaded.otherSheets.map((n) => `“${n}”`).join(', ')}.</p>
        )}
      </Step>

      {analysis && mapping && (
        <Step n={2} title="Check the columns">
          <details open={analysis.missingColumns.length > 0} className="group">
            <summary className="cursor-pointer text-sm text-ink-300 hover:text-white">
              {analysis.missingColumns.length ? 'Some columns weren’t found — choose them below.' : `All columns recognised (${FIELDS.filter((f) => mapping[f.key] >= 0).length} of ${FIELDS.length}). Show or change`}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="block text-xs text-ink-400">{f.target}{f.required ? '' : ' (optional)'}
                  <select className={cn(inputCls, 'mt-1 h-11')} value={mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}>
                    <option value={-1}>— not in this sheet —</option>
                    {analysis.header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </details>
          {analysis.missingColumns.length > 0 && <p role="alert" className="mt-3 text-sm text-red-300">Choose a column for: {analysis.missingColumns.map((k) => FIELDS.find((f) => f.key === k)!.target).join(', ')}.</p>}
        </Step>
      )}

      {ready && (
        <Step n={3} title="What’s in the sheet">
          {!plan || !s ? <div className="h-24 animate-pulse rounded-xl bg-ink-800 motion-reduce:animate-none" role="status" aria-label="Checking against existing members" /> : (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5" role="region" aria-label="What was found">
              <Count n={s.rows} label="rows found" /><Count n={s.uniqueMembers} label="unique members detected" />
              <Count n={s.rowsWithPhone} label="rows with phone" /><Count n={s.rowsWithoutPhone} label="rows without phone" />
              <Count n={s.gymRows} label="gym membership rows" /><Count n={s.ptRows} label="PT rows" />
              <Count n={s.possibleExisting} label="potential existing-member matches" /><Count n={s.conflicts} label="potential conflicts" tone={s.conflicts ? 'warn' : undefined} />
              <Count n={s.needsReview} label="rows requiring review" tone={s.needsReview ? 'warn' : undefined} /><Count n={s.blocked} label="rows that can’t be imported" tone={s.blocked ? 'bad' : undefined} />
              {s.unclearRows > 0 && <Count n={s.unclearRows} label="unclear packages" tone="warn" />}
              {s.alreadyImported > 0 && <Count n={s.alreadyImported} label="already imported" />}
            </div>
          )}
        </Step>
      )}

      {ready && plan && (
        <Step n={4} title={`Review${plan.needsReview.length ? ` · ${plan.needsReview.length} waiting` : ''}`}>
          <ReviewQueue plan={plan} decisions={decisions} onDecide={decide} />
        </Step>
      )}

      {ready && plan && (
        <Step n={5} title="Members">
          <PeoplePreview plan={plan} />
        </Step>
      )}

      {ready && plan && (
        <Step n={6} title="Confirm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="region" aria-label="Import preview">
            <Count n={plan.membersToCreate} label="new members" /><Count n={plan.membersMatched} label="existing members" />
            <Count n={plan.memberships} label="membership records" /><Count n={plan.ptPackages} label="PT records" />
            <Count n={plan.payments} label="payments" /><Count n={plan.alreadyImported.length} label="already imported" />
            <Count n={plan.needsReview.length} label="waiting for review" tone={plan.needsReview.length ? 'warn' : undefined} /><Count n={plan.skipped.length} label="can’t be imported" tone={plan.skipped.length ? 'bad' : undefined} />
          </div>
          {plan.people.some((m) => m.conflicts.length) && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden /> Differences with existing members — nothing on them is changed</p>
              <ul className="mt-2 space-y-1">{plan.people.flatMap((m) => m.conflicts.map((c) => <li key={m.id + c}>{formatPhone(m.phone)}: {c}</li>))}</ul>
            </div>
          )}
          <ul className="mt-4 space-y-1 text-sm text-ink-400">
            <li>Rows are history: a person is active only if a gym membership in the sheet runs today. Dates are taken from the sheet, never worked out from the package.</li>
            <li>Personal-training rows become PT records, never gym memberships, and don’t extend one. Trainer and sessions stay empty (the sheet doesn’t say).</li>
            <li>“Bal Amt” is kept as the sheet’s text. It never becomes a due.</li>
            <li>Payments keep the sheet’s Mode (or “Not recorded”), have no receipt number, and each names its sheet row.</li>
          </ul>
          <Button size="lg" className="mt-5 w-full sm:w-auto" disabled={!!busy || plan.payments === 0} onClick={run}>
            {busy ?? (plan.payments === 0 ? 'Nothing new to import' : `Import ${plan.membersToCreate} new member${plan.membersToCreate === 1 ? '' : 's'} · ${plan.payments} payment${plan.payments === 1 ? '' : 's'}`)}
          </Button>
        </Step>
      )}

      <section aria-labelledby="lx-history" className="pt-2">
        <h2 id="lx-history" className="text-xs font-bold uppercase tracking-wider text-ink-400">Earlier imports</h2>
        {!history ? <div className="mt-2 h-10 animate-pulse rounded bg-ink-900 motion-reduce:animate-none" /> : history.length === 0 ? <p className="mt-2 text-sm text-ink-500">None yet.</p> : (
          <ul className="mt-2 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] text-sm" aria-label="Import history">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <span className="text-white">{h.file}{h.sheet && h.sheet !== 'CSV' ? <span className="text-ink-400"> · {h.sheet}</span> : null}<span className="ml-2 text-xs text-ink-500">{h.createdAt?.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · {h.createdBy}</span></span>
                <span className="text-xs text-ink-400">{h.membersCreated} added · {h.membersMatched} matched · {h.payments} payments · {h.duplicatesPrevented} already imported · {h.needsReview} left for review</span>
              </li>
            ))}
          </ul>
        )}
        {result && <Link to="/admin/members" className="mt-3 inline-block text-sm font-semibold text-brand-400 hover:underline">View members →</Link>}
      </section>
    </div>
  );
};

export default LegacyImport;
