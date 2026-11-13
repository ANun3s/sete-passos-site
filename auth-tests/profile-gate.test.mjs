import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, request } from 'node:http';
import { createServer as createViteServer, preview } from 'vite';
import { randomBytes } from 'node:crypto';
import { createLocalServer } from '../server/app.mjs';
import { profileGate } from '../vite.config.js';

const root = fileURLToPath(new URL('../', import.meta.url));
// The runner's TMPDIR may point outside Hermes' workspace. Keep every test
// database, Vite cache and preview fixture in the explicitly allowed scratch dir.
const scratch = '/Users/nunes/.hermes/cache/scratch';

async function testDirectory() {
  await mkdir(scratch, { recursive: true });
  return mkdtemp(join(scratch, 'sete-passos-gate-'));
}

// Unlike fetch(), this preserves raw dot segments, duplicate slashes and
// backslashes, so the test exercises the server's normalization, not the client.
function rawRequest(server, path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function isolatedVite(t, mode) {
  const directory = await testDirectory();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const app = await createLocalServer({ databasePath: join(directory, 'auth.sqlite'), secret: randomBytes(48).toString('base64url'), mode: 'test', port: 0 });
  await app.start();
  t.after(() => app.close());
  const installGate = server => { server.middlewares.use(profileGate(app.url)); };
  const config = {
    configFile: false, envDir: false, root,
    cacheDir: join(directory, 'vite-cache'),
    plugins: [{ name: 'isolated-profile-gate', configureServer: installGate, configurePreviewServer: installGate }],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null, preTransformRequests: false },
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
  };
  let vite;
  let frontend;
  if (mode === 'dev') {
    vite = await createViteServer(config);
    frontend = createServer(vite.middlewares);
    await new Promise(resolve => frontend.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => frontend.close(resolve)));
  } else {
    const outDir = join(directory, 'preview');
    await mkdir(join(outDir, 'src'), { recursive: true });
    // Real project HTML/static files, without a build or touching live dist/.
    for (const name of ['index.html', 'perfil.html', 'login.html', 'src/profile.js']) {
      await copyFile(join(root, name), join(outDir, name));
    }
    vite = await preview({ ...config, build: { outDir } });
    frontend = vite.httpServer;
  }
  t.after(() => vite.close());
  return { app, frontend };
}

for (const mode of ['dev', 'preview']) {
  test(`real Vite ${mode} authenticates profile HTML aliases before serving files`, async t => {
    const { app, frontend } = await isolatedVite(t, mode);
    const fsPath = `/@fs${encodeURI(join(root, 'perfil.html'))}`;
    const aliases = [
      '/perfil.html', '/perfil', '/%70erfil.html', '/per%66il', '/perfil%2ehtml',
      '/PERFIL.HTML', '/PERFIL', '/PeRfIl.HtMl',
      '/perfil.html/', '/perfil/', '/perfil.html//',
      '/perfil.html?raw', '/perfil?raw', '/%70erfil.html?raw',
      '/perfil.html?returnTo=https://example.invalid',
      '//perfil.html', '/./perfil.html', '/src/../perfil',
      '/src/%2e%2e/%70erfil.html', '/%2fperfil.html',
      '/src\\..\\perfil.html', '/src%5c..%5cperfil.html',
      '/perfil.html/.', '/%2570erfil.html',
      fsPath, `${fsPath}?raw`, `${fsPath}/`,
      fsPath.replace('perfil.html', 'PERFIL.HTML'),
      fsPath.replace('perfil.html', '%70erfil.html'),
      `/@fs${encodeURI(join(root, 'src'))}/../perfil.html`,
    ];
    for (const path of aliases) {
      await t.test(path, async () => {
        const response = await rawRequest(frontend, path);
        assert.equal(response.status, 303, `${path} must not serve an unauthenticated profile shell`);
        assert.equal(response.headers.location, '/login.html?returnTo=%2Fperfil.html');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.headers['referrer-policy'], 'no-referrer');
        assert.equal(response.body, '');
      });
    }
    await t.test('HEAD aliases require a session too', async () => {
      const response = await rawRequest(frontend, '/%70erfil.html?raw', { method: 'HEAD' });
      assert.equal(response.status, 303);
      assert.equal(response.body, '');
    });
    await t.test('public home and JavaScript remain accessible', async () => {
      for (const path of ['/', '/index.html', '/login.html', '/src/profile.js']) {
        const response = await rawRequest(frontend, path);
        assert.equal(response.status, 200, path);
        assert.notEqual(response.headers['referrer-policy'], 'no-referrer', path);
      }
    });
    const credentials = { name: 'Conta Vite isolada', email: `${mode}@example.test`, password: randomBytes(24).toString('base64url') };
    const seeded = await app.auth.api.signUpEmail({ body: credentials });
    assert.ok(seeded.user?.id);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: app.url }, body: JSON.stringify(credentials) };
    const logged = await fetch(`${app.url}/api/auth/sign-in/email`, options);
    assert.equal(logged.status, 200);
    const cookie = logged.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const workingAliases = ['/perfil.html', '/perfil', '/%70erfil.html', '/perfil.html?raw', ...(mode === 'dev' ? [fsPath, `${fsPath}?raw`] : [])];
    for (const path of workingAliases) {
      await t.test(`authenticated HTML stays private: ${path}`, async () => {
        const response = await rawRequest(frontend, path, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200, path);
        assert.match(response.body, /data-page=\\?"perfil\\?"/, path);
        assert.equal(response.body.includes(credentials.email), false);
        assert.equal(response.headers['cache-control'], 'no-store', path);
        assert.equal(response.headers['referrer-policy'], 'no-referrer', path);
      });
    }
    await t.test('revoking the real session blocks every alias, including conditional requests', async () => {
      const signedOut = await fetch(`${app.url}/api/auth/sign-out`, { method: 'POST', headers: { Origin: app.url, Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(signedOut.status, 200);
      for (const path of aliases) {
        const response = await rawRequest(frontend, path, { headers: { Cookie: cookie, 'If-None-Match': '*' } });
        assert.equal(response.status, 303, path);
        assert.equal(response.body, '', path);
      }
    });
    await t.test('all aliases fail closed if the real auth API is down', async () => {
      await app.close();
      for (const path of aliases) {
        const response = await rawRequest(frontend, path, { headers: { Cookie: cookie } });
        assert.equal(response.status, 503, path);
        assert.equal(response.headers['cache-control'], 'no-store', path);
        assert.equal(response.headers['referrer-policy'], 'no-referrer', path);
        assert.doesNotMatch(response.body, /data-page="perfil"/);
        assert.equal(response.body.includes(credentials.email), false);
      }
      assert.equal((await rawRequest(frontend, '/index.html')).status, 200);
      assert.equal((await rawRequest(frontend, '/src/profile.js')).status, 200);
    });
  });
}

test('Vite/preview middleware checks the real session before serving the profile shell and fails closed', async () => {
  const directory = await testDirectory();
  const app = await createLocalServer({ databasePath: join(directory, 'auth.sqlite'), secret: randomBytes(48).toString('base64url'), mode: 'test', port: 0 });
  await app.start();
  const gate = profileGate(app.url);
  let served = 0;
  const frontend = createServer((req, res) => gate(req, res, () => { served++; res.end('public empty test shell'); }));
  await new Promise(resolve => frontend.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${frontend.address().port}`;
  try {
    const blocked = await fetch(`${base}/perfil.html?returnTo=https://example.invalid`, { redirect: 'manual' });
    assert.equal(blocked.status, 303); assert.equal(blocked.headers.get('location'), '/login.html?returnTo=%2Fperfil.html'); assert.equal(served, 0);
    assert.equal((await fetch(`${base}/index.html`)).status, 200);
    const credentials = { name: 'Conta de middleware', email: 'middleware@example.test', password: randomBytes(24).toString('base64url') };
    const seeded = await app.auth.api.signUpEmail({ body: credentials });
    assert.ok(seeded.user?.id);
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: app.url }, body: JSON.stringify(credentials) };
    const logged = await fetch(`${app.url}/api/auth/sign-in/email`, options);
    assert.equal(logged.status, 200);
    const cookie = logged.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const authorized = await fetch(`${base}/perfil.html`, { headers: { Cookie: cookie } });
    assert.equal(authorized.status, 200); assert.equal(authorized.headers.get('cache-control'), 'no-store'); assert.equal(served, 2);
    await app.close();
    const unavailable = await fetch(`${base}/perfil.html`);
    assert.equal(unavailable.status, 503); assert.equal(served, 2);
    assert.equal((await unavailable.text()).includes(credentials.email), false);
  } finally {
    await app.close(); await new Promise(resolve => frontend.close(resolve)); await rm(directory, { recursive: true, force: true });
  }
});
