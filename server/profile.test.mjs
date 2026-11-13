import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { createLocalServer } from './app.mjs';
import sharp from 'sharp';

const origin = 'http://127.0.0.1:5177';
const identity = { name: 'Pessoa sintética', email: 'profile@example.invalid', password: randomBytes(24).toString('base64url') };
const cookieFrom = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'sete-profile-'));
  const config = { databasePath: join(directory, 'test.sqlite'), secret: randomBytes(48).toString('base64url'), port: 0, mode: 'test', ...options };
  let app = await createLocalServer(config);
  await app.start();
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  return { app, directory, config, async restart() { await app.close(); app = await createLocalServer(config); await app.start(); return app; } };
}
async function post(app, path, body, cookie, extra = {}) {
  return fetch(app.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify(body) });
}
async function login(app, person = identity) {
  const created = await app.auth.api.signUpEmail({ body: person });
  assert.ok(created.user?.id);
  const response = await post(app, '/api/auth/sign-in/email', person);
  assert.equal(response.status, 200);
  return cookieFrom(response);
}
const get = (app, path, cookie) => fetch(app.url + path, { headers: cookie ? { Cookie: cookie } : {} });

async function upload(app, cookie, data, { type = 'image/png', name = 'photo.png', extra = {} } = {}) {
  const body = new FormData();
  body.append('photo', new Blob([data], { type }), name);
  for (const [key, value] of Object.entries(extra)) body.append(key, value);
  return fetch(app.url + '/api/profile/avatar', { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body });
}
const image = (background = '#123456') => sharp({ create: { width: 900, height: 600, channels: 3, background } }).png().withMetadata().toBuffer();

test('private storage refuses webroot and symlink destinations before opening a database', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'sete-profile-paths-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { PROJECT_ROOT } = await import('./config.mjs');
  const options = { databasePath: join(directory, 'unused.sqlite'), secret: randomBytes(48).toString('base64url'), port: 0, mode: 'test' };
  await assert.rejects(createLocalServer({ ...options, avatarDirectory: join(PROJECT_ROOT, 'public', 'avatars') }), /webroot/i);
  const symbolic = join(directory, 'avatars');
  await symlink(PROJECT_ROOT, symbolic);
  await assert.rejects(createLocalServer({ ...options, avatarDirectory: symbolic }), /webroot|symbolic/i);
  await assert.rejects(stat(options.databasePath), { code: 'ENOENT' });
});

test('multipart validation rejects missing/duplicate files, animation and oversized chunked bodies', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  const png = await image();
  for (const count of [0, 2]) {
    const form = new FormData();
    for (let i = 0; i < count; i++) form.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
    const response = await fetch(app.url + '/api/profile/avatar', { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: form });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { code: 'INVALID_IMAGE' });
  }
  const frames = Buffer.concat([Buffer.alloc(2 * 2 * 3, 0), Buffer.alloc(2 * 2 * 3, 255)]);
  const animated = await sharp(frames, { raw: { width: 2, height: 4, pageHeight: 2, channels: 3 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  const animation = await upload(app, cookie, animated, { type: 'image/webp', name: 'photo.webp' });
  assert.equal(animation.status, 400);
  assert.deepEqual(await animation.json(), { code: 'INVALID_IMAGE' });
  const result = await new Promise((resolve, reject) => {
    const req = request(app.url + '/api/profile/avatar', { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'multipart/form-data; boundary=synthetic', 'Transfer-Encoding': 'chunked' } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks)) }));
    });
    req.on('error', reject);
    req.end(Buffer.alloc(6 * 1024 * 1024));
  });
  assert.deepEqual(result, { status: 413, body: { code: 'IMAGE_TOO_LARGE' } });
});

test('avatar upload reencodes a private image, persists across restart and never serves another user', async t => {
  const fixtureState = await fixture(t);
  let { app } = fixtureState;
  const cookie = await login(app);
  const otherCookie = await login(app, { ...identity, email: 'other@example.invalid' });
  const data = await image();
  const saved = await upload(app, cookie, data, { extra: { userId: 'someone-else' } });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { ok: true });
  const profile = await (await get(app, '/api/profile', cookie)).json();
  assert.match(profile.user.image, /^\/api\/profile\/avatar\?v=[a-f0-9-]+$/);
  assert.equal((await (await get(app, '/api/me', cookie)).json()).user.image, profile.user.image);
  const photo = await get(app, profile.user.image, cookie);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/webp');
  assert.equal(photo.headers.get('cache-control'), 'no-store');
  assert.equal(photo.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await photo.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  assert.equal((await get(app, profile.user.image)).status, 401);
  assert.equal((await get(app, profile.user.image, otherCookie)).status, 404);
  assert.equal((await (await get(app, '/api/profile', otherCookie)).json()).user.image, null);
  const storage = fixtureState.config.databasePath + '.avatars';
  assert.equal((await stat(storage)).mode & 0o777, 0o700);
  const files = await readdir(storage, { recursive: true, withFileTypes: true });
  const stored = files.filter(file => file.isFile());
  assert.equal(stored.length, 1);
  assert.equal((await stat(join(stored[0].parentPath, stored[0].name))).mode & 0o777, 0o600);
  app = await fixtureState.restart();
  assert.deepEqual(Buffer.from(await (await get(app, profile.user.image, cookie)).arrayBuffer()), bytes);
  const newSession = cookieFrom(await post(app, '/api/auth/sign-in/email', identity));
  assert.equal((await (await get(app, '/api/profile', newSession)).json()).user.image, profile.user.image);
});

test('avatar validation rejects unsafe formats, oversized files and excessive dimensions without replacing the old photo', async t => {
  const { app, config } = await fixture(t);
  const cookie = await login(app);
  const png = await image();
  assert.equal((await upload(app, cookie, png)).status, 200);
  const before = (await (await get(app, '/api/profile', cookie)).json()).user.image;
  const tooWide = await sharp({ create: { width: 8193, height: 1, channels: 3, background: 'red' } }).png().toBuffer();
  const tooManyPixels = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: 'red' } }).png().toBuffer();
  const cases = [
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), { type: 'image/svg+xml', name: 'photo.svg' }, 'INVALID_IMAGE', 400],
    [png, { type: 'image/png', name: 'photo.html' }, 'INVALID_IMAGE', 400],
    [png, { type: 'image/jpeg', name: 'photo.jpg' }, 'INVALID_IMAGE', 400],
    [Buffer.from('<html>not an image</html>'), {}, 'INVALID_IMAGE', 400],
    [png.subarray(0, 40), {}, 'INVALID_IMAGE', 400],
    [Buffer.alloc(5 * 1024 * 1024 + 1), {}, 'IMAGE_TOO_LARGE', 413],
    [Buffer.alloc(6 * 1024 * 1024), {}, 'IMAGE_TOO_LARGE', 413],
    [tooWide, {}, 'IMAGE_DIMENSIONS', 400],
    [tooManyPixels, {}, 'IMAGE_DIMENSIONS', 400],
  ];
  for (const [data, options, code, status] of cases) {
    const response = await upload(app, cookie, data, options);
    assert.equal(response.status, status, code);
    assert.deepEqual(await response.json(), { code });
    assert.equal((await (await get(app, '/api/profile', cookie)).json()).user.image, before);
  }
  assert.equal((await readdir(config.databasePath + '.avatars', { recursive: true, withFileTypes: true })).filter(file => file.isFile()).length, 1);
});

test('avatar replacement and removal commit atomically, cleaning staged files after database failure', async t => {
  const { app, config } = await fixture(t);
  const cookie = await login(app);
  assert.equal((await upload(app, cookie, await image())).status, 200);
  const original = (await (await get(app, '/api/profile', cookie)).json()).user.image;
  const originalBytes = Buffer.from(await (await get(app, original, cookie)).arrayBuffer());
  const countFiles = async () => (await readdir(config.databasePath + '.avatars', { recursive: true, withFileTypes: true })).filter(file => file.isFile()).length;
  app.db.exec("CREATE TRIGGER reject_image BEFORE UPDATE OF image ON user BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
  assert.equal((await upload(app, cookie, await image('#ff0000'))).status, 500);
  assert.equal((await (await get(app, '/api/profile', cookie)).json()).user.image, original);
  assert.deepEqual(Buffer.from(await (await get(app, original, cookie)).arrayBuffer()), originalBytes);
  assert.equal(await countFiles(), 1, 'failed upload removes only its staged derivative');
  assert.equal((await post(app, '/api/profile/avatar/remove', {}, cookie)).status, 500);
  assert.equal((await (await get(app, '/api/profile', cookie)).json()).user.image, original);
  app.db.exec('DROP TRIGGER reject_image');
  for (const format of ['jpeg', 'webp']) {
    const data = await sharp(await image('#ffff00')).toFormat(format).toBuffer();
    assert.equal((await upload(app, cookie, data, { type: `image/${format}`, name: `photo.${format}` })).status, 200);
    assert.equal(await countFiles(), 1, 'superseded derivative is removed after the database commit');
  }
  const removed = await post(app, '/api/profile/avatar/remove', { userId: 'not-the-owner' }, cookie);
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { ok: true });
  assert.equal((await (await get(app, '/api/profile', cookie)).json()).user.image, null);
  assert.equal((await get(app, original, cookie)).status, 404);
  assert.equal(await countFiles(), 0);
  assert.equal((await post(app, '/api/profile/avatar/remove', {}, cookie)).status, 200);
});

test('overlapping avatar writes serialize against fresh user state and leave exactly one readable derivative', async t => {
  const { app, config } = await fixture(t);
  const cookie = await login(app);
  const data = await image();
  assert.equal((await upload(app, cookie, data)).status, 200);
  const results = await Promise.all(Array.from({ length: 4 }, () => upload(app, cookie, data)));
  assert.ok(results.every(response => response.status === 200));
  const current = (await (await get(app, '/api/profile', cookie)).json()).user.image;
  assert.equal((await get(app, current, cookie)).status, 200);
  assert.equal((await readdir(config.databasePath + '.avatars', { recursive: true, withFileTypes: true })).filter(file => file.isFile()).length, 1);
});

test('signup cannot inject an image reference or external tracking URL', async t => {
  const { app } = await fixture(t);
  const created = await post(app, '/api/auth/sign-up/email', { name: 'Pessoa de teste', cpf: '529.982.247-25', password: identity.password, image: 'https://untrusted.invalid/tracker.svg' });
  assert.equal(created.status, 200);
  assert.equal(app.db.prepare('SELECT image FROM user').get().image, null);
});

test('email change is honestly unavailable without transport and cannot change the address or verification', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  const response = await post(app, '/api/profile/email', { newEmail: 'another@gmail.com', currentPassword: identity.password }, cookie);
  assert.equal(response.status, 501);
  assert.deepEqual(await response.json(), { code: 'EMAIL_UNAVAILABLE' });
  const profile = await (await get(app, '/api/profile', cookie)).json();
  assert.equal(profile.user.cpf, null);
  assert.equal(Object.hasOwn(profile.user, 'email'), false);
  for (const email of [identity.email, 'unknown@example.invalid']) {
    const unavailable = await post(app, '/api/auth/request-password-reset', { email, redirectTo: origin + '/login.html?view=reset' });
    assert.equal(unavailable.status, 501);
    assert.deepEqual(await unavailable.json(), { code: 'EMAIL_UNAVAILABLE' });
  }
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM verification').get().n, 0);
});

test('profile HTML is session-gated on the API server and ignores untrusted redirect parameters', async t => {
  const { app } = await fixture(t);
  const anonymous = await fetch(app.url + '/perfil.html?returnTo=https://evil.invalid', { redirect: 'manual' });
  assert.equal(anonymous.status, 303);
  assert.equal(anonymous.headers.get('location'), '/login.html?returnTo=%2Fperfil.html');
  assert.equal(anonymous.headers.get('cache-control'), 'no-store');
  const cookie = await login(app);
  const response = await get(app, '/perfil.html', cookie);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const shell = await response.text();
  assert.match(shell, /<!doctype html>/i);
  assert.equal(shell.includes(identity.name), false);
  assert.equal(shell.includes(identity.email), false);
  assert.equal((await get(app, '/server/auth.mjs', cookie)).status, 404);
  assert.equal((await post(app, '/perfil.html', {}, cookie)).status, 405);
  await post(app, '/api/auth/sign-out', {}, cookie);
  assert.equal((await fetch(app.url + '/perfil.html', { headers: { Cookie: cookie }, redirect: 'manual' })).status, 303);
});

test('avatar upload and removal share a bounded mutation budget, while private reads remain usable', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  for (let i = 0; i < 10; i++) assert.equal((await post(app, '/api/profile/avatar', {}, cookie)).status, 415);
  const limited = await post(app, '/api/profile/avatar/remove', {}, cookie);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { code: 'RATE_LIMITED' });
  assert.equal((await get(app, '/api/profile', cookie)).status, 200);
});

test('unavailable email endpoints still enforce methods, Origin, JSON and abuse limits without enumeration', async t => {
  const { app } = await fixture(t);
  const path = '/api/auth/request-password-reset';
  assert.equal((await get(app, path)).status, 405);
  assert.equal((await fetch(app.url + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await post(app, path, {}, null, { 'Content-Type': 'text/plain' })).status, 415);
  for (let i = 0; i < 4; i++) assert.equal((await post(app, path, { email: `${i}@example.invalid` })).status, 501);
  const blocked = await post(app, path, { email: identity.email });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { code: 'RATE_LIMITED' });
});

test('an uncertain database response cannot delete a derivative that was already committed', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  assert.equal((await upload(app, cookie, await image())).status, 200);
  const original = app.auth.api.updateUser;
  t.mock.method(app.auth.api, 'updateUser', async options => {
    await original(options); // Real DB update, then a synthetic lost-response fault.
    throw new Error('synthetic response unavailable after commit');
  });
  assert.equal((await upload(app, cookie, await image('#aa0000'))).status, 500);
  const current = (await (await get(app, '/api/profile', cookie)).json()).user.image;
  assert.equal((await get(app, current, cookie)).status, 200, 'never delete the file referenced by a committed row');
});

test('expired sessions cannot mutate any personal field or read a private avatar', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  const data = await image();
  app.db.prepare('UPDATE session SET expiresAt = ?').run(Date.now() - 60_000);
  for (const path of ['/api/profile/name', '/api/profile/password', '/api/profile/avatar/remove', '/api/profile/email']) {
    const response = await post(app, path, { name: 'Must not persist', userId: 'other' }, cookie);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { code: 'UNAUTHORIZED' });
  }
  assert.equal((await upload(app, cookie, data)).status, 401);
  assert.equal((await get(app, '/api/profile/avatar', cookie)).status, 401);
  const stored = app.db.prepare('SELECT name, image FROM user').get();
  assert.deepEqual(stored, { name: identity.name, image: null });
});

test('name mutation uses the session owner, validates input and forwards official cookies', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  const other = await login(app, { ...identity, email: 'other@example.invalid' });
  const response = await post(app, '/api/profile/name', { name: '  Ana  María 李  ', userId: 'someone-else', image: 'https://evil.invalid/x', email: 'evil@example.invalid' }, cookie);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.ok(response.headers.get('set-cookie')?.includes('HttpOnly'));
  const profile = await (await get(app, '/api/profile', cookie)).json();
  assert.equal(profile.user.name, 'Ana María 李');
  assert.equal(profile.user.cpf, null);
  assert.equal(Object.hasOwn(profile.user, 'email'), false);
  assert.equal(profile.user.image, null);
  assert.equal((await (await get(app, '/api/profile', other)).json()).user.name, identity.name);
  for (const name of ['', '   ', 'x'.repeat(101), 'name\u0000', {}, null]) {
    const invalid = await post(app, '/api/profile/name', { name }, cookie);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { code: 'INVALID_NAME' });
  }
  const noOrigin = await fetch(app.url + '/api/profile/name', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ name: 'Blocked' }) });
  assert.equal(noOrigin.status, 403);
  assert.equal((await post(app, '/api/profile/name', { name: 'Blocked' }, cookie, { Origin: 'null' })).status, 403);
  assert.equal((await post(app, '/api/profile/name', { name: 'Blocked' }, cookie, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(app, '/api/profile/name', { name: 'Blocked' })).status, 401);
  assert.equal((await post(app, '/api/auth/update-user', { image: '/api/profile/avatar?v=forged' }, cookie)).status, 404);
  assert.equal((await (await get(app, '/api/profile', cookie)).json()).user.name, 'Ana María 李');
});

test('password rotation verifies the current password, replaces the current cookie and revokes other sessions', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  const otherSession = cookieFrom(await post(app, '/api/auth/sign-in/email', identity));
  const newPassword = randomBytes(24).toString('base64url');
  for (const [body, code] of [
    [{ currentPassword: 'incorrect-password', newPassword, confirmPassword: newPassword }, 'INVALID_CURRENT_PASSWORD'],
    [{ currentPassword: identity.password, newPassword, confirmPassword: 'different' }, 'PASSWORD_MISMATCH'],
    [{ currentPassword: identity.password, newPassword: 'short', confirmPassword: 'short' }, 'PASSWORD_TOO_SHORT'],
    [{ currentPassword: identity.password, newPassword: 'a'.repeat(129), confirmPassword: 'a'.repeat(129) }, 'PASSWORD_TOO_LONG'],
  ]) {
    const invalid = await post(app, '/api/profile/password', body, cookie);
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { code });
  }
  const changed = await post(app, '/api/profile/password', { currentPassword: identity.password, newPassword, confirmPassword: newPassword, revokeOtherSessions: false }, cookie, { 'x-sete-passos-peer-ip': '203.0.113.9', 'X-Forwarded-For': '203.0.113.10' });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { ok: true });
  assert.ok(changed.headers.get('set-cookie')?.includes('HttpOnly'));
  const replacement = cookieFrom(changed);
  assert.notEqual(replacement, cookie);
  assert.equal(app.db.prepare('SELECT ipAddress FROM session').get().ipAddress, '127.0.0.1');
  assert.equal((await get(app, '/api/profile', replacement)).status, 200);
  assert.equal((await get(app, '/api/profile', otherSession)).status, 401);
  assert.equal((await get(app, '/api/profile', cookie)).status, 401);
  assert.equal((await post(app, '/api/auth/sign-in/email', identity)).status, 401);
  assert.equal((await post(app, '/api/auth/sign-in/email', { ...identity, password: newPassword })).status, 200);
});

test('profile password rate limits include failed validation and ignore forged forwarding headers', async t => {
  const { app } = await fixture(t);
  const cookie = await login(app);
  for (let i = 0; i < 5; i++) {
    assert.equal((await post(app, '/api/profile/password', {}, cookie, { 'X-Forwarded-For': `192.0.2.${i}`, 'x-sete-passos-peer-ip': `198.51.100.${i}` })).status, 400);
  }
  const blocked = await post(app, '/api/profile/password', {}, cookie, { 'X-Forwarded-For': '203.0.113.1' });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { code: 'RATE_LIMITED' });
  assert.ok(Number(blocked.headers.get('x-retry-after')) > 0);
  assert.equal((await get(app, '/api/profile', cookie)).status, 200);
});

test('profile reads only the session owner with an honest credential state and empty personal records', async t => {
  const { app } = await fixture(t);
  const anonymous = await get(app, '/api/profile');
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await anonymous.json(), { code: 'UNAUTHORIZED' });
  const cookie = await login(app);
  const response = await get(app, '/api/profile?userId=someone-else', cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), {
    user: { name: identity.name, cpf: null, image: null },
    security: { hasPassword: true, minPasswordLength: 12, maxPasswordLength: 128 },
    capabilities: { cpfChange: true, emailChange: false, passwordReset: false }, fichas: [],
  });
  app.db.prepare('UPDATE account SET password = NULL').run();
  assert.equal((await (await get(app, '/api/profile', cookie)).json()).security.hasPassword, false);
  app.db.prepare('UPDATE session SET expiresAt = ?').run(Date.now() - 60_000);
  assert.equal((await get(app, '/api/profile', cookie)).status, 401);
});
