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

  test('encodes the current page URL and closes on Escape', async ({ page }) => {
    await page.goto(ENTRY);
    await page.locator('.qrs-btn').click();
    const overlay = page.locator('.qrs-overlay');
    await expect(overlay).toHaveClass(/open/);

    // The widget encodes window.location.href and echoes it in the URL readout.
    const href = await page.evaluate(() => window.location.href);
    const shown = (await page.locator('[data-qrs-url]').textContent())?.trim();
    expect(shown).toBe(href);

    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/open/);
  });

  test('renders entirely offline — no CDN or webfont requests', async ({ page }) => {
    const external = [];
    const localLib = [];
    page.on('request', (req) => {
      const url = req.url();
      if (/cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
        external.push(url);
      }
      if (/\/assets\/vendor\/qrcode-generator\.min\.js(\?|$)/.test(url)) {
        localLib.push(url);
      }
    });

    await page.goto(ENTRY);
    await page.locator('.qrs-btn').click();
    await expect
      .poll(async () => await page.locator('.qrs-overlay canvas').evaluate((c) => c.width))
      .toBeGreaterThan(0);

    // The QR matrix lib must come from the local vendor copy...
    expect(localLib.length).toBeGreaterThan(0);
    // ...and nothing the widget owns may reach a CDN or Google Fonts.
    expect(external, `unexpected external requests: ${external.join(', ')}`).toHaveLength(0);
  });
});
