import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'sete-passos-config-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('setup creates a private persistent secret and SQLite outside the webroot, idempotently', async (t) => {
  const root = await directory(t);
  const { setupLocal } = await import('./setup.mjs');
  const { loadConfig, DEFAULT_DATA_DIRECTORY, PROJECT_ROOT } = await import('./config.mjs');
  assert.ok(DEFAULT_DATA_DIRECTORY.endsWith('/Library/Application Support/Sete Passos Development'));
  assert.ok(!DEFAULT_DATA_DIRECTORY.startsWith(PROJECT_ROOT));
  const config = setupLocal({ dataDirectory: root, mode: 'test' });
  assert.equal(config.port, 3007);
  assert.ok(config.secret.length >= 32);
  assert.equal((await stat(root)).mode & 0o777, 0o700);
  assert.equal((await stat(join(root, 'auth-secret.env'))).mode & 0o777, 0o600);
  assert.equal((await stat(config.databasePath)).mode & 0o777, 0o600);
  const first = await readFile(join(root, 'auth-secret.env'));
  setupLocal({ dataDirectory: root, mode: 'test' });
  assert.ok(first.equals(await readFile(join(root, 'auth-secret.env'))), 'existing secret never rotated implicitly');
  assert.equal(loadConfig({ dataDirectory: root, mode: 'test' }).secret, config.secret);
  assert.throws(() => setupLocal({ dataDirectory: join(PROJECT_ROOT, 'server/data'), mode: 'test' }), /webroot/i);
  assert.throws(() => setupLocal({ dataDirectory: root, mode: 'production' }), /production/i);
});

test('factory blocks production before opening the database or port', async (t) => {
  const root = await directory(t);
  const { createLocalServer } = await import('./app.mjs');
  await assert.rejects(createLocalServer({ databasePath: join(root, 'forbidden.sqlite'), secret: 'a'.repeat(48), mode: 'production', port: 0 }), /production/i);
  await assert.rejects(stat(join(root, 'forbidden.sqlite')), { code: 'ENOENT' });
});
