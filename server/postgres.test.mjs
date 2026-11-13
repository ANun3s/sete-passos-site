import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { memoryPool } from './test-support/pglite-pool.mjs';
import { createAuth } from './auth.mjs';
import { migratePostgres, postgresDatabase } from './postgres.mjs';
import { createPostgresRateLimitStorage } from './cloudflare-api.mjs';

test('Postgres: migrations, login, session revocation and private access', async () => {
  const pg = new PGlite();
  const pool = memoryPool(pg);
  try {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    assert.equal((await migratePostgres(pool)).length, 4);
    assert.deepEqual(await migratePostgres(pool), []);
    const tables = await pg.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'sete_passos_auth' AND tablename <> '_migrations'");
    assert.equal(tables.rows.length, 6);
    assert.ok(tables.rows.every((t) => t.rowsecurity));
    await pg.exec('SET ROLE anon');
    await assert.rejects(pg.query('SELECT * FROM sete_passos_auth."user"'), /permission denied/);
    await assert.rejects(pg.query('SELECT * FROM sete_passos_auth.clinical_ficha'), /permission denied/);
    await pg.exec('RESET ROLE');
    await pg.exec('SET ROLE sete_passos_backend');
    const auth = createAuth({ db: postgresDatabase(pool), secret: randomBytes(48).toString('base64url'), mode: 'test' });
    const headers = { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5177', 'x-sete-passos-peer-ip': '127.0.0.1' };
    const call = (route, body, cookie) => auth.handler(new Request('http://127.0.0.1:3007/api/auth/' + route, {
      method: body ? 'POST' : 'GET', headers: { ...headers, ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    const credentials = { name: 'Teste fictício', email: 'teste@example.invalid', password: randomBytes(24).toString('base64url') };
    assert.equal((await call('sign-up/email', credentials)).status, 200);
    const stored = await pg.query('SELECT password FROM sete_passos_auth.account');
    assert.notEqual(stored.rows[0].password, credentials.password);
    assert.equal((await call('sign-in/email', { ...credentials, password: 'incorrect-password' })).status, 401);
    const login = await call('sign-in/email', credentials);
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map((v) => v.split(';')[0]).join('; ');
    assert.ok(cookie);
    assert.equal((await (await call('get-session', null, cookie)).json()).user.email, credentials.email);
    assert.equal((await call('sign-out', {}, cookie)).status, 200);
    assert.equal(await (await call('get-session', null, cookie)).json(), null);
    const counts = await pg.query('SELECT count(*)::int AS total FROM sete_passos_auth."rateLimit"');
    assert.ok(counts.rows[0].total > 0);
  } finally { await pg.close(); }
});

test('Postgres: individual clinical records are linked to profiles and private to the backend role', async () => {
  const pg = new PGlite();
  const pool = memoryPool(pg);
  try {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    await migratePostgres(pool);
    await pg.exec('SET ROLE sete_passos_backend');
    await pg.query(`INSERT INTO sete_passos_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('profile-1', 'Fixture', 'fixture@example.invalid', false, now(), now())`);
    await pg.query(`INSERT INTO sete_passos_auth.clinical_ficha (id, "userId", title, type, content) VALUES ('ficha-1', 'profile-1', 'Ficha inicial', 'outro', '{"text":"Conteúdo reservado"}')`);
    assert.equal((await pg.query('SELECT "userId", content->>\'text\' AS text FROM sete_passos_auth.clinical_ficha')).rows[0].text, 'Conteúdo reservado');
    await pg.exec('RESET ROLE');
    await pg.exec('SET ROLE authenticated');
    await assert.rejects(pg.query('SELECT * FROM sete_passos_auth.clinical_ficha'), /permission denied/);
    await assert.rejects(pg.query(`INSERT INTO sete_passos_auth.clinical_ficha (id, "userId", title, type, content) VALUES ('blocked', 'profile-1', 'Ficha', 'outro', '{"text":"não"}')`), /permission denied/);
  } finally { await pg.close(); }
});

test('Postgres: profile mutations use official adapters under the restricted backend role', async t => {
  const { createServer } = await import('node:http');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { handleProfile } = await import('./profile.mjs');
  const { createAvatarStore } = await import('./avatar.mjs');
  const { createProfileRateLimiter } = await import('./profile-rate-limit.mjs');
  const sharp = (await import('sharp')).default;
  const directory = await mkdtemp(join(tmpdir(), 'sete-profile-postgres-'));
  const pg = new PGlite();
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await pg.close();
    await rm(directory, { recursive: true, force: true });
  });
  const pool = memoryPool(pg);
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  await migratePostgres(pool);
  await pg.exec('SET ROLE sete_passos_backend');
  const auth = createAuth({ db: postgresDatabase(pool), secret: randomBytes(48).toString('base64url'), mode: 'test' });
  const person = { name: 'Perfil sintético', email: 'profile-pg@example.invalid', password: randomBytes(24).toString('base64url') };
  await auth.api.signUpEmail({ body: person });
  const signedIn = await auth.api.signInEmail({ body: person, asResponse: true });
  const cookie = signedIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const avatars = createAvatarStore(join(directory, 'avatars'));
  const rateLimit = createProfileRateLimiter();
  server = createServer(async (req, res) => {
    const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    try { await handleProfile({ auth, req, res, url: new URL(req.url, 'http://127.0.0.1'), avatars, rateLimit, json }); }
    catch { json(500, { code: 'INTERNAL_ERROR' }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (sessionCookie = cookie) => fetch(base + '/api/profile', { headers: { Cookie: sessionCookie } });
  const post = async (path, body) => fetch(base + path, { method: 'POST', headers: { Cookie: cookie, Origin: 'http://127.0.0.1:5177', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await (await get()).json()).security.hasPassword, true);
  assert.equal((await post('/api/profile/name', { name: 'Nome atualizado' })).status, 200);
  assert.equal((await (await get()).json()).user.name, 'Nome atualizado');
  const photo = new FormData();
  const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#123456' } }).png().toBuffer();
  photo.append('photo', new Blob([bytes], { type: 'image/png' }), 'photo.png');
  assert.equal((await fetch(base + '/api/profile/avatar', { method: 'POST', headers: { Cookie: cookie, Origin: 'http://127.0.0.1:5177' }, body: photo })).status, 200);
  assert.match((await (await get()).json()).user.image, /^\/api\/profile\/avatar\?v=/);
  assert.equal((await post('/api/profile/avatar/remove', {})).status, 200);
  assert.equal((await (await get()).json()).user.image, null);
  const newPassword = randomBytes(24).toString('base64url');
  const changed = await post('/api/profile/password', { currentPassword: person.password, newPassword, confirmPassword: newPassword });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { ok: true });
  assert.equal((await get()).status, 401);
  const renewed = changed.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.equal((await get(renewed)).status, 200);
  assert.equal((await auth.api.signInEmail({ body: person, asResponse: true })).status, 401);
  assert.equal((await auth.api.signInEmail({ body: { ...person, password: newPassword }, asResponse: true })).status, 200);
});

test('SQL Editor installer is repeatable, blocks clients and detects modified migrations', async () => {
  const { readFile } = await import('node:fs/promises');
  const pg = new PGlite();
  try {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    const install = await readFile(new URL('../supabase/install-login.sql', import.meta.url), 'utf8');
    await pg.exec(install);
    await pg.exec(install);
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM sete_passos_auth._migrations')).rows[0].n, 4);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await pg.exec(`SET ROLE ${role}`);
      await assert.rejects(pg.query('SELECT password FROM sete_passos_auth.account'), /permission denied/);
      await pg.exec('RESET ROLE');
    }
    await pg.exec('SET ROLE sete_passos_backend');
    await assert.rejects(pg.query('CREATE TABLE sete_passos_auth.unauthorized(id text)'), /permission denied/);
    await assert.rejects(pg.query('SELECT * FROM sete_passos_auth._migrations'), /permission denied/);
    await pg.exec('RESET ROLE');
    await pg.query("UPDATE sete_passos_auth._migrations SET checksum = 'altered'");
    await assert.rejects(pg.exec(install), /Applied migration changed/);
    await pg.exec('ROLLBACK');
  } finally { await pg.close(); }
});

test('Postgres rate limiter uses an atomic upsert for concurrent requests', async () => {
  const pg = new PGlite();
  const pool = memoryPool(pg);
  try {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    await migratePostgres(pool);
    const queryPool = {
      async query(...args) {
        const client = await pool.connect();
        try { return await client.query(...args); } finally { client.release(); }
      },
    };
    const limiter = createPostgresRateLimitStorage(queryPool);
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.consume('/api/auth/sign-in/email:ip:192.0.2.1', { max: 5, window: 60 })));
    assert.equal(results.filter((result) => result.allowed).length, 5);
    assert.equal(results.filter((result) => !result.allowed).length, 15);
    const stored = await queryPool.query('SELECT key, count FROM sete_passos_auth."rateLimit"');
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].count, 20);
    assert.match(stored.rows[0].key, /^better-auth:[0-9a-f]{64}$/u);
  } finally { await pg.close(); }
});
