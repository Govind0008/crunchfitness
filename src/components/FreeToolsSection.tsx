import React, { useState } from 'react';
import { ClipboardList, Flame, X, ExternalLink } from 'lucide-react';

interface Tool {
  id: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: string;
  title: string;
  highlight: string;
  description: string;
  formUrl: string;
  accentFrom: string;
  accentTo: string;
  glowColor: string;
}

const tools: Tool[] = [
  {
    id: 'gut',
    icon: <ClipboardList size={28} />,
    badge: 'Free Assessment',
    badgeColor: 'bg-green-500/10 border-green-500/20 text-green-400',
    title: 'Gut Health',
    highlight: 'Assessment',
    description:
      'Answer a few quick questions to discover how well your gut is functioning and get actionable tips to improve your digestive health.',
    formUrl:
      'https://docs.google.com/forms/d/1UkjUJdXZzltbMA5jGuOhii94HBd-Zh_U3ult4yEUs2E/viewform',
    accentFrom: 'from-green-500/10',
    accentTo: 'to-emerald-500/5',
    glowColor: 'bg-green-500/5',
  },
  {
    id: 'inflammation',
    icon: <Flame size={28} />,
    badge: 'Free Quiz',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    title: 'Inflammation',
    highlight: 'Spectrum Quiz',
    description:
      'Find out where you fall on the inflammation spectrum and learn which lifestyle changes can help reduce chronic inflammation in your body.',
    formUrl:
      'https://docs.google.com/forms/d/1PGOqVsTIAQPMJtwxXWkNGBFOnnYhkTvXaFEkcyjUjP8/viewform',
    accentFrom: 'from-orange-500/10',
    accentTo: 'to-red-500/5',
    glowColor: 'bg-orange-500/5',
  },
];

const FreeToolsSection: React.FC = () => {
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const activeTool = tools.find((t) => t.id === activeForm);

  return (
    <section className="py-20 bg-gradient-to-b from-black via-zinc-900/50 to-black relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 mb-4">
            <span className="text-gray-300 text-sm font-medium tracking-wider uppercase">Free Health Tools</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-3">
            Know Your <span className="text-orange-500">Body Better</span>
          </h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            Take these quick assessments to understand your health from the inside out — completely free.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className={`relative bg-gradient-to-br ${tool.accentFrom} ${tool.accentTo} border border-zinc-800 rounded-2xl p-6 md:p-8 overflow-hidden group hover:border-zinc-600 transition-all duration-300`}
            >
              {/* Glow */}
              <div className={`absolute inset-0 ${tool.glowColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />

              <div className="relative">
                {/* Badge */}
                <div className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-medium mb-5 ${tool.badgeColor}`}>
                  {tool.badge}
                </div>

                {/* Icon + Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="text-white/60 mt-1 group-hover:text-white/90 transition-colors">
                    {tool.icon}
                  </div>
                  <h3 className="text-2xl font-heading font-bold text-white leading-tight">
                    {tool.title} <span className="text-orange-400">{tool.highlight}</span>
                  </h3>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {tool.description}
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveForm(tool.id)}
                    className="flex-1 bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-sm"
                  >
                    Take the {tool.badge.split(' ')[1] || 'Quiz'}
                  </button>
                  <a
                    href={tool.formUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-gray-400 hover:text-white rounded-xl transition-all duration-200 flex items-center"
                    title="Open in new tab"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal with embedded form */}
      {activeForm && activeTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{activeTool.badge}</p>
                <h3 className="text-white font-semibold text-lg">
                  {activeTool.title} <span className="text-orange-400">{activeTool.highlight}</span>
                </h3>
              </div>
              <button
                onClick={() => setActiveForm(null)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={22} />
              </button>
            </div>

            {/* Embedded Google Form */}
            <iframe
              src={activeTool.formUrl}
              className="flex-1 w-full min-h-[500px]"
              title={`${activeTool.title} ${activeTool.highlight}`}
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
            >
              Loading…
            </iframe>
          </div>
        </div>
      )}
    </section>
  );
};

export default FreeToolsSection;
