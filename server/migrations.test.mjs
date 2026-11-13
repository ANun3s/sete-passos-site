import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, cp, writeFile, appendFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.mjs';
import { migrateDatabase, migrationsDirectory } from './migrations.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'sete-passos-migrations-'));
  const db = openDatabase(join(directory, 'test.sqlite'));
  t.after(async () => { if (db.open) db.close(); await rm(directory, { recursive: true, force: true }); });
  return { db, directory };
}

test('versioned official schema has foreign keys, uniqueness and lookup/expiry indexes; reapply preserves data', async (t) => {
  const { db } = await fixture(t);
  const applied = migrateDatabase(db);
  assert.ok(applied.includes('001-better-auth.sql'));
  for (const table of ['user', 'account', 'session', 'verification', 'rateLimit']) assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(db.pragma('foreign_key_list(session)')[0].table, 'user');
  assert.equal(db.pragma('foreign_key_list(account)')[0].on_delete, 'CASCADE');
  for (const [table, name] of [['session', 'session_userId_idx'], ['account', 'account_userId_idx'], ['verification', 'verification_identifier_idx'], ['session', 'session_expiresAt_idx'], ['verification', 'verification_expiresAt_idx'], ['rateLimit', 'rateLimit_lastRequest_idx']]) {
    assert.ok(db.pragma(`index_list(${table})`).some((index) => index.name === name), `missing index ${name}`);
  }
  db.prepare('INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)').run('fixture', 'Local fixture', 'fixture@example.invalid', 0, Date.now(), Date.now());
  assert.deepEqual(migrateDatabase(db), []);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user').get().n, 1);
  assert.throws(() => db.prepare('INSERT INTO user SELECT ?, name, email, emailVerified, image, createdAt, updatedAt, cpf FROM user').run('duplicate'), /UNIQUE/);
  assert.throws(() => db.prepare('INSERT INTO session (id, expiresAt, token, createdAt, updatedAt, userId) VALUES (?, ?, ?, ?, ?, ?)').run('orphan', Date.now(), 'not-a-real-token', Date.now(), Date.now(), 'missing'), /FOREIGN KEY/);
});

test('a failed migration rolls back DDL and ledger, and edited applied SQL is refused', async (t) => {
  const { db, directory } = await fixture(t);
  const migrations = join(directory, 'migrations');
  await cp(migrationsDirectory, migrations, { recursive: true });
  migrateDatabase(db, migrations);
  const before = db.prepare('SELECT COUNT(*) AS n FROM _migrations').get().n;
  await writeFile(join(migrations, '999-failing.sql'), 'CREATE TABLE must_rollback(id TEXT); INSERT INTO missing_table VALUES (1);');
  assert.throws(() => migrateDatabase(db, migrations), /missing_table/);
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='must_rollback'").get(), undefined);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM _migrations').get().n, before);
  await appendFile(join(migrations, '001-better-auth.sql'), '\n-- tamper\n');
  assert.throws(() => migrateDatabase(db, migrations), /Applied migration changed/);
});
