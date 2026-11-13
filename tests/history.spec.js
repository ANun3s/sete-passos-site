// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

const nav = page => page.getByRole('navigation', { name: 'Navegação principal' });
async function settled(page, key) {
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', key);
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
}

test('voltar e avançar trocam o documento e respeitam a direção por índice', async ({ page }) => {
  await page.goto('/');
  await nav(page).getByRole('link', { name: 'Login', exact: true }).click();
  await settled(page, 'login');
  await nav(page).getByRole('link', { name: 'Início', exact: true }).click();
  await settled(page, 'inicio');
  await page.goBack();
  await settled(page, 'login');
  await expect(page.locator('#page-curtain')).toHaveAttribute('data-direction', 'left');
  await page.goForward();
  await settled(page, 'inicio');
  await expect(page.locator('#page-curtain')).toHaveAttribute('data-direction', 'right');
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.locator('.hero [data-swap-card] img')).toHaveCount(3);
  await expect(page.locator('.hero [data-swap-card]').first().locator('img')).toBeVisible();
  await page.locator('.hero [data-contact]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
