import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Section } from '@/components/site/Section';
import { TickRail } from '@/components/motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { whatsappLink } from '@/lib/site';

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
    a: 'No, we do not have separate batches for beginners. However, our certified trainers are always available to provide personalised guidance and support to help you get started, regardless of your experience level.',
  },
  {
    q: 'What is the policy for membership cancellation?',
    a: "Memberships can't be cancelled. However, you can freeze your membership for up to 1 month in a calendar year for a nominal fee. Contact our team for help with freezing your membership.",
  },
];

const FAQSection: React.FC = () => (
  <Section aria-labelledby="faq-heading">
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-4">
        <p className="eyebrow mb-4">
          <TickRail className="w-8" />
          <span className="m-rise" style={{ '--d': 120 } as React.CSSProperties}>FAQ</span>
        </p>
        <h2 id="faq-heading" className="font-display text-display-md font-bold uppercase text-white text-balance">
          <span className="m-line"><span style={{ '--d': 80 } as React.CSSProperties}>Good questions</span></span>
        </h2>
        <p className="m-rise mt-4 text-ink-300" style={{ '--d': 220 } as React.CSSProperties}>Memberships, facilities and how things work at Crunch.</p>
        <div className="m-rise mt-8" style={{ '--d': 300 } as React.CSSProperties}>
        <Button asChild variant="outline">
          <a
            href={whatsappLink('Hi! I have a question about Crunch Fitness.')}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle /> Ask us on WhatsApp
          </a>
        </Button>
        </div>
      </div>

      <Accordion type="single" collapsible className="lg:col-span-8 border-t border-white/[0.08]">
        {faqs.map((faq, i) => (
          <AccordionItem key={faq.q} value={`faq-${i}`} className="stagger border-white/[0.08]" style={{ '--i': i } as React.CSSProperties}>
            <AccordionTrigger className="gap-6 py-6 text-left text-base font-semibold text-white hover:no-underline hover:text-brand-400 md:text-lg [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-ink-400">
              {faq.q}
            </AccordionTrigger>
            <AccordionContent className="max-w-2xl pb-6 text-base leading-relaxed text-ink-300">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </Section>
);

export default FAQSection;
