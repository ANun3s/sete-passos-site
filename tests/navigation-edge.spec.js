// A real per-test API isolates session probes from the user's development account.
import { test, expect } from '../auth-tests/profile-fixtures.mjs';

const portalURL = process.env.PORTAL_BASE_URL || 'http://127.0.0.1:5177';
test.use({ baseURL: portalURL });

async function settle(page, key) {
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', key);
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
}

test('Voltar cancela o clique pendente antes do pushState e preserva o avanço', async ({ page }) => {
  await page.goto('/');
  await page.locator('#main-nav a[href="/login.html"]').click();
  await settle(page, 'login');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/index.html', async route => { await gate; await route.continue(); });
  const requested = page.waitForRequest('**/index.html');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true }).click();
  await requested;
  await page.goBack();
  release();
  await settle(page, 'inicio');
  await expect(page).toHaveURL(new URL('/', portalURL).href);
  await page.goForward();
  await settle(page, 'login');
  await expect(page).toHaveURL(/login\.html$/);
});

test('fragmento entre páginas recebe o foco e mantém o próximo Tab na seção', async ({ page }) => {
  await page.goto('/login.html');
  const link = page.getByRole('navigation', { name: 'Navegação do rodapé' }).getByRole('link', { name: 'Nosso cuidado', exact: true });
  await link.focus();
  await page.keyboard.press('Enter');
  await settle(page, 'inicio');
  await expect(page).toHaveURL(/index\.html#cuidado$/);
  await expect(page.locator('#cuidado')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement.closest('#cuidado')))).toBe(true);
});

test('fragmento malformado cai no título sem erro de navegação', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/login.html');
  const link = page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true });
  await link.evaluate(element => element.setAttribute('href', '/index.html#%E0%A4'));
  await link.click();
  await settle(page, 'inicio');
  await expect(page.locator('h1')).toBeFocused();
  await expect(page.locator('#page-announcement')).toHaveText('Navegou para Início');
  expect(errors).toEqual([]);
});

test('histórico fecha o contato antes do carregamento e da cortina', async ({ page }) => {
  await page.goto('/login.html');
  await page.locator('#main-nav a[href="/index.html"]').click();
  await settle(page, 'inicio');
  await page.locator('.hero [data-contact]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/login.html', async route => { await gate; await route.continue(); });
  try {
    await page.goBack();
    await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'true');
    expect(await page.locator('#contact-dialog').evaluate(dialog => dialog.open)).toBe(false);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(false);
  } finally {
    release();
  }
  await settle(page, 'login');
  await expect(page.locator('h1')).toBeFocused();
  expect(await page.evaluate(() => document.body.classList.contains('dialog-open'))).toBe(false);
});

test('as animações da página inicial continuam interativas ao voltar de outras páginas', async ({ page }) => {
  await page.goto('/');

  for (let cycle = 0; cycle < 2; cycle += 1) {
    await page.locator('[data-card-swap]').waitFor({ state: 'visible' });
    await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
    const toggle = page.locator('[data-swap-toggle]');
    if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Sobre', exact: true }).click();
    await settle(page, 'sobre');
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início', exact: true }).click();
    await settle(page, 'inicio');

    await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
    const returnedToggle = page.locator('[data-swap-toggle]');
    if (await returnedToggle.getAttribute('aria-pressed') !== 'true') await returnedToggle.click();
    await expect(returnedToggle).toHaveAttribute('aria-pressed', 'true');
    const returnedTitle = await page.locator('[data-swap-card][data-front]').getAttribute('data-swap-title');
    await page.locator('[data-swap-next]').click();
    await expect.poll(() => page.locator('[data-swap-card][data-front]').getAttribute('data-swap-title'))
      .not.toBe(returnedTitle);

    const folder = page.locator('[data-care-folder-root]');
    await folder.scrollIntoViewIfNeeded();
    const stage = folder.locator('.folder-stage');
    await stage.click();
    await expect(stage).toHaveAttribute('aria-expanded', 'true');
    const firstItem = folder.locator('.folder-item').first();
    await expect(firstItem).toHaveAttribute('role', 'button');
    await firstItem.click();
    await expect(page.locator('.care-expanded-card')).toBeVisible();
    await expect(page.locator('#care-expanded-title')).toHaveText('Fisioterapia');
  }
});

test('Sobre e Casos de sucesso carregam seus estilos ao navegar pela SPA', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');

  const destinations = [
    {
      name: 'Sobre',
      pageKey: 'sobre',
      selector: '.about-dither',
      style: element => getComputedStyle(element).borderRadius,
      expected: '28px',
    },
    {
      name: 'Casos de sucesso',
      pageKey: 'historias',
      selector: '.stories-wall',
      style: element => getComputedStyle(element).position,
      expected: 'absolute',
    },
  ];

  for (const destination of destinations) {
    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: destination.name, exact: true }).click();
    await settle(page, destination.pageKey);
    await expect(page.locator(destination.selector)).toBeVisible();
    await expect.poll(() => page.locator(destination.selector).evaluate(destination.style))
      .toBe(destination.expected);
  }

  await page.getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Início', exact: true }).click();
  await settle(page, 'inicio');
  await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.locator('.card-swap-stage').evaluate(element => getComputedStyle(element).perspective))
    .toBe('900px');

  for (const route of ['sobre', 'historias']) {
    await page.goto(`/${route}.html`);
    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Início', exact: true }).click();
    await settle(page, 'inicio');
    await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
    await expect.poll(() => page.locator('.card-swap-stage').evaluate(element => getComputedStyle(element).perspective))
      .toBe('900px');
  }
  expect(errors).toEqual([]);
});

test('aguarda a folha de estilos da rota antes de trocar o conteúdo', async ({ page }) => {
  await page.goto('/');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/src/about.css', async route => {
    await gate;
    await route.continue();
  });

  const requested = page.waitForRequest('**/src/about.css');
  await page.getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Sobre', exact: true }).click();
  await requested;
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'inicio');
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'true');

  release();
  await settle(page, 'sobre');
  await expect.poll(() => page.locator('.about-dither').evaluate(element => getComputedStyle(element).borderRadius))
    .toBe('28px');
});

test('falha ao carregar o CSS da página preserva a página atual e mostra aviso', async ({ page }) => {
  await page.goto('/');
  await page.route('**/src/about.css', route => route.abort('failed'));
  await page.getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Sobre', exact: true }).click();

  await expect(page.locator('#navigation-error')).toBeVisible();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'inicio');
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
  await expect(page).toHaveURL(new URL('/', portalURL).href);
  expect(await page.locator('#page-content').evaluate(element => element.inert)).toBe(false);
});

test('layout da Home permanece idêntico ao voltar de Sobre e Casos de sucesso', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');

  const readHomeLayout = () => page.evaluate(() => {
    const inspect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        box: [rect.x, rect.y, rect.width, rect.height].map(value => Math.round(value * 100) / 100),
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        alignItems: style.alignItems,
        gap: style.gap,
        padding: style.padding,
        textAlign: style.textAlign,
        maxWidth: style.maxWidth,
        backgroundColor: style.backgroundColor,
      };
    };
    return {
      hero: inspect('.hero'),
      heroCopy: inspect('.hero-copy'),
      heroVisual: inspect('.hero-visual'),
      valuesStrip: inspect('.values-strip'),
      valuesContainer: inspect('.values-strip .container'),
      valuesLabel: inspect('.values-strip span'),
      valuesIcon: inspect('.values-strip .icon'),
    };
  });

  const initial = await readHomeLayout();
  for (const [label, key] of [['Sobre', 'sobre'], ['Casos de sucesso', 'historias']]) {
    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: label, exact: true }).click();
    await settle(page, key);
    await page.getByRole('navigation', { name: 'Navegação principal' })
      .getByRole('link', { name: 'Início', exact: true }).click();
    await settle(page, 'inicio');
    await expect(page.locator('[data-card-swap]')).toHaveAttribute('data-ready', 'true');
    await page.evaluate(() => document.fonts.ready);
    expect(await readHomeLayout()).toEqual(initial);
  }
});
