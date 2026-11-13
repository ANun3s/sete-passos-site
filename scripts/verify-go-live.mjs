import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts/go-live', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const failures = [];
page.on('pageerror', error => failures.push(error.message));
page.on('response', response => {
  if (response.url().startsWith('http://127.0.0.1:5500') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
});
await page.goto('http://127.0.0.1:5500/index.html');
await page.evaluate(() => document.fonts.ready);
await page.locator('.hero-logo').evaluate(img => img.decode());
// Keep captures in memory: writing inside the workspace triggers Live Server reloads.
const heroScreenshot = await page.screenshot();
await page.locator('footer').scrollIntoViewIfNeeded();
for (const image of await page.locator('footer img').all()) {
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(img => img.decode());
}
const report = await page.evaluate(() => ({
  url: location.href,
  images: [...document.images].map(img => ({ url: img.currentSrc, loaded: img.complete && img.naturalWidth > 0 })),
  fonts: [...document.fonts].map(font => ({ family: font.family, status: font.status })),
}));
const footerScreenshot = await page.locator('footer').screenshot();
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.locator('[data-logo-card]').hover({ position: { x: 120, y: 60 } });
await expect(page.locator('[data-logo-card]')).toHaveAttribute('data-active', 'true');
report.logoActive = await page.locator('[data-logo-card]').getAttribute('data-active');
report.failures = failures;
console.log(JSON.stringify(report, null, 2));
await browser.close();
await Promise.all([
  writeFile('artifacts/go-live/report.json', JSON.stringify(report, null, 2)),
  writeFile('artifacts/go-live/hero-1440.png', heroScreenshot),
  writeFile('artifacts/go-live/footer-1440.png', footerScreenshot),
]);
if (failures.length || report.images.some(img => !img.loaded)) process.exitCode = 1;
