import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setupLocal } from './setup.mjs';
import { PROJECT_ROOT } from './config.mjs';

async function boot(dataDirectory) {
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_ENV: 'test', SETE_PASSOS_TEST_DATA_DIR: dataDirectory, SETE_PASSOS_TEST_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stderr.on('data', () => {}); // Do not echo diagnostics that might contain credentials.
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) resolve(match[0]);
    });
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`API exited before ready (code ${code}).`)));
  });
  let timeout;
  const deadline = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('API readiness timeout.')), 10_000); });
  try {
    return { child, url: await Promise.race([ready, deadline]) };
  } catch (error) { child.kill('SIGTERM'); throw error; }
  finally { clearTimeout(timeout); }
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exit = once(child, 'exit');
  child.kill('SIGTERM');
  await exit;
}

async function post(url, path, value, cookie) {
  return fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5177', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(value) });
}

test('credentials, sessions, rate limits and revocations survive a real process stop and restart', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sete-passos-restart-'));
  let running;
  t.after(async () => { await stop(running?.child); await rm(directory, { recursive: true, force: true }); });
  setupLocal({ dataDirectory: directory, mode: 'test' });
  running = await boot(directory);
  const firstPid = running.child.pid;
  const identity = { name: 'Teste reinício', cpf: '529.982.247-25', password: randomBytes(24).toString('base64url') };
  assert.equal((await post(running.url, '/api/auth/sign-up/email', identity)).status, 200);
  const login = await post(running.url, '/api/auth/sign-in/email', identity);
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const before = await (await fetch(`${running.url}/api/me`, { headers: { Cookie: cookie } })).json();
  await stop(running.child);
  running = await boot(directory);
  assert.notEqual(running.child.pid, firstPid);
  const after = await fetch(`${running.url}/api/me`, { headers: { Cookie: cookie } });
  assert.equal(after.status, 200);
  assert.deepEqual(await after.json(), before);
  assert.equal((await post(running.url, '/api/auth/sign-in/email', identity)).status, 200);
  assert.equal((await post(running.url, '/api/auth/sign-out', {}, cookie)).status, 200);
  for (let i = 0; i < 8; i++) assert.equal((await post(running.url, '/api/auth/sign-in/email', { ...identity, password: 'wrong-but-long-enough' })).status, 401);
  const limited = await post(running.url, '/api/auth/sign-in/email', identity);
  assert.equal(limited.status, 429);
  await stop(running.child);
  running = await boot(directory);
  assert.equal((await fetch(`${running.url}/api/me`, { headers: { Cookie: cookie } })).status, 401);
  assert.equal((await post(running.url, '/api/auth/sign-in/email', identity)).status, 429);
});
