import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { prefersReducedMotion } from '@/lib/motion';

export interface LightboxImage {
  src: string;
  /** Smaller, already-loaded version shown instantly while `src` loads */
  thumb?: string;
  title: string;
  caption?: string;
}

interface LightboxProps {
  images: LightboxImage[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Screen rect of the thumbnail that was clicked — the image morphs out of (and back into) it */
  originRect?: DOMRect | null;
}

const DRIVE = 'cubic-bezier(0.2, 0.9, 0.1, 1)';

/**
 * Keyframe that makes the full image (target rect) sit exactly over the object-cover
 * thumbnail (origin rect): scale to cover, then clip away what the tile had cropped.
 */
const invert = (from: DOMRect, to: DOMRect): Keyframe => {
  const scale = Math.max(from.width / to.width, from.height / to.height);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const cx = Math.max(0, (to.width - from.width / scale) / 2);
  const cy = Math.max(0, (to.height - from.height / scale) / 2);
  return {
    transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
    clipPath: `inset(${cy}px ${cx}px round ${16 / scale}px)`,
  };
};

/** Full-screen image viewer with a thumbnail→image morph, keyboard (← →, Esc) and button navigation. */
const Lightbox = ({ images, index, onIndexChange, originRect }: LightboxProps) => {
  const open = index !== null;
  const count = images.length;
  const current = open ? images[index] : null;
  const imgRef = useRef<HTMLDivElement>(null);
  const openedAt = useRef<number | null>(null);
  const playedFor = useRef<string | null>(null);
  const closing = useRef(false);

  const step = useCallback(
    (delta: number) => index !== null && onIndexChange((index + delta + count) % count),
    [index, count, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  // Play: morph from the thumbnail on first open; crossfade when stepping between images
  const play = useCallback(() => {
    const img = imgRef.current;
    if (!img || !current || playedFor.current === current.src || prefersReducedMotion()) return;
    playedFor.current = current.src;
    if (openedAt.current === null && originRect) {
      openedAt.current = index;
      img.animate(
        [invert(originRect, img.getBoundingClientRect()), { transform: 'none', clipPath: 'inset(0px 0px round 12px)' }],
        { duration: 620, easing: DRIVE },
      );
    } else {
      if (openedAt.current === null) openedAt.current = index;
      img.animate([{ opacity: 0, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: DRIVE });
    }
  }, [index, originRect, current]);

  useLayoutEffect(() => {
    if (!open) { openedAt.current = null; playedFor.current = null; closing.current = false; return; }
    const base = imgRef.current?.querySelector('img');
    if (base?.complete && base.naturalWidth) play();
  }, [open, index, play]);

  // Close: if still on the photo that was opened, send it back into its tile first
  const close = () => {
    const img = imgRef.current;
    if (closing.current) return;
    if (img && originRect && openedAt.current === index && !prefersReducedMotion()) {
      closing.current = true;
      const anim = img.animate(
        [{ transform: 'none', clipPath: 'inset(0px 0px round 12px)' }, invert(originRect, img.getBoundingClientRect())],
        { duration: 380, easing: 'cubic-bezier(0.3, 0, 0.2, 1)', fill: 'forwards' },
      );
      anim.onfinish = () => onIndexChange(null);
    } else {
      onIndexChange(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="max-w-5xl gap-0 border-0 bg-transparent p-0 shadow-none data-[state=open]:animate-none data-[state=closed]:animate-none [&>button]:right-0 [&>button]:-top-12 [&>button]:bg-white/10"
      >
        {current && (
          <figure>
            <div ref={imgRef} key={current.src} className="relative mx-auto w-fit overflow-hidden rounded-xl will-change-transform">
              <img
                src={current.thumb ?? current.src}
                alt={current.title}
                onLoad={play}
                className="block max-h-[75svh] w-auto object-contain"
              />
              {current.thumb && (
                <img
                  src={current.src}
                  alt=""
                  aria-hidden
                  onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
                  className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-300"
                />
              )}
            </div>
            <figcaption className="mt-4 flex items-center justify-between gap-4 animate-fade-in [animation-delay:250ms]">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-semibold text-white">{current.title}</DialogTitle>
                <DialogDescription className="text-sm text-ink-400">
                  {current.caption ? `${current.caption} · ` : ''}{index! + 1} of {count}
                </DialogDescription>
              </div>
              {count > 1 && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    className="group flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    className="group flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
            </figcaption>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default Lightbox;
