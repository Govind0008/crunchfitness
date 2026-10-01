import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';
import { isCrmManaged, memberDecision, trainerDecision } from '../../api/_lib/access';

// Access control during the migration from the old CRM:
// - only device users the NEW CRM explicitly manages are judged by it;
// - old-system ("legacy") and unknown users are never denied, never changed on the device;
// - enrolment is confirmed only by the device's own evidence;
// - the rules enforce all of this, not just the screens.
// Named *-rules so it runs once (desktop project only).
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'server and rules tests run once');

const DAY = '2026-10-01';
const crm = { managedBy: 'crm', accessEnabled: true, status: 'SYNCED' };
const legacy = { status: 'SYNCED' };                                   // no marker = old system
const active = { status: 'active', membershipStart: '2026-01-01', membershipEnd: '2026-12-31' };

// ── Decision rules (pure) ─────────────────────────────────────────────────────
test('members managed by the new CRM: allowed only with a valid gym membership', () => {
  expect(memberDecision(crm, active, DAY)).toEqual({ decision: 'ACCESS_ALLOWED', reason: null });                                       // 1 active
  expect(memberDecision(crm, { ...active, membershipEnd: '2026-09-30' }, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'MEMBERSHIP_EXPIRED' });   // 2 expired
  expect(memberDecision(crm, { ...active, status: 'inactive' }, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'MEMBERSHIP_INACTIVE' });          // 3 inactive
  expect(memberDecision({ ...crm, accessEnabled: false }, active, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'ACCESS_DISABLED' });           // 4 switched off
  expect(memberDecision(crm, { ...active, accessOverride: 'blocked' }, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'MEMBER_BLOCKED' });        // 5 blocked
  expect(memberDecision(crm, { ...active, accessOverride: 'suspended' }, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'MEMBER_SUSPENDED' });
  expect(memberDecision(crm, { status: 'active', membershipEnd: null }, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'NO_VALID_MEMBERSHIP' });  // 6 none
  expect(memberDecision(crm, { status: 'active', membershipEnd: null }, DAY, true)).toEqual({ decision: 'ACCESS_DENIED', reason: 'PT_ONLY' });         // 7 PT only
  expect(memberDecision(crm, { ...active, membershipStart: '2026-11-01' }, DAY)).toEqual({ decision: 'ACCESS_DENIED', reason: 'MEMBERSHIP_NOT_STARTED' });
  // 8 renewed: the same identity, a new end date — eligible again (enrolment untouched)
  expect(memberDecision(crm, { ...active, membershipEnd: '2027-03-31' }, DAY).decision).toBe('ACCESS_ALLOWED');
  expect(isCrmManaged(crm)).toBe(true);                                                                                              // 9 CRM-enrolled → controlled
});

test('old-system and unknown device users are never denied by the new CRM', () => {
  // 10/11: expired, blocked, switched off — none of it applies to someone the old system manages
  expect(memberDecision(legacy, { ...active, membershipEnd: '2020-01-01' }, DAY)).toEqual({ decision: 'LEGACY_USER', reason: null });
  expect(memberDecision({ ...legacy, accessEnabled: false }, { ...active, accessOverride: 'blocked' }, DAY).decision).toBe('LEGACY_USER');
  expect(memberDecision({ managedBy: 'something-else' }, active, DAY).decision).toBe('LEGACY_USER');                 // only an explicit 'crm' counts
  expect(memberDecision(null, null, DAY)).toEqual({ decision: 'UNKNOWN_USER', reason: null });                        // 14 unknown
  expect(trainerDecision(null, false).decision).toBe('UNKNOWN_USER');
  expect(trainerDecision(legacy, true).decision).toBe('LEGACY_USER');
  expect(trainerDecision(crm, true)).toEqual({ decision: 'ACCESS_ALLOWED', reason: null });
  expect(trainerDecision({ ...crm, accessEnabled: false }, true)).toEqual({ decision: 'ACCESS_DENIED', reason: 'ACCESS_DISABLED' });
});

// ── Scans through ingest (emulator) ───────────────────────────────────────────
type Fs = import('firebase-admin/firestore').Firestore;
let fs: Fs;
let ingest: typeof import('../../api/_lib/ingest').ingestScans;
const scan = (pin: string, time: string, verify = 'fingerprint') => ({ pin, time, status: '0', verify });
const get = async (path: string) => (await fs.doc(path).get()).data();

test.beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  process.env.GCLOUD_PROJECT = PROJECT;
  fs = (await import('../../api/_lib/firebase')).firestoreOrNull()!;
  ingest = (await import('../../api/_lib/ingest')).ingestScans;
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('ac2-marketing@crunch.test')}`, { role: 'marketing' });
  await seedDoc('gyms/crunch-wakad/devices/dev1', { gymId: 'crunch-wakad', name: 'Main entrance', model: 'eSSL X2008', enabled: true, nextUserId: 900 });
  await seedDoc('gyms/crunch-wakad/devices/dev1/deviceUsers/77', { deviceUserId: '77', name: 'OLD MEMBER', admin: false, hasCard: false });
  await seedDoc('members/pt1', { name: 'PT Only', phone: '9000000101', phoneKey: '9000000101', status: 'active', membershipEnd: null, activeUntil: '9999-12-31' });
  await seedDoc('ptPackages/pk1', { memberId: 'pt1', packageName: '12 sessions', startDate: '2026-09-01', endDate: '2026-12-31' });
  await seedDoc('teamMembers/T1', { name: 'Coach One', role: 'Coach' });
  await seedDoc('biometricIdentities/dev1_31', { gymId: 'crunch-wakad', memberId: 'pt1', personType: 'member', deviceId: 'dev1', deviceUserId: '31', status: 'SYNCED', managedBy: 'crm', accessEnabled: true, enrollment: 'requested' });
  await seedDoc('biometricIdentities/dev1_41', { gymId: 'crunch-wakad', memberId: null, trainerId: 'T1', personType: 'trainer', deviceId: 'dev1', deviceUserId: '41', status: 'SYNCED', managedBy: 'crm', accessEnabled: false, enrollment: 'requested' });
});

test('PT-only member managed by the CRM: recorded as not allowed (PT_ONLY); a password scan doesn’t confirm a fingerprint', async () => {
  await ingest(fs, 'dev1', [scan('31', '2026-10-01 07:00:00', 'password')]);
  const ev = (await fs.collection('accessEvents').where('deviceUserId', '==', '31').get()).docs[0].data();
  expect(ev).toMatchObject({ decision: 'ACCESS_DENIED', decisionReason: 'PT_ONLY', result: 'denied', managedBy: 'crm' });
  expect((await get('biometricIdentities/dev1_31'))!.enrollment).toBe('requested');                // not proven by a password
  await ingest(fs, 'dev1', [scan('31', '2026-10-01 07:05:00', 'fingerprint')]);
  expect((await get('biometricIdentities/dev1_31'))!).toMatchObject({ enrollment: 'confirmed', enrollmentEvidence: 'fingerprint_scan' });
});

test('a trainer whose CRM access is off: recorded as not allowed, still trainer attendance, never a member visit', async () => {
  await ingest(fs, 'dev1', [scan('41', '2026-10-01 06:00:00')]);
  const ev = (await fs.collection('accessEvents').where('deviceUserId', '==', '41').get()).docs[0].data();
  expect(ev).toMatchObject({ personType: 'trainer', decision: 'ACCESS_DENIED', decisionReason: 'ACCESS_DISABLED' });
  expect(await get('trainerAttendance/2026-10-01_T1')).toMatchObject({ status: 'MISSING_CHECKOUT', punchCount: 1 });
  expect((await fs.collection('checkins').where('deviceUserId', '==', '41').get()).size).toBe(0);
});

test('an unknown device user is recorded — no member created, nothing sent to the device', async () => {
  const membersBefore = (await fs.collection('members').get()).size;
  await ingest(fs, 'dev1', [scan('77', '2026-10-01 08:00:00')]);
  const ev = (await fs.collection('accessEvents').where('deviceUserId', '==', '77').get()).docs[0].data();
  expect(ev).toMatchObject({ decision: 'UNKNOWN_USER', result: 'unknown_user', memberId: null, deviceUserName: 'OLD MEMBER' });
  expect((await fs.collection('members').get()).size).toBe(membersBefore);
  expect((await fs.collection('gyms/crunch-wakad/devices/dev1/commands').get()).size).toBe(0);
  expect(await get('gyms/crunch-wakad/devices/dev1/deviceUsers/77')).toMatchObject({ name: 'OLD MEMBER' });   // untouched
});

// ── Rules (browser, as staff) ─────────────────────────────────────────────────
const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `acr${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  if (email) { const a = getAuth(app); connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true }); await signInWithEmailAndPassword(a, email, 'crunch-test-pass'); }
  return db;
}
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toMatch(/permission-denied/);
};
const identity = (uid: string, extra: Record<string, unknown> = {}) => ({
  gymId: 'crunch-wakad', personType: 'member', memberId: 'pt1', trainerId: null, deviceId: 'dev1', deviceUserId: uid, method: 'fingerprint', status: 'PENDING',
  enrolledAt: null, lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null, createdBy: ADMIN.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});
const command = (type: string, uid?: string) => ({ type, ...(uid ? { deviceUserId: uid } : {}), status: 'queued', createdBy: ADMIN.email, createdAt: serverTimestamp() });

test('rules: the CRM can only claim users it creates; an old-system user stays the old system’s', async () => {
  const db = await as(ADMIN.email);
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_77'), identity('77', { managedBy: 'crm', accessEnabled: true, enrollment: 'not_enrolled' })));   // already on the device
  await setDoc(doc(db, 'biometricIdentities', 'dev1_77'), identity('77', { managedBy: 'legacy', accessEnabled: true, enrollment: 'unverified' }));           // a link for attendance is fine
  await setDoc(doc(db, 'biometricIdentities', 'dev1_901'), identity('901', { managedBy: 'crm', accessEnabled: true, enrollment: 'not_enrolled' }));           // a new ID: the CRM's
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_902'), identity('902', { managedBy: 'crm', accessEnabled: true, enrollment: 'confirmed' })));     // can't claim enrolled
});

test('rules: device commands that change a user are only for CRM-managed users', async () => {
  const db = await as(ADMIN.email);
  const cmd = (id: string) => doc(db, 'gyms', 'crunch-wakad', 'devices', 'dev1', 'commands', id);
  await setDoc(cmd('q1'), command('query_users'));                                       // reading the user list: always fine
  await setDoc(cmd('a1'), command('enroll_fp', '901'));                                  // CRM-managed
  await denied(setDoc(cmd('a2'), command('enroll_fp', '77')));                           // 13: old-system user — never touched
  await denied(setDoc(cmd('a3'), command('add_user', '77')));
  await denied(setDoc(cmd('a4'), command('enroll_fp', '555')));                          // nobody linked
  await denied(setDoc(cmd('a5'), { ...command('query_users'), raw: 'CLEAR DATA' }));     // no free-form command text, ever
  await denied(setDoc(cmd('a6'), command('delete_user', '901')));                        // only the three known requests
  const marketing = await as('ac2-marketing@crunch.test');
  await denied(setDoc(doc(marketing, 'gyms', 'crunch-wakad', 'devices', 'dev1', 'commands', 'm1'), command('query_users')));
});

test('rules: enrolment is requested, never confirmed, from the browser; the access switch is CRM-only', async () => {
  const db = await as(ADMIN.email);
  await updateDoc(doc(db, 'biometricIdentities', 'dev1_901'), { enrollment: 'requested', enrollmentRequestedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await denied(updateDoc(doc(db, 'biometricIdentities', 'dev1_901'), { enrollment: 'confirmed', updatedAt: serverTimestamp() }));
  await updateDoc(doc(db, 'biometricIdentities', 'dev1_901'), { accessEnabled: false, updatedAt: serverTimestamp() });   // 36: affects only this CRM user
  await denied(updateDoc(doc(db, 'biometricIdentities', 'dev1_77'), { accessEnabled: false, updatedAt: serverTimestamp() }));   // old-system user
  await denied(updateDoc(doc(db, 'biometricIdentities', 'dev1_77'), { enrollment: 'requested', updatedAt: serverTimestamp() }));
  // Explicit migration: staff hand the person to the new CRM — recorded, and only then controllable
  await updateDoc(doc(db, 'biometricIdentities', 'dev1_77'), { managedBy: 'crm', updatedAt: serverTimestamp() });
  await updateDoc(doc(db, 'biometricIdentities', 'dev1_77'), { accessEnabled: true, updatedAt: serverTimestamp() });
});

test('rules: "Open door" is one fixed request for the device — no user, no name, no text; admins only', async () => {
  const db = await as(ADMIN.email);
  const cmd = (id: string) => doc(db, 'gyms', 'crunch-wakad', 'devices', 'dev1', 'commands', id);
  await setDoc(cmd('o1'), command('unlock_door'));
  await denied(setDoc(cmd('o2'), command('unlock_door', '901')));                       // never aimed at a device user
  await denied(setDoc(cmd('o3'), { ...command('unlock_door'), name: 'X' }));
  await denied(setDoc(cmd('o4'), { ...command('unlock_door'), raw: 'AC_UNLOCK' }));
  await denied(setDoc(cmd('o5'), { ...command('unlock_door'), status: 'done' }));        // the browser can't claim it opened
  await denied(updateDoc(cmd('o1'), { status: 'done' }));
  const marketing = await as('ac2-marketing@crunch.test');
  await denied(setDoc(doc(marketing, 'gyms', 'crunch-wakad', 'devices', 'dev1', 'commands', 'm2'), command('unlock_door')));
  const nobody = await as();
  await denied(setDoc(doc(nobody, 'gyms', 'crunch-wakad', 'devices', 'dev1', 'commands', 'n1'), command('unlock_door')));
});
