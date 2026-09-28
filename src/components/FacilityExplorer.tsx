import { useEffect, useState, type CSSProperties } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Check } from 'lucide-react';
import { Hud } from '@/components/motion';
import { cn } from '@/lib/utils';

interface Shot { name: string; small: number; alt: string; position?: string }
interface Zone { id: string; label: string; body: string; included: string; shots: Shot[] }

// Verified facts only: descriptions restate the site's own copy, "included" lines quote the FAQ
const ZONES: Zone[] = [
  {
    id: 'strength',
    label: 'Strength',
    body: 'Racks, free weights and selectorised machines on the main floor — plus a dedicated powerlifting platform with competition-standard equipment.',
    included: 'Full gym floor and free weights in every membership',
    shots: [
      { name: 'gym-wide', small: 800, alt: 'Rows of plate-loaded and selectorised machines on the main strength floor' },
      { name: 'weights-zone', small: 800, alt: 'Dumbbell racks and benches in the free-weights area' },
      { name: 'machines', small: 800, alt: 'Cable stations and resistance machines' },
    ],
  },
  {
    id: 'cardio',
    label: 'Cardio',
    body: 'A dedicated cardio zone — treadmills and bikes lined up along the windows.',
    included: 'Cardio zone included in every membership',
    shots: [
      { name: 'cardio', small: 800, alt: 'Treadmills and bikes along the windows in the cardio zone' },
      { name: 'cardio-2', small: 800, alt: 'Members training in the cardio zone' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    body: 'An open studio room for group fitness classes such as Zumba.',
    included: 'Group fitness classes included in every membership',
    shots: [
      { name: 'studio', small: 800, alt: 'Open studio room used for Zumba and group classes' },
      { name: 'studio-2', small: 800, alt: 'The group studio with mirrored walls' },
    ],
  },
  {
    id: 'training',
    label: 'Coaching',
    body: 'Certified trainers are on the floor every day to guide technique and programming, whatever your experience level.',
    included: 'Coach guidance on the floor · personal training at an additional charge',
    shots: [
      { name: 'coach-bench', small: 640, alt: 'Coach guiding a member through a dumbbell bench press', position: '50% 35%' },
      { name: 'coach-rahul', small: 600, alt: 'Coach correcting a member on the seated cable row', position: '50% 40%' },
      { name: 'coach-maddy', small: 600, alt: 'Coach helping a member load plates on the bar', position: '50% 35%' },
    ],
  },
];

/** The tab list is a vertical column from lg up — arrow keys must follow the layout */
const useLgUp = () => {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return match;
};

const large = (s: Shot) => (s.small === 800 ? 1600 : s.small === 640 ? 1600 : 1200);

/** EXPLORE CRUNCH — pick an area of the gym and look around it. Real photos, real facts. */
const FacilityExplorer = () => {
  const [zone, setZone] = useState(ZONES[0].id);
  const [shot, setShot] = useState(0);
  const vertical = useLgUp();

  return (
    <div className="mt-16 md:mt-24">
      <div className="mb-8 flex items-center gap-4">
        <Hud index="Explore" label="Crunch" className="m-rise" />
        <span className="m-fill-x h-px flex-1 bg-white/10" aria-hidden />
      </div>

      <Tabs.Root orientation={vertical ? 'vertical' : 'horizontal'} value={zone} onValueChange={(v) => { setZone(v); setShot(0); }} className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <Tabs.List aria-label="Areas of the gym" className="-mx-5 flex gap-2 overflow-x-auto px-5 hide-scrollbar sm:mx-0 sm:px-0 lg:col-span-4 lg:flex-col lg:gap-0 lg:overflow-visible">
          {ZONES.map((z, i) => (
            <Tabs.Trigger
              key={z.id}
              value={z.id}
              className={cn(
                'explorer-tab group flex shrink-0 items-baseline gap-4 rounded-full border border-white/10 px-5 py-2.5 text-left transition-colors',
                'lg:rounded-none lg:border-0 lg:border-b lg:border-white/[0.08] lg:px-0 lg:py-5',
                'data-[state=active]:border-white data-[state=active]:bg-white data-[state=active]:text-ink-950 lg:data-[state=active]:border-white/[0.08] lg:data-[state=active]:bg-transparent',
              )}
            >
              <span className="hidden font-sans text-xs font-semibold tabular-nums text-ink-500 transition-colors group-data-[state=active]:text-brand-400 lg:inline">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display text-base font-bold uppercase tracking-wide text-ink-300 transition-colors group-hover:text-white group-data-[state=active]:text-ink-950 lg:text-4xl lg:text-ink-600 lg:group-data-[state=active]:text-white">
                {z.label}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {ZONES.map((z) => {
          const current = z.shots[Math.min(shot, z.shots.length - 1)];
          return (
            <Tabs.Content key={z.id} value={z.id} className="lg:col-span-8 focus-visible:outline-offset-8">
              {/* Stage — each change of view wipes across like a camera cut */}
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-900 sm:aspect-[16/10]">
                <img
                  key={current.name}
                  src={`/images/${current.name}-${current.small}.webp`}
                  srcSet={`/images/${current.name}-${current.small}.webp ${current.small}w, /images/${current.name}-${large(current)}.webp ${large(current)}w`}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  alt={current.alt}
                  loading="lazy"
                  className="explorer-cut absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: current.position ?? '50% 50%' } as CSSProperties}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" aria-hidden />
                {z.shots.length > 1 && (
                  <div className="absolute bottom-4 right-4 flex gap-2" role="group" aria-label={`${z.label} photos`}>
                    {z.shots.map((s, i) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => setShot(i)}
                        aria-pressed={i === shot}
                        aria-label={`Show photo ${i + 1} of ${z.shots.length}: ${s.alt}`}
                        className={cn(
                          'h-12 w-16 overflow-hidden rounded-lg border-2 transition-[border-color,opacity,transform] duration-300 sm:h-14 sm:w-20',
                          i === shot ? 'border-brand-400' : 'border-transparent opacity-70 hover:opacity-100 [@media(hover:hover)]:hover:-translate-y-0.5',
                        )}
                      >
                        <img src={`/images/${s.name}-${s.small}.webp`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="explorer-copy mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-start md:gap-10">
                <p className="max-w-xl text-base leading-relaxed text-ink-200 md:text-lg">{z.body}</p>
                <p className="flex items-center gap-2 text-sm font-medium text-ink-400 md:max-w-[15rem] md:text-right">
                  <Check className="h-4 w-4 shrink-0 text-brand-400" aria-hidden /> {z.included}
                </p>
              </div>
            </Tabs.Content>
          );
        })}
      </Tabs.Root>
    </div>
  );
};

export default FacilityExplorer;
