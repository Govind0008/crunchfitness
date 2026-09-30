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
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;   // tests only
    if (!raw && !emulator) { reason = 'FIREBASE_SERVICE_ACCOUNT is not set'; app = null; return app; }
    app = getApps()[0] ?? initializeApp(emulator ? { projectId: process.env.GCLOUD_PROJECT ?? 'demo-crunch' } : { credential: cert(JSON.parse(raw!)) });
  } catch (e) {
    reason = `FIREBASE_SERVICE_ACCOUNT could not be used: ${(e as Error).message}`;
    console.error('[firebase-admin]', reason);
    app = null;
  }
  return app;
}
export const firestoreOrNull = (): Firestore | null => { const a = admin(); return a ? getFirestore(a) : null; };
/** Why Firestore isn't available (for diagnostics), or '' when it is. */
export const adminProblem = () => (admin() ? '' : reason);

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
