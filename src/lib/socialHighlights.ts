// Staff-picked Instagram posts — the fallback when the live Instagram feed isn't available.
// Only real post URLs are stored; the site renders them with Instagram's official embed.
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, where, getDocs } from 'firebase/firestore';
import { addDoc, deleteDoc, updateDoc } from '@/lib/admin/writes';
import { db } from '@/lib/firebase';

export interface SocialHighlight { id: string; url: string; visible: boolean }

const col = () => collection(db, 'socialHighlights');
export const INSTAGRAM_POST = /^https:\/\/www\.instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/;

/** Normalise a pasted link (strips ?igsh=… tracking, adds the trailing slash). */
export function normaliseInstagramUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (!/^(www\.)?instagram\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)/);
    return m ? `https://www.instagram.com/${m[1]}/${m[2]}/` : null;
  } catch { return null; }
}

export const getPublicHighlights = async (): Promise<SocialHighlight[]> =>
  (await getDocs(query(col(), where('visible', '==', true)))).docs.map((d) => ({ id: d.id, ...d.data() }) as SocialHighlight);

export const watchHighlights = (cb: (h: SocialHighlight[]) => void) =>
  onSnapshot(query(col(), orderBy('createdAt', 'desc')), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }) as SocialHighlight)));
export const addHighlight = (url: string) => addDoc(col(), { url, visible: true, createdAt: serverTimestamp() });
export const setHighlightVisible = (id: string, visible: boolean) => updateDoc(doc(db, 'socialHighlights', id), { visible });
export const removeHighlight = (id: string) => deleteDoc(doc(db, 'socialHighlights', id));
