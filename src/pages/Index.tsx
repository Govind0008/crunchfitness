
import Navigation from '../components/Navigation';
import HeroSection from '../components/HeroSection';
import MembershipSection from '../components/MembershipSection';
import GallerySection from '../components/GallerySection';
import TestimonialsSection from '../components/TestimonialsSection';
import Footer from '../components/Footer';
import Chatbot from '../components/Chatbot';

const Index = () => {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Navigation />
      <main>
        <HeroSection />
        <GallerySection />
        <MembershipSection/>
        <TestimonialsSection />
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
};

export default Index;
