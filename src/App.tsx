import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import PageTransition from "@/components/PageTransition";
import Navigation from "@/components/Navigation";
import WhatsAppButton from "@/components/WhatsAppButton";
import AdminBoot from '@/components/loading/AdminBoot';

// Rendered outside PageTransition so position:fixed is always relative to the viewport
const GlobalUI = () => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/marketing') || pathname.startsWith('/trainer') || pathname.startsWith('/client') || pathname === '/checkin';
  const [bannerVisible, setBannerVisible] = useState(false);

  // Admin/portal pages render without the public navbar, so they need no top offset.
  // Public pages offset by navbar height (CSS var) plus the offer banner when shown.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--banner-h', bannerVisible ? '2.25rem' : '0rem');
    root.setProperty('--page-top', isAdmin ? '0px' : 'calc(var(--nav-h) + var(--banner-h))');
  }, [isAdmin, bannerVisible]);

  const handleBannerVisibility = useCallback((v: boolean) => setBannerVisible(v), []);

  return (
    <>
      {!isAdmin && <Navigation bannerVisible={bannerVisible} />}
      {!isAdmin && <Suspense fallback={null}><OfferBanner onVisibilityChange={handleBannerVisibility} /></Suspense>}
      {!isAdmin && <Suspense fallback={null}><Chatbot /></Suspense>}
      {/* Contact already offers WhatsApp inline; avoid a floating button over its form */}
      {!isAdmin && pathname !== '/contact' && <WhatsAppButton />}
    </>
  );
};

// Not needed for first paint: the chat assistant is large, and the offer banner needs Firestore
const Chatbot = lazy(() => import("@/components/Chatbot"));
const OfferBanner = lazy(() => import("@/components/OfferBanner"));

// Code-split every page — only the current route's bundle is loaded
const Index          = lazy(() => import("./pages/Index"));
const AboutUs        = lazy(() => import("./pages/AboutUs"));
const Team           = lazy(() => import("./pages/Team"));
const Founder        = lazy(() => import("./pages/Founder"));
const Gallery        = lazy(() => import("./pages/Gallery"));
const Plans          = lazy(() => import("./pages/Plans"));
const Contact        = lazy(() => import("./pages/Contact"));
const Blog           = lazy(() => import("./pages/Blog"));
const BlogPost       = lazy(() => import("./pages/BlogPost"));
const AdminLogin       = lazy(() => import("./pages/AdminLogin"));
const AdminLayout      = lazy(() => import("./features/admin/AdminLayout"));
const TrainerLogin     = lazy(() => import("./pages/TrainerLogin"));
const TrainerArea      = lazy(() => import("./routes/PortalRoutes").then((m) => ({ default: m.TrainerArea })));
const ClientLogin      = lazy(() => import("./pages/ClientLogin"));
const ClientArea       = lazy(() => import("./routes/PortalRoutes").then((m) => ({ default: m.ClientArea })));
const CheckIn          = lazy(() => import("./pages/CheckIn"));
const NotFound         = lazy(() => import("./pages/NotFound"));
const EventsPage       = lazy(() => import("./features/events/public/EventsPage"));
const EventPage        = lazy(() => import("./features/events/public/EventPage"));
const PassPage         = lazy(() => import("./features/events/public/PassPage"));
const EventsAdmin      = lazy(() => import("./features/events/admin"));
const AdminApp         = lazy(() => import("./features/admin"));
const MarketingLogin   = lazy(() => import("./features/marketing/MarketingLogin"));
const MarketingLayout  = lazy(() => import("./features/marketing/MarketingLayout"));
const MarketingApp     = lazy(() => import("./features/marketing"));

// Minimal dark spinner shown while a lazy chunk is loading
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
    <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        {/* GlobalUI lives outside PageTransition so CSS transforms don't break position:fixed */}
        <GlobalUI />
        {/* The admin's one boot screen, above the routes so it survives each loading step */}
        <AdminBoot />
        <Suspense fallback={<PageLoader />}>
          <PageTransition>
            <Routes>
              <Route path="/"          element={<Index />} />
              <Route path="/about-us"  element={<AboutUs />} />
              <Route path="/team"      element={<Team />} />
              <Route path="/founders"  element={<Founder />} />
              <Route path="/gallery"   element={<Gallery />} />
              <Route path="/plans"     element={<Plans />} />
              <Route path="/contact"          element={<Contact />} />
              <Route path="/blog"             element={<Blog />} />
              <Route path="/blog/:slug"       element={<BlogPost />} />
              <Route path="/events"           element={<EventsPage />} />
              <Route path="/events/:slug"     element={<EventPage />} />
              <Route path="/events/:slug/pass/:passId" element={<PassPage />} />
              <Route path="/admin/login"      element={<AdminLogin />} />
              {/* One persistent admin shell: sidebar, header and auth stay mounted; only content changes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index            element={<AdminApp />} />
                <Route path="events/*"  element={<EventsAdmin />} />
                <Route path="*"         element={<AdminApp />} />
              </Route>
              {/* The marketing team's workspace — same sign-in, its own persistent shell */}
              <Route path="/marketing/login"  element={<MarketingLogin />} />
              <Route path="/marketing" element={<MarketingLayout />}>
                <Route index    element={<MarketingApp />} />
                <Route path="*" element={<MarketingApp />} />
              </Route>
              <Route path="/trainer/login"    element={<TrainerLogin />} />
              <Route path="/trainer/dashboard" element={<TrainerArea />} />
              <Route path="/client/login"     element={<ClientLogin />} />
              <Route path="/client/dashboard" element={<ClientArea />} />
              <Route path="/checkin"          element={<CheckIn />} />
              <Route path="*"                 element={<NotFound />} />
            </Routes>
          </PageTransition>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
