import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const phase = process.argv[2] || 'after';
const base = process.env.APP_BASE || 'http://127.0.0.1:5500';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const captures = [];
const report = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of ['index', 'login', 'fichas']) {
      await page.goto(`${base}/${route}.html`);
      await page.evaluate(() => document.fonts.ready);
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        title: document.title,
        font: getComputedStyle(document.body).fontFamily,
        images: [...document.images].filter(img => img.getBoundingClientRect().top < innerHeight).every(img => img.complete && img.naturalWidth > 0),
      }));
      assert.equal(metrics.overflow, false, `${route} overflow at ${width}`);
      assert.equal(metrics.images, true, `${route} missing image at ${width}`);
      report.push({ route, width, ...metrics });
      if (width === 320 || width === 1440) captures.push([`${route}-${width}.png`, await page.screenshot({ fullPage: route !== 'index', animations: 'disabled' })]);
      if (width === 320 && route === 'fichas') {
        await page.locator('.menu-toggle').click();
        await page.waitForFunction(() => !document.querySelector('#main-nav').hasAttribute('data-animating'));
        captures.push(['menu-320.png', await page.screenshot()]);
      }
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
// Live Server observes this workspace. Write only after every browser check.
const directory = resolve('artifacts/apple', phase);
await mkdir(directory, { recursive: true });
for (const [name, image] of captures) await writeFile(resolve(directory, name), image);
await writeFile(resolve(directory, 'report.json'), JSON.stringify({ base, phase, report, errors }, null, 2));
console.log(JSON.stringify({ phase, checked: report.length, screenshots: captures.length, errors, directory }, null, 2));
