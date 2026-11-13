// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('aurora segue o ponteiro em um botão de vidro transparente', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('.hero .glass-primary');
  const bounds = await button.boundingBox();
  await page.mouse.move(bounds.x + 18, bounds.y + 18);
  const position = () => button.evaluate(el => el.style.getPropertyValue('--pointer-x'));
  await expect.poll(position).not.toBe('');
  const first = await position();
  await page.mouse.move(bounds.x + bounds.width - 18, bounds.y + 18);
  await expect.poll(position).not.toBe(first);
  await expect.poll(() => button.evaluate(el => Number(getComputedStyle(el, '::before').opacity))).toBeGreaterThan(.5);
  const fill = await button.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(fill).toContain('rgba');
});

