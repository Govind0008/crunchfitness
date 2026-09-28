import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildSitemap, type SitemapEvent } from './_lib/sitemap';

// Public (non-draft) events, read anonymously through the Firestore REST API — the same
// security rules as the website apply, so drafts can never leak into the sitemap.
const PROJECT = 'crunch-fitness-blog';
const API_KEY = 'AIzaSyBK99gCuF9YPvYV1w-wzt_STx_9D_slgoM'; // public web key (same as the site's)
const PUBLIC = ['registration_open', 'registration_closed', 'check_in', 'live', 'results_pending', 'results_published', 'archived'];

async function publicEvents(): Promise<SitemapEvent[]> {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'events' }],
      where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'IN', value: { arrayValue: { values: PUBLIC.map((s) => ({ stringValue: s })) } } } },
      select: { fields: [{ fieldPath: 'slug' }, { fieldPath: 'updatedAt' }] },
    } }),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as { document?: { fields?: { slug?: { stringValue?: string }; updatedAt?: { timestampValue?: string } } } }[];
  return rows.flatMap((r) => (r.document?.fields?.slug?.stringValue ? [{ slug: r.document.fields.slug.stringValue, updatedAt: r.document.fields.updatedAt?.timestampValue }] : []));
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const events = await publicEvents().catch(() => []);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(buildSitemap(events));
}
