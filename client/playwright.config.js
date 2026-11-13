import { defineConfig } from '@playwright/test';

// End-to-end browser tests: `npm run test:e2e` (from the client folder).
// Playwright starts two servers just for the tests and stops them afterwards:
//   - the API on port 5181 with a fresh in-memory database (server/scripts/e2e-server.js)
//   - the frontend on port 5185, talking to that API
// So the tests can run while your normal dev servers (5001 / 5174) are running, and your
// real database is never touched. The tests use the Google Chrome installed on this computer.
const API_PORT = 5181;
const WEB_PORT = 5185;

export default defineConfig({
  testDir: './e2e',
  // The tests share one database, so they run one after another
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'chrome',
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../server/scripts/e2e-server.js',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_API_PORT: String(API_PORT) },
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      timeout: 120_000,
    },
  ],
});
