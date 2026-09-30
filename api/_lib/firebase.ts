import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// Firebase Admin for the server functions (api/*). Credentials come from the
// FIREBASE_SERVICE_ACCOUNT env var (a service-account key as JSON). In tests the emulators are
// used instead. Without credentials, `admin()` returns null and callers degrade safely.

let app: App | null | undefined;
let reason = '';

export function admin(): App | null {
  if (app !== undefined) return app;
  // Reasons are fixed phrases on purpose: parser errors quote the input, and the input here is
  // a private key — it must never reach a log or a response.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;   // tests only
  if (!raw && !emulator) { reason = 'not-set'; app = null; return app; }
  let parsed: Record<string, unknown> | null = null;
  if (!emulator) {
    try { parsed = JSON.parse(raw!.trim()); } catch { reason = 'not-json'; console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT is not valid JSON'); app = null; return app; }
    if (!parsed || typeof parsed.private_key !== 'string' || typeof parsed.client_email !== 'string') { reason = 'not-service-account'; console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT is JSON but not a service-account key'); app = null; return app; }
  }
  try {
    app = getApps()[0] ?? initializeApp(emulator ? { projectId: process.env.GCLOUD_PROJECT ?? 'demo-crunch' } : { credential: cert(parsed as never) });
  } catch {
    reason = 'rejected'; console.error('[firebase-admin] the service-account key was rejected');
    app = null;
  }
  return app;
}
export const firestoreOrNull = (): Firestore | null => { const a = admin(); return a ? getFirestore(a) : null; };
const PROBLEM: Record<string, string> = {
  'not-set': 'FIREBASE_SERVICE_ACCOUNT is not set for this deployment',
  'not-json': 'FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON (paste the whole key file)',
  'not-service-account': 'FIREBASE_SERVICE_ACCOUNT is JSON but not a service-account key',
  rejected: 'FIREBASE_SERVICE_ACCOUNT was rejected by Firebase',
};
/** Why Firestore isn't available, in fixed words (never key material), or '' when it is. */
export const adminProblem = () => (admin() ? '' : PROBLEM[reason] ?? 'not configured');

/** The signed-in admin behind a request (Firebase ID token in "Authorization: Bearer …"), or null. */
export async function requireAdmin(authorization: string | undefined): Promise<{ uid: string; email: string } | null> {
  const a = admin();
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!a || !token) return null;
  try {
    const decoded = await getAuth(a).verifyIdToken(token);
    const role = await getFirestore(a).collection('userRoles').doc(decoded.uid).get();
    return role.get('role') === 'admin' ? { uid: decoded.uid, email: decoded.email ?? '' } : null;
  } catch {
    return null;
  }
}
