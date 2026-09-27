import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import { PageHeader, Section } from '@/components/site/Section';
import CtaBand from '@/components/site/CtaBand';
import { CountUp } from '@/components/motion';

const STATS = [
  { value: 500, suffix: '+', label: 'Active members' },
  { value: 5,   suffix: '',  label: 'Years in Wakad' },
  { value: 10,  suffix: '+', label: 'Certified trainers' },
  { value: 7,   suffix: '',  label: 'Days a week' },
];

const AboutUs = () => {
  const [videoError, setVideoError] = useState(false);

  return (
    <div className="min-h-screen">
      <main>
        {/* SEO: primary H1 with brand + location keywords */}
        <PageHeader
          eyebrow="About us"
          title={<>About Crunch Fitness Club <span className="text-brand-400">Pune</span></>}
          lede="At Crunch Fitness Club in Wakad, Pune, we are more than just a gym. We're a vibrant community dedicated to transforming lives through modern equipment, expert coaching and personalised training programmes."
          image={{ src: '/images/gym-wide-3-1600.webp', srcSet: '/images/gym-wide-3-800.webp 800w, /images/gym-wide-3-1600.webp 1600w', alt: '' }}
        />

        {/* Stats */}
        <section aria-label="Crunch Fitness in numbers" className="border-b border-white/[0.06]">
          <dl className="container grid grid-cols-2 md:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="flex flex-col-reverse border-white/[0.06] py-10 pr-4 md:py-14 [&:nth-child(odd)]:border-r [&:nth-child(even)]:pl-6 md:border-r md:last:border-r-0 md:px-8 md:first:pl-0 animate-fade-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <dt className="mt-2 text-sm text-ink-400">{s.label}</dt>
                <dd className="font-display text-5xl font-bold text-white md:text-6xl">
                  <CountUp value={s.value} suffix={s.suffix} delay={i * 120} duration={s.value > 20 ? 1400 : 900} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Mission */}
        <Section aria-labelledby="mission-heading">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="eyebrow mb-4">Our mission</p>
              <h2 id="mission-heading" className="font-display text-display-md font-bold uppercase text-white text-balance">
                Strength that goes beyond the gym walls
              </h2>
              <div className="mt-6 space-y-5 text-base leading-relaxed text-ink-300 md:text-lg">
                <p>
                  Our mission at Crunch Fitness Club is to raise the standard of fitness in Pune. We provide modern gym
                  equipment, expert guidance from certified personal trainers, and a supportive community that empowers
                  people to reach their goals — whether that&apos;s strength training, weight loss or better well-being.
                </p>
                <p>
                  We believe fitness is not just about physical transformation, but about building mental strength,
                  confidence and lasting healthy habits that enrich life well beyond the gym.
                </p>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
                <Link to="/team" className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400 transition-colors">
                  Meet the team <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/founders" className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400 transition-colors">
                  Our founder&apos;s story <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-900">
              {!videoError ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  poster="/images/gym-wide-3-800.webp"
                  onError={() => setVideoError(true)}
                  className="absolute inset-0 h-full w-full object-cover"
                  aria-label="Promotional video for Crunch Fitness Club"
                >
                  <source src="/lovable-uploads/crunch_info.mp4" type="video/mp4" onError={() => setVideoError(true)} />
                </video>
              ) : (
                <img
                  src="/images/kettlebells-1000.webp"
                  alt="Crunch Fitness Club gym interior"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 to-transparent p-6 pt-16">
                <p className="font-display text-2xl font-bold uppercase text-white">Train hard. Live strong.</p>
              </div>
            </div>
          </div>
        </Section>

        <CtaBand />
      </main>
      <Footer />
    </div>
  );
};

export default AboutUs;
