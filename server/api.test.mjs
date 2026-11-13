import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'sete-passos-auth-'));
  let app;
  t.after(async () => { await app?.close(); await rm(directory, { recursive: true, force: true }); });
  const { createLocalServer } = await import('./app.mjs');
  app = await createLocalServer({ databasePath: join(directory, 'test.sqlite'), secret: randomBytes(48).toString('base64url'), port: 0, mode: 'test' });
  await app.start();
  return app;
}

async function post(app, path, body, extraHeaders = {}) {
  return fetch(`${app.url}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5177', ...extraHeaders },
    body: JSON.stringify(body),
  });
}

const identity = { name: 'Conta local de teste', cpf: '529.982.247-25', password: randomBytes(24).toString('base64url') };

test('signup persists one normalized user and hashed credential, without signing in or enumerating duplicates', async (t) => {
  const app = await fixture(t);
  const first = await post(app, '/api/auth/sign-up/email', identity);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });
  assert.equal(first.headers.get('set-cookie'), null);
  const duplicate = await post(app, '/api/auth/sign-up/email', { ...identity, name: 'Outro nome', cpf: '52998224725' });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { ok: true });
  assert.equal(duplicate.headers.get('set-cookie'), null);
  const users = app.db.prepare('SELECT id, name, email, emailVerified, cpf FROM user').all();
  assert.equal(users.length, 1);
  assert.ok(users[0].email.endsWith('@login.sete-passos.invalid'));
  assert.equal(users[0].cpf, '52998224725');
  assert.equal(users[0].name, identity.name);
  assert.equal(users[0].emailVerified, 0);
  const account = app.db.prepare('SELECT password, providerId FROM account').get();
  assert.equal(account.providerId, 'credential');
  assert.ok(account.password && account.password !== identity.password, 'only a hash is stored');
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM session').get().n, 0);
});

function cookieFrom(response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
}

async function login(app) {
  assert.equal((await post(app, '/api/auth/sign-up/email', identity)).status, 200);
  const response = await post(app, '/api/auth/sign-in/email', identity);
  assert.equal(response.status, 200);
  return { response, cookie: cookieFrom(response) };
}

test('credential login rejects incorrect password, sets HttpOnly Lax cookie, protects identity and logout revokes it', async (t) => {
  const app = await fixture(t);
  await post(app, '/api/auth/sign-up/email', identity);
  const wrong = await post(app, '/api/auth/sign-in/email', { ...identity, password: randomBytes(24).toString('base64url') });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);
  const unknown = await post(app, '/api/auth/sign-in/email', { ...identity, cpf: '111.444.777-35' });
  assert.equal(unknown.status, 401);
  assert.deepEqual(await unknown.json(), await wrong.json());
  const { response, cookie } = await login(app);
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(/SameSite=Lax/i.test(setCookie));
  assert.ok(/Max-Age=86400/.test(setCookie));
  assert.ok(!/;\s*Secure/i.test(setCookie));
  assert.ok(!/;\s*Domain=/i.test(setCookie));
  const me = await fetch(`${app.url}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  const { user } = await me.json();
  assert.deepEqual(Object.keys(user).sort(), ['cpf', 'id', 'image', 'name']);
  assert.equal(user.image, null);
  assert.equal(user.cpf, '52998224725');
  const own = await fetch(`${app.url}/api/users/${user.id}`, { headers: { Cookie: cookie } });
  assert.equal(own.status, 200);
  assert.deepEqual(await own.json(), { user });
  const session = await fetch(`${app.url}/api/auth/get-session`, { headers: { Cookie: cookie } });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.id, user.id);
  const logout = await post(app, '/api/auth/sign-out', {}, { Cookie: cookie });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM session').get().n, 0);
  assert.equal((await fetch(`${app.url}/api/me`, { headers: { Cookie: cookie } })).status, 401);
  assert.equal(await (await fetch(`${app.url}/api/auth/get-session`, { headers: { Cookie: cookie } })).json(), null);
});

test('a signed-in user cannot read another actual user; expired and tampered sessions cannot bypass the database', async (t) => {
  const app = await fixture(t);
  const { cookie } = await login(app);
  const otherIdentity = { ...identity, cpf: '111.444.777-35' };
  await post(app, '/api/auth/sign-up/email', otherIdentity);
  const other = app.db.prepare('SELECT id FROM user WHERE cpf = ?').get('11144477735');
  const hashes = app.db.prepare('SELECT password FROM account').all();
  assert.ok(hashes.length === 2 && hashes[0].password !== hashes[1].password, 'equal input passwords must receive independently salted hashes');
  assert.equal((await fetch(`${app.url}/api/users/${other.id}`, { headers: { Cookie: cookie } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/users/nonexistent`, { headers: { Cookie: cookie } })).status, 403);
  assert.equal((await fetch(`${app.url}/api/users/${other.id}`)).status, 401);
  const tampered = cookie.replace('=', '=tampered');
  assert.equal((await fetch(`${app.url}/api/me`, { headers: { Cookie: tampered } })).status, 401);
  app.db.prepare('UPDATE session SET expiresAt = ?').run(Date.now() - 60_000);
  assert.equal((await fetch(`${app.url}/api/me`, { headers: { Cookie: cookie } })).status, 401);
  assert.equal(await (await fetch(`${app.url}/api/auth/get-session`, { headers: { Cookie: cookie } })).json(), null);
});

test('explicit credential CORS allows only local frontends and rejects foreign origins, host spoofing and login CSRF', async (t) => {
  const app = await fixture(t);
  for (const origin of ['http://127.0.0.1:5177', 'http://localhost:5177', 'http://127.0.0.1:5500', 'http://localhost:5500']) {
    const response = await fetch(`${app.url}/api/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    const preflight = await fetch(`${app.url}/api/auth/sign-in/email`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  }
  for (const origin of ['https://untrusted.example', 'null', 'http://127.0.0.1:9999']) {
    const response = await fetch(`${app.url}/api/health`, { headers: { Origin: origin } });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await post(app, '/api/auth/sign-up/email', identity, { Origin: origin })).status, 403);
  }
  // node:fetch rewrites Host; raw HTTP is needed to actually send this attack.
  const badHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${app.url}/api/health`, { headers: { Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end();
  });
  assert.equal(badHostStatus, 403);
  const crossSiteStatus = await new Promise((resolve, reject) => {
    const req = request(`${app.url}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end(JSON.stringify(identity));
  });
  assert.equal(crossSiteStatus, 403);
  const badCallback = await post(app, '/api/auth/sign-up/email', { ...identity, callbackURL: 'https://evil.example' });
  assert.equal(badCallback.status, 403);
});

test('rate limiting remains enabled locally and cannot be bypassed by forged forwarding headers', async (t) => {
  const app = await fixture(t);
  for (let i = 0; i < 10; i++) {
    const response = await post(app, '/api/auth/sign-in/email', identity, { 'X-Forwarded-For': `192.0.2.${i + 1}`, 'x-sete-passos-peer-ip': `198.51.100.${i + 1}` });
    assert.equal(response.status, 401);
  }
  const blocked = await post(app, '/api/auth/sign-in/email', identity, { 'X-Forwarded-For': '203.0.113.250', 'X-Real-IP': '203.0.113.251', 'x-sete-passos-peer-ip': '203.0.113.252' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('x-retry-after')) > 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM rateLimit').get().n, 1);
});

test('HTTP envelope rejects malformed, oversized, unsafe content and unavailable email flows explicitly', async (t) => {
  const app = await fixture(t);
  assert.equal((await post(app, '/api/health', {})).status, 405);
  assert.equal((await post(app, '/api/me', {})).status, 405);
  assert.equal((await fetch(`${app.url}/api/auth/sign-up/email`)).status, 405);
  for (const path of ['/api/auth/request-password-reset', '/api/auth/send-verification-email', '/api/auth/reset-password']) {
    const response = await post(app, path, { email: 'local@example.invalid' });
    assert.equal(response.status, 501);
    assert.deepEqual(await response.json(), { code: 'EMAIL_UNAVAILABLE' });
  }
  assert.equal((await post(app, '/api/auth/update-user', { name: 'New name' })).status, 404);
  const malformed = await fetch(`${app.url}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  const tooLarge = await post(app, '/api/auth/sign-up/email', { ...identity, name: 'x'.repeat(20_000) });
  assert.equal(tooLarge.status, 413);
  const unsafeType = await fetch(`${app.url}/api/auth/sign-up/email`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(identity) });
  assert.equal(unsafeType.status, 415);
  for (const change of [{ password: 'short' }, { cpf: '111.111.111-11' }, { name: '   ' }]) {
    assert.equal((await post(app, '/api/auth/sign-up/email', { ...identity, ...change })).status, 400);
  }
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM user').get().n, 0);
});

test('HTTPS configuration emits Secure HttpOnly Lax cookies without enabling production', async (t) => {
  const app = await fixture(t);
  const { createAuth } = await import('./auth.mjs');
  const authIdentity = { ...identity, email: 'https-local@example.invalid' };
  const auth = createAuth({
    db: app.db, secret: randomBytes(48).toString('base64url'), baseURL: 'https://localhost:3007', mode: 'test',
    googleClientId: 'test-google-client-id', googleClientSecret: 'test-google-client-secret',
  });
  const send = (path) => auth.handler(new Request(`https://localhost:3007/api/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://localhost:3007', 'x-sete-passos-peer-ip': '127.0.0.1' }, body: JSON.stringify(authIdentity),
  }));
  assert.equal((await send('sign-up/email')).status, 200);
  const response = await send('sign-in/email');
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.ok(/;\s*Secure/i.test(cookie));
  assert.ok(/HttpOnly/.test(cookie));
  assert.ok(/SameSite=Lax/i.test(cookie));
  assert.ok(cookie.startsWith('__Secure-'));
  const social = await auth.handler(new Request('https://localhost:3007/api/auth/sign-in/social', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://localhost:3007' },
    body: JSON.stringify({ provider: 'google', callbackURL: 'https://localhost:3007/perfil.html' }),
  }));
  assert.equal(social.status, 200);
  assert.equal(new URL((await social.json()).url).hostname, 'accounts.google.com');
  assert.equal(auth.options.socialProviders.google.clientId, 'test-google-client-id');
  assert.equal(auth.options.session.cookieCache.enabled, false);
});

test('Google GIS provider can be configured with the public Client ID alone', async (t) => {
  const app = await fixture(t);
  const { createAuth } = await import('./auth.mjs');
  const auth = createAuth({
    db: app.db,
    secret: randomBytes(48).toString('base64url'),
    baseURL: 'http://127.0.0.1:3007',
    mode: 'test',
    googleClientId: 'setepassos-test.apps.googleusercontent.com',
    googleClientSecret: '',
  });
  assert.equal(auth.options.socialProviders.google.clientId, 'setepassos-test.apps.googleusercontent.com');
  assert.equal(auth.options.socialProviders.google.clientSecret, '');
});

test('local health contract and unauthenticated protected route', async (t) => {
  const app = await fixture(t);
  const health = await fetch(`${app.url}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true, signUpEnabled: true, capabilities: { cpfChange: true, emailChange: false, passwordReset: false, googleLogin: false }, googleClientId: null, passwordPolicy: { minPasswordLength: 12, maxPasswordLength: 128 } });
  const me = await fetch(`${app.url}/api/me`);
  assert.equal(me.status, 401);
  assert.equal(me.headers.get('cache-control'), 'no-store');
});
