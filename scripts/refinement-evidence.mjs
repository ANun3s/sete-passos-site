import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts/refinement', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.goto('http://127.0.0.1:5177/');
await page.evaluate(() => document.fonts.ready);
await page.locator('.hero-logo').evaluate(img => img.decode());
await page.screenshot({ path: 'artifacts/refinement/hero-1440.png' });
const logo = await page.locator('[data-logo-card]').boundingBox();
await page.mouse.move(logo.x + logo.width * .85, logo.y + logo.height * .25);
await page.waitForTimeout(650);
await page.screenshot({ path: 'artifacts/refinement/logo-hover-1440.png' });
const hover = await page.locator('[data-logo-card]').evaluate(el => ({ matrix: getComputedStyle(el).transform, angle: el.style.getPropertyValue('--border-angle'), active: el.dataset.active }));
await page.mouse.move(8, 120);
await page.locator('footer').scrollIntoViewIfNeeded();
await page.locator('footer img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
await page.locator('footer').screenshot({ path: 'artifacts/refinement/footer-1440.png' });
await page.emulateMedia({ reducedMotion: 'reduce' });
const sizes = [];
for (const width of [320, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 960 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  sizes.push(await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    center: ['.hero-copy', '.hero-visual', '#cuidado .section-heading', '#duvidas .section-heading', '.contact-action'].map(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { selector, delta: Math.abs(box.x + box.width / 2 - innerWidth / 2) };
    }),
  })));
  await page.screenshot({ path: `artifacts/refinement/full-${width}.png`, fullPage: true });
}
const result = { hover, sizes, errors };
await writeFile('artifacts/refinement/inspection.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
if (errors.length || sizes.some(size => size.scrollWidth > size.width)) process.exitCode = 1;
