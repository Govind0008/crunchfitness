
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AboutUs from "./pages/AboutUs";
import Team from "./pages/Team";
import Gallery from "./pages/Gallery";
import Plans from "./pages/Plans";
import Founder from "./pages/Founder";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import ScrollToTop from "@/components/ScrollToTop"; 
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop /> 
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/team" element={<Team />} />
          <Route path="/founders" element={<Founder />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;