import { useState, useEffect } from 'react';
import { ZoomIn, X } from 'lucide-react';
import Navigation from '../components/Navigation'; // Assuming path to Navigation
import Footer from '../components/Footer';     // Assuming path to Footer

const Gallery = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const galleryImages = [
    { id: 1, title: "Modern Cardio Zone at Crunch Fitness Wakad", category: "Equipment", src: "/lovable-uploads/cardio-1.jpeg" },
    { id: 2, title: "Strength Training Area with Free Weights", category: "Equipment", src: "/lovable-uploads/training-3.jpeg" },
    { id: 3, title: "Spacious Group Fitness Studio for Classes", category: "Facilities", src: "/lovable-uploads/activity-1.png" },
    { id: 4, title: "Happy Member's Fitness Success Story", category: "Members", src: "/lovable-uploads/gallery-4.jpg" },
    { id: 5, title: "One-on-one Personal Training Session", category: "Training", src: "/lovable-uploads/gallery-5.jpg" },
    { id: 6, title: "Serene Yoga & Meditation Space", category: "Facilities", src: "/lovable-uploads/activity-2.jpeg" },
    { id: 7, title: "High-Intensity CrossFit Training Area", category: "Equipment", src: "/lovable-uploads/cardio-2.jpeg" },
    { id: 8, title: "Incredible Fitness Transformation Results", category: "Members", src: "/lovable-uploads/gallery-8.jpg" }
  ];

  const categories = ["All", "Equipment", "Facilities", "Members", "Training"];
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredImages = activeCategory === "All"
    ? galleryImages
    : galleryImages.filter(img => img.category === activeCategory);

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      {/* Hero Section - Added background image and overlay */}
      <section
        className="pt-32 pb-20 relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/lovable-uploads/training-main.jpeg")' }}
        aria-labelledby="gallery-hero-heading" // SEO & Accessibility: Link to main heading
      >
        <div className="absolute inset-0">
          {/* Existing blur effects */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl animate-pulse"></div>
          {/* New: Semi-transparent overlay for text readability */}
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 id="gallery-hero-heading" className="text-5xl md:text-7xl font-orbitron font-black mb-6"> {/* SEO & Accessibility: Added ID */}
              <span className="text-white">GALLERY &</span>
              <br />
              <span className="neon-text">EXPERIENCES</span>
            </h1>
            <p className="text-xl text-gray-300 font-rajdhani max-w-3xl mx-auto">
              Explore our state-of-the-art facilities, view gym photos, and witness the amazing member transformations happening every day at Crunch Fitness Club Wakad, Pune.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="pb-10" aria-label="Image Categories Filter"> {/* Accessibility: Added label */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4" role="tablist"> {/* Accessibility: role="tablist" */}
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-3 rounded-full font-rajdhani font-semibold transition-all duration-300 ${
                  activeCategory === category
                    ? 'bg-green-400 text-black'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
                role="tab" // Accessibility: role="tab"
                aria-selected={activeCategory === category} // Accessibility: aria-selected
                aria-pressed={activeCategory === category} // Accessibility: aria-pressed
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="pb-20" aria-label="Image Gallery"> {/* Accessibility: Added label */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredImages.map((image, index) => (
              <div
                key={image.id}
                className={`group relative h-64 rounded-2xl overflow-hidden cursor-pointer transition-all duration-700 delay-${index * 50} transform hover:scale-105 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
              >
                {/* Image Background */}
                <img
                  src={image.src}
                  alt={image.title} // SEO & Accessibility: Updated alt text in galleryImages array
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
                />

                {/* Overlay for text and zoom icon */}
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-4"
                  onClick={() => setSelectedImage(image.id)} // Click to open modal
                  role="button" // Accessibility: Indicate it's clickable
                  aria-label={`View larger image of ${image.title}`} // Accessibility: Label for screen readers
                >
                  <div className="text-center">
                    <ZoomIn className="w-8 h-8 text-white mb-2 mx-auto" />
                    <p className="text-white font-rajdhani font-semibold text-lg">{image.title}</p>
                    <p className="text-green-400 font-rajdhani text-sm">{image.category}</p>
                  </div>
                </div>

                {/* Category Badge (optional, but good for quick info) */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-green-400/90 text-black text-xs font-rajdhani font-semibold rounded-full">
                    {image.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modal for Image Preview */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          role="dialog"        // Accessibility: Defines it as a dialog
          aria-modal="true"    // Accessibility: Indicates it's a modal dialog
          aria-labelledby="modal-image-title" // Accessibility: Link to image title in modal
          onClick={(e) => { // Close modal on backdrop click
            if (e.target === e.currentTarget) {
              setSelectedImage(null);
            }
          }}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors duration-300 z-10"
              aria-label="Close image preview" // Accessibility: Label for close button
            >
              <X size={20} />
            </button>

            {/* Display the actual image in the modal */}
            {galleryImages.find(img => img.id === selectedImage) && (
              <img
                src={galleryImages.find(img => img.id === selectedImage)?.src}
                alt={galleryImages.find(img => img.id === selectedImage)?.title}
                className="max-w-full max-h-[80vh] object-contain mx-auto rounded-2xl shadow-xl"
              />
            )}
            <div className="text-center mt-4">
                <h3 id="modal-image-title" className="text-2xl font-orbitron font-bold text-white mb-2"> {/* Accessibility: Added ID */}
                    {galleryImages.find(img => img.id === selectedImage)?.title}
                </h3>
                <p className="text-green-400 font-rajdhani">Click outside to close</p>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Gallery;