
import HeroSection from '../components/HeroSection';
import MembershipSection from '../components/MembershipSection';
import GallerySection from '../components/GallerySection';
import TestimonialsSection from '../components/TestimonialsSection';
import BMICalculator from '../components/BMICalculator';
import FreeToolsSection from '../components/FreeToolsSection';
import InstagramSection from '../components/InstagramSection';
import FAQSection from '../components/FAQSection';
import Footer from '../components/Footer';
import { useScrollReveal } from '../hooks/useScrollReveal';

const Index = () => {
  const galleryRef = useScrollReveal();
  const membershipRef = useScrollReveal();
  const bmiRef = useScrollReveal();
  const freeToolsRef = useScrollReveal();
  const testimonialsRef = useScrollReveal();
  const instagramRef = useScrollReveal();
  const faqRef = useScrollReveal();

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <main>
        <HeroSection />
        <div ref={galleryRef} className="reveal"><GallerySection /></div>
        <div ref={membershipRef} className="reveal"><MembershipSection /></div>
        <div ref={bmiRef} className="reveal"><BMICalculator /></div>
        <div ref={freeToolsRef} className="reveal"><FreeToolsSection /></div>
        <div ref={testimonialsRef} className="reveal"><TestimonialsSection /></div>
        <div ref={instagramRef} className="reveal"><InstagramSection /></div>
        <div ref={faqRef} className="reveal"><FAQSection /></div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
