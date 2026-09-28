import { useState } from 'react';
import { Trophy, Target, Users, Maximize2 } from 'lucide-react';
import Footer from '../components/Footer';
import { PageHeader, Section, SectionHeader } from '@/components/site/Section';
import Lightbox, { type LightboxImage } from '@/components/site/Lightbox';
import CtaBand from '@/components/site/CtaBand';
import { cn } from '@/lib/utils';
import { TickRail } from '@/components/motion';

type Category = 'Equipment' | 'Facilities' | 'Training' | 'Powerlifting';

interface GalleryImage extends LightboxImage {
  thumb: string;
  category: Category;
}

const img = (name: string, small: number, large: number, title: string, category: Category): GalleryImage => ({
  thumb: `/images/${name}-${small}.webp`,
  src: `/images/${name}-${large}.webp`,
  title,
  category,
  caption: category,
});

const GALLERY: GalleryImage[] = [
  img('cardio', 800, 1600, 'Modern cardio zone at Crunch Fitness Wakad', 'Equipment'),
  img('coach-mobility', 640, 1600, 'One-on-one personal training session', 'Training'),
  img('machines', 800, 1600, 'Strength training area with free weights', 'Equipment'),
  img('studio', 800, 1600, 'Spacious group fitness studio for classes', 'Facilities'),
  img('coach-rahul', 600, 1200, 'One-on-one personal training session', 'Training'),
  img('gym-wide-4', 800, 1600, 'Gym floor overview', 'Facilities'),
  img('coach-maddy', 600, 1200, 'Personal training in action', 'Training'),
  img('studio-2', 800, 1600, 'Zumba & group activities', 'Facilities'),
  img('coach-bench', 640, 1600, 'Coach-guided dumbbell press', 'Training'),
  img('cardio-2', 800, 1600, 'High-intensity cardio training', 'Equipment'),
];

const POWERLIFTING: GalleryImage[] = [
  img('squat', 560, 1200, 'Professional powerlifting platform', 'Powerlifting'),
  img('deadlift', 600, 1200, 'Olympic standard equipment setup', 'Powerlifting'),
];

const FEATURES = [
  { icon: Trophy, title: 'Competition standard', description: 'Olympic-grade platforms with calibrated plates and professional barbells.' },
  { icon: Target, title: 'Expert coaching', description: 'Certified powerlifting coaches to perfect your squat, bench and deadlift.' },
  { icon: Users, title: 'Community hub', description: 'Join our powerlifting community and train with like-minded athletes.' },
];

// Contact-sheet rhythm, 7 tiles per cycle. Tiles are grouped so every group fills whole rows
// (desktop: 6 columns — [large, tall] [small ×3] [wide ×2]; mobile: 2 columns — [large] [tall pair]
// [wide] [pair] [wide]), so photos stay in reading order with no dense re-packing.
const SHEET = [
  'col-span-2 row-span-2 md:col-span-4',
  'col-span-1 row-span-2 md:col-span-2',
  'col-span-1 row-span-2 md:row-span-1 md:col-span-2',
  'col-span-2 md:col-span-2',
  'col-span-1 md:col-span-2',
  'col-span-1 md:col-span-3',
  'col-span-2 md:col-span-3',
];
const DESK_W = [4, 2, 2, 2, 2, 3, 3];
const DESK_GROUPS = [[0, 1], [2, 3, 4], [5, 6]];
const DESK_FILL: Record<number, string> = { 2: '', 4: 'md:!col-span-4', 6: 'md:!col-span-6' };

/** Span classes for tile i of n; the last tile of an unfinished group stretches to close the row. */
const sheetSpan = (i: number, n: number) => {
  const k = i % SHEET.length;
  if (i !== n - 1) return SHEET[k];
  const group = DESK_GROUPS.find((g) => g.includes(k))!;
  const used = group.filter((j) => j < k).reduce((sum, j) => sum + DESK_W[j], 0);
  const desk = k === group[group.length - 1] ? '' : DESK_FILL[6 - used] ?? '';
  const mobile = k === 1 || k === 4 ? '!col-span-2' : ''; // first of a mobile pair, left alone
  return cn(SHEET[k], desk, mobile);
};

const CATEGORIES = ['All', 'Equipment', 'Facilities', 'Training'] as const;

const Gallery = () => {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [lightbox, setLightbox] = useState<{ set: GalleryImage[]; index: number; origin: DOMRect | null } | null>(null);

  // Remember where the photo was clicked so the lightbox can morph out of that tile
  const openAt = (set: GalleryImage[], index: number, e: React.MouseEvent<HTMLElement>) =>
    setLightbox({ set, index, origin: e.currentTarget.querySelector('img')?.getBoundingClientRect() ?? null });

  const filtered = activeCategory === 'All' ? GALLERY : GALLERY.filter((i) => i.category === activeCategory);

  return (
    <div className="min-h-screen">
      <main>
        <PageHeader
          eyebrow="Gallery"
          title={<>Inside <span className="text-brand-400">Crunch</span></>}
          lede="Explore our facilities in Wakad, Pune — the strength floor, cardio zone, studio and the coaching that happens every day."
          image={{ src: '/images/floor-3-1600.webp', srcSet: '/images/floor-3-800.webp 800w, /images/floor-3-1600.webp 1600w', alt: '' }}
        />

        {/* Powerlifting feature */}
        <Section aria-labelledby="powerlifting-heading">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="focus-grid grid grid-cols-2 gap-3">
              {POWERLIFTING.map((image, i) => (
                <button
                  key={image.src}
                  type="button"
                  onClick={(e) => openAt(POWERLIFTING, i, e)}
                  className={cn('focus-item group relative aspect-[4/5] overflow-hidden rounded-2xl bg-ink-900', i === 1 && 'mt-10')}
                  aria-label={`View larger: ${image.title}`}
                >
                  <div className={cn('h-full w-full', i === 0 ? 'm-wipe-up' : 'm-wipe-right')} style={{ '--d': 100 + i * 180 } as React.CSSProperties}>
                    <img
                      src={image.thumb}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.04]"
                    />
                  </div>
                  <Maximize2 className="absolute right-3 top-3 h-8 w-8 rounded-full bg-ink-950/70 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                </button>
              ))}
            </div>

            <div>
              <p className="eyebrow mb-4">
                <TickRail className="w-8" />
                <span className="m-rise inline-flex items-center gap-2" style={{ '--d': 120 } as React.CSSProperties}>
                  <Trophy className="h-3.5 w-3.5" aria-hidden /> Featured area
                </span>
              </p>
              <h2 id="powerlifting-heading" className="font-display text-display-md font-bold uppercase text-white">
                <span className="m-line"><span style={{ '--d': 80 } as React.CSSProperties}>The powerlifting platform</span></span>
              </h2>
              <p className="m-rise mt-4 text-ink-300 md:text-lg" style={{ '--d': 220 } as React.CSSProperties}>
                Our crown jewel — a dedicated powerlifting area with competition-standard equipment. Most members
                don&apos;t know it&apos;s here; come see the difference competition-grade kit makes.
              </p>
              <ul className="mt-10 space-y-6">
                {FEATURES.map((f, i) => (
                  <li key={f.title} className="m-rack flex gap-4" style={{ '--i': i, '--d': 300 } as React.CSSProperties}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-400/10">
                      <f.icon className="h-5 w-5 text-brand-400" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{f.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-400">{f.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Photo grid */}
        <Section tone="raised" aria-labelledby="photos-heading">
          <SectionHeader
            id="photos-heading"
            eyebrow="Photos"
            title="The facility"
            action={
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter photos by category">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCategory(c)}
                    aria-pressed={activeCategory === c}
                    className={cn(
                      'h-10 rounded-full px-5 text-sm font-semibold transition-colors',
                      activeCategory === c ? 'bg-white text-ink-950' : 'border border-white/10 text-ink-300 hover:border-white/30 hover:text-white',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            }
          />

          {/* Contact sheet — a repeating editorial rhythm of wide, tall and small frames */}
          <ul className="focus-grid grid auto-rows-[10rem] grid-cols-2 gap-3 sm:auto-rows-[12rem] md:grid-cols-6 lg:auto-rows-[14rem]">
            {filtered.map((image, i) => (
              <li
                key={image.src}
                className={cn('animate-fade-up', sheetSpan(i, filtered.length))}
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
              >
                <button
                  type="button"
                  onClick={(e) => openAt(filtered, i, e)}
                  className="focus-item group relative block h-full w-full overflow-hidden rounded-2xl bg-ink-800"
                  aria-label={`View larger: ${image.title}`}
                >
                  <img
                    src={image.thumb}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover object-[center_35%] transition-transform [transition-duration:900ms] ease-out-expo group-hover:scale-[1.05]"
                  />
                  <span className="hud absolute left-3 top-3 rounded-full bg-ink-950/60 px-2.5 py-1.5 text-white/80 backdrop-blur-sm" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {/* Metadata rises with a short rail as the photo comes forward */}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent p-4 pt-12 text-left opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="flex translate-y-2 items-center gap-2 transition-transform duration-500 ease-out-expo group-hover:translate-y-0 group-focus-visible:translate-y-0">
                      <span className="h-px w-5 bg-brand-400" aria-hidden />
                      <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">{image.category}</span>
                    </span>
                    <span className="mt-1 block translate-y-2 text-sm font-medium text-white transition-transform delay-75 duration-500 ease-out-expo group-hover:translate-y-0 group-focus-visible:translate-y-0">{image.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <CtaBand title="See it in person" body="Photos only go so far. Book a free tour and walk the floor with one of our coaches." />
      </main>

      <Lightbox
        images={lightbox?.set ?? []}
        index={lightbox?.index ?? null}
        onIndexChange={(i) => setLightbox(i === null ? null : { ...lightbox!, index: i })}
        originRect={lightbox?.origin}
      />
      <Footer />
    </div>
  );
};

export default Gallery;
