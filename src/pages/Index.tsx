import HeroSection from '../components/HeroSection';
import FilmStrip from '../components/FilmStrip';
import MembershipSection from '../components/MembershipSection';
import GallerySection from '../components/GallerySection';
import TestimonialsSection from '../components/TestimonialsSection';
import FreeToolsSection from '../components/FreeToolsSection';
import InstagramSection from '../components/InstagramSection';
import FAQSection from '../components/FAQSection';
import CtaBand from '../components/site/CtaBand';
import Footer from '../components/Footer';

// The page is one training session: ARRIVE (hero) → 01 BUILD (method) → 02 PERFORM (facility)
// → 03 TRANSFORM (reviews) → 04 COMMIT (plans) → tools, community, objections → FINAL SET.
const Index = () => (
  <div className="min-h-screen overflow-x-clip">
    <main>
      <HeroSection />
      <FilmStrip />
      <GallerySection />
      <TestimonialsSection />
      <MembershipSection />
      <FreeToolsSection />
      <InstagramSection />
      <FAQSection />
      <CtaBand chapter />
    </main>
    <Footer />
  </div>
);

export default Index;
