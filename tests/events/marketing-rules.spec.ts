import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  addDoc, collection, collectionGroup, connectFirestoreEmulator, deleteDoc, doc, getCountFromServer, getDoc, getDocs, getFirestore,
  query, serverTimestamp, setDoc, updateDoc, where, type Firestore,
} from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc, ts } from './emulator';

// The marketing role, enforced by the Firestore rules — not by hiding sidebar items.
// Every check below talks to Firestore directly, the way a curious user with dev tools would.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const MARKETING = 'marketing-r@crunch.test';
const CLIENT = 'client-r@crunch.test';
const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `m${apps.length}-${Date.now()}`);
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
const act = (uid: string) => ({ action: 'x', actorUid: uid, actorEmail: 'x', refId: null, meta: {}, at: serverTimestamp() });

let adminUid = '', marketingUid = '', clientUid = '';
const EVENT = {
  title: 'Strength Night', slug: 'strength-night', shortDescription: 'Lift', description: '', coverImage: '', location: 'Main floor',
  eventDate: '2030-06-01', startTime: '18:00', endTime: '20:00', registrationOpenAt: '', registrationCloseAt: '', capacity: 50,
  registrationEnabled: true, categories: [], eligibility: '', rules: '', currentCategoryId: null, paused: false,
  registrationCount: 1, checkedInCount: 0, createdBy: 'x',
};

test.beforeAll(async () => {
  await resetFirestore();
  adminUid = await seedAdmin();
  marketingUid = await ensureUser(MARKETING);
  clientUid = await ensureUser(CLIENT);
  await seedDoc(`userRoles/${marketingUid}`, { role: 'marketing', email: MARKETING });
  await seedDoc(`userRoles/${clientUid}`, { role: 'client', trainerId: 'T1', clientId: 'c1' });
  await seedDoc('members/m1', { name: 'Asha Rao', phone: '9000000001', phoneKey: '9000000001', status: 'active', activeUntil: '2030-01-01' });
  await seedDoc('payments/p1', { receiptNo: 'CR-R-0001', amountPaise: 100000, countedPaise: 100000, paidOn: '2030-01-01', status: 'paid', memberId: 'm1' });
  await seedDoc('counters/receipts', { next: 1 });
  await seedDoc('enquiries/e1', { name: 'Lead', phone: '9000000002', read: false, status: 'new' });
  await seedDoc('attendance/s1_9000000001', { sessionId: 's1', memberName: 'Asha', memberPhone: '9000000001', memberPhoneKey: '9000000001', checkedInAt: ts('2030-01-01T10:00:00Z') });
  await seedDoc('activity/a1', { action: 'x', actorUid: adminUid, at: ts('2030-01-01T10:00:00Z') });
  await seedDoc('settings/admin', { expiringSoonDays: 14 });
  await seedDoc('duties/d1', { trainerId: 'T1', weekStart: '2030-01-06' });
  await seedDoc('plans/p3', { duration: '3 Months', price: '₹6,500', order: 1 });
  await seedDoc('teamMembers/test', { name: 'test', role: 'Coach', order: 1, visible: true });
  await seedDoc('posts/live', { title: 'Live post', published: true });
  await seedDoc('posts/draft', { title: 'Draft post', published: false });
  await seedDoc('events/open', { ...EVENT, status: 'registration_open' });
  await seedDoc('events/open/registrations/1', { name: 'Runner', phone: '9000000003', phoneKey: '9000000003', status: 'registered', number: 1 });
  await seedDoc('events/draft', { ...EVENT, slug: 'draft-night', status: 'draft', registrationCount: 0 });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('marketing edits public content: blog, offers, team profiles, Instagram highlights', async () => {
  const m = await as(MARKETING);
  await setDoc(doc(m, 'posts', 'new'), { title: 'Fresh', published: false });
  await updateDoc(doc(m, 'posts', 'live'), { title: 'Live post (edited)' });
  expect((await getDoc(doc(m, 'posts', 'draft'))).exists()).toBe(true);
  await deleteDoc(doc(m, 'posts', 'new'));
  await setDoc(doc(m, 'offers', 'o1'), { title: 'Monsoon offer', active: true, startDate: '2030-01-01', endDate: '2030-02-01' });
  await setDoc(doc(m, 'teamMembers', 'new-coach'), { name: 'New Coach', order: 9, visible: false });
  await updateDoc(doc(m, 'teamMembers', 'new-coach'), { bio: 'Strength coach' });
  await addDoc(collection(m, 'socialHighlights'), { url: 'https://www.instagram.com/p/ABC123/', visible: true, createdAt: serverTimestamp() });
  await addDoc(collection(m, 'activity'), act(marketingUid));
  // …but not plan prices, and not removing a trainer (that also removes logins and classes)
  await denied(updateDoc(doc(m, 'plans', 'p3'), { price: '₹1' }));
  await denied(setDoc(doc(m, 'plans', 'p9'), { duration: 'x', price: '₹1' }));
  await denied(deleteDoc(doc(m, 'teamMembers', 'test')));
  expect((await getDoc(doc(m, 'teamMembers', 'test'))).data()?.name).toBe('test');
});

test('marketing cannot read members, phones, payments, check-ins or the admin log', async () => {
  const m = await as(MARKETING);
  await denied(getDoc(doc(m, 'members', 'm1')));
  await denied(getDocs(collection(m, 'members')));
  await denied(getDoc(doc(m, 'payments', 'p1')));
  await denied(getDocs(query(collection(m, 'payments'), where('paidOn', '>=', '2000-01-01'))));
  await denied(getCountFromServer(collection(m, 'payments')));
  await denied(getDoc(doc(m, 'counters', 'receipts')));
  await denied(getDocs(collection(m, 'enquiries')));
  await denied(getDocs(collection(m, 'attendance')));
  await denied(getDocs(collection(m, 'activity')));
  await denied(getDoc(doc(m, 'settings', 'admin')));
  await denied(getDocs(collection(m, 'duties')));
  await denied(getDocs(collection(m, 'userRoles')));
  await denied(getDocs(collection(m, 'events', 'open', 'registrations')));
  await denied(getDocs(query(collectionGroup(m, 'registrations'), where('phoneKey', '==', '9000000003'))));
  await denied(getDocs(collection(m, 'events', 'open', 'passes')));
  await denied(getDocs(collection(m, 'events', 'open', 'activity')));
  // …and cannot write money or members either
  await denied(setDoc(doc(m, 'members', 'm2'), { name: 'Fake', phoneKey: '9000000009', status: 'active', activeUntil: '2030-01-01' }));
  await denied(updateDoc(doc(m, 'payments', 'p1'), { status: 'void', countedPaise: 0, voidReason: 'nope' }));
  await denied(setDoc(doc(m, 'events', 'open', 'results', '1'), { score: 1 }));
});

test('marketing manages event content and media, never the operational fields', async () => {
  const m = await as(MARKETING);
  expect((await getDoc(doc(m, 'events', 'draft'))).exists()).toBe(true);           // drafts are visible to the team
  await updateDoc(doc(m, 'events', 'open'), { description: 'Bring chalk.', coverImage: 'https://res.cloudinary.com/x.jpg', updatedAt: serverTimestamp() });
  await addDoc(collection(m, 'events', 'open', 'activity'), act(marketingUid));
  await addDoc(collection(m, 'events', 'open', 'media'), { type: 'photo', url: 'https://res.cloudinary.com/y.jpg', storagePath: 'y', caption: '', kind: 'highlight', visible: false, createdAt: serverTimestamp() });
  await denied(updateDoc(doc(m, 'events', 'open'), { status: 'registration_closed' }));
  await denied(updateDoc(doc(m, 'events', 'open'), { capacity: 500 }));
  await denied(updateDoc(doc(m, 'events', 'open'), { eventDate: '2031-01-01' }));
  await denied(deleteDoc(doc(m, 'events', 'open')));
  // Drafts: any detail, but it stays a draft — only an admin opens registration
  await updateDoc(doc(m, 'events', 'draft'), { capacity: 80, eventDate: '2030-07-01' });
  await denied(updateDoc(doc(m, 'events', 'draft'), { status: 'registration_open' }));
  await setDoc(doc(m, 'events', 'mk-new'), { ...EVENT, slug: 'mk-new', status: 'draft', registrationCount: 0 });
  await denied(setDoc(doc(m, 'events', 'mk-open'), { ...EVENT, slug: 'mk-open', status: 'registration_open', registrationCount: 0 }));
});

test('nobody promotes themselves; admins can’t lock themselves out', async () => {
  const m = await as(MARKETING);
  await denied(updateDoc(doc(m, 'userRoles', marketingUid), { role: 'admin' }));
  await denied(setDoc(doc(m, 'userRoles', 'someone-else'), { role: 'marketing' }));
  await denied(deleteDoc(doc(m, 'userRoles', marketingUid)));
  const c = await as(CLIENT);
  await denied(updateDoc(doc(c, 'userRoles', clientUid), { role: 'marketing' }));
  await denied(setDoc(doc(c, 'userRoles', 'x2'), { role: 'admin' }));
  const a = await as(ADMIN.email);
  await denied(updateDoc(doc(a, 'userRoles', adminUid), { role: 'client' }));      // no accidental self-demotion
  await denied(deleteDoc(doc(a, 'userRoles', adminUid)));
  await updateDoc(doc(a, 'userRoles', adminUid), { name: 'Owner' });                // other edits to your own doc are fine
  await setDoc(doc(a, 'userRoles', 'new-marketer'), { role: 'marketing', email: 'n@crunch.test' });
  await deleteDoc(doc(a, 'userRoles', 'new-marketer'));
  expect((await getDoc(doc(m, 'userRoles', marketingUid))).data()?.role).toBe('marketing');
});

test('the public sees published content only', async () => {
  const anon = await as();
  expect((await getDoc(doc(anon, 'posts', 'live'))).exists()).toBe(true);
  await denied(getDoc(doc(anon, 'posts', 'draft')));
  await denied(getDocs(collection(anon, 'posts')));                                 // listing everything would include drafts
  expect((await getDocs(query(collection(anon, 'posts'), where('published', '==', true)))).size).toBeGreaterThan(0);
  await denied(getDoc(doc(anon, 'events', 'draft')));
  await denied(getDoc(doc(anon, 'members', 'm1')));
  await denied(getDoc(doc(anon, 'payments', 'p1')));
  await denied(setDoc(doc(anon, 'posts', 'spam'), { title: 'spam', published: true }));
  const c = await as(CLIENT);
  await denied(setDoc(doc(c, 'posts', 'spam'), { title: 'spam', published: true }));
  await denied(getDocs(collection(c, 'members')));
});

test('admins keep full access, including a member’s registrations across events', async () => {
  const a = await as(ADMIN.email);
  const regs = await getDocs(query(collectionGroup(a, 'registrations'), where('phoneKey', '==', '9000000003')));
  expect(regs.docs.map((d) => d.ref.parent.parent?.id)).toEqual(['open']);
  expect((await getDoc(doc(a, 'members', 'm1'))).exists()).toBe(true);
  expect((await getDoc(doc(a, 'settings', 'admin'))).exists()).toBe(true);
  await deleteDoc(doc(a, 'teamMembers', 'new-coach'));
});
