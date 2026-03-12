import { useState, useEffect, useRef } from 'react';
import {
  Check, Star, Shield, Users, Zap, Award, ArrowRight,
  Clock, Target, TrendingUp, Sparkles, Crown, Gift,
} from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

const membershipPlans = [
  {
    id: 0,
    duration: '1 Day',
    price: '₹300',
    originalPrice: null as string | null,
    isPopular: false,
    badge: 'Trial',
    icon: Sparkles,
    gradient: 'from-blue-400 to-purple-600',
    description: 'Perfect for first-time visitors',
    features: [
      'Full gym access for one day',
      'All equipment usage',
      'Complimentary fitness assessment',
      'Trial of group classes',
      'Locker facility',
    ],
    idealFor: 'First-time visitors, travelers',
    savings: null as string | null,
    ctaText: 'Try Today',
  },
  {
    id: 1,
    duration: '1 Month',
    price: '₹3,000',
    originalPrice: null as string | null,
    isPopular: false,
    badge: 'Starter',
    icon: Zap,
    gradient: 'from-green-400 to-emerald-600',
    description: 'Great for short-term goals',
    features: [
      'Complete gym access',
      'All equipment usage',
      'Basic trainer guidance',
      'Locker facility',
      'Mobile app access',
      'Progress tracking',
    ],
    idealFor: 'Short-term goals, beginners',
    savings: null as string | null,
    ctaText: 'Get Started',
  },
  {
    id: 2,
    duration: '3 Months',
    price: '₹6,500',
    originalPrice: '₹9,000',
    isPopular: false,
    badge: 'Value',
    icon: Gift,
    gradient: 'from-purple-400 to-pink-600',
    description: 'Build lasting fitness habits',
    features: [
      'Everything in 1 Month plan',
      'Quarterly progress assessment',
      'Nutrition consultation session',
      'Priority class booking',
      'Guest pass (2 per quarter)',
      'Diet planning guidance',
    ],
    idealFor: 'Habit building, seasonal goals',
    savings: '₹2,500',
    ctaText: 'Build Habits',
  },
  {
    id: 3,
    duration: '6 Months',
    price: '₹8,000',
    originalPrice: '₹18,000',
    isPopular: true,
    badge: 'Most Popular',
    icon: Crown,
    gradient: 'from-yellow-400 to-orange-600',
    description: 'Complete transformation package',
    features: [
      'Everything in 3 Month plan',
      'Bi-weekly trainer consultations',
      'Customized workout plans',
      'Body composition analysis',
      'Guest passes (4 per half-year)',
      'Priority equipment access',
      'Injury prevention guidance',
    ],
    idealFor: 'Body transformation, serious goals',
    savings: '₹10,000',
    ctaText: 'Transform Now',
  },
  {
    id: 4,
    duration: '12 Months',
    price: '₹12,000',
    originalPrice: '₹36,000',
    isPopular: false,
    badge: 'Best Value',
    icon: Star,
    gradient: 'from-indigo-400 to-purple-600',
    description: 'Ultimate fitness investment',
    features: [
      'Everything in 6 Month plan',
      'Monthly personal training sessions',
      'Advanced nutrition planning',
      'Supplement recommendations',
      'VIP member benefits',
      'Unlimited guest passes',
      'Free merchandise',
      'Priority support',
    ],
    idealFor: 'Long-term commitment, maximum value',
    savings: '₹24,000',
    ctaText: 'Maximum Value',
  },
];

const stats = [
  { icon: Users,      value: '2000+', label: 'Active Members' },
  { icon: Award,      value: '15+',   label: 'Expert Trainers' },
  { icon: Target,     value: '95%',   label: 'Success Rate' },
  { icon: TrendingUp, value: '5+',    label: 'Years Experience' },
];

const whyUs = [
  {
    icon: Shield,
    title: 'Expert Guidance',
    body: 'Certified trainers with years of experience to guide your fitness journey safely and effectively.',
  },
  {
    icon: Zap,
    title: 'Modern Equipment',
    body: 'State-of-the-art fitness equipment and facilities designed for the optimal workout experience.',
  },
  {
    icon: Clock,
    title: 'Flexible Hours',
    body: 'Open early morning to late evening, fitting perfectly into your busy schedule.',
  },
];

const ProfessionalPlans = () => {
  const [isVisible, setIsVisible] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.05 }
    );
    if (pageRef.current) observer.observe(pageRef.current);
    return () => observer.disconnect();
  }, []);

  const goToContact = (planId: number) => {
    navigate('/contact', { state: { selectedPlan: membershipPlans[planId].duration } });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      {/* ── Hero header ── */}
      <div className="relative bg-black border-b border-gray-800 pt-24 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(139,92,246,0.15),transparent)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="inline-block text-xs font-bold font-heading tracking-widest uppercase bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            Premium Memberships
          </span>
          <h1 className="text-4xl md:text-6xl font-black font-heading mb-5">
            Choose Your{' '}
            <span className="bg-gradient-to-r from-green-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Fitness Journey
            </span>
          </h1>
          <p className="text-gray-400 text-lg font-body max-w-2xl mx-auto">
            Flexible plans designed to fit your lifestyle and goals.
            Start your transformation with Crunch Fitness today.
          </p>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="bg-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 mb-3">
                  <stat.icon size={22} className="text-green-400" />
                </div>
                <div className="text-2xl font-black font-heading text-green-400 mb-0.5">{stat.value}</div>
                <div className="text-gray-500 text-sm font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Plans ── */}
      <div ref={pageRef} className="py-20 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(16,185,129,0.05),transparent)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <h2 className="text-3xl md:text-4xl font-black font-heading text-white mb-4">
              Membership Plans
            </h2>
            <p className="text-gray-500 font-body max-w-xl mx-auto">
              All plans include access to our world-class facilities and expert guidance.
            </p>
          </div>

          {/* Cards — pt-6 on every wrapper reserves uniform space for the popular badge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 items-stretch">
            {membershipPlans.map((plan, index) => {
              const Icon = plan.icon;
              return (
                // pt-6 uniform on all wrappers so card tops align regardless of badge
                <div
                  key={plan.id}
                  className={`relative group flex flex-col pt-6 transition-all duration-700 ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  } ${plan.isPopular ? 'sm:col-span-2 xl:col-span-1' : ''}`}
                  style={{ transitionDelay: `${index * 110}ms` }}
                >
                  {/* Badge — anchored to top-0 of the pt-6 space */}
                  {plan.isPopular && (
                    <div className="absolute top-0 inset-x-0 flex justify-center z-20">
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg shadow-orange-500/30 tracking-wide">
                        🔥 MOST POPULAR
                      </span>
                    </div>
                  )}

                  {/* Hover glow */}
                  <div className={`absolute inset-x-0 bottom-0 top-6 rounded-[26px] bg-gradient-to-r ${plan.gradient} opacity-0 group-hover:opacity-15 blur-xl transition-opacity duration-500`} />

                  {/* Card */}
                  <div
                    className={`relative flex flex-col flex-1 rounded-3xl overflow-hidden transition-transform duration-300 group-hover:-translate-y-1 ${
                      plan.isPopular
                        ? 'border border-yellow-400/50 bg-gray-900 shadow-2xl shadow-yellow-500/10'
                        : 'border border-gray-800 bg-gray-900 group-hover:border-gray-700'
                    }`}
                  >
                    {/* Coloured top stripe */}
                    <div className={`h-[3px] w-full bg-gradient-to-r ${plan.gradient} flex-shrink-0`} />

                    {/* Glass sheen */}
                    <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

                    <div className="flex flex-col flex-1 p-6">

                      {/* Icon + badge pill */}
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                          <Icon size={20} className="text-white" />
                        </div>
                        <span className={`text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r ${plan.gradient} text-white`}>
                          {plan.badge}
                        </span>
                      </div>

                      {/* Name + description */}
                      <h3 className="text-lg font-bold font-heading text-white mb-1">{plan.duration}</h3>
                      <p className="text-gray-500 text-xs font-body mb-5 leading-relaxed">{plan.description}</p>

                      {/* Price */}
                      <div className="mb-5">
                        {plan.originalPrice && (
                          <span className="text-gray-600 line-through text-sm block mb-0.5">
                            {plan.originalPrice}
                          </span>
                        )}
                        <div className={`text-3xl font-black font-heading bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
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

                      {/* Features — flex-1 so CTA is always pinned to bottom */}
                      <ul className="flex-1 space-y-2.5 mb-4">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm font-body text-gray-300">
                            <span className={`mt-0.5 w-[17px] h-[17px] rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center flex-shrink-0`}>
                              <Check size={10} className="text-white" strokeWidth={3} />
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {/* Ideal for */}
                      <div className="bg-gray-800/60 rounded-xl px-3 py-2.5 mb-5">
                        <span className="text-[10px] font-bold font-heading text-gray-500 uppercase tracking-wider block mb-0.5">
                          Perfect for
                        </span>
                        <span className="text-gray-300 text-xs font-body">{plan.idealFor}</span>
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => goToContact(plan.id)}
                        className={`mt-auto w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r ${plan.gradient} transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.97] group/btn ${
                          plan.isPopular ? 'shadow-md shadow-orange-500/20' : ''
                        }`}
                      >
                        {plan.ctaText}
                        <ArrowRight size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Why Crunch Fitness ── */}
      <div className="bg-gray-950 border-t border-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black font-heading text-white text-center mb-12">
            Why Choose <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Crunch Fitness?</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {whyUs.map((item, i) => (
              <div key={i} className="text-center p-8 rounded-3xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl mb-5">
                  <item.icon size={26} className="text-green-400" />
                </div>
                <h3 className="text-lg font-bold font-heading text-white mb-3">{item.title}</h3>
                <p className="text-gray-500 text-sm font-body leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="bg-black border-t border-gray-800 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-black font-heading text-white mb-4">
            Ready to Start Your Fitness Journey?
          </h2>
          <p className="text-gray-400 text-lg font-body mb-10">
            Join thousands of satisfied members who have transformed their lives at Crunch Fitness.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <button
              onClick={() => navigate('/contact')}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white px-8 py-3.5 rounded-2xl font-bold font-heading transition-all hover:shadow-lg hover:shadow-green-500/20 active:scale-[0.97]"
            >
              Contact Us Today
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white px-8 py-3.5 rounded-2xl font-bold font-heading transition-all"
            >
              Schedule a Tour
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-2"><Shield size={14} /> No Hidden Fees</span>
            <span className="flex items-center gap-2"><Users size={14} /> Expert Support</span>
            <span className="flex items-center gap-2"><Star size={14} /> 5-Star Rated</span>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProfessionalPlans;
