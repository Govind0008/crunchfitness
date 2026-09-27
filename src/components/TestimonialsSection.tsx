import { useState, useEffect, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useGoogleReviews } from '@/hooks/useGoogleReviews';
import { Section } from '@/components/site/Section';
import { ChapterMark, TickRail } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Crunch+Fitness+Club/@18.599946,73.770242,20z/data=!4m6!3m5!1s0x3bc2b979fd8fdac5:0xd27c5a7f4bc4a76e!8m2!3d18.5999023!4d73.7700584!16s%2Fg%2F11m_h10q89';

const ROTATE_MS = 7000;

const GoogleLogo = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Stars = ({ rating, className }: { rating: number; className?: string }) => (
  <div className={cn('flex gap-0.5', className)} role="img" aria-label={`${rating} out of 5 stars`}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Star key={i} className={cn('h-4 w-4', i < Math.round(rating) ? 'fill-brand-400 text-brand-400' : 'text-ink-600')} aria-hidden />
    ))}
  </div>
);

const TestimonialsSection = () => {
  const { data, loading, error } = useGoogleReviews();
  const reviews = (data?.reviews ?? []).filter((r) => r.text?.trim());
  const rating = data?.rating ?? 0;
  const total = data?.user_ratings_total ?? 0;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = reviews.length;
  const goTo = useCallback((i: number) => setCurrent(((i % count) + count) % count), [count]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (paused || count < 2 || reduce) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % count), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, count]);

  const review = reviews[current];

  return (
    <Section aria-labelledby="reviews-heading" tone="raised">
      <ChapterMark index="03" word="Transform" />
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Summary */}
        <div className="lg:col-span-4">
          <p className="eyebrow mb-4">
          <TickRail className="w-8" />
          <span className="m-rise" style={{ '--d': 120 } as React.CSSProperties}>Member reviews</span>
          </p>
          <h2 id="reviews-heading" className="font-display text-display-md font-bold uppercase text-white text-balance">
            <span className="m-line"><span style={{ '--d': 80 } as React.CSSProperties}>Heard on the gym floor</span></span>
          </h2>
          <p className="m-rise mt-4 text-ink-300" style={{ '--d': 220 } as React.CSSProperties}>Unedited reviews from members, pulled live from Google.</p>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-8 flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-ink-950 p-5 transition-colors hover:border-white/20"
          >
            <GoogleLogo className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              {rating > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-3xl font-bold text-white">{rating.toFixed(1)}</span>
                    <Stars rating={rating} />
                  </div>
                  <p className="text-sm text-ink-400">{total} reviews on Google</p>
                </>
              ) : (
                <p className="font-semibold text-white">Read our reviews on Google</p>
              )}
            </div>
            <ExternalLink className="h-4 w-4 text-ink-500 transition-colors group-hover:text-white" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        {/* Review carousel */}
        <div className="m-rise lg:col-span-8" style={{ '--d': 200 } as React.CSSProperties}>
          {loading && (
            <div className="rounded-2xl border border-white/[0.08] bg-ink-950 p-8 md:p-12 animate-pulse" aria-label="Loading reviews">
              <div className="h-4 w-24 rounded bg-ink-800" />
              <div className="mt-8 space-y-3">
                <div className="h-5 w-full rounded bg-ink-800" />
                <div className="h-5 w-11/12 rounded bg-ink-800" />
                <div className="h-5 w-2/3 rounded bg-ink-800" />
              </div>
              <div className="mt-10 h-10 w-48 rounded bg-ink-800" />
            </div>
          )}

          {!loading && (error || count === 0) && (
            <div className="flex h-full flex-col items-start justify-center rounded-2xl border border-white/[0.08] bg-ink-950 p-8 md:p-12">
              <p className="font-display text-display-sm font-bold uppercase text-white">See what members say</p>
              <p className="mt-3 max-w-md text-ink-400">Reviews couldn&apos;t load here right now — they&apos;re always available on our Google listing.</p>
              <Button asChild variant="outline" className="mt-8">
                <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                  Open Google reviews <ExternalLink />
                </a>
              </Button>
            </div>
          )}

          {!loading && review && (
            <figure
              className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-ink-950 p-8 md:p-12"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              aria-roledescription="carousel"
              aria-label="Google member reviews"
            >
              <Stars rating={review.rating} />
              <blockquote
                key={current}
                className="mt-6 flex-1 animate-fade-in"
                aria-live={paused ? 'polite' : 'off'}
              >
                <p className="text-lg leading-relaxed text-white md:text-2xl md:leading-snug line-clamp-[8]">
                  &ldquo;{review.text}&rdquo;
                </p>
              </blockquote>

              <figcaption className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-white/[0.08] pt-6">
                <div className="flex items-center gap-3">
                  {review.profile_photo_url ? (
                    <img
                      src={review.profile_photo_url}
                      alt=""
                      className="h-11 w-11 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-800 font-semibold text-white" aria-hidden>
                      {review.author_name.charAt(0)}
                    </span>
                  )}
                  <div>
                    <p className="font-semibold text-white">{review.author_name}</p>
                    <p className="text-sm text-ink-400">Google review · {review.relative_time_description}</p>
                  </div>
                </div>

                {count > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums text-ink-400" aria-hidden>
                      {current + 1} / {count}
                    </span>
                    <Button variant="secondary" size="icon" onClick={() => goTo(current - 1)} aria-label="Previous review">
                      <ChevronLeft />
                    </Button>
                    <Button variant="secondary" size="icon" onClick={() => goTo(current + 1)} aria-label="Next review">
                      <ChevronRight />
                    </Button>
                  </div>
                )}
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </Section>
  );
};

export default TestimonialsSection;
