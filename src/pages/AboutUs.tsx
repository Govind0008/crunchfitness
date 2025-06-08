import { useState, useEffect } from 'react';
import { Users, Target, Award, Zap } from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const AboutUs = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // This useEffect is for the initial fade-in animation of the sections
    setIsVisible(true);
  }, []);

  const stats = [
    { icon: <Users className="w-8 h-8" />, number: "500+", label: "Active Members" },
    { icon: <Target className="w-8 h-8" />, number: "5", label: "Years Experience" },
    { icon: <Award className="w-8 h-8" />, number: "10+", label: "Certified Trainers" },
    { icon: <Zap className="w-8 h-8" />, number: "24/7", label: "Access Available" }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* SEO: Primary H1 for the page, including brand and location keywords */}
            <h1 className="text-5xl md:text-7xl font-heading font-black mb-6"> {/* Changed font-orbitron to font-heading */}
              <span className="text-white">ABOUT</span>
              <br />
              <span className="neon-text">CRUNCH FITNESS CLUB PUNE</span> {/* More explicit name + location */}
            </h1>
            {/* SEO: Detailed description with keywords */}
            <p className="text-xl text-gray-400 font-body max-w-3xl mx-auto leading-relaxed"> {/* Changed font-rajdhani to font-body */}
              At Crunch Fitness Club in Wakad, Pune, we are more than just a gym. We're a vibrant community dedicated to transforming lives through
              cutting-edge fitness technology, state-of-the-art gym equipment, and personalized training programs. Discover why we are the best gym in Maharashtra for achieving your health goals.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`text-center transform transition-all duration-700 delay-${index * 100} ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
              >
                <div className="inline-flex p-4 rounded-xl bg-green-400/10 text-green-400 mb-4 neon-glow">
                  {stat.icon}
                </div>
                {/* SEO: Using h3 for sub-sections within the page */}
                <h3 className="text-3xl md:text-4xl font-heading font-bold text-white mb-2"> {/* Changed font-orbitron to font-heading */}
                  {stat.number}
                </h3>
                <p className="text-gray-400 font-body text-lg">{stat.label}</p> {/* Changed font-rajdhani to font-body */}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
              {/* SEO: H2 for the mission statement */}
              <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6"> {/* Changed font-orbitron to font-heading */}
                <span className="text-white">OUR</span> <span className="neon-text">MISSION</span>
              </h2>
              {/* SEO: Elaboration on mission with potential keywords */}
              <p className="text-gray-400 font-body text-lg leading-relaxed mb-6"> {/* Changed font-rajdhani to font-body */}
                Our mission at Crunch Fitness Club is to revolutionize the fitness industry in Pune. We strive to provide state-of-the-art gym equipment,
                expert guidance from certified personal trainers, and cultivate a supportive community that empowers individuals to achieve
                their health and fitness goals, whether it's strength training, weight loss, or improved well-being.
              </p>
              <p className="text-gray-400 font-body text-lg leading-relaxed"> {/* Changed font-rajdhani to font-body */}
                We passionately believe fitness is not just about physical transformation, but about building mental strength,
                confidence, and fostering lasting healthy habits that extend far beyond the gym walls, enriching lives in Maharashtra.
              </p>
            </div>

            {/* Video Player Section */}
            <div className={`relative transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <div className="w-full h-80 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-2xl glass-morphism flex items-center justify-center overflow-hidden">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  poster="/lovable-uploads/video_poster.jpg"
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  aria-label="Promotional video for Crunch Fitness Club" // Added aria-label for accessibility
                >
                  {/* Providing multiple sources for browser compatibility is good practice */}
                  {/* <source src="/lovable-uploads/crunch_info.webm" type="video/webm" /> */}
                  <source src="/lovable-uploads/crunch_info.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                {/* Optional overlay text */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <p className="text-white font-heading font-bold text-xl text-center z-10"> {/* Changed font-orbitron to font-heading */}
                        TRAIN HARD. LIVE STRONG.
                    </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutUs;