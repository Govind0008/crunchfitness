// Firestore's write functions, unchanged except that once a write has been accepted by the server
// the admin's cached pages are marked stale (adminDataChanged). The admin data modules import their
// writes from here instead of 'firebase/firestore', so every save refreshes what staff see — no
// page has to remember which caches a change affects. A failed write refreshes nothing.
import * as fs from 'firebase/firestore';
import { adminDataChanged } from '@/lib/queryClient';

const after = <T,>(p: Promise<T>): Promise<T> => p.then((v) => { adminDataChanged(); return v; });
type AnyFn = (...a: unknown[]) => Promise<unknown>;

export const setDoc = ((...a: unknown[]) => after((fs.setDoc as AnyFn)(...a))) as typeof fs.setDoc;
export const updateDoc = ((...a: unknown[]) => after((fs.updateDoc as AnyFn)(...a))) as typeof fs.updateDoc;
export const addDoc = ((...a: unknown[]) => after((fs.addDoc as AnyFn)(...a))) as typeof fs.addDoc;
export const deleteDoc = ((...a: unknown[]) => after((fs.deleteDoc as AnyFn)(...a))) as typeof fs.deleteDoc;
export const runTransaction = ((...a: unknown[]) => after((fs.runTransaction as AnyFn)(...a))) as typeof fs.runTransaction;
export const writeBatch = ((firestore: fs.Firestore) => {
  const b = fs.writeBatch(firestore);
  const commit = b.commit.bind(b);
  b.commit = () => after(commit());
  return b;
}) as typeof fs.writeBatch;
