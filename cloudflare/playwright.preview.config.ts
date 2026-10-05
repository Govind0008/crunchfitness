// Runs the public-site suite (tests/e2e) against a deployed preview instead of the local dev
// server:  PREVIEW_URL=https://… npx playwright test -c cloudflare/playwright.preview.config.ts
import base from '../playwright.config';
const url = process.env.PREVIEW_URL;
if (!url) throw new Error('Set PREVIEW_URL');
export default { ...base, testDir: '../tests/e2e', use: { ...base.use, baseURL: url }, webServer: undefined };
