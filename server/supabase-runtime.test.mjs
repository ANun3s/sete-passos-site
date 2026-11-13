import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSupabaseConfig, supabasePoolOptions } from './supabase-runtime.mjs';

test('Supabase runtime uses a private file and never silently falls back on invalid config', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'sete-supabase-config-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  assert.equal(loadSupabaseConfig(dir), undefined);
  const path = join(dir, 'supabase.env');
  await writeFile(path, 'SETE_PASSOS_SUPABASE_DB_URL=invalid\n', { mode: 0o600 });
  assert.throws(() => loadSupabaseConfig(dir), /Supabase/);
  await writeFile(path, 'SETE_PASSOS_SUPABASE_DB_URL=postgresql://sete_passos_app.testref:fictional@aws-0-us-east-2.pooler.supabase.com:5432/postgres\n');
  const config = loadSupabaseConfig(dir);
  const options = supabasePoolOptions(config);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.max, 1);
  await chmod(path, 0o644);
  assert.throws(() => loadSupabaseConfig(dir), /600/);
});

test('Supabase runtime refuses admin credentials, foreign hosts and TLS overrides', () => {
  for (const url of [
    'postgresql://postgres:secret@db.testref.supabase.co:5432/postgres',
    'postgresql://sete_passos_app:secret@unrelated.example:5432/postgres',
    'postgresql://sete_passos_app:secret@db.testref.supabase.co:5432/postgres?sslmode=disable',
    'postgresql://sete_passos_app:secret@db.testref.supabase.co:6543/postgres',
  ]) assert.throws(() => supabasePoolOptions({ url }), /Supabase/);
});
