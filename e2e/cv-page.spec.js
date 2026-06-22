import { test, expect } from '@playwright/test';

// Dev server serves the file as-is; prod renames to cv.html.
const CV_PAGE = '/CV.dc.html';

test.describe('CV page', () => {
  test('renders a visible h1 containing "Jaramillo" (proves React booted)', async ({ page }) => {
    await page.goto(CV_PAGE);
    await expect(page.locator('h1', { hasText: 'Jaramillo' })).toBeVisible();
  });

  test('makes zero external/CDN requests', async ({ page }) => {
    const external = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net/.test(url)) {
        external.push(url);
      }
    });

    await page.goto(CV_PAGE);
    // Wait for React to boot and h1 to be visible so all script requests have fired.
    await expect(page.locator('h1', { hasText: 'Jaramillo' })).toBeVisible();

    expect(external, `unexpected external requests: ${external.join(', ')}`).toHaveLength(0);
  });

  test('produces no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(CV_PAGE);
    await expect(page.locator('h1', { hasText: 'Jaramillo' })).toBeVisible();

    expect(errors, `unexpected console errors: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('print button triggers window.print under CSP (no inline handler)', async ({ page }) => {
    // The CSP is script-src 'self', which blocks inline onClick attributes, so the
    // print button must be wired via addEventListener. Stub print, click, assert it fired.
    await page.addInitScript(() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; });
    await page.goto(CV_PAGE);
    await expect(page.locator('h1', { hasText: 'Jaramillo' })).toBeVisible();
    await page.locator('#cv-print').click();
    await expect.poll(() => page.evaluate(() => window.__printed)).toBeGreaterThan(0);
  });

  test('collapses to a single-column, overflow-free layout on a phone viewport', async ({ page }) => {
    // Phone viewport inside the 680px breakpoint; acceptance band is ~375-414px.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(CV_PAGE);
    // DOM proof the DC runtime booted (same gate the other tests use).
    await expect(page.locator('h1', { hasText: 'Jaramillo' })).toBeVisible();

    // The header grid must compute to a single track on mobile (cv-header -> 1fr).
    const headerTracks = await page.locator('.cv-header').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns
    );
    // One resolved track = no inner space char (two tracks render as "Xpx Ypx").
    expect(headerTracks.trim().split(/\s+/)).toHaveLength(1);

    // No horizontal overflow at this viewport.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(1);
  });
});
