import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
await page.goto('http://127.0.0.1:5177/');
await page.evaluate(() => document.fonts.ready);
const imageState = () => page.locator('img').evaluateAll(images => images.map(img => ({ src: img.getAttribute('src'), loading: img.loading, complete: img.complete, width: img.naturalWidth, y: img.getBoundingClientRect().y })));
const before = await imageState();
await page.locator('footer').scrollIntoViewIfNeeded();
await page.locator('footer img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
const after = await imageState();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.locator('.hero [data-contact]').click();
const focus = [];
for (let step = 0; step < 10; step++) {
  focus.push(await page.evaluate(() => ({ tag: document.activeElement.tagName, class: document.activeElement.className, value: document.activeElement.value, label: document.activeElement.getAttribute('aria-label'), modalOpen: document.querySelector('dialog').matches(':modal') })));
  await page.keyboard.press('Tab');
}
await page.screenshot({ path: 'artifacts/dialog-320.png' });
await page.keyboard.press('Escape');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.screenshot({ path: 'artifacts/mobile-320.png', fullPage: true });
await page.setViewportSize({ width: 1440, height: 960 });
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.goto('http://127.0.0.1:5177/');
await page.evaluate(() => document.fonts.ready);
await page.locator('.hero .glass-primary').hover();
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/hero-1440.png' });
const result = { before, after, focus };
await writeFile('artifacts/inspection.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
