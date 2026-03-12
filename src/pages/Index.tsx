
import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import MembershipSection from '../components/MembershipSection';
import GallerySection from '../components/GallerySection';
import TestimonialsSection from '../components/TestimonialsSection';
import BMICalculator from '../components/BMICalculator';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';
import WhatsAppButton from '../components/WhatsAppButton';

const Index = () => {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navigation />
      <main>
        <HeroSection />
        <GallerySection />
        <MembershipSection/>
        <BMICalculator />
        <TestimonialsSection />
      </main>
      <Footer />
      <Chatbot />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
