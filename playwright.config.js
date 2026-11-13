import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Trace files are written during tests: keep them outside Live Server's watched workspace.
const externalPreview = Boolean(process.env.GO_LIVE_URL || process.env.PORTAL_BASE_URL);
const externalArtifacts = join(tmpdir(), 'sete-passos-playwright');
export default defineConfig({
  testDir: './tests',
  outputDir: externalPreview ? join(externalArtifacts, 'results') : 'test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 25000,
  use: { browserName: process.env.PORTAL_BROWSER || 'chromium', baseURL: 'http://127.0.0.1:5177', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never', outputFolder: externalPreview ? join(externalArtifacts, 'report') : 'playwright-report' }]],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5177/@vite/client', reuseExistingServer: true },
});
