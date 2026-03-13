import { lazy, Suspense, useState, useCallback } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import PageTransition from "@/components/PageTransition";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/Navigation";
import OfferBanner from "@/components/OfferBanner";
import Chatbot from "@/components/Chatbot";
import WhatsAppButton from "@/components/WhatsAppButton";

// Rendered outside PageTransition so position:fixed is always relative to the viewport
const GlobalUI = () => {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const [bannerVisible, setBannerVisible] = useState(false);
  const handleBannerVisibility = useCallback((v: boolean) => {
    setBannerVisible(v);
    // navbar h-28 = 7rem; banner h-9 = 2.25rem
    document.documentElement.style.setProperty(
      '--page-top',
      v ? '9.25rem' : '7rem'
    );
  }, []);

  return (
    <>
      <Navigation bannerVisible={bannerVisible} />
      {!isAdmin && <OfferBanner onVisibilityChange={handleBannerVisibility} />}
      {!isAdmin && <Chatbot />}
      {!isAdmin && <WhatsAppButton />}
    </>
  );
};

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
const AdminLogin     = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound       = lazy(() => import("./pages/NotFound"));

// Minimal dark spinner shown while a lazy chunk is loading
const PageLoader = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
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
              <Route path="/admin/dashboard"  element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="*"                 element={<NotFound />} />
            </Routes>
          </PageTransition>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
