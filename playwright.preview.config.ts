import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'preview.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:3200', headless: true, launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) } },
  webServer: { command: 'node tests/preview-server.mjs', url: 'http://127.0.0.1:3200', reuseExistingServer: false },
});
