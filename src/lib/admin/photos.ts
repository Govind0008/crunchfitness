// Member photos — private. The image lives in Firestore at memberPhotos/{memberId} (admins only,
// see firestore.rules) as a small JPEG; the member document holds only its metadata, so lists stay
// light and a photo is read only where it's shown. Photos are shrunk in the browser first (max
// 400px JPEG, typically 20–35 KB), which also drops camera metadata such as GPS location.
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { writeBatch } from '@/lib/admin/writes';
import { db } from '@/lib/firebase';
import { logTo, type AdminActor } from './activity';

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
/** Largest stored photo (a 400px JPEG is usually 20–35 KB) — far inside Firestore's 1 MiB document limit */
export const PHOTO_STORED_MAX = 150_000;
const PHOTO_SIDE = 400;
export const photoPath = (memberId: string) => `memberPhotos/${memberId}`;

export function validatePhoto(file: File): string | null {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return 'Choose a JPG, PNG or WebP photo.';
  if (file.size > PHOTO_MAX_BYTES) return 'That photo is larger than 8 MB.';
  return null;
}

/** Re-encode to a small JPEG (max 400px), lowering the quality until it fits PHOTO_STORED_MAX. */
async function shrink(file: Blob): Promise<Blob> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('That photo couldn’t be read. Try a JPG or PNG.'); }
  const scale = Math.min(1, PHOTO_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  for (const q of [0.75, 0.6, 0.45]) {
    const b = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (b && b.size <= PHOTO_STORED_MAX) return b;
  }
  throw new Error('That photo is too detailed to store. Try another one.');
}

const toBase64 = (b: Blob) => b.arrayBuffer().then((buf) => {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
});

export async function uploadMemberPhoto(memberId: string, file: File, actor: AdminActor) {
  const err = validatePhoto(file);
  if (err) throw new Error(err);
  const blob = await shrink(file);
  const path = photoPath(memberId);
  try {
    await setDoc(doc(db, path), { data: await toBase64(blob), contentType: 'image/jpeg', size: blob.size, updatedAt: serverTimestamp(), updatedBy: actor.email });
  } catch { throw new Error('The photo couldn’t be saved. Please try again.'); }
  const b = writeBatch(db);
  b.update(doc(db, 'members', memberId), { photo: { path, contentType: 'image/jpeg', size: blob.size, updatedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
  logTo(b, actor, 'Member photo updated', 'member', memberId);
  await b.commit();
  forget(memberId);
}

export async function removeMemberPhoto(memberId: string, actor: AdminActor) {
  await deleteDoc(doc(db, photoPath(memberId))).catch(() => {});
  const b = writeBatch(db);
  b.update(doc(db, 'members', memberId), { photo: deleteField(), updatedAt: serverTimestamp() });
  logTo(b, actor, 'Member photo removed', 'member', memberId);
  await b.commit();
  forget(memberId);
}

const urls = new Map<string, Promise<string | null>>();
const forget = (memberId: string) => [...urls.keys()].filter((k) => k.startsWith(`${memberId}:`)).forEach((k) => urls.delete(k));
/** The photo as a data URL for an admin session; one read per photo per page load. */
export function memberPhotoUrl(memberId: string, photo: { path: string; updatedAt?: { seconds: number } } | null | undefined) {
  if (!photo || photo.path !== photoPath(memberId)) return Promise.resolve(null);
  const key = `${memberId}:${photo.updatedAt?.seconds ?? ''}`;
  if (!urls.has(key)) {
    urls.set(key, getDoc(doc(db, photo.path)).then((d) => {
      const data = d.get('data');
      return typeof data === 'string' && data ? `data:${d.get('contentType') ?? 'image/jpeg'};base64,${data}` : null;
    }).catch(() => null));
  }
  return urls.get(key)!;
}
