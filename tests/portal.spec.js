// Public visitors can use Login but must authenticate and hold the admin grant to see Fichas.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('login permanece público e a rota antiga de Fichas conduz ao login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/login\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu espaço');
  await expect(page.getByLabel('E-mail', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('Senha', { exact: true })).toBeEnabled();
  await expect(page.getByText('Acesso local de desenvolvimento.', { exact: false })).toBeVisible();
  await page.goto('/fichas.html');
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('.record-card')).toHaveCount(0);
});
