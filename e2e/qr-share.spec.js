import { test, expect } from '@playwright/test';

// E2E for the QR share widget (assets/qr-share.js) wired into the entry page.
// The widget is pure DOM/browser behavior (auto-inits on DOMContentLoaded,
// renders a <canvas> QR, talks to navigator.clipboard/share), so it belongs in
// the Playwright layer — Vitest runs in a DOM-less `node` env. Same entry file
// and static server as component.spec.js.
const ENTRY = '/Juan%20Felipe%20Jaramillo.dc.html';

const SCAN_BTN = 'button.qrs-btn';
const OVERLAY = '.qrs-overlay';
const CANVAS = '.qrs-panel canvas';

test.describe('QR share widget — mount & render', () => {
  test('floating SCAN button mounts and opens a HUD with a rendered QR', async ({ page }) => {
    await page.goto(ENTRY);

    const btn = page.locator(SCAN_BTN);
    await expect(btn).toBeVisible();

    // Overlay is built up-front but starts closed (opacity:0 / pointer-events:none).
    const overlay = page.locator(OVERLAY);
    await expect(overlay).toHaveCount(1);
    await expect(overlay).not.toHaveClass(/\bopen\b/);

    await btn.click();
    await expect(overlay).toHaveClass(/\bopen\b/);

    // Non-zero canvas pixels prove the vendored QR lib loaded and drew the matrix.
    await expect
      .poll(async () => page.locator(CANVAS).evaluate((c) => c.width))
      .toBeGreaterThan(0);

    // Action controls are present.
    await expect(page.locator('[data-qrs-copy]')).toBeVisible();
    await expect(page.locator('[data-qrs-share]')).toBeVisible();
    await expect(page.locator('[data-qrs-png]')).toBeVisible();
  });

  test('encodes the current page URL and closes on Escape', async ({ page }) => {
    await page.goto(ENTRY);
    await page.locator(SCAN_BTN).click();

    const overlay = page.locator(OVERLAY);
    await expect(overlay).toHaveClass(/\bopen\b/);

    // The widget encodes window.location.href and echoes it in the URL readout.
    const href = await page.evaluate(() => window.location.href);
    const shown = (await page.locator('[data-qrs-url]').textContent())?.trim();
    expect(shown).toBe(href);

    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/\bopen\b/);
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
    await page.locator(SCAN_BTN).click();
    await expect
      .poll(async () => page.locator(CANVAS).evaluate((c) => c.width))
      .toBeGreaterThan(0);

    // The QR matrix lib must come from the local vendor copy...
    expect(localLib.length).toBeGreaterThan(0);
    // ...and nothing the widget owns may reach a CDN or Google Fonts.
    expect(external, `unexpected external requests: ${external.join(', ')}`).toHaveLength(0);
  });
});
