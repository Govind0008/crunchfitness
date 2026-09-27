import HeroSection from '../components/HeroSection';
import WhyCrunchSection from '../components/WhyCrunchSection';
import MembershipSection from '../components/MembershipSection';
import GallerySection from '../components/GallerySection';
import TestimonialsSection from '../components/TestimonialsSection';
import FreeToolsSection from '../components/FreeToolsSection';
import InstagramSection from '../components/InstagramSection';
import FAQSection from '../components/FAQSection';
import CtaBand from '../components/site/CtaBand';
import Footer from '../components/Footer';

// Order follows the visitor's decision path: what it is → why here → cost →
// proof (space, reviews) → engagement (tools, community) → objections → act.
const Index = () => (
  <div className="min-h-screen overflow-x-clip">
    <main>
      <HeroSection />
      <WhyCrunchSection />
      <MembershipSection />
      <GallerySection />
      <TestimonialsSection />
      <FreeToolsSection />
      <InstagramSection />
      <FAQSection />
      <CtaBand chapter />
    </main>
    <Footer />
  </div>
);

export default Index;
