import { test as base, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile, chmod, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { createLocalServer } from '../server/app.mjs';

export const origin = process.env.AUTH_UI_URL || 'http://127.0.0.1:5177';
export const test = base.extend({
  app: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'sete-passos-profile-e2e-'));
    const adminContentPath = join(dir, 'admin-fichas.html');
    const adminMockupsDirectory = join(dir, 'admin-mockups');
    await mkdir(adminMockupsDirectory, { mode: 0o700 });
    const mockupPath = join(adminMockupsDirectory, 'avaliacao-fisioterapeutica.html');
    await writeFile(mockupPath, '<main>Prévia protegida de teste</main>', { mode: 0o600 });
    await chmod(mockupPath, 0o600);
    await writeFile(adminContentPath, '<div class="preview-notice"><p class="record-description">Modelos visuais. Não insira dados pessoais.</p></div><section class="records-library"><h2 tabindex="-1">Biblioteca de modelos</h2><details class="record-card"><summary>Modelo de teste</summary><div class="record-preview"><iframe class="mockup-frame" src="/api/admin/mockups/avaliacao-fisioterapeutica.html" title="Prévia do modelo"></iframe></div></details></section>', { mode: 0o600 });
    await chmod(adminContentPath, 0o600);
    const app = await createLocalServer({ databasePath: join(dir, 'auth.sqlite'), secret: randomBytes(48).toString('base64url'), mode: 'test', port: 0, adminEmail: 'admin-only@example.test', adminContentPath, adminMockupsDirectory });
    // Native redirect bridge: WebKit cannot fulfill 3xx and rewriting a request
    // to the API otherwise resolves its relative Location against the API port.
    const bridge = createServer((req, res) => {
      const upstream = httpRequest(`${app.url}${req.url}`, { method: req.method, headers: { ...req.headers, host: new URL(app.url).host } }, response => {
        const headers = { ...response.headers };
        if (headers.location?.startsWith('/')) headers.location = new URL(headers.location, origin).href;
        res.writeHead(response.statusCode, headers); response.pipe(res);
      });
      upstream.on('error', () => { res.statusCode = 502; res.end(); });
      req.pipe(upstream);
    });
    try {
      await app.start();
      await new Promise(resolve => bridge.listen(0, '127.0.0.1', resolve));
      app.redirectBridge = `http://127.0.0.1:${bridge.address().port}`;
      await use(app);
    } finally {
      bridge.closeAllConnections();
      if (bridge.listening) await new Promise(resolve => bridge.close(resolve));
      await app.close(); await rm(dir, { recursive: true, force: true });
    }
  },
  context: async ({ context, app }, use) => {
    // This is a reverse proxy to a real isolated Better Auth + SQLite server,
    // not mocked sessions, users, responses or database state. Port3007 untouched.
    await installProxy(context, app);
    try { await use(context); }
    finally { await context.unrouteAll({ behavior: 'wait' }); }
  },
});
export { expect };
export async function installProxy(context, app) {
  const target = app.url;
  async function forward(route) {
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    headers.host = new URL(target).host;
    const response = await route.fetch({ url: `${target}${url.pathname}${url.search}`, headers, maxRedirects: 0 });
    // WebKit cannot synthesize redirects with fulfill. Let its native network
    // follow the actual server response instead, keeping the real guard.
    if (context.browser().browserType().name() === 'webkit' && response.status() >= 300 && response.status() < 400) return route.continue({ url: `${app.redirectBridge}${url.pathname}${url.search}`, headers: { ...headers, host: new URL(app.redirectBridge).host } });
    await route.fulfill({ response });
  }
  await context.route('**/api/**', async route => {
    // WebKit omits file bytes from intercepted multipart postData. Chromium
    // requires fulfill for transparent same-origin test forwarding.
    if (context.browser().browserType().name() !== 'webkit') return forward(route);
    const url = new URL(route.request().url());
    const headers = await route.request().allHeaders();
    headers.host = new URL(target).host;
    await route.continue({ url: `${target}${url.pathname}${url.search}`, headers });
  });
  if (!['5500', '5501'].includes(new URL(origin).port)) {
    await context.route('**/perfil.html*', forward);
    await context.route('**/admin.html*', forward);
  }
}
export async function syntheticAccount(app, suffix = 'a') {
  const account = { name: `Conta sintética ${suffix}`, email: `pessoa-${suffix}@example.test`, password: randomBytes(24).toString('base64url') };
  const response = await app.auth.api.signUpEmail({ body: account });
  expect(response.user?.id).toBeTruthy();
  return account;
}
export async function syntheticAdminAccount(app) {
  const account = { name: 'Conta administrativa', email: 'admin-only@example.test', password: randomBytes(24).toString('base64url') };
  const created = await app.auth.api.signUpEmail({ body: account });
  expect(created.user?.id).toBeTruthy();
  return account;
}
export async function signIn(page, account, query = '') {
  await page.goto(`${origin}/login.html${query}`);
  await page.locator('#login-cpf').fill(account.email);
  await page.locator('#login-password').fill(account.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
export async function openProfile(page, app, suffix = 'a') {
  const account = await syntheticAccount(app, suffix);
  await signIn(page, account);
  await expect(page.locator('#profile-content')).toBeVisible();
  return account;
}
