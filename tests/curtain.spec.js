// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

const nav = page => page.getByRole('navigation', { name: 'Navegação principal' });

test('cortina cobre antes de trocar a página, bloqueia cliques e entrega foco', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page-curtain')).toBeAttached();
  await page.evaluate(() => {
    window.__swaps = [];
    let previous = document.querySelector('h1').textContent;
    new MutationObserver(() => {
      const current = document.querySelector('h1')?.textContent;
      if (!current || current === previous) return;
      previous = current;
      const curtain = document.querySelector('#page-curtain');
      // View Transitions temporarily hit-tests the snapshot as <html>, not its painted DOM.
      // Verify the actual opaque polygon covers both edges across the entire viewport.
      const style = getComputedStyle(curtain);
      const points = [...style.clipPath.matchAll(/(-?[\d.]+)%/g)].map(match => Number(match[1]));
      const bounds = curtain.getBoundingClientRect();
      window.__swaps.push({ current, phase: curtain.dataset.phase, direction: curtain.dataset.direction,
        covered: !curtain.hidden && style.opacity === '1' && style.backgroundColor === 'rgb(7, 30, 60)' && bounds.width === innerWidth && bounds.height === innerHeight && points[0] <= 0 && points[2] >= 100 && points[4] >= 100 && points[6] <= 0 });
    }).observe(document.body, { childList: true, subtree: true });
  });
  await nav(page).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page.locator('#page-curtain')).toHaveAttribute('data-phase', 'covering');
  await expect(page.locator('#page-curtain')).toHaveAttribute('data-direction', 'left');
  await expect(page.locator('#page-curtain-title')).toHaveText('Login');
  expect(await page.locator('#page-content').evaluate(el => el.inert)).toBe(true);
  // A synthetic double-click must not queue an unrelated second navigation.
  await page.locator('#main-nav a[href="/index.html"]').evaluate(link => link.click());
  await expect(page.locator('#page-curtain')).toBeHidden();
  await expect(page).toHaveURL(/login\.html$/);
  await expect(page.locator('h1')).toBeFocused();
  await expect(page.locator('#page-announcement')).toHaveText('Navegou para Login');
  await expect(nav(page).getByRole('link', { name: 'Login', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => window.__swaps)).toEqual([expect.objectContaining({ phase: 'covered', direction: 'left', covered: true })]);
});
