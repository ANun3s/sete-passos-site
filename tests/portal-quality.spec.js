// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 768, 1024, 1440]) {
  for (const route of ['login']) {
    test(`${route}: layout, fontes e acessibilidade em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(`/${route}.html`);
      await page.evaluate(() => document.fonts.ready);
      for (const image of await page.locator('img').all()) {
        if (!await image.isVisible()) continue;
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(img => img.decode());
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // The admin-only ficha content is audited with the authenticated route tests.
      const audit = await new AxeBuilder({ page }).exclude('.mockup-frame').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('o login mantém fallback sem JavaScript; a rota antiga de Fichas continua privada', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5177/login.html');
  await expect(page.getByLabel('Senha', { exact: true })).toBeDisabled();
  await page.goto('http://127.0.0.1:5177/fichas.html');
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('.record-card')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true }).click();
  await expect(page.locator('#hero-title')).toBeVisible();
  await expect(page.locator('.hero [data-swap-card] img')).toHaveCount(3);
  await expect(page.locator('.hero [data-swap-card]').first().locator('img')).toBeVisible();
  await context.close();
});
