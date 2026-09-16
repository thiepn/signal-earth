import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.QA_BASE_URL?.trim();
const baseURL = externalBaseUrl
  ? (externalBaseUrl.endsWith('/') ? externalBaseUrl : `${externalBaseUrl}/`)
  : 'http://127.0.0.1:4173/';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'chromium-ultrawide',
      use: { ...devices['Desktop Chrome'], viewport: { width: 2560, height: 1080 } },
    },
    {
      name: 'android-chromium',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'ios-webkit',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'tablet-webkit',
      use: { ...devices['iPad Pro 11'] },
    },
  ],
});
