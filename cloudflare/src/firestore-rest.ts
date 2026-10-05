// POC: the part of `firebase-admin/firestore` the ADMS relay uses, over the Firestore REST API,
// so the relay (api/iclock.ts and api/_lib/*) runs unchanged on Cloudflare Workers, where the
// Admin SDK (gRPC, Node streams) can't. wrangler.toml aliases `firebase-admin/firestore` here.
//
// Supported: doc/collection refs, get/set(merge)/update/delete, where(==,<,<=,>,>=,in)/orderBy/
// limit queries, getAll, batches, transactions (retried on contention), serverTimestamp,
// arrayUnion, increment, delete sentinels, Timestamp. Not supported: realtime listeners
// (onSnapshot throws — the relay falls back to its periodic check with ADMS_COMMAND_LISTEN=0).
import { accessToken, type ServiceAccount } from './google-auth';

// ── Values ─────────────────────────────────────────────────────────────────────────────────────
export class Timestamp {
  constructor(readonly seconds: number, readonly nanoseconds: number) {}
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), Math.round((ms % 1000) * 1e6)); }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  isEqual(o: Timestamp) { return o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  valueOf() { return String(this.toMillis()).padStart(16, '0'); }
  toRfc3339() { return new Date(this.seconds * 1000).toISOString().replace(/\.\d{3}Z$/, `.${String(this.nanoseconds).padStart(9, '0')}Z`); }
}
type Sentinel = { __fv: 'serverTimestamp' } | { __fv: 'arrayUnion'; values: unknown[] } | { __fv: 'increment'; by: number } | { __fv: 'delete' };
const isSentinel = (v: unknown): v is Sentinel => !!v && typeof v === 'object' && '__fv' in (v as object);
export const FieldValue = {
  serverTimestamp: (): Sentinel => ({ __fv: 'serverTimestamp' }),
  arrayUnion: (...values: unknown[]): Sentinel => ({ __fv: 'arrayUnion', values }),
  increment: (by: number): Sentinel => ({ __fv: 'increment', by }),
  delete: (): Sentinel => ({ __fv: 'delete' }),
};

type Rest = Record<string, unknown>;
const isPlainMap = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date) && !isSentinel(v) && !(v instanceof DocumentReference);
function encode(v: unknown): Rest {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Timestamp) return { timestampValue: v.toRfc3339() };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (v instanceof DocumentReference) return { referenceValue: v.name };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (isPlainMap(v)) return { mapValue: { fields: encodeFields(v) } };
  throw new Error(`Unsupported Firestore value: ${typeof v}`);
}
function encodeFields(o: Record<string, unknown>): Record<string, Rest> {
  const out: Record<string, Rest> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && !isSentinel(v)) out[k] = encode(v);
  return out;
}
function decode(v: Rest): unknown {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) {
    const s = String(v.timestampValue);
    const nanos = Number((s.match(/\.(\d+)Z$/)?.[1] ?? '0').padEnd(9, '0'));
    return new Timestamp(Math.floor(Date.parse(s.replace(/\.\d+Z$/, 'Z')) / 1000), nanos);
  }
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('arrayValue' in v) return (((v.arrayValue as Rest).values as Rest[]) ?? []).map(decode);
  if ('mapValue' in v) return decodeFields(((v.mapValue as Rest).fields as Record<string, Rest>) ?? {});
  return null;
}
const decodeFields = (f: Record<string, Rest>) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

// Field paths: segments that aren't plain identifiers are quoted with backticks (REST syntax)
const quote = (seg: string) => (/^[A-Za-z_][A-Za-z_0-9]*$/.test(seg) ? seg : `\`${seg.replace(/[`\\]/g, (c) => `\\${c}`)}\``);
const joinPath = (segs: string[]) => segs.map(quote).join('.');
/** Leaf paths of `data` (maps recursed, like the Admin SDK's merge), and its transforms. */
function walk(data: Record<string, unknown>, prefix: string[], leaves: string[][], transforms: Rest[], recurseMaps: boolean) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    const p = [...prefix, k];
    if (isSentinel(v)) {
      if (v.__fv === 'delete') { leaves.push(p); continue; }
      const fieldPath = joinPath(p);
      if (v.__fv === 'serverTimestamp') transforms.push({ fieldPath, setToServerValue: 'REQUEST_TIME' });
      else if (v.__fv === 'arrayUnion') transforms.push({ fieldPath, appendMissingElements: { values: v.values.map(encode) } });
      else transforms.push({ fieldPath, increment: encode(v.by) });
    } else if (recurseMaps && isPlainMap(v) && Object.keys(v).length) walk(v, p, leaves, transforms, true);
    else leaves.push(p);
  }
}

// ── Connection ─────────────────────────────────────────────────────────────────────────────────
interface Conn { projectId: string; origin: string; auth: () => Promise<string> }
function connect(projectId: string, sa: ServiceAccount | null): Conn {
  // Emulator (tests only): a host:port, or a full URL when the emulator is reached through a tunnel
  const env = typeof process !== 'undefined' ? process.env : {};
  const emu = env.FIRESTORE_EMULATOR_URL ?? (env.FIRESTORE_EMULATOR_HOST ? `http://${env.FIRESTORE_EMULATOR_HOST}` : undefined);
  if (emu) return { projectId, origin: emu.replace(/\/$/, ''), auth: async () => 'Bearer owner' };
  if (!sa) throw new Error('No Firestore credentials');
  return { projectId, origin: 'https://firestore.googleapis.com', auth: async () => `Bearer ${await accessToken(sa)}` };
}
class FirestoreError extends Error { constructor(message: string, readonly code: number, readonly status: string) { super(message); } }
async function call(c: Conn, url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: await c.auth(), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 404 && body === undefined) return null;
  const json = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
  if (!res.ok) throw new FirestoreError(json.error?.message ?? `Firestore ${res.status}`, res.status, json.error?.status ?? '');
  return json;
}

// ── Snapshots ──────────────────────────────────────────────────────────────────────────────────
export class DocumentSnapshot {
  constructor(readonly ref: DocumentReference, private readonly fields: Record<string, unknown> | null) {}
  get id() { return this.ref.id; }
  get exists() { return this.fields !== null; }
  data() { return this.fields ? { ...this.fields } : undefined; }
  get(path: string): unknown {
    let cur: unknown = this.fields;
    for (const seg of path.split('.')) { if (!cur || typeof cur !== 'object') return undefined; cur = (cur as Record<string, unknown>)[seg]; }
    return cur;
  }
}
export class QuerySnapshot {
  constructor(readonly docs: DocumentSnapshot[]) {}
  get size() { return this.docs.length; }
  get empty() { return this.docs.length === 0; }
  forEach(fn: (d: DocumentSnapshot) => void) { this.docs.forEach(fn); }
  docChanges() { return this.docs.map((doc) => ({ type: 'added' as const, doc })); }
}

// ── References & queries ───────────────────────────────────────────────────────────────────────
const OPS: Record<string, string> = { '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL', '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', in: 'IN', 'array-contains': 'ARRAY_CONTAINS' };
export class Query {
  constructor(protected readonly db: Firestore, readonly path: string, protected readonly q: { where: Rest[]; orderBy: Rest[]; limit?: number } = { where: [], orderBy: [] }) {}
  where(field: string, op: string, value: unknown) {
    if (!OPS[op]) throw new Error(`Unsupported operator ${op}`);
    return new Query(this.db, this.path, { ...this.q, where: [...this.q.where, { fieldFilter: { field: { fieldPath: field }, op: OPS[op], value: encode(value) } }] });
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc') { return new Query(this.db, this.path, { ...this.q, orderBy: [...this.q.orderBy, { field: { fieldPath: field }, direction: dir === 'desc' ? 'DESCENDING' : 'ASCENDING' }] }); }
  limit(n: number) { return new Query(this.db, this.path, { ...this.q, limit: n }); }
  /** The REST request for this query (parent document URL + structured query). */
  request(transaction?: string) {
    const segs = this.path.split('/');
    const collectionId = segs.pop()!;
    const where = this.q.where.length === 0 ? undefined : this.q.where.length === 1 ? this.q.where[0] : { compositeFilter: { op: 'AND', filters: this.q.where } };
    return {
      url: `${this.db.base}${segs.length ? `/${segs.join('/')}` : ''}:runQuery`,
      body: { structuredQuery: { from: [{ collectionId }], ...(where ? { where } : {}), ...(this.q.orderBy.length ? { orderBy: this.q.orderBy } : {}), ...(this.q.limit ? { limit: this.q.limit } : {}) }, ...(transaction ? { transaction } : {}) },
    };
  }
  async get(transaction?: string) {
    const { url, body } = this.request(transaction);
    const rows = (await call(this.db.conn, url, body)) as { document?: { name: string; fields?: Record<string, Rest> } }[];
    return new QuerySnapshot(rows.filter((r) => r.document).map((r) => new DocumentSnapshot(this.db.doc(this.db.pathOf(r.document!.name)), decodeFields(r.document!.fields ?? {}))));
  }
  onSnapshot(): never { throw new Error('Realtime listeners are not available on Workers (set ADMS_COMMAND_LISTEN=0)'); }
}
export class CollectionReference extends Query {
  get id() { return this.path.split('/').pop()!; }
  doc(id?: string) { return new DocumentReference(this.db, `${this.path}/${id ?? autoId()}`); }
}
export class DocumentReference {
  constructor(private readonly db: Firestore, readonly path: string) {}
  get id() { return this.path.split('/').pop()!; }
  get name() { return `${this.db.root}/${this.path}`; }
  collection(id: string) { return new CollectionReference(this.db, `${this.path}/${id}`); }
  async get() {
    const doc = (await call(this.db.conn, `${this.db.base}/${this.path}`)) as { fields?: Record<string, Rest> } | null;
    return new DocumentSnapshot(this, doc ? decodeFields(doc.fields ?? {}) : null);
  }
  set(data: Record<string, unknown>, opts?: { merge?: boolean }) { return this.db.commit([setWrite(this, data, opts)]); }
  update(data: Record<string, unknown>) { return this.db.commit([updateWrite(this, data)]); }
  delete() { return this.db.commit([{ delete: this.name }]); }
}
const autoId = () => { const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; const r = crypto.getRandomValues(new Uint8Array(20)); return [...r].map((b) => a[b % a.length]).join(''); };

function setWrite(ref: DocumentReference, data: Record<string, unknown>, opts?: { merge?: boolean }): Rest {
  const leaves: string[][] = []; const transforms: Rest[] = [];
  walk(data, [], leaves, transforms, !!opts?.merge);
  return { update: { name: ref.name, fields: encodeFields(data) }, ...(opts?.merge ? { updateMask: { fieldPaths: leaves.map(joinPath) } } : {}), ...(transforms.length ? { updateTransforms: transforms } : {}) };
}
function updateWrite(ref: DocumentReference, data: Record<string, unknown>): Rest {
  // update() keys are field paths ("a.b"); build the nested fields and mask from them
  const fields: Record<string, unknown> = {}; const mask: string[] = []; const transforms: Rest[] = [];
  for (const [path, v] of Object.entries(data)) {
    const segs = path.split('.');
    if (isSentinel(v) && v.__fv !== 'delete') { const t: Rest[] = []; walk({ [segs.at(-1)!]: v }, segs.slice(0, -1), [], t, false); transforms.push(...t); continue; }
    mask.push(joinPath(segs));
    if (isSentinel(v)) continue;   // delete: in the mask, absent from fields
    let cur = fields;
    segs.slice(0, -1).forEach((s) => { cur = (cur[s] ??= {}) as Record<string, unknown>; });
    cur[segs.at(-1)!] = v;
  }
  return { update: { name: ref.name, fields: encodeFields(fields) }, updateMask: { fieldPaths: mask }, currentDocument: { exists: true }, ...(transforms.length ? { updateTransforms: transforms } : {}) };
}

// ── Batches & transactions ─────────────────────────────────────────────────────────────────────
export class WriteBatch {
  protected writes: Rest[] = [];
  constructor(protected readonly db: Firestore) {}
  set(ref: DocumentReference, data: Record<string, unknown>, opts?: { merge?: boolean }) { this.writes.push(setWrite(ref, data, opts)); return this; }
  update(ref: DocumentReference, data: Record<string, unknown>) { this.writes.push(updateWrite(ref, data)); return this; }
  delete(ref: DocumentReference) { this.writes.push({ delete: ref.name }); return this; }
  commit() { return this.db.commit(this.writes); }
}
export class Transaction extends WriteBatch {
  constructor(db: Firestore, readonly id: string) { super(db); }
  async get(target: DocumentReference | Query) {
    if (target instanceof Query) return target.get(this.id);
    return (await this.db.getAllIn([target], this.id))[0];
  }
  getAll(...refs: DocumentReference[]) { return this.db.getAllIn(refs, this.id); }
  pending() { return this.writes; }
}

// ── The database ───────────────────────────────────────────────────────────────────────────────
export class Firestore {
  readonly conn: Conn;
  constructor(projectId: string, sa: ServiceAccount | null) { this.conn = connect(projectId, sa); }
  get root() { return `projects/${this.conn.projectId}/databases/(default)/documents`; }
  get base() { return `${this.conn.origin}/v1/${this.root}`; }
  pathOf(name: string) { return name.slice(this.root.length + 1); }
  settings() { /* the Admin SDK's settings() — nothing to configure over REST */ }
  collection(path: string) { return new CollectionReference(this, path); }
  doc(path: string) { return new DocumentReference(this, path); }
  batch() { return new WriteBatch(this); }
  getAll(...refs: DocumentReference[]) { return this.getAllIn(refs); }
  async getAllIn(refs: DocumentReference[], transaction?: string) {
    if (!refs.length) return [];
    const rows = (await call(this.conn, `${this.base}:batchGet`, { documents: refs.map((r) => r.name), ...(transaction ? { transaction } : {}) })) as { found?: { name: string; fields?: Record<string, Rest> }; missing?: string }[];
    const byName = new Map(rows.map((r) => [r.found?.name ?? r.missing!, r.found ? decodeFields(r.found.fields ?? {}) : null]));
    return refs.map((r) => new DocumentSnapshot(r, byName.get(r.name) ?? null));
  }
  async commit(writes: Rest[], transaction?: string) {
    if (!writes.length && !transaction) return [];
    // The Admin SDK commits at most 500 writes per batch; the relay already chunks below that
    const res = (await call(this.conn, `${this.base}:commit`, { writes, ...(transaction ? { transaction } : {}) })) as { writeResults?: unknown[] };
    return res.writeResults ?? [];
  }
  async runTransaction<T>(fn: (tx: Transaction) => Promise<T>, opts: { maxAttempts?: number } = {}): Promise<T> {
    const attempts = opts.maxAttempts ?? 5;
    for (let i = 1; ; i++) {
      const { transaction } = (await call(this.conn, `${this.base}:beginTransaction`, {})) as { transaction: string };
      const tx = new Transaction(this, transaction);
      try {
        const out = await fn(tx);
        await this.commit(tx.pending(), transaction);
        return out;
      } catch (e) {
        await call(this.conn, `${this.base}:rollback`, { transaction }).catch(() => {});
        const contention = e instanceof FirestoreError && (e.status === 'ABORTED' || e.code === 409);
        if (!contention || i >= attempts) throw e;
        await new Promise((r) => setTimeout(r, 50 * 2 ** i));
      }
    }
  }
}

const instances = new Map<string, Firestore>();
/** `getFirestore(app)` — one REST client per app (credentials from the app's options). */
export function getFirestore(app?: { options?: { projectId?: string; credential?: ServiceAccount } }) {
  const sa = app?.options?.credential ?? null;
  const projectId = app?.options?.projectId ?? sa?.project_id ?? 'demo-crunch';
  const key = `${projectId}|${sa?.client_email ?? 'emulator'}`;
  if (!instances.has(key)) instances.set(key, new Firestore(projectId, sa));
  return instances.get(key)!;
}
