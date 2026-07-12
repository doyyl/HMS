import { defineConfig, devices } from '@playwright/test';

// E2E runs against a running dev stack (server on :4000, web on :5173) with a
// seeded database. Start both with `npm run dev` from the repo root, seed with
// `npm run seed`, then run `npm run test:e2e`.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
