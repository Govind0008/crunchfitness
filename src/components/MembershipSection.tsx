import { useState, useEffect, useRef } from 'react';
import { Check, Star, Zap, Crown, Gift, Sparkles } from 'lucide-react';
import { fetchPlans } from '../lib/api';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Sparkles, Zap, Gift, Crown, Star,
};

interface FirestorePlan {
  id: string;
  order: number;
  duration: string;
  price: string;
  originalPrice: string;
  description: string;
  features: string[];
  savings: string;
  badge: string;
  isPopular: boolean;
  gradient: string;
  iconName: string;
}

const STATIC_PLANS = [
  {
    name: '1 Day',
    price: '₹300',
    originalPrice: null as string | null,
    isPopular: false,
    icon: Sparkles,
    gradient: 'from-blue-400 to-purple-600',
    features: ['Full gym access', 'Basic equipment', 'Locker facility'],
    savings: null as string | null,
    badge: 'Trial',
    description: 'Perfect for first-time visitors',
  },
  {
    name: '1 Month',
    price: '₹3,000',
    originalPrice: null as string | null,
    isPopular: false,
    icon: Zap,
    gradient: 'from-green-400 to-emerald-600',
    features: ['Complete gym access', 'Personal guidance', 'Mobile app access'],
    savings: null as string | null,
    badge: 'Starter',
    description: 'Great for short-term goals',
  },
  {
    name: '3 Months',
    price: '₹6,500',
    originalPrice: '₹9,000',
    isPopular: false,
    icon: Gift,
    gradient: 'from-purple-400 to-pink-600',
    features: ['Everything in 1 Month', 'Nutrition consultation', 'Priority booking'],
    savings: '₹2,500',
    badge: 'Value',
    description: 'Build lasting habits',
  },
  {
    name: '6 Months',
    price: '₹8,000',
    originalPrice: '₹18,000',
    isPopular: true,
    icon: Crown,
    gradient: 'from-yellow-400 to-orange-600',
    features: ['Everything in 3 Months', 'Personal training', 'Body analysis'],
    savings: '₹10,000',
    badge: 'Most Popular',
    description: 'Complete transformation',
  },
  {
    name: '12 Months',
    price: '₹12,000',
    originalPrice: '₹36,000',
    isPopular: false,
    icon: Star,
    gradient: 'from-indigo-400 to-purple-600',
    features: ['Everything in 6 Months', 'VIP benefits', 'Free merchandise'],
    savings: '₹24,000',
    badge: 'Best Value',
    description: 'Ultimate fitness investment',
  },
];

const MembershipSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [firestorePlans, setFirestorePlans] = useState<FirestorePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchPlans()
      .then((data) => setFirestorePlans(data as FirestorePlan[]))
      .catch(console.error)
      .finally(() => setLoadingPlans(false));
  }, []);

  const usingFirestore = !loadingPlans && firestorePlans.length > 0;

  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      ref={sectionRef}
      id="membership"
      className="py-24 bg-black relative overflow-hidden"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(139,92,246,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_100%,rgba(16,185,129,0.08),transparent)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* ── Section header ── */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="inline-block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent text-xs font-bold tracking-widest uppercase mb-4">
            Premium Memberships
          </span>
          <h2 className="text-5xl md:text-6xl font-black leading-tight mb-5">
            <span className="text-white">CHOOSE YOUR</span>
            <br />
            <span className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              TRANSFORMATION
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Unlock your potential with our premium membership plans designed for every fitness journey
          </p>
        </div>

        {/* ── Cards grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 items-stretch">
          {(usingFirestore ? firestorePlans : STATIC_PLANS).map((plan, index) => {
            const gradient = plan.gradient;
            const isPopular = plan.isPopular;
            const Icon = usingFirestore
              ? (ICON_MAP[(plan as FirestorePlan).iconName] ?? Sparkles)
              : (plan as typeof STATIC_PLANS[0]).icon;
            const name = usingFirestore ? (plan as FirestorePlan).duration : (plan as typeof STATIC_PLANS[0]).name;
            const features: string[] = Array.isArray(plan.features) ? plan.features as string[] : [];

            return (
              // pt-6 on every wrapper reserves uniform badge space above all cards
              <div
                key={usingFirestore ? (plan as FirestorePlan).id : name}
                className={`relative group flex flex-col pt-6 transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                } ${isPopular ? 'sm:col-span-2 xl:col-span-1' : ''}`}
                style={{ transitionDelay: `${index * 110}ms` }}
              >
                {/* Popular badge — sits inside the pt-6 space, never shifts card content */}
                {isPopular && (
                  <div className="absolute top-0 inset-x-0 flex justify-center z-20">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-orange-500/40 tracking-wide">
                      🔥 MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Hover glow layer */}
                <div
                  className={`absolute inset-x-0 bottom-0 top-6 rounded-[26px] bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`}
                />

                {/* Card — identical structure for all plans, no conditional padding */}
                <div
                  className={`relative flex flex-col flex-1 rounded-3xl overflow-hidden transition-transform duration-300 group-hover:-translate-y-1 ${
                    isPopular
                      ? 'border border-yellow-400/50 bg-gray-900 shadow-2xl shadow-yellow-500/10'
                      : 'border border-gray-800 bg-gray-900 group-hover:border-gray-700'
                  }`}
                >
                  {/* Coloured top stripe */}
                  <div className={`h-[3px] w-full bg-gradient-to-r ${gradient} flex-shrink-0`} />

                  {/* Glass sheen */}
                  <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

                  <div className="flex flex-col flex-1 p-6">

                    {/* Icon + badge row */}
                    <div className="flex items-start justify-between mb-5">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0`}
                      >
                        <Icon size={20} className="text-white" />
                      </div>
                      <span
                        className={`text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r ${gradient} text-white shadow-sm`}
                      >
                        {plan.badge}
                      </span>
                    </div>

                    {/* Plan name */}
                    <h3 className="text-lg font-bold text-white mb-1 leading-snug">
                      {name}
                    </h3>

                    {/* Description */}
                    <p className="text-gray-500 text-xs mb-5 leading-relaxed">
                      {plan.description}
                    </p>

                    {/* Price block */}
                    <div className="mb-5">
                      {plan.originalPrice && (
                        <span className="text-gray-600 line-through text-sm block mb-0.5">
                          {plan.originalPrice}
                        </span>
                      )}
                      <div
                        className={`text-3xl font-black bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
                      >
                        {plan.price}
                      </div>
                      {plan.savings && (
                        <span className="inline-block mt-2 text-[11px] font-semibold text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-0.5 rounded-full">
                          Save {plan.savings}
                        </span>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gray-800 mb-4" />

                    {/* Features — grows to fill remaining space */}
                    <ul className="flex-1 space-y-2.5 mb-6">
                      {features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
                          <span
                            className={`w-[18px] h-[18px] rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}
                          >
                            <Check size={10} className="text-white" strokeWidth={3} />
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* CTA — always pinned to bottom */}
                    <button
                      onClick={scrollToContact}
                      className={`mt-auto w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r ${gradient} transition-all duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-black/30 active:scale-[0.97] ${
                        isPopular ? 'shadow-md shadow-orange-500/20' : ''
                      }`}
                    >
                      {isPopular ? '🚀 JOIN NOW' : 'GET STARTED'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Bottom note ── */}
        <div
          className={`text-center mt-14 transition-all duration-700 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionDelay: '650ms' }}
        >
          <div className="inline-flex items-center gap-2.5 bg-white/5 backdrop-blur border border-white/10 rounded-full px-6 py-3 text-sm text-gray-400">
            <Sparkles size={15} className="text-purple-400" />
            All plans include expert guidance &amp; a free facility tour
            <Sparkles size={15} className="text-purple-400" />
          </div>
        </div>

      </div>
    </section>
  );
};

export default MembershipSection;
