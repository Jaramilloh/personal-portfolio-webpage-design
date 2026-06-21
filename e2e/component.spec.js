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

  test('#cv launchpad has CV download anchor and GitHub social link', async ({ page }) => {
    await gotoBooted(page);
    // Direct CV download anchor (no email gate)
    await expect(page.locator('#cv a[href$="CV.pdf"][download]')).toBeAttached();
    // GitHub social card
    await expect(page.locator('#cv a[href*="github.com/Jaramilloh"]')).toBeAttached();
  });
});
