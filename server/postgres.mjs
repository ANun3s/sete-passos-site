import { PostgresDialect } from 'kysely';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

export const AUTH_SCHEMA = 'sete_passos_auth';
export function postgresDatabase(pool) {
  return { dialect: new PostgresDialect({ pool }), type: 'postgres', schemaName: AUTH_SCHEMA, transaction: true };
}

// Deployment operation only: requires an owner connection, never the runtime role.
// Atomic DDL, checksums and a transaction lock prevent partial/concurrent installs.
export async function migratePostgres(pool, directory = new URL('../supabase/migrations/', import.meta.url)) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(730071007)");
    await client.query('CREATE SCHEMA IF NOT EXISTS sete_passos_auth');
    await client.query('REVOKE ALL ON SCHEMA sete_passos_auth FROM PUBLIC');
    await client.query('CREATE TABLE IF NOT EXISTS sete_passos_auth._migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = [];
    for (const name of (await readdir(directory)).filter((n) => /^\d+[-_\w]*\.sql$/.test(n)).sort()) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query('SELECT checksum FROM sete_passos_auth._migrations WHERE name = $1', [name]);
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO sete_passos_auth._migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
      applied.push(name);
    }
    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
