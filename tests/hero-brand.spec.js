// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const width of [320, 768, 1024, 1440]) {
  test(`abertura editorial e CardSwap mantêm a marca e as ações em ${width}px`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator('#hero-title')).toHaveText('Um cuidado que respeita o seu tempo.');
    await expect(page.locator('.hero-description')).toBeVisible();
    if (width <= 600) await expect(page.locator('.hero-footnote')).toBeHidden();
    else await expect(page.locator('.hero-footnote')).toBeVisible();
    const cards = page.locator('[data-swap-card]');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0).locator('img')).toHaveAttribute('src', '/assets/sete-passos-mockup-transparente.png');
    await expect(cards.nth(1).locator('img')).toHaveAttribute('src', '/assets/about-physiotherapy.webp');
    await expect(cards.nth(2).locator('img')).toHaveAttribute('src', '/assets/about-aesthetics.webp');
    await expect(page.locator('[data-swap-toggle]')).toBeVisible();
    await expect(page.locator('.home-preview-link')).toHaveCount(3);
    const previews = page.locator('.home-preview-link');
    await expect(previews.nth(0)).toHaveAttribute('href', '/sobre.html');
    await expect(previews.nth(1)).toHaveAttribute('href', '/historias.html');

    await expect(page.locator('.hero [data-contact]')).toBeInViewport();
    await expect(page.locator('.brand img')).toBeVisible();
    await expect(page.locator('.footer-logo img')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.hero [data-contact]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.hero [data-contact]')).toBeFocused();
    await page.locator('.hero .text-link').click();
    await expect(page).toHaveURL(/#cuidado$/);
    await expect(page.locator('#cuidado')).toBeInViewport();
    await expect(page.locator('.reading-progress')).toHaveCount(0);
    await expect(page.locator('#cuidado [data-reveal]').first()).toHaveCSS('opacity', '1');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('#essencia [data-reveal]').first()).toHaveCSS('opacity', '1');
    expect(errors).toEqual([]);
  });
}
