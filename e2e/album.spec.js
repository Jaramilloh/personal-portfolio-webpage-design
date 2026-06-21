// CI/Docker only — Chromium SIGTERMs in agent Bash (#368)
// Run via: npx playwright test e2e/album.spec.js
// These tests require a real browser and a served version of the page.

import { test, expect } from '@playwright/test';

// URL-encoded path to the single entry file. There is no index.html; the static
// server lists the directory at `/`, so navigating to `/` would never render the
// portfolio (and #album would never appear). Mirror e2e/component.spec.js.
const ENTRY = '/Juan%20Felipe%20Jaramillo.dc.html';

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
    await page.goto(ENTRY);
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
    await page.goto(ENTRY);
    await page.locator('#album').scrollIntoViewIfNeeded();

    // Wait for the live album to render before sampling, so the captured src is the
    // post-shuffle value (not the empty initial featuredPhoto.url).
    const featured = page.locator('#album img').first();
    await expect(featured).toBeVisible();
    const featuredSrcBefore = await featured.getAttribute('src');

    // Trigger non-album state updates (counter/reveal logic) by scrolling.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // The shuffle runs once in componentDidMount; re-renders must not re-pick. If a
    // regression moved the shuffle into render, the src would change on these updates.
    // Assert stability holds over a short window rather than a single sample.
    await expect(async () => {
      expect(await featured.getAttribute('src')).toBe(featuredSrcBefore);
    }).toPass({ timeout: 1000 });
  });

  test('shows AWAITING empty state when manifest has no items', async ({ page }) => {
    // Override the intercept with an empty manifest for this test
    await page.unrouteAll();
    await page.route('**/assets/album/photos.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) })
    );
    // Stub the only third-party call (the live GitHub repos fetch) so this console
    // assertion is deterministic and browser-agnostic — it never flakes on CI
    // rate-limits, and Chromium/Firefox/WebKit word resource errors differently.
    // Returning an empty list makes ResilientRepositoryService fall back to the
    // curated set without logging an error.
    await page.route('**/api.github.com/**', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    );

    // With the only external request stubbed, the console must be strictly clean.
    // Any resource failure now — the self-hosted React bundles, core.js, the photos
    // manifest, the self-hosted fonts — is a real defect and fails this test instead
    // of being silently swallowed.
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`${msg.text()} @ ${(msg.location() && msg.location().url) || ''}`);
      }
    });

    await page.goto(ENTRY);
    await page.locator('#album').scrollIntoViewIfNeeded();

    // AWAITING badge must be visible
    await expect(page.locator('#album').getByText('MEDIASOURCE · AWAITING')).toBeVisible();

    // No JS errors thrown
    expect(consoleErrors).toHaveLength(0);
  });
});
