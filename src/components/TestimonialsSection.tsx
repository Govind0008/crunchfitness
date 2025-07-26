import { useState, useEffect, useRef } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const TestimonialsSection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  const testimonials = [
    {
      name: "Vikram Malhotra",
      role: "Software Engineer",
      rating: 5,
      text: "Crunch Fitness completely transformed my lifestyle. The trainers are incredibly knowledgeable and supportive. Lost 15kg in 6 months!",
      datePublished: "2024-01-15"
    },
    {
      name: "Shreya Patel",
      role: "Marketing Manager",
      rating: 5,
      text: "The yoga classes here are amazing! Priya ma'am is such an excellent instructor. I feel more flexible and peaceful than ever before.",
      datePublished: "2024-02-10"
    },
    {
      name: "Rohit Sharma",
      role: "Business Owner",
      rating: 5,
      text: "Best gym in Wakad, Pune! The CrossFit sessions with Arjun sir pushed me beyond my limits. Gained serious strength and confidence at Crunch Fitness.",
      datePublished: "2024-01-28"
    },
    {
      name: "Anita Singh",
      role: "Doctor",
      rating: 4,
      text: "Clean facilities, professional staff, and great equipment. The nutrition guidance from Rajesh sir helped me achieve my fitness goals faster at Crunch Fitness Club Pune.",
      datePublished: "2024-02-05"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 6000);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  const currentReview = testimonials[currentTestimonial];

  // Navigation handlers
  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const businessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://www.crunchfitness.fitness/#business",
    "name": "Crunch Fitness Club",
    "alternateName": "Crunch Fitness Wakad",
    "description": "Premium fitness club and gym in Wakad, Pune offering personal training, group classes, and modern equipment.",
    "url": "https://www.crunchfitness.fitness/",
    "telephone": "+91-9876543210",
    "email": "info@crunchfitness.fitness",
    "image": [
      "https://www.crunchfitness.fitness/images/logo.png",
      "https://www.crunchfitness.fitness/images/gym-interior.jpg"
    ],
    "logo": "https://www.crunchfitness.fitness/images/logo.png",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Wakad Main Road",
      "addressLocality": "Wakad",
      "addressRegion": "Maharashtra",
      "postalCode": "411057",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": "18.5974",
      "longitude": "73.7898"
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "opens": "06:00",
        "closes": "23:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Saturday", "Sunday"],
        "opens": "07:00",
        "closes": "22:00"
      }
    ],
    "priceRange": "₹300-₹12000",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": testimonials.length.toString(),
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": testimonials.map((testimonial, index) => ({
      "@type": "Review",
      "@id": `https://www.crunchfitness.fitness/#review-${index + 1}`,
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": testimonial.rating.toString(),
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": {
        "@type": "Person",
        "name": testimonial.name,
        "jobTitle": testimonial.role
      },
      "reviewBody": testimonial.text,
      "datePublished": testimonial.datePublished,
      "publisher": {
        "@type": "Organization",
        "name": "Crunch Fitness Club"
      }
    })),
    "sameAs": [
      "https://www.facebook.com/crunchfitnesswakad",
      "https://www.instagram.com/crunchfitnesswakad",
      "https://www.youtube.com/crunchfitnesswakad"
    ]
  };

  return (
    <section ref={sectionRef} className="py-20 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(businessSchema)
        }}
      />

      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-green-400/5 rounded-full blur-2xl animate-bounce"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h2 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="text-white hover:text-green-400 transition-colors duration-500 cursor-default">WHAT OUR</span>
            <br />
            <span className="text-green-500 hover:text-green-400 transition-colors duration-500 cursor-default animate-pulse">MEMBERS SAY</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto hover:text-white transition-colors duration-300">
            Real stories from real people who transformed their lives at <strong>Crunch Fitness Club in Wakad, Pune</strong>. Hear about their fitness journeys and experiences.
          </p>
        </div>

        {/* Testimonials Carousel */}
        <div className={`relative transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-gray-700 shadow-2xl hover:shadow-green-500/10 transition-all duration-500 hover:border-green-500/30 relative overflow-hidden">
              {/* Background Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-orange-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500"></div>

              {/* Navigation Arrows */}
              <button
                onClick={prevTestimonial}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextTestimonial}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Quote Icon */}
              <div className="flex justify-center mb-6">
                <Quote className="w-12 h-12 text-green-500 hover:animate-spin transition-all duration-300" />
              </div>

              {/* Testimonial Content */}
              <div className="text-center relative z-10" itemScope itemType="https://schema.org/Review">
                <p
                  className="text-xl md:text-2xl text-gray-300 italic mb-8 leading-relaxed hover:text-white transition-colors duration-300"
                  itemProp="reviewBody"
                >
                  "{currentReview.text}"
                </p>

                {/* Rating Stars */}
                <div className="flex justify-center mb-6" itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                  <meta itemProp="ratingValue" content={currentReview.rating.toString()} />
                  <meta itemProp="bestRating" content="5" />
                  <meta itemProp="worstRating" content="1" />
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-6 h-6 ${i < currentReview.rating ? 'text-yellow-400 fill-current' : 'text-gray-400'} hover:animate-pulse cursor-pointer transform hover:scale-125 transition-all duration-300`}
                      style={{ animationDelay: `${i * 100}ms` }}
                      aria-label={`${i < currentReview.rating ? 'Filled' : 'Empty'} star`}
                    />
                  ))}
                </div>

                {/* Member Info */}
                <div className="flex flex-col md:flex-row items-center justify-center gap-4" itemProp="author" itemScope itemType="https://schema.org/Person">
                  <div className="text-center md:text-left">
                    <h4
                      className="text-xl font-bold text-white hover:text-green-400 transition-colors duration-300 cursor-default"
                      itemProp="name"
                    >
                      {currentReview.name}
                    </h4>
                    <p
                      className="text-green-500 hover:text-green-400 transition-colors duration-300 cursor-default"
                      itemProp="jobTitle"
                    >
                      {currentReview.role}
                    </p>
                  </div>
                  <meta itemProp="datePublished" content={currentReview.datePublished} />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Dots */}
          <div className="flex justify-center mt-8 space-x-3">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 transform hover:scale-150 ${
                  index === currentTestimonial
                    ? 'bg-green-500 scale-125 animate-pulse'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                aria-label={`Show testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 transform transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold text-green-500 mb-2 group-hover:animate-pulse">98%</div>
            <div className="text-gray-400 group-hover:text-white transition-colors duration-300">Satisfaction Rate</div>
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold text-orange-500 mb-2 group-hover:animate-pulse">500+</div>
            <div className="text-gray-400 group-hover:text-white transition-colors duration-300">Success Stories</div>
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold text-green-500 mb-2 group-hover:animate-pulse">4.9★</div>
            <div className="text-gray-400 group-hover:text-white transition-colors duration-300">Average Rating</div>
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-bold text-orange-500 mb-2 group-hover:animate-pulse">100%</div>
            <div className="text-gray-400 group-hover:text-white transition-colors duration-300">Recommended</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;