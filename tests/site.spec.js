// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('apresenta a marca, o novo hero e caminhos para conhecer o cuidado', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Sete Passos/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Um cuidado que respeita o seu tempo.');
  const logo = page.locator('.brand img');
  await expect(page.locator('.brand')).toHaveAttribute('aria-label', 'Sete Passos — início');
  await expect(page.locator('.hero [data-swap-card] img')).toHaveCount(3);
  await expect(page.locator('.hero [data-swap-card]').first().locator('img')).toBeVisible();
  await expect(logo).toBeVisible();
  expect(await logo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByRole('link', { name: 'Conheça nosso cuidado' }).click();
  await expect(page).toHaveURL(/#cuidado$/);
  await expect(page.locator('#cuidado')).toBeInViewport();
});

test('menu móvel abre por teclado e fecha com Escape ou navegação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('.menu-toggle');
  await expect(toggle).toBeVisible();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#main-nav a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Casos de sucesso' }).click();
  await expect(page).toHaveURL(/historias\.html$/);
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'historias');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
