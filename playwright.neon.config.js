import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/neon',
  outputDir: 'work/neon-test-results',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120000,
  reporter: [['list'], ['json', { outputFile: 'work/neon-results.json' }]],
  // Real credentials and one-time tokens must never enter traces or screenshots.
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command: 'node tests/neon/server.js',
    url: 'http://localhost:5175/api/health',
    timeout: 60000,
    reuseExistingServer: false,
  },
});
