import { randomBytes } from 'node:crypto';
import { closeSync, constants, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertLocalMode, dataDirectoryFor, loadConfig, privateDirectory } from './config.mjs';
import { openDatabase } from './database.mjs';
import { migrateDatabase } from './migrations.mjs';

export function setupLocal({ mode = process.env.NODE_ENV || 'development', dataDirectory = dataDirectoryFor(mode) } = {}) {
  assertLocalMode(mode);
  privateDirectory(dataDirectory);
  const secretPath = join(dataDirectory, 'auth-secret.env');
  let fd;
  try {
    fd = openSync(secretPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    writeFileSync(fd, `BETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\n`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  const config = loadConfig({ mode, dataDirectory });
  if (!config.supabase) {
    const db = openDatabase(config.databasePath);
    try { migrateDatabase(db); } finally { db.close(); }
  }
  return config;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    setupLocal();
    console.log('Local auth setup ready. Private data is outside the project webroot; no seed accounts created.');
  } catch (error) {
    console.error(`Local setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
