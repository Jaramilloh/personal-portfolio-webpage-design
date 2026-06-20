// CI/Docker only — Chromium SIGTERMs in agent Bash (#368)
// Run via: npx playwright test e2e/album.spec.js
// These tests require a real browser and a served version of the page.

import { test, expect } from '@playwright/test';

const SEEDED_MANIFEST = {
  items: [
    { url: 'assets/album/test-01.jpg', width: 800, height: 600, alt: 'Photo 1', date: '2025-01-01' },
    { url: 'assets/album/test-02.jpg', width: 800, height: 600, alt: 'Photo 2', date: '2025-02-01' },
    { url: 'assets/album/test-03.jpg', width: 800, height: 600, alt: 'Photo 3', date: '2025-03-01' },
    { url: 'assets/album/test-04.jpg', width: 800, height: 600, alt: 'Photo 4', date: '2025-04-01' },
    { url: 'assets/album/test-05.jpg', width: 800, height: 600, alt: 'Photo 5', date: '2025-05-01' },
  ],
};

test.describe('Album section — StaticManifestMediaAdapter', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept the manifest fetch and return a seeded 5-photo payload
    await page.route('**/assets/album/photos.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SEEDED_MANIFEST) })
    );
  });

  test('renders one featured photo and 2-4 grid photos from seeded manifest', async ({ page }) => {
    await page.goto('/');
    await page.locator('#album').scrollIntoViewIfNeeded();

    // Featured photo: first image inside the featured slot (first child of the 2-column grid)
    const featuredImg = page.locator('#album img').first();
    await expect(featuredImg).toBeVisible();

    // Grid photos: all images after the first (restPhotos = subset.slice(1))
    const allImgs = page.locator('#album img');
    const count = await allImgs.count();
    // total displayed = 1 featured + 2..4 grid = 3..5
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(5);

    // Grid count (restPhotos) is 2..4
    const gridCount = count - 1;
    expect(gridCount).toBeGreaterThanOrEqual(2);
    expect(gridCount).toBeLessThanOrEqual(4);
  });

  test('subset is stable across non-album setState (shuffle does not re-run in render)', async ({ page }) => {
    await page.goto('/');
    await page.locator('#album').scrollIntoViewIfNeeded();

    // Capture initial featured src
    const featuredSrcBefore = await page.locator('#album img').first().getAttribute('src');

    // Trigger a non-album state update by scrolling (fires counter/reveal logic)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    // Featured photo must be unchanged after re-render
    const featuredSrcAfter = await page.locator('#album img').first().getAttribute('src');
    expect(featuredSrcAfter).toBe(featuredSrcBefore);
  });

  test('shows AWAITING empty state when manifest has no items', async ({ page }) => {
    // Override the intercept with an empty manifest for this test
    await page.unrouteAll();
    await page.route('**/assets/album/photos.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) })
    );

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.locator('#album').scrollIntoViewIfNeeded();

    // AWAITING badge must be visible
    await expect(page.locator('#album').getByText('MEDIASOURCE · AWAITING')).toBeVisible();

    // No JS errors thrown
    expect(consoleErrors).toHaveLength(0);
  });
});
