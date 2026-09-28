import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// index.html carries homepage SEO tags for crawlers that don't run JS. Once the app runs,
// each route sets its own via <Seo>, so drop the fallbacks to avoid duplicate canonicals.
document.querySelectorAll('[data-seo-fallback]').forEach((el) => el.remove());

createRoot(document.getElementById("root")!).render(<App />);
