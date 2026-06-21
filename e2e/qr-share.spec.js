import { test, expect } from '@playwright/test';

const ENTRY = '/Juan%20Felipe%20Jaramillo.dc.html';

test.describe('QR Share Widget', () => {
  test('button is attached after page boot', async ({ page }) => {
    await page.goto(ENTRY);
    await expect(page.locator('.qrs-btn')).toBeAttached();
  });

  test('overlay opens on button click', async ({ page }) => {
    await page.goto(ENTRY);
    await page.locator('.qrs-btn').click();
    await expect(page.locator('.qrs-overlay')).toHaveClass(/open/);
  });

  test('canvas renders with non-zero size (CSP + vendored lib)', async ({ page }) => {
    await page.goto(ENTRY);
    await page.locator('.qrs-btn').click();
    await expect(page.locator('.qrs-overlay canvas')).toBeAttached();
    const canvas = page.locator('.qrs-overlay canvas');
    await expect.poll(async () => await canvas.evaluate(el => el.width)).toBeGreaterThan(0);
    await expect.poll(async () => await canvas.evaluate(el => el.height)).toBeGreaterThan(0);
  });

  test('all three action controls are attached', async ({ page }) => {
    await page.goto(ENTRY);
    await page.locator('.qrs-btn').click();
    await expect(page.locator('[data-qrs-copy]')).toBeAttached();
    await expect(page.locator('[data-qrs-share]')).toBeAttached();
    await expect(page.locator('[data-qrs-png]')).toBeAttached();
  });

  test('no Google Fonts link injected into head', async ({ page }) => {
    await page.goto(ENTRY);
    const fontsLink = page.locator('head link[href*="fonts.googleapis.com"]');
    await expect(fontsLink).toHaveCount(0);
  });
});
