import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in-up');
          }
        });
      },
      { threshold: 0.1 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

  
  }, []);

  const handleStartJourney = () => {
    navigate('/plans');
  };

  const handleExplorePlans = () => {
    navigate('/plans');
  };

  const scrollToNext = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth'
    });
  };

  return (
    <section
      id="home"
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28"
    >
      
      <div className="absolute inset-0">
        <img
          src="/lovable-uploads/gym.JPG"

          alt="Modern gym interior at Crunch Fitness Club with various exercise equipment and open space, symbolizing strength training."
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/80"></div>
      </div>


      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-48 sm:w-64 h-48 sm:h-64 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-24 sm:w-32 h-24 sm:h-32 bg-green-400/5 rounded-full blur-2xl animate-bounce"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
        <div ref={textRef} className="transform-gpu transition-transform duration-100 ease-out">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-heading font-black mb-4 sm:mb-6 animate-fade-in-up">
            <span className="block text-white hover:text-green-400 transition-colors duration-500 cursor-default">TRANSFORM</span>
            <span className="block text-green-500 font-bold hover:text-green-400 transition-colors duration-500 cursor-default">YOUR</span>
            <span className="block text-white hover:text-green-400 transition-colors duration-500 cursor-default">STRENGTH</span>
          </h1>

          {/* Subtitle - SEO: Reinforce brand name and offering, adjusted based on feedback */}
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-body font-light text-gray-300 mb-6 sm:mb-8 animate-fade-in-up animate-delay-200 hover:text-white transition-colors duration-300 px-4">
            Welcome to <strong className="text-green-500">CRUNCH FITNESS CLUB</strong> - Your Premier Gym in Pune (Wakad) for Achieving Peak Performance.
          </p>

          {/* Enhanced CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up animate-delay-400 px-4">
            <button
              onClick={handleStartJourney}
              className="group relative px-6 sm:px-8 lg:px-10 py-4 sm:py-5 bg-gradient-to-r from-green-500 to-green-600 text-black font-bold text-base sm:text-lg rounded-xl overflow-hidden transition-all duration-500 hover:scale-110 hover:shadow-2xl hover:shadow-green-500/40 transform hover:-translate-y-2 w-full sm:w-auto"
            >
              <span className="relative z-10 font-heading flex items-center justify-center space-x-2">
                <span>START YOUR JOURNEY</span>
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 rotate-[-90deg] group-hover:translate-x-2 transition-transform duration-300" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
            </button>

            <button
              onClick={handleExplorePlans}
              className="group px-6 sm:px-8 lg:px-10 py-4 sm:py-5 border-2 border-orange-500 text-orange-500 font-bold text-base sm:text-lg rounded-xl hover:bg-orange-500 hover:text-white transition-all duration-500 hover:scale-110 hover:shadow-2xl hover:shadow-orange-500/40 transform hover:-translate-y-2 relative overflow-hidden w-full sm:w-auto"
            >
              <span className="font-heading relative z-10">EXPLORE PLANS</span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
        </div>

        
        <div ref={statsRef} className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 animate-fade-in-up animate-delay-500 px-4">
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-green-500 mb-2 group-hover:text-green-400 transition-colors duration-300">500+</div>
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300 text-sm sm:text-base">Happy Members</div>
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-orange-500 mb-2 group-hover:text-orange-400 transition-colors duration-300">24/7</div>
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300 text-sm sm:text-base">Support</div> 
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-green-500 mb-2 group-hover:text-green-400 transition-colors duration-300">10+</div>
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300 text-sm sm:text-base">Expert Trainers</div>
          </div>
          <div className="text-center group cursor-pointer transform hover:scale-110 transition-all duration-300">
            <div className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-orange-500 mb-2 group-hover:text-orange-400 transition-colors duration-300">5★</div>
            <div className="text-gray-400 font-body group-hover:text-white transition-colors duration-300 text-sm sm:text-base">Top Rated Gym</div> 
          </div>
        </div>
      </div>

      
      
    </section>
  );
};

export default HeroSection;