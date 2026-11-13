import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('cabeçalho abre Casos de sucesso pela navegação interna', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Casos de sucesso' }).click();

  await expect(page).toHaveURL(/historias\.html$/);
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'historias');
  await expect(page.getByRole('heading', { level: 1, name: /Cada história tem um caminho só seu/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Casos de sucesso' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'As primeiras histórias estão a caminho.' })).toBeVisible();
  await expect(page.getByText('Ainda não há relatos autorizados para publicação.')).toBeVisible();
  await expect(page.locator('.stories-empty article, .stories-empty blockquote, .stories-empty img')).toHaveCount(0);
});

test('página editorial está disponível por URL e reflowa em tela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/historias.html');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Conheça nosso cuidado' })).toHaveAttribute('href', '/index.html#cuidado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('link Casos de sucesso também aparece no cabeçalho do login', async ({ page }) => {
  await page.goto('/login.html');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Casos de sucesso' }).click();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'historias');
  await expect(page).toHaveURL(/historias\.html$/);
});
