import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle } from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

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
      setStatus('success');
      setFormData({ name: '', email: '', phone: '', plan: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  const planOptions = ['1 Day', '1 Month', '3 Months', '6 Months', '12 Months', 'General Enquiry'];

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

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
                        <a href="tel:+918888888888" className="block hover:text-green-400 transition-colors">+91 88888 88888</a>
                        <a href="tel:+917777777777" className="block hover:text-green-400 transition-colors">+91 77777 77777</a>
                      </>
                    ),
                  },
                  {
                    icon: Mail,
                    title: 'Email',
                    content: (
                      <>
                        <a href="mailto:info@crunchfitness.fit" className="block hover:text-green-400 transition-colors">info@crunchfitness.fit</a>
                        <a href="mailto:support@crunchfitness.fit" className="block hover:text-green-400 transition-colors">support@crunchfitness.fit</a>
                      </>
                    ),
                  },
                  {
                    icon: Clock,
                    title: 'Hours',
                    content: (
                      <div className="space-y-1">
                        <p><time dateTime="Mo-Fr 05:00-23:00">Monday – Friday: 5:00 AM – 11:00 PM</time></p>
                        <p><time dateTime="Sa 06:00-22:00">Saturday: 6:00 AM – 10:00 PM</time></p>
                        <p><time dateTime="Su 07:00-21:00">Sunday: 7:00 AM – 9:00 PM</time></p>
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
              <div className="mt-10 rounded-2xl overflow-hidden border border-gray-800 h-60">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.425823159867!2d73.7674834742727!3d18.599907366747868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b979fd8fdac5%3A0xd27c5a7f4bc4a76e!2sCrunch%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1748722317938!5m2!1sen!2sin"
                  width="100%" height="100%"
                  style={{ border: 0 }}
                  allowFullScreen loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Crunch Fitness Club location"
                />
              </div>
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

                    {status === 'error' && (
                      <p className="text-center text-red-400 text-sm" role="alert">
                        Failed to send. Please try again or email us directly at info@crunchfitness.fit
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
