import { test, expect } from '../auth-tests/profile-fixtures.mjs';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

test('imagem do DitherVeil fica contida mesmo sem carregar o módulo', async ({ page }) => {
  await page.route('**/src/components/DitherVeil.js*', route => route.abort());
  await page.goto('/sobre.html');
  const frame = page.locator('[data-dither-veil]');
  const image = frame.locator('[data-dither-fallback]');
  await expect(image).toBeVisible();
  const bounds = await frame.boundingBox();
  const imageBounds = await image.boundingBox();
  expect(imageBounds.x).toBeGreaterThanOrEqual(bounds.x);
  expect(imageBounds.y).toBeGreaterThanOrEqual(bounds.y);
  expect(imageBounds.x + imageBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
  expect(imageBounds.y + imageBounds.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
});

test('módulo DitherVeil funciona como JavaScript nativo no Go Live', async ({ page }) => {
  // Serve the original module, without Vite rewriting CSS or package imports.
  const source = await readFile(new URL('../src/components/DitherVeil.js', import.meta.url), 'utf8');
  await page.route('**/src/components/DitherVeil.js*', route => route.fulfill({ contentType: 'text/javascript', body: source }));
  await page.goto('/sobre.html');
  await expect(page.locator('[data-dither-veil] canvas')).toHaveCSS('opacity', '1');
});

test('página Sobre conecta a navegação, separa as áreas e carrega suas imagens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Sobre', exact: true }).click();

  const content = page.locator('#page-content');
  await expect(content).toHaveAttribute('data-page', 'sobre');
  await expect(page).toHaveURL(/sobre\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: /Cuidado que respeita/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Um cuidado que começa pela escuta.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seu movimento. Seu ponto de partida.' })).toBeVisible();
  await expect(page.locator('.about-photo img')).toHaveCount(2);
  expect(await page.locator('.about-photo img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
});

test('DitherVeil ocupa o espaço ao lado do título e deixa os textos abaixo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/sobre.html');
  const title = page.locator('#about-title');
  const dither = page.locator('[data-dither-veil]');
  const canvas = dither.locator('canvas');
  await expect(dither).toBeVisible();
  await expect(canvas).toBeVisible();
  await expect(dither).toHaveAttribute('data-pattern', 'floyd');
  await expect(dither).toHaveAttribute('data-pixel-size', '2');

  const titleBox = await title.boundingBox();
  const ditherBox = await dither.boundingBox();
  const copyBox = await page.locator('.about-intro-copy').boundingBox();
  expect(titleBox.x + titleBox.width).toBeLessThan(ditherBox.x);
  expect(Math.abs(titleBox.y - ditherBox.y)).toBeLessThan(8);
  expect(copyBox.y).toBeGreaterThan(ditherBox.y + ditherBox.height);
  const canvasSize = await canvas.evaluate(element => [element.width, element.height]);
  expect(canvasSize[0]).toBeGreaterThan(0);
  expect(canvasSize[1]).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('DitherVeil continua animado sem acesso à imagem externa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.route('https://images.unsplash.com/**', route => route.abort());
  await page.goto('/sobre.html');

  const dither = page.locator('[data-dither-veil]');
  const canvas = dither.locator('canvas');
  await expect(canvas).toHaveCSS('opacity', '1');
  await expect(dither.locator('[data-dither-fallback]')).toBeHidden();
  await page.waitForTimeout(1200);

  const before = await dither.screenshot();
  const box = await dither.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const after = await dither.screenshot();
  const first = await sharp(before).removeAlpha().raw().toBuffer();
  const second = await sharp(after).removeAlpha().raw().toBuffer();
  let changed = 0;
  for (let i = 0; i < first.length; i += 3) {
    if (Math.abs(first[i] - second[i]) + Math.abs(first[i + 1] - second[i + 1]) + Math.abs(first[i + 2] - second[i + 2]) > 30) changed++;
  }
  expect(changed / (first.length / 3)).toBeGreaterThan(0.1);
});

test('página Sobre mantém o estilo ao ser aberta a partir do login', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login.html');
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Sobre', exact: true }).click();
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'sobre');
  expect(Number.parseFloat(await page.locator('#about-title').evaluate(node => getComputedStyle(node).fontSize))).toBeGreaterThan(50);
});

test('contorno prismático acompanha o mouse na moldura da imagem', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/sobre.html');
  const frame = page.locator('.about-photo-aesthetics');
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .2);
  await page.waitForFunction(() => {
    const surface = document.querySelector('.about-photo-aesthetics');
    return surface?.style.getPropertyValue('--pointer-x') !== '';
  });
  await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('.about-photo-aesthetics'), '::after').opacity) > .9);

  const state = await frame.evaluate(element => ({
    pointer: element.style.getPropertyValue('--pointer-x'),
    glow: getComputedStyle(element, '::after').opacity,
    gradient: getComputedStyle(element, '::after').backgroundImage,
  }));
  expect(Number.parseFloat(state.pointer)).toBeGreaterThan(0);
  expect(Number.parseFloat(state.glow)).toBeGreaterThan(.9);
  expect(state.gradient).toContain('radial-gradient');
});

test('prefere movimento reduzido e mantém a área de fisioterapia legível no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/sobre.html');

  const physiotherapy = page.locator('.about-physio');
  const dither = page.locator('[data-dither-veil]');
  await expect(physiotherapy.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(physiotherapy.locator('img')).toBeVisible();
  await expect(dither).toBeVisible();
  expect((await page.locator('.about-intro-copy').boundingBox()).y).toBeGreaterThan((await dither.boundingBox()).y + (await dither.boundingBox()).height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await physiotherapy.locator('img').evaluate(image => getComputedStyle(image).transform)).toBe('none');
  const imageFrame = page.locator('.about-photo-aesthetics');
  await imageFrame.scrollIntoViewIfNeeded();
  await imageFrame.hover();
  expect(await imageFrame.evaluate(element => element.style.getPropertyValue('--pointer-x'))).toBe('');
});
