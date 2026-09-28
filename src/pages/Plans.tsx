import { Clock, ShieldCheck, Dumbbell } from 'lucide-react';
import Footer from '../components/Footer';
import { PageHeader, Section, SectionHeader } from '@/components/site/Section';
import MembershipFinder from '@/components/site/MembershipFinder';
import PlanCard from '@/components/site/PlanCard';
import CtaBand from '@/components/site/CtaBand';
import { usePlans } from '@/hooks/usePlans';
import Seo from '@/components/site/Seo';

const INCLUDED = [
  {
    icon: ShieldCheck,
    title: 'Expert guidance',
    body: 'Certified trainers with years of experience to guide your fitness journey safely and effectively.',
  },
  {
    icon: Dumbbell,
    title: 'Modern equipment',
    body: 'State-of-the-art fitness equipment and facilities designed for the optimal workout experience.',
  },
  {
    icon: Clock,
    title: 'Flexible hours',
    body: 'Open early morning to late evening, fitting perfectly into your busy schedule.',
  },
];

const ProfessionalPlans = () => {
  const { plans, loading } = usePlans();

  return (
    <div className="min-h-screen">
      <Seo title="Membership Plans | Crunch Fitness Club, Wakad, Pune" description="Compare Crunch Fitness Club memberships — from a one-day trial to a full year. Every plan includes the full gym floor, coach guidance and a free facility tour." image="/images/floor-2-1600.webp" />
      <main>
        <PageHeader
          eyebrow="Membership plans"
          title={<>Choose your <span className="text-brand-400">commitment</span></>}
          lede="Flexible plans for every goal — from a single trial day to a full year. Longer plans unlock more coaching and bigger savings."
          image={{ src: '/images/floor-2-1600.webp', srcSet: '/images/floor-2-800.webp 800w, /images/floor-2-1600.webp 1600w', alt: '' }}
        />

        <Section aria-labelledby="plans-heading" className="pt-12 md:pt-16">
          <div className="m-rise mb-16 md:mb-20"><MembershipFinder plans={plans} /></div>
          <h2 id="plans-heading" className="mb-8 font-display text-display-sm font-bold uppercase text-white"><span id="all-plans" />All plans</h2>
          <div
            className="flex flex-wrap justify-center gap-5 [&>*]:w-full sm:[&>*]:w-[calc(50%-0.625rem)] lg:[&>*]:w-[calc(33.333%-0.834rem)]"
            aria-busy={loading}
          >
            {plans.map((plan, i) => (
              <div key={plan.id} className="m-rise" style={{ '--i': i } as React.CSSProperties}>
                <PlanCard plan={plan} level={i} levels={plans.length} className="h-full" />
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-ink-400">
            Choosing a plan sends your enquiry to our team — no payment is taken online.
          </p>
        </Section>

        <Section tone="raised" aria-labelledby="included-heading">
          <SectionHeader
            id="included-heading"
            eyebrow="In every plan"
            title="Why train at Crunch"
            lede="Whichever plan you pick, you get the same floor, the same coaches and the same standards."
          />
          <ul className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
            {INCLUDED.map((item, i) => (
              <li key={item.title} className="stagger bg-ink-900 p-8" style={{ '--i': i } as React.CSSProperties}>
                <item.icon className="h-6 w-6 text-brand-400" aria-hidden />
                <h3 className="mt-5 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <CtaBand
          title="Not sure which plan?"
          body="Book a free tour and talk to a coach. We’ll look at your goals and schedule and recommend the right fit — no pressure."
        />
      </main>
      <Footer />
    </div>
  );
};

export default ProfessionalPlans;
