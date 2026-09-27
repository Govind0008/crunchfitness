import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle, FileText, ArrowUpRight, ChevronDown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/site/Section';
import { SITE } from '@/lib/site';
import Footer from '../components/Footer';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ─── Google Sheets integration via Google Apps Script ─────────────────────────
//
// SETUP STEPS:
// 1. Create a new Google Sheet (sheets.google.com)
// 2. Click Extensions → Apps Script
// 3. Paste this code and click Save:
//
//   function doPost(e) {
//     try {
//       var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//       var data = JSON.parse(e.postData.contents);
//       if (sheet.getLastRow() === 0) {
//         sheet.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Plan', 'Message']);
//       }
//       sheet.appendRow([
//         new Date().toLocaleString('en-IN'),
//         data.name || '',
//         data.email || '',
//         data.phone || '',
//         data.plan || '',
//         data.message || ''
//       ]);
//       return ContentService
//         .createTextOutput(JSON.stringify({ success: true }))
//         .setMimeType(ContentService.MimeType.JSON);
//     } catch(err) {
//       return ContentService
//         .createTextOutput(JSON.stringify({ success: false, error: err.message }))
//         .setMimeType(ContentService.MimeType.JSON);
//     }
//   }
//
// 4. Click Deploy → New deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL and paste it below
//
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxeHEI7dmWyZ-oP9JDoKAUAM4hPi8BylyRBEjkuAMo4-CDqbd-PYTwXLY7RlrCg3xEYjw/exec';
// ─────────────────────────────────────────────────────────────────────────────

const labelClass = 'mb-2 block text-sm font-medium text-ink-200';
const fieldClass =
  'h-12 w-full rounded-xl border border-white/10 bg-ink-950 px-4 text-sm text-white placeholder:text-ink-500 transition-colors focus:border-brand-400 focus:outline-none focus-visible:outline-none';

const Contact = () => {
  const location = useLocation();
  const preSelectedPlan = (location.state as { selectedPlan?: string } | null)?.selectedPlan ?? '';

  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    plan: preSelectedPlan,
    message: preSelectedPlan ? `I'm interested in the ${preSelectedPlan} membership plan.` : '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  useEffect(() => { setIsVisible(true); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      // Google Apps Script requires no-cors mode (response is opaque but data is received)
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      // Also save to Firestore so admin can view enquiries in dashboard
      await addDoc(collection(db, 'enquiries'), {
        ...formData,
        submittedAt: serverTimestamp(),
        status: 'new',
        read: false,
      });
      setStatus('success');
      setFormData({ name: '', email: '', phone: '', plan: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  const planOptions = ['1 Day', '1 Month', '3 Months', '6 Months', '12 Months', 'General Enquiry'];
  // Keep a plan chosen elsewhere (e.g. a Firestore plan name) selectable
  const options = formData.plan && !planOptions.includes(formData.plan) ? [formData.plan, ...planOptions] : planOptions;

  const bookViaWhatsApp = () => {
    const name = formData.name ? `Name: ${formData.name}` : '';
    const phone = formData.phone ? `\nPhone: ${formData.phone}` : '';
    const plan = formData.plan ? `\nInterested in: ${formData.plan}` : '';
    const msg = formData.message ? `\nMessage: ${formData.message}` : '';
    const text = encodeURIComponent(
      `Hi! I'd like to book a visit to Crunch Fitness.${name ? `\n${name}` : ''}${phone}${plan}${msg}`
    );
    window.open(`https://wa.me/919762904097?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen">
      <main>
        <PageHeader
          eyebrow="Contact & visit"
          title={<>Come train <span className="text-brand-400">with us</span></>}
          lede="Questions about memberships, personal training or the facility? Send a message and we'll get back to you within 24 hours — or drop in for a free tour."
          image={{ src: '/images/gym-wide-1600.webp', srcSet: '/images/gym-wide-800.webp 800w, /images/gym-wide-1600.webp 1600w', alt: '' }}
        />

        <section className="container pb-section pt-12 md:pt-16">
          <div className={`grid gap-10 lg:grid-cols-12 lg:gap-16 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

            {/* Form */}
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-6 sm:p-8 md:p-10">
                {status === 'success' ? (
                  <div className="py-10 text-center animate-scale-in" role="status">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-400/15">
                      <CheckCircle className="h-7 w-7 text-brand-400" aria-hidden />
                    </span>
                    <h2 className="mt-6 font-display text-display-sm font-bold uppercase text-white">Message sent</h2>
                    <p className="mt-2 text-ink-400">Thanks — we&apos;ll get back to you within 24 hours.</p>
                    <Button variant="outline" className="mt-8" onClick={() => setStatus('idle')}>
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5" aria-labelledby="contact-form-heading">
                    <div>
                      <h2 id="contact-form-heading" className="font-display text-display-sm font-bold uppercase text-white">Send a message</h2>
                      <p className="mt-1 text-sm text-ink-400">Fields marked * are required.</p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="name" className={labelClass}>Full name *</label>
                        <input id="name" name="name" type="text" value={formData.name} onChange={handleChange}
                          placeholder="Your name" autoComplete="name" required className={fieldClass} />
                      </div>
                      <div>
                        <label htmlFor="email" className={labelClass}>Email *</label>
                        <input id="email" name="email" type="email" value={formData.email} onChange={handleChange}
                          placeholder="you@email.com" autoComplete="email" required className={fieldClass} />
                      </div>
                      <div>
                        <label htmlFor="phone" className={labelClass}>Phone</label>
                        <input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange}
                          placeholder="+91 XXXXX XXXXX" autoComplete="tel" className={fieldClass} />
                      </div>
                      <div>
                        <label htmlFor="plan" className={labelClass}>Interested in</label>
                        <div className="relative">
                          <select id="plan" name="plan" value={formData.plan} onChange={handleChange}
                            className={`${fieldClass} cursor-pointer appearance-none pr-10`}>
                            <option value="">Select a plan…</option>
                            {options.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className={labelClass}>Message *</label>
                      <textarea id="message" name="message" rows={5} value={formData.message} onChange={handleChange}
                        placeholder="Tell us about your fitness goals…" required
                        className={`${fieldClass} h-auto resize-y py-3`} />
                    </div>

                    {status === 'error' && (
                      <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">
                        Failed to send. Please try again or email us directly at {SITE.email}
                      </p>
                    )}

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                      <Button type="submit" size="lg" disabled={status === 'submitting'} className="sm:flex-1">
                        {status === 'submitting' ? (
                          <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> Sending…</>
                        ) : (
                          <><Send /> Send message</>
                        )}
                      </Button>
                      <Button type="button" size="lg" variant="whatsapp" onClick={bookViaWhatsApp} className="sm:flex-1">
                        <MessageCircle /> Book via WhatsApp
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              {/* Health assessment */}
              <a
                href={SITE.healthFormUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-6 flex items-center gap-5 rounded-2xl border border-white/[0.08] p-6 transition-colors hover:border-white/20"
              >
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-400/10 sm:flex">
                  <FileText className="h-5 w-5 text-brand-400" aria-hidden />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-white">Detailed health assessment form</span>
                  <span className="mt-1 block text-sm text-ink-400">
                    Share your health history and goals so we can build your personalised training plan.
                  </span>
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-ink-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>

            {/* Visit details */}
            <aside className="lg:col-span-5" aria-label="Visit details">
              <dl className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
                {[
                  {
                    icon: MapPin, title: 'Address',
                    content: (
                      <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                        {SITE.address.map((l) => <span key={l} className="block">{l}</span>)}
                      </a>
                    ),
                  },
                  { icon: Phone, title: 'Phone', content: <a href={SITE.phoneHref} className="hover:text-white transition-colors">{SITE.phone}</a> },
                  { icon: Mail, title: 'Email', content: <a href={`mailto:${SITE.email}`} className="hover:text-white transition-colors [overflow-wrap:anywhere]">{SITE.email}</a> },
                  {
                    icon: Clock, title: 'Hours',
                    content: (
                      <div className="space-y-1">
                        <p><time dateTime="Mo-Sa 06:00-22:00">Monday – Saturday: 6:00 AM – 10:00 PM</time></p>
                        <p><time dateTime="Su 06:00-12:00">Sunday: 6:00 AM – 12:00 PM</time></p>
                      </div>
                    ),
                  },
                ].map(({ icon: Icon, title, content }) => (
                  <div key={title} className="flex gap-4 py-5">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" aria-hidden />
                    <div>
                      <dt className="text-sm font-semibold text-white">{title}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-ink-300">{content}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-8 aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900">
                <iframe
                  src={SITE.mapsEmbed}
                  width="100%" height="100%"
                  style={{ border: 0 }}
                  allowFullScreen loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Map showing Crunch Fitness Club in Wakad, Pune"
                />
              </div>
              <Button asChild variant="outline" className="mt-4 w-full">
                <a href="https://maps.google.com/?q=Crunch+Fitness+Club,+Pink+City+Road,+Wakad,+Pune" target="_blank" rel="noopener noreferrer">
                  <MapPin /> Get directions
                </a>
              </Button>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
