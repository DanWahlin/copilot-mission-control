import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory dist',
    url: 'http://localhost:4173/game/index.html',
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
