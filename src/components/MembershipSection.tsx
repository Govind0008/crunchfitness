import { useState } from 'react';
import { Check, Star, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MembershipSection = () => {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const navigate = useNavigate();

  const handleGetConsultation = () => {
    navigate('/contact');
  };

  const handleGetPlan = (planName: string) => {
    navigate('/contact', { state: { selectedPlan: planName } });
  };

  const plans = [
    {
      name: 'BASIC',
      price: 999,
      originalPrice: 1299,
      period: 'month',
      icon: <Zap className="w-8 h-8" />,
      features: [
        'Access to gym equipment',
        'Locker room access',
        'Basic fitness assessment',
        'Mobile app access',
        'Community support'
      ],
      popular: false,
      gradient: 'from-gray-600 to-gray-800',
      savings: '23% OFF'
    },
    {
      name: 'PRO',
      price: 1499,
      originalPrice: 1999,
      period: 'month',
      icon: <Star className="w-8 h-8" />,
      features: [
        'Everything in Basic',
        'Personal training (4 sessions)',
        'Nutrition consultation',
        'Group fitness classes',
        'Premium locker',
        'Guest passes (2/month)'
      ],
      popular: true,
      gradient: 'from-green-400 to-green-600',
      savings: '25% OFF'
    },
    {
      name: 'ELITE',
      price: 1999,
      originalPrice: 2799,
      period: 'month',
      icon: <Star className="w-8 h-8" />,
      features: [
        'Everything in Pro',
        'Unlimited personal training',
        'VIP locker room access',
        'Massage therapy (4/month)',
        'Custom nutrition meal plans',
        'Priority booking',
        'Guest passes (unlimited)'
      ],
      popular: false,
      gradient: 'from-yellow-400 to-orange-500',
      savings: '29% OFF'
    }
  ];

  return (
    <section id="membership" className="py-20 bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header - SEO: Using h2 for a major section heading */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black mb-6">
            <span className="text-white">CHOOSE YOUR</span>
            <br />
            <span className="text-green-500">MEMBERSHIP</span>
          </h2>
          <p className="text-base sm:text-lg text-gray-400 font-body max-w-2xl mx-auto px-4">
            Select the perfect Crunch Fitness Club gym membership plan that aligns with your fitness goals and budget, right here in Wakad, Pune.
          </p>
        </div>

        {/* Membership Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 perspective-1000">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative transform transition-all duration-500 hover:scale-105 ${
                hoveredCard === index ? 'z-20' : 'z-10'
              }`}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-30">
                  <div className="bg-gradient-to-r from-green-400 to-green-600 text-black px-4 sm:px-6 py-2 rounded-full font-bold font-heading text-xs sm:text-sm shadow-lg">
                    MOST POPULAR
                  </div>
                </div>
              )}

              {/* Savings Badge */}
              <div className="absolute -top-2 -right-2 z-30">
                <div className="bg-red-500 text-white px-2 sm:px-3 py-1 rounded-full font-bold font-body text-xs">
                  {plan.savings}
                </div>
              </div>

              {/* Card */}
              <div className={`relative h-full bg-gradient-to-br ${plan.gradient} p-4 sm:p-6 rounded-2xl overflow-hidden glass-morphism border-2 ${
                plan.popular ? 'border-green-400 shadow-xl shadow-green-500/20' : 'border-gray-800'
              }`}>

                {/* Card Background Effect */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl"></div>
                </div>

                {/* Card Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-xl mb-4 ${
                    plan.popular ? 'bg-black/20 text-black' : 'bg-white/10 text-white'
                  }`}>
                    {plan.icon}
                  </div>

                  {/* Plan Name - SEO: Using h3 for individual plan names */}
                  <h3 className={`text-lg sm:text-xl font-heading font-bold mb-3 ${
                    plan.popular ? 'text-black' : 'text-white'
                  }`}>
                    {plan.name} Membership Plan
                  </h3>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className={`text-2xl sm:text-3xl font-heading font-black ${
                        plan.popular ? 'text-black' : 'text-white'
                      }`}>
                        ₹{plan.price.toLocaleString('en-IN')}
                      </span>
                      <span className={`text-sm font-body ${
                        plan.popular ? 'text-black/70' : 'text-white/70'
                      }`}>
                        /{plan.period}
                      </span>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className={`text-sm line-through ${
                        plan.popular ? 'text-black/50' : 'text-white/50'
                      } font-body`}>
                        ₹{plan.originalPrice.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-2">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          plan.popular ? 'text-black' : 'text-green-400'
                        }`} />
                        <span className={`font-body text-sm ${
                          plan.popular ? 'text-black' : 'text-white'
                        }`}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleGetPlan(plan.name)}
                    className={`w-full py-3 rounded-xl font-bold font-heading text-sm transition-all duration-300 transform hover:scale-105 ${
                      plan.popular
                        ? 'bg-black text-green-400 hover:bg-gray-900 hover:shadow-lg'
                        : 'bg-green-400 text-black hover:bg-green-300 hover:shadow-lg hover:shadow-green-500/25'
                    }`}
                  >
                    GET {plan.name} PLAN
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-400 font-body mb-4 text-sm sm:text-base px-4">
            Not sure which plan is right for you? Get a personalized fitness consultation with Crunch Fitness Club.
          </p>
          <button
            onClick={handleGetConsultation}
            className="px-6 py-3 border-2 border-green-400 text-green-400 rounded-full hover:bg-green-400 hover:text-black transition-all duration-300 font-heading font-bold text-sm transform hover:scale-105 hover:shadow-lg hover:shadow-green-400/25"
          >
            GET CONSULTATION
          </button>
        </div>
      </div>
    </section>
  );
};

export default MembershipSection;