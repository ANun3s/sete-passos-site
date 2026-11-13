// The former public library now redirects through the protected admin gate.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('a rota antiga de Fichas não publica os modelos para visitantes', async ({ page }) => {
  await page.goto('/fichas.html');
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('.record-card, .mockup-frame, .records-library')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Fichas|Modelos de fichas/ })).toHaveCount(0);
});
