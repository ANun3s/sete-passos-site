// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

// Optional target for the real Go Live instance, not a replacement for the Vite suite.
const liveUrl = process.env.GO_LIVE_URL;

async function settle(page, key) {
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', key);
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
}

async function homeLayout(page) {
  return page.evaluate(() => {
    const inspect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        box: [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 100) / 100),
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        alignItems: style.alignItems,
        gap: style.gap,
        padding: style.padding,
        textAlign: style.textAlign,
        maxWidth: style.maxWidth,
        backgroundColor: style.backgroundColor,
      };
    };
    return {
      hero: inspect('.hero'),
      heroCopy: inspect('.hero-copy'),
      heroVisual: inspect('.hero-visual'),
      valuesStrip: inspect('.values-strip'),
      valuesContainer: inspect('.values-strip .container'),
      valuesLabel: inspect('.values-strip span'),
      valuesIcon: inspect('.values-strip .icon'),
    };
  });
}

test('Go Live carrega logo, fontes e os efeitos sem depender do Vite', async ({ page, request }) => {
  test.skip(!liveUrl, 'Defina GO_LIVE_URL para verificar a instância real do Live Server.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(liveUrl) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  const image = await request.get(new URL('/assets/sete-passos-mockup-transparente.png', liveUrl).href);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/');
  await page.goto(liveUrl);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.brand img')).toBeVisible();
  await expect(page.locator('.hero [data-swap-card] img')).toHaveCount(3);
  await expect(page.locator('.hero [data-swap-card]').first().locator('img')).toBeVisible();
  await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
  const directHomeLayout = await homeLayout(page);
  const imagesLoaded = await page.locator('img').evaluateAll(async images => {
    await Promise.all(images.map(async image => {
      image.loading = 'eager';
      try { await image.decode(); } catch { /* The final status below reports an unavailable image. */ }
    }));
    return images.map(image => image.complete && image.naturalWidth > 0);
  });
  expect(imagesLoaded.length).toBeGreaterThan(0);
  expect(imagesLoaded.every(Boolean)).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px "DM Sans"') && document.fonts.check('italic 16px "Instrument Serif"'))).toBe(true);

  // VS Code Go Live serves native modules and does not transform CSS imports.
  // Exercise each route in the same document to verify its linked CSS is loaded
  // before the SPA reveals the new content, then check the homepage on return.
  for (const route of [
    { label: 'Sobre', key: 'sobre', selector: '.about-dither', property: 'borderRadius', expected: '28px' },
    { label: 'Casos de sucesso', key: 'historias', selector: '.stories-wall', property: 'position', expected: 'absolute' },
  ]) {
    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: route.label, exact: true }).click();
    await settle(page, route.key);
    await expect.poll(() => page.locator(route.selector).evaluate((element, property) => getComputedStyle(element)[property], route.property))
      .toBe(route.expected);

    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Início', exact: true }).click();
    await settle(page, 'inicio');
    await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
    await expect.poll(() => page.locator('.card-swap-stage').evaluate(element => getComputedStyle(element).perspective))
      .toBe('900px');
    expect(await homeLayout(page)).toEqual(directHomeLayout);
  }

  // The asset audit has scrolled to the footer. Return through the real link;
  // native scrollIntoView cannot seek a transformed GSAP section's timeline.
  await page.locator('.footer-back').click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await page.locator('.hero [data-contact]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
});
