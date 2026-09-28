import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileUp, Users } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { importMembers, membersByPhoneKeys, setLinks, validateMember, type Member, type MemberInput } from '@/lib/admin/members';
import { phoneKey } from '@/lib/admin/phone';
import { AdminShell } from '@/features/events/admin/shared';
import { useActor } from '@/features/events/admin/actor';
import { useLookups, type PlanRef } from './lookups';
import { parseCsv } from '@/lib/admin/csv';

const TEMPLATE = 'name,phone,email,plan,start,expiry,status\nAsha Rao,9876543210,asha@example.com,3 Months,2026-09-01,2026-11-30,active\n';
const ALIASES: Record<keyof Omit<MemberInput, 'trainerId' | 'notes'> | 'plan', string[]> = {
  name: ['name', 'full name', 'member name'], phone: ['phone', 'mobile', 'phone number', 'contact'], email: ['email', 'e-mail'],
  plan: ['plan', 'membership', 'package'], planId: [], membershipStart: ['start', 'start date', 'joined', 'join date'],
  membershipEnd: ['expiry', 'end', 'end date', 'expiry date', 'valid till'], status: ['status'],
};

/** Accepts YYYY-MM-DD or DD/MM/YYYY (the common Indian spreadsheet format). */
function toYmd(v: string): string | null | 'bad' {
  const s = v.trim(); if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : 'bad';
}

type RowState = 'valid' | 'duplicate' | 'in_file' | 'invalid';
interface Parsed { line: number; input: MemberInput; state: RowState; problems: string[]; existing?: Member; planLabel: string }

function mapRows(rows: string[][], plans: PlanRef[]): Parsed[] | string {
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const idx = (k: keyof typeof ALIASES) => header.findIndex((h) => ALIASES[k].includes(h));
  const col = { name: idx('name'), phone: idx('phone'), email: idx('email'), plan: idx('plan'), start: idx('membershipStart'), end: idx('membershipEnd'), status: idx('status') };
  if (col.name < 0 || col.phone < 0) return 'The file needs at least a “name” and a “phone” column in its first row.';
  return rows.slice(1).map((r, i) => {
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const problems: string[] = [];
    const planText = get(col.plan);
    const plan = planText ? plans.find((p) => p.duration.toLowerCase() === planText.toLowerCase()) : undefined;
    if (planText && !plan) problems.push(`Plan “${planText}” doesn’t match a plan on the website — it will be left empty`);
    const start = toYmd(get(col.start)); const end = toYmd(get(col.end));
    if (start === 'bad') problems.push('Start date not understood (use YYYY-MM-DD or DD/MM/YYYY)');
    if (end === 'bad') problems.push('Expiry date not understood (use YYYY-MM-DD or DD/MM/YYYY)');
    const statusText = get(col.status).toLowerCase();
    const input: MemberInput = {
      name: get(col.name), phone: get(col.phone), email: get(col.email), planId: plan?.id ?? null,
      membershipStart: start === 'bad' ? null : start, membershipEnd: end === 'bad' ? null : end,
      status: statusText === 'inactive' ? 'inactive' : 'active', trainerId: null, notes: '',
    };
    const hard = validateMember(input);
    return { line: i + 2, input, state: hard.length ? 'invalid' : 'valid', problems: [...hard, ...problems], planLabel: plan?.duration ?? (planText || '—') };
  });
}

const STATE_UI: Record<RowState, { label: string; cls: string }> = {
  valid: { label: 'Ready', cls: 'bg-brand-400/15 text-brand-300' },
  duplicate: { label: 'Already a member', cls: 'bg-amber-400/15 text-amber-200' },
  in_file: { label: 'Repeated in file', cls: 'bg-amber-400/15 text-amber-200' },
  invalid: { label: 'Missing information', cls: 'bg-red-500/15 text-red-200' },
};

const CsvImport = () => {
  const actor = useActor();
  const { plans } = useLookups();
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [fileName, setFileName] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setDone(null); setRows(null); setFileName(file.name);
    const mapped = mapRows(parseCsv(await file.text()), [...plans.values()]);
    if (typeof mapped === 'string') { setError(mapped); return; }
    if (!mapped.length) { setError('No rows found under the header.'); return; }
    // Duplicates: against existing members, then within the file itself
    const existing = await membersByPhoneKeys(mapped.map((r) => phoneKey(r.input.phone)));
    const seen = new Set<string>();
    mapped.forEach((r) => {
      if (r.state !== 'valid') return;
      const key = phoneKey(r.input.phone);
      if (existing.has(key)) { r.state = 'duplicate'; r.existing = existing.get(key); }
      else if (seen.has(key)) r.state = 'in_file';
      seen.add(key);
    });
    setRows(mapped);
  };
  const summary = useMemo(() => {
    const c = { valid: 0, duplicate: 0, in_file: 0, invalid: 0 };
    rows?.forEach((r) => c[r.state]++);
    return c;
  }, [rows]);

  const run = async () => {
    if (!rows) return;
    setBusy(true);
    try { setDone(await importMembers(rows.filter((r) => r.state === 'valid').map((r) => r.input), actor, 'import')); setRows(null); }
    catch (e) { setError(`Import stopped: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand-400 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300 focus-within:ring-2 focus-within:ring-brand-400/50">
          <FileUp className="h-4 w-4" aria-hidden /> Choose CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose CSV file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="crunch-members-template.csv" className="inline-flex items-center gap-2 text-sm text-ink-300 hover:text-white"><Download className="h-4 w-4" aria-hidden /> Download template</a>
      </div>
      <p className="mt-3 text-xs text-ink-500">Columns: name, phone (required) · email, plan, start, expiry, status (optional). Plans must match a plan name on the website, e.g. “3 Months”.</p>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {done != null && <p role="status" className="mt-4 rounded-xl border border-brand-400/30 bg-brand-400/10 p-4 text-sm text-white">Imported {done} member{done === 1 ? '' : 's'}. <Link to="/admin/members" className="font-semibold underline">View members</Link></p>}

      {rows && (
        <div className="mt-6">
          <p className="text-sm text-white"><strong>{rows.length}</strong> rows found in {fileName}</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm" aria-label="Import summary">
            <li className="rounded-full bg-brand-400/15 px-3 py-1 text-brand-200">{summary.valid} ready</li>
            {summary.duplicate > 0 && <li className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">{summary.duplicate} already members</li>}
            {summary.in_file > 0 && <li className="rounded-full bg-amber-400/15 px-3 py-1 text-amber-200">{summary.in_file} repeated in file</li>}
            {summary.invalid > 0 && <li className="rounded-full bg-red-500/15 px-3 py-1 text-red-200">{summary.invalid} missing information</li>}
          </ul>
          <div className="mt-4 max-h-[28rem] overflow-auto rounded-2xl border border-white/[0.08]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-ink-900 text-xs uppercase tracking-wider text-ink-500"><tr>{['Row', 'Name', 'Phone', 'Plan', 'Expiry', 'Check'].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td className="px-3 py-2 text-ink-500">{r.line}</td>
                    <td className="px-3 py-2 text-white">{r.input.name || <span className="text-red-300">—</span>}</td>
                    <td className="px-3 py-2 tabular-nums text-ink-300">{r.input.phone}</td>
                    <td className="px-3 py-2 text-ink-300">{r.planLabel}</td>
                    <td className="px-3 py-2 text-ink-300">{r.input.membershipEnd ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STATE_UI[r.state].cls)}>{STATE_UI[r.state].label}</span>
                      {r.existing && <Link to={`/admin/members/${r.existing.id}`} className="ml-2 text-xs text-ink-400 underline">{r.existing.name}</Link>}
                      {r.problems.map((p) => <p key={p} className="mt-1 text-xs text-ink-400">{p}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="lg" disabled={busy || !summary.valid} onClick={run}>{busy ? 'Importing…' : `Import ${summary.valid} member${summary.valid === 1 ? '' : 's'}`}</Button>
            <Button variant="ghost" onClick={() => setRows(null)}>Cancel</Button>
            <p className="text-xs text-ink-500">Only rows marked “Ready” are imported. Nothing is changed for existing members.</p>
          </div>
        </div>
      )}
    </div>
  );
};

interface ClientRow { trainerId: string; clientId: string; name: string; phone: string; email: string; existing?: Member; linked?: boolean; problem?: string }

const FromTrainerClients = () => {
  const actor = useActor();
  const { trainers } = useLookups();
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const scan = async () => {
    setBusy(true); setDone(null);
    const all: ClientRow[] = [];
    await Promise.all([...trainers.keys()].map(async (tid) => {
      const s = await getDocs(collection(db, 'trainerData', tid, 'clients')).catch(() => null);
      s?.docs.forEach((d) => { const c = d.data(); all.push({ trainerId: tid, clientId: d.id, name: c.name ?? '', phone: c.phone ?? '', email: c.email ?? '' }); });
    }));
    const existing = await membersByPhoneKeys(all.map((r) => phoneKey(r.phone)));
    const seen = new Set<string>();
    all.forEach((r) => {
      const key = phoneKey(r.phone);
      if (key.length !== 10) r.problem = 'No valid phone number — add it in the trainer portal first';
      else if (existing.has(key)) { r.existing = existing.get(key); r.linked = r.existing?.trainerClient?.clientId === r.clientId; }
      else if (seen.has(key)) r.problem = 'Same phone as another client in this list';
      seen.add(key);
    });
    setRows(all.sort((a, b) => a.name.localeCompare(b.name))); setBusy(false);
  };

  const toCreate = rows?.filter((r) => !r.existing && !r.problem) ?? [];
  const toLink = rows?.filter((r) => r.existing && !r.linked) ?? [];
  const run = async () => {
    setBusy(true);
    const created = await importMembers(toCreate.map((r) => ({ name: r.name, phone: r.phone, email: r.email, planId: null, membershipStart: null, membershipEnd: null, status: 'active' as const, trainerId: r.trainerId, notes: '', trainerClient: { trainerId: r.trainerId, clientId: r.clientId } })), actor, 'trainer_client');
    await setLinks(toLink.map((r) => ({ member: r.existing!, link: { trainerId: r.trainerId, clientId: r.clientId } })), actor);
    setDone(`Added ${created} member${created === 1 ? '' : 's'} and linked ${toLink.length} existing member${toLink.length === 1 ? '' : 's'}.`);
    setRows(null); setBusy(false);
  };

  return (
    <div>
      <p className="max-w-2xl text-sm text-ink-300">Your trainers already keep client records in the trainer portal. This finds them, shows which aren’t in the members list yet, and adds them — or links them when a member with the same phone number already exists. Their training data stays with the trainer.</p>
      <Button className="mt-4" variant="outline" disabled={busy || !trainers.size} onClick={scan}><Users /> {busy && !rows ? 'Looking…' : 'Find trainer clients'}</Button>
      {done && <p role="status" className="mt-4 rounded-xl border border-brand-400/30 bg-brand-400/10 p-4 text-sm text-white">{done} <Link to="/admin/members" className="font-semibold underline">View members</Link></p>}
      {rows && (
        rows.length === 0 ? <p className="mt-4 text-sm text-ink-400">No trainer client records found.</p> : (
          <div className="mt-6">
            <p className="text-sm text-white">{rows.length} client records · <strong>{toCreate.length}</strong> to add · <strong>{toLink.length}</strong> to link · {rows.filter((r) => r.linked).length} already linked</p>
            <ul className="mt-3 max-h-96 divide-y divide-white/[0.06] overflow-auto rounded-2xl border border-white/[0.08]">
              {rows.map((r) => (
                <li key={`${r.trainerId}/${r.clientId}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                  <span className="min-w-0 flex-1 text-white">{r.name}<span className="ml-2 text-ink-500">{trainers.get(r.trainerId)?.name}</span></span>
                  <span className="text-xs text-ink-400">{r.problem ?? (r.linked ? 'Already linked' : r.existing ? `Link to ${r.existing.name}` : 'Add as member')}</span>
                </li>
              ))}
            </ul>
            <Button size="lg" className="mt-4" disabled={busy || (!toCreate.length && !toLink.length)} onClick={run}>{busy ? 'Working…' : `Add ${toCreate.length} · link ${toLink.length}`}</Button>
          </div>
        )
      )}
    </div>
  );
};

const ImportMembers = () => {
  const [tab, setTab] = useState<'csv' | 'trainers'>('csv');
  return (
    <AdminShell title="Import members" nav="members" area="People" back={{ to: '/admin/members', label: 'Members' }}>
      <div role="tablist" aria-label="Import source" className="mb-8 flex gap-1 border-b border-white/[0.08]">
        {([['csv', 'From a spreadsheet (CSV)'], ['trainers', 'From trainer clients']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('border-b-2 px-4 py-3 text-sm font-semibold', tab === id ? 'border-brand-400 text-white' : 'border-transparent text-ink-400 hover:text-white')}>{label}</button>
        ))}
      </div>
      {tab === 'csv' ? <CsvImport /> : <FromTrainerClients />}
    </AdminShell>
  );
};

export default ImportMembers;
