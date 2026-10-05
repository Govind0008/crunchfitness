// The emulator test suite against the app served by the Cloudflare Worker (wrangler dev, static
// assets + /api routes) instead of the Vite dev server:
//   PREVIEW_URL=http://127.0.0.1:8796 npx playwright test -c cloudflare/playwright.events-preview.config.ts <specs>
import base from '../playwright.events.config';
const url = process.env.PREVIEW_URL;
if (!url) throw new Error('Set PREVIEW_URL');
export default { ...base, testDir: '../tests/events', use: { ...base.use, baseURL: url }, webServer: undefined };
