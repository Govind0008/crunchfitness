import { useState, useEffect } from 'react';
import { Check, Star, Zap, Crown, Gift, Sparkles } from 'lucide-react';

const MembershipSection = () => {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleGetPlan = (planName) => {
    alert(`Redirecting to contact page for ${planName} plan`);
  };

  const plans = [
    {
      name: '1 Day',
      price: '₹300',
      originalPrice: null,
      isPopular: false,
      icon: Sparkles,
      gradient: 'from-blue-400 via-purple-500 to-blue-600',
      glowColor: 'blue',
      features: ['Full gym access', 'Basic equipment', 'Locker facility'],
      savings: null,
      badge: 'Trial',
      description: 'Perfect for first-time visitors',
    },
    {
      name: '1 Month',
      price: '₹3,000',
      originalPrice: null,
      isPopular: false,
      icon: Zap,
      gradient: 'from-green-400 via-emerald-500 to-green-600',
      glowColor: 'green',
      features: ['Complete gym access', 'Personal guidance', 'Mobile app access'],
      savings: null,
      badge: 'Starter',
      description: 'Great for short-term goals',
    },
    {
      name: '3 Months',
      price: '₹6,500',
      originalPrice: '₹9,000',
      isPopular: false,
      icon: Gift,
      gradient: 'from-purple-400 via-pink-500 to-purple-600',
      glowColor: 'purple',
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
      gradient: 'from-yellow-400 via-orange-500 to-red-500',
      glowColor: 'yellow',
      features: ['Everything in 3 Month', 'Personal training', 'Body analysis'],
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
      gradient: 'from-indigo-400 via-blue-500 to-purple-600',
      glowColor: 'indigo',
      features: ['Everything in 6 Month', 'VIP benefits', 'Free merchandise'],
      savings: '₹24,000',
      badge: 'Best Value',
      description: 'Ultimate fitness investment',
    },
  ];

  return (
    <section id="membership" className="py-20 bg-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/10 to-green-900/20"></div>
        <div
          className="absolute w-96 h-96 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full blur-3xl"
          style={{
            left: mousePosition.x - 200,
            top: mousePosition.y - 200,
            transition: 'all 0.3s ease',
          }}
        ></div>
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-full blur-2xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-block mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent text-sm font-bold tracking-wider uppercase">
              Premium Memberships
            </span>
          </div>
          <h2 className={`text-5xl md:text-7xl font-black mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <span className="bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
              CHOOSE YOUR
            </span>
            <br />
            <span className="bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent animate-pulse">
              TRANSFORMATION
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Unlock your potential with our premium membership plans designed for every fitness journey
          </p>
        </div>

        {/* Membership Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8">
          {plans.map((plan, index) => {
            const IconComponent = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative group transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
                style={{ animationDelay: `${index * 0.15}s` }}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-30">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-6 py-2 rounded-full font-bold text-sm shadow-2xl animate-bounce">
                      🔥 {plan.badge}
                    </div>
                  </div>
                )}

                {/* Card Container */}
                <div className={`relative h-[420px] group-hover:scale-105 transition-all duration-500 ${hoveredCard === index ? 'z-20' : 'z-10'}`}>
                  {/* Glow Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${plan.gradient} opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 rounded-3xl`}></div>

                  {/* Main Card */}
                  <div className="relative h-full bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl overflow-hidden">
                    {/* Animated Border */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse rounded-3xl"></div>

                    {/* Glass Reflection */}
                    <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-50 rounded-t-3xl"></div>

                    {/* Content */}
                    <div className="relative h-full flex flex-col p-8 text-center">
                      {/* Icon */}
                      <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${plan.gradient} rounded-2xl mb-6 mx-auto group-hover:scale-110 transition-transform duration-300`}>
                        <IconComponent size={28} className="text-white" />
                      </div>

                      {/* Badge */}
                      {!plan.isPopular && (
                        <div className={`inline-block bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent text-sm font-bold mb-2`}>
                          {plan.badge}
                        </div>
                      )}

                      {/* Plan Name */}
                      <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 group-hover:bg-clip-text transition-all duration-300">
                        {plan.name}
                      </h3>

                      {/* Description */}
                      <p className="text-gray-400 text-sm mb-4 flex-shrink-0">
                        {plan.description}
                      </p>

                      {/* Pricing */}
                      <div className="mb-6 flex-shrink-0">
                        {plan.originalPrice && (
                          <div className="text-gray-500 line-through text-lg mb-1">
                            {plan.originalPrice}
                          </div>
                        )}
                        <div className={`text-4xl font-black bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent mb-2`}>
                          {plan.price}
                        </div>
                        {plan.savings && (
                          <div className="inline-block bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                            Save {plan.savings}
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <div className="space-y-3 mb-8 flex-grow">
                        {plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center space-x-3 text-left">
                            <div className={`w-5 h-5 bg-gradient-to-r ${plan.gradient} rounded-full flex items-center justify-center flex-shrink-0`}>
                              <Check size={12} className="text-white" />
                            </div>
                            <span className="text-gray-300 text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>

                      {/* CTA Button */}
                      <button
                        onClick={() => handleGetPlan(plan.name)}
                        className={`w-full py-4 rounded-2xl font-bold text-white relative overflow-hidden group/btn transition-all duration-300 ${
                          plan.isPopular
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 shadow-2xl'
                            : `bg-gradient-to-r ${plan.gradient} hover:shadow-2xl`
                        } hover:scale-105 active:scale-95`}
                      >
                        {/* Button Glow */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 rounded-2xl"></div>

                        {/* Button Text */}
                        <span className="relative z-10 font-bold tracking-wide">
                          {plan.isPopular ? '🚀 JOIN NOW' : 'GET STARTED'}
                        </span>

                        {/* Ripple Effect */}
                        <div className="absolute inset-0 scale-0 group-hover/btn:scale-100 bg-white/30 rounded-2xl transition-transform duration-500"></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-full px-8 py-4">
            <Sparkles className="text-purple-400" size={20} />
            <span className="text-white font-semibold">All plans include expert guidance</span>
            <Sparkles className="text-purple-400" size={20} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(50px); }
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          to: { background-position: 200% 0; }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.3),
                        0 0 40px rgba(168, 85, 247, 0.1),
                        0 0 60px rgba(168, 85, 247, 0.05);
          }
          50% {
            box-shadow: 0 0 30px rgba(168, 85, 247, 0.5),
                        0 0 60px rgba(168, 85, 247, 0.2),
                        0 0 80px rgba(168, 85, 247, 0.1);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }

        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
      `}</style>
    </section>
  );
};

export default MembershipSection;