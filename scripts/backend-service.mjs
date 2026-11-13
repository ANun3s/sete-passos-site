// Persistent per-user macOS service. Never embeds credentials in the plist.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, privateDirectory, DEFAULT_DATA_DIRECTORY } from '../server/config.mjs';

const label = 'com.setepassos.backend';
const domain = `gui/${process.getuid?.()}`;
const target = `${domain}/${label}`;
const plist = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
const root = fileURLToPath(new URL('../', import.meta.url));
const command = process.argv[2] || 'status';
if (process.platform !== 'darwin') throw new Error('This service installer requires macOS.');
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const launch = args => execFileSync('/bin/launchctl', args, { stdio: 'inherit' });
const loaded = () => spawnSync('/bin/launchctl', ['print', target], { stdio: 'ignore' }).status === 0;
if (command === 'install') {
  const config = loadConfig();
  if (!config.supabase) throw new Error('Configure the private Supabase connection before installing the service.');
  privateDirectory(DEFAULT_DATA_DIRECTORY);
  mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
  const log = join(DEFAULT_DATA_DIRECTORY, 'backend-service.log');
  writeFileSync(log, '', { flag: 'a', mode: 0o600 });
  // These are short startup/error messages only, without request data or secrets.
  const contents = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(root, 'server/index.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>development</string></dict>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer>
<key>ExitTimeOut</key><integer>20</integer>
<key>Umask</key><integer>63</integer>
<key>StandardOutPath</key><string>${xml(log)}</string>
<key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>\n`;
  writeFileSync(plist, contents, { mode: 0o600 });
  execFileSync('/usr/bin/plutil', ['-lint', plist], { stdio: 'inherit' });
  if (loaded()) launch(['bootout', target]);
  launch(['enable', target]);
  launch(['bootstrap', domain, plist]);
  console.log('Backend service installed. macOS starts and supervises it independently of this chat.');
} else if (command === 'status') {
  launch(['print', target]);
} else if (command === 'restart') {
  launch(['kickstart', '-k', target]);
} else if (command === 'uninstall') {
  if (loaded()) launch(['bootout', target]);
  if (existsSync(plist)) unlinkSync(plist);
  console.log('Backend service removed. Database and private configuration preserved.');
} else throw new Error('Use install, status, restart or uninstall.');
