import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Sparkles } from 'lucide-react';

const Navigation = ({ bannerVisible = false }: { bannerVisible?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Home',    href: '/' },
    { name: 'About',   href: '/about-us' },
    { name: 'Team',    href: '/team' },
    { name: 'Founder', href: '/founders' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Blog',    href: '/blog' },
    { name: 'Plans',   href: '/plans' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <nav
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        bannerVisible ? 'top-9' : 'top-0'
      } ${
        scrolled
          ? 'bg-black/95 backdrop-blur-xl border-b border-green-500/20 shadow-lg shadow-green-500/10'
          : 'bg-black/60 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-28">

          {/* Logo — fixed proportional size, no overflow */}
          <Link to="/" className="flex-shrink-0 flex items-center group">
            <img
              src="/lovable-uploads/crunch.png"
              alt="Crunch Fitness Club"
              className="h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`relative px-4 py-2.5 rounded-lg text-sm font-semibold font-rajdhani transition-all duration-300 group ${
                  isActive(item.href)
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-white hover:text-green-400 hover:bg-green-500/5'
                }`}
              >
                <span className="relative z-10">{item.name}</span>
                {/* Active / hover underline */}
                <span
                  className={`absolute bottom-1 left-4 right-4 h-px bg-gradient-to-r from-green-400 to-green-500 transition-transform duration-300 origin-left ${
                    isActive(item.href) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                />
              </Link>
            ))}

            <button
              onClick={() => navigate('/plans')}
              className="ml-4 flex items-center gap-2 bg-gradient-to-r from-green-400 to-green-600 text-black px-6 py-2.5 rounded-full text-sm font-bold font-rajdhani hover:from-green-300 hover:to-green-500 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 active:scale-95"
            >
              JOIN NOW
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white hover:text-green-400 p-2 rounded-lg hover:bg-green-500/10 transition-all duration-300"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu — max-h transition (no scale-y clipping) */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-black/98 backdrop-blur-xl border-t border-green-500/20 px-4 pt-4 pb-6 space-y-1">
          {navItems.map((item, index) => (
            <Link
              key={item.name}
              to={item.href}
              className={`block px-4 py-3 rounded-lg text-base font-semibold font-rajdhani transition-all duration-200 ${
                isActive(item.href)
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-white hover:text-green-400 hover:bg-green-500/5 hover:translate-x-1'
              }`}
              style={{ transitionDelay: isOpen ? `${index * 30}ms` : '0ms' }}
            >
              {item.name}
            </Link>
          ))}
          <button
            onClick={() => { navigate('/plans'); setIsOpen(false); }}
            className="w-full mt-3 bg-gradient-to-r from-green-400 to-green-600 text-black px-6 py-3 rounded-full font-bold font-rajdhani hover:from-green-300 hover:to-green-500 transition-all duration-300 active:scale-95"
          >
            JOIN NOW
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
