// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const route of ['/login.html']) {
  test(`${route} compartilha o rodapé da home e o contato funcional`, async ({ page }) => {
    await page.goto('/index.html');
    const reference = await page.locator('.site-footer').innerText();
    await page.goto(route);
    await expect(page.locator('.site-footer')).toHaveCount(1);
    expect(await page.locator('.site-footer').innerText()).toBe(reference);
    await expect(page.locator('.portal-footer')).toHaveCount(0);
    const footer = page.locator('.site-footer');
    await footer.getByRole('link', { name: 'Fisioterapia', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Fisioterapia', exact: true })).toBeChecked();
    await page.getByRole('dialog').getByRole('button', { name: 'Preparar mensagem' }).click();
    await expect(page.locator('#prepared-message')).toHaveValue(/fisioterapia/);
    await page.keyboard.press('Escape');
    await expect(footer.getByRole('link', { name: 'Fisioterapia', exact: true })).toBeFocused();
    await footer.getByRole('link', { name: 'Nosso cuidado', exact: true }).click();
    await expect(page).toHaveURL(/index\.html#cuidado$/);
    await expect(page.locator('#cuidado')).toBeFocused();
  });
  test(`${route} rodapé acessível em tela estreita sem JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177'}${route}`);
    await expect(page.locator('.site-footer')).toHaveCount(1);
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.footer-contact a').click();
    await expect(page).toHaveURL(/index\.html#contato$/);
    await context.close();
  });
}

test('rodapé compartilhado mantém contraste e imagens nas quatro larguras', async ({ page }) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login.html');
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    for (const image of await page.locator('.site-footer img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.decode());
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).include('.site-footer').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  }
});
