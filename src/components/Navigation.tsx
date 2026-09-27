import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SITE } from '@/lib/site';
import { prefersReducedMotion } from '@/lib/motion';

const NAV_ITEMS = [
  { name: 'Home',    href: '/' },
  { name: 'About',   href: '/about-us' },
  { name: 'Team',    href: '/team' },
  { name: 'Founder', href: '/founders' },
  { name: 'Gallery', href: '/gallery' },
  { name: 'Blog',    href: '/blog' },
  { name: 'Plans',   href: '/plans' },
  { name: 'Contact', href: '/contact' },
];

const Navigation = ({ bannerVisible = false }: { bannerVisible?: boolean }) => {
  // 'closing' keeps the sheet mounted while its exit animation plays
  const [menu, setMenu] = useState<'closed' | 'open' | 'closing'>('closed');
  const isOpen = menu === 'open';
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const setIsOpen = useCallback((open: boolean) => {
    setMenu((m) => {
      if (open) return 'open';
      if (m !== 'open') return m;
      window.setTimeout(() => setMenu((cur) => (cur === 'closing' ? 'closed' : cur)), prefersReducedMotion() ? 0 : 320);
      return 'closing';
    });
  }, []);

  // Scroll: tighten the bar, and load the progress hairline with page depth (rAF-throttled)
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Lazy images and live data change the page height without a scroll event
    const ro = new ResizeObserver(onScroll);
    ro.observe(document.body);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [location.pathname]);

  // Close the mobile menu on route change
  useEffect(() => { setIsOpen(false); }, [location.pathname, setIsOpen]);

  // While the mobile menu is open: lock page scroll, close on Escape, move focus into the panel
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); toggleRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, setIsOpen]);

  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 z-50 transition-[background-color,border-color] duration-300',
          bannerVisible ? 'top-9' : 'top-0',
          scrolled || isOpen
            ? 'bg-ink-950/90 backdrop-blur-md border-b border-white/[0.06]'
            : 'bg-ink-950/60 backdrop-blur-sm border-b border-transparent',
        )}
      >
        <nav
          aria-label="Main"
          className={cn(
            'container flex items-center justify-between gap-6 transition-[height] duration-300 ease-out-expo',
            scrolled && !isOpen ? 'h-[calc(var(--nav-h)-0.5rem)]' : 'h-[var(--nav-h)]',
          )}
        >
          <Link to="/" className="flex shrink-0 items-center rounded-md" aria-label={`${SITE.name} — home`}>
            <img
              src="/images/logo.webp"
              alt=""
              width={406}
              height={286}
              className={cn('h-10 w-auto origin-left transition-transform duration-300 ease-out-expo md:h-11', scrolled && 'scale-90')}
            />
          </Link>
  
          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) => cn(
                    'relative block rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                    'after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-400 after:origin-left after:transition-transform after:duration-300 after:ease-out-expo',
                    isActive ? 'text-white after:scale-x-100' : 'text-ink-300 hover:text-white after:scale-x-0',
                  )}
                >
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
  
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/plans">Join now</Link>
            </Button>
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/5"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
            >
              {isOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
        {/* Page progress — the brand's progression line, loaded by scroll depth */}
        <span
          ref={progressRef}
          data-nav-progress
          className="absolute inset-x-0 -bottom-px h-px origin-left bg-brand-400"
          style={{ transform: 'scaleX(0)' }}
          aria-hidden
        />
      </header>

      {/* Mobile menu — full-height sheet below the bar. Rendered outside <header> because the
          header's backdrop-filter would otherwise become the containing block for position:fixed. */}
      <div
        id="mobile-menu"
        ref={panelRef}
        hidden={menu === 'closed'}
        data-state={menu}
        className="menu-curtain lg:hidden fixed inset-x-0 bottom-0 z-50 overflow-y-auto bg-ink-950"
        style={{ top: `calc(var(--nav-h) + ${bannerVisible ? '2.25rem' : '0px'})` }}
      >
        <div className="container flex min-h-full flex-col pb-10 pt-6">
          <ul className="flex flex-col">
            {NAV_ITEMS.map((item, i) => (
              <li key={item.href} className="menu-link border-b border-white/[0.06]" style={{ '--i': i } as React.CSSProperties}>
                <NavLink
                  to={item.href}
                  end={item.href === '/'}
                  className={({ isActive }) => cn(
                    'flex items-center justify-between py-4 font-display text-3xl font-bold uppercase tracking-wide transition-colors',
                    isActive ? 'text-brand-400' : 'text-white active:text-brand-300',
                  )}
                >
                  <span className="flex items-baseline gap-4">
                    <span className="w-6 font-sans text-xs font-semibold tabular-nums text-ink-500" aria-hidden>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {item.name}
                  </span>
                  <ArrowRight className="h-5 w-5 text-ink-500" aria-hidden />
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-3 pt-10">
            <Button asChild size="lg" className="w-full">
              <Link to="/plans">View membership plans</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
              <a href={SITE.phoneHref}><Phone /> Call {SITE.phone}</a>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navigation;
