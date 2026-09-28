import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const CHAPTERS = [
  { id: 'method', index: '01', word: 'Build' },
  { id: 'gallery', index: '02', word: 'Perform' },
  { id: 'reviews', index: '03', word: 'Transform' },
  { id: 'membership', index: '04', word: 'Commit' },
  { id: 'final-set', index: '05', word: 'Final set' },
];

/**
 * The hero's measurement rail, carried through the whole homepage: a quiet vertical
 * chapter indicator in the left gutter (wide screens only). Hidden during the hero,
 * it lights the chapter on screen and loads its line as the session progresses.
 */
const ChapterRail = () => {
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id));
    const hero = document.getElementById('home');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          if (e.target === hero) { setActive(-1); return; }
          setActive(els.indexOf(e.target as HTMLElement));
        });
      },
      // A chapter is "current" while it crosses the middle band of the screen
      { rootMargin: '-45% 0px -50% 0px' },
    );
    [hero, ...els].forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const visible = active >= 0;
  // Portalled: the page wrapper animates with a transform, which would re-anchor position:fixed
  return createPortal(
    <nav
      aria-label="Homepage chapters"
      data-state={visible ? 'on' : 'off'}
      className="chapter-rail fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1 min-[1360px]:flex"
    >
      <ol className="relative flex flex-col gap-1">
        {/* Rail track + fill, loaded chapter by chapter */}
        <span className="absolute bottom-3 left-[3px] top-3 w-px bg-white/10" aria-hidden />
        <span
          className="absolute left-[3px] top-3 w-px origin-top bg-brand-400 transition-transform duration-700 ease-out-expo"
          style={{ height: 'calc(100% - 1.5rem)', transform: `scaleY(${Math.max(0, active) / (CHAPTERS.length - 1)})` }}
          aria-hidden
        />
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              aria-current={i === active ? 'step' : undefined}
              className={cn('chapter-tick group flex items-center gap-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em]', i === active ? 'text-white' : 'text-ink-500 hover:text-ink-300')}
              tabIndex={visible ? 0 : -1}
            >
              <span className={cn('relative h-[7px] w-[7px] rounded-full border transition-colors duration-300', i <= active ? 'border-brand-400 bg-brand-400' : 'border-white/25 bg-ink-950')} aria-hidden />
              <span className="tabular-nums">{c.index}</span>
              <span className="chapter-word-label">{c.word}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>,
    document.body,
  );
};

export default ChapterRail;
