import { useState } from 'react';
import { MapPin, Phone, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';

// Inline SVGs for social icons — avoids deprecated lucide social icon imports
const FbIcon  = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
const IgIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
const XIcon   = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubscribe = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setSubStatus('error');
      setTimeout(() => setSubStatus('idle'), 3000);
      return;
    }
    // In production: hook this up to Mailchimp / SendGrid / your CRM
    console.log('Newsletter subscription:', email.trim());
    setSubStatus('success');
    setEmail('');
    setTimeout(() => setSubStatus('idle'), 4000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubscribe();
  };

  return (
    <footer className="bg-black border-t border-green-400/20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-400/4 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center mb-6">
                <img
                  src="/lovable-uploads/crunch.png"
                  alt="Crunch Fitness Club Logo"
                  className="h-16 w-auto object-contain"
                />
              </div>
              <p className="text-gray-400 font-rajdhani text-base mb-6 max-w-md leading-relaxed">
                Redefine your strength and unlock your potential at the most advanced fitness facility in the city.
              </p>
              <div className="flex gap-3">
                {[
                  { icon: FbIcon,  href: '#', label: 'Facebook'  },
                  { icon: IgIcon, href: 'https://www.instagram.com/crunchfitnessclub', label: 'Instagram' },
                  { icon: XIcon,   href: '#', label: 'X (Twitter)'   },
                ].map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-10 h-10 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:bg-green-400 hover:text-black hover:border-green-400 transition-all duration-300 hover:scale-110"
                  >
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-white font-orbitron font-bold text-base mb-5">Contact Info</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <address className="not-italic text-gray-400 font-rajdhani text-sm leading-relaxed">
                    2nd floor, Palash Plus, C Building<br />
                    Opposite Euro School, Wakad<br />
                    Maharashtra 411050
                  </address>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <a href="tel:+918483048363" className="text-gray-400 font-rajdhani text-sm hover:text-green-400 transition-colors">
                    +91 84830 48363
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <a href="mailto:Crunchfitness680@gmail.com" className="text-gray-400 font-rajdhani text-sm hover:text-green-400 transition-colors">
                    Crunchfitness680@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* Hours + Newsletter */}
            <div>
              <h3 className="text-white font-orbitron font-bold text-base mb-5">Hours</h3>
              <div className="flex items-start gap-3 mb-6">
                <Clock className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-gray-400 font-rajdhani text-sm space-y-1">
                  <div>Mon – Fri: 6:00 AM – 10:00 PM</div>
                  <div>Saturday: 6:00 AM – 10:00 PM</div>
                  <div>Sunday: 6:00 AM – 12:00 PM</div>
                </div>
              </div>

              {/* Newsletter */}
              <h4 className="text-white font-orbitron font-semibold text-sm mb-3">Stay Updated</h4>
              <div className="flex">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your email"
                  autoComplete="email"
                  className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400 font-rajdhani text-sm transition-colors"
                />
                <button
                  onClick={handleSubscribe}
                  className="px-4 py-2 bg-green-400 text-black text-sm font-bold rounded-r-lg hover:bg-green-300 transition-colors duration-300 font-rajdhani whitespace-nowrap"
                >
                  Subscribe
                </button>
              </div>
              {subStatus === 'success' && (
                <p className="flex items-center gap-1.5 text-green-400 text-xs mt-2">
                  <CheckCircle size={13} /> Subscribed! Thanks for joining.
                </p>
              )}
              {subStatus === 'error' && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2">
                  <AlertCircle size={13} /> Please enter a valid email address.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 font-rajdhani text-sm">
              © {currentYear} Crunch Fitness Club. All rights reserved.
            </p>
            <div className="flex gap-6">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
                <a key={link} href="#" className="text-gray-500 hover:text-green-400 transition-colors duration-300 font-rajdhani text-sm">
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
