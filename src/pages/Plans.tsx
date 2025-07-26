import React, { useState, useEffect } from 'react';
import { Check, Star, Shield, Users, Zap, Award, ArrowRight, Clock, Target, TrendingUp, Menu, X, Phone, Mail, MapPin } from 'lucide-react';
import Navigation from '../components/Navigation'; // Assuming path to Navigation
import Footer from '../components/Footer';     // Assuming path to Footer
import { useNavigate } from 'react-router-dom';

const ProfessionalPlans = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(3); // 6 months plan selected by default
  const navigate = useNavigate();
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const membershipPlans = [
    {
      id: 0,
      duration: '1 Day',
      price: '₹300',
      originalPrice: null,
      period: 'trial',
      isPopular: false,
      badge: 'Trial',
      badgeColor: 'bg-blue-500',
      description: 'Perfect for first-time visitors',
      features: [
        'Full gym access for one day',
        'All equipment usage',
        'Complimentary fitness assessment',
        'Trial of group classes',
        'Locker facility'
      ],
      idealFor: 'First-time visitors, travelers',
      savings: null,
      ctaText: 'Try Today'
    },
    {
      id: 1,
      duration: '1 Month',
      price: '₹3,000',
      originalPrice: null,
      period: 'month',
      isPopular: false,
      badge: 'Starter',
      badgeColor: 'bg-green-500',
      description: 'Great for short-term goals',
      features: [
        'Complete gym access',
        'All equipment usage',
        'Basic trainer guidance',
        'Locker facility',
        'Mobile app access',
        'Progress tracking'
      ],
      idealFor: 'Short-term goals, beginners',
      savings: null,
      ctaText: 'Get Started'
    },
    {
      id: 2,
      duration: '3 Months',
      price: '₹6,500',
      originalPrice: '₹9,000',
      period: 'quarter',
      isPopular: false,
      badge: 'Value',
      badgeColor: 'bg-purple-500',
      description: 'Build lasting fitness habits',
      features: [
        'Everything in 1 Month plan',
        'Quarterly progress assessment',
        'Nutrition consultation session',
        'Priority class booking',
        'Guest pass (2 per quarter)',
        'Diet planning guidance'
      ],
      idealFor: 'Habit building, seasonal goals',
      savings: '₹2,500',
      ctaText: 'Build Habits'
    },
    {
      id: 3,
      duration: '6 Months',
      price: '₹8,000',
      originalPrice: '₹18,000',
      period: 'half-year',
      isPopular: true,
      badge: 'Most Popular',
      badgeColor: 'bg-orange-500',
      description: 'Complete transformation package',
      features: [
        'Everything in 3 Month plan',
        'Bi-weekly trainer consultations',
        'Customized workout plans',
        'Body composition analysis',
        'Guest passes (4 per half-year)',
        'Priority equipment access',
        'Injury prevention guidance'
      ],
      idealFor: 'Body transformation, serious goals',
      savings: '₹10,000',
      ctaText: 'Transform Now'
    },
    {
      id: 4,
      duration: '12 Months',
      price: '₹12,000',
      originalPrice: '₹36,000',
      period: 'year',
      isPopular: false,
      badge: 'Best Value',
      badgeColor: 'bg-yellow-500',
      description: 'Ultimate fitness investment',
      features: [
        'Everything in 6 Month plan',
        'Monthly personal training sessions',
        'Advanced nutrition planning',
        'Supplement recommendations',
        'VIP member benefits',
        'Unlimited guest passes',
        'Free merchandise',
        'Priority support'
      ],
      idealFor: 'Long-term commitment, maximum value',
      savings: '₹24,000',
      ctaText: 'Maximum Value'
    }
  ];

  const handleJoinNow = (planId) => {
     navigate('/contact', { state: { selectedPlan:  membershipPlans[planId].duration } });
  };

  const handleContactUs = () => {
    // Navigate to contact page with selected plan
    const planName = membershipPlans[selectedPlan].duration;
    navigate('/contact', { state: { selectedPlan: planName } });
    // In real app: window.location.href = '/contact' or navigate('/contact')
  };

  const handleScheduleTour = () => {
    // Navigate to contact page with selected plan
    const planName = membershipPlans[selectedPlan].duration;
    navigate('/contact', { state: { selectedPlan: planName } });
    // In real app: window.location.href = '/contact' or navigate('/contact')
  };

  const stats = [
    { icon: Users, value: '2000+', label: 'Active Members' },
    { icon: Award, value: '15+', label: 'Expert Trainers' },
    { icon: Target, value: '95%', label: 'Success Rate' },
    { icon: TrendingUp, value: '5+', label: 'Years Experience' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Navigation />

      {/* Header Section */}
      <div className="bg-black shadow-sm border-b border-gray-800 pt-20">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div className="text-center">
      <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
        Choose Your <span className="text-green-400">Fitness Journey</span>
      </h1>
      <p className="text-xl text-gray-300 max-w-3xl mx-auto">
        Flexible membership plans designed to fit your lifestyle and fitness goals. 
        Start your transformation with Crunch Fitness today.
      </p>
    </div>
  </div>
</div>


      {/* Stats Section */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-600 rounded-lg mb-4">
                  <stat.icon size={24} className="text-white" />
                </div>
                <div className="text-3xl font-bold text-green-400 mb-1">{stat.value}</div>
                <div className="text-gray-300 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plans Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Membership Plans
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose the plan that best fits your fitness goals and budget. 
              All plans include access to our world-class facilities and expert guidance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {membershipPlans.map((plan, index) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border-2 ${
                  plan.isPopular 
                    ? 'border-green-500 ring-4 ring-green-500/20' 
                    : selectedPlan === plan.id 
                      ? 'border-green-300 ring-2 ring-green-300/20' 
                      : 'border-gray-200 hover:border-green-300'
                } ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {/* Badge */}
                <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 ${plan.badgeColor} text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg`}>
                  {plan.badge}
                </div>

                <div className="p-6 pt-8">
                  {/* Duration & Price */}
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.duration}</h3>
                    <div className="mb-2">
                      {plan.originalPrice && (
                        <span className="text-lg text-gray-400 line-through mr-2">{plan.originalPrice}</span>
                      )}
                      <span className="text-3xl font-bold text-green-600">{plan.price}</span>
                    </div>
                    <p className="text-gray-600 text-sm">{plan.description}</p>
                    {plan.savings && (
                      <div className="mt-2 inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        Save {plan.savings}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start space-x-3">
                        <Check size={16} className="text-green-500 mt-1 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Ideal For */}
                  <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Perfect for
                    </div>
                    <div className="text-sm text-gray-700">{plan.idealFor}</div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleJoinNow(plan.id)}
                    className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center space-x-2 group ${
                      plan.isPopular
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-900 hover:bg-green-600 text-white hover:shadow-lg'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Crunch Fitness?
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Shield size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Expert Guidance</h3>
              <p className="text-gray-600">
                Certified trainers with years of experience to guide your fitness journey safely and effectively.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Zap size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Modern Equipment</h3>
              <p className="text-gray-600">
                State-of-the-art fitness equipment and facilities designed for optimal workout experience.
              </p>
            </div>
            
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <Clock size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Flexible Hours</h3>
              <p className="text-gray-600">
                Open early morning to late evening, fitting perfectly into your busy schedule.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ or Contact CTA */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Fitness Journey?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of satisfied members who have transformed their lives at Crunch Fitness.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleContactUs}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
            >
              Contact Us Today
            </button>
            <button 
              onClick={handleScheduleTour}
              className="border border-white text-white hover:bg-white hover:text-gray-900 px-8 py-3 rounded-xl font-semibold transition-colors"
            >
              Schedule a Tour
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-700">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-sm text-gray-400">
              <div className="flex items-center space-x-2">
                <Shield size={16} />
                <span>No Hidden Fees</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users size={16} />
                <span>Expert Support</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star size={16} />
                <span>5-Star Rated</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProfessionalPlans;