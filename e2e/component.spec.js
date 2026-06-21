import { test, expect } from '@playwright/test';

// URL-encoded path to the single entry file (there is no index.html; the static
// server lists the directory at `/`). Confirmed to return HTTP 200.
const ENTRY = '/Juan%20Felipe%20Jaramillo.dc.html';

// Boot gate. The repos list is rendered by Component.renderVals only after the
// dc-runtime has imported core.js, mounted React, and componentDidMount has run.
// A repo card with a real GitHub URL therefore proves the Component actually booted
// (it never appears in the raw, pre-render template). Holds for both the live
// GitHub source and the curated fallback, so it is not flaky on network state.
const REPO_CARD = '#repos a[href*="github.com/Jaramilloh/"]';

async function gotoBooted(page) {
  await page.goto(ENTRY);
  // toBeAttached (not toBeVisible) on purpose: repo cards carry data-reveal and start
  // at opacity:0 below the fold until scrolled, so "attached in the DOM" is the honest
  // proof that Component rendered them — tightening this to toBeVisible would be flaky.
  await expect(page.locator(REPO_CARD).first()).toBeAttached();
}

test.describe('Component — boot & render', () => {
  test('boots the dc-runtime and renders the hero and repo cards', async ({ page }) => {
    await gotoBooted(page);
    await expect(page.locator('#top h1')).toContainText('Jaramillo');
    expect(await page.locator(REPO_CARD).count()).toBeGreaterThan(0);
  });
});

test.describe('Component — v2 sections (launchpad + reading)', () => {
  test('#reading contains an attached external paper link', async ({ page }) => {
    await gotoBooted(page);
    // At least one arXiv paper link must be attached in the reading section
    await expect(page.locator('#reading a[href*="arxiv.org"]').first()).toBeAttached();
  });

  test('#cv launchpad has CV page anchor and GitHub social link', async ({ page }) => {
    await gotoBooted(page);
    // CV page link (opens in new tab, no download attribute)
    await expect(page.locator('#cv a[href$="cv.html"]')).toBeAttached();
    // GitHub social card
    await expect(page.locator('#cv a[href*="github.com/Jaramilloh"]')).toBeAttached();
  });
});

test.describe('Mobile viewport 390px', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoBooted(page);
  });

  test('no horizontal overflow at 390px (SPEC-07)', async ({ page }) => {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  });

  test('H1 name fully in-viewport — right edge within 390px (SPEC-01)', async ({ page }) => {
    const box = await page.locator('#top h1').boundingBox();
    expect(box).not.toBeNull();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    // Full name text present in the h1 (Jaramillo is the identifying word in the file)
    await expect(page.locator('#top h1')).toContainText('Jaramillo');
  });

  test('H1 font-size reduced below 62px on mobile (SPEC-01)', async ({ page }) => {
    const fontSize = await page.locator('#top h1').evaluate(
      el => parseFloat(getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeLessThan(62);
  });

  test('portrait bounding box within viewport — no right overflow (SPEC-02)', async ({ page }) => {
    const box = await page.locator('#top .hero-portrait').boundingBox();
    expect(box).not.toBeNull();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.x).toBeGreaterThanOrEqual(0);
  });

  test('all nav links within viewport — none clipped (SPEC-04)', async ({ page }) => {
    const links = await page.locator('.nav-links a').all();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  });

  test('stats grid does NOT render 4 columns at 390px (SPEC-05)', async ({ page }) => {
    const columns = await page.locator('.stats-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(columns).not.toBe(4);
  });

  test('work grid renders 1 column at 390px (SPEC-06)', async ({ page }) => {
    const columns = await page.locator('.work-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(columns).toBe(1);
  });

  test('SPEC-08: .stack-grid collapses to 2 columns at 390px', async ({ page }) => {
    const cols = await page.locator('.stack-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).not.toBe(4);
    expect(cols).toBe(2);
  });

  test('SPEC-09: .arch-grid collapses to 1 column at 390px', async ({ page }) => {
    const cols = await page.locator('.arch-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(1);
  });

  test('SPEC-10: .blog-grid collapses to 1 column at 390px', async ({ page }) => {
    const cols = await page.locator('.blog-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(1);
  });

  test('SPEC-11: .reading-table rows collapse to 1 column and stay within viewport at 390px', async ({ page }) => {
    const cols = await page.locator('.reading-table > a').first().evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(1);
    const box = await page.locator('.reading-table > a').first().boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

  test('SPEC-11b: .reading-table header label row is hidden on mobile', async ({ page }) => {
    const display = await page.locator('.reading-table > div').first().evaluate(
      el => getComputedStyle(el).display
    );
    expect(display).toBe('none');
  });
});

test.describe('Desktop viewport 1280px — section column invariance (SPEC-12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(ENTRY);
    await page.waitForLoadState('networkidle');
  });

  test('SPEC-12a: .stack-grid retains 4 columns on desktop', async ({ page }) => {
    const cols = await page.locator('.stack-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(4);
  });

  test('SPEC-12b: .arch-grid retains 2 columns on desktop', async ({ page }) => {
    const cols = await page.locator('.arch-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(2);
  });

  test('SPEC-12c: .blog-grid retains 3 columns on desktop', async ({ page }) => {
    const cols = await page.locator('.blog-grid').evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(3);
  });

  test('SPEC-12d: .reading-table rows retain 4 columns on desktop', async ({ page }) => {
    const cols = await page.locator('.reading-table > a').first().evaluate(
      el => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(cols).toBe(4);
  });

  test('SPEC-12e: .reading-table header is visible on desktop', async ({ page }) => {
    const display = await page.locator('.reading-table > div').first().evaluate(
      el => getComputedStyle(el).display
    );
    expect(display).not.toBe('none');
  });
});
