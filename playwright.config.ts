import { defineConfig, devices } from '@playwright/test';

// Full-stack E2E: the built API and the built web app against a real MongoDB replica set
// (`docker compose up -d --wait mongo`), using a separate database so demo data is never touched.
const API_PORT = 3100;
const WEB_PORT = 4173;
const CI = Boolean(process.env.CI);

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'mongodb://localhost:27018/mm-order-e2e?replicaSet=rs0&directConnection=true';

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: CI,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${String(WEB_PORT)}`,
    // e.g. `chrome` to run with the locally installed Chrome instead of Playwright's Chromium download.
    channel: process.env.E2E_BROWSER_CHANNEL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'yarn workspace @app/api build && yarn workspace @app/api start',
      port: API_PORT,
      env: {
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        LOG_LEVEL: 'warn',
        DATABASE_URL: E2E_DATABASE_URL,
        CORS_ORIGINS: `http://localhost:${String(WEB_PORT)}`,
      },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: `yarn workspace @app/web build && yarn workspace @app/web preview --port ${String(WEB_PORT)} --strictPort`,
      url: `http://localhost:${String(WEB_PORT)}`,
      env: { VITE_API_URL: `http://localhost:${String(API_PORT)}/graphql` },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
