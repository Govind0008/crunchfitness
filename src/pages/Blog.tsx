import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Clock, Calendar, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import { PageHeader, Section } from '@/components/site/Section';
import { cn } from '@/lib/utils';
import Seo from '@/components/site/Seo';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  author: string;
  publishedAt: { seconds: number };
  readTime: number;
  tags: string[];
  published?: boolean;
}

const CATEGORIES = ['All', 'Fitness Tips', 'Nutrition', 'Workout Guide', 'Success Story', 'News'];

const BlogCard = ({ post, index }: { post: BlogPost; index: number }) => {
  const date = post.publishedAt?.seconds
    ? new Date(post.publishedAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

  return (
    <li className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <Link to={`/blog/${post.slug}`} className="group flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-ink-900">
          {post.coverImage ? (
            <img
              src={post.coverImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
            />
          ) : (
            <img src="/images/floor-800.webp" alt="" loading="lazy" className="h-full w-full object-cover opacity-40 grayscale" />
          )}
          {post.category && (
            <span className="absolute left-3 top-3 rounded-full bg-ink-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {post.category}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-1 flex-col">
          <p className="flex items-center gap-3 text-xs text-ink-400">
            {date && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden />{date}</span>}
            {post.readTime ? <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden />{post.readTime} min read</span> : null}
          </p>
          <h2 className="mt-3 font-sans text-xl font-semibold leading-snug text-white transition-colors group-hover:text-brand-400 line-clamp-2">
            {post.title}
          </h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400 line-clamp-3">{post.excerpt}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
            Read article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
};

const Blog = () => {
  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeCategory, setActive] = useState('All');

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('publishedAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost));
      setPosts(all.filter((p) => p.published));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = activeCategory === 'All'
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen">
      <Seo title="The Crunch Journal | Training & Nutrition Articles" description="Training tips, nutrition guides and member stories from the coaches at Crunch Fitness Club, Wakad, Pune." />
      <main>
        <PageHeader
          eyebrow="Knowledge hub"
          title={<>The Crunch <span className="text-brand-400">journal</span></>}
          lede="Expert tips, workout guides, nutrition advice and member success stories from Crunch Fitness Club."
        />

        <Section aria-label="Articles">
          <div className="mb-10 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActive(cat)}
                aria-pressed={activeCategory === cat}
                className={cn(
                  'h-10 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors',
                  activeCategory === cat ? 'bg-white text-ink-950' : 'border border-white/10 text-ink-300 hover:border-white/30 hover:text-white',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <ul className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading articles">
              {[1, 2, 3].map((i) => (
                <li key={i} className="animate-pulse">
                  <div className="aspect-[16/10] rounded-2xl bg-ink-900" />
                  <div className="mt-5 h-3 w-1/3 rounded bg-ink-900" />
                  <div className="mt-4 h-5 w-3/4 rounded bg-ink-900" />
                  <div className="mt-3 h-3 w-full rounded bg-ink-900" />
                </li>
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-20 text-center">
              <p className="font-display text-display-sm font-bold uppercase text-white">Nothing here yet</p>
              <p className="mt-2 text-ink-400">
                {activeCategory === 'All' ? 'New articles are on the way — check back soon.' : `No ${activeCategory.toLowerCase()} posts yet.`}
              </p>
              {activeCategory !== 'All' && (
                <button type="button" onClick={() => setActive('All')} className="mt-6 text-sm font-semibold text-brand-400 hover:text-brand-300">
                  Show all articles
                </button>
              )}
            </div>
          ) : (
            <ul className="grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((post, i) => <BlogCard key={post.id} post={post} index={i} />)}
            </ul>
          )}
        </Section>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
