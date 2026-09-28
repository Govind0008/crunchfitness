// Helpers for tests that run against the Firebase emulators (project "demo-crunch").
// Nothing here can reach production: demo- projects only exist inside the emulator.
export const PROJECT = 'demo-crunch';
export const FS = 'http://127.0.0.1:8085';
export const AUTH = 'http://127.0.0.1:9099';

const docsUrl = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Wipe all Firestore data (emulator only). */
export async function resetFirestore() {
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
}

type V = string | number | boolean | null | V[] | { [k: string]: V };
/** Seed a Firestore timestamp: ts('2030-01-01T10:00:00Z') */
export const ts = (iso: string) => ({ __ts: iso });
const enc = (v: V): unknown => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if ('__ts' in v && typeof v.__ts === 'string') return { timestampValue: v.__ts };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
};

/** Write a document as the emulator owner (bypasses rules) — for seeding only. */
export async function seedDoc(path: string, data: Record<string, V>) {
  const res = await fetch(`${docsUrl}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }),
  });
  if (!res.ok) throw new Error(`seed ${path}: ${res.status} ${await res.text()}`);
}

/** Create (or reuse) an email/password user in the Auth emulator; returns its uid. */
export async function ensureUser(email: string, password = 'crunch-test-pass') {
  const call = (op: string) => fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=fake-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  }).then((r) => r.json());
  const up = await call('signUp');
  const data = up.localId ? up : await call('signInWithPassword');
  return data.localId as string;
}

export const ADMIN = { email: 'events-admin@crunch.test', password: 'crunch-test-pass' };

/** An admin account the way the real project must set one up: userRoles/{uid}.role = "admin". */
export async function seedAdmin() {
  const uid = await ensureUser(ADMIN.email, ADMIN.password);
  await seedDoc(`userRoles/${uid}`, { role: 'admin', email: ADMIN.email });
  return uid;
}
