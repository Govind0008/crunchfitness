import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Instagram, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addHighlight, normaliseInstagramUrl, removeHighlight, setHighlightVisible, watchHighlights, type SocialHighlight } from '@/lib/socialHighlights';
import { AdminShell, ConfirmButton, Empty, inputCls } from './shared';
import { useArea } from './area';

/** Paste real Instagram post links; they show on the homepage when the live feed isn't available. */
const SocialHighlights = () => {
  const [items, setItems] = useState<SocialHighlight[]>([]);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const base = useArea();
  useEffect(() => watchHighlights(setItems), []);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const clean = normaliseInstagramUrl(url);
    if (!clean) { setError('Paste the link of an Instagram post or reel, e.g. https://www.instagram.com/p/ABC123/'); return; }
    if (items.some((i) => i.url === clean)) { setError('That post is already in the list.'); return; }
    setError(null);
    await addHighlight(clean);
    setUrl('');
  };

  return (
    <AdminShell title="Instagram highlights" back={base === '/admin' ? { to: '/admin/events', label: 'All events' } : { to: '/marketing', label: 'Creative Desk' }}>
      <p className="-mt-4 mb-8 max-w-2xl text-ink-300">
        The homepage shows your latest Instagram posts automatically when the Instagram connection is working. If it isn’t, it shows the posts you add here instead — using Instagram’s own embed, so they always match the real post.
      </p>
      <form onSubmit={add} className="flex max-w-2xl flex-col gap-3 sm:flex-row">
        <label className="flex-1"><span className="sr-only">Instagram post link</span>
          <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" inputMode="url" /></label>
        <Button type="submit" size="lg"><Instagram /> Add post</Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-10">
        {!items.length ? <Empty title="No highlights yet" body="Add links to posts you want to feature." /> : (
          <ul className="divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08]">
            {items.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 p-4">
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm text-white underline-offset-4 hover:underline">{h.url}</a>
                <span className={h.visible ? 'text-xs font-bold text-brand-400' : 'text-xs text-ink-500'}>{h.visible ? 'On website' : 'Hidden'}</span>
                <Button size="sm" variant="secondary" onClick={() => setHighlightVisible(h.id, !h.visible)}>{h.visible ? <><EyeOff /> Hide</> : <><Eye /> Show</>}</Button>
                <ConfirmButton size="sm" variant="secondary" confirm={{ title: 'Remove this post?', body: 'It will no longer appear on the website.' }} onConfirm={() => removeHighlight(h.id)}><Trash2 /><span className="sr-only">Remove</span></ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
};

export default SocialHighlights;
