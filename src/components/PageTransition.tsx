import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Wraps page content and triggers a fade+slide-up animation
 * on every route change by keying on the pathname.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
};

export default PageTransition;
