import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import FacilityExplorer from '@/components/FacilityExplorer';
import { Section, SectionHeader } from '@/components/site/Section';
import { ChapterMark, Parallax } from '@/components/motion';
import { useScrollVar } from '@/hooks/useScrollVar';
import { useScrollReveal } from '@/hooks/useScrollReveal';


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

    <FacilityExplorer />
  </Section>
  );
};

export default GallerySection;
