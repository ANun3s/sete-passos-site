// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const width of [320, 768, 1024, 1440]) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`divisórias encaixadas em ${width}px com movimento ${reducedMotion}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ reducedMotion });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const gaps = await page.locator('[data-stack-slot]').evaluateAll(slots => slots.slice(1).map((slot, index) =>
        slot.getBoundingClientRect().top - slots[index].getBoundingClientRect().bottom));
      const expected = 0;
      for (const gap of gaps) expect(gap).toBeCloseTo(expected, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (reducedMotion === 'no-preference') {
        await page.screenshot({ path: join(tmpdir(), 'sete-passos-section-spacing', `index-${new URL(page.url()).port}-${width}.png`) });
      }
      expect(errors).toEqual([]);
    });
  }
}

test.describe('fallback estático', () => {
  test.use({ javaScriptEnabled: false });
  test('encaixe não depende de GSAP ou de JavaScript', async ({ page }) => {
    await page.goto('/');
    const gap = await page.locator('[data-stack-slot]').nth(1).evaluate(el =>
      el.getBoundingClientRect().top - el.previousElementSibling.getBoundingClientRect().bottom);
    expect(gap).toBeCloseTo(0, 1);
  });
});

test('divisórias se encontram sem espaço externo; respiro fica dentro das seções', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const gaps = await page.locator('[data-stack-slot]').evaluateAll(slots => slots.slice(1).map((slot, index) => {
    return slot.getBoundingClientRect().top - slots[index].getBoundingClientRect().bottom;
  }));
  expect(gaps).toHaveLength(4);
  for (const gap of gaps) expect(gap).toBeCloseTo(0, 1);
  await expect(page.locator('.care-card')).toHaveCount(4);
});
