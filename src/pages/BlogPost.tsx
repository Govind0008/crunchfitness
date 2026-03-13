import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchPost } from '../lib/api';
import { Clock, Calendar, Tag, ArrowLeft, Share2 } from 'lucide-react';
import Footer from '../components/Footer';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: number;
  tags: string[];
}

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost]       = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchPost(slug)
      .then((data) => setPost(data as BlogPost))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleShare = () => {
    if (navigator.share && post) {
      navigator.share({ title: post.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="text-2xl font-bold">Post not found.</p>
        <Link to="/blog" className="text-green-400 hover:underline">← Back to Blog</Link>
      </div>
    );
  }

  const date = new Date(post.publishedAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Cover image hero */}
      <div className="relative h-[50vh] min-h-[320px] overflow-hidden">
        {post.coverImage ? (
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
      </div>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 -mt-20 relative z-10">
        {/* Back link */}
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Blog
        </Link>

        {/* Category badge */}
        <div className="mb-4">
          <span className="px-3 py-1 bg-green-400/90 text-black text-xs font-bold rounded-full">
            {post.category}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-5xl font-heading font-black text-white leading-tight mb-5">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm mb-8 pb-8 border-b border-zinc-800">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {post.readTime} min read
          </span>
          <span className="text-gray-500">By {post.author}</span>
          <button
            onClick={handleShare}
            className="ml-auto flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors"
          >
            <Share2 size={14} /> Share
          </button>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-lg max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-zinc-800">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-sm text-gray-400 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full"
              >
                <Tag size={11} />{tag}
              </span>
            ))}
          </div>
        )}

        {/* Back CTA */}
        <div className="mt-12 text-center">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-400 hover:bg-green-300 text-black font-bold rounded-xl transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft size={16} /> More Articles
          </Link>
        </div>
      </article>

      <Footer />
    </div>
  );
};

export default BlogPost;
