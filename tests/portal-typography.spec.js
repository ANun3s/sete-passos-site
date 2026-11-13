// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test('login móvel mantém de cuidado na mesma linha', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/login.html');
  await page.evaluate(() => document.fonts.ready);
  const lineDistance = await page.locator('h1').evaluate(heading => {
    const text = [...heading.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes('de '));
    const range = document.createRange();
    range.selectNodeContents(text);
    return Math.abs(heading.querySelector('em').getBoundingClientRect().top - range.getBoundingClientRect().top);
  });
  expect(lineDistance).toBeLessThan(20);
});
