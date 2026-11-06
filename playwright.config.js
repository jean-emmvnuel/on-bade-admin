import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout du back-office : un vrai navigateur clique dans les vraies pages.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  use: { baseURL: 'http://127.0.0.1:5195', trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'fr-FR', timezoneId: 'Africa/Abidjan' },
  webServer: { command: 'node e2e/serve.mjs', url: 'http://127.0.0.1:5195', reuseExistingServer: true },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
