import { Route, Routes } from 'react-router-dom';
import { EventAdminRoute } from './shared';
import EventsHome from './EventsHome';
import EventWizard from './EventWizard';
import EventControl from './EventControl';
import CheckIn from './CheckIn';
import LiveMode from './LiveMode';
import SocialHighlights from './SocialHighlights';

/** /admin/events/* — one lazy chunk, one guard (userRoles role "admin"). */
const EventsAdmin = () => (
  <EventAdminRoute>
    <Routes>
      <Route index element={<EventsHome />} />
      <Route path="new" element={<EventWizard />} />
      <Route path="social" element={<SocialHighlights />} />
      <Route path=":id" element={<EventControl />} />
      <Route path=":id/edit" element={<EventWizard />} />
      <Route path=":id/check-in" element={<CheckIn />} />
      <Route path=":id/live" element={<LiveMode />} />
    </Routes>
  </EventAdminRoute>
);

export default EventsAdmin;
