// CLI-only: introspect an empty in-memory SQLite DB; never opens dev data.
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { createAuth } from './auth.mjs';

export const auth = createAuth({
  db: new Database(':memory:'),
  secret: randomBytes(48).toString('base64url'),
  mode: 'development',
});
