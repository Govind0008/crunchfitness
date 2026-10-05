// POC: a Google OAuth access token for a service account, signed with Web Crypto (RS256) — what
// the Admin SDK does with Node's crypto. Cached per isolate until 5 minutes before it expires, so
// the RSA signature (the only CPU-heavy step) is spent about once an hour, not per request.
// The key comes only from a Worker secret; it is never logged or returned.
export interface ServiceAccount { client_email: string; private_key: string; project_id?: string; token_uri?: string }

const SCOPE = 'https://www.googleapis.com/auth/datastore';
const cache = new Map<string, { token: string; until: number; pending?: Promise<string> }>();

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = ''; for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
function pkcs8(pem: string) {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

/** A signed JWT assertion for the token endpoint (exported for the POC's offline test). */
export async function assertion(sa: ServiceAccount, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(sig)}`;
}

export async function accessToken(sa: ServiceAccount): Promise<string> {
  const hit = cache.get(sa.client_email);
  if (hit && Date.now() < hit.until) return hit.token;
  if (hit?.pending) return hit.pending;
  const pending = (async () => {
    const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await assertion(sa) }),
    });
    if (!res.ok) throw new Error(`Google token endpoint answered ${res.status}`);   // never the body: it can echo request details
    const j = (await res.json()) as { access_token: string; expires_in: number };
    cache.set(sa.client_email, { token: j.access_token, until: Date.now() + (j.expires_in - 300) * 1000 });
    return j.access_token;
  })();
  cache.set(sa.client_email, { token: '', until: 0, pending });
  try { return await pending; } catch (e) { cache.delete(sa.client_email); throw e; }
}
