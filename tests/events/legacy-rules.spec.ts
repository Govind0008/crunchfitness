import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, query, serverTimestamp, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// Imported history, PT packages and membership periods: staff-only money and member data.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `l${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  if (email) { const a = getAuth(app); connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true }); await signInWithEmailAndPassword(a, email, 'crunch-test-pass'); }
  return db;
}
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toBe('permission-denied');
};
const legacyPay = (extra: Record<string, unknown> = {}) => ({
  receiptNo: null, receiptSeq: null, paymentType: 'pt', source: 'legacy_excel', memberId: 'lx_9000000001', memberName: 'Asha', memberPhone: '9000000001', memberPhoneKey: '9000000001',
  planId: null, planName: '1 Month PT', amountPaise: 800000, countedPaise: 800000, method: 'unknown', reference: '', paidOn: '2022-09-01',
  coversFrom: '2022-09-02', coversTo: '2022-10-02', notes: '', status: 'paid', createdBy: 'x', createdAt: serverTimestamp(), ...extra,
});
const pt = (extra: Record<string, unknown> = {}) => ({ memberId: 'm1', trainerId: 'T1', packageName: '1 Month PT', sessionsIncluded: null, sessionsRemaining: null, startDate: '2030-01-01', endDate: '2030-01-31', notes: '', paymentId: null, source: 'payment', createdBy: 'x', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('lx-marketing@crunch.test')}`, { role: 'marketing' });
  await seedDoc(`userRoles/${await ensureUser('lx-trainer@crunch.test')}`, { role: 'trainer', trainerId: 'T1' });
  await seedDoc(`userRoles/${await ensureUser('lx-client@crunch.test')}`, { role: 'client', trainerId: 'T1', clientId: 'c1' });
  await seedDoc('ptPackages/mine', { memberId: 'm1', trainerId: 'T1', packageName: 'PT', source: 'payment', startDate: '2030-01-01', endDate: '2030-01-31', createdAt: ts('2030-01-01T00:00:00Z') });
  await seedDoc('ptPackages/other', { memberId: 'm2', trainerId: 'T2', packageName: 'PT', source: 'payment', startDate: '2030-01-01', endDate: '2030-01-31', createdAt: ts('2030-01-01T00:00:00Z') });
  await seedDoc('memberships/ms1', { memberId: 'm1', startDate: '2022-01-01', endDate: '2022-02-01', source: 'legacy_excel', planLabel: '1 Month', createdAt: ts('2030-01-01T00:00:00Z') });
  await seedDoc('imports/i1', { file: 'x.xlsx', payments: 1, createdBy: 'x', actorUid: 'x', createdAt: ts('2030-01-01T00:00:00Z') });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('imported payments: keyed id, no receipt number, never through the receipt counter', async () => {
  const a = await as(ADMIN.email);
  await setDoc(doc(a, 'payments', 'lx_9000000001_2022-09-01_pt_1_2022-09-02_2022-10-02_800000_p'), legacyPay());
  await denied(setDoc(doc(a, 'payments', 'random-id'), legacyPay()));                                    // id must be the row key
  await denied(setDoc(doc(a, 'payments', 'lx_x_p'), legacyPay({ receiptNo: 'CR-R-0099', receiptSeq: 99 }))); // can't mint receipt numbers
  await denied(setDoc(doc(a, 'payments', 'lx_y_p'), legacyPay({ amountPaise: 0, countedPaise: 0 })));
  await denied(setDoc(doc(a, 'payments', 'lx_z_p'), legacyPay({ paymentType: 'gift' })));
  // Re-importing the same row can't overwrite it (payments are never edited)
  await denied(setDoc(doc(a, 'payments', 'lx_9000000001_2022-09-01_pt_1_2022-09-02_2022-10-02_800000_p'), legacyPay({ amountPaise: 1, countedPaise: 1 })));
  // "Not recorded" is only for imported history — staff can't record a new payment with it
  await denied(setDoc(doc(a, 'payments', 'new1'), { ...legacyPay({ source: 'admin', method: 'unknown' }), receiptNo: 'CR-R-0001', receiptSeq: 1 }));
  // Nobody else writes imported history
  for (const e of ['lx-marketing@crunch.test', 'lx-trainer@crunch.test', 'lx-client@crunch.test']) {
    await denied(setDoc(doc(await as(e), 'payments', 'lx_w_p'), legacyPay()));
  }
});

test('PT packages and membership periods: admins write, trainers see only their own PT, never deleted', async () => {
  const a = await as(ADMIN.email);
  await setDoc(doc(a, 'ptPackages', 'p-new'), pt());
  await denied(setDoc(doc(a, 'ptPackages', 'p-bad'), pt({ sessionsIncluded: 0 })));
  await updateDoc(doc(a, 'ptPackages', 'p-new'), { sessionsRemaining: 10, updatedAt: serverTimestamp() });
  await denied(updateDoc(doc(a, 'ptPackages', 'p-new'), { memberId: 'someone-else' }));
  await denied(deleteDoc(doc(a, 'ptPackages', 'p-new')));
  await setDoc(doc(a, 'memberships', 'ms-new'), { memberId: 'm1', planId: null, planLabel: '1 Month', startDate: '2030-01-01', endDate: '2030-01-31', paymentId: null, source: 'payment', createdBy: 'x', createdAt: serverTimestamp() });
  await denied(deleteDoc(doc(a, 'memberships', 'ms1')));
  // Imported history keeps the sheet's blanks (a day pass has no dates); a new period always has dates
  const dayPass = { memberId: 'm1', planId: null, planLabel: '1 Day', startDate: null, endDate: null, paymentId: null, createdBy: 'x', createdAt: serverTimestamp() };
  await setDoc(doc(a, 'memberships', 'ms-daypass'), { ...dayPass, source: 'legacy_excel' });
  await denied(setDoc(doc(a, 'memberships', 'ms-undated'), { ...dayPass, source: 'payment' }));
  await denied(setDoc(doc(a, 'memberships', 'ms-baddate'), { ...dayPass, source: 'legacy_excel', startDate: 20260901 }));
  const t = await as('lx-trainer@crunch.test');
  expect((await getDoc(doc(t, 'ptPackages', 'mine'))).exists()).toBe(true);
  await denied(getDoc(doc(t, 'ptPackages', 'other')));
  expect((await getDocs(query(collection(t, 'ptPackages'), where('trainerId', '==', 'T1')))).size).toBeGreaterThan(0);
  await denied(getDocs(collection(t, 'ptPackages')));
  await denied(getDoc(doc(t, 'memberships', 'ms1')));
  await denied(setDoc(doc(t, 'ptPackages', 'x'), pt()));
});

test('marketing, clients and the public see none of it', async () => {
  for (const db of [await as('lx-marketing@crunch.test'), await as('lx-client@crunch.test'), await as()]) {
    await denied(getDoc(doc(db, 'ptPackages', 'mine')));
    await denied(getDocs(collection(db, 'ptPackages')));
    await denied(getDoc(doc(db, 'memberships', 'ms1')));
    await denied(getDocs(collection(db, 'imports')));
    await denied(getDocs(collection(db, 'payments')));
    await denied(setDoc(doc(db, 'imports', 'x'), { actorUid: 'x', createdAt: serverTimestamp() }));
  }
});

test('the import history is append-only', async () => {
  const a = await as(ADMIN.email);
  const uid = (await (await import('./emulator')).ensureUser(ADMIN.email));
  await setDoc(doc(a, 'imports', 'i2'), { file: 'x.xlsx', payments: 0, createdBy: ADMIN.email, actorUid: uid, createdAt: serverTimestamp() });
  await denied(setDoc(doc(a, 'imports', 'i3'), { file: 'x.xlsx', actorUid: 'someone-else', createdAt: serverTimestamp() }));
  await denied(updateDoc(doc(a, 'imports', 'i1'), { payments: 99 }));
  await denied(deleteDoc(doc(a, 'imports', 'i1')));
});
