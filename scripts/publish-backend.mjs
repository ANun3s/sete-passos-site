import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDirectory = join(process.env.HOME, 'Library/Application Support/Sete Passos Development');
const nodeDirectory = '/Users/nunes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin';
const pnpm = '/Users/nunes/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm';
const env = { ...process.env, PATH: `${nodeDirectory}:${process.env.PATH}` };
const fileInfo = path => {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o777) !== 0o600) throw new Error('Private deployment assets must be regular files with mode 600.');
  return info;
};

async function run(args, { input, output = true } = {}) {
  const child = spawn(pnpm, ['dlx', 'wrangler', ...args], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => stdout += chunk);
  child.stderr.on('data', chunk => stderr += chunk);
  if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  const code = await new Promise(resolve => child.on('close', resolve));
  const full = `${stdout}${stderr}`;
  if (code !== 0) {
    if (output) process.stderr.write(full.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, '[redacted connection]'));
    throw new Error(`Wrangler command failed (${args[0]} ${args[1] || ''}; exit ${code}).`);
  }
  if (output) process.stdout.write(full);
  return full;
}

const database = parseEnv(readFileSync(join(dataDirectory, 'supabase.env'), 'utf8'));
const secretPath = join(dataDirectory, 'auth-secret.env');
fileInfo(secretPath);
fileInfo(join(dataDirectory, 'supabase.env'));
const authSecret = parseEnv(readFileSync(secretPath, 'utf8')).BETTER_AUTH_SECRET;
const adminEmail = database.SETE_PASSOS_ADMIN_EMAIL?.trim().toLowerCase();
if (!authSecret || authSecret.length < 32 || !adminEmail || !database.SETE_PASSOS_SUPABASE_DB_URL) throw new Error('Required private production configuration is incomplete.');

process.stdout.write('Building production site and API…\n');
await new Promise((resolve, reject) => {
  const child = spawn(join(root, 'node_modules/.bin/vite'), ['build'], { cwd: root, env, stdio: 'inherit' });
  child.on('close', code => code === 0 ? resolve() : reject(new Error(`Build failed (${code}).`)));
});

const assets = [
  ['admin/admin-fichas.html', join(dataDirectory, 'admin-fichas.html'), 'text/html; charset=utf-8'],
  ...readdirSync(join(dataDirectory, 'admin-mockups')).map(name => {
    if (!/^(?:avaliacao-fisioterapeutica|proposta-tratamento)\.(?:html|png)$|^mockups\.css$|^(?:127094ee3636|120e21d34aa0|cfc28f55752f)\.png$/u.test(name)) return null;
    const mime = name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css; charset=utf-8' : 'image/png';
    return [`admin/mockups/${name}`, join(dataDirectory, 'admin-mockups', name), mime];
  }).filter(Boolean),
];
for (const [key, path, mime] of assets) {
  fileInfo(path);
  await run(['kv', 'key', 'put', key, '--path', path, '--binding', 'SETEPASSOS_STORAGE', '--remote', '--metadata', JSON.stringify({ contentType: mime })], { output: false });
}
process.stdout.write(`Private admin templates uploaded: ${assets.length} objects.\n`);

await run(['pages', 'secret', 'put', 'BETTER_AUTH_SECRET', '--project-name', 'sete-passos'], { input: authSecret, output: false });
await run(['pages', 'secret', 'put', 'SETE_PASSOS_ADMIN_EMAIL', '--project-name', 'sete-passos'], { input: adminEmail, output: false });
process.stdout.write('Cloudflare secrets configured without displaying their values.\n');

await run(['pages', 'deploy', 'dist', '--project-name', 'sete-passos', '--branch', 'main']);
const url = 'https://sete-passos.pages.dev';
let health, healthBody = {};
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    health = await fetch(`${url}/api/health`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    healthBody = await health.json().catch(() => ({}));
    if (health.ok && healthBody.ok === true) break;
  } catch { /* Give a new Pages isolate one more chance to initialize. */ }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
const admin = await fetch(`${url}/api/admin/users`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
const home = await fetch(url, { signal: AbortSignal.timeout(8000) });
process.stdout.write(JSON.stringify({
  site: url,
  health: health.status,
  databaseReady: health.ok && healthBody.ok === true,
  unauthenticatedAdminIsBlocked: admin.status === 401,
  home: home.status,
}, null, 2) + '\n');
if (!health.ok || healthBody.ok !== true || admin.status !== 401 || !home.ok) throw new Error('Post-deployment validation failed.');
