// A real per-test API isolates session probes from the user's development account.
import { test, expect, syntheticAdminAccount, signIn } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('área administrativa mantém hierarquia legível, foco e reflow no celular', async ({ page, app }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const account = await syntheticAdminAccount(app);
  await signIn(page, account);
  await expect(page.locator('#profile-content')).toBeVisible();
  await page.goto('/admin.html');
  await expect(page.locator('.admin-workspace')).toBeVisible();
  await page.getByRole('link', { name: 'Fichas', exact: true }).click();
  await expect(page.locator('.record-card')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.record-description').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  const audit = await new AxeBuilder({ page }).include('#principal').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
});

test('ações desativadas não sugerem interação com aurora, ícone ou pressão', async ({ page }) => {
  await page.goto('/login.html');
  const button = page.locator('#login-form .auth-submit');
  await expect(button).toBeEnabled();
  await button.evaluate(el => { el.disabled = true; });
  await button.dispatchEvent('pointermove', { clientX: 100, clientY: 100, pointerType: 'mouse' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await button.evaluate(el => el.style.getPropertyValue('--pointer-x'))).toBe('');
  await button.hover({ force: true });
  await page.mouse.down();
  await expect(button).toHaveCSS('transform', 'none');
  await expect(button.locator('.icon')).toHaveCSS('transform', 'none');
  await page.mouse.up();
  await expect(button).toBeDisabled();
});

test('botão responde à pressão antes do clique sem duplicar o vidro do header', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site-header .glass').last()).toHaveCSS('backdrop-filter', 'none');
  const button = page.locator('.hero .glass');
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const feedback = await button.evaluate(el => ({
    maxDuration: Math.max(...getComputedStyle(el).transitionDuration.split(',').map(parseFloat)),
    pressed: el.matches(':active'),
  }));
  expect(feedback.pressed).toBe(true);
  expect(feedback.maxDuration).toBeLessThanOrEqual(.1);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(() => button.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11)).toBeLessThan(1);
  await page.mouse.up();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('contraste aumentado mantém materiais sólidos e limites visíveis', async ({ page }) => {
  await page.emulateMedia({ contrast: 'more' });
  await page.goto('/');
  await expect(page.locator('.site-header')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.locator('.hero .glass')).toHaveCSS('border-color', 'rgb(7, 30, 60)');
  await page.goto('/login.html');
  await expect(page.locator('.site-header')).toHaveCSS('backdrop-filter', 'none');
});

test('redução de transparência torna as superfícies sólidas sem apagar ações', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] });
  await page.goto('/');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true);
  for (const selector of ['.site-header', '.hero .glass']) {
    const style = await page.locator(selector).evaluate(el => ({ blur: getComputedStyle(el).backdropFilter, background: getComputedStyle(el).backgroundColor }));
    expect(style.blur).toBe('none');
    expect(style.background).toMatch(/^rgb\(/);
  }
  await page.locator('.hero [data-contact]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.getByRole('dialog').evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('none');
});
