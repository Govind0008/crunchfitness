import type { VercelRequest, VercelResponse } from '@vercel/node';

const IG_USER_ID = process.env.INSTAGRAM_USER_ID;
const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
const POST_LIMIT = 6;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!IG_USER_ID || !IG_ACCESS_TOKEN) {
    res.status(503).json({ error: 'Instagram integration is not configured yet.' });
    return;
  }

  try {
    const url = `https://graph.instagram.com/${IG_USER_ID}/media?fields=${FIELDS}&access_token=${IG_ACCESS_TOKEN}&limit=${POST_LIMIT}`;
    const igRes = await fetch(url);

    if (!igRes.ok) {
      console.error('Instagram API error:', igRes.status, await igRes.text());
      res.status(502).json({ error: 'Failed to fetch Instagram posts.' });
      return;
    }

    const data = await igRes.json();

    const posts = (data.data ?? [])
      .filter((post: any) => post.media_type !== 'VIDEO' || post.thumbnail_url)
      .map((post: any) => ({
        id: post.id,
        caption: post.caption ?? '',
        imageUrl: post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url,
        permalink: post.permalink,
        timestamp: post.timestamp,
        isVideo: post.media_type === 'VIDEO',
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ posts });
  } catch (err) {
    console.error('Instagram fetch failed:', err);
    res.status(500).json({ error: 'Internal error fetching Instagram posts.' });
  }
}
