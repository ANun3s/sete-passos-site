import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { migratePostgres } from './postgres.mjs';
// Explicit owner connection for migrations, supplied through the process environment.
// Never use a VITE_* variable or place credentials in the static project directory.
let pool;
try {
  const value = process.env.SETE_PASSOS_SUPABASE_DB_URL;
  if (!value) throw new Error('Missing connection');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid connection');
  if (!url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.supabase.com')) throw new Error('Not a Supabase host');
  if (url.port && url.port !== '5432') throw new Error('Use direct connection or session pooler on 5432');
  // Strip URL overrides so TLS verification cannot be disabled by query options.
  url.search = '';
  pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: true, ...(process.env.SETE_PASSOS_SUPABASE_CA_FILE ? { ca: readFileSync(process.env.SETE_PASSOS_SUPABASE_CA_FILE, 'utf8') } : {}) },
  });
  const applied = await migratePostgres(pool);
  console.log(`Supabase: ${applied.length} migration(s) applied.`);
} catch {
  console.error('Supabase migration failed. Check the private owner connection, session pooler, TLS certificate and database permissions. No credentials were logged.');
  process.exitCode = 1;
} finally { if (pool) await pool.end(); }
