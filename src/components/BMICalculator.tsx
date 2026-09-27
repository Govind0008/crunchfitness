import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Unit = 'metric' | 'imperial';

interface BMIResult {
  bmi: number;
  category: string;
  color: string;
  suggestion: string;
  plan: string;
}

// Scale shown on the result bar: 15 → 40 BMI
const SCALE_MIN = 15;
const SCALE_MAX = 40;
const SEGMENTS = [
  { label: 'Under', to: 18.5, className: 'bg-sky-400' },
  { label: 'Healthy', to: 25, className: 'bg-brand-400' },
  { label: 'Over', to: 30, className: 'bg-amber-400' },
  { label: 'Obese', to: SCALE_MAX, className: 'bg-red-400' },
];

const getBMIResult = (bmi: number): Omit<BMIResult, 'bmi'> => {
  if (bmi < 18.5) return {
    category: 'Underweight', color: 'text-sky-400',
    suggestion: 'Focus on strength training and a calorie surplus to build lean muscle mass.',
    plan: '1 Month',
  };
  if (bmi < 25) return {
    category: 'Healthy weight', color: 'text-brand-400',
    suggestion: 'Great shape! Maintain with a balanced mix of cardio and strength training.',
    plan: '3 Months',
  };
  if (bmi < 30) return {
    category: 'Overweight', color: 'text-amber-400',
    suggestion: 'A combination of HIIT cardio and weight training will accelerate fat loss.',
    plan: '6 Months',
  };
  return {
    category: 'Obese', color: 'text-red-400',
    suggestion: 'Start with low-impact cardio and work with our certified trainers for a safe plan.',
    plan: '12 Months',
  };
};

const inputClass =
  'h-12 w-full rounded-xl border border-white/10 bg-ink-950 px-4 text-white placeholder:text-ink-500 transition-colors focus:border-brand-400 focus:outline-none focus-visible:outline-none';

const Field = ({ id, label, ...props }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink-300">{label}</label>
    <input id={id} type="number" inputMode="decimal" min={0} className={inputClass} {...props} />
  </div>
);

const BMICalculator: React.FC = () => {
  const [unit, setUnit] = useState<Unit>('metric');
  const [height, setHeight] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState<BMIResult | null>(null);

  const calculate = (e: React.FormEvent) => {
    e.preventDefault();
    let heightM = 0;
    let weightKg = parseFloat(weight);

    if (unit === 'metric') {
      heightM = parseFloat(height) / 100;
    } else {
      const ft = parseFloat(heightFt) || 0;
      const inch = parseFloat(heightIn) || 0;
      heightM = (ft * 12 + inch) * 0.0254;
      weightKg = parseFloat(weight) * 0.453592;
    }

    if (!heightM || !weightKg || heightM <= 0 || weightKg <= 0) return;

    const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    setResult({ bmi, ...getBMIResult(bmi) });
  };

  const reset = () => {
    setHeight(''); setHeightFt(''); setHeightIn(''); setWeight(''); setResult(null);
  };

  const isValid = unit === 'metric' ? height && weight : (heightFt || heightIn) && weight;
  const marker = result
    ? Math.min(Math.max(((result.bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100, 2), 98)
    : 0;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="font-display text-2xl font-bold uppercase text-white">BMI calculator</h3>
        <div className="inline-flex rounded-full bg-ink-950 p-1" role="group" aria-label="Units">
          {(['metric', 'imperial'] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => { setUnit(u); setResult(null); }}
              aria-pressed={unit === u}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                unit === u ? 'bg-white text-ink-950' : 'text-ink-400 hover:text-white',
              )}
            >
              {u === 'metric' ? 'cm / kg' : 'ft / lb'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={calculate} className="mt-6">
        <div className="grid grid-cols-2 gap-4">
          {unit === 'metric' ? (
            <Field id="bmi-height" label="Height (cm)" placeholder="175" value={height} onChange={(e) => setHeight(e.target.value)} />
          ) : (
            <fieldset className="col-span-2 grid grid-cols-2 gap-4 sm:col-span-1">
              <legend className="sr-only">Height</legend>
              <Field id="bmi-ft" label="Height (ft)" placeholder="5" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} />
              <Field id="bmi-in" label="(in)" placeholder="9" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} />
            </fieldset>
          )}
          <div className={unit === 'imperial' ? 'col-span-2 sm:col-span-1' : ''}>
            <Field
              id="bmi-weight"
              label={`Weight (${unit === 'metric' ? 'kg' : 'lb'})`}
              placeholder={unit === 'metric' ? '70' : '154'}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button type="submit" disabled={!isValid} className="flex-1">Calculate BMI</Button>
          {result && (
            <Button type="button" variant="secondary" size="icon" onClick={reset} aria-label="Reset calculator">
              <RotateCcw />
            </Button>
          )}
        </div>
      </form>

      <div aria-live="polite">
        {result && (
          <div className="mt-6 border-t border-white/[0.08] pt-6 animate-fade-up">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Your BMI</p>
                <p className={cn('font-display text-6xl font-bold leading-none', result.color)}>{result.bmi}</p>
              </div>
              <p className={cn('text-right text-lg font-semibold', result.color)}>{result.category}</p>
            </div>

            <div className="relative mt-5" aria-hidden>
              <div className="flex h-2 gap-1 overflow-hidden rounded-full">
                {SEGMENTS.map((s, i) => {
                  const from = i === 0 ? SCALE_MIN : SEGMENTS[i - 1].to;
                  return <div key={s.label} className={cn(s.className, 'opacity-80')} style={{ flexGrow: s.to - from }} />;
                })}
              </div>
              <div
                className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-ink-900 bg-white transition-[left] duration-700 ease-out-expo"
                style={{ left: `${marker}%` }}
              />
              <div className="mt-2 flex text-[11px] text-ink-500">
                {SEGMENTS.map((s, i) => {
                  const from = i === 0 ? SCALE_MIN : SEGMENTS[i - 1].to;
                  return <span key={s.label} style={{ flexGrow: s.to - from }}>{s.label}</span>;
                })}
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-ink-300">{result.suggestion}</p>

            <Link
              to="/contact"
              state={{ selectedPlan: result.plan }}
              className="group mt-5 flex items-center justify-between gap-4 rounded-xl bg-ink-950 px-4 py-3.5 transition-colors hover:bg-ink-800"
            >
              <span>
                <span className="block text-sm font-semibold text-white">Suggested: {result.plan} plan</span>
                <span className="block text-xs text-ink-400">Talk to a coach about your goal</span>
              </span>
              <ArrowRight className="h-4 w-4 text-brand-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-500">
        BMI is a general indicator only. Our trainers can give you a full fitness assessment.
      </p>
    </div>
  );
};

export default BMICalculator;
