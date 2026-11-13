import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('cartões abrem em leque durante a rolagem no desktop e ficam em fluxo sem movimento reduzido', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');

  const cards = page.locator('[data-care-cards]');
  await cards.scrollIntoViewIfNeeded();
  await expect(cards).toHaveAttribute('data-care-layout', 'deck');
  expect(await cards.evaluate(node => node.parentElement.classList.contains('pin-spacer'))).toBe(true);

  await page.evaluate(() => window.scrollBy({ top: 1500, behavior: 'instant' }));
  await expect(cards).toHaveAttribute('data-care-layout', 'fan');
  await expect(page.locator('.care-card')).toHaveCount(4);
});

test('leque não cria rolagem horizontal em largura desktop compacta', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/');

  const cards = page.locator('[data-care-cards]');
  await cards.scrollIntoViewIfNeeded();
  await expect(cards).toHaveAttribute('data-care-layout', 'deck');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollBy({ top: 1400, behavior: 'instant' }));
  await expect(cards).toHaveAttribute('data-care-layout', 'fan');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('movimento reduzido mantém os quatro cartões acessíveis em grade sem fixação', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const cards = page.locator('[data-care-cards]');
  await cards.scrollIntoViewIfNeeded();
  await expect(cards).not.toHaveAttribute('data-care-layout', /.+/);
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Conhecer essa área/ })).toHaveCount(2);
});

test('focar uma ação abre o leque e mantém a posição de rolagem para navegação por teclado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');

  const cards = page.locator('[data-care-cards]');
  await cards.scrollIntoViewIfNeeded();
  const top = await cards.evaluate(node => node.getBoundingClientRect().top + scrollY - 150);
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), top);
  const firstAction = page.locator('.care-card').first().getByRole('link');
  await firstAction.focus();

  await expect(cards).toHaveAttribute('data-care-layout', 'fan');
  await expect(page.locator('.pin-spacer')).toHaveCount(1);
  await expect(firstAction).toBeInViewport();
});
