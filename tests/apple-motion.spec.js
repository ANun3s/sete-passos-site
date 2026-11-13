// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

test.use({ baseURL: process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177' });

for (const method of ['Escape', 'botão']) {
  test(`contato do menu móvel devolve o foco ao botão do menu ao fechar por ${method}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const toggle = page.locator('.menu-toggle');
    const nav = page.locator('#main-nav');
    await toggle.click();
    await nav.getByRole('link', { name: 'Vamos conversar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    if (method === 'botão') {
      await expect(nav).not.toBeVisible(); // Also cover the fully hidden disclosure.
      await dialog.locator('.dialog-close').click();
    } else await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(nav.locator('a').first()).toBeFocused();
  });
}

test('menu reduzido muda instantaneamente e continua acessível após redimensionar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login.html');
  const nav = page.locator('#main-nav');
  const toggle = page.locator('.menu-toggle');
  await toggle.click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(nav).toHaveCSS('opacity', '1');
  await expect(nav).toHaveCSS('transform', 'none');
  await expect(nav).not.toHaveAttribute('data-animating');
  await page.keyboard.press('Escape');
  await expect(nav).toHaveCSS('opacity', '0');
  await expect(nav).not.toBeVisible();
  await expect(toggle).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(nav).toBeVisible();
  // CSS reflows before the matchMedia change event updates disclosure state.
  await expect(nav).toHaveJSProperty('inert', false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).not.toBeVisible();
  await toggle.click();
  await expect(nav.locator('a').first()).toBeFocused();
});

test('menu pode fechar e reabrir durante a transição GSAP sem saltar ou bloquear o botão', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login.html');
  const nav = page.locator('#main-nav');
  await page.locator('.menu-toggle').click();
  await page.waitForFunction(() => {
    const opacity = Number(getComputedStyle(document.querySelector('#main-nav')).opacity);
    return opacity > .02 && opacity < .98;
  }, undefined, { timeout: 3000 });
  const state = await page.evaluate(() => {
    const nav = document.querySelector('#main-nav');
    const button = document.querySelector('.menu-toggle');
    const sample = () => ({ transform: getComputedStyle(nav).transform, opacity: getComputedStyle(nav).opacity });
    const before = sample();
    button.click();
    const closed = sample();
    const inert = nav.inert;
    button.click();
    return { before, closed, reopened: sample(), inert, expanded: button.getAttribute('aria-expanded') };
  });
  expect(state.closed).toEqual(state.before);
  expect(state.reopened).toEqual(state.before);
  expect(state.inert).toBe(true);
  expect(state.expanded).toBe('true');
  await expect(nav).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-toggle')).toBeFocused();
  await expect(nav).toHaveCSS('opacity', '0');
  await expect(nav).not.toBeVisible();
  await expect(nav).not.toHaveAttribute('data-animating');
});

test('mola conserva a velocidade entre quadros e converge sem oscilação decorativa', async () => {
  const spring = await import('../src/spring.js').catch(() => null);
  expect(spring, 'integrador de mola disponível').not.toBeNull();
  let state = { value: 0, velocity: 0 };
  const samples = [];
  for (let i = 0; i < 120; i++) {
    state = spring.advanceSpring(state.value, state.velocity, 1, 1 / 120, .35);
    samples.push(state.value);
  }
  expect(samples.every((value, i) => value >= (samples[i - 1] || 0) && value <= 1)).toBe(true);
  expect(state.value).toBeCloseTo(1, 4);
  const moving = spring.advanceSpring(0, 0, 1, .08, .35);
  const reversed = spring.advanceSpring(moving.value, moving.velocity, 0, .001, .35);
  expect(reversed.value).toBeGreaterThan(moving.value); // Momentum is not erased on reversal.
  const once = spring.advanceSpring(0, 0, 1, .032, .35);
  const half = spring.advanceSpring(0, 0, 1, .016, .35);
  const twice = spring.advanceSpring(half.value, half.velocity, 1, .016, .35);
  expect(twice.value).toBeCloseTo(once.value, 9); // Frame-rate independent solution.
});
