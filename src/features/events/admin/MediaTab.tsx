import { useEffect, useState } from 'react';
import { Eye, EyeOff, ImagePlus, Star, Trash2, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deleteMedia, setCover, updateMedia, uploadMedia, watchMedia, type CrunchEvent, type Media } from '@/lib/events';
import { ConfirmButton, Empty } from './shared';
import { useActor } from './actor';

/** Upload, preview, show/hide, set cover, delete — nothing more. */
const MediaTab = ({ ev }: { ev: CrunchEvent }) => {
  const actor = useActor();
  const [media, setMedia] = useState<Media[]>([]);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => watchMedia(ev.id, setMedia), [ev.id]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      if (!/^(image|video)\//.test(file.type)) { setError(`${file.name} isn’t a photo or video.`); continue; }
      if (file.size > 25 * 1024 * 1024) { setError(`${file.name} is larger than 25 MB.`); continue; }
      setUploads((u) => [...u, { name: file.name, pct: 0 }]);
      try {
        await uploadMedia(ev, file, 'highlight', actor, (pct) => setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, pct } : x))));
      } catch (e) {
        setError(`Couldn’t upload ${file.name}: ${(e as Error).message}`);
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  };

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 p-8 text-center hover:border-white/40 focus-within:border-brand-400">
        <ImagePlus className="h-8 w-8 text-brand-fg" aria-hidden />
        <span className="font-semibold text-white">Upload photos or videos</span>
        <span className="text-sm text-ink-400">New uploads are hidden until you choose “Show on website”.</span>
        <input type="file" accept="image/*,video/*" multiple className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} aria-label="Upload photos or videos" />
      </label>
      {uploads.map((u) => (
        <div key={u.name} className="mt-3 rounded-xl bg-ink-900 p-3 text-sm text-ink-300" role="status">
          Uploading {u.name}… {u.pct}%
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-400 transition-[width]" style={{ width: `${u.pct}%` }} /></div>
        </div>
      ))}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      {!media.length && !uploads.length ? (
        <div className="mt-8"><Empty title="No photos yet" body="Upload photos and videos from the event. Only the ones you show will appear on the website." /></div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((m) => {
            const isCover = ev.coverImage === m.url;
            return (
              <li key={m.id} className={cn('overflow-hidden rounded-2xl border bg-ink-900', m.visible ? 'border-brand-400/40' : 'border-white/[0.08]')}>
                <div className="relative aspect-[4/3] bg-ink-800">
                  {m.type === 'video'
                    ? <video src={m.url} className="h-full w-full object-cover" muted playsInline controls preload="metadata" />
                    : <img src={m.url} alt={m.caption || 'Event photo'} className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', m.visible ? 'bg-brand-400 text-on-brand' : 'bg-ink-950/80 text-ink-300')}>{m.visible ? 'On website' : 'Hidden'}</span>
                    {isCover && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink-950">Cover</span>}
                    {m.kind === 'winner' && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-bold text-on-brand">Winner</span>}
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <input className="h-10 w-full rounded-lg border border-white/10 bg-ink-950 px-3 text-sm text-white placeholder:text-ink-500" placeholder="Caption (optional)" defaultValue={m.caption}
                    onBlur={(e) => e.target.value !== m.caption && updateMedia(ev, m, { caption: e.target.value }, actor, 'Caption updated')} aria-label="Caption" />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={m.visible ? 'secondary' : 'default'} onClick={() => updateMedia(ev, m, { visible: !m.visible }, actor, m.visible ? 'Media hidden' : 'Media published')}>
                      {m.visible ? <><EyeOff /> Hide</> : <><Eye /> Show on website</>}
                    </Button>
                    {m.type === 'photo' && !isCover && <Button size="sm" variant="secondary" onClick={() => setCover(ev, m, actor)}><Star /> Set as cover</Button>}
                    {m.type === 'photo' && (
                      <Button size="sm" variant="secondary" aria-pressed={m.kind === 'winner'} onClick={() => updateMedia(ev, m, { kind: m.kind === 'winner' ? 'highlight' : 'winner' }, actor, m.kind === 'winner' ? 'Unmarked winner photo' : 'Marked as winner photo')}>
                        <Trophy /> {m.kind === 'winner' ? 'Winner photo' : 'Winner?'}
                      </Button>
                    )}
                    <ConfirmButton size="sm" variant="secondary" confirm={{ title: 'Remove this file?', body: 'It will be removed from this event and the website. The original stays in your Cloudinary media library.' }} onConfirm={() => deleteMedia(ev, m, actor)}>
                      <Trash2 /> <span className="sr-only">Delete</span>
                    </ConfirmButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MediaTab;
