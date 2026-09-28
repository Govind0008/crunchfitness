// Pure sitemap builder (unit-tested). Files under api/_lib are not deployed as routes.
export const SITE_URL = 'https://www.crunchfitness.fitness';

export const STATIC_PAGES: [path: string, priority: number][] = [
  ['/', 1.0], ['/plans', 0.9], ['/contact', 0.9], ['/events', 0.8], ['/gallery', 0.7],
  ['/team', 0.7], ['/about-us', 0.6], ['/founders', 0.6], ['/blog', 0.5],
];

export interface SitemapEvent { slug: string; updatedAt?: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildSitemap(events: SitemapEvent[]): string {
  const urls = [
    ...STATIC_PAGES.map(([p, pr]) => `  <url><loc>${SITE_URL}${p}</loc><priority>${pr.toFixed(1)}</priority></url>`),
    ...events.filter((e) => /^[a-z0-9-]+$/.test(e.slug)).map((e) =>
      `  <url><loc>${SITE_URL}/events/${esc(e.slug)}</loc>${e.updatedAt ? `<lastmod>${e.updatedAt.slice(0, 10)}</lastmod>` : ''}<priority>0.7</priority></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
