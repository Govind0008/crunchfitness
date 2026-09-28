import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import MarketingHome from './MarketingHome';
import MarketingEvents from './MarketingEvents';
import MarketingEvent from './MarketingEvent';
import EventWizard from '@/features/events/admin/EventWizard';
import SocialHighlights from '@/features/events/admin/SocialHighlights';

// The Blog, Offers and Team editors are the admin's own screens, locked to one section
const ContentEditor = lazy(() => import('@/pages/AdminDashboard'));

/** /marketing/* — rendered inside the persistent MarketingLayout (which guards it). */
const MarketingApp = () => (
  <Routes>
    <Route index element={<MarketingHome />} />
    <Route path="blog" element={<ContentEditor lockedTab="posts" mode="marketing" />} />
    <Route path="offers" element={<ContentEditor lockedTab="offers" mode="marketing" />} />
    <Route path="team" element={<ContentEditor lockedTab="team" mode="marketing" />} />
    <Route path="events" element={<MarketingEvents />} />
    <Route path="events/new" element={<EventWizard />} />
    <Route path="events/:id" element={<MarketingEvent />} />
    <Route path="events/:id/edit" element={<EventWizard />} />
    <Route path="social" element={<SocialHighlights />} />
    <Route path="*" element={<MarketingHome />} />
  </Routes>
);

export default MarketingApp;
