import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle } from 'lucide-react';
import Footer from '../components/Footer';
import { submitEnquiry } from '../lib/api';

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
      // Save to backend so admin can view enquiries in dashboard
      await submitEnquiry(formData);
      setStatus('success');
      setFormData({ name: '', email: '', phone: '', plan: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  const planOptions = ['1 Day', '1 Month', '3 Months', '6 Months', '12 Months', 'General Enquiry'];

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl animate-pulse" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="text-5xl md:text-7xl font-heading font-black mb-6">
              <span className="text-white">GET IN</span>
              <br />
              <span className="neon-text">TOUCH WITH CRUNCH FITNESS</span>
            </h1>
            <p className="text-xl text-gray-400 font-body max-w-3xl mx-auto">
              Ready to start your fitness journey in Wakad, Pune? Contact us today for membership inquiries, personal training, or any questions about our facilities.
            </p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">

            {/* Contact info */}
            <div className={`transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
              <h2 className="text-3xl font-heading font-bold mb-8">
                <span className="text-white">VISIT OUR </span>
                <span className="neon-text">GYM</span>
              </h2>

              <div className="space-y-7">
                {[
                  {
                    icon: MapPin,
                    title: 'Address',
                    content: (
                      <a
                        href="https://www.google.com/maps/search/?api=1&query=Crunch+Fitness+Club+Wakad+Pune"
                        target="_blank" rel="noopener noreferrer"
                        className="hover:text-green-400 transition-colors"
                      >
                        2nd floor, Palash Plus, C Building<br />
                        Opposite Euro School, Wakad<br />
                        Maharashtra 411050, India
                      </a>
                    ),
                  },
                  {
                    icon: Phone,
                    title: 'Phone',
                    content: (
                      <>
                        <a href="tel:+918483048363" className="block hover:text-green-400 transition-colors">+91 84830 48363</a>
                      </>
                    ),
                  },
                  {
                    icon: Mail,
                    title: 'Email',
                    content: (
                      <>
                        <a href="mailto:Crunchfitness680@gmail.com" className="block hover:text-green-400 transition-colors">Crunchfitness680@gmail.com</a>
                      </>
                    ),
                  },
                  {
                    icon: Clock,
                    title: 'Hours',
                    content: (
                      <div className="space-y-1">
                        <p><time dateTime="Mo-Fr 06:00-22:00">Monday – Friday: 6:00 AM – 10:00 PM</time></p>
                        <p><time dateTime="Sa 06:00-22:00">Saturday: 6:00 AM – 10:00 PM</time></p>
                        <p><time dateTime="Su 06:00-12:00">Sunday: 6:00 AM – 12:00 PM</time></p>
                      </div>
                    ),
                  },
                ].map(({ icon: Icon, title, content }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-green-400/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-heading font-semibold mb-1">{title}</h3>
                      <div className="text-gray-400 font-body text-sm leading-relaxed">{content}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Map */}
              <div className="mt-10 rounded-2xl overflow-hidden border border-gray-800" style={{ height: '320px' }}>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.425823159867!2d73.7674834742727!3d18.599907366747868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b979fd8fdac5%3A0xd27c5a7f4bc4a76e!2sCrunch%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1748722317938!5m2!1sen!2sin"
                  width="100%" height="100%"
                  style={{ border: 0 }}
                  allowFullScreen loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Crunch Fitness Club location"
                />
              </div>
              {/* Get Directions button */}
              <a
                href="https://maps.google.com/?q=Crunch+Fitness+Club,+Pink+City+Road,+Wakad,+Pune"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/60 text-green-400 rounded-xl text-sm font-semibold transition-all duration-200"
              >
                <MapPin size={15} />
                Open in Google Maps
              </a>
            </div>

            {/* Form */}
            <div className={`transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
              <div className="bg-gray-900/60 rounded-2xl p-8 border border-gray-800">
                <h2 className="text-3xl font-heading font-bold mb-8 text-center">
                  <span className="text-white">SEND US A </span>
                  <span className="neon-text">MESSAGE</span>
                </h2>

                {status === 'success' ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white mb-2">Message Sent!</h3>
                    <p className="text-gray-400">We'll get back to you within 24 hours.</p>
                    <button
                      onClick={() => setStatus('idle')}
                      className="mt-6 px-6 py-2 border border-green-400 text-green-400 rounded-xl hover:bg-green-400 hover:text-black transition-all duration-300 text-sm font-semibold"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5" aria-label="Contact form">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-300 mb-1.5">Full Name *</label>
                        <input
                          id="name" name="name" type="text"
                          value={formData.name} onChange={handleChange}
                          placeholder="Your name"
                          autoComplete="name" required
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors font-body text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-1.5">Email *</label>
                        <input
                          id="email" name="email" type="email"
                          value={formData.email} onChange={handleChange}
                          placeholder="your@email.com"
                          autoComplete="email" required
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors font-body text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-gray-300 mb-1.5">Phone</label>
                        <input
                          id="phone" name="phone" type="tel"
                          value={formData.phone} onChange={handleChange}
                          placeholder="+91 XXXXX XXXXX"
                          autoComplete="tel"
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors font-body text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="plan" className="block text-sm font-semibold text-gray-300 mb-1.5">Interested In</label>
                        <select
                          id="plan" name="plan"
                          value={formData.plan} onChange={handleChange}
                          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-green-400 transition-colors font-body text-sm appearance-none cursor-pointer"
                        >
                          <option value="">Select a plan…</option>
                          {planOptions.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-semibold text-gray-300 mb-1.5">Message *</label>
                      <textarea
                        id="message" name="message" rows={5}
                        value={formData.message} onChange={handleChange}
                        placeholder="Tell us about your fitness goals…"
                        required
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors font-body text-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="w-full py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-xl hover:from-green-300 hover:to-green-500 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] font-heading flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {status === 'submitting' ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          SENDING…
                        </>
                      ) : (
                        <><Send className="w-4 h-4" /> SEND MESSAGE</>
                      )}
                    </button>

                    {/* WhatsApp alternative */}
                    <div className="flex items-center gap-3 my-1">
                      <div className="flex-1 h-px bg-gray-700" />
                      <span className="text-gray-500 text-xs">or</span>
                      <div className="flex-1 h-px bg-gray-700" />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const name = formData.name ? `Name: ${formData.name}` : '';
                        const phone = formData.phone ? `\nPhone: ${formData.phone}` : '';
                        const plan = formData.plan ? `\nInterested in: ${formData.plan}` : '';
                        const msg = formData.message ? `\nMessage: ${formData.message}` : '';
                        const text = encodeURIComponent(
                          `Hi! I'd like to book a visit to Crunch Fitness.${name ? `\n${name}` : ''}${phone}${plan}${msg}`
                        );
                        window.open(`https://wa.me/919762904097?text=${text}`, '_blank');
                      }}
                      className="w-full py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-heading flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 fill-white">
                        <path d="M16.003 2C8.28 2 2 8.28 2 16.003c0 2.478.654 4.845 1.797 6.9L2 30l7.283-1.77A13.944 13.944 0 0016.003 30C23.72 30 30 23.72 30 16.003 30 8.28 23.72 2 16.003 2zm0 25.524a11.51 11.51 0 01-5.908-1.626l-.424-.253-4.324 1.05 1.082-4.198-.277-.432A11.47 11.47 0 014.476 16c0-6.355 5.172-11.524 11.527-11.524S27.527 9.645 27.527 16c0 6.354-5.172 11.524-11.524 11.524zm6.32-8.631c-.346-.173-2.048-1.01-2.366-1.127-.317-.115-.548-.173-.779.173-.23.346-.892 1.127-1.094 1.358-.201.23-.403.26-.749.087-.346-.173-1.46-.538-2.781-1.716-1.028-.917-1.722-2.05-1.924-2.396-.202-.346-.021-.533.152-.705.156-.154.346-.403.519-.605.173-.202.23-.346.346-.577.115-.23.058-.432-.029-.605-.087-.173-.779-1.878-1.068-2.57-.28-.674-.565-.583-.779-.594l-.663-.011c-.23 0-.605.086-.923.432-.317.346-1.21 1.183-1.21 2.885s1.239 3.346 1.41 3.577c.173.23 2.44 3.72 5.912 5.216.826.357 1.47.57 1.972.729.829.264 1.583.226 2.179.137.665-.1 2.048-.837 2.337-1.645.289-.807.289-1.499.202-1.645-.086-.144-.317-.23-.663-.403z" />
                      </svg>
                      BOOK VIA WHATSAPP
                    </button>

                    {status === 'error' && (
                      <p className="text-center text-red-400 text-sm" role="alert">
                        Failed to send. Please try again or email us directly at Crunchfitness680@gmail.com
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
