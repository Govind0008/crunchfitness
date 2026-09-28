import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { Clock, Calendar, ArrowLeft, Share2 } from 'lucide-react';
import Footer from '../components/Footer';
import { Button } from '@/components/ui/button';
import Seo from '@/components/site/Seo';

interface BlogPost {
  seoTitle?: string;
  seoDescription?: string;
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  author: string;
  publishedAt: { seconds: number };
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
    const fetchPost = async () => {
      try {
        const q = query(
          collection(db, 'posts'),
          where('slug', '==', slug),
          where('published', '==', true),
          limit(1),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setNotFound(true);
        } else {
          setPost({ id: snap.docs[0].id, ...snap.docs[0].data() } as BlogPost);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [slug]);

  const handleShare = async () => {
    if (!post) return;
    if (navigator.share) {
      navigator.share({ title: post.title, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="container max-w-3xl py-16 animate-pulse" aria-label="Loading article">
        <div className="h-4 w-24 rounded bg-ink-900" />
        <div className="mt-8 h-12 w-full rounded bg-ink-900" />
        <div className="mt-3 h-12 w-2/3 rounded bg-ink-900" />
        <div className="mt-10 aspect-[16/9] rounded-2xl bg-ink-900" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-6 py-20 text-center">
        <Seo title="Article not found | The Crunch Journal" description="This article may have been moved or unpublished." noindex />
        <h1 className="font-display text-display-md font-bold uppercase text-white">Article not found</h1>
        <p className="text-ink-400">It may have been moved or unpublished.</p>
        <Button asChild variant="outline"><Link to="/blog"><ArrowLeft /> Back to the journal</Link></Button>
      </div>
    );
  }

  const date = post.publishedAt?.seconds
    ? new Date(post.publishedAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen">
      <Seo
        title={`${post.seoTitle || post.title} | The Crunch Journal`}
        description={post.seoDescription || post.excerpt || `${post.title} — from the coaches at Crunch Fitness Club, Wakad, Pune.`}
        image={post.coverImage || undefined}
        type="article"
      />
      <main>
        <article>
          <header className="container max-w-3xl pt-10 md:pt-16">
            <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" aria-hidden /> All articles
            </Link>
            {post.category && <p className="eyebrow mt-8">{post.category}</p>}
            <h1 className="mt-4 font-display text-display-lg font-extrabold uppercase text-white text-balance animate-fade-up">
              {post.title}
            </h1>
            {post.excerpt && <p className="mt-5 text-lg leading-relaxed text-ink-300">{post.excerpt}</p>}

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-white/[0.08] py-4 text-sm text-ink-400">
              {post.author && <span className="font-medium text-white">By {post.author}</span>}
              {date && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden />{date}</span>}
              {post.readTime ? <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden />{post.readTime} min read</span> : null}
              <button
                type="button"
                onClick={handleShare}
                className="ml-auto inline-flex items-center gap-1.5 font-semibold text-white hover:text-brand-400 transition-colors"
              >
                <Share2 className="h-4 w-4" aria-hidden /> Share
              </button>
            </div>
          </header>

          {post.coverImage && (
            <div className="container mt-10 max-w-5xl">
              <img src={post.coverImage} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover animate-image-in" />
            </div>
          )}

          <div className="container max-w-3xl py-12 md:py-16">
            <div className="whitespace-pre-wrap text-[1.075rem] leading-[1.8] text-ink-200">
              {post.content}
            </div>

            {post.tags?.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2 border-t border-white/[0.08] pt-8" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-white/10 px-3 py-1 text-sm text-ink-300">#{tag}</li>
                ))}
              </ul>
            )}

            <div className="mt-12">
              <Button asChild variant="outline"><Link to="/blog"><ArrowLeft /> More articles</Link></Button>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
