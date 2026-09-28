import { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import PlanCard from '@/components/site/PlanCard';
import { Hud } from '@/components/motion';
import { cn } from '@/lib/utils';
import type { Plan } from '@/hooks/usePlans';

/**
 * FIND YOUR PLAN — two questions, both answered with the plans' own data (each plan's
 * "ideal for" text and its duration), so a recommendation can never contradict a plan.
 * No scoring, no invented advice: it simply surfaces the matching real plan(s).
 */
const MembershipFinder = ({ plans }: { plans: Plan[] }) => {
  const [goal, setGoal] = useState<string | null>(null);
  const [length, setLength] = useState<string | null>(null);

  const goals = useMemo(() => plans.filter((p) => p.idealFor?.trim()), [plans]);
  const byGoal = plans.find((p) => p.id === goal);
  const byLength = plans.find((p) => p.id === length);
  const matches = [byGoal, byLength].filter((p, i, a): p is Plan => !!p && a.findIndex((q) => q?.id === p.id) === i);
  const done = (goals.length === 0 || goal) && length;

  const Option = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-4 py-2.5 text-left text-sm font-medium transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97]',
        selected ? 'border-brand-400 bg-brand-400 text-ink-950' : 'border-white/15 text-ink-200 hover:border-white/40 hover:text-white',
      )}
    >
      {children}
    </button>
  );

  return (
    <section id="finder" aria-labelledby="finder-heading" className="rounded-3xl border border-white/[0.08] bg-ink-900 p-6 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Hud index="Find" label="Your plan" />
          <h2 id="finder-heading" className="mt-4 font-display text-display-sm font-bold uppercase text-white">Not sure where to start?</h2>
        </div>
        {(goal || length) && (
          <button type="button" onClick={() => { setGoal(null); setLength(null); }} className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-white">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Start over
          </button>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {goals.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold text-white"><span className="mr-2 text-brand-400">01</span>What are you training for?</legend>
            <div className="mt-4 flex flex-wrap gap-2">
              {goals.map((p) => (
                <Option key={p.id} selected={goal === p.id} onClick={() => setGoal(p.id)}>{p.idealFor}</Option>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend className="text-sm font-semibold text-white"><span className="mr-2 text-brand-400">{goals.length ? '02' : '01'}</span>How long do you want to commit?</legend>
          <div className="mt-4 flex flex-wrap gap-2">
            {plans.map((p) => (
              <Option key={p.id} selected={length === p.id} onClick={() => setLength(p.id)}>{p.duration}</Option>
            ))}
          </div>
        </fieldset>
      </div>

      <div aria-live="polite">
        {done && matches.length > 0 && (
          <div className="finder-result mt-10 border-t border-white/[0.08] pt-8">
            <p className="text-sm text-ink-300">
              {matches.length === 1
                ? `The ${matches[0].duration} plan fits both answers.`
                : `Your goal points to ${byGoal!.duration}; your timeframe to ${byLength!.duration}. Both are below — a coach can help you choose on your free tour.`}
            </p>
            <div className={cn('mt-6 grid gap-5', matches.length > 1 && 'md:grid-cols-2')}>
              {matches.map((p) => (
                <PlanCard key={p.id} plan={p} level={plans.indexOf(p)} levels={plans.length} className="max-w-md" />
              ))}
            </div>
          </div>
        )}
      </div>

      <a href="#all-plans" className="link-drive mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-brand-400">
        See all plans <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
};

export default MembershipFinder;
