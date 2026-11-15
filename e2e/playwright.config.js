// Playwright settings for Fidel's browser tests.
//
// The tests run against a running Fidel server (default http://localhost:8000).
// If none is running, Playwright starts one with `docker compose up`.
// Point at another server with:  FIDEL_BASE_URL=http://host:port npm test
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.FIDEL_BASE_URL || 'http://localhost:8000';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  // 4 browsers at once: with 8, a laptop that also runs the server made random
  // single tests time out (each passed alone). Override with --workers=N.
  workers: 4,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.FIDEL_BASE_URL
    ? undefined
    : {
        command: 'docker compose up --build',
        cwd: '..',
        url: `${baseURL}/health`,
        reuseExistingServer: true,
        timeout: 300_000,
      },
});
