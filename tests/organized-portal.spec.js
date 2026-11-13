import { test, expect, syntheticAdminAccount, signIn } from '../auth-tests/profile-fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 1440]) {
  test(`perfil e administração mantêm layout e estilos entre páginas em ${width}px`, async ({ page, app }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const account = await syntheticAdminAccount(app);
    await signIn(page, account);
    await expect(page.locator('#profile-content')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `artifacts/review-profile-${width}.png`, fullPage: true });
    if (width === 320) await page.locator('.menu-toggle').click();
    await page.locator('[data-admin-link]').click();
    await expect(page.locator('.admin-workspace')).toBeVisible();
    await expect(page.locator('.admin-workspace')).toHaveCSS('display', 'grid');
    await page.getByRole('link', { name: 'Pessoas e acessos', exact: true }).click();
    await expect(page.locator('.admin-user-card')).toHaveCount(1);
    await page.getByText('Adicionar ficha a este perfil').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `artifacts/review-admin-${width}.png`, fullPage: true });
    if (width === 320) await page.locator('.menu-toggle').click();
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true }).click();
    await expect(page.locator('.care-cards')).toHaveCSS('display', 'grid');
    await page.locator('.hero [data-contact]').click();
    await expect(page.getByRole('dialog')).toHaveCSS('border-radius', '24px');
  });
}
