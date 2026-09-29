import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import MarketingHome from './MarketingHome';
import MarketingEvents from './MarketingEvents';
import MarketingEvent from './MarketingEvent';
import EventWizard from '@/features/events/admin/EventWizard';
import SocialHighlights from '@/features/events/admin/SocialHighlights';

// The Blog, Offers and Team editors are the admin's own screens
const BlogPage = lazy(() => import('@/features/admin/content/BlogPage'));
const OffersPage = lazy(() => import('@/features/admin/content/OffersPage'));
const TeamPage = lazy(() => import('@/features/admin/content/TeamPage'));

/** /marketing/* — rendered inside the persistent MarketingLayout (which guards it). */
const MarketingApp = () => (
  <Routes>
    <Route index element={<MarketingHome />} />
    <Route path="blog" element={<BlogPage />} />
    <Route path="offers" element={<OffersPage />} />
    {/* Marketing edits public profiles only: removing one also removes a trainer's login */}
    <Route path="team" element={<TeamPage canRemove={false} />} />
    <Route path="events" element={<MarketingEvents />} />
    <Route path="events/new" element={<EventWizard />} />
    <Route path="events/:id" element={<MarketingEvent />} />
    <Route path="events/:id/edit" element={<EventWizard />} />
    <Route path="social" element={<SocialHighlights />} />
    <Route path="*" element={<MarketingHome />} />
  </Routes>
);

export default MarketingApp;
