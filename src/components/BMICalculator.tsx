import React, { useState, useRef } from 'react';
import { Calculator, ChevronRight, RotateCcw } from 'lucide-react';

type Unit = 'metric' | 'imperial';

interface BMIResult {
  bmi: number;
  category: string;
  color: string;
  barPercent: number;
  suggestion: string;
  plan: string;
}

const getBMIResult = (bmi: number): Omit<BMIResult, 'bmi'> => {
  if (bmi < 18.5) {
    return {
      category: 'Underweight',
      color: 'text-blue-400',
      barPercent: (bmi / 40) * 100,
      suggestion: 'Focus on strength training and a calorie surplus to build lean muscle mass.',
      plan: '1 Month',
    };
  } else if (bmi < 25) {
    return {
      category: 'Normal Weight',
      color: 'text-green-400',
      barPercent: (bmi / 40) * 100,
      suggestion: 'Great shape! Maintain with a balanced mix of cardio and strength training.',
      plan: '3 Months',
    };
  } else if (bmi < 30) {
    return {
      category: 'Overweight',
      color: 'text-yellow-400',
      barPercent: (bmi / 40) * 100,
      suggestion: 'A combination of HIIT cardio and weight training will accelerate fat loss.',
      plan: '6 Months',
    };
  } else {
    return {
      category: 'Obese',
      color: 'text-red-400',
      barPercent: Math.min((bmi / 40) * 100, 98),
      suggestion: 'Start with low-impact cardio and work with our certified trainers for a safe plan.',
      plan: '1 Year',
    };
  }
};

const BMICalculator: React.FC = () => {
  const [unit, setUnit] = useState<Unit>('metric');
  const [height, setHeight] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [result, setResult] = useState<BMIResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const calculate = () => {
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

    const bmi = weightKg / (heightM * heightM);
    const rounded = Math.round(bmi * 10) / 10;
    setResult({ bmi: rounded, ...getBMIResult(rounded) });

    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const reset = () => {
    setHeight('');
    setHeightFt('');
    setHeightIn('');
    setWeight('');
    setAge('');
    setResult(null);
  };

  const isValid = unit === 'metric'
    ? height && weight
    : (heightFt || heightIn) && weight;

  return (
    <section className="py-20 bg-gradient-to-b from-black via-zinc-900 to-black relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-2 mb-4">
            <Calculator size={16} className="text-orange-500" />
            <span className="text-orange-400 text-sm font-medium tracking-wider uppercase">Free Tool</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-3">
            BMI <span className="text-orange-500">Calculator</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Find out your Body Mass Index and get a personalised fitness recommendation.
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Unit toggle */}
          <div className="flex bg-zinc-800 rounded-xl p-1 mb-6 w-fit">
            {(['metric', 'imperial'] as Unit[]).map((u) => (
              <button
                key={u}
                onClick={() => { setUnit(u); setResult(null); }}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
                  unit === u
                    ? 'bg-orange-500 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {u === 'metric' ? 'Metric (cm / kg)' : 'Imperial (ft / lbs)'}
              </button>
            ))}
          </div>

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Height */}
            {unit === 'metric' ? (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Height (cm)</label>
                <input
                  type="number"
                  placeholder="e.g. 175"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Height</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="ft"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    className="w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <input
                    type="number"
                    placeholder="in"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    className="w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Weight */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                Weight ({unit === 'metric' ? 'kg' : 'lbs'})
              </label>
              <input
                type="number"
                placeholder={unit === 'metric' ? 'e.g. 70' : 'e.g. 154'}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Age (optional) */}
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">
                Age <span className="normal-case text-gray-600">(optional)</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 25"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full sm:w-1/2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={calculate}
              disabled={!isValid}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Calculator size={18} />
              Calculate BMI
            </button>
            {result && (
              <button
                onClick={reset}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-400 hover:text-white rounded-xl transition-all duration-200"
                aria-label="Reset"
              >
                <RotateCcw size={18} />
              </button>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              ref={resultRef}
              className="mt-6 border border-zinc-700 rounded-2xl p-5 bg-zinc-800/50 animate-fade-in"
            >
              {/* BMI number */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Your BMI</p>
                  <p className={`text-5xl font-bold font-heading ${result.color}`}>{result.bmi}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Category</p>
                  <p className={`text-xl font-semibold ${result.color}`}>{result.category}</p>
                </div>
              </div>

              {/* BMI bar */}
              <div className="mb-5">
                <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 via-green-500 via-yellow-400 to-red-500">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-zinc-900 shadow-lg transition-all duration-700"
                    style={{ left: `calc(${Math.min(result.barPercent, 96)}% - 8px)` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
                  <span>Underweight</span>
                  <span>Normal</span>
                  <span>Overweight</span>
                  <span>Obese</span>
                </div>
              </div>

              {/* Suggestion */}
              <div className="bg-zinc-900 rounded-xl p-4 mb-4">
                <p className="text-gray-300 text-sm leading-relaxed">
                  <span className="text-orange-400 font-semibold">Our recommendation: </span>
                  {result.suggestion}
                </p>
              </div>

              {/* CTA */}
              <a
                href="/plans"
                className="flex items-center justify-between bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-3 transition-all duration-200 hover:scale-[1.02] group"
              >
                <div>
                  <p className="font-semibold text-sm">Recommended Plan</p>
                  <p className="text-orange-100 text-xs">{result.plan} membership — best for your goal</p>
                </div>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-gray-600 text-xs mt-4">
          BMI is a general indicator. Consult our certified trainers for a personalised fitness assessment.
        </p>
      </div>
    </section>
  );
};

export default BMICalculator;
