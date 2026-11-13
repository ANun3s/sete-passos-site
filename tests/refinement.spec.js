// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('rodapé tem navegação útil e abre o contato com a área selecionada', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  const navigation = footer.getByRole('navigation', { name: 'Navegação do rodapé' });
  await expect(navigation).toBeVisible();
  await footer.scrollIntoViewIfNeeded();
  await expect(footer.locator('.footer-watermark')).toHaveText('sete passos');
  await expect(footer).toHaveCSS('background-color', 'rgb(246, 248, 251)');
  const targets = await footer.locator('a').evaluateAll(links => links.every(a => a.hash && document.querySelector(a.hash)));
  expect(targets).toBe(true);
  await footer.getByRole('link', { name: 'Fisioterapia', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Fisioterapia', exact: true })).toBeChecked();
  await page.keyboard.press('Escape');
  await footer.getByRole('link', { name: 'Voltar ao início', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
});

for (const width of [320, 768, 1024, 1440]) {
  test(`conteúdo e ações compartilham o eixo central em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    for (const selector of ['.hero-copy', '#cuidado .section-heading', '#duvidas .section-heading', '.contact-action']) {
      const bounds = await page.locator(selector).boundingBox();
      expect(Math.abs(bounds.x + bounds.width / 2 - width / 2), selector).toBeLessThan(2);
    }
    for (const selector of ['.hero-copy', '#cuidado .section-heading', '#duvidas .section-heading', '.contact-inner']) {
      expect(await page.locator(selector).evaluate(el => getComputedStyle(el).textAlign)).toBe('center');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
