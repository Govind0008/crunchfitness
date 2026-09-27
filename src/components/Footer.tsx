import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { SITE, HOURS_LABELS, whatsappLink } from '@/lib/site';

// Inline SVGs for social icons — avoids deprecated lucide social icon imports
const IgIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
const WaIcon = () => <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4" aria-hidden><path d="M16.003 2C8.28 2 2 8.28 2 16.003c0 2.478.654 4.845 1.797 6.9L2 30l7.283-1.77A13.944 13.944 0 0016.003 30C23.72 30 30 23.72 30 16.003 30 8.28 23.72 2 16.003 2zm0 25.524a11.51 11.51 0 01-5.908-1.626l-.424-.253-4.324 1.05 1.082-4.198-.277-.432A11.47 11.47 0 014.476 16c0-6.355 5.172-11.524 11.527-11.524S27.527 9.645 27.527 16c0 6.354-5.172 11.524-11.524 11.524zm6.32-8.631c-.346-.173-2.048-1.01-2.366-1.127-.317-.115-.548-.173-.779.173-.23.346-.892 1.127-1.094 1.358-.201.23-.403.26-.749.087-.346-.173-1.46-.538-2.781-1.716-1.028-.917-1.722-2.05-1.924-2.396-.202-.346-.021-.533.152-.705.156-.154.346-.403.519-.605.173-.202.23-.346.346-.577.115-.23.058-.432-.029-.605-.087-.173-.779-1.878-1.068-2.57-.28-.674-.565-.583-.779-.594l-.663-.011c-.23 0-.605.086-.923.432-.317.346-1.21 1.183-1.21 2.885s1.239 3.346 1.41 3.577c.173.23 2.44 3.72 5.912 5.216.826.357 1.47.57 1.972.729.829.264 1.583.226 2.179.137.665-.1 2.048-.837 2.337-1.645.289-.807.289-1.499.202-1.645-.086-.144-.317-.23-.663-.403z"/></svg>;

const EXPLORE = [
  { name: 'About', href: '/about-us' },
  { name: 'Team', href: '/team' },
  { name: 'Founder', href: '/founders' },
  { name: 'Gallery', href: '/gallery' },
  { name: 'Blog', href: '/blog' },
];

const MEMBERS = [
  { name: 'Membership plans', href: '/plans' },
  { name: 'Contact & visit', href: '/contact' },
  { name: 'Client portal', href: '/client/login' },
  { name: 'Trainer portal', href: '/trainer/login' },
];

const SOCIAL = [
  { icon: IgIcon, href: SITE.instagram, label: 'Instagram' },
  { icon: WaIcon, href: whatsappLink('Hi! I want to know more about Crunch Fitness.'), label: 'WhatsApp' },
];

const FooterHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{children}</h2>
);

const linkClass = 'text-sm text-ink-300 hover:text-white transition-colors';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <footer className="border-t border-white/[0.06] bg-ink-950">
      <div className="container py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8 [&>*]:min-w-0">
          {/* Brand + newsletter */}
          <div className="lg:col-span-4">
            <Link to="/" aria-label={`${SITE.name} — home`} className="inline-block rounded-md">
              <img src="/images/logo.webp" alt="" width={406} height={286} loading="lazy" className="h-12 w-auto" />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-400">
              A strength-first community gym in Wakad, Pune. Certified coaches, modern equipment, and plans for every goal.
            </p>

            <form onSubmit={handleSubscribe} className="mt-8 max-w-sm" noValidate>
              <label htmlFor="footer-email" className="text-sm font-medium text-white">Training tips & offers</label>
              <div className="mt-3 flex rounded-full border border-white/10 bg-ink-900 p-1 focus-within:border-brand-400 transition-colors">
                <input
                  id="footer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  aria-describedby="footer-email-status"
                  className="w-0 min-w-0 flex-1 bg-transparent px-4 text-sm text-white placeholder:text-ink-500 focus:outline-none focus-visible:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-400 px-4 text-sm font-semibold text-ink-950 hover:bg-brand-300 transition-colors"
                >
                  Subscribe <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p id="footer-email-status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-xs">
                {subStatus === 'success' && (
                  <span className="flex items-center gap-1.5 text-brand-400"><CheckCircle size={13} aria-hidden /> Subscribed — thanks for joining.</span>
                )}
                {subStatus === 'error' && (
                  <span className="flex items-center gap-1.5 text-red-400"><AlertCircle size={13} aria-hidden /> Please enter a valid email address.</span>
                )}
              </p>
            </form>
          </div>

          <nav aria-label="Explore" className="lg:col-span-2">
            <FooterHeading>Explore</FooterHeading>
            <ul className="space-y-3">
              {EXPLORE.map((l) => <li key={l.href}><Link to={l.href} className={linkClass}>{l.name}</Link></li>)}
            </ul>
          </nav>

          <nav aria-label="Members" className="lg:col-span-2">
            <FooterHeading>Members</FooterHeading>
            <ul className="space-y-3">
              {MEMBERS.map((l) => <li key={l.href}><Link to={l.href} className={linkClass}>{l.name}</Link></li>)}
            </ul>
          </nav>

          <div className="md:col-span-2 lg:col-span-4 grid gap-10 sm:grid-cols-2 lg:grid-cols-1 lg:gap-8">
            <div>
              <FooterHeading>Visit</FooterHeading>
              <address className="not-italic text-sm leading-relaxed text-ink-300">
                <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  {SITE.address.map((line) => <span key={line} className="block">{line}</span>)}
                </a>
                <a href={SITE.phoneHref} className="mt-4 block hover:text-white transition-colors">{SITE.phone}</a>
                <a href={`mailto:${SITE.email}`} className="mt-1 block hover:text-white transition-colors">{SITE.email}</a>
              </address>
            </div>
            <div>
              <FooterHeading>Hours</FooterHeading>
              <dl className="space-y-3 text-sm">
                {HOURS_LABELS.map((h) => (
                  <div key={h.days}>
                    <dt className="text-ink-400">{h.days}</dt>
                    <dd className="text-ink-200">{h.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col-reverse gap-6 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-500">© {currentYear} {SITE.name}. All rights reserved.</p>
          <ul className="flex gap-2">
            {SOCIAL.map(({ icon: Icon, href, label }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-ink-300 hover:border-white/30 hover:text-white transition-colors"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
