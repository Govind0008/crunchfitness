import { Route, Routes } from 'react-router-dom';
import EventsHome from './EventsHome';
import EventWizard from './EventWizard';
import EventControl from './EventControl';
import CheckIn from './CheckIn';
import LiveMode from './LiveMode';
import SocialHighlights from './SocialHighlights';

/** /admin/events/* — one lazy chunk, rendered inside the persistent AdminLayout (which guards it). */
const EventsAdmin = () => (
  <Routes>
      <Route index element={<EventsHome />} />
      <Route path="new" element={<EventWizard />} />
      <Route path="social" element={<SocialHighlights />} />
      <Route path=":id" element={<EventControl />} />
      <Route path=":id/edit" element={<EventWizard />} />
      <Route path=":id/check-in" element={<CheckIn />} />
      <Route path=":id/live" element={<LiveMode />} />
  </Routes>
);

export default EventsAdmin;
