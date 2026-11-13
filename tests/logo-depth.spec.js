// CardSwap replaced the enlarged hero mark; the logo is now the first card.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('a marca abre a pilha e as duas lâminas seguintes representam os serviços', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('[data-swap-card]');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute('data-front', '');
  await expect(cards.nth(0).locator('img')).toHaveAttribute('alt', 'Logo Sete Passos — Físio e Estética Avançada');
  await expect(cards.nth(1)).toHaveAttribute('aria-label', 'Fisioterapia — imagem ilustrativa');
  await expect(cards.nth(2)).toHaveAttribute('aria-label', 'Estética avançada — imagem ilustrativa');
  for (const card of await cards.all()) {
    const heading = card.locator('.card-swap-head');
    const media = card.locator('.card-swap-media');
    expect(await heading.evaluate(node => node.compareDocumentPosition(node.nextElementSibling) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    expect((await heading.boundingBox()).y).toBeLessThan((await media.boundingBox()).y);
  }
  expect(await page.locator('[data-swap-card] img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
});

test('arrastar para a esquerda avança os cartões e mantém a pilha ampla', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  const first = page.locator('[data-swap-card]').nth(0);
  const bounds = await first.boundingBox();
  expect(bounds.width).toBeGreaterThan(420);

  const pause = page.locator('[data-swap-toggle]');
  await pause.click();
  const boundsToDrag = await first.locator('.card-swap-media').boundingBox();
  const startX = boundsToDrag.x + boundsToDrag.width * 0.7;
  const startY = boundsToDrag.y + boundsToDrag.height * 0.55;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 150, startY, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-swap-card]').nth(1)).toHaveAttribute('data-front', '', { timeout: 1500 });
});

test('as divisórias editoriais abrem as páginas antecipadas no menu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Prévia das páginas do menu' }).getByRole('link', { name: /Casos de sucesso/ }).click();
  await expect(page).toHaveURL(/historias\.html$/);
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'historias');
  await page.getByRole('link', { name: 'Sete Passos — início' }).click();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'inicio');
  await expect(page.locator('.home-preview-link')).toHaveCount(3);
});

test('o deck troca automaticamente, mas pausa ao receber foco ou pedido explícito', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await expect(page.locator('[data-swap-card]').nth(0)).toHaveAttribute('data-front', '');
  await expect(page.locator('[data-swap-card]').nth(1)).not.toHaveAttribute('data-front', '');
  await expect(page.locator('[data-swap-card]').nth(1)).toHaveAttribute('aria-hidden', 'true');

  const pause = page.locator('[data-swap-toggle]');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(pause).toContainText('Retomar apresentação');
  await page.waitForTimeout(4500);
  await expect(page.locator('[data-swap-card]').nth(0)).toHaveAttribute('data-front', '');
  await expect(page.locator('[data-swap-card]').nth(1)).not.toHaveAttribute('data-front', '');

  await page.locator('[data-swap-next]').click();
  await expect(page.locator('[data-swap-card]').nth(1)).toHaveAttribute('data-front', '');
  await expect(page.locator('[data-swap-status]')).toContainText('Fisioterapia');
  await page.locator('[data-swap-previous]').click();
  await expect(page.locator('[data-swap-card]').nth(0)).toHaveAttribute('data-front', '');
});

test('movimento reduzido desativa autoplay e mantém a navegação manual', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('[data-swap-toggle]')).toBeHidden();
  await expect(page.locator('[data-swap-card]').nth(0)).toHaveAttribute('data-front', '');
  await page.locator('[data-swap-next]').click();
  await expect(page.locator('[data-swap-card]').nth(1)).toHaveAttribute('data-front', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sem JavaScript a identidade continua visível e controles inativos são ocultados', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5177/');
  await expect(page.locator('[data-swap-card]').first()).toBeVisible();
  await expect(page.locator('[data-swap-card]').first().locator('img')).toBeVisible();
  await expect(page.locator('[data-swap-card]').nth(1)).toBeHidden();
  await expect(page.locator('[data-swap-toggle]')).toBeHidden();
  await expect(page.locator('#hero-title')).toBeVisible();
  await context.close();
});
