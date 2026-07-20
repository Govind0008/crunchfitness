import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const faqs = [
  {
    q: 'Can I bring a guest for a trial session?',
    a: 'Absolutely! You can bring a guest for a complimentary one-day trial. Just register at the front desk with a valid ID. Guests must be accompanied by an active member at all times.',
  },
  {
    q: 'What facilities are included in my membership?',
    a: 'All memberships include full access to the gym floor, cardio zone, free weights, and group fitness classes (Zumba, etc.). Personal training sessions are available at an additional charge.',
  },
  {
    q: 'Are there separate batches for beginners?',
    a: 'No, we do not have separate batches for beginners. However, our certified trainers are always available to provide personalized guidance and support to help you get started on your fitness journey, regardless of your experience level.',
  },
  {
    q: 'What is the policy for membership cancellation?',
    a: 'Can-not cancel membership. However, you can freeze your membership for up to 1 months in a calendar year with a nominal fee. Please contact our support team for assistance with freezing your membership.',
  },
];

interface FAQItemProps {
  faq: { q: string; a: string };
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}

const FAQItem: React.FC<FAQItemProps> = ({ faq, index, isOpen, onToggle }) => {
  const ref = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="reveal border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/60 hover:border-zinc-700 transition-colors duration-200"
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-white font-semibold text-sm sm:text-base">{faq.q}</span>
        <ChevronDown
          size={18}
          className={`text-green-400 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">{faq.a}</p>
      </div>
    </div>
  );
};

const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headingRef = useScrollReveal<HTMLDivElement>();

  return (
    <section className="py-20 bg-gradient-to-b from-black via-zinc-950 to-black relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-green-500/4 rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-4 relative">
        {/* Header */}
        <div ref={headingRef} className="reveal text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-4">
            <span className="text-green-400 text-sm font-medium tracking-wider uppercase">Got Questions?</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-3">
            Frequently Asked <span className="neon-text">Questions</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Everything you need to know about memberships, facilities, and more.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              index={i}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 text-center">
          <p className="text-gray-500 text-sm">
            Still have questions?{' '}
            <a
              href="https://wa.me/918483048363?text=Hi!%20I%20have%20a%20question%20about%20Crunch%20Fitness."
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 font-semibold transition-colors"
            >
              Chat with us on WhatsApp →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
