import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

const galleryImages = [
  { id: 1, src: "/lovable-uploads/training-main-1.jpeg", alt: "State-of-the-art gym equipment at Crunch Fitness Club, Wakad, Pune",     category: "Equipment" },
  { id: 2, src: "/lovable-uploads/cardio-2.jpeg",        alt: "Spacious cardio training area at Crunch Fitness Club",                   category: "Cardio"    },
  { id: 3, src: "/lovable-uploads/training-3.jpeg",      alt: "Personal training session with a certified trainer at Crunch Fitness",   category: "Training"  },
  { id: 4, src: "/lovable-uploads/training-2.jpeg",      alt: "Dedicated weight training zone with free weights in Pune gym",           category: "Weights"   },
  { id: 5, src: "https://images.unsplash.com/photo-1506629905607-b9f96c504ce0?auto=format&fit=crop&w=800&q=75", alt: "Energetic group fitness class at Crunch Fitness Club, Wakad", category: "Classes"   },
  { id: 6, src: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=75", alt: "Recovery and wellness area for post-workout therapy at Crunch Fitness", category: "Recovery" },
];
   
const categories = ["All", "Equipment", "Cardio", "Training", "Weights", "Classes", "Recovery"];

// Simple image card with loading skeleton
const GalleryCard = ({ image, onClick }: { image: typeof galleryImages[0]; onClick: () => void }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl cursor-pointer border border-gray-800 hover:border-green-400/60 transition-all duration-300"
      onClick={onClick}
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-gray-900">
        {/* Skeleton shown until image loads */}
        {!loaded && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse rounded-2xl" />
        )}

        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between">
            <div>
              <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">{image.category}</span>
            </div>
            <ZoomIn className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
};

const GallerySection = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = activeCategory === "All"
    ? galleryImages
    : galleryImages.filter((img) => img.category === activeCategory);

  const selectedAlt = galleryImages.find((img) => img.src === selectedImage)?.alt ?? 'Crunch Fitness facility';

  return (
    <section id="gallery" className="py-20 bg-black relative overflow-hidden">

      {/* Subtle ambient */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/3 left-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-green-400/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-5xl md:text-6xl font-heading font-black mb-6">
            <span className="text-white">EXPLORE OUR</span>
            <br />
            <span className="neon-text">STATE-OF-THE-ART FACILITY</span>
          </h2>
          <p className="text-xl text-gray-300 font-body max-w-2xl mx-auto">
            Take a visual journey through Crunch Fitness Club in Wakad, Pune — modern equipment, dynamic classes, and dedicated training zones.
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-semibold font-body transition-all duration-300 hover:scale-105 ${
                activeCategory === cat
                  ? 'bg-green-400 text-black shadow-lg shadow-green-400/20'
                  : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((image) => (
            <GalleryCard
              key={image.id}
              image={image}
              onClick={() => setSelectedImage(image.src)}
            />
          ))}
        </div>
      </div>

      {/* Lightbox modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/92 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-green-400 transition-colors duration-300"
              aria-label="Close image"
            >
              <X size={30} />
            </button>
            <img
              src={selectedImage}
              alt={selectedAlt}
              className="max-w-full max-h-[85vh] rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default GallerySection;
