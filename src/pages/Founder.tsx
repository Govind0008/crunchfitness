import { useEffect, useState, useRef, useCallback } from 'react';
import { Award, Dumbbell, Flame, Star, PlayCircle, BookOpen, Globe } from 'lucide-react';
import Footer from '../components/Footer';
import { Helmet } from 'react-helmet';

// --- Custom Hook for Scroll-Triggered Animations (No changes needed) ---
const useScrollAnimation = (): [
  Record<string, boolean>,
  (id: string) => (node: HTMLElement | null) => void
] => {
  const [elementsInView, setElementsInView] = useState<Record<string, boolean>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementsToObserve = useRef<Map<string, HTMLElement>>(new Map());

  const setRef = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node) {
        elementsToObserve.current.set(id, node);
        if (observerRef.current) {
          observerRef.current.observe(node);
        }
      } else {
        if (elementsToObserve.current.has(id) && observerRef.current) {
          observerRef.current.unobserve(elementsToObserve.current.get(id)!);
        }
        elementsToObserve.current.delete(id);
      }
    },
    []
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const animationId = (entry.target as HTMLElement).dataset.animationId;
          if (entry.isIntersecting) {
            setElementsInView((prev) => ({ ...prev, [animationId!]: true }));
            // Stop observing once element is in view to prevent re-animation on scroll
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' } // Trigger animation earlier
    );

    observerRef.current = observer;
    elementsToObserve.current.forEach((node) => {
      observer.observe(node);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [elementsInView, setRef];
};


const Founder = () => {
  const [inView, setRef] = useScrollAnimation();
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');

  // --- ADJUSTED: Founder's specific details and assets ---
  const founderVideoPath = "/lovable-uploads/nilima-mam-video.mp4";
  const founderImagePath = "/lovable-uploads/nilima mam.jpeg";
  const heroBackgroundImage = "/lovable-uploads/nilima-mam1.jpeg";

  const highlights = [
    { icon: <BookOpen className="w-8 h-8" />, label: "Certified Yoga Instructor", detail: "YOG VIDYA DHAM (2010)" },
    { icon: <BookOpen className="w-8 h-8" />, label: "Naturopathy Expert", detail: "YOG VIDYA DHAM" },
    { icon: <BookOpen className="w-8 h-8" />, label: "Power Yoga Certified", detail: "PARAM YOGA INSTITUTE (2013)" },
    { icon: <Dumbbell className="w-8 h-8" />, label: "Master Trainer", detail: "K11 Fitness Academy" },
    { icon: <Award className="w-8 h-8" />, label: "National Bench Press Gold", detail: "Bangalore Championship" },
    { icon: <Globe className="w-8 h-8" />, label: "Asia Pacific Bench Press Gold", detail: "Hong Kong 2023 Champion" },
    { icon: <Award className="w-8 h-8" />, label: "World Bench Press Silver", detail: "Austin, Texas" },
  ];

  const journeyEvents = [
    { 
      year: "2010", 
      title: "Journey Begins: Yoga & Naturopathy", 
      description: "Our founder embarked on her wellness journey, achieving **Yoga certification (YOG VIDYA DHAM)** and completing a **Naturopathy Course**, laying the foundation for a holistic approach to health.", 
      image: "/lovable-uploads/nilima-mam1.jpeg", 
      video: null, 
      imageAlt: "Founder meditating or performing a yoga pose, serene environment",
      imagePosition: "object-[center_20%]" // Face at top
    },
    { 
      year: "2013", 
      title: "Embracing Power Yoga", 
      description: "Deepening her expertise, she earned a **Power Yoga certification from PARAM YOGA INSTITUTE AUNDH PUNE**, integrating dynamic strength into her practice.", 
      image: "/lovable-uploads/nilima-mam2.jpeg", 
      video: null, 
      imageAlt: "Founder in a dynamic Power Yoga pose, showcasing strength",
      imagePosition: "object-[center_20%]" // Centered
    },
    { 
      year: "Early Career", 
      title: "Certified Master Trainer", 
      description: "Recognized for her profound knowledge and skills, she became a Certified MASTER TRAINER from K11 Fitness Academy, solidifying her role as a top-tier fitness professional.", 
      image: "/lovable-uploads/nilima-mam5.jpeg", 
      video: null, 
      imageAlt: "Founder in a professional training setting, guiding clients",
      imagePosition: "object-[center_20%]" // Custom position - center horizontally, 20% from top
    },
    { 
      year: "Competitive Ascent: National Gold", 
      title: "GOLD MEDAL IN NATIONAL BENCH PRESS", 
      description: "Her competitive spirit shone brightly as she secured a GOLD MEDAL IN NATIONAL BENCH PRESS CHAMPIONSHIP in Bangalore, marking her as a dominant force in powerlifting.", 
      image: "/lovable-uploads/nilima-mam4.jpeg", 
      video: null, 
      imageAlt: "Founder on a podium, holding a gold medal at a national championship",
      imagePosition: "object-[center_30%]" // Custom position - center horizontally, 30% from top
    },
    { 
      year: "2023", 
      title: "Asia Pacific Champion: GOLD!", 
      description: "Continuing her winning streak, she clinched the **GOLD MEDAL IN ASIA PACIFIC AFRICAN BENCH PRESS CHAMPIONSHIP in Hong Kong 2023**, demonstrating her international prowess.", 
      image: "/lovable-uploads/nilima-mam3.jpeg", 
      video: null, 
      imageAlt: "Founder winning gold at an international bench press championship", 
      isMainVideo: true,
      imagePosition: "object-[center_25%]" // Custom position - center horizontally, 15% from top
    },
    { 
      year: "Global Recognition: World Silver", 
      title: "SILVER MEDAL IN WORLD BENCH PRESS", 
      description: "Achieving global recognition, she earned a SILVER MEDAL IN WORLD BENCH PRESS CHAMPIONSHIP from Austin, Texas, solidifying her status among the world's elite.", 
      image: "/lovable-uploads/nilima-mam2.jpeg", 
      video: null, 
      imageAlt: "Founder proudly showing her silver medal at the World Bench Press Championship",
      imagePosition: "object-[center_25%]" // Custom position - center horizontally, 25% from top
    },
    { 
      year: "Present", 
      title: "Founding a Legacy: Crunch Fitness", 
      description: "Driven by a vision to share her passion and expertise, she founded Crunch Fitness, creating a thriving community dedicated to genuine transformation and holistic well-being.", 
      image: founderImagePath, 
      video: null, 
      imageAlt: "The founder standing confidently in her gym, Crunch Fitness", 
      isMainImage: true,
      imagePosition: "object-[center_45%]" 
    },
  ];

  const openVideoModal = useCallback((videoUrl) => {
    setCurrentVideoUrl(videoUrl);
    setIsVideoModalOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeVideoModal = useCallback(() => {
    setCurrentVideoUrl('');
    setIsVideoModalOpen(false);
    document.body.style.overflow = '';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Helmet>
        <title>Meet Nilima Patil: Founder of Crunch Fitness | Inspiring Journey</title>
        <meta name="description" content="Discover the inspiring journey of Nilima Patil, the multi-certified fitness expert and international medalist in powerlifting behind Crunch Fitness in Wakad, Pune. Explore her certifications, achievements, and dedication to holistic wellness." />
        <meta name="keywords" content="Nilima Patil, Crunch Fitness founder, gym owner Pune, Yoga certification, Naturopathy, Power Yoga, Master Trainer, K11 Fitness Academy, National Bench Press Gold, Asia Pacific Bench Press Gold, World Bench Press Silver, powerlifting champion, fitness coach Wakad" />
        <meta property="og:title" content="Meet Nilima Patil: Founder of Crunch Fitness | Inspiring Journey" />
        <meta property="og:description" content="Discover the inspiring journey of Nilima Patil, the multi-certified fitness expert and international medalist in powerlifting behind Crunch Fitness in Wakad, Pune." />
        <meta property="og:image" content={heroBackgroundImage} />
        <meta property="og:url" content="https://www.crunchfitness.fitness/founder" />
        <meta property="og:type" content="website" />
      </Helmet>


      {/* Hero Section - IMMERSIVE IMAGE BACKGROUND & TEXT REVEAL */}
      <section
        className="relative h-screen overflow-hidden flex items-center justify-center p-4 text-white"
        aria-labelledby="founder-hero-heading"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)), url('${heroBackgroundImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%', // Adjusted to show face better
        }}
      >
        <div
          ref={setRef('hero-section')}
          data-animation-id="hero-section"
          className={`relative z-20 text-center transition-all duration-1000 ${inView['hero-section'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <h1 id="founder-hero-heading" className="text-5xl md:text-7xl font-orbitron font-black mb-6">
            <span className="text-primary inline-block overflow-hidden">MEET</span>
            <br />
            <span className="neon-text inline-block overflow-hidden">NILIMA PATIL</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-200 font-rajdhani max-w-3xl mx-auto leading-relaxed mt-4">
            From acclaimed national and international champion to the visionary behind Crunch Fitness in Wakad, Pimpri-Chinchwad, Maharashtra, India — discover her inspiring journey of dedication, discipline, and triumph.
          </p>
        </div>
      </section>

      {/* Founder's Story & Image Section - ANIMATED ENTRANCE */}
      <section className="py-20 bg-background" aria-labelledby="founder-story-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div
            ref={setRef('founder-image')}
            data-animation-id="founder-image"
            className={`transition-all duration-1000 delay-200 ${inView['founder-image'] ? 'opacity-100 transform-none scale-100' : 'opacity-0 scale-90 translate-x-10'}`}
          >
            <img
              src={founderImagePath}
              alt="Nilima Patil, Founder of Crunch Fitness, a multi-medalist and certified trainer, standing confidently."
              className="rounded-2xl w-full shadow-2xl object-cover max-h-[500px] border border-border hover:border-primary transition-colors duration-300"
              style={{ objectPosition: 'center 10%' }}
              loading="lazy"
            />
          </div>

          <div
            ref={setRef('founder-story')}
            data-animation-id="founder-story"
            className={`transition-all duration-1000 delay-300 ${inView['founder-story'] ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}
          >
            <h2 id="founder-story-heading" className="text-4xl md:text-5xl font-orbitron font-bold mb-6">
              <span className="text-primary">HER</span> <span className="neon-text">STORY</span>
            </h2>
            <p className="text-muted-foreground font-rajdhani text-lg leading-relaxed mb-6">
              Nilima Patil is not just a gym owner, but a highly distinguished professional with a remarkable journey spanning Yoga, Naturopathy, Power Yoga, and advanced fitness training. She holds a Yoga certification (YOG VIDYA DHAM) and a Naturopathy Course diploma, bringing a truly holistic perspective to fitness.
            </p>
            <p className="text-muted-foreground font-rajdhani text-lg leading-relaxed mb-6">
              Her prowess extends to competitive sports, where she's a decorated powerlifter. She's earned a GOLD MEDAL IN NATIONAL BENCH PRESS CHAMPIONSHIP (Bangalore), a GOLD MEDAL IN ASIA PACIFIC AFRICAN BENCH PRESS CHAMPIONSHIP in Hong Kong 2023, and a SILVER MEDAL IN WORLD BENCH PRESS CHAMPIONSHIP from Austin, Texas.
            </p>
            <p className="text-muted-foreground font-rajdhani text-lg leading-relaxed">
              As a Certified MASTER TRAINER from K11 Fitness Academy, she combines academic knowledge with real-world championship experience. Her vision for Crunch Fitness is to empower every individual to achieve their highest potential, drawing from her diverse background and relentless pursuit of excellence.
            </p>
          </div>
        </div>
      </section>

      {/* Achievements Section - DYNAMIC GRID WITH GLOWS & ANIMATIONS */}
      <section className="py-20 bg-gray-50 dark:bg-zinc-900" aria-labelledby="achievements-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            id="achievements-heading"
            ref={setRef('achievements-title')}
            data-animation-id="achievements-title"
            className={`text-center text-4xl md:text-5xl font-extrabold text-zinc-800 dark:text-white mb-16 transition-opacity duration-700 ${inView['achievements-title'] ? 'opacity-100' : 'opacity-0'}`}
          >
            <span className="text-primary">HER</span> <span className="font-sans">DISTINCTIONS</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {highlights.map((item, index) => (
              <div
                key={index}
                ref={setRef(`highlight-${index}`)}
                data-animation-id={`highlight-${index}`}
                className={`transform transition-all duration-700 ease-out ${inView[`highlight-${index}`] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
                             bg-white dark:bg-zinc-850 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-700 p-6 flex flex-col items-center text-center
                             hover:shadow-xl hover:border-primary transition-all duration-300`}
              >
                <div className="inline-flex p-3 rounded-full bg-primary-600 text-primary-accent mb-4 shadow-md transition-shadow duration-300">
                  {item.icon}
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-zinc-800 dark:text-white mb-1">
                  {item.label}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm md:text-base font-normal">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder's Journey Timeline - VERTICAL TIMELINE WITH CUSTOM IMAGE POSITIONING */}
      <section className="py-20 bg-background relative overflow-hidden" aria-labelledby="journey-timeline-heading">
        <h2
          id="journey-timeline-heading"
          ref={setRef('journey-title')}
          data-animation-id="journey-title"
          className={`text-center text-4xl md:text-5xl font-orbitron font-bold mb-16 transition-opacity duration-700 ${inView['journey-title'] ? 'opacity-100' : 'opacity-0'}`}
        >
          <span className="neon-text">JOURNEY</span> THROUGH TIME
        </h2>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Vertical Timeline Line */}
          <div className="absolute left-1/2 -translate-x-1/2 w-1 bg-border h-full top-0 bottom-0 z-0"></div>

          {journeyEvents.map((event, index) => {
            const isEven = index % 2 === 0;

            return (
              <div
                key={index}
                ref={setRef(`journey-event-${index}`)}
                data-animation-id={`journey-event-${index}`}
                className={`relative mb-20 flex items-center w-full ${isEven ? 'justify-start' : 'justify-end'}`}
              >
                {/* Timeline Dot */}
                <div className={`absolute left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary z-10 border-2 border-background neon-glow ${inView[`journey-event-${index}`] ? 'scale-125' : 'scale-0'} transition-transform duration-500`}></div>

                <div
                  className={`w-full md:w-5/12 ${isEven ? 'md:pr-10' : 'md:pl-10'}
                   ${inView[`journey-event-${index}`] ? 'opacity-100 translate-x-0' : (isEven ? 'opacity-0 -translate-x-20' : 'opacity-0 translate-x-20')}
                   transition-all duration-700 ease-out`}
                  style={{ transitionDelay: `${(index + 1) * 100}ms` }}
                >
                  <div className="glass-morphism p-6 rounded-2xl shadow-2xl border border-border hover:border-primary transition-colors duration-300">
                    <div className="relative w-full mb-4 overflow-hidden rounded-lg">
                      {(event.image || event.isMainImage) && (
                        <img
                          src={event.isMainImage ? founderImagePath : event.image}
                          alt={event.imageAlt}
                          className="w-full h-48 object-cover shadow-lg border border-border"
                          style={{ objectPosition: event.imagePosition?.replace('object-[', '').replace(']', '') || 'center' }}
                          loading="lazy"
                        />
                      )}
                      {(event.video || event.isMainVideo) && (
                        <button
                          onClick={() => openVideoModal(event.isMainVideo ? founderVideoPath : event.video)}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-5xl md:text-6xl opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg"
                          aria-label={`Play video for ${event.title}`}
                        >
                          <PlayCircle className="w-16 h-16 neon-text" />
                        </button>
                      )}
                    </div>
                    <span className="text-primary text-2xl md:text-3xl font-orbitron font-bold mb-2 block">{event.year}</span>
                    <h3 className="text-xl md:text-2xl font-orbitron font-bold text-foreground mb-2 leading-tight">{event.title}</h3>
                    <p className="text-muted-foreground font-rajdhani text-base md:text-lg leading-relaxed">{event.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background bg-opacity-75 p-4 animate-fade-in">
          <div className="relative w-full max-w-[400px] bg-card rounded-lg shadow-2xl">
            <button
              onClick={closeVideoModal}
              className="absolute -top-10 right-0 text-foreground text-4xl font-bold p-2 hover:text-primary transition-colors z-50"
              aria-label="Close video"
            >
              &times;
            </button>
            <div className="relative" style={{ paddingTop: '177.77%' }}>
              <video
                src={currentVideoUrl}
                controls
                autoPlay
                className="absolute inset-0 w-full h-full rounded-lg object-contain"
                onEnded={closeVideoModal}
                aria-label="Founder's journey video playback"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      )}
      <Footer />  
    </div>
  );
};

export default Founder;