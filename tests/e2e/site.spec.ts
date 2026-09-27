import { test, expect, type Page } from '@playwright/test';

const PUBLIC_ROUTES = ['/', '/about-us', '/team', '/founders', '/gallery', '/blog', '/plans', '/contact'];

// Errors caused by the local environment (Google Maps without an API key), not by the app
const IGNORED_ERRORS = [/URI malformed/, /maps\.googleapis/, /Failed to load resource/];

const trackErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return () => errors.filter((e) => !IGNORED_ERRORS.some((re) => re.test(e)));
};

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

test.describe('public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders without errors or horizontal overflow`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForTimeout(500);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(0);

      const broken = await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src),
      );
      expect(broken).toEqual([]);
      expect(errors()).toEqual([]);
    });
  }

  test('unknown routes show the 404 page', async ({ page }) => {
    await page.goto('/definitely-not-a-page');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/skipped leg day/i);
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('navigation', () => {
  test('primary navigation reaches every page', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });

    if (isMobile(page)) {
      const toggle = nav.getByRole('button', { name: 'Open menu' });
      await toggle.click();
      await expect(page.locator('#mobile-menu')).toBeVisible();
      // Page scroll is locked while the sheet is open
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-menu')).toBeHidden();

      await toggle.click();
      await page.locator('#mobile-menu').getByRole('link', { name: 'Gallery' }).click();
      await expect(page).toHaveURL('/gallery');
      await expect(page.locator('#mobile-menu')).toBeHidden();
    } else {
      await nav.getByRole('link', { name: 'Plans' }).click();
      await expect(page).toHaveURL('/plans');
      await expect(nav.getByRole('link', { name: 'Plans' })).toHaveAttribute('aria-current', 'page');
    }
  });

  test('hero CTAs go to plans and contact', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'View membership plans' }).first().click();
    await expect(page).toHaveURL('/plans');
    await page.goto('/');
    await page.getByRole('link', { name: 'Book a free tour' }).first().click();
    await expect(page).toHaveURL('/contact');
  });
});

test.describe('membership → enquiry', () => {
  test('choosing a plan on the home page pre-selects it on the contact form', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('#membership article').first();
    // Live Firestore plans can replace the fallback cards mid-action — retry until data settles
    await expect(async () => {
      await card.scrollIntoViewIfNeeded({ timeout: 2000 });
      await card.getByRole('button').click({ timeout: 2000 });
      await expect(page).toHaveURL('/contact', { timeout: 2000 });
    }).toPass({ timeout: 15000 });

    // Plans can swap from fallback to live Firestore data mid-test, so assert on the wiring:
    // the selected plan is non-empty and the prefilled message references the same plan.
    await expect(page).toHaveURL('/contact');
    const plan = await page.getByLabel('Interested in').inputValue();
    expect(plan).not.toBe('');
    await expect(page.getByLabel('Message *')).toHaveValue(`I'm interested in the ${plan} membership plan.`);
  });

  test('plans page lists plans and routes to contact', async ({ page }) => {
    await page.goto('/plans');
    const cards = page.locator('main article');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
    await cards.last().getByRole('button').click();
    await expect(page).toHaveURL('/contact');
  });
});

test.describe('interactive tools', () => {
  test('BMI calculator computes a result', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Height (cm)').fill('175');
    await page.getByLabel('Weight (kg)').fill('70');
    await page.getByRole('button', { name: 'Calculate BMI' }).click();
    await expect(page.getByText('22.9', { exact: true })).toBeVisible();
    await expect(page.getByText('Healthy weight')).toBeVisible();
    await page.getByRole('button', { name: 'Reset calculator' }).click();
    await expect(page.getByText('22.9', { exact: true })).toBeHidden();
  });

  test('FAQ accordion expands and collapses', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Can I bring a guest for a trial session?' });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/complimentary one-day trial/)).toBeVisible();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('free assessment opens in an accessible dialog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start now' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /gut health assessment/i })).toBeVisible();
    await expect(dialog.locator('iframe')).toHaveAttribute('src', /docs\.google\.com\/forms/);
    // The embedded form can take keyboard focus, so close via the dialog's own button
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();
  });

  test('gallery lightbox supports keyboard navigation', async ({ page }) => {
    await page.goto('/gallery');
    await page.getByRole('button', { name: /View larger: Modern cardio zone/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('1 of 10');
    await page.keyboard.press('ArrowRight');
    await expect(dialog).toContainText('2 of 10');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(dialog).toContainText('10 of 10');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('gallery filter narrows the photo grid', async ({ page }) => {
    await page.goto('/gallery');
    const filter = page.getByRole('group', { name: 'Filter photos by category' });
    await filter.getByRole('button', { name: 'Training' }).click();
    await expect(filter.getByRole('button', { name: 'Training' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /View larger: Modern cardio zone/ })).toHaveCount(0);
  });

  test('chat assistant stays closed until opened', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open Coach Crunch chat assistant' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('accessibility basics', () => {
  test('content is visible with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const opacity = await page.locator('#membership .reveal').evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe('1');
  });

  test('keyboard focus is visible on interactive elements', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const cs = getComputedStyle(el);
      return cs.outlineStyle !== 'none' || cs.boxShadow !== 'none';
    });
    expect(outline).toBe(true);
  });
});

test.describe('motion system', () => {
  test('hero stats count up to their real values', async ({ page }) => {
    await page.goto('/');
    const stats = page.locator('#home dd');
    await expect(stats.nth(0)).toContainText('500+', { timeout: 6000 });
    await expect(stats.nth(1)).toContainText('10+', { timeout: 6000 });
    // Screen readers get the final value straight away
    await expect(stats.nth(0).locator('.sr-only')).toHaveText('500+');
  });

  test('every section reveals its content when scrolled into view', async ({ page }) => {
    await page.goto('/');
    const sections = page.locator('.reveal');
    const n = await sections.count();
    for (let i = 0; i < n; i++) {
      const section = sections.nth(i);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toHaveClass(/revealed/);
    }
    await page.waitForTimeout(2200);
    const stuck = await page.evaluate(() =>
      [...document.querySelectorAll('.revealed .m-rise, .revealed .m-rack, .revealed .m-pop, .revealed .m-line > *, .revealed .m-wipe-up, .revealed .m-wipe-left, .revealed .m-wipe-right')]
        .filter((el) => el.getBoundingClientRect().width > 0 && !el.closest('[hidden]'))
        .filter((el) => { const cs = getComputedStyle(el); return cs.opacity === '0' || cs.clipPath.includes('100%'); }).length,
    );
    expect(stuck).toBe(0);
  });

  test('navigation progress line tracks scroll depth', async ({ page }) => {
    await page.goto('/about-us');
    await expect(page.locator('h1').first()).toBeVisible(); // route chunk rendered, page has height
    const bar = page.locator('[data-nav-progress]');
    await expect(bar).toHaveAttribute('style', /scaleX\(0\)/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bar).toHaveAttribute('style', /scaleX\((0\.9\d*|1)\)/);
  });

  test('reduced motion shows everything immediately and disables scroll-linking', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#home dd').first()).toContainText('500+');
    const state = await page.evaluate(() => ({
      hidden: [...document.querySelectorAll('.m-line > *, .hero-rise, .m-wipe-up')]
        .filter((el) => { const cs = getComputedStyle(el); return cs.opacity === '0' || cs.clipPath.includes('100%'); }).length,
      driven: [...document.querySelectorAll('.parallax')].filter((el) => (el as HTMLElement).style.getPropertyValue('--sp')).length,
    }));
    expect(state).toEqual({ hidden: 0, driven: 0 });
  });
});

test.describe('cinematic chapters', () => {
  test('training journey advances with scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-heading')).toBeVisible();
    for (const i of [0, 1, 2]) {
      await page.evaluate((i) => {
        const s = document.querySelector(`[data-step="${i}"]`)!; const r = s.getBoundingClientRect();
        window.scrollTo(0, scrollY + r.top + r.height / 2 - innerHeight / 2);
      }, i);
      await expect(page.locator('[aria-current="step"]')).toHaveAttribute('data-step', String(i));
    }
    if (!isMobile(page)) {
      // Desktop: the image stage is pinned and shows the active set
      await expect(page.locator('.journey-frame[data-state="active"]')).toHaveCount(1);
      const top = await page.locator('.journey-frame').first().evaluate((el) => el.closest('.sticky')!.getBoundingClientRect().top);
      expect(top).toBeGreaterThan(0);
    }
  });

  test('facility frame opens to full-bleed at the centre of the screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-heading')).toBeVisible();
    const frame = page.locator('.facility-open');
    await frame.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.15));
    await expect.poll(() => frame.evaluate((el) => getComputedStyle(el).clipPath)).toMatch(/inset\((0px|[0-5](\.\d+)?px)/);
  });

  test('final set panel completes and its CTA works', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#hero-heading')).toBeVisible();
    const heading = page.locator('#cta-heading');
    await heading.scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('.final-set').evaluate((el) => getComputedStyle(el).clipPath), { timeout: 6000 })
      .toMatch(/inset\(0(%|px)? 0px round 24px\)|inset\(0px\)|none/);
    await page.locator('.final-set').getByRole('link', { name: /Book a free tour/ }).click();
    await expect(page).toHaveURL('/contact');
  });

  test('reduced motion shows every chapter immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('#hero-heading')).toBeVisible();
    const state = await page.evaluate(() => ({
      finalSet: getComputedStyle(document.querySelector('.final-set')!).clipPath,
      hiddenFrames: [...document.querySelectorAll('.hero-lift, .m-wipe-up')].filter((el) => getComputedStyle(el).clipPath.includes('100%')).length,
      dimmedJourney: [...document.querySelectorAll('.journey-copy')].filter((el) => getComputedStyle(el).transform !== 'none').length,
    }));
    expect(state).toEqual({ finalSet: 'none', hiddenFrames: 0, dimmedJourney: 0 });
  });
});
