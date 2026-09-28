import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc, updateDoc, where, type Firestore,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';

// The merged production rules, exercised the way the admin, trainer and client portals use them.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const PW = 'crunch-test-pass';
const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `s${apps.length}-${Date.now()}`);
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

let clientUid = '', trainerUid = '', roleless = '';
test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  trainerUid = await ensureUser('trainer1@crunch.test');
  await seedDoc(`userRoles/${trainerUid}`, { role: 'trainer', trainerId: 'T1', name: 'Trainer One' });
  await seedDoc(`userRoles/${await ensureUser('trainer2@crunch.test')}`, { role: 'trainer', trainerId: 'T2', name: 'Trainer Two' });
  clientUid = await ensureUser('client1@crunch.test');
  await seedDoc(`userRoles/${clientUid}`, { role: 'client', trainerId: 'T1', clientId: 'C1', name: 'Client One' });
  roleless = await ensureUser('roleless@crunch.test');
  await seedDoc('plans/p1', { duration: '1 Month', price: '₹3,000', order: 1 });
  await seedDoc('enquiries/e1', { name: 'Someone', phone: '9999999999' });
  await seedDoc('trainerData/T1/clients/C1', { name: 'Client One' });
  await seedDoc('trainerData/T2/clients/C9', { name: 'Other trainer client' });
  await seedDoc('duties/d1', { trainerId: 'T1', weekStart: '2030-01-01' });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('visitors: public content readable; can submit enquiries and self check-in; cannot read enquiries', async () => {
  const db = await as();
  expect((await getDoc(doc(db, 'plans', 'p1'))).exists()).toBe(true);
  await getDocs(collection(db, 'teamMembers'));
  await getDocs(collection(db, 'classSessions'));
  await addDoc(collection(db, 'enquiries'), { name: 'New lead', phone: '9000000000' });
  await addDoc(collection(db, 'attendance'), { sessionId: 's1', name: 'Walk-in' });
  await denied(getDocs(collection(db, 'enquiries')));
  await denied(updateDoc(doc(db, 'plans', 'p1'), { price: '₹1' }));
});

test('nobody can give themselves a role', async () => {
  for (const email of ['client1@crunch.test', 'trainer1@crunch.test', 'roleless@crunch.test']) {
    const db = await as(email);
    const uid = email === 'client1@crunch.test' ? clientUid : email === 'trainer1@crunch.test' ? trainerUid : roleless;
    await denied(setDoc(doc(db, 'userRoles', uid), { role: 'admin' }));
    await denied(setDoc(doc(db, 'userRoles', 'someone-else'), { role: 'admin' }));
  }
});

test('members, trainers and role-less accounts cannot edit site content or read enquiries', async () => {
  for (const email of ['client1@crunch.test', 'trainer1@crunch.test', 'roleless@crunch.test']) {
    const db = await as(email);
    await denied(updateDoc(doc(db, 'plans', 'p1'), { price: '₹1' }));
    await denied(setDoc(doc(db, 'teamMembers', 'x'), { name: 'x' }));
    await denied(getDocs(collection(db, 'enquiries')));
    await denied(setDoc(doc(db, 'duties', 'd2'), { trainerId: 'T1' }));
  }
});

test('trainer portal: own data, own client logins only', async () => {
  const db = await as('trainer1@crunch.test');
  expect((await getDoc(doc(db, 'trainerData', 'T1', 'clients', 'C1'))).exists()).toBe(true);
  await updateDoc(doc(db, 'trainerData', 'T1', 'clients', 'C1'), { note: 'ok' });
  await denied(getDoc(doc(db, 'trainerData', 'T2', 'clients', 'C9')));
  await getDocs(query(collection(db, 'duties'), where('trainerId', '==', 'T1')));
  // Create a client login (TrainerDashboard), list them, remove it
  await setDoc(doc(db, 'userRoles', 'newClientUid'), { role: 'client', clientId: 'C2', trainerId: 'T1', trainerName: 'Trainer One', name: 'C2', goal: 'x', email: 'c2@x' });
  await denied(setDoc(doc(db, 'userRoles', 'badClient'), { role: 'client', trainerId: 'T2' }));
  await denied(setDoc(doc(db, 'userRoles', 'badTrainer'), { role: 'trainer', trainerId: 'T1' }));
  const mine = await getDocs(query(collection(db, 'userRoles'), where('trainerId', '==', 'T1'), where('role', '==', 'client')));
  expect(mine.size).toBe(2);
  await deleteDoc(doc(db, 'userRoles', 'newClientUid'));
  await addDoc(collection(db, 'conversations', 'T1_C1', 'messages'), { text: 'hi' });
  await denied(addDoc(collection(db, 'conversations', 'T2_C9', 'messages'), { text: 'hi' }));
});

test('client portal: read trainer data, request sessions, own progress and chat only', async () => {
  const db = await as('client1@crunch.test');
  expect((await getDoc(doc(db, 'userRoles', clientUid))).data()?.role).toBe('client');
  expect((await getDoc(doc(db, 'trainerData', 'T1', 'clients', 'C1'))).exists()).toBe(true);
  await addDoc(collection(db, 'trainerData', 'T1', 'sessionRequests'), { clientId: 'C1' });
  await denied(updateDoc(doc(db, 'trainerData', 'T1', 'clients', 'C1'), { name: 'hacked' }));
  await denied(getDoc(doc(db, 'trainerData', 'T2', 'clients', 'C9')));
  await addDoc(collection(db, 'trainerData', 'T1', 'clients', 'C1', 'progressLogs'), { weight: 70 });
  await denied(addDoc(collection(db, 'trainerData', 'T1', 'clients', 'C3', 'progressLogs'), { weight: 70 }));
  await addDoc(collection(db, 'conversations', 'T1_C1', 'messages'), { text: 'hello coach' });
  await denied(addDoc(collection(db, 'conversations', 'T1_C3', 'messages'), { text: 'x' }));
  await denied(getDocs(collection(db, 'userRoles')));
});

test('admin dashboard: manages content, enquiries and trainer accounts', async () => {
  const db = await as(ADMIN.email);
  await updateDoc(doc(db, 'plans', 'p1'), { price: '₹3,000' });
  await setDoc(doc(db, 'teamMembers', 'm1'), { name: 'Coach' });
  expect((await getDocs(collection(db, 'enquiries'))).size).toBeGreaterThan(0);
  await setDoc(doc(db, 'duties', 'd2'), { trainerId: 'T1' });
  await setDoc(doc(db, 'userRoles', 'newTrainerUid'), { role: 'trainer', trainerId: 'T3', name: 'T3', email: 't3@x' });
  expect((await getDocs(collection(db, 'userRoles'))).size).toBeGreaterThan(3);
  await deleteDoc(doc(db, 'userRoles', 'newTrainerUid'));
});
