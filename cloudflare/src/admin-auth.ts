// The part of `firebase-admin/auth` the server uses — verifyIdToken — without the Admin SDK, for
// Cloudflare Workers. Same checks as the Admin SDK: RS256 signature against Google's published
// Firebase keys, issuer and audience = the project, not expired, issued in the past, a user id.
// Anything else fails closed (throws), and api/_lib/firebase.ts requireAdmin() then refuses.
//
// Emulator tokens are unsigned; like the Admin SDK, they are accepted ONLY in a pure test setup:
// the Auth emulator configured (FIREBASE_AUTH_EMULATOR_HOST), Firestore on the emulator too, and
// no production service account present. Never in production.
import type { App } from './admin-app';

const JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keys: { until: number; byKid: Map<string, CryptoKey> } | null = null;

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlBytes(s))) as Record<string, unknown>;

async function signingKeys() {
  if (keys && Date.now() < keys.until) return keys.byKid;
  const res = await fetch(JWKS);
  if (!res.ok) throw new Error('Could not fetch Firebase signing keys');
  const maxAge = Number(res.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  const { keys: list } = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const byKid = new Map<string, CryptoKey>();
  for (const k of list) byKid.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
  keys = { until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000, byKid };
  return byKid;
}

export interface DecodedIdToken { uid: string; email?: string; [claim: string]: unknown }

export async function verifyFirebaseIdToken(token: string, projectId: string, nowSec = Math.floor(Date.now() / 1000)): Promise<DecodedIdToken> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = b64urlJson(parts[0]) as { alg?: string; kid?: string };
  const claims = b64urlJson(parts[1]) as { aud?: string; iss?: string; exp?: number; iat?: number; sub?: string; email?: string };
  const env = typeof process !== 'undefined' ? process.env : {};
  const emulator = !!env.FIREBASE_AUTH_EMULATOR_HOST && !!(env.FIRESTORE_EMULATOR_HOST || env.FIRESTORE_EMULATOR_URL) && !env.FIREBASE_SERVICE_ACCOUNT;
  if (!(emulator && header.alg === 'none')) {
    if (header.alg !== 'RS256' || !header.kid) throw new Error('Unexpected token algorithm');
    const key = (await signingKeys()).get(header.kid);
    if (!key) throw new Error('Unknown signing key');
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) throw new Error('Bad signature');
  }
  if (claims.aud !== projectId) throw new Error('Wrong audience');
  if (claims.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Wrong issuer');
  if (typeof claims.exp !== 'number' || claims.exp <= nowSec) throw new Error('Expired');
  if (typeof claims.iat !== 'number' || claims.iat > nowSec + 300) throw new Error('Issued in the future');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128) throw new Error('No user');
  return { ...claims, uid: claims.sub, email: claims.email };
}

export function getAuth(app?: App) {
  const projectId = app?.options.projectId ?? (typeof process !== 'undefined' ? process.env.GCLOUD_PROJECT : undefined) ?? '';
  return { verifyIdToken: (token: string) => verifyFirebaseIdToken(token, projectId) };
}
