import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Keys page content on the pathname so each route enters fresh, and loads a
 * lime "rep-bar" across the top of the viewport — the route change as one rep.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  // The admin is one persistent app shell: keep it mounted across its routes (its layout swaps
  // only the content area). Public pages still enter fresh on every route change.
  const inAdmin = pathname.startsWith('/admin') && pathname !== '/admin/login';
  const inMarketing = pathname.startsWith('/marketing') && pathname !== '/marketing/login';
  const key = inAdmin ? 'admin' : inMarketing ? 'marketing' : pathname;
  return (
    <>
      <span
        key={`bar-${key}`}
        className="route-bar pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 bg-brand-400"
        aria-hidden
      />
      <div key={key} className="page-transition">
        {children}
      </div>
    </>
  );
};

export default PageTransition;
