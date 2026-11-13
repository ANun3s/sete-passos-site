// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

test('texto editorial e apresentação visual cabem na abertura móvel', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#hero-title')).toBeInViewport();
  await expect(page.locator('.hero-description')).toBeVisible();
  await expect(page.locator('[data-swap-card]').first().locator('img')).toBeVisible();
  await expect(page.locator('h1')).toHaveAccessibleName('Um cuidado que respeita o seu tempo.');
});

for (const width of [320, 768, 1024, 1440]) {
  test(`layout, assets e acessibilidade em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const image of await page.locator('footer img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.decode());
    }
    await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const brokenAnchors = await page.locator('a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash));
    expect(brokenAnchors).toEqual([]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
    expect(errors).toEqual([]);
    if (width === 320 || width === 1440) {
      await page.screenshot({ path: `artifacts/site-${width}.png`, fullPage: true });
    }
  });
}

test('diálogo mantém o foco, tem nomes acessíveis e funciona no celular', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.locator('.hero [data-contact]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 9; index++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement))).toBe(true);
  }
  await dialog.getByRole('button', { name: 'Preparar mensagem' }).click();
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Fechar contato' }).click();
  await expect(dialog).not.toBeVisible();
});

test('negativa do clipboard oferece cópia manual sem afirmar sucesso', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Permission denied'); } } }); });
  await page.goto('/');
  await page.locator('.hero [data-contact]').click();
  await page.getByRole('button', { name: 'Preparar mensagem' }).click();
  await page.getByRole('button', { name: 'Copiar mensagem' }).click();
  await expect(page.getByRole('status')).toContainText('copiar manualmente');
  const selection = await page.locator('#prepared-message').evaluate(el => el.selectionEnd - el.selectionStart);
  expect(selection).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Copiar mensagem' })).toBeEnabled();
});

test('sem JavaScript o conteúdo, âncoras e acordeões continuam disponíveis', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5177/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const navigation of await page.getByRole('navigation').all()) {
    await expect(navigation).toBeVisible();
  }
  await expect(page.locator('.care-card')).toHaveCount(4);
  await expect(page.locator('.care-card').nth(1).locator('.care-card-description')).toBeVisible();
  await page.locator('.faq-item summary').first().click();
  await expect(page.locator('.faq-item').first()).toHaveAttribute('open', '');
  await page.locator('.hero [data-contact]').click();
  await expect(page).toHaveURL(/#contato$/);
  await expect(page.locator('#contact-note')).toBeVisible();
  // Exercise the native keyboard path without waiting on animation-frame click stability.
  const backToTop = page.locator('.footer-back');
  await backToTop.focus();
  await expect(backToTop).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
  await context.close();
});

test('a área escolhida é mantida no painel e o estado não vaza entre aberturas', async ({ page }) => {
  await page.goto('/');
  await page.locator('.care-card [data-contact="Estética avançada"]').focus({ preventScroll: true });
  await expect(page.locator('.care-card [data-contact="Estética avançada"]')).toBeFocused();
  await page.locator('.care-card [data-contact="Estética avançada"]').click();
  await expect(page.getByRole('radio', { name: 'Estética avançada', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Preparar mensagem' }).click();
  await page.keyboard.press('Escape');
  await page.locator('.hero [data-contact]').click();
  await expect(page.getByLabel('Ainda não sei por onde começar')).toBeChecked();
  await expect(page.locator('#message-result')).not.toBeVisible();
});
