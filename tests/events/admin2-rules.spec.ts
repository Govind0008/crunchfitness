import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, increment, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Admin 2.0 rules: members, attendance (self check-in), activity, settings, admin access to training data.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const PW = 'crunch-test-pass';
const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `a${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  if (email) {
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await signInWithEmailAndPassword(auth, email, PW);
  }
  return db;
}
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toBe('permission-denied');
};
const member = (extra: Record<string, unknown> = {}) => ({
  name: 'Asha Rao', nameLower: 'asha rao', phone: '9000000001', phoneKey: '9000000001', email: '', emailLower: '',
  planId: null, membershipStart: null, membershipEnd: null, status: 'active', activeUntil: '9999-12-31', trainerId: 'T1',
  trainerClient: null, notes: '', source: 'manual', ...extra,
});
async function checkIn(db: Firestore, sessionId: string, phoneKey: string, name = 'Walk In') {
  return runTransaction(db, async (tx) => {
    await tx.get(doc(db, 'classSessions', sessionId));
    tx.update(doc(db, 'classSessions', sessionId), { checkedInCount: increment(1) });
    tx.set(doc(db, 'attendance', `${sessionId}_${phoneKey}`), { sessionId, memberName: name, memberPhone: phoneKey, memberPhoneKey: phoneKey, checkedInAt: serverTimestamp() });
  });
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('trainer1@crunch.test', PW)}`, { role: 'trainer', trainerId: 'T1' });
  await seedDoc(`userRoles/${await ensureUser('client1@crunch.test', PW)}`, { role: 'client', trainerId: 'T1', clientId: 'C1' });
  await seedDoc('classSessions/s1', { title: 'Strength', date: '2030-01-01', startTime: '18:00', capacity: 2, trainerId: 'T1', pin: '1234' });
  await seedDoc('trainerData/T1/clients/C1', { name: 'Client One', phone: '9000000009' });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('only admins manage members; a trainer sees only their own', async () => {
  const admin = await as(ADMIN.email);
  await setDoc(doc(admin, 'members', 'm1'), member());
  await setDoc(doc(admin, 'members', 'm2'), member({ name: 'Other', nameLower: 'other', phone: '9000000002', phoneKey: '9000000002', trainerId: 'T2' }));
  await denied(setDoc(doc(admin, 'members', 'bad'), member({ phoneKey: '123' })));            // invalid phone key
  const trainer = await as('trainer1@crunch.test');
  expect((await getDocs(query(collection(trainer, 'members'), where('trainerId', '==', 'T1')))).size).toBe(1);
  await denied(getDoc(doc(trainer, 'members', 'm2')));
  await denied(setDoc(doc(trainer, 'members', 'x'), member()));
  const client = await as('client1@crunch.test');
  await denied(getDoc(doc(client, 'members', 'm1')));
  await denied(getDocs(collection(await as(), 'members')));
});

test('self check-in: once per person per class, capacity enforced, phones private', async () => {
  const anon = await as();
  await checkIn(anon, 's1', '9000000001');
  await denied(checkIn(anon, 's1', '9000000001'));                                             // duplicate
  await checkIn(anon, 's1', '9000000002');                                                      // 2 of 2
  await denied(checkIn(anon, 's1', '9000000003'));                                              // full
  await denied(updateDoc(doc(anon, 'classSessions', 's1'), { checkedInCount: 0 }));              // can't reset
  await denied(updateDoc(doc(anon, 'classSessions', 's1'), { capacity: 99 }));                   // can't resize
  await denied(setDoc(doc(anon, 'attendance', 'random'), { sessionId: 's1', memberName: 'x', memberPhone: '1', memberPhoneKey: '9000000004', checkedInAt: serverTimestamp() }));
  await denied(getDocs(collection(anon, 'attendance')));
  await denied(getDocs(collection(await as('client1@crunch.test'), 'attendance')));
  expect((await getDocs(query(collection(await as('trainer1@crunch.test'), 'attendance'), where('sessionId', '==', 's1')))).size).toBe(2);
  expect((await getDocs(collection(await as(ADMIN.email), 'attendance'))).size).toBe(2);
});

test('activity log is admin-only and append-only; settings admin-write', async () => {
  const admin = await as(ADMIN.email);
  const adminUid = (await getDocs(query(collection(admin, 'userRoles'), where('email', '==', ADMIN.email)))).docs[0].id;
  const b = writeBatch(admin);
  const ref = doc(collection(admin, 'activity'));
  b.set(ref, { action: 'Member created', actorUid: adminUid, actorEmail: ADMIN.email, refType: 'member', refId: 'm1', meta: {}, at: serverTimestamp() });
  await b.commit();
  await denied(updateDoc(ref, { action: 'Rewritten' }));
  await denied(setDoc(doc(admin, 'activity', 'forged'), { action: 'x', actorUid: 'someone-else', at: serverTimestamp() }));
  await denied(getDocs(collection(await as('trainer1@crunch.test'), 'activity')));
  await setDoc(doc(admin, 'settings', 'admin'), { expiringSoonDays: 14 });
  await denied(setDoc(doc(await as('trainer1@crunch.test'), 'settings', 'admin'), { expiringSoonDays: 1 }));
});

test('admins can read training data (for member profiles) but not write it', async () => {
  const admin = await as(ADMIN.email);
  expect((await getDoc(doc(admin, 'trainerData', 'T1', 'clients', 'C1'))).exists()).toBe(true);
  await denied(updateDoc(doc(admin, 'trainerData', 'T1', 'clients', 'C1'), { name: 'x' }));
});
