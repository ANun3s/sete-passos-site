import { loadSupabaseConfig, loadAdminEmail } from './supabase-runtime.mjs';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { parseEnv } from 'node:util';

export const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_DATA_DIRECTORY = join(homedir(), 'Library', 'Application Support', 'Sete Passos Development');

export function assertLocalMode(mode) {
  if (!['development', 'test'].includes(mode) || process.env.NODE_ENV === 'production') {
    throw new Error('Production is blocked; local development authentication only.');
  }
}

function inside(parent, path) {
  const part = relative(parent, path);
  return part === '' || (!part.startsWith('..') && !isAbsolute(part));
}

export function assertOutsideWebroot(path) {
  let candidate = resolve(path);
  if (inside(PROJECT_ROOT, candidate)) throw new Error('Secret/database path must be outside the project webroot.');
  // Check the closest existing ancestor as well, so a symlink cannot route
  // an otherwise innocent-looking external path back into the static root.
  while (true) {
    try {
      if (inside(realpathSync(PROJECT_ROOT), realpathSync(candidate))) throw new Error('Secret/database path resolves inside the webroot.');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      candidate = dirname(candidate);
    }
  }
}

export function privateDirectory(path) {
  assertOutsideWebroot(path);
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (lstatSync(path).isSymbolicLink()) throw new Error('Private data directory cannot be a symbolic link.');
  chmodSync(path, 0o700);
}

export function dataDirectoryFor(mode = process.env.NODE_ENV || 'development') {
  assertLocalMode(mode);
  const override = process.env.SETE_PASSOS_TEST_DATA_DIR;
  if (override && mode !== 'test') throw new Error('Data-directory override is allowed only with NODE_ENV=test.');
  return override ? resolve(override) : DEFAULT_DATA_DIRECTORY;
}

export function loadConfig({ mode = process.env.NODE_ENV || 'development', dataDirectory = dataDirectoryFor(mode) } = {}) {
  assertLocalMode(mode);
  assertOutsideWebroot(dataDirectory);
  const secretPath = join(dataDirectory, 'auth-secret.env');
  const info = lstatSync(secretPath);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600) throw new Error('auth-secret.env must be a regular file with permissions 600.');
  const secret = parseEnv(readFileSync(secretPath, 'utf8')).BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Run node server/setup.mjs to generate a local auth secret.');
  // No process-wide dotenv mutation, cwd discovery, VITE_ secrets, or reads
  // of other projects. The path is dedicated to this application.
  const portValue = mode === 'test' && process.env.SETE_PASSOS_TEST_PORT !== undefined ? Number(process.env.SETE_PASSOS_TEST_PORT) : 3007;
  if (!Number.isInteger(portValue) || portValue < 0 || portValue > 65535) throw new Error('Invalid test port.');
  return { databasePath: join(dataDirectory, 'auth.sqlite'), secret, port: portValue, mode, supabase: loadSupabaseConfig(dataDirectory), adminEmail: loadAdminEmail(dataDirectory), adminContentPath: join(dataDirectory, 'admin-fichas.html'), adminMockupsDirectory: join(dataDirectory, 'admin-mockups') };
}
