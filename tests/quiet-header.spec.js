// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const width of [320, 768, 1024, 1440]) {
  test(`menu mantém contraste, foco e área de toque em ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    if (width <= 800) {
      await page.locator('.menu-toggle').click();
      await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#main-nav > a:not([hidden])').first()).toBeFocused();
      // Audit the settled material, not a partially transparent entrance frame.
      await expect(page.locator('#main-nav')).not.toHaveAttribute('data-animating', 'true');
      await expect(page.locator('#main-nav')).toHaveCSS('opacity', '1');
    }
    const controls = page.locator('#main-nav > a:not([hidden])');
    for (const control of await controls.all()) {
      const rect = await control.boundingBox();
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    }
    const firstLink = controls.first();
    await firstLink.focus();
    await page.keyboard.press('Tab');
    const focused = page.locator('#main-nav > a:not([hidden]):focus');
    await expect(focused).toHaveCSS('outline-style', 'solid');
    expect(await focused.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
    const audit = await new AxeBuilder({ page }).include('.site-header').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(audit.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(tmpdir(), 'sete-passos-quiet-header', `menu-${new URL(page.url()).port}-${width}.png`) });
    expect(errors).toEqual([]);
  });
}

for (const route of ['/', '/login.html']) {
  test(`menu discreto sem pílulas coloridas ou brilho em ${route}`, async ({ page }) => {
    await page.goto(route);
    const link = page.locator('#main-nav > a:not(.glass)').first();
    await link.hover();
    await expect(link).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(link).toHaveCSS('font-weight', '400');
    await expect(link).toHaveCSS('text-decoration-line', 'underline');
    const current = page.locator('#main-nav > a[aria-current]');
    if (await current.count()) {
      await expect(current).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(current).toHaveCSS('text-decoration-line', 'underline');
    }
    const contact = page.locator('#main-nav .nav-cta');
    await contact.hover();
    await expect(contact).toHaveCSS('box-shadow', 'none');
    await expect(contact).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    await expect(contact).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(await contact.evaluate(el => getComputedStyle(el, '::before').display)).toBe('none');
  });
}
