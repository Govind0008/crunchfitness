import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Clock, Calendar, Tag, ArrowRight } from 'lucide-react';
import Footer from '../components/Footer';
import { useScrollReveal } from '../hooks/useScrollReveal';

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
}

const CATEGORIES = ['All', 'Fitness Tips', 'Nutrition', 'Workout Guide', 'Success Story', 'News'];

const BlogCard = ({ post, index }: { post: BlogPost; index: number }) => {
  const ref = useScrollReveal<HTMLDivElement>();
  const date = new Date(post.publishedAt.seconds * 1000).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div ref={ref} className="reveal" style={{ transitionDelay: `${(index % 3) * 80}ms` }}>
      <Link to={`/blog/${post.slug}`} className="group block h-full">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-green-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 h-full flex flex-col">
          {/* Cover image */}
          <div className="relative h-52 overflow-hidden flex-shrink-0">
            {post.coverImage ? (
              <img
                src={post.coverImage}
                alt={post.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <span className="text-zinc-600 text-sm">No image</span>
              </div>
            )}
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 bg-green-400/90 text-black text-xs font-bold rounded-full">
                {post.category}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 flex flex-col flex-1">
            <div className="flex items-center gap-3 text-gray-500 text-xs mb-3">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {date}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {post.readTime} min read
              </span>
            </div>

            <h2 className="text-white font-bold text-lg leading-snug mb-2 group-hover:text-green-400 transition-colors duration-200 line-clamp-2">
              {post.title}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed flex-1 line-clamp-3">
              {post.excerpt}
            </p>

            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="flex items-center gap-1 text-xs text-gray-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    <Tag size={9} />{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 text-green-400 text-sm font-semibold mt-4">
              Read more <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

const Blog = () => {
  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeCategory, setActive] = useState('All');
  const headingRef = useScrollReveal<HTMLDivElement>();

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('publishedAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost));
      setPosts(all.filter((p) => p.published));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = activeCategory === 'All'
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Hero */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-green-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-green-400/5 rounded-full blur-3xl" />
        </div>
        <div ref={headingRef} className="reveal max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-2 mb-5">
            <span className="text-green-400 text-sm font-medium tracking-wider uppercase">Knowledge Hub</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-heading font-black mb-5">
            <span className="text-white">FITNESS</span>
            <br />
            <span className="neon-text">BLOG</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Expert tips, workout guides, nutrition advice, and member success stories from Crunch Fitness Club.
          </p>
        </div>
      </section>

      {/* Category filter */}
      <section className="pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                  activeCategory === cat
                    ? 'bg-green-400 text-black'
                    : 'bg-zinc-900 border border-zinc-700 text-gray-300 hover:border-green-400/40 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Posts grid */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-zinc-900 rounded-2xl overflow-hidden animate-pulse">
                  <div className="h-52 bg-zinc-800" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-zinc-800 rounded w-1/3" />
                    <div className="h-5 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-full" />
                    <div className="h-3 bg-zinc-800 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-gray-500 text-lg">No posts yet in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((post, i) => (
                <BlogCard key={post.id} post={post} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;
