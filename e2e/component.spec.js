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
    await expect(page.locator('#top h1')).toContainText('REDPROOF_SHOULD_FAIL');
    expect(await page.locator(REPO_CARD).count()).toBeGreaterThan(0);
  });
});

test.describe('Component.requestCv — CV email gate', () => {
  test('rejects an invalid email address', async ({ page }) => {
    await gotoBooted(page);
    const cv = page.locator('#cv');
    await cv.getByPlaceholder('you@company.com').fill('not-an-email');
    await cv.getByRole('button', { name: /Request & download CV/i }).click();
    await expect(cv).toContainText('Enter a valid email address');
  });

  test('accepts a valid email and starts the CV download', async ({ page }) => {
    await gotoBooted(page);
    const cv = page.locator('#cv');
    await cv.getByPlaceholder('you@company.com').fill('recruiter@example.com');
    await cv.getByRole('button', { name: /Request & download CV/i }).click();
    await expect(cv).toContainText('Download started');
  });
});

test.describe('Component.sendContact — contact form', () => {
  test('rejects an empty submission', async ({ page }) => {
    await gotoBooted(page);
    const contact = page.locator('#contact');
    await contact.getByRole('button', { name: /Send message/i }).click();
    await expect(contact).toContainText('Please complete all fields');
  });

  test('rejects an invalid email address', async ({ page }) => {
    await gotoBooted(page);
    const contact = page.locator('#contact');
    await contact.getByPlaceholder('name').fill('Jane Doe');
    await contact.getByPlaceholder('email').fill('bad-email');
    await contact.getByPlaceholder('message').fill('Hello there.');
    await contact.getByRole('button', { name: /Send message/i }).click();
    await expect(contact).toContainText('That email looks off');
  });

  test('queues a valid message with a reference', async ({ page }) => {
    await gotoBooted(page);
    const contact = page.locator('#contact');
    await contact.getByPlaceholder('name').fill('Jane Doe');
    await contact.getByPlaceholder('email').fill('jane@example.com');
    await contact.getByPlaceholder('message').fill('Loved the DOD work — let us talk.');
    await contact.getByRole('button', { name: /Send message/i }).click();
    await expect(contact).toContainText('Queued — ref MSG-');
  });
});
