import Navigation from '@/components/Navigation';
import MembershipSection from '@/components/MembershipSection';
import Footer from '@/components/Footer';
import Chatbot from '@/components/Chatbot';

const Plans = () => {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-20 pb-10 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-orbitron font-black mb-6">
            <span className="text-white">MEMBERSHIP</span>
            <br />
            <span className="text-green-500">PLANS</span>
          </h1>
          <p className="text-xl text-gray-400 font-rajdhani max-w-3xl mx-auto">
            Choose the perfect membership plan that fits your fitness goals and lifestyle.
            All plans include access to our world-class facilities and expert guidance.
          </p>
        </div>
      </section>

      
      <MembershipSection />

      <Footer />
      <Chatbot />
    </div>
  );
};

export default Plans;