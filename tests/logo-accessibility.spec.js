// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('marca do cabeçalho oferece foco visível e volta ao início pelo teclado', async ({ page }) => {
  await page.goto('/');
  await page.locator('#duvidas').scrollIntoViewIfNeeded();
  const brand = page.locator('.brand');
  await brand.focus();
  await expect(brand).toBeFocused();
  expect(await brand.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#inicio$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
});

test('marca do rodapé continua utilizável com movimento reduzido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const brand = page.locator('.footer-logo');
  await brand.scrollIntoViewIfNeeded();
  await brand.focus();
  await expect(brand).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#inicio$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
  await expect(page.locator('.hero [data-swap-card] img')).toHaveCount(3);
  await expect(page.locator('.hero [data-swap-card]').first().locator('img')).toBeVisible();
});

test.describe('interface de toque', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('marca do cabeçalho navega por toque sem exigir hover', async ({ page }) => {
    await page.goto('/');
    await page.locator('#cuidado').scrollIntoViewIfNeeded();
    await page.locator('.brand').tap();
    await expect(page).toHaveURL(/#inicio$/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
    await expect(page.locator('#hero-title')).toBeInViewport();
  });
});
