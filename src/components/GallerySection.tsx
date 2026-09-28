import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Section, SectionHeader } from '@/components/site/Section';
import { cn } from '@/lib/utils';
import { ChapterMark, Parallax } from '@/components/motion';
import { useScrollVar } from '@/hooks/useScrollVar';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const TILES = [
  { name: 'gym-wide',     label: 'Strength floor', alt: 'Rows of plate-loaded and selectorised machines on the main strength floor', span: 'col-span-2 row-span-2' },
  { name: 'cardio',       label: 'Cardio zone',    alt: 'Treadmills and bikes along the windows in the cardio zone',               span: 'col-span-2 md:col-span-1' },
  { name: 'weights-zone', label: 'Free weights',   alt: 'Dumbbell racks and benches in the free-weights area',                    span: 'col-span-1' },
  { name: 'studio',       label: 'Group studio',   alt: 'Open studio room used for Zumba and group classes',                      span: 'col-span-1' },
  { name: 'machines',     label: 'Machines',       alt: 'Cable stations and resistance machines',                                  span: 'col-span-2 md:col-span-1' },
];

const ZONES = ['Strength.', 'Cardio.', 'Studio.'];

/**
 * PERFORM — the facility chapter. A large photo starts framed to the content width and
 * opens to full-bleed as it reaches the centre of the screen (one scroll-linked clip-path),
 * the camera drifting slightly inside it. Detail tiles follow.
 */
const GallerySection = () => {
  const openRef = useScrollVar<HTMLDivElement>();
  const statementRef = useScrollReveal<HTMLDivElement>({ threshold: 0.35 });
  return (
  <Section id="gallery" aria-labelledby="gallery-heading">
    <ChapterMark index="02" word="Perform" />
    <SectionHeader
      id="gallery-heading"
      eyebrow="The facility"
      title="Built for serious training"
      lede="Strength, cardio and a group studio under one roof in Wakad — kept clean and ready from 6 AM."
      action={
        <Link to="/gallery" className="link-drive inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400 transition-colors">
          View full gallery <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    />

    {/* Immersive frame: bleeds out of the grid as it's reached */}
    <div ref={statementRef} className="relative left-1/2 mb-3 w-screen -translate-x-1/2">
      <div ref={openRef} className="facility-open relative aspect-[4/5] overflow-hidden bg-ink-900 sm:aspect-[16/9] lg:aspect-[21/9]">
        <Parallax depth={50} className="absolute -inset-y-8 inset-x-0">
          <img
            src="/images/floor-2-800.webp"
            srcSet="/images/floor-2-800.webp 800w, /images/floor-2-1600.webp 1600w"
            sizes="100vw"
            alt="Wide view of the Crunch Fitness training floor with racks, benches and machines"
            loading="lazy"
            className="scroll-zoom h-full w-full object-cover"
          />
        </Parallax>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/25 to-transparent" aria-hidden />
        {/* Aligned to the site container so copy always sits inside the (closed or open) frame */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="container px-10 pb-8 sm:px-14 sm:pb-12 lg:px-16 lg:pb-14">
            <p className="font-display text-[clamp(2.75rem,1.5rem+5vw,6rem)] font-extrabold uppercase leading-[0.88] text-white">
              {ZONES.map((z, i) => (
                <span key={z} className="m-line">
                  <span className={i === ZONES.length - 1 ? 'text-brand-400' : undefined} style={{ '--d': 200 + i * 110 } as React.CSSProperties}>{z}</span>
                </span>
              ))}
            </p>
            <p className="m-rise mt-4 max-w-md text-sm text-white/80 md:text-base" style={{ '--d': 560 } as React.CSSProperties}>
              Every zone you need under one roof, open from 6 AM.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div className="focus-grid grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] md:grid-cols-4 lg:auto-rows-[13rem]">
      {TILES.map((t, i) => (
        <Link
          key={t.name}
          to="/gallery"
          className={cn('focus-item group relative overflow-hidden rounded-2xl bg-ink-900', t.span)}
        >
          {/* Each tile is wiped in along a different axis, then its photo settles */}
          <div
            className={cn('absolute inset-0', ['m-wipe-up', 'm-wipe-left', 'm-wipe-right', 'm-wipe-up', 'm-wipe-left'][i])}
            style={{ '--d': 150 + i * 110 } as React.CSSProperties}
          >
            <div className="h-full w-full transition-transform [transition-duration:900ms] ease-out-expo group-hover:scale-[1.05]">
            <img
              src={`/images/${t.name}-800.webp`}
              srcSet={`/images/${t.name}-800.webp 800w, /images/${t.name}-1600.webp 1600w`}
              sizes={i === 0 ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 768px) 25vw, 50vw'}
              alt={t.alt}
              loading="lazy"
              className="m-settle h-full w-full object-cover"
              style={{ '--d': 150 + i * 110 } as React.CSSProperties}
            />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/0 to-transparent" aria-hidden />
          </div>
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between md:bottom-4 md:left-4 md:right-4">
            <span className="text-sm font-semibold text-white transition-transform duration-500 ease-out-expo group-hover:-translate-y-0.5">{t.label}</span>
            <ArrowUpRight className="h-4 w-4 text-brand-400 opacity-0 transition-[opacity,transform] duration-500 ease-out-expo group-hover:-translate-y-0.5 group-hover:opacity-100" aria-hidden />
          </div>
        </Link>
      ))}
    </div>
  </Section>
  );
};

export default GallerySection;
