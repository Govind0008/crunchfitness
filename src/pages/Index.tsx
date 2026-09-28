import HeroSection from '../components/HeroSection';
import FilmStrip from '../components/FilmStrip';
import ChapterRail from '../components/ChapterRail';
import MembershipSection from '../components/MembershipSection';
import GallerySection from '../components/GallerySection';
import TestimonialsSection from '../components/TestimonialsSection';
import FreeToolsSection from '../components/FreeToolsSection';
import InstagramSection from '../components/InstagramSection';
import FAQSection from '../components/FAQSection';
import CtaBand from '../components/site/CtaBand';
import Footer from '../components/Footer';
import Seo from '@/components/site/Seo';

// The page is one training session: ARRIVE (hero) → 01 BUILD (method) → 02 PERFORM (facility)
// → 03 TRANSFORM (reviews) → 04 COMMIT (plans) → tools, community, objections → FINAL SET.
const Index = () => (
  <div className="min-h-screen overflow-x-clip">
    <Seo title="Crunch Fitness Club | Strength-First Gym in Wakad, Pune" description="Strength-first gym in Wakad, Pune with certified coaches, a dedicated powerlifting platform, cardio zone and group studio. Open 6 AM–10 PM Monday to Saturday." />
    <ChapterRail />
    <main>
      <HeroSection />
      <FilmStrip />
      <GallerySection />
      <TestimonialsSection />
      <MembershipSection />
      <FreeToolsSection />
      <InstagramSection />
      <FAQSection />
      <CtaBand
        chapter
        title="Join Crunch."
        body="Visit the gym, meet the coaches and get a free facility tour. We’ll help you pick the plan that fits your goal."
      />
    </main>
    <Footer />
  </div>
);

export default Index;
