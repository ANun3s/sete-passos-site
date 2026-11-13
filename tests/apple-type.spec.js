// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const { height, scale } of [{ height: 568, scale: 200 }, { height: 320, scale: 100 }]) {
  test(`menu com texto a ${scale}% rola verticalmente em 320×${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/login.html');
    await page.addStyleTag({ content: `html { font-size: ${scale}%; }` });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.menu-toggle').click();
    const nav = page.locator('#main-nav');
    expect(await nav.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const bounds = await nav.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    for (const link of await nav.locator('a:not([hidden])').all()) {
      await link.focus();
      await expect(link).toBeFocused();
      await expect(link).toBeInViewport();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('.menu-toggle')).toBeFocused();
  });
}

for (const width of [320, 1440]) {
  test(`texto a 200% continua legível sem recorte nem rolagem horizontal em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/login.html']) {
      await page.goto(route);
      await page.addStyleTag({ content: 'html { font-size: 200%; }' });
      await page.evaluate(() => document.fonts.ready);
      const failures = await page.evaluate(() => {
        const issues = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) issues.push(`page width ${document.documentElement.scrollWidth}`);
        for (const element of document.querySelectorAll('h1, h2, h3, main p, summary, legend')) {
          if (element.closest('[aria-hidden="true"], .sr-only')) continue;
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) {
              if (rect.width && (rect.left < -1 || rect.right > innerWidth + 1)) issues.push(node.textContent.trim());
            }
          }
        }
        return [...new Set(issues)];
      });
      expect(failures, route).toEqual([]);
    }
  });
}
