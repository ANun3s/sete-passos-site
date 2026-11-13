import { pathToFileURL } from 'node:url';
import { createLocalServer } from './app.mjs';
import { loadConfig } from './config.mjs';

export async function startLocalServer(config = loadConfig()) {
  const app = await createLocalServer(config);
  try { await app.start(); } catch (error) { await app.close(); throw error; }
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const app = await startLocalServer();
    console.log(`Sete Passos local API listening at ${app.url}`);
    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      await app.close();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    // Startup configuration failures only; never log request bodies or tokens.
    console.error(error.code === 'ENOENT' ? 'Local setup is missing. Run node server/setup.mjs.' : `Local API startup failed: ${error.message}`);
    process.exitCode = 1;
  }
}
