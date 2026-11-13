import { Pool } from 'pg';
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { assertOutsideWebroot } from './config.mjs';
import { postgresDatabase } from './postgres.mjs';

function readPrivateFile(path) {
  assertOutsideWebroot(path);
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600) throw new Error('Supabase configuration must be a regular private file with permissions 600.');
  return readFileSync(path, 'utf8');
}

export function loadSupabaseConfig(dataDirectory) {
  let contents;
  try { contents = readPrivateFile(join(dataDirectory, 'supabase.env')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  const env = parseEnv(contents);
  const config = { url: env.SETE_PASSOS_SUPABASE_DB_URL };
  if (env.SETE_PASSOS_SUPABASE_CA_FILE) config.ca = readPrivateFile(env.SETE_PASSOS_SUPABASE_CA_FILE);
  supabasePoolOptions(config);
  return config;
}

export function loadAdminEmail(dataDirectory) {
  let contents;
  try { contents = readPrivateFile(join(dataDirectory, 'supabase.env')); }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  const value = parseEnv(contents).SETE_PASSOS_ADMIN_EMAIL?.trim().toLowerCase() || '';
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) throw new Error('Invalid private admin account configuration.');
  return value;
}

export function supabasePoolOptions({ url: value, ca } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid private Supabase connection.'); }
  const user = decodeURIComponent(url.username);
  const hostValid = /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname) || /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !hostValid ||
      !/^sete_passos_app(?:\.[a-z0-9]+)?$/.test(user) || !url.password ||
      (url.port && url.port !== '5432') || url.pathname !== '/postgres' || url.search || url.hash) {
    throw new Error('Supabase requires the dedicated runtime role, port 5432 and verified TLS without URL overrides.');
  }
  return {
    connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000, query_timeout: 10000,
    application_name: 'sete-passos-local',
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}

export async function openSupabaseRuntime(config) {
  const pool = new Pool(supabasePoolOptions(config));
  // An idle network error must not crash Node or log connection credentials.
  pool.on('error', () => console.error('Supabase: idle connection lost; the next request will reconnect.'));
  try {
    const role = (await pool.query('SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user')).rows[0];
    if (role?.name !== 'sete_passos_app' || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole) throw new Error('Invalid runtime role');
    // Validate schema and DML access before opening the HTTP listener. No DDL at runtime.
    for (const table of ['user', 'account', 'session', 'verification', 'rateLimit']) {
      await pool.query(`SELECT 1 FROM sete_passos_auth."${table}" LIMIT 0`);
    }
    await pool.query('SELECT cpf FROM sete_passos_auth."user" LIMIT 0');
  } catch {
    await pool.end();
    throw new Error('Supabase connection unavailable. Check the private configuration, TLS and login schema.');
  }
  return {
    database: postgresDatabase(pool), pool,
    async health() { await pool.query('SELECT 1'); },
    async close() { await pool.end(); },
  };
}
