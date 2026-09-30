import { useLocation } from 'react-router-dom';
import CrunchBootLoader from './CrunchBootLoader';
import { markBootDone, useBootState } from './bootState';

/** Paths that open the persistent admin shell (the sign-in page has its own screen). */
const isAdminShellPath = (p: string) => /^\/admin(\/|$)/.test(p) && !p.startsWith('/admin/login');

/**
 * Mounted once, above the routes, so one boot screen covers every step of the first entry into
 * the admin — the admin code downloading, the account and role check, the first page's code —
 * with a single animation (no loader → page → loader flashes). It shows once per page load:
 * after it hands over, navigation inside the admin only ever shows skeletons.
 */
export default function AdminBoot() {
  const { pathname } = useLocation();
  const state = useBootState();
  if (state === 'done' || !isAdminShellPath(pathname)) return null;
  return <CrunchBootLoader ready={state === 'ready'} onDone={markBootDone} />;
}
