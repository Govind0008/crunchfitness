import React, { useState } from 'react';
import { ArrowUpRight, ClipboardList, ExternalLink, Flame } from 'lucide-react';
import { Section, SectionHeader } from '@/components/site/Section';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import BMICalculator from '@/components/BMICalculator';

interface Tool {
  id: string;
  icon: React.ReactNode;
  kind: string;
  title: string;
  description: string;
  formUrl: string;
}

const tools: Tool[] = [
  {
    id: 'gut',
    icon: <ClipboardList className="h-5 w-5" aria-hidden />,
    kind: 'Free assessment',
    title: 'Gut health assessment',
    description: 'A few quick questions on how well your gut is functioning, with actionable tips to improve digestive health.',
    formUrl: 'https://docs.google.com/forms/d/1UkjUJdXZzltbMA5jGuOhii94HBd-Zh_U3ult4yEUs2E/viewform',
  },
  {
    id: 'inflammation',
    icon: <Flame className="h-5 w-5" aria-hidden />,
    kind: 'Free quiz',
    title: 'Inflammation spectrum quiz',
    description: 'Find where you fall on the inflammation spectrum and which lifestyle changes can help reduce chronic inflammation.',
    formUrl: 'https://docs.google.com/forms/d/1PGOqVsTIAQPMJtwxXWkNGBFOnnYhkTvXaFEkcyjUjP8/viewform',
  },
];

const FreeToolsSection: React.FC = () => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTool = tools.find((t) => t.id === activeId);

  return (
    <Section id="tools" aria-labelledby="tools-heading">
      <SectionHeader
        id="tools-heading"
        eyebrow="Free health tools"
        title="Know your starting point"
        lede="Check your BMI and take our coaches' quick assessments — no sign-up, completely free."
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="stagger" style={{ '--i': 0 } as React.CSSProperties}>
          <BMICalculator />
        </div>

        <ul className="flex flex-col gap-4">
          {tools.map((tool, i) => (
            <li key={tool.id} className="stagger flex-1" style={{ '--i': i + 1 } as React.CSSProperties}>
              <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-ink-900 p-6 transition-colors hover:border-white/20 md:p-8">
                <div className="flex items-center gap-3 text-brand-400">
                  {tool.icon}
                  <span className="text-xs font-semibold uppercase tracking-wider">{tool.kind}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl font-bold uppercase text-white">{tool.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{tool.description}</p>
                <div className="mt-6 flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => setActiveId(tool.id)}
                    className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-brand-400 transition-colors"
                  >
                    Start now
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </button>
                  <a
                    href={tool.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open in new tab
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={!!activeTool} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent className="flex h-[90svh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          {activeTool && (
            <>
              <div className="border-b border-white/[0.08] px-6 py-4 pr-14">
                <DialogDescription className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                  {activeTool.kind}
                </DialogDescription>
                <DialogTitle className="mt-1 font-display text-2xl font-bold uppercase text-white">
                  {activeTool.title}
                </DialogTitle>
              </div>
              <iframe
                src={activeTool.formUrl}
                className="w-full flex-1 bg-white"
                title={activeTool.title}
              >
                Loading…
              </iframe>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
};

export default FreeToolsSection;
