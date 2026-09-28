import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, collection, getFirestore, runTransaction, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { ADMIN, PROJECT, ensureUser, resetFirestore, seedAdmin, seedDoc } from './emulator';

// Payments are money: admin-only, sequential receipts, never edited or deleted — only voided.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'rules tests run once');

const apps: FirebaseApp[] = [];
async function as(email?: string): Promise<Firestore> {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'fake-key' }, `p${apps.length}-${Date.now()}`);
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
const pay = (seq: number, extra: Record<string, unknown> = {}) => ({
  receiptNo: `CR-R-${String(seq).padStart(4, '0')}`, receiptSeq: seq, memberId: 'm1', memberName: 'Asha', memberPhone: '9000000001', memberPhoneKey: '9000000001',
  planId: null, planName: '', amountPaise: 650000, countedPaise: 650000, method: 'upi', reference: '', paidOn: '2030-01-01',
  coversFrom: null, coversTo: null, notes: '', status: 'paid', createdBy: 'x', createdAt: serverTimestamp(), ...extra,
});
async function record(db: Firestore, id: string, extra: Record<string, unknown> = {}) {
  return runTransaction(db, async (tx) => {
    const c = await tx.get(doc(db, 'counters', 'receipts'));
    const next = ((c.data()?.next as number) ?? 0) + 1;
    tx.set(doc(db, 'counters', 'receipts'), { next });
    tx.set(doc(db, 'payments', id), pay(next, extra));
  });
}

test.beforeAll(async () => {
  await resetFirestore();
  await seedAdmin();
  await seedDoc(`userRoles/${await ensureUser('trainer-p@crunch.test')}`, { role: 'trainer', trainerId: 'T1' });
});
test.afterAll(async () => { await Promise.all(apps.map((a) => deleteApp(a))); });

test('only admins record payments, each with the next receipt number', async () => {
  const admin = await as(ADMIN.email);
  await record(admin, 'p1');
  await record(admin, 'p2');
  expect((await getDoc(doc(admin, 'counters', 'receipts'))).data()?.next).toBe(2);
  // Reusing a receipt number without moving the counter is refused
  await denied(setDoc(doc(admin, 'payments', 'p3'), pay(2)));
  // The counter can't jump or go back
  await denied(setDoc(doc(admin, 'counters', 'receipts'), { next: 10 }));
  await denied(setDoc(doc(admin, 'counters', 'receipts'), { next: 1 }));
  // Bad amounts / methods are refused
  await denied(record(admin, 'p4', { amountPaise: 0, countedPaise: 0 }));
  await denied(record(admin, 'p5', { method: 'bitcoin' }));
  await denied(record(admin, 'p6', { countedPaise: 1 }));
  for (const db of [await as(), await as('trainer-p@crunch.test')]) {
    await denied(record(db, 'x'));
    await denied(getDocs(collection(db, 'payments')));
  }
});

test('payments are never edited or deleted — only voided with a reason', async () => {
  const admin = await as(ADMIN.email);
  await denied(updateDoc(doc(admin, 'payments', 'p1'), { amountPaise: 1 }));
  await denied(updateDoc(doc(admin, 'payments', 'p1'), { status: 'void', countedPaise: 0 }));                    // no reason
  await denied(updateDoc(doc(admin, 'payments', 'p1'), { status: 'void', countedPaise: 650000, voidReason: 'Duplicate entry' })); // still counted
  await updateDoc(doc(admin, 'payments', 'p1'), { status: 'void', countedPaise: 0, voidReason: 'Duplicate entry', voidedBy: ADMIN.email, voidedAt: serverTimestamp() });
  await denied(updateDoc(doc(admin, 'payments', 'p1'), { status: 'paid', countedPaise: 650000 }));               // can't un-void
  await denied(deleteDoc(doc(admin, 'payments', 'p2')));
});

test('a discount is stored as whole paise and can never be negative', async () => {
  const admin = await as(ADMIN.email);
  await denied(record(admin, 'pd1', { discountPaise: -100 }));
  await denied(record(admin, 'pd2', { discountPaise: 1.5 }));
  await denied(record(admin, 'pd3', { listPricePaise: -1 }));
  await record(admin, 'pd4', { discountPaise: 20000, listPricePaise: 670000, kind: 'renewal' });
});
