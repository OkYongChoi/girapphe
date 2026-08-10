import { expect, test, type Page } from '@playwright/test';

const toleratedConsoleErrors = [
  /favicon\.ico/i,
];

const authEntrypointOrConfigFallback = /Sign in|Sign up|Clerk keys are missing|Live Clerk keys cannot be used/i;

function attachBrowserFailureGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;

    const text = message.text();
    if (toleratedConsoleErrors.some((pattern) => pattern.test(text))) return;

    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return async () => {
    // Give late hydration and browser console events a moment to surface.
    await page.waitForTimeout(250);
    expect(pageErrors, 'uncaught browser page errors').toEqual([]);
    expect(consoleErrors, 'browser console errors').toEqual([]);
  };
}

test.describe('browser smoke', () => {
  test('health endpoint responds', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
  });

  test('home page renders the app shell', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/');
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Practice STEM concepts/i })).toBeVisible();

    await assertNoBrowserFailures();
  });

  test('practice mode navigation identifies the active mode', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/practice?mode=review');

    const practiceMode = page.getByRole('navigation', { name: 'Practice mode' });
    await expect(practiceMode.getByRole('link', { name: 'Review' })).toHaveAttribute('aria-current', 'page');
    await expect(practiceMode.getByRole('link', { name: 'Learn New' })).not.toHaveAttribute('aria-current');

    await assertNoBrowserFailures();
  });

  test('home respects reduced-motion preferences', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('.home-scroll-cue')).toHaveCSS('animation-iteration-count', '1');
    await assertNoBrowserFailures();
  });

  test('login page renders an auth entrypoint or local config fallback', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/login');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('body')).toContainText(authEntrypointOrConfigFallback);

    await assertNoBrowserFailures();
  });

  test('signup page renders an auth entrypoint or local config fallback', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/signup');
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('body')).toContainText(authEntrypointOrConfigFallback);

    await assertNoBrowserFailures();
  });

  test('knowledge graph renders a non-empty graph surface', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/knowledge');
    await expect(page.getByRole('heading', { name: 'Knowledge Graph' })).toBeVisible({ timeout: 20_000 });

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeAttached({ timeout: 20_000 });

    const box = await canvas.boundingBox();
    expect(box?.width ?? 0, 'knowledge graph canvas width').toBeGreaterThan(0);
    expect(box?.height ?? 0, 'knowledge graph canvas height').toBeGreaterThan(0);

    await assertNoBrowserFailures();
  });
});
