import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useScrollReveal, useRevealOnMount } from '@/hooks/useScrollReveal';
import { TickRail } from '@/components/motion';

type Tone = 'base' | 'raised';

interface SectionProps {
  id?: string;
  tone?: Tone;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
  'aria-labelledby'?: string;
}

/** Page section with the shared vertical rhythm and container width. */
export const Section = ({
  id, tone = 'base', className, containerClassName, children, ...rest
}: SectionProps) => {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <section
      id={id}
      aria-labelledby={rest['aria-labelledby']}
      className={cn(
        'relative overflow-x-clip py-section',
        tone === 'raised' && 'bg-ink-900 border-y border-white/[0.06]',
        className,
      )}
    >
      <div ref={ref} className={cn('container reveal', containerClassName)}>
        {children}
      </div>
    </section>
  );
};

interface SectionHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  id?: string;
  align?: 'left' | 'center';
  /** Optional element aligned to the right of the heading on wide screens */
  action?: ReactNode;
  className?: string;
}

export const SectionHeader = ({ eyebrow, title, lede, id, align = 'left', action, className }: SectionHeaderProps) => (
  <div
    className={cn(
      'mb-10 md:mb-14 flex flex-col gap-6',
      action && 'md:flex-row md:items-end md:justify-between',
      align === 'center' && 'items-center text-center',
      className,
    )}
  >
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
      {eyebrow && (
        <p className="eyebrow mb-4">
          <TickRail className="w-8" />
          <span className="m-rise" style={{ '--d': 120 } as React.CSSProperties}>{eyebrow}</span>
        </p>
      )}
      <h2 id={id} className="font-display text-display-md font-bold uppercase text-white text-balance">
        <span className="m-line"><span style={{ '--d': 80 } as React.CSSProperties}>{title}</span></span>
      </h2>
      {lede && (
        <p className="m-rise mt-4 text-base md:text-lg leading-relaxed text-ink-300 text-pretty" style={{ '--d': 220 } as React.CSSProperties}>
          {lede}
        </p>
      )}
    </div>
    {action && <div className="m-rise shrink-0" style={{ '--d': 320 } as React.CSSProperties}>{action}</div>}
  </div>
);

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  /** Optional background photo; kept dark so text always has contrast */
  image?: { src: string; srcSet?: string; alt: string; position?: string };
}

/** Top-of-page header for secondary pages (About, Plans, Contact, …). */
export const PageHeader = ({ eyebrow, title, lede, children, image }: PageHeaderProps) => {
  const ref = useRevealOnMount<HTMLElement>();
  return (
    <header ref={ref} className="relative overflow-hidden border-b border-white/[0.06]">
      {image && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden={image.alt === ''}>
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes="100vw"
            alt={image.alt}
            className="m-settle h-full w-full object-cover"
            style={{ objectPosition: image.position ?? 'center' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-transparent" />
        </div>
      )}
      <div className="container relative pt-14 pb-14 md:pt-24 md:pb-20">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="eyebrow mb-5">
              <TickRail className="w-10" />
              <span className="m-rise" style={{ '--d': 100 } as React.CSSProperties}>{eyebrow}</span>
            </p>
          )}
          <h1 className="font-display text-display-lg font-extrabold uppercase text-white text-balance">
            <span className="m-line"><span style={{ '--d': 60 } as React.CSSProperties}>{title}</span></span>
          </h1>
          {lede && (
            <p className="m-rise mt-5 max-w-2xl text-base md:text-lg leading-relaxed text-ink-300 text-pretty" style={{ '--d': 240 } as React.CSSProperties}>
              {lede}
            </p>
          )}
          {children && <div className="m-rise mt-8" style={{ '--d': 340 } as React.CSSProperties}>{children}</div>}
        </div>
      </div>
      {/* Progress hairline along the base of every page header */}
      <span className="m-fill-x absolute inset-x-0 bottom-0 h-px bg-brand-400/50" style={{ '--d': 200 } as React.CSSProperties} aria-hidden />
    </header>
  );
};
