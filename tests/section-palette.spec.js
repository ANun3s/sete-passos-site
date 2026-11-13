// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const preference of ['prefers-contrast', 'prefers-reduced-transparency']) {
  test(`paleta suave preserva a leitura com ${preference}`, async ({ page }) => {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setEmulatedMedia', { features: [
      { name: preference, value: preference === 'prefers-contrast' ? 'more' : 'reduce' },
      { name: 'prefers-reduced-motion', value: 'reduce' },
    ] });
    for (const route of ['/', '/login.html']) {
      await page.goto(route);
      const footer = page.locator('footer');
      await expect(footer).toHaveCSS('background-color', 'rgb(246, 248, 251)');
      await expect(footer).toHaveCSS('color', 'rgb(7, 30, 60)');
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations, route).toEqual([]);
    }
  });
}

for (const route of ['/login.html']) {
  test(`rodapé de ${route} acompanha as divisórias claras`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(route);
    await expect(page.locator('.site-footer')).toHaveCSS('background-color', 'rgb(246, 248, 251)');
    await expect(page.locator('.site-footer')).toHaveCSS('color', 'rgb(7, 30, 60)');
    await expect(page.locator('.footer-bottom p').first()).toHaveCSS('color', 'rgb(82, 101, 123)');
    if (route === '/login.html') await expect(page.locator('.login-art')).toHaveCSS('background-color', 'rgb(7, 30, 60)');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
  });
}

test('divisórias da página inicial usam a paleta clara sem perder contraste ou ações', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const [selector, color] of [
    ['.values-strip', 'rgb(232, 241, 248)'],
    ['.essence-section', 'rgb(246, 248, 251)'],
    ['.site-footer', 'rgb(246, 248, 251)'],
  ]) {
    await expect(page.locator(selector)).toHaveCSS('background-color', color);
    await expect(page.locator(selector)).toHaveCSS('color', 'rgb(7, 30, 60)');
  }
  for (const selector of ['.essence-aside .glass', '.footer-contact .glass']) {
    const trigger = page.locator(selector);
    await expect(trigger).toHaveCSS('color', 'rgb(7, 30, 60)');
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
  await expect(page.locator('.footer-emblem')).toHaveCSS('filter', 'none');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
});
