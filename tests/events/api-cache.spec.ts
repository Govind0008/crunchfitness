import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Public API answers that don't change per visitor are cached at the CDN, so a page view doesn't
// run a function just to repeat the same answer.
test.skip(({ isMobile }) => isMobile, 'server-side check, runs once');

function fakeRes() {
  const r = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown };
  const res = {
    setHeader(k: string, v: string) { r.headers[k.toLowerCase()] = v; return res; },
    status(c: number) { r.statusCode = c; return res; },
    json(b: unknown) { r.body = b; return res; },
    send(b: unknown) { r.body = b; return res; },
  };
  return { r, res };
}

test('Instagram not configured: the 503 is cached at the CDN, so visitors don’t each run the function', async () => {
  delete process.env.INSTAGRAM_USER_ID;
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  const { default: handler } = await import('../../api/instagram');
  const { r, res } = fakeRes();
  await handler({} as never, res as never);
  expect(r.statusCode).toBe(503);
  expect((r.body as { reason: string }).reason).toBe('not_configured');
  expect(r.headers['cache-control']).toMatch(/s-maxage=\d+/);
});

test('public images and media get a browser cache; hashed build assets stay immutable', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const rule = (src: string) => cfg.headers.find((h) => h.source === src)?.headers.find((h) => h.key === 'Cache-Control')?.value;
  expect(rule('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
  expect(rule('/(images|lovable-uploads)/(.*)')).toMatch(/max-age=86400/);
  // The device relay must never be cached
  expect(cfg.headers.some((h) => h.source.includes('iclock'))).toBe(false);
});
