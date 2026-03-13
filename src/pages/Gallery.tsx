import { useState, useEffect } from 'react';
import { ZoomIn, X, Trophy, Target, Users, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import { useScrollReveal } from '../hooks/useScrollReveal';

// ── Sub-component so useScrollReveal can be called per card ──────────────────
interface GalleryCardProps {
  image: { id: number; title: string; category: string; src: string };
  index: number;
  onSelect: (id: number) => void;
}

const GalleryCard: React.FC<GalleryCardProps> = ({ image, index, onSelect }) => {
  const ref = useScrollReveal<HTMLDivElement>();
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      ref={ref}
      className="reveal group relative h-64 rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-500"
      style={{ transitionDelay: `${(index % 4) * 60}ms` }}
      onClick={() => onSelect(image.id)}
    >
      {/* Skeleton shown until image loads */}
      {!loaded && (
        <div className="absolute inset-0 bg-zinc-800 animate-pulse rounded-2xl" />
      )}

      <img
        src={image.src}
        alt={image.title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4">
        <div className="text-center">
          <ZoomIn className="w-8 h-8 text-white mb-2 mx-auto" />
          <p className="text-white font-semibold font-body text-lg">{image.title}</p>
          <p className="text-green-400 text-sm font-body">{image.category}</p>
        </div>
      </div>

      <div className="absolute top-4 left-4">
        <span className="px-3 py-1 bg-green-400/90 text-black text-xs font-semibold rounded-full">
          {image.category}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const Gallery = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<number | string | null>(null);
  const [powerliftingHovered, setPowerliftingHovered] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const galleryImages = [
    { id: 1,  title: 'Modern Cardio Zone at Crunch Fitness Wakad',   category: 'Equipment',  src: '/lovable-uploads/cardio-1.jpeg' },
    { id: 2,  title: 'Strength Training Area with Free Weights',      category: 'Equipment',  src: '/lovable-uploads/training-3.jpeg' },
    { id: 3,  title: 'Spacious Group Fitness Studio for Classes',     category: 'Facilities', src: '/lovable-uploads/activity-1.png' },
    { id: 4,  title: 'Gym Floor Overview',                            category: 'Facilities', src: '/lovable-uploads/gym 4.jpeg' },
    { id: 5,  title: 'One-on-one Personal Training Session',          category: 'Training',   src: '/lovable-uploads/rohit.JPG' },
    { id: 6,  title: 'Zumba & Group Activities',                      category: 'Facilities', src: '/lovable-uploads/activity-2.jpeg' },
    { id: 7,  title: 'High-Intensity Cardio Training',                category: 'Equipment',  src: '/lovable-uploads/cardio-2.jpeg' },
    { id: 8,  title: 'One-on-one Personal Training Session',          category: 'Training',   src: '/lovable-uploads/ptrahul.jpeg' },
    { id: 9,  title: 'One-on-one Personal Training Session',          category: 'Training',   src: '/lovable-uploads/rohit1.JPG' },
    { id: 10, title: 'Personal Training in Action',                   category: 'Training',   src: '/lovable-uploads/maddypt.PNG' },
  ];

  const powerliftingImages = [
    { id: 'pl1', title: 'Professional Powerlifting Platform', src: '/lovable-uploads/squat.PNG' },
    { id: 'pl2', title: 'Olympic Standard Equipment Setup',   src: '/lovable-uploads/deadlift.PNG' },
  ];

  const powerliftingFeatures = [
    {
      icon: Trophy,
      title: 'Competition Standard',
      description: 'Olympic-grade platforms with calibrated plates and professional barbells',
    },
    {
      icon: Target,
      title: 'Expert Coaching',
      description: 'Certified powerlifting coaches to perfect your squat, bench, and deadlift',
    },
    {
      icon: Users,
      title: 'Community Hub',
      description: 'Join our powerlifting community and train with like-minded athletes',
    },
  ];

  const categories = ['All', 'Equipment', 'Facilities', 'Training'];

  const filteredImages =
    activeCategory === 'All'
      ? galleryImages
      : galleryImages.filter((img) => img.category === activeCategory);

  const allImages = [...galleryImages, ...powerliftingImages];

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Hero */}
      <section
        className="pt-28 pb-28 relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/lovable-uploads/training-main.jpeg")' }}
        aria-labelledby="gallery-hero-heading"
      >
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 id="gallery-hero-heading" className="text-5xl md:text-7xl font-bold font-heading mb-6">
              <span className="text-white">GALLERY &</span>
              <br />
              <span className="bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">EXPERIENCES</span>
            </h1>
            <p className="text-xl text-gray-300 font-body max-w-3xl mx-auto">
              Explore our state-of-the-art facilities, view gym photos, and witness the amazing member transformations happening every day at Crunch Fitness Club Wakad, Pune.
            </p>
          </div>
        </div>
      </section>

      {/* Powerlifting Showcase */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/3 w-72 h-72 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-full mb-4">
              <Trophy className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-semibold font-heading text-sm">FEATURED AREA</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold font-heading mb-6">
              <span className="text-white">POWERLIFTING</span>
              <br />
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">PARADISE</span>
            </h2>
            <p className="text-xl text-gray-300 font-body max-w-2xl mx-auto">
              Our crown jewel — a dedicated powerlifting area with competition-standard equipment
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {powerliftingImages.map((image, index) => (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer transition-all duration-700 ${
                      index === 0 ? 'col-span-2 h-80' : 'h-48'
                    } rounded-2xl overflow-hidden hover:scale-105`}
                    onMouseEnter={() => setPowerliftingHovered(true)}
                    onMouseLeave={() => setPowerliftingHovered(false)}
                    onClick={() => setSelectedImage(image.id)}
                  >
                    <img
                      src={image.src}
                      alt={image.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="text-center">
                        <ZoomIn className="w-8 h-8 text-white mb-2 mx-auto" />
                        <p className="text-white font-semibold">{image.title}</p>
                      </div>
                    </div>
                    <div className={`absolute inset-0 border-2 border-red-400 rounded-2xl transition-all duration-1000 ${
                      powerliftingHovered ? 'animate-pulse opacity-50' : 'opacity-0'
                    }`} />
                  </div>
                ))}
              </div>
              <div className="absolute -top-6 -right-6 bg-red-500 text-black px-4 py-2 rounded-full font-bold text-sm animate-bounce">
                🏆 Competition Ready
              </div>
            </div>

            <div className="space-y-8">
              {powerliftingFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className={`group p-6 rounded-2xl border transition-all duration-500 cursor-pointer ${
                      activeFeature === index
                        ? 'bg-red-500/10 border-red-500/50 scale-105'
                        : 'bg-gray-800/30 border-gray-700 hover:border-red-500/30'
                    }`}
                    onClick={() => setActiveFeature(index)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl transition-all duration-300 ${
                        activeFeature === index ? 'bg-red-500 text-black' : 'bg-gray-700 text-red-400'
                      }`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl font-bold font-heading mb-2 transition-colors duration-300 ${
                          activeFeature === index ? 'text-red-400' : 'text-white'
                        }`}>
                          {feature.title}
                        </h3>
                        <p className="text-gray-300 font-body leading-relaxed">{feature.description}</p>
                      </div>
                      <ArrowRight className={`w-5 h-5 transition-all duration-300 ${
                        activeFeature === index ? 'text-red-400 translate-x-1' : 'text-gray-500'
                      }`} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-6">
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                  <h4 className="text-xl font-bold font-heading text-red-400 mb-2">Hidden Gem of Our Gym</h4>
                  <p className="text-gray-300 font-body">
                    Most members don't know about our professional powerlifting area. Come explore and discover the difference competition-grade equipment makes!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="pb-10" aria-label="Image Categories Filter">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4" role="tablist">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-3 rounded-full font-semibold font-heading transition-all duration-300 ${
                  activeCategory === category
                    ? 'bg-green-400 text-black'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
                role="tab"
                aria-selected={activeCategory === category}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid — each card reveals on scroll with skeleton loader */}
      <section className="pb-20" aria-label="Image Gallery">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredImages.map((image, index) => (
              <GalleryCard
                key={image.id}
                image={image}
                index={index}
                onSelect={setSelectedImage}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox Modal */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-image-title"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedImage(null); }}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors duration-300 z-10"
              aria-label="Close image preview"
            >
              <X size={20} />
            </button>
            {(() => {
              const current = allImages.find((img) => img.id === selectedImage);
              return current ? (
                <>
                  <img
                    src={current.src}
                    alt={current.title}
                    className="max-w-full max-h-[80vh] object-contain mx-auto rounded-2xl shadow-xl"
                  />
                  <div className="text-center mt-4">
                    <h3 id="modal-image-title" className="text-2xl font-bold font-heading text-white mb-2">
                      {current.title}
                    </h3>
                    <p className="text-green-400 font-body">Click outside to close</p>
                  </div>
                </>
              ) : null;
            })()}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Gallery;
