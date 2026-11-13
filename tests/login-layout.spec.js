// The login intentionally stays minimal and uses no shared page footer.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('login fica centralizado e sem elementos laterais em todas as larguras', async ({ page }) => {
  for (const width of [320, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login.html');
    await expect(page.getByRole('heading', { name: 'Acesse sua conta', level: 1 })).toBeVisible();
    const mark = page.locator('.login-mark');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('src', '/assets/simbolo-sete-passos-120.webp');
    await expect(page.locator('.site-footer, .login-art')).toHaveCount(0);

    const centered = await page.evaluate(() => {
      const main = document.querySelector('.login-main').getBoundingClientRect();
      const card = document.querySelector('#auth-root').getBoundingClientRect();
      return {
        horizontalOffset: Math.abs((card.left + card.right) / 2 - (main.left + main.right) / 2),
        verticalOffset: Math.abs((card.top + card.bottom) / 2 - (main.top + main.bottom) / 2),
        overflows: document.documentElement.scrollWidth > innerWidth,
      };
    });

    expect(centered.horizontalOffset).toBeLessThan(2);
    expect(centered.verticalOffset).toBeLessThan(2);
    expect(centered.overflows).toBe(false);
  }
});
