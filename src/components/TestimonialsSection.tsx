import { useState, useEffect, useRef } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const TestimonialsSection = () => {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const testimonials = [
    {
      name: "Vikram Malhotra",
      role: "Software Engineer",
      rating: 5,
      text: "Crunch Fitness completely transformed my lifestyle. The trainers are incredibly knowledgeable and supportive. Lost 15kg in 6 months!",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
    },
    {
      name: "Shreya Patel",
      role: "Marketing Manager",
      rating: 5,
      text: "The yoga classes here are amazing! Priya ma'am is such an excellent instructor. I feel more flexible and peaceful than ever before.",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
    },
    {
      name: "Rohit Sharma",
      role: "Business Owner",
      rating: 5,
      text: "Best gym in Wakad, Pune! The CrossFit sessions with Arjun sir pushed me beyond my limits. Gained serious strength and confidence at Crunch Fitness.",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
    },
    {
      name: "Anita Singh",
      role: "Doctor",
      rating: 5,
      text: "Clean facilities, professional staff, and great equipment. The nutrition guidance from Rajesh sir helped me achieve my fitness goals faster at Crunch Fitness Club Pune.",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b77c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80"
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

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const currentReview = testimonials[currentTestimonial];

  return (
    <section ref={sectionRef} className="py-20 bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
      {/* Schema Markup for Reviews (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AggregateRating",
          "itemReviewed": {
            "@type": "FitnessCenter",
            "name": "Crunch Fitness Club",
            "url": "https://www.crunchfitness.fit/" // Your gym's main URL
          },
          "ratingValue": "4.9", // Overall average rating for your gym
          "reviewCount": "250",  // Total number of reviews
          "review": testimonials.map(t => ({
            "@type": "Review",
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": t.rating.toString()
            },
            "author": {
              "@type": "Person",
              "name": t.name
            },
            "reviewBody": t.text,
            "itemReviewed": { // Important to link each review back to the gym
              "@type": "FitnessCenter",
              "name": "Crunch Fitness Club"
            }
          }))
        })}
      </script>

      {/* Enhanced Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-green-400/5 rounded-full blur-2xl animate-bounce"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Enhanced Section Header */}
        <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* SEO: Using h2 for a major section heading */}
          <h2 className="text-4xl md:text-6xl font-heading font-bold mb-4"> {/* Used font-heading */}
            <span className="text-white hover:text-green-400 transition-colors duration-500 cursor-default">WHAT OUR</span>
            <br />
            <span className="text-green-500 hover:text-green-400 transition-colors duration-500 cursor-default animate-pulse">MEMBERS SAY</span>
          </h2>
          <p className="text-xl text-gray-400 font-body max-w-3xl mx-auto hover:text-white transition-colors duration-300"> {/* Used font-body */}
            Real stories from real people who transformed their lives at **Crunch Fitness Club in Wakad, Pune**. Hear about their fitness journeys and experiences.
          </p>
        </div>

        {/* Enhanced Testimonials Carousel */}
        <div className={`relative transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-gray-700 shadow-2xl hover:shadow-green-500/10 transition-all duration-500 hover:border-green-500/30 relative overflow-hidden">
              {/* Background Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-orange-500/5 opacity-0 hover:opacity-100 transition-opacity duration-500"></div>
              
              {/* Navigation Arrows */}
              <button 
                onClick={prevTestimonial}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10"
                aria-label="Previous testimonial" // Added for accessibility
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <button 
                onClick={nextTestimonial}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-white transition-all duration-300 hover:scale-110 z-10"
                aria-label="Next testimonial" // Added for accessibility
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Enhanced Quote Icon */}
              <div className="flex justify-center mb-6">
                <Quote className="w-12 h-12 text-green-500 animate-pulse hover:animate-spin transition-all duration-300" />
              </div>

              {/* Testimonial Content */}
              <div className="text-center relative z-10">
                <p className="text-xl md:text-2xl text-gray-300 font-body italic mb-8 leading-relaxed hover:text-white transition-colors duration-300"> {/* Used font-body */}
                  "{currentReview.text}"
                </p>

                {/* Enhanced Rating Stars */}
                <div className="flex justify-center mb-6">
                  {[...Array(currentReview.rating)].map((_, i) => (
                    <Star 
                      key={i} 
                      className="w-6 h-6 text-yellow-400 fill-current hover:animate-pulse cursor-pointer transform hover:scale-125 transition-all duration-300" 
                      style={{ animationDelay: `${i * 100}ms` }}
                      aria-label={`${currentReview.rating} out of 5 stars`} // Added for accessibility
                    />
                  ))}
                </div>

                {/* Enhanced Member Info */}
                <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                  <div className="relative group">
                    <img 
                      src={currentReview.image}
                      alt={`Portrait of ${currentReview.name}, a member of Crunch Fitness Club`} // Enhanced alt text
                      className="w-16 h-16 rounded-full object-cover ring-4 ring-green-500/30 group-hover:ring-green-500 transition-all duration-300 transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400/20 to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="text-center md:text-left">
                    <h4 className="text-xl font-heading font-bold text-white hover:text-green-400 transition-colors duration-300 cursor-default"> {/* Used font-heading */}
                      {currentReview.name}
                    </h4>
                    <p className="text-green-500 font-body hover:text-green-400 transition-colors duration-300 cursor-default"> {/* Used font-body */}
                      {currentReview.role}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Navigation Dots */}
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
                aria-label={`Show testimonial ${index + 1}`} // Added for accessibility
              />
            ))}
          </div>
        </div>

        {/* Enhanced Stats Section */}
        <div className={`mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 transform transition-all duration-1000 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-heading font-bold text-green-500 mb-2 group-hover:animate-pulse">98%</div> {/* Used font-heading */}
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300">Satisfaction Rate</div> {/* Used font-body */}
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-heading font-bold text-orange-500 mb-2 group-hover:animate-pulse">500+</div> {/* Used font-heading */}
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300">Success Stories</div> {/* Used font-body */}
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-heading font-bold text-green-500 mb-2 group-hover:animate-pulse">4.9★</div> {/* Used font-heading */}
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300">Average Rating</div> {/* Used font-body */}
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-3xl md:text-4xl font-heading font-bold text-orange-500 mb-2 group-hover:animate-pulse">100%</div> {/* Used font-heading */}
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300">Recommended</div> {/* Used font-body */}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;