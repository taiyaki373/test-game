import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  webServer: {
    command: 'npx vite --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    video: 'on', // Automatically captures MP4/WebM of the test runs
  },
});
