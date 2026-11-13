// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

async function login(page) {
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'login');
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('h1')).toBeFocused();
}

test('sem View Transitions mantém a cortina e a navegação', async ({ page }) => {
  await page.addInitScript(() => { document.startViewTransition = undefined; });
  await page.goto('/');
  await login(page);
  await expect(page.locator('#page-curtain')).toHaveAttribute('data-direction', 'left');
  await expect(page.locator('#page-curtain')).toBeHidden();
});

test('movimento reduzido não cria animações de cortina nem snapshots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.curtainAnimations = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { if (this.closest('#page-curtain')) window.curtainAnimations++; return animate.apply(this, args); };
    document.startViewTransition = () => { throw new Error('Não deve usar snapshots com movimento reduzido'); };
  });
  await page.goto('/');
  await login(page);
  expect(await page.evaluate(() => window.curtainAnimations)).toBe(0);
  await expect(page.locator('#page-curtain')).toBeHidden();
});

test('sem Web Animations troca instantaneamente sem travar o conteúdo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    document.startViewTransition = undefined;
    Element.prototype.animate = undefined;
    Element.prototype.getAnimations = undefined;
  });
  await page.goto('/');
  await login(page);
  expect(errors).toEqual([]);
});

test('falha de rede mantém a página utilizável e permite tentar de novo', async ({ page }) => {
  await page.goto('/');
  await page.route('**/login.html', route => route.abort('failed'));
  await page.locator('#main-nav a[href="/login.html"]').click();
  await expect(page.locator('#navigation-error')).toBeVisible();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'inicio');
  expect(await page.locator('#page-content').evaluate(el => el.inert)).toBe(false);
  await expect(page).toHaveURL('http://127.0.0.1:5177/');
  await page.unroute('**/login.html');
  await login(page);
  await expect(page.locator('#navigation-error')).toBeHidden();
});

test('direção pura e geometria respeitam os índices e o ângulo configurável', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { pageCurtainDirection, curtainPolygons } = await import('/src/curtain-effect.js');
    return { directions: [pageCurtainDirection(0,1), pageCurtainDirection(2,0)],
      straight: curtainPolygons('left', 0, 1440, 900),
      diagonal: curtainPolygons('left', 9, 1440, 900),
      reverse: curtainPolygons('right', 9, 1440, 900) };
  });
  expect(result.directions).toEqual(['left', 'right']);
  expect(result.straight[1]).toBe('polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)');
  expect(result.diagonal).not.toEqual(result.straight);
  expect(result.reverse).toEqual([...result.diagonal].reverse());
});
