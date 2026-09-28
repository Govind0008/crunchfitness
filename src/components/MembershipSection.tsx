import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section, SectionHeader } from '@/components/site/Section';
import PlanCard, { PlateStack } from '@/components/site/PlanCard';
import { Hud } from '@/components/motion';
import { usePlans } from '@/hooks/usePlans';
import { cn } from '@/lib/utils';

/**
 * COMMIT — plans as a commitment timeline. One bar runs under the whole row; each plan racks
 * its own plates onto it (one more, and heavier, per step of length). Prices, features and
 * badges are the live Firestore plans, untouched.
 */
const MembershipSection = () => {
  const { plans } = usePlans();

  return (
    <Section id="membership" tone="raised" aria-labelledby="membership-heading">
      <Hud index="04" label="Commit" className="m-rise mb-6" />
      <SectionHeader
        id="membership-heading"
        title={<>Choose your <span className="text-brand-400">commitment</span></>}
        lede="Every plan includes the full gym floor, coach guidance and a free facility tour."
        action={
          <Link
            to="/plans"
            className="link-drive inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-brand-400 transition-colors"
          >
            Compare all benefits <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      {/* Horizontal snap row below xl; five columns on wide screens */}
      <div
        className="-mx-5 sm:-mx-6 lg:-mx-8 xl:mx-0 overflow-x-auto xl:overflow-visible snap-x snap-mandatory hide-scrollbar scroll-px-5 sm:scroll-px-6"
        tabIndex={0}
        role="region"
        aria-label="Membership plans — scroll horizontally"
      >
        <ol className="flex gap-4 px-5 sm:px-6 lg:px-8 pb-4 xl:grid xl:grid-cols-5 xl:px-0">
          {plans.map((plan, i) => (
            <li
              key={plan.id}
              className="group/slot w-[82vw] max-w-[320px] shrink-0 snap-start xl:w-auto xl:max-w-none"
            >
              {/* The bar: a continuous line through every slot, loaded plate by plate */}
              <div className="relative mb-4 flex h-12 items-center gap-3" aria-hidden>
                <span
                  className={cn('m-fill-x absolute top-1/2 h-[3px] -translate-y-1/2 bg-white/15', i === plans.length - 1 ? 'inset-x-0' : 'left-0 -right-4')}
                  style={{ '--d': 100 + i * 80 } as React.CSSProperties}
                />
                {i === 0 && <span className="relative h-5 w-1.5 rounded-sm bg-white/40" />}
                <PlateStack level={i} featured={!!plan.isPopular} className="relative h-full" />
                <span className={cn('hud relative bg-ink-900 pr-2', plan.isPopular ? 'text-brand-400' : 'text-white/70')}>
                  {plan.duration}
                </span>
              </div>
              <div className="m-rack" style={{ '--i': i, '--d': 200 } as React.CSSProperties}>
                <PlanCard plan={plan} maxFeatures={4} className="h-full" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
};

export default MembershipSection;
