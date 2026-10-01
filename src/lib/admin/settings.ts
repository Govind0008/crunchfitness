import { doc, getDoc } from 'firebase/firestore';
import { setDoc } from '@/lib/admin/writes';
import { db } from '@/lib/firebase';

export interface AdminSettings { expiringSoonDays: number }
export const DEFAULT_SETTINGS: AdminSettings = { expiringSoonDays: 14 };

// Read once per session: nearly every page needs this before its first query, and it only
// changes from the Settings page (which updates the cache as it saves).
// The last value is also kept on this device (it's a single number, nothing personal), so the
// dashboard doesn't wait for it on the next sign-in; the server copy refreshes it right after.
const KEY = 'crunch.admin.settings';
const remembered = (): AdminSettings | null => { try { const v = localStorage.getItem(KEY); return v ? { ...DEFAULT_SETTINGS, ...JSON.parse(v) } : null; } catch { return null; } };
const remember = (s: AdminSettings) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* convenience only */ } };
let cached: Promise<AdminSettings> | null = null;
const fetchSettings = () => getDoc(doc(db, 'settings', 'admin'))
  .then((snap) => { const s = { ...DEFAULT_SETTINGS, ...(snap.exists() ? (snap.data() as Partial<AdminSettings>) : {}) }; remember(s); return s; });
export function getSettings(): Promise<AdminSettings> {
  if (!cached) {
    const local = remembered();
    const fresh = fetchSettings().catch(() => { cached = null; return local ?? { ...DEFAULT_SETTINGS }; });
    cached = local ? Promise.resolve(local) : fresh;
    if (local) fresh.then((s) => { cached = Promise.resolve(s); });
  }
  return cached;
}
export const saveSettings = async (s: AdminSettings) => {
  await setDoc(doc(db, 'settings', 'admin'), s, { merge: true });
  const next = { ...DEFAULT_SETTINGS, ...s };
  remember(next);
  cached = Promise.resolve(next);
};
