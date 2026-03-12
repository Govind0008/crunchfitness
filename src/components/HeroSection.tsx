import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Animates a number from 0 → target when `active` becomes true
const useCounter = (target: number, duration = 1400, active = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const totalFrames = Math.round(duration / 16);
    const timer = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      // Ease-out curve
      setCount(Math.min(Math.round(target * (1 - Math.pow(1 - progress, 3))), target));
      if (frame >= totalFrames) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
};

const stats = [
  { suffix: '+',  target: 500, label: 'Happy Members',   color: 'text-green-400'  },
  { suffix: '/7', target: 24,  label: 'Support',          color: 'text-orange-400' },
  { suffix: '+',  target: 10,  label: 'Expert Trainers',  color: 'text-green-400'  },
  { suffix: '★',  target: 5,   label: 'Top Rated Gym',    color: 'text-orange-400' },
];

const StatCard = ({ stat, active }: { stat: typeof stats[0]; active: boolean }) => {
  const count = useCounter(stat.target, 1400, active);
  return (
    <div className="text-center group cursor-default">
      <div className={`text-3xl md:text-4xl font-heading font-bold mb-2 transition-colors duration-300 ${stat.color} group-hover:brightness-125`}>
        {count}{stat.suffix}
      </div>
      <div className="text-gray-400 text-sm sm:text-base font-body group-hover:text-white transition-colors duration-300">
        {stat.label}
      </div>
    </div>
  );
};

const HeroSection = () => {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">

      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="/lovable-uploads/gym.JPG"
          alt="Modern gym interior at Crunch Fitness Club"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/80" />
      </div>

      {/* Subtle ambient blobs — reduced to prevent CPU waste */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-heading font-black mb-6 animate-fade-in-up">
          <span className="block text-white">TRANSFORM</span>
          <span className="block text-green-500">YOUR</span>
          <span className="block text-white">STRENGTH</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-body font-light text-gray-300 mb-8 animate-fade-in-up px-4 max-w-3xl mx-auto">
          Welcome to <strong className="text-green-400">CRUNCH FITNESS CLUB</strong> — Your Premier Gym in Pune (Wakad) for Achieving Peak Performance.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up px-4 mb-16">
          <button
            onClick={() => navigate('/plans')}
            className="group relative px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-black font-bold text-base sm:text-lg rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-green-500/40 hover:-translate-y-1 w-full sm:w-auto"
          >
            <span className="relative z-10 font-heading flex items-center justify-center gap-2">
              START YOUR JOURNEY
              <ChevronDown className="w-5 h-5 -rotate-90 group-hover:translate-x-1 transition-transform duration-300" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>

          <button
            onClick={() => navigate('/plans')}
            className="group px-8 py-4 border-2 border-orange-500 text-orange-400 font-bold text-base sm:text-lg rounded-xl hover:bg-orange-500 hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-1 relative overflow-hidden w-full sm:w-auto"
          >
            <span className="font-heading relative z-10">EXPLORE PLANS</span>
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        </div>

        {/* Stats — counter animates in on scroll */}
        <div
          ref={statsRef}
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10 px-4 transition-all duration-700 ${
            statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {stats.map((stat, i) => (
            <StatCard key={i} stat={stat} active={statsVisible} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
