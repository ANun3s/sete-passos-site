import { test, expect, openProfile } from './profile-fixtures.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

for (const width of [320, 768, 1024, 1440]) {
  test(`account disclosure: hover, keyboard and layout at ${width}`, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openProfile(page, app, `menu-${width}`);
    if (width <= 800) await page.locator('.menu-toggle').click();
    const toggle = page.getByRole('button', { name: 'Abrir menu da conta' });
    const profile = page.locator('.account-dropdown a');
    await expect(toggle).toBeVisible();
    await expect(profile).toBeHidden();
    if (width > 800) {
      await toggle.hover();
      await expect(profile).toBeVisible();
      await profile.hover();
      await expect(profile).toBeVisible();
      await page.locator('h1').hover();
      await expect(profile).toBeHidden();
    }
    await toggle.focus();
    await page.keyboard.press('ArrowDown');
    await expect(profile).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(profile).toBeHidden();
    if (width <= 800) await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(profile).toBeVisible();
    const bounds = await page.locator('.account-dropdown').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(tmpdir(), `sete-passos-account-menu-${width}.png`) });
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('.account-menu')).toBeHidden();
  });
}
