import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
const directory = new URL('../supabase/migrations/', import.meta.url);
const statements = [
  '-- Generated from supabase/migrations. Run as the database owner in Supabase SQL Editor.',
  'BEGIN;',
  'SELECT pg_advisory_xact_lock(730071007);',
  'CREATE SCHEMA IF NOT EXISTS sete_passos_auth;',
  'REVOKE ALL ON SCHEMA sete_passos_auth FROM PUBLIC;',
  'CREATE TABLE IF NOT EXISTS sete_passos_auth._migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());',
];
for (const name of (await readdir(directory)).filter((n) => /^\d+[-_\w]*\.sql$/.test(n)).sort()) {
  const sql = await readFile(new URL(name, directory), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  if (sql.includes('$migration$') || sql.includes('$body$')) throw new Error('Reserved SQL delimiter in migration');
  statements.push(`DO $body$\nDECLARE previous text;\nBEGIN\n  SELECT checksum INTO previous FROM sete_passos_auth._migrations WHERE name = '${name}';\n  IF previous IS NULL THEN\n    EXECUTE $migration$${sql}$migration$;\n    INSERT INTO sete_passos_auth._migrations(name, checksum) VALUES ('${name}', '${checksum}');\n  ELSIF previous <> '${checksum}' THEN\n    RAISE EXCEPTION 'Applied migration changed: ${name}';\n  END IF;\nEND $body$;`);
}
statements.push('COMMIT;', 'SELECT name, applied_at FROM sete_passos_auth._migrations ORDER BY name;');
console.log(statements.join('\n\n'));
