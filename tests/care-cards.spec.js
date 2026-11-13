// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

test('grade estática tem quatro cards e as duas áreas abrem o contato correto', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const cards = page.locator('.care-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).getByRole('heading', { name: 'Fisioterapia', exact: true })).toBeVisible();
  await expect(cards.nth(1).getByRole('heading', { name: 'Estética avançada', exact: true })).toBeVisible();
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(a.x + a.width).toBeLessThan(b.x);
  expect(Math.abs((a.x + b.x + b.width) / 2 - 720)).toBeLessThan(2);
  for (const [index, interest] of ['Fisioterapia', 'Estética avançada'].entries()) {
    const card = cards.nth(index);
    await expect(card.locator('.care-card-description')).not.toBeEmpty();
    const action = card.locator('[data-contact]');
    await action.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('radio', { name: interest, exact: true })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(action).toBeFocused();
  }
});


test('tilt usa a camada interna e repousa sem alterar o deslocamento do card', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('.care-card').first();
  await page.evaluate(() => document.fonts.ready);
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const base = await card.evaluate(el => el.style.transform);
  const box = await card.boundingBox();
  await card.hover({ position: { x: box.width * .8, y: 60 } });
  await expect.poll(() => card.locator('.tilted-card-inner').evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
  await expect.poll(() => card.locator('.tilted-card-inner').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m13)).not.toBe(0);
  expect(await card.evaluate(el => el.style.transform)).toBe(base);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => card.locator('.tilted-card-inner').evaluate(el => getComputedStyle(el).transform)).toBe('none');
});
