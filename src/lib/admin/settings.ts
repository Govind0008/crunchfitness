import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AdminSettings { expiringSoonDays: number }
export const DEFAULT_SETTINGS: AdminSettings = { expiringSoonDays: 14 };

export async function getSettings(): Promise<AdminSettings> {
  const snap = await getDoc(doc(db, 'settings', 'admin')).catch(() => null);
  return { ...DEFAULT_SETTINGS, ...(snap?.exists() ? (snap.data() as Partial<AdminSettings>) : {}) };
}
export const saveSettings = (s: AdminSettings) => setDoc(doc(db, 'settings', 'admin'), s, { merge: true });
