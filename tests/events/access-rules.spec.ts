import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, collection, query, serverTimestamp, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Access control and member photos are admin-only, scoped to the admin's gym, and the browser
// can never mark a device online, a member synced, or write a scan.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const GYM = 'crunch-wakad';
const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<{ db: Firestore; st: FirebaseStorage }> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key', storageBucket: `${PROJECT}.appspot.com` }, `a${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  const st = getStorage(app);
  connectStorageEmulator(st, '127.0.0.1', 9199);
  if (email) { const a = getAuth(app); connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true }); await signInWithEmailAndPassword(a, email, 'crunch-test-pass'); }
  return { db, st };
}
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toMatch(/permission-denied|unauthorized/);
};
const device = (extra: Record<string, unknown> = {}) => ({
  gymId: GYM, name: 'Main entrance', model: 'eSSL F22', serialNumber: 'ABC123', location: '', protocol: 'adms', enabled: true, nextUserId: 1,
  lastSeenAt: null, lastSyncAt: null, firmware: null, lastError: null, createdBy: 'x', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});
const identity = (extra: Record<string, unknown> = {}) => ({
  gymId: GYM, memberId: 'm1', deviceId: 'dev1', deviceUserId: '1042', method: 'fingerprint', status: 'PENDING',
  enrolledAt: null, lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null, createdBy: 'x', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});
const member = { name: 'Asha Rao', phoneKey: '9000000001', phone: '9000000001', status: 'active', activeUntil: '2030-01-01' };

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('other-gym-admin@crunch.test')}`, { role: 'admin', gymId: 'other-gym' });
  await seedDoc(`userRoles/${await ensureUser('ac-marketing@crunch.test')}`, { role: 'marketing' });
  await seedDoc(`userRoles/${await ensureUser('ac-client@crunch.test')}`, { role: 'client', trainerId: 'T1', clientId: 'c1' });
  await seedDoc(`userRoles/${await ensureUser('ac-trainer@crunch.test')}`, { role: 'trainer', trainerId: 'T1' });
  await seedDoc(`gyms/${GYM}/devices/dev1`, { gymId: GYM, name: 'Main entrance', model: 'eSSL F22', protocol: 'adms', enabled: true, nextUserId: 1 });
  await seedDoc('accessEvents/e1', { gymId: GYM, deviceId: 'dev1', deviceUserId: '1042', memberId: 'm1', at: '2030-06-15T01:31:12.000Z', result: 'granted' });
  await seedDoc('members/m1', member);
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('devices: admins register them; only the integration service can mark them online', async () => {
  const { db } = await as(ADMIN.email);
  await setDoc(doc(db, 'gyms', GYM, 'devices', 'dev2'), device({ name: 'Back door' }));                     // a second device is fine
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev3'), device({ lastSeenAt: serverTimestamp() })));   // can't pretend it connected
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev4'), device({ gymId: 'other-gym' })));
  await updateDoc(doc(db, 'gyms', GYM, 'devices', 'dev2'), { location: 'Rear', updatedAt: serverTimestamp() });
  await denied(updateDoc(doc(db, 'gyms', GYM, 'devices', 'dev2'), { lastSeenAt: serverTimestamp() }));
  await denied(updateDoc(doc(db, 'gyms', GYM, 'devices', 'dev2'), { firmware: 'Ver 6.60' }));
  await denied(updateDoc(doc(db, 'gyms', GYM, 'devices', 'dev2'), { nextUserId: 0 }));                          // IDs never go backwards
  await denied(deleteDoc(doc(db, 'gyms', GYM, 'devices', 'dev2')));
  expect((await getDocs(collection(db, 'gyms', GYM, 'devices'))).size).toBe(2);
});

test('gyms are isolated: another gym’s admin can’t see or touch these devices', async () => {
  const { db } = await as('other-gym-admin@crunch.test');
  await denied(getDocs(collection(db, 'gyms', GYM, 'devices')));
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'x'), device()));
  await setDoc(doc(db, 'gyms', 'other-gym', 'devices', 'd1'), device({ gymId: 'other-gym' }));
  const mine = await as(ADMIN.email);
  await denied(getDocs(collection(mine.db, 'gyms', 'other-gym', 'devices')));
  await denied(getDocs(query(collection(db, 'accessEvents'), where('gymId', '==', GYM))));
});

test('device users: one person per ID per device; staff can’t claim “synced”', async () => {
  const { db } = await as(ADMIN.email);
  await setDoc(doc(db, 'biometricIdentities', 'dev1_1042'), identity());
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_1042'), identity({ memberId: 'm2' })));            // ID already taken
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_7'), identity({ deviceUserId: '8' })));            // id must match
  await denied(setDoc(doc(db, 'biometricIdentities', 'nodev_1'), identity({ deviceId: 'nodev', deviceUserId: '1' })));   // device must exist
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_9'), identity({ deviceUserId: '9', status: 'SYNCED' })));
  await updateDoc(doc(db, 'biometricIdentities', 'dev1_1042'), { status: 'ENROLLED', enrolledAt: serverTimestamp(), updatedAt: serverTimestamp() });
  for (const s of ['SYNCED', 'SYNCING', 'SYNC_FAILED']) await denied(updateDoc(doc(db, 'biometricIdentities', 'dev1_1042'), { status: s }));
  await denied(updateDoc(doc(db, 'biometricIdentities', 'dev1_1042'), { lastSyncedAt: serverTimestamp() }));
  await denied(updateDoc(doc(db, 'biometricIdentities', 'dev1_1042'), { memberId: 'someone-else' }));
  await updateDoc(doc(db, 'biometricIdentities', 'dev1_1042'), { status: 'DISABLED', updatedAt: serverTimestamp() });
  await denied(deleteDoc(doc(db, 'biometricIdentities', 'dev1_1042')));
  const other = await as('other-gym-admin@crunch.test');
  await denied(getDoc(doc(other.db, 'biometricIdentities', 'dev1_1042')));
});

test('scans are written by the integration service only', async () => {
  const { db } = await as(ADMIN.email);
  expect((await getDoc(doc(db, 'accessEvents', 'e1'))).exists()).toBe(true);
  await denied(setDoc(doc(db, 'accessEvents', 'fake'), { gymId: GYM, deviceId: 'dev1', deviceUserId: '1', result: 'granted', at: '2030-06-15T00:00:00Z' }));
  await denied(updateDoc(doc(db, 'accessEvents', 'e1'), { result: 'denied' }));
  await denied(deleteDoc(doc(db, 'accessEvents', 'e1')));
});

test('marketing, trainers, clients and the public get no access-control data', async () => {
  for (const e of ['ac-marketing@crunch.test', 'ac-trainer@crunch.test', 'ac-client@crunch.test', undefined]) {
    const { db } = await as(e);
    await denied(getDocs(collection(db, 'gyms', GYM, 'devices')));
    await denied(getDoc(doc(db, 'biometricIdentities', 'dev1_1042')));
    await denied(getDoc(doc(db, 'accessEvents', 'e1')));
    await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'x'), device()));
  }
});

test('member photo metadata and staff blocks are validated', async () => {
  const { db } = await as(ADMIN.email);
  await updateDoc(doc(db, 'members', 'm1'), { photo: { path: 'members/m1/photo', contentType: 'image/jpeg', size: 40000, updatedAt: serverTimestamp() } });
  await denied(updateDoc(doc(db, 'members', 'm1'), { photo: { path: 'members/m2/photo', contentType: 'image/jpeg', size: 40000 } }));       // another member's file
  await denied(updateDoc(doc(db, 'members', 'm1'), { photo: { path: 'members/m1/photo', contentType: 'application/pdf', size: 1 } }));
  await updateDoc(doc(db, 'members', 'm1'), { accessOverride: 'blocked', accessOverrideReason: 'Card shared' });
  await denied(updateDoc(doc(db, 'members', 'm1'), { accessOverride: 'vip' }));
  await updateDoc(doc(db, 'members', 'm1'), { accessOverride: null, accessOverrideReason: null });
});

test('member photos in Storage: admins only', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const admin = await as(ADMIN.email);
  await uploadBytes(ref(admin.st, 'members/m1/photo'), jpeg, { contentType: 'image/jpeg' });
  expect((await getBytes(ref(admin.st, 'members/m1/photo'))).byteLength).toBe(jpeg.byteLength);
  await denied(uploadBytes(ref(admin.st, 'members/m1/photo'), jpeg, { contentType: 'application/pdf' }));
  await denied(uploadBytes(ref(admin.st, 'public/anything.jpg'), jpeg, { contentType: 'image/jpeg' }));
  for (const e of ['ac-marketing@crunch.test', 'ac-trainer@crunch.test', 'ac-client@crunch.test', undefined]) {
    const { st } = await as(e);
    await denied(getBytes(ref(st, 'members/m1/photo')));
    await denied(uploadBytes(ref(st, 'members/m1/photo'), jpeg, { contentType: 'image/jpeg' }));
  }
});

test('device commands: admins may only queue the three safe requests; the relay alone records results', async () => {
  const { db } = await as(ADMIN.email);
  const cmd = (extra: Record<string, unknown> = {}) => ({ type: 'add_user', deviceUserId: '10061', name: 'Riya', status: 'queued', createdBy: ADMIN.email, createdAt: serverTimestamp(), ...extra });
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c0'), cmd()));   // nobody the CRM manages has that ID yet
  await seedDoc('biometricIdentities/dev1_10061', { gymId: GYM, memberId: 'm1', deviceId: 'dev1', deviceUserId: '10061', method: 'fingerprint', status: 'PENDING', managedBy: 'crm', accessEnabled: true, enrollment: 'not_enrolled' });
  await setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c1'), cmd());
  await setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c2'), { type: 'query_users', status: 'queued', createdBy: ADMIN.email, createdAt: serverTimestamp() });
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c3'), cmd({ type: 'delete_user' })));        // nothing destructive
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c4'), cmd({ command: 'DATA DELETE USERINFO PIN=1' })));   // no raw device commands
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c5'), cmd({ status: 'done' })));            // results come from the relay
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c6'), cmd({ createdBy: 'someone@else.test' })));
  await denied(updateDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c1'), { status: 'done' }));
  await denied(deleteDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c1')));
  const mk = await as('ac-marketing@crunch.test');
  await denied(setDoc(doc(mk.db, 'gyms', GYM, 'devices', 'dev1', 'commands', 'c7'), cmd({ createdBy: 'ac-marketing@crunch.test' })));
  await denied(getDocs(collection(mk.db, 'gyms', GYM, 'devices', 'dev1', 'commands')));
  // The device's user list: admins read it, nobody writes it from the browser
  await getDocs(collection(db, 'gyms', GYM, 'devices', 'dev1', 'deviceUsers'));
  await denied(setDoc(doc(db, 'gyms', GYM, 'devices', 'dev1', 'deviceUsers', '1'), { deviceUserId: '1', name: 'X' }));
  await denied(getDocs(collection(mk.db, 'gyms', GYM, 'devices', 'dev1', 'deviceUsers')));
});
