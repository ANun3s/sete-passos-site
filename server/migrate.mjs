import { loadConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { migrateDatabase } from './migrations.mjs';

try {
  const config = loadConfig();
  if (config.supabase) {
    console.log('Supabase configured: remote schema migrations are deployment operations, not startup operations.');
  } else {
  const db = openDatabase(config.databasePath);
  try {
    const applied = migrateDatabase(db);
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database is up to date (no data changed).');
  } finally { db.close(); }
  }
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'Local setup is missing. Run node server/setup.mjs.' : `Migration failed: ${error.message}`);
  process.exitCode = 1;
}
