import { defineConfig } from '@playwright/test';

// E2E layer for the `Component` class living inside "Juan Felipe Jaramillo.dc.html".
// That class is evaluated by the dc-runtime (support.js) at boot, which bootstraps
// React from a CDN — it is unreachable from Node/Vitest and must be exercised in a
// real browser over HTTP. This config is dev-only tooling: it never touches the
// build-free shipped site. Vitest (tests/**/*.test.js, node env) stays separate.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 900 },
        // Root containers / CI runners without user namespaces cannot start the
        // Chromium sandbox. Opt in with PLAYWRIGHT_NO_SANDBOX=1 there; local dev
        // keeps the sandbox on (default).
        launchOptions: process.env.PLAYWRIGHT_NO_SANDBOX
          ? { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
          : {},
      },
    },
    // Cross-browser coverage: the dc-runtime uses ES modules, dynamic import() and
    // IntersectionObserver — verify Gecko and WebKit render the page too, not just
    // Blink. (No Chromium-specific sandbox args apply to these engines.)
    {
      name: 'firefox',
      use: { browserName: 'firefox', viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit', viewport: { width: 1280, height: 900 } },
    },
  ],
  // Auto-start the same static server the project already ships (`npm run serve`).
  // The dc-runtime's ES module import() requires HTTP, so file:// will not work.
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
