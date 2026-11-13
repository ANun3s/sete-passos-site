import { test, expect, origin, syntheticAdminAccount, signIn } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const width of [320, 768, 1024, 1440]) {
  test(`admin e Fichas mantêm reflow em ${width}px`, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const account = await syntheticAdminAccount(app);
    await signIn(page, account);
    await expect(page.locator('#profile-content')).toBeVisible();
    await page.goto(`${origin}/admin.html`);
    await expect(page.locator('.admin-workspace')).toBeVisible();
    await expect(page.locator('.record-card')).toHaveCount(0);
    await page.getByRole('link', { name: 'Fichas', exact: true }).click();
    await expect(page.locator('.record-card')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('área administrativa não instala movimento de rolagem e preserva reflow a 200%', async ({ page, app }) => {
  const account = await syntheticAdminAccount(app);
  await signIn(page, account);
  await expect(page.locator('#profile-content')).toBeVisible();
  await page.goto(`${origin}/admin.html?section=fichas`);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.record-card')).toHaveCount(1);
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('[data-scroll-stack], .pin-spacer')).toHaveCount(0);
});

test('rota legada sem JavaScript não revela a biblioteca', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${origin}/fichas.html`);
  await expect(page).toHaveURL(/login\.html/);
  await expect(page.locator('.record-card, .records-library')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
