// E2E config. Safety (CLAUDE.md): no video, no traces, no screenshots of flashing fixtures.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8642',
    channel: process.env.SP_CHANNEL || 'msedge', // Chrome 137+ ignores --load-extension
    headless: true,
    video: 'off',
    trace: 'off',
    screenshot: 'off',
    viewport: { width: 480, height: 800 },
  },
  webServer: [
    { command: 'node tools/serve.mjs 8642', url: 'http://localhost:8642/lab/index.html', reuseExistingServer: true },
    // Second origin for cross-origin (tainted canvas) tests.
    { command: 'node tools/serve.mjs 8643', url: 'http://127.0.0.1:8643/lab/index.html', reuseExistingServer: true },
  ],
});
