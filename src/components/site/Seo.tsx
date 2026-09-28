import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { SITE } from '@/lib/site';

interface SeoProps {
  title: string;
  description: string;
  /** Absolute or site-relative image for social cards */
  image?: string;
  /** Keep a page out of search results (404, portals) */
  noindex?: boolean;
  type?: 'website' | 'article';
}

const abs = (path: string) => (path.startsWith('http') ? path : `${SITE.url}${path}`);

/** Per-route title, description, canonical URL and social card tags. */
const Seo = ({ title, description, image = '/lovable-uploads/training-main.jpeg', noindex, type = 'website' }: SeoProps) => {
  const { pathname } = useLocation();
  const url = abs(pathname === '/' ? '/' : pathname.replace(/\/$/, ''));
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex ? <meta name="robots" content="noindex, follow" /> : <link rel="canonical" href={url} />}
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={abs(image)} />
      <meta property="og:locale" content="en_IN" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={abs(image)} />
    </Helmet>
  );
};

export default Seo;
