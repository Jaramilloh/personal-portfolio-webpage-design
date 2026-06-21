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
});
