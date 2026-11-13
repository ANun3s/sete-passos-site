// Explicit live smoke test: synthetic account only, removed in finally.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { loadConfig } from '../server/config.mjs';
import { supabasePoolOptions } from '../server/supabase-runtime.mjs';
import { startLocalServer } from '../server/index.mjs';
const config = loadConfig();
if (!config.supabase) throw new Error('Supabase private configuration is required.');
const pool = new Pool(supabasePoolOptions(config.supabase));
const credentials = { name: 'Verificação técnica temporária', email: `smoke-${randomBytes(12).toString('hex')}@example.invalid`, password: randomBytes(30).toString('base64url') };
let app;
try {
  app = await startLocalServer({ ...config, port: 0 });
  const call = (path, body, cookie) => fetch(`${app.url}${path}`, {
    method: body ? 'POST' : 'GET', headers: { Origin: 'http://127.0.0.1:5500', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await call('/api/health')).status, 200);
  assert.equal((await call('/api/me')).status, 401);
  assert.equal((await call('/api/auth/sign-up/email', credentials)).status, 200);
  const saved = await pool.query('SELECT u.id, a.password FROM sete_passos_auth."user" u JOIN sete_passos_auth.account a ON a."userId"=u.id WHERE u.email=$1', [credentials.email]);
  assert.equal(saved.rows.length, 1);
  assert.notEqual(saved.rows[0].password, credentials.password);
  assert.equal((await call('/api/auth/sign-in/email', { ...credentials, password: 'incorrect-test-password' })).status, 401);
  const login = await call('/api/auth/sign-in/email', credentials);
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map(x => x.split(';')[0]).join('; ');
  assert.match(login.headers.getSetCookie().join(';'), /HttpOnly/i);
  assert.equal((await (await call('/api/me', null, cookie)).json()).user.email, credentials.email);
  assert.equal((await call('/api/users/another-user', null, cookie)).status, 403);
  const port = Number(new URL(app.url).port);
  await app.close();
  app = await startLocalServer({ ...config, port });
  assert.equal((await (await call('/api/me', null, cookie)).json()).user.email, credentials.email);
  assert.equal((await call('/api/auth/sign-out', {}, cookie)).status, 200);
  assert.equal((await call('/api/me', null, cookie)).status, 401);
  console.log('Supabase verified: health, signup, password hash, login, authorization, persisted session after restart and logout.');
} catch {
  console.error('Supabase live verification failed. No account data or credentials logged.');
  process.exitCode = 1;
} finally {
  await app?.close();
  await pool.query('DELETE FROM sete_passos_auth."user" WHERE email=$1', [credentials.email]);
  await pool.end();
}
