import React, { useEffect, useState } from 'react';
import { Instagram, Play } from 'lucide-react';
import { Section, SectionHeader } from '@/components/site/Section';
import { Button } from '@/components/ui/button';
import { SITE } from '@/lib/site';

const fallbackImages = [
  '/images/coach-mobility-640.webp',
  '/images/kettlebells-560.webp',
  '/images/coach-pull-480.webp',
  '/images/squat-560.webp',
  '/images/coach-spot-480.webp',
  '/images/coach-cable-480.webp',
];

interface InstagramPost {
  id: string;
  caption: string;
  imageUrl: string;
  permalink: string;
  isVideo: boolean;
}

interface Tile {
  key: string;
  href: string;
  imageUrl: string;
  alt: string;
  isVideo: boolean;
}

const InstagramSection: React.FC = () => {
  const [posts, setPosts] = useState<InstagramPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/instagram')
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled && Array.isArray(data.posts) && data.posts.length > 0) setPosts(data.posts);
      })
      .catch(() => {
        // Live feed unavailable — the fallback mosaic below covers this.
      });
    return () => { cancelled = true; };
  }, []);

  const tiles: Tile[] = posts
    ? posts.slice(0, 6).map((p) => ({
        key: p.id,
        href: p.permalink,
        imageUrl: p.imageUrl,
        alt: p.caption?.trim().slice(0, 120) || 'Instagram post from Crunch Fitness Club',
        isVideo: p.isVideo,
      }))
    : fallbackImages.map((src, i) => ({
        key: String(i), href: SITE.instagram, imageUrl: src, alt: 'Training at Crunch Fitness Club', isVideo: false,
      }));

  return (
    <Section aria-labelledby="instagram-heading">
      <SectionHeader
        id="instagram-heading"
        eyebrow={<><Instagram className="h-3.5 w-3.5" aria-hidden /> @{SITE.instagramHandle}</>}
        title="Life on the floor"
        lede="Daily training, member wins and behind-the-scenes from the gym."
        action={
          <Button asChild variant="outline">
            <a href={SITE.instagram} target="_blank" rel="noopener noreferrer">
              <Instagram /> Follow on Instagram
            </a>
          </Button>
        }
      />

      <ul className="focus-grid grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {tiles.map((tile, i) => (
          <li key={tile.key} className="m-pop" style={{ '--i': i, '--d': 150 } as React.CSSProperties}>
            <a
              href={tile.href}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-item group relative block aspect-square overflow-hidden rounded-xl bg-ink-900"
            >
              <img
                src={tile.imageUrl}
                alt={tile.alt}
                loading="lazy"
                className="h-full w-full object-cover transition-[transform,opacity] duration-500 ease-out-expo group-hover:scale-[1.06]"
              />
              {tile.isVideo && (
                <Play className="absolute right-2 top-2 h-4 w-4 fill-white text-white drop-shadow" aria-label="Video" />
              )}
              <span className="sr-only">(opens Instagram in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
};

export default InstagramSection;
