// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('avanço rápido durante o retorno mantém URL e página sincronizadas', async ({ page }) => {
  await page.goto('/login.html');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true }).click();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'inicio');
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
  await page.goBack();
  await expect(page.locator('#page-curtain')).toHaveAttribute('data-phase', 'covering');
  await page.goForward();
  await expect(page).toHaveURL(/index\.html$/);
  await expect.poll(() => page.evaluate(() => ({ key: document.querySelector('#page-content').dataset.page, pending: document.querySelector('#page-content').inert }))).toEqual({ key: 'inicio', pending: false });
  await expect(page.locator('#page-announcement')).toHaveText('Navegou para Início');
});
