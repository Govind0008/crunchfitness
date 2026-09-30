import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, collection, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Trainer attendance, trainer leave and trainer device links: admins only. The browser can never
// create attendance or invent a first punch; a manual check-out is audited and only closes a day
// that has a check-in and no check-out. Marketing, trainers and clients see none of it.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const GYM = 'crunch-wakad';
const apps: FirebaseApp[] = [];
let adminUid = '';
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `t${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  if (email) { const a = getAuth(app); connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true }); await signInWithEmailAndPassword(a, email, 'crunch-test-pass'); }
  return db;
}
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toMatch(/permission-denied/);
};
const first = '2026-09-20T00:30:00.000Z';
const checkout = (at: string, extra: Record<string, unknown> = {}) => ({
  manualCheckoutAt: Timestamp.fromDate(new Date(at)), checkoutAt: Timestamp.fromDate(new Date(at)), manualCheckoutBy: adminUid, manualCheckoutReason: 'Forgot to punch out',
  durationMs: Date.parse(at) - Date.parse(first), status: 'COMPLETED', exceptions: ['MANUAL_CHECKOUT'], updatedAt: serverTimestamp(), ...extra,
});
const leave = (extra: Record<string, unknown> = {}) => ({ trainerId: 'T1', from: '2026-10-01', to: '2026-10-02', type: 'casual', reason: 'Family', status: 'approved', notes: '', createdBy: adminUid, createdAt: serverTimestamp(), ...extra });

test.beforeAll(async () => {
  await resetFirestore();
  adminUid = await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('ta-marketing@crunch.test')}`, { role: 'marketing' });
  await seedDoc(`userRoles/${await ensureUser('ta-trainer@crunch.test')}`, { role: 'trainer', trainerId: 'T1' });
  await seedDoc(`userRoles/${await ensureUser('ta-client@crunch.test')}`, { role: 'client', trainerId: 'T1', clientId: 'c1' });
  await seedDoc('teamMembers/T1', { name: 'Coach One' });
  await seedDoc(`gyms/${GYM}/devices/dev1`, { gymId: GYM, name: 'Main entrance', model: 'eSSL X2008', enabled: true, nextUserId: 1 });
  await seedDoc('trainerAttendance/2026-09-20_T1', { gymId: GYM, trainerId: 'T1', trainerName: 'Coach One', date: '2026-09-20', punches: [Date.parse(first)], punchCount: 1, firstAt: ts(first), lastAt: null, checkoutAt: null, durationMs: null, status: 'MISSING_CHECKOUT', exceptions: [] });
  await seedDoc('trainerAttendance/2026-09-21_T1', { gymId: GYM, trainerId: 'T1', trainerName: 'Coach One', date: '2026-09-21', punchCount: 2, firstAt: ts('2026-09-21T00:30:00Z'), lastAt: ts('2026-09-21T10:30:00Z'), checkoutAt: ts('2026-09-21T10:30:00Z'), durationMs: 36_000_000, status: 'COMPLETED', exceptions: [] });
  await seedDoc('checkins/2026-09-20_m1', { memberId: 'm1', date: '2026-09-20', method: 'biometric', gymId: GYM });
  await seedDoc('accessEvents/e1', { gymId: GYM, deviceId: 'dev1', deviceUserId: '7', personType: 'trainer', trainerId: 'T1', memberId: null, at: first, result: 'granted' });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('trainer attendance: admins read it; nobody creates it from the browser', async () => {
  const db = await as(ADMIN.email);
  expect((await getDoc(doc(db, 'trainerAttendance', '2026-09-20_T1'))).data()!.status).toBe('MISSING_CHECKOUT');
  await denied(setDoc(doc(db, 'trainerAttendance', '2026-09-22_T1'), { trainerId: 'T1', date: '2026-09-22', status: 'COMPLETED' }));
  await denied(updateDoc(doc(db, 'trainerAttendance', '2026-09-20_T1'), { firstAt: Timestamp.fromDate(new Date('2026-09-20T00:00:00Z')), updatedAt: serverTimestamp() }));   // can't move a punch
});

test('manual check-out: after the check-in, with a reason, by the signed-in admin, only on an open day', async () => {
  const db = await as(ADMIN.email);
  const ref = doc(db, 'trainerAttendance', '2026-09-20_T1');
  await denied(updateDoc(ref, checkout('2026-09-20T00:00:00.000Z', { durationMs: -1 })));                  // before the check-in
  await denied(updateDoc(ref, checkout('2026-09-20T09:00:00.000Z', { manualCheckoutReason: '' })));          // no reason
  await denied(updateDoc(ref, checkout('2026-09-20T09:00:00.000Z', { manualCheckoutBy: 'someone-else' })));
  await denied(updateDoc(ref, checkout('2026-09-20T09:00:00.000Z', { punchCount: 2 })));                    // can't add punches
  await denied(updateDoc(doc(db, 'trainerAttendance', '2026-09-21_T1'), checkout('2026-09-21T12:00:00.000Z'))); // already has a check-out
  await updateDoc(ref, checkout('2026-09-20T09:00:00.000Z'));
  expect((await getDoc(ref)).data()).toMatchObject({ status: 'COMPLETED', manualCheckoutReason: 'Forgot to punch out', manualCheckoutBy: adminUid });
  await denied(updateDoc(ref, checkout('2026-09-20T10:00:00.000Z')));                                       // once closed, closed
});

test('leave: admins record and edit valid leave; it can’t be deleted', async () => {
  const db = await as(ADMIN.email);
  await setDoc(doc(db, 'trainerLeave', 'l1'), leave());
  await denied(setDoc(doc(db, 'trainerLeave', 'l2'), leave({ from: '2026-10-05', to: '2026-10-01' })));   // ends before it starts
  await denied(setDoc(doc(db, 'trainerLeave', 'l3'), leave({ type: 'holiday' })));
  await denied(setDoc(doc(db, 'trainerLeave', 'l4'), leave({ trainerId: 'nobody' })));
  await denied(setDoc(doc(db, 'trainerLeave', 'l5'), leave({ createdBy: 'someone-else' })));
  await updateDoc(doc(db, 'trainerLeave', 'l1'), { status: 'cancelled' });
  await denied(updateDoc(doc(db, 'trainerLeave', 'l1'), { trainerId: 'T2' }));
  const { deleteDoc } = await import('firebase/firestore');
  await denied(deleteDoc(doc(db, 'trainerLeave', 'l1')));
});

test('device links: a trainer link names a real trainer and no member', async () => {
  const db = await as(ADMIN.email);
  const base = { gymId: GYM, deviceId: 'dev1', method: 'fingerprint', status: 'PENDING', enrolledAt: null, lastSyncedAt: null, lastSyncAttemptAt: null, lastSyncError: null, createdBy: ADMIN.email, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(doc(db, 'biometricIdentities', 'dev1_7'), { ...base, deviceUserId: '7', personType: 'trainer', memberId: null, trainerId: 'T1' });
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_8'), { ...base, deviceUserId: '8', personType: 'trainer', memberId: null, trainerId: 'ghost' }));
  await denied(setDoc(doc(db, 'biometricIdentities', 'dev1_9'), { ...base, deviceUserId: '9', personType: 'trainer', memberId: 'm1', trainerId: 'T1' }));   // not both
  await setDoc(doc(db, 'biometricIdentities', 'dev1_10'), { ...base, deviceUserId: '10', personType: 'member', memberId: 'm1', trainerId: null });
});

test('marketing, trainers, clients and the public see no attendance, access or device-link data', async () => {
  for (const e of ['ta-marketing@crunch.test', 'ta-trainer@crunch.test', 'ta-client@crunch.test', undefined]) {
    const db = await as(e);
    await denied(getDoc(doc(db, 'trainerAttendance', '2026-09-20_T1')));
    await denied(getDocs(query(collection(db, 'trainerAttendance'), where('date', '==', '2026-09-20'))));
    await denied(getDocs(query(collection(db, 'trainerLeave'), where('trainerId', '==', 'T1'))));
    await denied(getDoc(doc(db, 'checkins', '2026-09-20_m1')));
    await denied(getDocs(query(collection(db, 'accessEvents'), where('gymId', '==', GYM))));
    await denied(getDocs(query(collection(db, 'biometricIdentities'), where('gymId', '==', GYM))));
    await denied(getDoc(doc(db, 'admsDiagnostics', 'JJA1254700696')));
  }
});
