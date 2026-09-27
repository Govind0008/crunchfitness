import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Keys page content on the pathname so each route enters fresh, and loads a
 * lime "rep-bar" across the top of the viewport — the route change as one rep.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <>
      <span
        key={`bar-${pathname}`}
        className="route-bar pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 bg-brand-400"
        aria-hidden
      />
      <div key={pathname} className="page-transition">
        {children}
      </div>
    </>
  );
};

export default PageTransition;
