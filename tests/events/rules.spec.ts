import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator, doc, getDoc, getDocs, collection, getFirestore, increment, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Security rules, exercised with the real client SDK exactly as the website uses it.
test.describe.configure({ mode: 'serial' });

const apps: FirebaseApp[] = [];
async function client(user?: { email: string; password: string }): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `c${apps.length}-${Date.now()}`);
  apps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  if (user) {
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    await signInWithEmailAndPassword(auth, user.email, user.password);
  }
  return db;
}
const denied = async (p: Promise<unknown>) => {
  const err = await p.then(() => null, (e: { code?: string }) => e);
  expect(err, 'expected the rules to deny this').not.toBeNull();
  expect(err!.code).toBe('permission-denied');
};

const EV = 'ev1';
const baseEvent = {
  title: 'Crunch Test Event', slug: 'crunch-test-event', status: 'registration_open', registrationEnabled: true,
  capacity: 2, registrationCount: 0, checkedInCount: 0, categories: [], eventDate: '2030-01-01',
};

async function registerAs(db: Firestore, name = 'Test Person', passId = `p${Math.random().toString(36).slice(2)}`) {
  return runTransaction(db, async (tx) => {
    const ev = await tx.get(doc(db, 'events', EV));
    const n = (ev.data()!.registrationCount as number) + 1;
    tx.update(doc(db, 'events', EV), { registrationCount: n });
    tx.set(doc(db, 'events', EV, 'registrations', String(n)), {
      name, phone: '+919999999999', email: '', categoryId: 'c1', number: n, status: 'registered', showName: true, passId, createdAt: serverTimestamp(),
    });
    tx.set(doc(db, 'events', EV, 'passes', passId), { registrationId: String(n), number: n, name, categoryId: 'c1', createdAt: serverTimestamp() });
    return { n, passId };
  });
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  const clientUid = await ensureUser('member@crunch.test');
  await seedDoc(`userRoles/${clientUid}`, { role: 'client' });
  await ensureUser('norole@crunch.test');
  await seedDoc(`events/${EV}`, baseEvent);
  await seedDoc('events/draft1', { ...baseEvent, slug: 'secret-draft', status: 'draft' });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('visitors can read public events but never drafts', async () => {
  const anon = await client();
  expect((await getDoc(doc(anon, 'events', EV))).exists()).toBe(true);
  await denied(getDoc(doc(anon, 'events', 'draft1')));
  const snap = await getDocs(query(collection(anon, 'events'), where('status', 'in', ['registration_open', 'live'])));
  expect(snap.docs.map((d) => d.id)).toEqual([EV]);
});

test('a visitor can register only through the counted transaction', async () => {
  const anon = await client();
  const { n, passId } = await registerAs(anon, 'Asha Rao');
  expect(n).toBe(1);
  // The pass is readable by its id, but passes cannot be listed
  expect((await getDoc(doc(anon, 'events', EV, 'passes', passId))).data()?.name).toBe('Asha Rao');
  await denied(getDocs(collection(anon, 'events', EV, 'passes')));
  // Registrations (with phone numbers) are private
  await denied(getDoc(doc(anon, 'events', EV, 'registrations', '1')));
  // Writing a registration without bumping the count is rejected
  await denied(setDoc(doc(anon, 'events', EV, 'registrations', '9'), { name: 'Sneaky', phone: '12345678', email: '', categoryId: 'c1', number: 9, status: 'registered', showName: true, passId: 'x', createdAt: serverTimestamp() }));
  // Bumping the count by more than one is rejected
  await denied(updateDoc(doc(anon, 'events', EV), { registrationCount: increment(5) }));
  // Registering as already checked in is rejected
  await denied(runTransaction(anon, async (tx) => {
    tx.update(doc(anon, 'events', EV), { registrationCount: 2 });
    tx.set(doc(anon, 'events', EV, 'registrations', '2'), { name: 'Cheat', phone: '12345678', email: '', categoryId: 'c1', number: 2, status: 'checked_in', showName: true, passId: 'y', createdAt: serverTimestamp() });
  }));
});

test('capacity is enforced by the rules', async () => {
  const anon = await client();
  await registerAs(anon, 'Second Person');            // 2 of 2
  await denied(registerAs(anon, 'Third Person'));     // full
});

test('visitors, members and role-less accounts cannot run the event', async () => {
  for (const db of [await client(), await client({ email: 'member@crunch.test', password: 'crunch-test-pass' }), await client({ email: 'norole@crunch.test', password: 'crunch-test-pass' })]) {
    await denied(updateDoc(doc(db, 'events', EV), { status: 'live' }));
    await denied(setDoc(doc(db, 'events', EV, 'results', '1'), { categoryId: 'c1', score: 999, public: true }));
    await denied(setDoc(doc(db, 'events', 'new'), { ...baseEvent, status: 'draft' }));
    await denied(getDocs(collection(db, 'events', EV, 'activity')));
    await denied(setDoc(doc(db, 'userRoles', 'someone'), { role: 'admin' }));
  }
});

test('admins follow the lifecycle; results stay private until LIVE / published', async () => {
  const admin = await client(ADMIN);
  const anon = await client();
  // Can't skip from registration straight to results
  await denied(updateDoc(doc(admin, 'events', EV), { status: 'results_published' }));
  // Can't hand-edit the registration count
  await denied(updateDoc(doc(admin, 'events', EV), { registrationCount: 50 }));

  await updateDoc(doc(admin, 'events', EV), { status: 'check_in' });
  await setDoc(doc(admin, 'events', EV, 'results', '1'), { categoryId: 'c1', displayName: 'Asha Rao', number: 1, score: 100, unit: 'kg', position: null, public: true });
  await setDoc(doc(admin, 'events', EV, 'results', '2'), { categoryId: 'c1', displayName: 'Athlete CR-002', number: 2, score: 90, unit: 'kg', position: null, public: false });
  await denied(getDocs(collection(anon, 'events', EV, 'results')));                       // not live yet

  await updateDoc(doc(admin, 'events', EV), { status: 'live' });
  const live = await getDocs(query(collection(anon, 'events', EV, 'results'), where('public', '==', true)));
  expect(live.docs.map((d) => d.id)).toEqual(['1']);                                        // only leaderboard-flagged
  await denied(getDocs(collection(anon, 'events', EV, 'results')));                        // unflagged stay hidden

  await updateDoc(doc(admin, 'events', EV), { status: 'results_pending' });
  await denied(getDocs(query(collection(anon, 'events', EV, 'results'), where('public', '==', true)))); // hidden again
  await updateDoc(doc(admin, 'events', EV), { status: 'results_published' });
  expect((await getDocs(collection(anon, 'events', EV, 'results'))).size).toBe(2);
});

test('the activity log is append-only', async () => {
  const admin = await client(ADMIN);
  const adminUid = (await getDocs(query(collection(admin, 'userRoles'), where('email', '==', ADMIN.email)))).docs[0]?.id;
  const b = writeBatch(admin);
  const ref = doc(collection(admin, 'events', EV, 'activity'));
  b.set(ref, { action: 'Test entry', actorUid: adminUid, actorEmail: ADMIN.email, refId: null, meta: {}, at: serverTimestamp() });
  await b.commit();
  await denied(updateDoc(ref, { action: 'Rewritten' }));
  await denied((async () => { const { deleteDoc } = await import('firebase/firestore'); await deleteDoc(ref); })());
});

test('media is public only once made visible', async () => {
  const admin = await client(ADMIN);
  const anon = await client();
  await setDoc(doc(admin, 'events', EV, 'media', 'm1'), { type: 'photo', url: 'x', storagePath: 'x', caption: '', kind: 'highlight', visible: false, createdAt: serverTimestamp() });
  await setDoc(doc(admin, 'events', EV, 'media', 'm2'), { type: 'photo', url: 'y', storagePath: 'y', caption: '', kind: 'highlight', visible: true, createdAt: serverTimestamp() });
  const pub = await getDocs(query(collection(anon, 'events', EV, 'media'), where('visible', '==', true)));
  expect(pub.docs.map((d) => d.id)).toEqual(['m2']);
  await denied(getDoc(doc(anon, 'events', EV, 'media', 'm1')));
});

test('instagram highlights: public sees visible ones, only admins add real post URLs', async () => {
  const admin = await client(ADMIN);
  const anon = await client();
  await setDoc(doc(admin, 'socialHighlights', 'h1'), { url: 'https://www.instagram.com/p/ABC123/', visible: true, createdAt: serverTimestamp() });
  await setDoc(doc(admin, 'socialHighlights', 'h2'), { url: 'https://www.instagram.com/p/HIDDEN1/', visible: false, createdAt: serverTimestamp() });
  const pub = await getDocs(query(collection(anon, 'socialHighlights'), where('visible', '==', true)));
  expect(pub.docs.map((d) => d.id)).toEqual(['h1']);
  await denied(setDoc(doc(anon, 'socialHighlights', 'x'), { url: 'https://www.instagram.com/p/SPAM/', visible: true }));
  await denied(setDoc(doc(admin, 'socialHighlights', 'bad'), { url: 'https://evil.example.com/p/x/', visible: true }));
});

test('event records can only be removed together with the event', async () => {
  const admin = await client(ADMIN);
  const member = await client({ email: 'member@crunch.test', password: 'crunch-test-pass' });
  const { deleteDoc } = await import('firebase/firestore');
  // While the event exists, its registrations and activity can't be picked off one by one
  await denied(deleteDoc(doc(admin, 'events', EV, 'registrations', '1')));
  await denied(deleteDoc(doc(member, 'events', EV)));
  // Deleting the event and its records in one batch is allowed for admins
  const regs = await getDocs(collection(admin, 'events', EV, 'registrations'));
  const acts = await getDocs(collection(admin, 'events', EV, 'activity'));
  const b = writeBatch(admin);
  b.delete(doc(admin, 'events', EV));
  [...regs.docs, ...acts.docs].forEach((d) => b.delete(d.ref));
  await b.commit();
  expect((await getDoc(doc(admin, 'events', EV))).exists()).toBe(false);
  expect((await getDocs(collection(admin, 'events', EV, 'registrations'))).size).toBe(0);
});
