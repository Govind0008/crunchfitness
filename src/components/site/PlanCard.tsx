import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Plan } from '@/hooks/usePlans';

interface PlanCardProps {
  plan: Plan;
  /** Limit the feature list (home page) — the Plans page shows everything */
  maxFeatures?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Position in the (duration-ordered) plan list — drives the commitment meter */
  level?: number;
  levels?: number;
}

const PlanCard = ({ plan, maxFeatures, className, style, level, levels }: PlanCardProps) => {
  const navigate = useNavigate();
  const featured = !!plan.isPopular;
  const features = maxFeatures ? plan.features.slice(0, maxFeatures) : plan.features;
  const hidden = plan.features.length - features.length;

  return (
    <article
      style={style}
      className={cn(
        // Physical hover: the card lifts off the rack, its shadow deepens, contents shift slightly
        'group/plan relative flex flex-col rounded-2xl border p-6 transition-[transform,box-shadow,border-color] duration-500 ease-out-expo',
        '[@media(hover:hover)]:hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.9)]',
        featured
          ? 'border-brand-400/60 bg-ink-850 shadow-[0_0_0_1px_rgba(176,212,63,0.15),0_24px_60px_-30px_rgba(176,212,63,0.35)] hover:shadow-[0_0_0_1px_rgba(176,212,63,0.3),0_36px_70px_-28px_rgba(176,212,63,0.45)]'
          : 'border-white/[0.08] bg-ink-900 hover:border-white/20',
        className,
      )}
      aria-label={`${plan.duration} membership`}
    >
      <p className="h-6">
        {plan.badge && (
          <span
            className={cn(
              'inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-wider',
              featured ? 'bg-brand-400 text-ink-950' : 'bg-white/[0.06] text-ink-300',
            )}
          >
            {plan.badge}
          </span>
        )}
      </p>
      {level !== undefined && levels ? (
        <div className="mt-5 flex gap-1" role="img" aria-label={`Plan length ${level + 1} of ${levels}`}>
          {Array.from({ length: levels }).map((_, i) => (
            <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              {i <= level && (
                <span
                  className={cn('m-fill-x block h-full', featured ? 'bg-brand-400' : 'bg-white/60')}
                  style={{ '--d': 400 + i * 90 } as React.CSSProperties}
                />
              )}
            </span>
          ))}
        </div>
      ) : null}
      <h3 className="mt-4 font-display text-2xl font-bold uppercase tracking-wide text-white">{plan.duration}</h3>
      {plan.description && <p className="mt-1.5 text-sm text-ink-400">{plan.description}</p>}

      <div className="mt-6 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 transition-transform duration-500 ease-out-expo [@media(hover:hover)]:group-hover/plan:-translate-y-0.5">
        <span className="font-display text-5xl font-bold tracking-tight text-white">{plan.price}</span>
        {plan.originalPrice && (
          <span className="text-sm text-ink-500 line-through" aria-label={`Regular price ${plan.originalPrice}`}>
            {plan.originalPrice}
          </span>
        )}
      </div>
      <p className={cn('mt-1 h-5 text-sm font-medium', plan.savings ? 'text-brand-400' : 'text-transparent')}>
        {plan.savings ? `You save ${plan.savings}` : ' '}
      </p>

      <ul className="mt-6 flex-1 space-y-3 border-t border-white/[0.08] pt-6">
        {features.map((f) => (
          <li key={f} className="flex gap-3 text-sm leading-snug text-ink-200">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" strokeWidth={2.5} aria-hidden />
            {f}
          </li>
        ))}
        {hidden > 0 && <li className="pl-7 text-sm text-ink-500">+ {hidden} more benefits</li>}
      </ul>

      {plan.idealFor && !maxFeatures && (
        <p className="mt-6 text-xs leading-relaxed text-ink-400">
          <span className="font-semibold uppercase tracking-wider text-ink-300">Ideal for · </span>
          {plan.idealFor}
        </p>
      )}

      <Button
        className="mt-6 w-full"
        variant={featured ? 'default' : 'secondary'}
        onClick={() => navigate('/contact', { state: { selectedPlan: plan.duration } })}
      >
        {plan.ctaText || (featured ? 'Join now' : 'Choose plan')}
        <ArrowRight className="transition-transform duration-300 ease-out-expo group-hover/plan:translate-x-1" />
      </Button>
    </article>
  );
};

export default PlanCard;
