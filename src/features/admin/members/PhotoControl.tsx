import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Member } from '@/lib/admin/members';
import { useActor } from '@/features/events/admin/actor';
import Avatar from './Avatar';

/**
 * The member's photo, large, with upload / replace / remove in place. The image goes to private
 * Firebase Storage (admins only); a local preview shows while it uploads.
 */
const PhotoControl = ({ m, onChanged, size = 104 }: { m: Member; onChanged: () => void; size?: number }) => {
  const actor = useActor();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const { uploadMemberPhoto, validatePhoto } = await import('@/lib/admin/photos');
    const bad = validatePhoto(file);
    if (bad) { setError(bad); return; }
    setError(null); setPreview(URL.createObjectURL(file)); setBusy('upload');
    try { await uploadMemberPhoto(m.id, file, actor); onChanged(); }
    catch (e) { setError((e as Error).message); setPreview(null); }
    finally { setBusy(null); }
  };
  const remove = async () => {
    setBusy('remove'); setError(null);
    try { const { removeMemberPhoto } = await import('@/lib/admin/photos'); await removeMemberPhoto(m.id, actor); setPreview(null); onChanged(); }
    catch { setError('The photo couldn’t be removed. Please try again.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={() => input.current?.click()} disabled={!!busy} aria-label={m.photo ? 'Change photo' : 'Upload photo'}
        className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950">
        {preview ? <img src={preview} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} /> : <Avatar m={m} size={size} />}
        <span className={cn('absolute inset-0 flex items-center justify-center rounded-full bg-ink-950/60 text-white transition-opacity motion-reduce:transition-none', busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100')}>
          {busy ? <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" aria-hidden /> : <Camera className="h-6 w-6" aria-hidden />}
        </span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Member photo" tabIndex={-1}
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="flex gap-3 text-xs">
        <button type="button" className="font-semibold text-ink-300 hover:text-white" onClick={() => input.current?.click()} disabled={!!busy}>{busy === 'upload' ? 'Uploading…' : m.photo ? 'Replace' : 'Upload photo'}</button>
        {m.photo && <button type="button" className="text-ink-500 hover:text-red-300" onClick={remove} disabled={!!busy}>{busy === 'remove' ? 'Removing…' : 'Remove'}</button>}
      </div>
      {error && <p role="alert" className="max-w-[14rem] text-center text-xs text-red-300">{error}</p>}
    </div>
  );
};

export default PhotoControl;
