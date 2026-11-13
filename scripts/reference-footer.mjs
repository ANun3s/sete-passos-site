import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts/references', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
await page.goto('https://hermes-agent.nousresearch.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
await page.mouse.wheel(0, 20000);
await page.locator('footer').last().locator('img').evaluateAll(imgs => Promise.all(imgs.map(img => img.decode().catch(() => {}))));
await page.waitForTimeout(2000);
const data = await page.evaluate(() => ({
  title: document.title,
  url: location.href,
  bottom: document.body.innerText.slice(-6500),
  footers: [...document.querySelectorAll('footer')].map(el => ({
    text: el.innerText,
    html: el.outerHTML.slice(0, 13000),
    background: getComputedStyle(el).backgroundColor,
    color: getComputedStyle(el).color,
    height: el.getBoundingClientRect().height,
    font: getComputedStyle(el).fontFamily,
  })),
  bottomElements: [...document.querySelectorAll('body > *')].slice(-8).map(el => ({ tag: el.tagName, class: el.className, text: el.innerText?.slice(-1500) })),
}));
await writeFile('artifacts/references/hermes-footer.json', JSON.stringify(data, null, 2));
await page.screenshot({ path: 'artifacts/references/hermes-footer.png' });
console.log(JSON.stringify({ title: data.title, footers: data.footers.map(({text, background, color, height}) => ({text, background, color, height})) }, null, 2));
await browser.close();
