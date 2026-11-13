import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const migrationsDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));

// SQLite DDL and its ledger entry commit together; no reset/drop shortcut.
export function migrateDatabase(db, directory = migrationsDirectory) {
  return db.transaction(() => {
    db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, appliedAt TEXT NOT NULL)');
    const files = readdirSync(directory).filter((name) => /^\d{3}[-\w]*\.sql$/.test(name)).sort();
    const applied = [];
    for (const name of files) {
      const sql = readFileSync(join(directory, name), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = db.prepare('SELECT checksum FROM _migrations WHERE name = ?').get(name);
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name, checksum, appliedAt) VALUES (?, ?, ?)').run(name, checksum, new Date().toISOString());
      applied.push(name);
    }
    if (db.pragma('foreign_key_check').length) throw new Error('Migration failed foreign-key validation.');
    return applied;
  }).immediate();
}
