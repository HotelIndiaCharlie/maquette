import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Some environments ship a pre-installed Chromium that does not match the
 * revision this @playwright/test pins. Point at it when it is there; fall back
 * to Playwright's own download (what CI does) when it is not.
 */
const PREINSTALLED_CHROMIUM =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
