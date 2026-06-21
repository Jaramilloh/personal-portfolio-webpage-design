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

  test('canvas renders a real QR matrix — dark-module ratio > 5% (CSP + vendored lib)', async ({ page }) => {
    await page.goto(ENTRY);
    await page.locator('.qrs-btn').click();
    await expect(page.locator('.qrs-overlay canvas')).toBeAttached();
    const ratio = await page.locator('.qrs-overlay canvas').evaluate((c) => {
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let dark = 0, total = 0;
      for (let i = 0; i < d.length; i += 4) { total++; if (d[i] < 128 && d[i+1] < 128 && d[i+2] < 128) dark++; }
      return total ? dark / total : 0;
    });
    expect(ratio).toBeGreaterThan(0.05); // a real QR matrix is ~15-20% dark; blank canvas = 0
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
