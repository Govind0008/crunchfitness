import { lazy, Suspense, useState, useCallback, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import PageTransition from "@/components/PageTransition";
import Navigation from "@/components/Navigation";
import WhatsAppButton from "@/components/WhatsAppButton";

// Rendered outside PageTransition so position:fixed is always relative to the viewport
const GlobalUI = () => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/trainer') || pathname.startsWith('/client') || pathname === '/checkin';
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
const AdminArea        = lazy(() => import("./routes/PortalRoutes").then((m) => ({ default: m.AdminArea })));
const TrainerLogin     = lazy(() => import("./pages/TrainerLogin"));
const TrainerArea      = lazy(() => import("./routes/PortalRoutes").then((m) => ({ default: m.TrainerArea })));
const ClientLogin      = lazy(() => import("./pages/ClientLogin"));
const ClientArea       = lazy(() => import("./routes/PortalRoutes").then((m) => ({ default: m.ClientArea })));
const CheckIn          = lazy(() => import("./pages/CheckIn"));
const NotFound         = lazy(() => import("./pages/NotFound"));

// Minimal dark spinner shown while a lazy chunk is loading
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Loading">
    <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        {/* GlobalUI lives outside PageTransition so CSS transforms don't break position:fixed */}
        <GlobalUI />
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
              <Route path="/admin/login"      element={<AdminLogin />} />
              <Route path="/admin/dashboard"  element={<AdminArea />} />
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
