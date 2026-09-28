import { useState, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useGoogleReviews } from '@/hooks/useGoogleReviews';
import { Section } from '@/components/site/Section';
import { ChapterMark, Hud, TickRail } from '@/components/motion';
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

  // Rotation is driven by the active rail segment's animation (see .review-timer): it pauses
  // on hover/focus with the bar, restarts on manual navigation, and never runs under reduced motion.
  const advance = useCallback(() => setCurrent((c) => (c + 1) % Math.max(1, count)), [count]);

  const review = reviews[current];
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Section id="reviews" aria-labelledby="reviews-heading">
      <ChapterMark index="03" word="Transform" />
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        {/* Summary — the real Google rating, set large */}
        <div className="lg:col-span-4">
          <p className="eyebrow mb-4">
            <TickRail className="w-8" />
            <span className="m-rise" style={{ '--d': 120 } as React.CSSProperties}>Member reviews</span>
          </p>
          <h2 id="reviews-heading" className="font-display text-display-md font-bold uppercase text-white text-balance">
            <span className="m-line"><span style={{ '--d': 80 } as React.CSSProperties}>Heard on the gym floor</span></span>
          </h2>
          <p className="m-rise mt-4 max-w-sm text-ink-300" style={{ '--d': 220 } as React.CSSProperties}>
            Real people, real sessions. Unedited reviews from members, pulled live from Google.
          </p>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="m-rise group mt-10 block w-fit"
            style={{ '--d': 300 } as React.CSSProperties}
          >
            {rating > 0 ? (
              <>
                <span className="flex items-end gap-4">
                  <span className="font-display text-7xl font-extrabold leading-[0.8] text-white md:text-8xl">{rating.toFixed(1)}</span>
                  <span className="pb-1">
                    <Stars rating={rating} />
                    <span className="mt-2 block text-sm text-ink-400">{total} reviews</span>
                  </span>
                </span>
                <span className="link-drive mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
                  <GoogleLogo className="h-4 w-4" /> Read all on Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </span>
              </>
            ) : (
              <span className="link-drive inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors group-hover:text-brand-400">
                <GoogleLogo className="h-5 w-5" /> Read our reviews on Google <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>

        {/* The quote — typography does the work; no card */}
        <div className="m-rise lg:col-span-8 lg:border-l lg:border-white/[0.08] lg:pl-16" style={{ '--d': 200 } as React.CSSProperties}>
          {loading && (
            <div className="animate-pulse" aria-label="Loading reviews">
              <div className="h-4 w-24 rounded bg-ink-800" />
              <div className="mt-8 space-y-4">
                <div className="h-7 w-full rounded bg-ink-800" />
                <div className="h-7 w-11/12 rounded bg-ink-800" />
                <div className="h-7 w-2/3 rounded bg-ink-800" />
              </div>
              <div className="mt-12 h-5 w-48 rounded bg-ink-800" />
            </div>
          )}

          {!loading && (error || count === 0) && (
            <div className="flex h-full flex-col items-start justify-center">
              <span className="font-display text-[7rem] font-extrabold leading-[0.6] text-brand-400" aria-hidden>&ldquo;</span>
              <p className="mt-4 max-w-xl text-2xl font-medium leading-snug tracking-tight text-white md:text-4xl">
                The best review is the one you hear in person.
              </p>
              <p className="mt-4 max-w-md text-ink-400">Reviews couldn&apos;t load here right now — they&apos;re always available on our Google listing.</p>
              <Button asChild variant="outline" className="mt-8">
                <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                  Open Google reviews <ExternalLink />
                </a>
              </Button>
            </div>
          )}

          {!loading && review && (
            <figure
              className="flex h-full flex-col"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              aria-roledescription="carousel"
              aria-label="Google member reviews"
            >
              <div className="flex items-center justify-between gap-4">
                <Stars rating={review.rating} />
                <Hud index={pad(current + 1)} label={`of ${pad(count)}`} />
              </div>

              <blockquote key={current} className="review-quote mt-8 flex-1" aria-live={paused ? 'polite' : 'off'}>
                <span className="block font-display text-[6rem] font-extrabold leading-[0.55] text-brand-400 md:text-[8rem]" aria-hidden>&ldquo;</span>
                <p className="mt-2 text-xl font-medium leading-snug tracking-tight text-white text-pretty md:text-3xl md:leading-[1.25] line-clamp-[9]">
                  {review.text}
                </p>
              </blockquote>

              <figcaption key={`by-${current}`} className="review-quote mt-10 flex items-center gap-4" style={{ animationDelay: '120ms' }}>
                {review.profile_photo_url ? (
                  <img
                    src={review.profile_photo_url}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-800 font-semibold text-white" aria-hidden>
                    {review.author_name.charAt(0)}
                  </span>
                )}
                <div>
                  <p className="font-display text-xl font-bold uppercase tracking-wide text-white">— {review.author_name}</p>
                  <p className="text-sm text-ink-400">Google review · {review.relative_time_description}</p>
                </div>
              </figcaption>

              {count > 1 && (
                <div className="mt-10 flex items-center gap-6 border-t border-white/[0.08] pt-6">
                  {/* Set rail — one segment per review; the active one loads over the rotation time */}
                  <div className="flex flex-1 gap-1.5" role="group" aria-label="Choose a review">
                    {reviews.map((r, i) => (
                      <button
                        key={r.author_name + i}
                        type="button"
                        onClick={() => goTo(i)}
                        aria-label={`Review ${i + 1} of ${count}, by ${r.author_name}`}
                        aria-current={i === current ? 'true' : undefined}
                        className="group/seg relative h-6 flex-1"
                      >
                        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/15 transition-colors group-hover/seg:bg-white/30">
                          {i < current && <span className="absolute inset-0 bg-white/50" />}
                          {i === current && (
                            <span
                              key={current}
                              className={cn('review-timer absolute inset-0 bg-brand-400', paused && '[animation-play-state:paused]')}
                              style={{ animationDuration: `${ROTATE_MS}ms` }}
                              onAnimationEnd={advance}
                            />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" size="icon" onClick={() => goTo(current - 1)} aria-label="Previous review">
                      <ChevronLeft />
                    </Button>
                    <Button variant="secondary" size="icon" onClick={() => goTo(current + 1)} aria-label="Next review">
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              )}
            </figure>
          )}
        </div>
      </div>
    </Section>
  );
};

export default TestimonialsSection;
