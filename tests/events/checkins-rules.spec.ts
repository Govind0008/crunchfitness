import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, collection, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Manual (classless) check-ins: admins only, one per member per day, stamped by the server.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<{ db: Firestore; uid: string | null }> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `c${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  if (!email) return { db, uid: null };
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const cred = await signInWithEmailAndPassword(auth, email, 'crunch-test-pass');
  return { db, uid: cred.user.uid };
}
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toBe('permission-denied');
};
const DATE = '2030-06-15';
const rec = (by: string, extra: Record<string, unknown> = {}) => ({
  memberId: 'm1', memberName: 'Asha Rao', memberPhoneKey: '9000000001', date: DATE, method: 'manual', by, at: serverTimestamp(), ...extra,
});

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('ci-marketing@crunch.test')}`, { role: 'marketing' });
  await seedDoc(`userRoles/${await ensureUser('ci-trainer@crunch.test')}`, { role: 'trainer', trainerId: 'T1' });
  await seedDoc('members/m1', { name: 'Asha Rao', phone: '9000000001', phoneKey: '9000000001', status: 'active' });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('admins record one manual check-in per member per day, as themselves, at server time', async () => {
  const { db, uid } = await as(ADMIN.email);
  await denied(setDoc(doc(db, 'checkins', `${DATE}_m1`), rec('someone-else')));                     // can't sign as another admin
  await denied(setDoc(doc(db, 'checkins', `${DATE}_m1`), rec(uid!, { at: new Date('2030-06-15T04:00:00Z') })));   // no back-dating
  await denied(setDoc(doc(db, 'checkins', `2030-06-16_m1`), rec(uid!)));                            // id must match the date
  await denied(setDoc(doc(db, 'checkins', `${DATE}_ghost`), rec(uid!, { memberId: 'ghost' })));     // member must exist
  await denied(setDoc(doc(db, 'checkins', `${DATE}_m1`), rec(uid!, { method: 'biometric' })));     // door scans come from the device service
  await denied(setDoc(doc(db, 'checkins', `${DATE}_m1`), rec(uid!, { sessionId: 'class1' })));     // no class fields
  await setDoc(doc(db, 'checkins', `${DATE}_m1`), rec(uid!));
  await denied(setDoc(doc(db, 'checkins', `${DATE}_m1`), rec(uid!)));                               // second time the same day
  await denied(updateDoc(doc(db, 'checkins', `${DATE}_m1`), { memberName: 'Someone' }));            // never edited
  expect((await getDoc(doc(db, 'checkins', `${DATE}_m1`))).data()?.by).toBe(uid);
  await deleteDoc(doc(db, 'checkins', `${DATE}_m1`));                                               // a mistake can be removed
});

test('marketing, trainers and the public can neither read nor write check-ins', async () => {
  const admin = await as(ADMIN.email);
  await setDoc(doc(admin.db, 'checkins', `${DATE}_m1`), rec(admin.uid!));
  for (const email of ['ci-marketing@crunch.test', 'ci-trainer@crunch.test', undefined]) {
    const { db, uid } = await as(email);
    await denied(getDocs(collection(db, 'checkins')));
    await denied(getDoc(doc(db, 'checkins', `${DATE}_m1`)));
    await denied(setDoc(doc(db, 'checkins', `2030-06-17_m1`), rec(uid ?? 'anon', { date: '2030-06-17' })));
    await denied(deleteDoc(doc(db, 'checkins', `${DATE}_m1`)));
  }
});
