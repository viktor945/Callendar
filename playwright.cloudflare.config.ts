import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/cloudflare', testMatch: 'browser.spec.ts', workers: 1, timeout: 60000, outputDir: './cloudflare-test-results',
  use: { baseURL: 'http://127.0.0.1:8788', headless: true, viewport: { width: 390, height: 844 }, launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) } },
  webServer: { command: 'node tests/cloudflare/dev-server.mjs', url: 'http://127.0.0.1:8788/api/health', reuseExistingServer: false, timeout: 45000 },
});
