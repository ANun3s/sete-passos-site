import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('conteúdo permanece visível no fluxo nativo antes e depois da rolagem', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-stack-active="true"], [data-care-layout="deck"]')).toHaveCount(0);
  const sample = () => page.locator('.scroll-stack-card, .care-card').evaluateAll(nodes => nodes.map(node => ({
    top: node.getBoundingClientRect().top + scrollY,
    transform: getComputedStyle(node).transform,
    position: getComputedStyle(node).position,
  })));
  const before = await sample();
  await page.evaluate(() => window.scrollTo({ top: 1800, behavior: 'instant' }));
  await page.waitForTimeout(100);
  const after = await sample();
  expect(after).toEqual(before);
  expect(after.every(item => item.transform === 'none' && !['fixed', 'sticky'].includes(item.position))).toBe(true);
  expect(await page.locator('[data-reveal]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).opacity === '1'))).toBe(true);
  expect(await page.locator('[data-stack-slot]').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).paddingBottom === '0px'))).toBe(true);
});

test('âncoras levam ao conteúdo e ao foco sem depender de uma animação', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('.hero a[href="#cuidado"]').click();
  await expect(page.locator('#cuidado')).toBeFocused();
  await expect(page).toHaveURL(/#cuidado$/);
  expect(await page.locator('#cuidado').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await page.locator('.care-card').nth(2).getByRole('link').click();
  await expect(page.locator('#essencia')).toBeFocused();
});

test('recarregar preserva a posição nativa sem saltos de layout', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
  const before = await page.evaluate(() => scrollY);
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
});

test('texto a 200% mantém cards e ações no fluxo em tela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const card of await page.locator('.care-card').all()) {
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await card.getByRole('link').focus();
    await expect(card.getByRole('link')).toBeInViewport();
  }
});
