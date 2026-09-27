import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useScrollVar } from '@/hooks/useScrollVar';
import { ChapterMark } from '@/components/motion';
import { SITE, whatsappLink } from '@/lib/site';

interface CtaBandProps {
  title?: string;
  body?: string;
  /** Home page only: open with the "04 Join" chapter mark */
  chapter?: boolean;
}

/** Closing call to action used at the end of public pages. */
const CtaBand = ({
  title = 'Your first session starts here',
  body = 'Visit the gym, meet the coaches and get a free facility tour. We’ll help you pick the plan that fits your goal.',
  chapter = false,
}: CtaBandProps) => {
  const ref = useScrollReveal<HTMLDivElement>();
  const zoomRef = useScrollVar<HTMLDivElement>();
  const d = (ms: number) => ({ '--d': ms }) as React.CSSProperties;
  return (
    <section aria-labelledby="cta-heading" className="container py-section">
      {/* JOIN — the final set: a lime line draws across, the panel expands out of it, then the copy drives in */}
      <div ref={ref} className="reveal">
        {chapter && <ChapterMark index="04" word="Join" />}
        <div className="final-set relative overflow-hidden rounded-3xl bg-brand-400 px-6 py-14 text-ink-950 sm:px-12 md:py-20">
          <div ref={zoomRef} className="absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden lg:block [mask-image:linear-gradient(to_right,transparent,black_40%)]">
            <img
              src="/images/team-960.webp"
              srcSet="/images/team-960.webp 960w, /images/team-1920.webp 1920w"
              sizes="(min-width: 1024px) 50vw, 100vw"
              alt=""
              loading="lazy"
              className="scroll-zoom h-full w-full object-cover object-[center_35%] mix-blend-multiply opacity-60"
            />
          </div>
          <div className="relative max-w-xl">
            <h2 id="cta-heading" className="font-display text-display-lg font-extrabold uppercase text-balance">
              <span className="m-line"><span style={d(900)}>{title}</span></span>
            </h2>
            <p className="m-rise mt-5 text-base leading-relaxed text-ink-900/80 md:text-lg" style={d(1020)}>{body}</p>
            <div className="m-rise mt-9 flex flex-col gap-3 sm:flex-row" style={d(1120)}>
              <Button asChild size="lg" className="bg-ink-950 text-white hover:bg-ink-800">
                <Link to="/contact">
                  Book a free tour <ArrowRight className="transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-ink-950/30 text-ink-950 hover:border-ink-950 hover:bg-ink-950/5">
                <a href={whatsappLink('Hi! I want to know more about Crunch Fitness memberships and offers.')} target="_blank" rel="noopener noreferrer">
                  Message on WhatsApp
                </a>
              </Button>
            </div>
            <p className="m-rise mt-6 text-sm text-ink-900/70" style={d(1200)}>
              Or call <a href={SITE.phoneHref} className="font-semibold underline underline-offset-4">{SITE.phone}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CtaBand;
