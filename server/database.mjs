import Database from 'better-sqlite3';
import { mkdirSync, chmodSync, lstatSync } from 'node:fs';
import { assertOutsideWebroot } from './config.mjs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (!path || path === ':memory:') throw new Error('A persistent SQLite file path is required.');
  assertOutsideWebroot(path);
  try {
    if (lstatSync(path).isSymbolicLink()) throw new Error('Database cannot be a symbolic link.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new Database(path);
  chmodSync(path, 0o600);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  return db;
}
