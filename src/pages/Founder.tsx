import { useEffect, useState } from 'react';
import { Award, Dumbbell, BookOpen, Globe, PlayCircle } from 'lucide-react';
import Footer from '../components/Footer';
import Seo from '@/components/site/Seo';
import { Section, SectionHeader } from '@/components/site/Section';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import CtaBand from '@/components/site/CtaBand';

// Timeline copy uses **bold** markers — render them as <strong> instead of literal asterisks
const RichText = ({ text }: { text: string }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong> : part,
    )}
  </>
);

const Founder = () => {
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState(false);

  const founderVideoPath = "/lovable-uploads/nilima-mam-video.mp4";
  const founderImagePath = "/lovable-uploads/nilima mam.jpeg";
  const heroBackgroundImage = "/lovable-uploads/nilima-mam1.jpeg";

  // Only offer playback if the video file is actually deployed
  useEffect(() => {
    fetch(founderVideoPath, { method: 'HEAD' })
      .then((r) => setVideoAvailable(r.ok && (r.headers.get('content-type') ?? '').startsWith('video')))
      .catch(() => setVideoAvailable(false));
  }, []);

  const highlights = [
    { icon: <BookOpen className="h-5 w-5" />, label: "Certified Yoga Instructor", detail: "YOG VIDYA DHAM (2010)" },
    { icon: <BookOpen className="h-5 w-5" />, label: "Naturopathy Expert", detail: "YOG VIDYA DHAM" },
    { icon: <BookOpen className="h-5 w-5" />, label: "Power Yoga Certified", detail: "PARAM YOGA INSTITUTE (2013)" },
    { icon: <Dumbbell className="h-5 w-5" />, label: "Master Trainer", detail: "K11 Fitness Academy" },
    { icon: <Award className="h-5 w-5" />, label: "National Bench Press Gold", detail: "Bangalore Championship" },
    { icon: <Globe className="h-5 w-5" />, label: "Asia Pacific Bench Press Gold", detail: "Hong Kong 2023 Champion" },
    { icon: <Award className="h-5 w-5" />, label: "World Bench Press Silver", detail: "Austin, Texas" },
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

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Seo
        title="Meet Nilima Patil: Founder of Crunch Fitness | Inspiring Journey"
        description="Discover the inspiring journey of Nilima Patil, the multi-certified fitness expert and international medalist in powerlifting behind Crunch Fitness in Wakad, Pune."
        image="/images/founder-900.webp"
      />

      <main>
        {/* Hero */}
        <header className="relative overflow-hidden border-b border-white/[0.06]" aria-labelledby="founder-hero-heading">
          <div className="container grid items-end gap-10 pt-12 lg:grid-cols-12 lg:gap-12 lg:pt-20">
            <div className="pb-4 lg:col-span-7 lg:pb-20 animate-fade-up">
              <p className="eyebrow mb-5">Our founder</p>
              <h1 id="founder-hero-heading" className="font-display text-display-xl font-extrabold uppercase text-white">
                Meet <span className="text-brand-400">Nilima Patil</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-300 md:text-lg">
                From acclaimed national and international champion to the visionary behind Crunch Fitness in Wakad,
                Pimpri-Chinchwad — a journey of dedication, discipline and triumph.
              </p>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/10 pt-6">
                {[
                  ['Gold', 'Asia Pacific bench press'],
                  ['Silver', 'World bench press'],
                  ['2010', 'Certified since'],
                ].map(([v, l]) => (
                  <div key={l} className="flex flex-col-reverse">
                    <dt className="mt-1 text-xs text-ink-400 sm:text-sm">{l}</dt>
                    <dd className="font-display text-3xl font-bold text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative lg:col-span-5">
              <img
                src={heroBackgroundImage}
                alt="Nilima Patil with her championship medals"
                className="mx-auto aspect-[4/5] w-full max-w-md rounded-t-2xl object-cover object-[center_20%] animate-image-in lg:max-w-none"
              />
            </div>
          </div>
        </header>

        {/* Story */}
        <Section aria-labelledby="founder-story-heading">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <img
              src="/images/founder-900.webp"
              alt="Nilima Patil, Founder of Crunch Fitness, a multi-medalist and certified trainer, standing confidently."
              className="aspect-[4/5] w-full rounded-2xl object-cover object-[center_10%]"
              loading="lazy"
            />
            <div>
              <p className="eyebrow mb-4">Her story</p>
              <h2 id="founder-story-heading" className="font-display text-display-md font-bold uppercase text-white text-balance">
                A champion who coaches
              </h2>
              <div className="mt-6 space-y-5 leading-relaxed text-ink-300 md:text-lg">
                <p>
                  Nilima Patil is not just a gym owner, but a highly distinguished professional with a remarkable journey spanning
                  Yoga, Naturopathy, Power Yoga and advanced fitness training. She holds a Yoga certification (YOG VIDYA DHAM) and a
                  Naturopathy diploma, bringing a truly holistic perspective to fitness.
                </p>
                <p>
                  She&apos;s also a decorated powerlifter: <strong className="font-semibold text-white">gold</strong> at the National Bench Press
                  Championship (Bangalore), <strong className="font-semibold text-white">gold</strong> at the Asia Pacific African Bench Press
                  Championship in Hong Kong 2023, and <strong className="font-semibold text-white">silver</strong> at the World Bench Press
                  Championship in Austin, Texas.
                </p>
                <p>
                  As a Certified Master Trainer from K11 Fitness Academy, she combines academic knowledge with real-world championship
                  experience — and built Crunch Fitness to help every member reach their highest potential.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Distinctions */}
        <Section tone="raised" aria-labelledby="achievements-heading">
          <SectionHeader id="achievements-heading" eyebrow="Credentials" title="Her distinctions" />
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item, i) => (
              <li key={item.label} className="stagger flex gap-4 bg-ink-900 p-6" style={{ '--i': i } as React.CSSProperties}>
                <span className="mt-0.5 text-brand-400" aria-hidden>{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-white">{item.label}</h3>
                  <p className="mt-1 text-sm text-ink-400">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* Timeline */}
        <Section aria-labelledby="journey-timeline-heading">
          <SectionHeader id="journey-timeline-heading" eyebrow="Timeline" title="Journey through time" />
          <ol className="relative mx-auto max-w-5xl">
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-white/10" aria-hidden />
            {journeyEvents.map((event) => (
              <li key={event.title} className="relative pb-14 pl-10 last:pb-0 md:pl-14">
                <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-[3px] border-ink-950 bg-brand-400" aria-hidden />
                <TimelineCard
                  event={event}
                  image={event.isMainImage ? founderImagePath : event.image}
                  onPlay={event.isMainVideo && videoAvailable ? () => setVideoOpen(true) : undefined}
                />
              </li>
            ))}
          </ol>
        </Section>

        <CtaBand title="Train where champions coach" body="Book a free tour of the gym Nilima built — and see how her approach shapes every session." />
      </main>

      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent className="max-w-sm overflow-hidden p-0">
          <DialogTitle className="sr-only">Founder&apos;s journey video</DialogTitle>
          <video src={founderVideoPath} controls autoPlay className="aspect-[9/16] w-full bg-black object-contain" onEnded={() => setVideoOpen(false)} />
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

interface TimelineEvent {
  year: string;
  title: string;
  description: string;
  imageAlt: string;
  imagePosition?: string;
}

const TimelineCard = ({ event, image, onPlay }: {
  event: TimelineEvent; image: string; onPlay?: () => void;
}) => (
  <div className="grid gap-5 md:grid-cols-[1fr_16rem] md:gap-10 lg:grid-cols-[1fr_20rem] animate-fade-up">
    <div>
      <p className="font-display text-lg font-bold uppercase text-brand-400">{event.year}</p>
      <h3 className="mt-1 font-display text-2xl font-bold uppercase leading-tight text-white md:text-3xl">{event.title}</h3>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-400"><RichText text={event.description} /></p>
    </div>
    <div className="relative overflow-hidden rounded-xl bg-ink-900">
      <img
        src={image}
        alt={event.imageAlt}
        loading="lazy"
        className="aspect-[4/3] w-full object-cover"
        style={{ objectPosition: event.imagePosition?.replace('object-[', '').replace(']', '').replace('_', ' ') || 'center' }}
      />
      {onPlay && (
        <button
          type="button"
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-ink-950/40 text-white transition-colors hover:bg-ink-950/60"
          aria-label={`Play video for ${event.title}`}
        >
          <PlayCircle className="h-14 w-14" />
        </button>
      )}
    </div>
  </div>
);

export default Founder;
