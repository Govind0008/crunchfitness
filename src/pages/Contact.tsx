import { useState, useEffect } from 'react';
import { MapPin, Phone, Mail, Clock, Send } from 'lucide-react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';

const Contact = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  // IMPORTANT: Replace with your actual Google Form details
  // 1. Go to your Google Form.
  // 2. Click 'Send' button.
  // 3. Select the 'Embed HTML' tab.
  // 4. Copy the 'src' URL from the iframe code – this is your action URL.
  // 5. To get field names (entry.xxxxxxxxx):
  //    - Open your Google Form in a browser (the live form, not edit mode).
  //    - Open browser developer tools (F12).
  //    - Inspect each input field. The 'name' attribute (e.g., name="entry.123456789") is the ID you need.
  const GOOGLE_FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse';
  const GOOGLE_FORM_FIELD_NAMES = {
    name: 'entry.YOUR_NAME_ENTRY_ID',
    email: 'entry.YOUR_EMAIL_ENTRY_ID',
    phone: 'entry.YOUR_PHONE_ENTRY_ID',
    message: 'entry.YOUR_MESSAGE_ENTRY_ID'
  };

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionStatus('submitting');

    const data = new FormData();
    data.append(GOOGLE_FORM_FIELD_NAMES.name, formData.name);
    data.append(GOOGLE_FORM_FIELD_NAMES.email, formData.email);
    data.append(GOOGLE_FORM_FIELD_NAMES.phone, formData.phone);
    data.append(GOOGLE_FORM_FIELD_NAMES.message, formData.message);

    try {
      const response = await fetch(GOOGLE_FORM_ACTION_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: data,
      });

      setSubmissionStatus('success');
      setFormData({ name: '', email: '', phone: '', message: '' });

    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmissionStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl animate-pulse"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-5xl md:text-7xl font-heading font-black mb-6">
              <span className="text-white">GET IN</span>
              <br />
              <span className="neon-text">TOUCH WITH CRUNCH FITNESS</span>
            </h1>
            <p className="text-xl text-gray-400 font-body max-w-3xl mx-auto">
              Ready to start your fitness journey in Wakad, Pune? Contact Crunch Fitness Club today for membership inquiries, personal training, or any questions about our state-of-the-art gym facilities. Let's transform your life together!
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">

            {/* Contact Info */}
            <div className={`transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
              <h2 className="text-3xl font-heading font-bold mb-8">
                <span className="text-white">VISIT OUR</span> <span className="neon-text">GYM</span>
              </h2>

              <div className="space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-heading font-semibold text-lg mb-2">Address</h3>
                    <address className="not-italic text-gray-400 font-body">
                      {/* Updated Address */}
                      <a href="https://www.google.com/maps/search/?api=1&query=2nd+floor,+Palash+Plus,+C+Building,+opposite+Euro+School,+Wakad,+Maharashtra+411050,+India" target="_blank" rel="noopener noreferrer" className="hover:text-green-400 transition-colors">
                        2nd floor, Palash Plus, C Building<br />
                        Opposite Euro School, Wakad<br />
                        Maharashtra 411050, India
                      </a>
                    </address>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-heading font-semibold text-lg mb-2">Phone</h3>
                    <p className="text-gray-400 font-body">
                      <a href="tel:+918888888888" className="hover:text-green-400 transition-colors">+91 88888 88888</a>
                    </p>
                    <p className="text-gray-400 font-body">
                      <a href="tel:+917777777777" className="hover:text-green-400 transition-colors">+91 77777 77777</a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-heading font-semibold text-lg mb-2">Email</h3>
                    <p className="text-gray-400 font-body">
                      <a href="mailto:info@crunchfitness.fit" className="hover:text-green-400 transition-colors">info@crunchfitness.fit</a>
                    </p>
                    <p className="text-gray-400 font-body">
                      <a href="mailto:support@crunchfitness.fit" className="hover:text-green-400 transition-colors">support@crunchfitness.fit</a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-400/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-heading font-semibold text-lg mb-2">Hours</h3>
                    <div className="text-gray-400 font-body space-y-1">
                      <p><time dateTime="Mo-Fr 05:00-23:00">Monday - Friday: 5:00 AM - 11:00 PM</time></p>
                      <p><time dateTime="Sa 06:00-22:00">Saturday: 6:00 AM - 10:00 PM</time></p>
                      <p><time dateTime="Su 07:00-21:00">Sunday: 7:00 AM - 9:00 PM</time></p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Map */}
              <div className="mt-12 h-64 bg-gray-800 rounded-2xl glass-morphism overflow-hidden border border-gray-700">
                {/* IMPORTANT: Replace "YOUR_GENERATED_Maps_EMBED_URL_HERE" with the actual URL from Google Maps */}
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.425823159867!2d73.7674834742727!3d18.599907366747868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b979fd8fdac5%3A0xd27c5a7f4bc4a76e!2sCrunch%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1748722317938!5m2!1sen!2sin" // <--- This line is now correct!
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Crunch Fitness Club, Wakad, Pune Location on Google Maps"
                  aria-label="Location of Crunch Fitness Club at Palash Plus, Wakad, Pune on Google Maps"
                ></iframe>
              </div>
            </div>

            {/* Contact Form */}
            <div className={`transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <div className="bg-gray-900/50 rounded-2xl p-8 glass-morphism border border-gray-800">
                <h2 className="text-3xl font-heading font-bold mb-8 text-center">
                  <span className="text-white">SEND US A</span> <span className="neon-text">MESSAGE</span>
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6" aria-label="Contact Us Form">
                  <div>
                    <label htmlFor="name" className="sr-only">Your Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="Your Name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors duration-300 font-body"
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="sr-only">Your Email</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="Your Email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors duration-300 font-body"
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="sr-only">Your Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      placeholder="Your Phone Number"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors duration-300 font-body"
                      autoComplete="tel"
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="sr-only">Your Message</label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      placeholder="Your Message"
                      value={formData.message}
                      onChange={handleInputChange}
                      className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors duration-300 font-body resize-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-green-400 to-green-600 text-black font-bold rounded-xl hover:neon-glow transition-all duration-300 transform hover:scale-105 font-heading flex items-center justify-center space-x-2"
                    disabled={submissionStatus === 'submitting'}
                    aria-live="polite"
                  >
                    {submissionStatus === 'submitting' ? (
                      <span className="flex items-center space-x-2">
                           <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                         <span>SENDING...</span>
                       </span>
                    ) : (
                      <span className="flex items-center space-x-2">
                        <Send className="w-5 h-5" />
                        <span>SEND MESSAGE</span>
                      </span>
                    )}
                  </button>

                  {submissionStatus === 'success' && (
                    <p className="text-center text-green-500 font-body mt-4" role="status">
                      Message sent successfully! We'll get back to you soon.
                    </p>
                  )}
                  {submissionStatus === 'error' && (
                    <p className="text-center text-red-500 font-body mt-4" role="alert">
                      Failed to send message. Please try again later or contact us directly.
                    </p>
                  )}
                </form>
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