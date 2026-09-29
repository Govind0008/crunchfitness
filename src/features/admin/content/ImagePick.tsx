import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Pick an image with a live preview; the caller uploads it when the form is saved. */
const ImagePick = ({ current, onPick, label, shape = 'wide' }: { current: string; onPick: (f: File | null) => void; label: string; shape?: 'wide' | 'portrait' }) => {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const src = preview ?? current;
  return (
    <div>
      <p className="text-sm font-semibold text-white">{label}</p>
      <button type="button" onClick={() => input.current?.click()} aria-label={src ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        className={cn('mt-2 flex w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-ink-900 text-ink-400 transition-colors hover:border-white/40 focus-visible:border-brand-400 focus-visible:outline-none', shape === 'wide' ? 'aspect-[16/7]' : 'aspect-[4/5] max-w-[12rem]')}>
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-2 text-sm"><ImagePlus className="h-6 w-6" aria-hidden />Choose an image</span>}
      </button>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={label}
        onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ''; if (!f) return; setPreview(URL.createObjectURL(f)); onPick(f); }} />
    </div>
  );
};

export default ImagePick;
