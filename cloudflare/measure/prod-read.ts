// POC: the Workers auth path (google-auth.ts: RS256 JWT with Web Crypto → OAuth token) and the
// REST client (firestore-rest.ts) against PRODUCTION, read-only: one document get, one query.
import { readFileSync } from 'node:fs';
import { initializeApp } from '../src/admin-app';
import { getFirestore } from '../src/firestore-rest';
const sa = JSON.parse(readFileSync(process.env.SA_FILE!, 'utf8'));
const fs = getFirestore(initializeApp({ credential: sa }));
const t0 = performance.now();
const d = await fs.collection('admsDiagnostics').doc('JJA1254700696').get();
console.log('doc exists:', d.exists, '| lastSeenAt is a Timestamp:', typeof d.get('lastSeenAt')?.toMillis === 'function', '| push version:', d.get('pushVersion'), `| ${(performance.now() - t0).toFixed(0)} ms incl. token`);
const q = await fs.collection('gyms').doc('crunch-wakad').collection('devices').where('serialNumber', '==', 'JJA1254700696').limit(1).get();
console.log('device query size:', q.size, '| enabled:', q.docs[0]?.get('enabled'));
