// Offline generation using the installed Better Auth version and real PostgreSQL
// in WebAssembly. Prints SQL; never connects to or modifies a Supabase project.
import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../server/auth.mjs';
import { postgresDatabase } from '../server/postgres.mjs';
import { memoryPool } from '../server/test-support/pglite-pool.mjs';
const pg = new PGlite();
try {
  const auth = createAuth({ db: postgresDatabase(memoryPool(pg)), secret: randomBytes(48).toString('base64url'), mode: 'test' });
  const migration = await getMigrations(auth.options);
  console.log(await migration.compileMigrations());
} finally { await pg.close(); }
