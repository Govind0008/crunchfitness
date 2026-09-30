import { useEffect, useLayoutEffect, useState } from 'react';

// Staff-area theme (admin and marketing shells). The public website is always dark.
// The choice is per browser; "system" follows the device setting and updates live.
export type ThemePref = 'light' | 'dark' | 'system';
export const THEME_KEY = 'crunch.admin.theme';
const DEFAULT: ThemePref = 'dark';

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT;
  } catch { return DEFAULT; }
}
const systemIsLight = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: light)').matches;
export const resolveTheme = (p: ThemePref): 'light' | 'dark' => (p === 'system' ? (systemIsLight() ? 'light' : 'dark') : p);

/**
 * Applies the staff theme to <html> while the calling shell is mounted — on the root element, so
 * dialogs, menus and drawers rendered in portals get it too — and removes it on the way out.
 */
export function useStaffTheme() {
  const [pref, setPref] = useState<ThemePref>(readThemePref);
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(readThemePref()));
  // Before paint, so a light-theme page never flashes dark first
  useLayoutEffect(() => {
    const apply = () => {
      const r = resolveTheme(pref);
      setResolved(r);
      document.documentElement.dataset.theme = r;
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (pref === 'system') mq?.addEventListener('change', apply);
    return () => { mq?.removeEventListener('change', apply); };
  }, [pref]);
  // Leaving the staff area: back to the site's dark default
  useEffect(() => () => { delete document.documentElement.dataset.theme; }, []);
  const choose = (p: ThemePref) => {
    setPref(p);
    try { localStorage.setItem(THEME_KEY, p); } catch { /* private mode: applies for this visit only */ }
  };
  return { pref, resolved, choose };
}
