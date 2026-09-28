import { defineConfig, devices } from '@playwright/test';

// Events suite: runs against the Firebase emulators (never production).
// Use `npm run test:events`, which starts the emulators and runs this config inside them.
export default defineConfig({
  testDir: './tests/events',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:8091', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testIgnore: /rules\.spec/ },
  ],
  webServer: {
    command: 'VITE_FIREBASE_EMULATORS=1 npx vite --port 8091 --strictPort',
    url: 'http://localhost:8091',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
