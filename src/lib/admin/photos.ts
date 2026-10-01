// Member photos — private. The image lives in Firebase Storage at members/{memberId}/photo
// (readable by admins only, see storage.rules); the member document holds only its metadata.
// Photos are shrunk in the browser first (max 640px JPEG), which also drops camera metadata
// such as GPS location.
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { deleteField, doc, serverTimestamp } from 'firebase/firestore';
import { writeBatch } from '@/lib/admin/writes';
import { db } from '@/lib/firebase';
import { storage } from '@/lib/firebase-storage';
import { logTo, type AdminActor } from './activity';

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const photoPath = (memberId: string) => `members/${memberId}/photo`;

export function validatePhoto(file: File): string | null {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return 'Choose a JPG, PNG or WebP photo.';
  if (file.size > PHOTO_MAX_BYTES) return 'That photo is larger than 8 MB.';
  return null;
}

/** Re-encode to a small JPEG (max 640px). Falls back to the original if the browser can't decode it. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.85));
  } catch { return file; }
}

export async function uploadMemberPhoto(memberId: string, file: File, actor: AdminActor) {
  const err = validatePhoto(file);
  if (err) throw new Error(err);
  const blob = await shrink(file);
  const contentType = blob.type || file.type;
  const path = photoPath(memberId);
  try {
    await uploadBytes(ref(storage, path), blob, { contentType });
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    throw new Error(/bucket|not-found|project|unknown/i.test(code) ? 'Photo storage isn’t set up in Firebase yet (Storage). The member was saved without a photo.' : 'The photo couldn’t be uploaded. Please try again.');
  }
  const b = writeBatch(db);
  b.update(doc(db, 'members', memberId), { photo: { path, contentType, size: blob.size, updatedAt: serverTimestamp() }, updatedAt: serverTimestamp() });
  logTo(b, actor, 'Member photo updated', 'member', memberId);
  await b.commit();
  forget(memberId);
}

export async function removeMemberPhoto(memberId: string, actor: AdminActor) {
  await deleteObject(ref(storage, photoPath(memberId))).catch(() => {});
  const b = writeBatch(db);
  b.update(doc(db, 'members', memberId), { photo: deleteField(), updatedAt: serverTimestamp() });
  logTo(b, actor, 'Member photo removed', 'member', memberId);
  await b.commit();
  forget(memberId);
}

const urls = new Map<string, Promise<string | null>>();
const forget = (memberId: string) => [...urls.keys()].filter((k) => k.startsWith(`${memberId}:`)).forEach((k) => urls.delete(k));
/** Signed download URL for an admin session; cached per page load. */
export function memberPhotoUrl(memberId: string, photo: { path: string; updatedAt?: { seconds: number } } | null | undefined) {
  if (!photo) return Promise.resolve(null);
  const key = `${memberId}:${photo.updatedAt?.seconds ?? ''}`;
  if (!urls.has(key)) urls.set(key, getDownloadURL(ref(storage, photo.path)).catch(() => null));
  return urls.get(key)!;
}
