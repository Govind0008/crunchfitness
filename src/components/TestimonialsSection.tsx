import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

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

const testimonialsStats = [
  { target: 98,  suffix: '%',  label: 'Satisfaction Rate', color: 'text-green-500' },
  { target: 500, suffix: '+',  label: 'Success Stories',   color: 'text-orange-500' },
  { target: 49,  suffix: '★',  label: 'Average Rating',    color: 'text-green-500',  decimal: true },
  { target: 100, suffix: '%',  label: 'Recommended',       color: 'text-orange-500' },
];

const TestimonialStatCard = ({ stat, active }: { stat: typeof testimonialsStats[0]; active: boolean }) => {
  const count = useCounter(stat.target, 1400, active);
  const display = stat.decimal ? (count / 10).toFixed(1) : count;
  return (
    <div className="text-center group cursor-default">
      <div className={`text-3xl md:text-4xl font-bold mb-2 ${stat.color}`}>
        {display}{stat.suffix}
      </div>
      <div className="text-gray-400 group-hover:text-white transition-colors duration-300 text-sm">{stat.label}</div>
    </div>
  );
};

const testimonials = [
  {
    name: "Vikram Malhotra",
    role: "Software Engineer",
    rating: 5,
    text: "Crunch Fitness completely transformed my lifestyle. The trainers are incredibly knowledgeable and supportive. Lost 15kg in 6 months!",
    datePublished: "2024-01-15",
  },
  {
    name: "Shreya Patel",
    role: "Marketing Manager",
    rating: 5,
    text: "The yoga classes here are amazing! Priya ma'am is such an excellent instructor. I feel more flexible and peaceful than ever before.",
    datePublished: "2024-02-10",
  },
  {
    name: "Rohit Sharma",
    role: "Business Owner",
    rating: 5,
    text: "Best gym in Wakad, Pune! The CrossFit sessions with Arjun sir pushed me beyond my limits. Gained serious strength and confidence at Crunch Fitness.",
    datePublished: "2024-01-28",
  },
  {
    name: "Anita Singh",
    role: "Doctor",
    rating: 4,
    text: "Clean facilities, professional staff, and great equipment. The nutrition guidance from Rohit sir helped me achieve my fitness goals faster at Crunch Fitness Club Pune.",
    datePublished: "2024-02-05",
  },
];

// JSON-LD schema — computed once, not on every render
const businessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.crunchfitness.fitness/#business",
  "name": "Crunch Fitness Club",
  "description": "Premium fitness club in Wakad, Pune.",
  "priceRange": "₹300-₹12000",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": String(testimonials.length),
    "bestRating": "5",
    "worstRating": "1",
  },
  "review": testimonials.map((t, i) => ({
    "@type": "Review",
    "@id": `https://www.crunchfitness.fitness/#review-${i + 1}`,
    "reviewRating": { "@type": "Rating", "ratingValue": String(t.rating), "bestRating": "5" },
    "author": { "@type": "Person", "name": t.name, "jobTitle": t.role },
    "reviewBody": t.text,
    "datePublished": t.datePublished,
  })),
};
const schemaString = JSON.stringify(businessSchema);

const TestimonialsSection = () => {
  const [current, setCurrent] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 6000);
  }, []);

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

  // Pause on hover, resume on leave
  useEffect(() => {
    if (!isPaused) {
      startInterval();
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, startInterval]);

  const goTo = (index: number) => {
    setCurrent(index);
    startInterval(); // reset timer on manual nav
  };
  const prev = () => goTo((current - 1 + testimonials.length) % testimonials.length);
  const next = () => goTo((current + 1) % testimonials.length);

  const review = testimonials[current];

  return (
    <section ref={sectionRef} className="py-20 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schemaString }} />

      {/* Ambient background */}
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
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Real stories from real people who transformed their lives at{' '}
            <strong className="text-white">Crunch Fitness Club in Wakad, Pune</strong>.
          </p>
        </div>

        {/* Carousel */}
        <div className={`transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-4xl mx-auto">
            <div
              className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-gray-700 shadow-2xl hover:border-green-500/30 hover:shadow-green-500/10 transition-all duration-500"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              role="region"
              aria-label="Member testimonials"
              aria-live="polite"
            >
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="flex justify-center mb-6">
                <Quote className="w-10 h-10 text-green-500" />
              </div>

              <div className="text-center" itemScope itemType="https://schema.org/Review">
                <p className="text-xl md:text-2xl text-gray-200 italic mb-8 leading-relaxed" itemProp="reviewBody">
                  "{review.text}"
                </p>

                {/* Stars — no stagger delay, no hover:animate-pulse (both were broken) */}
                <div
                  className="flex justify-center gap-1.5 mb-6"
                  itemProp="reviewRating"
                  itemScope
                  itemType="https://schema.org/Rating"
                >
                  <meta itemProp="ratingValue" content={String(review.rating)} />
                  <meta itemProp="bestRating" content="5" />
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 transition-transform duration-150 hover:scale-110 ${
                        i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center" itemProp="author" itemScope itemType="https://schema.org/Person">
                  <h4 className="text-lg font-bold text-white" itemProp="name">{review.name}</h4>
                  <p className="text-green-400 text-sm" itemProp="jobTitle">{review.role}</p>
                  <meta itemProp="datePublished" content={review.datePublished} />
                </div>
              </div>

              {isPaused && (
                <span className="absolute bottom-3 right-4 text-[10px] text-gray-600 select-none">paused</span>
              )}
            </div>
          </div>

          {/* Pill-style dots */}
          <div className="flex justify-center mt-6 gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === current ? 'bg-green-500 w-7 h-3' : 'bg-gray-600 hover:bg-gray-500 w-3 h-3'
                }`}
                aria-label={`Show testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div
          ref={statsRef}
          className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 transition-all duration-700 delay-400 ${statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {testimonialsStats.map((stat, i) => (
            <TestimonialStatCard key={i} stat={stat} active={statsVisible} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
