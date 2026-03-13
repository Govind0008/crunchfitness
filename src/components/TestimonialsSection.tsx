import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { useGoogleReviews } from '@/hooks/useGoogleReviews';

const GOOGLE_MAPS_URL =
  'https://www.google.com/maps/place/Crunch+Fitness+Club/@18.599946,73.770242,20z/data=!4m6!3m5!1s0x3bc2b979fd8fdac5:0xd27c5a7f4bc4a76e!8m2!3d18.5999023!4d73.7700584!16s%2Fg%2F11m_h10q89';

// Animates integer 0 → target when active becomes true
const useCounter = (target: number, duration = 1400, active = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, active]);
  return count;
};

const GoogleLogo = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const StarRow = ({ rating }: { rating: number }) => (
  <div className="flex justify-center gap-1.5 mb-6">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
        aria-hidden="true"
      />
    ))}
  </div>
);

const StatCard = ({ value, suffix, label, color, active }: {
  value: number; suffix: string; label: string; color: string; active: boolean;
}) => {
  const count = useCounter(Math.round(value * 10), 1400, active);
  const display = suffix === '★' ? (count / 10).toFixed(1) : Math.round(count / 10);
  return (
    <div className="text-center group cursor-default">
      <div className={`text-3xl md:text-4xl font-bold mb-2 ${color}`}>{display}{suffix}</div>
      <div className="text-gray-400 group-hover:text-white transition-colors duration-300 text-sm">{label}</div>
    </div>
  );
};

// Skeleton shown while fetching
const ReviewSkeleton = () => (
  <div className="max-w-4xl mx-auto">
    <div className="bg-gray-800/50 rounded-2xl p-8 md:p-12 border border-gray-700 flex flex-col items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-700" />
      <div className="h-4 bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-700 rounded w-2/3" />
      <div className="h-4 bg-gray-700 rounded w-1/2" />
      <div className="flex gap-1 mt-2">
        {[...Array(5)].map((_, i) => <div key={i} className="w-5 h-5 rounded bg-gray-700" />)}
      </div>
      <div className="h-3 bg-gray-700 rounded w-32" />
    </div>
  </div>
);

// Shown if API fails or returns no reviews
const ReviewsUnavailable = () => (
  <div className="max-w-4xl mx-auto">
    <div className="bg-gray-800/50 rounded-2xl p-8 md:p-12 border border-gray-700 flex flex-col items-center gap-4 text-center">
      <GoogleLogo className="w-10 h-10" />
      <p className="text-gray-300 text-lg">See what our members say about us on Google</p>
      <a
        href={GOOGLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full transition-all duration-300 hover:scale-105"
      >
        View Google Reviews
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  </div>
);

const TestimonialsSection = () => {
  const [current, setCurrent] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: googleData, loading, error } = useGoogleReviews();

  const reviews = googleData?.reviews ?? [];
  const rating = googleData?.rating ?? 0;
  const totalReviews = googleData?.user_ratings_total ?? 0;
  const hasReviews = reviews.length > 0;

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!hasReviews) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % reviews.length);
    }, 6000);
  }, [reviews.length, hasReviews]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isPaused) { startInterval(); }
    else { if (intervalRef.current) clearInterval(intervalRef.current); }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, startInterval]);

  const goTo = (index: number) => { setCurrent(index); startInterval(); };
  const prev = () => goTo((current - 1 + reviews.length) % reviews.length);
  const next = () => goTo((current + 1) % reviews.length);

  const review = reviews[current];

  const stats = [
    { value: rating || 4.9,        suffix: '★', label: 'Google Rating',    color: 'text-yellow-400' },
    { value: totalReviews || 200,   suffix: '+', label: 'Google Reviews',   color: 'text-orange-500' },
    { value: 98,                    suffix: '%', label: 'Satisfaction Rate', color: 'text-green-500'  },
    { value: 100,                   suffix: '%', label: 'Recommended',       color: 'text-green-500'  },
  ];

  return (
    <section ref={sectionRef} className="py-20 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white">WHAT OUR</span>
            <br />
            <span className="text-green-500">MEMBERS SAY</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-6">
            Real reviews from real members at{' '}
            <strong className="text-white">Crunch Fitness Club, Wakad, Pune</strong>.
          </p>

          {/* Google badge */}
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-700 hover:border-yellow-400/50 bg-gray-800/60 hover:bg-gray-700/60 transition-all duration-300 text-sm text-gray-300 hover:text-white group"
          >
            <GoogleLogo />
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
            </div>
            {rating > 0 && <span className="font-medium">{rating.toFixed(1)}</span>}
            {totalReviews > 0 && (
              <>
                <span className="text-gray-500">·</span>
                <span>{totalReviews}+ reviews on Google</span>
              </>
            )}
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        {/* Reviews area */}
        <div className={`transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {loading && (
            <div className="flex flex-col items-center gap-4 mb-8">
              <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
              <p className="text-gray-500 text-sm">Loading real reviews from Google…</p>
              <ReviewSkeleton />
            </div>
          )}

          {!loading && (error || !hasReviews) && <ReviewsUnavailable />}

          {!loading && hasReviews && (
            <>
              <div className="max-w-4xl mx-auto">
                <div
                  className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-gray-700 shadow-2xl hover:border-green-500/30 transition-all duration-500"
                  onMouseEnter={() => setIsPaused(true)}
                  onMouseLeave={() => setIsPaused(false)}
                  role="region"
                  aria-label="Google member reviews"
                  aria-live="polite"
                >
                  <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10" aria-label="Previous">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10" aria-label="Next">
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="flex justify-center mb-6">
                    <Quote className="w-10 h-10 text-green-500" />
                  </div>

                  <div className="text-center">
                    <p className="text-xl md:text-2xl text-gray-200 italic mb-8 leading-relaxed">
                      "{review.text}"
                    </p>

                    <StarRow rating={review.rating} />

                    <div className="flex flex-col items-center gap-1">
                      {review.profile_photo_url ? (
                        <img
                          src={review.profile_photo_url}
                          alt={review.author_name}
                          className="w-10 h-10 rounded-full mb-2 border-2 border-green-500/30 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full mb-2 bg-green-500/20 flex items-center justify-center text-green-400 font-bold text-sm border-2 border-green-500/30">
                          {review.author_name.charAt(0)}
                        </div>
                      )}
                      <h4 className="text-lg font-bold text-white">{review.author_name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <GoogleLogo className="w-3.5 h-3.5" />
                        <span className="text-green-400">Verified Google Review</span>
                        <span className="text-gray-600">·</span>
                        <span>{review.relative_time_description}</span>
                      </div>
                    </div>
                  </div>

                  {isPaused && <span className="absolute bottom-3 right-4 text-[10px] text-gray-600 select-none">paused</span>}
                </div>
              </div>

              {/* Dots */}
              <div className="flex justify-center mt-6 gap-2">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`rounded-full transition-all duration-300 ${i === current ? 'bg-green-500 w-7 h-3' : 'bg-gray-600 hover:bg-gray-500 w-3 h-3'}`}
                    aria-label={`Review ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* View all link */}
          <div className="flex justify-center mt-6">
            <a
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors duration-300 underline underline-offset-4 decoration-gray-600 hover:decoration-green-500"
            >
              View all reviews on Google Maps
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Stats */}
        <div
          ref={statsRef}
          className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 transition-all duration-700 delay-400 ${statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} active={statsVisible} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
