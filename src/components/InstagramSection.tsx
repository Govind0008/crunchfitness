import React, { useEffect, useState } from 'react';
import { Instagram, ExternalLink, Users, ImageIcon } from 'lucide-react';

const INSTAGRAM_HANDLE = 'crunchfitnessclub';
const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}`;

const fallbackImages = [
  '/lovable-uploads/gym 1.jpeg',
  '/lovable-uploads/training-main-1.jpeg',
  '/lovable-uploads/cardio-1.jpeg',
  '/lovable-uploads/activity-1.png',
  '/lovable-uploads/gym 3.jpeg',
  '/lovable-uploads/training-2.jpeg',
];

interface InstagramPost {
  id: string;
  caption: string;
  imageUrl: string;
  permalink: string;
  isVideo: boolean;
}

interface MosaicTile {
  key: string;
  href: string;
  imageUrl: string;
}

const InstagramSection: React.FC = () => {
  const [posts, setPosts] = useState<InstagramPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/instagram')
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled && Array.isArray(data.posts) && data.posts.length > 0) {
          setPosts(data.posts);
        }
      })
      .catch(() => {
        // Live feed unavailable — the fallback mosaic below covers this.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tiles: MosaicTile[] = posts
    ? posts.map((post) => ({ key: post.id, href: post.permalink, imageUrl: post.imageUrl }))
    : fallbackImages.map((src, i) => ({ key: String(i), href: INSTAGRAM_URL, imageUrl: src }));

  return (
    <section className="py-20 bg-black relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-pink-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
            >
              <Instagram size={20} className="text-white" />
            </div>
            <span className="text-gray-400 font-medium">@{INSTAGRAM_HANDLE}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-3">
            Follow Our{' '}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)' }}
            >
              Journey
            </span>
          </h2>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Real people. Real results. Real community. Follow us for daily motivation, tips, and behind-the-scenes moments.
          </p>
        </div>

        {/* Profile card + image mosaic */}
        <div className="flex flex-col lg:flex-row items-center gap-10">

          {/* Profile card */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center shadow-2xl">
              {/* Avatar with IG gradient ring */}
              <div className="relative inline-block mb-4">
                <div
                  className="w-20 h-20 rounded-full p-[3px] mx-auto"
                  style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
                >
                  <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                    <img
                      src="/lovable-uploads/crunch.png"
                      alt="Crunch Fitness Club"
                      className="w-14 h-14 object-contain"
                    />
                  </div>
                </div>
              </div>

              <h3 className="text-white font-bold text-lg mb-0.5">Crunch Fitness Club</h3>
              <p className="text-gray-500 text-sm mb-4">@{INSTAGRAM_HANDLE}</p>

              <div className="flex justify-center gap-6 mb-5">
                <div className="text-center">
                  <ImageIcon size={14} className="text-gray-500 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">Posts</p>
                </div>
                <div className="w-px bg-zinc-700" />
                <div className="text-center">
                  <Users size={14} className="text-gray-500 mx-auto mb-1" />
                  <p className="text-white font-bold text-sm">Followers</p>
                </div>
              </div>

              <p className="text-gray-400 text-xs leading-relaxed mb-5">
                Wakad's premium fitness destination 💪<br />
                Strength · Cardio · Zumba · Personal Training
              </p>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
              >
                <Instagram size={16} />
                Follow Us
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Image mosaic — live posts when available, each linking to its own permalink */}
          <div className="flex-1 w-full">
            <div className="grid grid-cols-3 gap-2">
              {tiles.map((tile) => (
                <a
                  key={tile.key}
                  href={tile.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block rounded-xl overflow-hidden aspect-square group"
                >
                  <img
                    src={tile.imageUrl}
                    alt={`Crunch Fitness Club`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #f09433, #dc2743, #bc1888)' }}
                    >
                      <Instagram size={18} className="text-white" />
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Bottom link */}
            <div className="mt-5 text-center">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors duration-200"
              >
                <Instagram size={14} />
                View all posts on Instagram
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InstagramSection;
