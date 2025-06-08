import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Sparkles } from 'lucide-react';

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about-us' },
    { name: 'Team', href: '/team' },
    { name: 'Founder', href: '/founders' }, // NEW: Added Founders route
    { name: 'Gallery', href: '/gallery' },
    { name: 'Plans', href: '/plans' },
    { name: 'Contact', href: '/contact' },
  ];

  const isActive = (href: string) => {
    if (href === '/' && location.pathname === '/') return true;
    if (href !== '/' && location.pathname.startsWith(href)) return true;
    return false;
  };

  const handleJoinNow = () => {
    navigate('/plans');
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled
        ? 'bg-black/95 backdrop-blur-xl border-b border-green-500/20 shadow-lg shadow-green-500/10'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-28">
          {/* Enhanced Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <img
                  src="/lovable-uploads/crunch.png"
                  alt="Crunch Logo"
                  className="w-36 h-36 rounded-xl object-cover shadow-xl transform group-hover:scale-110 transition-all duration-300 group-hover:rotate-3"
                />
              </div>
              <div>
                {/* Keeping this div for potential future text or spacing if needed */}
              </div>
            </Link>
          </div>

          {/* Enhanced Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-16 flex items-center space-x-3">
              {navItems.map((item, index) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`relative px-5 py-3 rounded-lg text-base font-medium font-rajdhani transition-all duration-300 transform hover:scale-105 group ${
                    isActive(item.href)
                      ? 'text-green-400 bg-green-500/10 text-shadow-active'
                      : 'text-white hover:text-green-400 hover:bg-green-500/5'
                  }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <span className="relative z-10">{item.name}</span>
                  <div className={`absolute inset-0 rounded-lg bg-gradient-to-r from-green-500/20 to-green-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive(item.href) ? 'opacity-100' : ''}`}></div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
                </Link>
              ))}
              <button
                onClick={handleJoinNow}
                className="relative ml-8 bg-gradient-to-r from-green-400 via-green-500 to-green-600 text-black px-8 py-3 rounded-full font-bold font-rajdhani hover:from-green-300 hover:via-green-400 hover:to-green-500 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl hover:shadow-green-500/25 group overflow-hidden"
              >
                <span className="relative z-10 flex items-center space-x-2">
                  <span>JOIN NOW</span>
                  <Sparkles className="w-4 h-4 group-hover:animate-spin" />
                </span>
                <div className="absolute inset-0 border border-transparent group-hover:border-white/20 rounded-full transition-all duration-300 pointer-events-none"></div>
              </button>
            </div>
          </div>

          {/* Enhanced Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white hover:text-green-400 p-2 rounded-lg hover:bg-green-500/10 transition-all duration-300 transform hover:scale-110"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Mobile Navigation */}
      <div className={`md:hidden transition-all duration-300 transform-origin-top ${isOpen ? 'max-h-screen opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-0'} overflow-hidden`}>
        <div className="bg-black/95 backdrop-blur-xl border-t border-green-500/20">
          <div className="px-4 pt-4 pb-6 space-y-2">
            {navItems.map((item, index) => (
              <Link
                key={item.name}
                to={item.href}
                className={`block px-5 py-3 rounded-lg text-base font-medium font-rajdhani transition-all duration-300 transform hover:translate-x-2 ${
                  isActive(item.href)
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-white hover:text-green-400 hover:bg-green-500/5'
                }`}
                onClick={() => setIsOpen(false)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {item.name}
              </Link>
            ))}
            <button
              onClick={() => {
                handleJoinNow();
                setIsOpen(false);
              }}
              className="block w-full mt-4 bg-gradient-to-r from-green-400 to-green-600 text-black px-6 py-3 rounded-full font-bold font-rajdhani hover:from-green-300 hover:to-green-500 transition-all duration-300 transform hover:scale-105"
            >
              JOIN NOW
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;