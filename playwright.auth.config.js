import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './auth-tests',
  testMatch: '**/*.spec.js',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  outputDir: join(tmpdir(), 'sete-passos-auth-browser'),
  reporter: 'list',
  // These tests type synthetic passwords: no trace/video of credentials.
  use: { browserName: process.env.PORTAL_BROWSER || 'chromium', trace: 'off', video: 'off', screenshot: 'off' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5177/@vite/client', reuseExistingServer: true },
});
