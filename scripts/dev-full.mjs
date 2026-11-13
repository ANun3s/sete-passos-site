import { spawn } from 'node:child_process';

// Own both children: Ctrl+C or a failed server stops its sibling too.
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
for (const args of [['server/index.mjs'], ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort']]) {
  const child = spawn(process.execPath, args, { stdio: 'inherit' });
  children.push(child);
  child.once('error', () => { console.error('Não foi possível iniciar um servidor local.'); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code ?? 1); });
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
