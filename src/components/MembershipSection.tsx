import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section, SectionHeader } from '@/components/site/Section';
import PlanCard from '@/components/site/PlanCard';
import { usePlans } from '@/hooks/usePlans';

const MembershipSection = () => {
  const { plans } = usePlans();

  return (
    <Section id="membership" tone="raised" aria-labelledby="membership-heading">
      <SectionHeader
        id="membership-heading"
        eyebrow="Membership"
        title={<>Plans that fit <span className="text-brand-400">your pace</span></>}
        lede="Every plan includes the full gym floor, coach guidance and a free facility tour. Commit longer, save more."
        action={
          <Link
            to="/plans"
            className="link-drive inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400 transition-colors"
          >
            Compare all benefits <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      {/* Horizontal snap row below xl; five-column grid on wide screens */}
      <div
        className="-mx-5 sm:-mx-6 lg:-mx-8 xl:mx-0 overflow-x-auto xl:overflow-visible snap-x snap-mandatory hide-scrollbar scroll-px-5 sm:scroll-px-6"
        tabIndex={0}
        role="region"
        aria-label="Membership plans — scroll horizontally"
      >
        <div className="flex gap-4 px-5 sm:px-6 lg:px-8 pb-4 pt-3 xl:grid xl:grid-cols-5 xl:px-0">
          {/* Plates onto the bar: cards rack in horizontally, one after another */}
          {plans.map((plan, i) => (
            <div
              key={plan.id}
              className="m-rack w-[82vw] max-w-[320px] shrink-0 snap-start xl:w-auto xl:max-w-none"
              style={{ '--i': i, '--d': 200 } as React.CSSProperties}
            >
              <PlanCard plan={plan} maxFeatures={4} level={i} levels={plans.length} className="h-full" />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
};

export default MembershipSection;
