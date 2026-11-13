import { defineConfig } from '@playwright/test';

if (!process.env.SALDOLAB_RELEASE_BASE_URL)
  throw new Error('An explicitly isolated QA Preview URL is required.');
export default defineConfig({
  testDir: './tests/release',
  outputDir: 'work/release-test-results',
  workers: 1,
  retries: 0,
  timeout: 90000,
  reporter: [['list'], ['json', { outputFile: 'work/release-results.json' }]],
  use: {
    baseURL: process.env.SALDOLAB_RELEASE_BASE_URL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
});
