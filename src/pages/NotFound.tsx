import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 — route not found:', location.pathname);
  }, [location.pathname]);

  return (
    <main className="container grid min-h-[calc(100svh-var(--page-top))] items-center gap-12 py-16 lg:grid-cols-2">
      <div className="animate-fade-up">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-5 font-display text-display-xl font-extrabold uppercase text-white">
          This page <span className="text-brand-400">skipped leg day</span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-ink-300">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Let&apos;s get you back on track.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link to="/">Back to home</Link></Button>
          <Button size="lg" variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Go back</Button>
        </div>
      </div>
      <img
        src="/images/kettlebells-560.webp"
        alt=""
        className="hidden aspect-[4/5] w-full max-w-md justify-self-end rounded-2xl object-cover opacity-80 lg:block"
      />
    </main>
  );
};

export default NotFound;
