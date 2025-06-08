import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

const GallerySection = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Placeholder images - these would be replaced with actual gym photos
  const galleryImages = [
    {
      id: 1,
      src: "/lovable-uploads/training-main-1.jpeg",
      // Enhanced alt text for SEO
      alt: "State-of-the-art gym equipment at Crunch Fitness Club, Wakad, Pune",
      category: "Equipment"
    },
    {
      id: 2,
      src: "/lovable-uploads/cardio-2.jpeg",
      // Enhanced alt text for SEO
      alt: "Spacious cardio training area with treadmills and ellipticals at Crunch Fitness Club",
      category: "Cardio"
    },
    {
      id: 3,
      src: "/lovable-uploads/training-3.jpeg",
      // Enhanced alt text for SEO
      alt: "Personal training session in progress at Crunch Fitness Club with a certified trainer",
      category: "Training"
    },
    {
      id: 4,
      src: "/lovable-uploads/training-2.jpeg",
      // Enhanced alt text for SEO
      alt: "Dedicated weight training zone with free weights and strength machines in Pune gym",
      category: "Weights"
    },
    {
      id: 5,
      src: "https://images.unsplash.com/photo-1506629905607-b9f96c504ce0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      // Enhanced alt text for SEO
      alt: "Energetic group fitness class in session at Crunch Fitness Club, Wakad",
      category: "Classes"
    },
    {
      id: 6,
      src: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80",
      // Enhanced alt text for SEO
      alt: "Relaxing recovery and wellness area for post-workout therapy at Crunch Fitness Club",
      category: "Recovery"
    }
  ];

  const categories = ["All", "Equipment", "Cardio", "Training", "Weights", "Classes", "Recovery"];
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredImages = activeCategory === "All"
    ? galleryImages
    : galleryImages.filter(img => img.category === activeCategory);

  return (
    // Re-checked background image path: make sure "training-mai" is a full image path
    <section
      id="gallery"
      className="py-20 relative overflow-hidden
                 bg-cover bg-center bg-no-repeat bg-black" /* Added bg-black fallback */
      style={{ backgroundImage: 'url("https://www.crunchfitness.fit/images/gallery-background.jpg")' }} /* Placeholder for your actual background image URL */
    >
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Existing blur effects */}
        <div className="absolute top-1/3 left-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-green-400/5 rounded-full blur-3xl"></div>
        {/* New: Semi-transparent overlay for text readability */}
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header - SEO: Using h2 for a major section heading */}
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-heading font-black mb-6"> {/* Used font-heading */}
            <span className="text-white">EXPLORE OUR</span>
            <br />
            <span className="neon-text">STATE-OF-THE-ART FACILITY</span>
          </h2>
          <p className="text-xl text-gray-300 font-body max-w-2xl mx-auto"> {/* Used font-body */}
            Take a visual journey through Crunch Fitness Club in Wakad, Pune, showcasing our modern gym equipment, dynamic group classes, and dedicated training zones.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-3 rounded-full font-body font-semibold transition-all duration-300 transform hover:scale-105 ${ // Used font-body
                activeCategory === category
                  ? 'bg-green-400 text-black neon-glow'
                  : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 perspective-1000">
          {filteredImages.map((image, index) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-2xl transform transition-all duration-500 hover:scale-105 hover:-rotate-1 cursor-pointer"
              onClick={() => setSelectedImage(image.src)}
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl glass-morphism border border-gray-800 group-hover:border-green-400 transition-all duration-300">
                <img
                  src={image.src}
                  alt={image.alt} 
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-heading font-bold text-lg mb-1"> {/* Used font-heading */}
                          {image.alt} {/* Displaying alt text as title is good for accessibility and content */}
                        </h3>
                        <span className="text-green-400 font-body text-sm"> {/* Used font-body */}
                          {image.category}
                        </span>
                      </div>
                      <ZoomIn className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                </div>

                {/* Hover Glow Effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none neon-glow"></div>
              </div>

              {/* 3D Card Effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-green-400 transition-colors duration-300"
            >
              <X size={32} />
            </button>
            <img
              src={selectedImage}
              // IMPORTANT: Add a relevant alt text here too for the modal image
              alt={`Expanded view of gym image: ${galleryImages.find(img => img.src === selectedImage)?.alt || 'Crunch Fitness Club facility'}`}
              className="max-w-full max-h-full rounded-2xl"
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default GallerySection;