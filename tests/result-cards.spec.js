import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('Fichas fica dentro da área administrativa e não aparece na navegação pública', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#main-nav a[href="/fichas.html"]')).toHaveCount(0);
  await expect(page.locator('[data-admin-link]')).toBeHidden();
  await page.goto('/fichas.html');
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('.record-card')).toHaveCount(0);
});
