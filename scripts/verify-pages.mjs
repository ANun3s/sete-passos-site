import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const output = 'artifacts/pages';
await mkdir(output, { recursive: true });
const built = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const buildURL = `http://127.0.0.1:${built.httpServer.address().port}`;
const browser = await chromium.launch();
const images = [];
const report = { servers: [], transitions: [], errors: [] };
const servers = [
  { name: 'go-live', url: 'http://127.0.0.1:5500' },
  { name: 'vite', url: 'http://127.0.0.1:5177' },
  { name: 'build', url: buildURL },
];

async function settled(page, key) {
  await expect(page.locator('#page-content')).toHaveAttribute('data-page', key);
  await expect(page.locator('#page-content')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('h1')).toBeFocused();
}

try {
  for (const server of servers) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const route of ['login']) {
        const response = await page.goto(`${server.url}/${route}.html`);
        expect(response.status()).toBe(200);
        await page.evaluate(() => document.fonts.ready);
        for (const image of await page.locator('img').all()) await image.evaluate(img => img.decode());
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.locator('#page-content')).toHaveAttribute('data-page', route);
        report.servers.push({ server: server.name, route, width, status: response.status(), title: await page.title(), imagesDecoded: await page.locator('img').count() });
        if (server.name === 'go-live') images.push({ name: `${route}-${width}.png`, bytes: await page.screenshot({ fullPage: true }) });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1080 });
    await page.goto(`${server.url}/index.html`);
    await page.locator('.brand img').evaluate(image => image.decode());
    await page.locator('#main-nav a[href="/login.html"]').click();
    await expect(page.locator('#page-curtain')).toHaveAttribute('data-phase', 'covering');
    if (server.name === 'go-live') {
      // Freeze real Web Animations mid-wipe for repeatable visual evidence; resume afterward.
      await page.locator('#page-curtain').evaluate(curtain => {
        for (const animation of curtain.getAnimations({ subtree: true })) {
          animation.pause();
          animation.currentTime = animation.effect.getTiming().duration * .6;
        }
      });
      images.push({ name: 'cortina-diagonal.png', bytes: await page.screenshot() });
      await page.locator('#page-curtain').evaluate(curtain => curtain.getAnimations({ subtree: true }).forEach(animation => animation.play()));
    }
    await settled(page, 'login');
    await page.goBack();
    await settled(page, 'inicio');
    await expect(page.locator('#page-curtain')).toHaveAttribute('data-direction', 'right');
    await page.goForward();
    await settled(page, 'login');
    await expect(page.locator('#page-curtain')).toHaveAttribute('data-direction', 'left');
    await page.reload();
    await expect(page.locator('#page-content')).toHaveAttribute('data-page', 'login');
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator('.menu-toggle').click();
    await page.locator('#main-nav a[href="/index.html"]').click();
    await settled(page, 'inicio');
    await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
    const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
    expect(storage.local).toEqual([]);
    // Live Server itself writes this development-only console-notice flag.
    expect(storage.session).toEqual(server.name === 'go-live' ? ['IsThisFirstTime_Log_From_LiveServer'] : []);
    report.transitions.push({ server: server.name, forward: true, backward: true, directReload: true, mobileMenu: true, clinicalStorage: false, developmentStorageKeys: storage.session });
    report.errors.push(...errors.map(message => ({ server: server.name, message })));
    await page.close();
  }
  expect(report.servers).toHaveLength(servers.length * 2);
  expect(report.transitions).toHaveLength(servers.length);
  expect(report.errors).toEqual([]);
  // Run the review regressions against each real server, including the generated build.
  // All inspected pages are closed, and Playwright artifacts stay outside the watched repo.
  report.reviewRegressions = [];
  for (const server of servers) {
    const { stdout } = await promisify(execFile)(process.execPath, [
      'node_modules/@playwright/test/cli.js', 'test', 'tests/navigation-edge.spec.js',
      'tests/apple-interface.spec.js', 'tests/apple-motion.spec.js', 'tests/apple-type.spec.js',
      'tests/hero-brand.spec.js', 'tests/section-palette.spec.js',
    ], { env: { ...process.env, PORTAL_BASE_URL: server.url }, timeout: 90000 });
    console.log(`${server.name} review regressions:\n${stdout}`);
    report.reviewRegressions.push({ server: server.name, passed: true });
  }
} finally {
  await browser.close();
  await new Promise(resolve => built.httpServer.close(resolve));
}

// Live Server watches the workspace: write all evidence only after browser checks finish.
await Promise.all(images.map(image => writeFile(`${output}/${image.name}`, image.bytes)));
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Verified ${report.servers.length} page/viewport/server combinations; ${images.length} screenshots saved.`);
