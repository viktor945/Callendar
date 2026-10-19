import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: ['calendar.spec.ts', 'dates.spec.ts', 'mobile.spec.ts', 'phone-usability.spec.ts'],
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3100', headless: true, launchOptions: { ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) }, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/e2e-server.mjs', url: 'http://127.0.0.1:3100/api/health', reuseExistingServer: false, timeout: 30000 },
});
