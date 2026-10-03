import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the stack `docker compose up` serves. Start it first.
 * They use the Chrome installed on the machine, so no browser download is needed.
 * Every test gets a fresh browser context, so IndexedDB starts from the shipped seed.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:8080',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
});
