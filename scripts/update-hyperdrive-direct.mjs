import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const dataDirectory = join(process.env.HOME, 'Library/Application Support/Sete Passos Development');
const values = parseEnv(readFileSync(join(dataDirectory, 'supabase.env'), 'utf8'));
const connection = new URL(values.SETE_PASSOS_SUPABASE_DB_URL);
const projectRef = decodeURIComponent(connection.username).split('.').at(-1);
if (!/^[a-z0-9]{20}$/u.test(projectRef)) throw new Error('Invalid Supabase project reference in private configuration.');
connection.hostname = `db.${projectRef}.supabase.co`;
connection.port = '5432';
connection.username = 'sete_passos_app';
const args = [
  'dlx', 'wrangler', 'hyperdrive', 'update', 'c0847678519e45caa68c7974cbd2b229',
  '--connection-string', connection.toString(), '--sslmode', 'verify-full',
  '--ca-certificate-id', '94b060e0-d86c-4606-82e2-62c7c3350869',
  '--origin-connection-limit', '5', '--caching-disabled',
];
const child = spawn('/Users/nunes/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm', args, {
  env: { ...process.env, PATH: `/Users/nunes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:${process.env.PATH}` },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => output += chunk);
child.stderr.on('data', chunk => output += chunk);
child.on('close', code => {
  if (code !== 0) {
    const safe = output.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/giu, '[redacted database connection]');
    process.stderr.write(`Hyperdrive update failed (exit ${code}).\n${safe.slice(-1200)}\n`);
    process.exitCode = 1;
  } else process.stdout.write('Hyperdrive now uses the Supabase direct endpoint with verified TLS.\n');
});
