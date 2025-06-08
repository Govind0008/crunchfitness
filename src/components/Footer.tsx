
import { MapPin, Phone, Mail, Clock, Facebook, Instagram, Twitter } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black border-t border-green-400/20 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-green-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-green-600 rounded-lg flex items-center justify-center neon-glow">
                  <span className="text-black font-bold text-2xl font-orbitron">C</span>
                </div>
                <span className="text-white font-orbitron font-bold text-2xl">
                  CRUNCH <span className="neon-text">FITNESS</span>
                </span>
              </div>
              <p className="text-gray-400 font-rajdhani text-lg mb-6 max-w-md">
                Redefine your strength and unlock your potential at the most advanced fitness facility in the city.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-green-400 hover:text-black transition-all duration-300 hover:neon-glow">
                  <Facebook size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-green-400 hover:text-black transition-all duration-300 hover:neon-glow">
                  <Instagram size={20} />
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white hover:bg-green-400 hover:text-black transition-all duration-300 hover:neon-glow">
                  <Twitter size={20} />
                </a>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-white font-orbitron font-bold text-lg mb-6">Contact Info</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                  <span className="text-gray-400 font-rajdhani">
                    123 Fitness Street<br />
                    New York, NY 10001
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-gray-400 font-rajdhani">(555) 123-4567</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-gray-400 font-rajdhani">info@crunchfitness.com</span>
                </div>
              </div>
            </div>

            {/* Hours */}
            <div>
              <h3 className="text-white font-orbitron font-bold text-lg mb-6">Hours</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div className="text-gray-400 font-rajdhani">
                    <div>Mon - Fri: 5:00 AM - 11:00 PM</div>
                    <div>Sat - Sun: 6:00 AM - 10:00 PM</div>
                  </div>
                </div>
              </div>
              
              {/* Newsletter Signup */}
              <div className="mt-8">
                <h4 className="text-white font-orbitron font-semibold mb-4">Stay Updated</h4>
                <div className="flex">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-400 font-rajdhani"
                  />
                  <button className="px-4 py-2 bg-green-400 text-black font-semibold rounded-r-lg hover:bg-green-300 transition-colors duration-300 font-rajdhani">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-500 font-rajdhani text-sm mb-4 md:mb-0">
              © {currentYear} Crunch Fitness Club. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-500 hover:text-green-400 transition-colors duration-300 font-rajdhani text-sm">
                Privacy Policy
              </a>
              <a href="#" className="text-gray-500 hover:text-green-400 transition-colors duration-300 font-rajdhani text-sm">
                Terms of Service
              </a>
              <a href="#" className="text-gray-500 hover:text-green-400 transition-colors duration-300 font-rajdhani text-sm">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
