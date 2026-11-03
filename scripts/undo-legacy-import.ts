// Undo an old-sheet import — a one-off admin script (the app itself can't: the rules forbid
// deleting payments, membership records and PT records, on purpose).
//
// Removes ONLY what the legacy importer created (`source: "legacy_excel"`): the imported payments,
// membership records, PT records, the import log entries and the members the import CREATED.
// Existing members that an import matched are never deleted — only the imported history on them.
//
// An imported member is KEPT (and listed) if anything real happened to them since: a receipt
// issued by staff, a check-in, a fingerprint, a photo, a trainer link, an access block, PT
// sessions logged, or an edit by staff (unless --include-edited).
//
// Dry run by default. Nothing is deleted without --apply, and everything deleted is first
// written to a backup JSON file.
//
//   FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" npx tsx scripts/undo-legacy-import.ts
//   npx tsx scripts/undo-legacy-import.ts --key key.json --file SEPTEMBER2026.xlsx
//   npx tsx scripts/undo-legacy-import.ts --key key.json --file SEPTEMBER2026.xlsx --apply --by you@example.com
//   --remove-fingerprint-links: also remove the fingerprint links of the imported members being deleted
//   (otherwise such a member is kept). Links of members who stay, and trainer links, are never touched.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FieldValue, getFirestore, Timestamp, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';

export const LEGACY_SOURCE = 'legacy_excel';

export interface UndoOptions {
  /** Only this import's file name (as shown under "Earlier imports"); all legacy imports if omitted */
  file?: string;
  /** Also delete imported members that staff edited after the import */
  includeEdited?: boolean;
  /** A fingerprint link doesn't keep an imported member: the link is removed with them */
  removeFingerprintLinks?: boolean;
}
interface Found { path: string; data: Record<string, unknown> }
export interface KeptMember { id: string; name: string; phone: string; reasons: string[] }
export interface UndoPlan {
  file: string | null;
  payments: Found[];
  memberships: Found[];
  ptPackages: Found[];
  imports: Found[];
  members: Found[];
  /** Fingerprint links (biometricIdentities) of the imported members being deleted — only with removeFingerprintLinks */
  identities: Found[];
  /** Imported members left in place, and why */
  kept: KeptMember[];
  /** Imported records left in place because something real depends on them */
  keptRecords: { path: string; reason: string }[];
  /** Members who existed before the import: only their imported history is removed */
  matchedMembers: { id: string; name: string; records: number }[];
}

const sameFile = (a: unknown, b: string) => String(a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
const found = (d: DocumentSnapshot): Found => ({ path: d.ref.path, data: d.data() ?? {} });
const idOf = (f: Found) => f.path.split('/').pop()!;

async function inChunks(db: Firestore, col: string, field: string, values: string[]) {
  const out: DocumentSnapshot[] = [];
  const unique = [...new Set(values)];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await db.collection(col).where(field, 'in', unique.slice(i, i + 30)).get();
    out.push(...snap.docs);
  }
  return out;
}

/** Work out what would be deleted. Reads only. */
export async function planUndo(db: Firestore, o: UndoOptions = {}): Promise<UndoPlan> {
  const legacy = async (col: string, fileField: string) => {
    const snap = await db.collection(col).where('source', '==', LEGACY_SOURCE).get();
    return snap.docs.map(found).filter((f) => !o.file || sameFile((f.data.legacy as Record<string, unknown> | undefined)?.[fileField], o.file));
  };
  const [payments, memberships, ptPackages, members] = await Promise.all([
    legacy('payments', 'file'), legacy('memberships', 'file'), legacy('ptPackages', 'file'), legacy('members', 'file'),
  ]);
  const importsSnap = await db.collection('imports').get();
  const imports = importsSnap.docs.map(found).filter((f) => f.data.kind === 'legacy_member_sheet' && (!o.file || sameFile(f.data.file, o.file)));

  // What real activity each imported member has
  const ids = members.map(idOf);
  const reasons = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  const add = (id: unknown, why: string) => { if (typeof id === 'string') reasons.get(id)?.add(why); };
  const [pays, mems, pts, checkins, bio] = await Promise.all([
    inChunks(db, 'payments', 'memberId', ids), inChunks(db, 'memberships', 'memberId', ids), inChunks(db, 'ptPackages', 'memberId', ids),
    inChunks(db, 'checkins', 'memberId', ids), inChunks(db, 'biometricIdentities', 'memberId', ids),
  ]);
  pays.filter((d) => d.get('source') !== LEGACY_SOURCE).forEach((d) => add(d.get('memberId'), `payment recorded by staff (${d.get('receiptNo') ?? d.id})`));
  [...mems, ...pts].filter((d) => d.get('source') !== LEGACY_SOURCE).forEach((d) => add(d.get('memberId'), 'membership or PT added by staff'));
  checkins.forEach((d) => add(d.get('memberId'), 'has check-ins'));
  if (!o.removeFingerprintLinks) bio.forEach((d) => add(d.get('memberId'), 'has a fingerprint enrolled'));
  members.forEach((m) => {
    const id = idOf(m), d = m.data;
    if (d.photo) add(id, 'has a photo');
    if (d.trainerClient) add(id, 'linked to a trainer client');
    if (d.accessOverride) add(id, 'has an access block');
    const c = d.createdAt as Timestamp | undefined, u = d.updatedAt as Timestamp | undefined;
    if (!o.includeEdited && c && u && u.toMillis() - c.toMillis() > 60_000) add(id, 'edited by staff after the import');
  });

  // Imported records something real depends on stay (a staff payment linked to it, PT sessions logged)
  const keptRecords: UndoPlan['keptRecords'] = [];
  const linked = new Set(pays.filter((d) => d.get('source') !== LEGACY_SOURCE).flatMap((d) => [d.get('membershipId'), d.get('ptPackageId')]).filter(Boolean) as string[]);
  const keep = (list: Found[], col: string) => list.filter((f) => {
    const why = linked.has(idOf(f)) ? 'a staff payment is linked to it' : col === 'ptPackages' && Number(f.data.sessionsUsed ?? 0) > 0 ? 'PT sessions were logged on it' : null;
    if (why) { keptRecords.push({ path: f.path, reason: why }); add(f.data.memberId, `imported ${col === 'ptPackages' ? 'PT package' : 'membership'} in use`); }
    return !why;
  });
  const membershipsToGo = keep(memberships, 'memberships');
  const ptToGo = keep(ptPackages, 'ptPackages');

  const kept: KeptMember[] = members.filter((m) => reasons.get(idOf(m))!.size).map((m) => ({ id: idOf(m), name: String(m.data.name ?? ''), phone: String(m.data.phone ?? ''), reasons: [...reasons.get(idOf(m))!] }));
  const keptIds = new Set(kept.map((k) => k.id));
  const importedIds = new Set(ids);
  const matched = new Map<string, number>();
  // Day-pass payments have no member (memberId '') — they just go with the import
  [...payments, ...membershipsToGo, ...ptToGo].forEach((f) => { const id = String(f.data.memberId ?? ''); if (id && !importedIds.has(id)) matched.set(id, (matched.get(id) ?? 0) + 1); });
  const matchedDocs = await Promise.all([...matched.keys()].map((id) => db.collection('members').doc(id).get()));

  const membersToGo = members.filter((m) => !keptIds.has(idOf(m)));
  const goingIds = new Set(membersToGo.map(idOf));
  // Links of members who stay are never touched; trainer links never match (memberId is a member's id)
  const identities = o.removeFingerprintLinks ? bio.filter((d) => goingIds.has(String(d.get('memberId')))).map(found) : [];
  return {
    file: o.file ?? null,
    payments, memberships: membershipsToGo, ptPackages: ptToGo, imports, identities,
    members: membersToGo,
    kept, keptRecords,
    matchedMembers: matchedDocs.map((d) => ({ id: d.id, name: String(d.get('name') ?? '(deleted member)'), records: matched.get(d.id)! })),
  };
}

const plain = (v: unknown): unknown =>
  v instanceof Timestamp ? v.toDate().toISOString() : Array.isArray(v) ? v.map(plain) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])) : v;

/** Everything the plan would delete, as JSON (dates as ISO strings) — written before deleting. */
export const backupOf = (p: UndoPlan) => JSON.stringify({
  takenAt: new Date().toISOString(), file: p.file,
  documents: [...p.payments, ...p.memberships, ...p.ptPackages, ...p.members, ...p.imports, ...p.identities].map((f) => ({ path: f.path, data: plain(f.data) })),
}, null, 1);

/** Delete what the plan lists, in batches, and log it. */
export async function applyUndo(db: Firestore, p: UndoPlan, by: string) {
  const paths = [...p.payments, ...p.memberships, ...p.ptPackages, ...p.members, ...p.imports, ...p.identities].map((f) => f.path);
  for (let i = 0; i < paths.length; i += 400) {
    const b = db.batch();
    paths.slice(i, i + 400).forEach((path) => b.delete(db.doc(path)));
    await b.commit();
  }
  const counts = { members: p.members.length, payments: p.payments.length, memberships: p.memberships.length, ptPackages: p.ptPackages.length, importLogs: p.imports.length, fingerprintLinks: p.identities.length, membersKept: p.kept.length };
  await db.collection('activity').add({
    action: 'Legacy import undone', actorUid: 'admin-script', actorEmail: by, refType: 'import', refId: null,
    meta: { file: p.file ?? 'all legacy imports', ...counts }, at: FieldValue.serverTimestamp(),
  });
  return counts;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function report(p: UndoPlan, project: string) {
  const line = (n: number, what: string) => console.log(`  ${String(n).padStart(5)}  ${what}`);
  console.log(`\nProject: ${project}`);
  console.log(`Import:  ${p.file ?? 'ALL legacy imports'}\n\nWould delete:`);
  line(p.members.length, 'members created by the import');
  line(p.payments.length, 'imported payments');
  line(p.memberships.length, 'imported membership records');
  line(p.ptPackages.length, 'imported PT records');
  line(p.imports.length, 'import log entries ("Earlier imports")');
  if (p.identities.length) line(p.identities.length, 'fingerprint links of those members (the device keeps its users; they show as unlinked)');
  if (p.matchedMembers.length) {
    console.log('\nExisting members — NOT deleted, only their imported history is removed:');
    p.matchedMembers.forEach((m) => console.log(`  ${m.name} (${m.id}): ${m.records} record(s)`));
  }
  if (p.kept.length) {
    console.log('\nImported members KEPT because something real happened to them (decide by hand):');
    p.kept.forEach((k) => console.log(`  ${k.name} ${k.phone} (${k.id}): ${k.reasons.join('; ')}`));
  }
  if (p.keptRecords.length) {
    console.log('\nImported records KEPT:');
    p.keptRecords.forEach((r) => console.log(`  ${r.path}: ${r.reason}`));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const key = opt('--key');
  if (key) process.env.FIREBASE_SERVICE_ACCOUNT = readFileSync(key, 'utf8');
  const { admin } = await import('../api/_lib/firebase');
  const app = admin();
  if (!app) { console.error('No Firebase credentials. Pass --key <service-account.json> or set FIREBASE_SERVICE_ACCOUNT.'); process.exit(1); }
  const db = getFirestore(app);
  const project = process.env.FIRESTORE_EMULATOR_HOST ? `${process.env.GCLOUD_PROJECT ?? 'demo-crunch'} (emulator)` : String(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!).project_id);
  const plan = await planUndo(db, { file: opt('--file'), includeEdited: args.includes('--include-edited'), removeFingerprintLinks: args.includes('--remove-fingerprint-links') });
  report(plan, project);
  const total = plan.members.length + plan.payments.length + plan.memberships.length + plan.ptPackages.length + plan.imports.length + plan.identities.length;
  if (!args.includes('--apply')) { console.log('\nDry run — nothing was deleted. Add --apply to delete.'); return; }
  if (!total) { console.log('\nNothing to delete.'); return; }
  const backup = `legacy-undo-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(backup, backupOf(plan));
  console.log(`\nBackup written: ${backup}`);
  const done = await applyUndo(db, plan, opt('--by') ?? 'admin script');
  console.log('Deleted:', done);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
