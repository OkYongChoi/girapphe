import { expect, test, type Page } from '@playwright/test';

const toleratedConsoleErrors = [
  /favicon\.ico/i,
];
const usesDeployedPreview = Boolean(process.env.PLAYWRIGHT_BASE_URL);

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

  test('quiz mutation rejects unauthenticated callers', async ({ request }) => {
    const response = await request.post('/api/quiz_result', {
      data: { node_id: 'math_derivative', result: 1 },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  test('personal knowledge purge rejects unauthenticated callers', async ({ request }) => {
    const response = await request.post('/api/internal/personal-knowledge-purge');
    expect(response.status()).toBe(401);
  });

  test('MCP draft ingestion rejects callers without a scoped token', async ({ request }) => {
    const response = await request.post('/api/mcp', {
      headers: {
        Accept: 'application/json, text/event-stream',
      },
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'browser-smoke', version: '1.0.0' },
        },
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer');
  });

  test('MCP OAuth discovery is public and fails closed when Clerk is unavailable', async ({ request }) => {
    const resource = await request.get('/.well-known/oauth-protected-resource/mcp');
    expect([200, 503]).toContain(resource.status());
    expect(resource.headers()['access-control-allow-origin']).toBe('*');
    const body = await resource.json() as Record<string, unknown>;
    if (resource.status() === 200) {
      expect(typeof body.resource).toBe('string');
      expect(Array.isArray(body.authorization_servers)).toBe(true);
    } else {
      expect(body).toEqual({ error: 'oauth_unavailable' });
    }

    const preflight = await request.fetch('/.well-known/oauth-protected-resource/mcp', {
      method: 'OPTIONS',
    });
    expect(preflight.status()).toBe(200);
    expect(preflight.headers()['access-control-allow-origin']).toBe('*');
  });

  test('home page renders the app shell', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/');
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Practice STEM concepts/i })).toBeVisible();

    await assertNoBrowserFailures();
  });

  test('free practice inserts one sponsored card after exactly five advances', async ({ page }) => {
    await page.goto('/practice');
    const skip = page.getByRole('button', { name: 'Skip this card' });
    await expect(skip).toBeVisible();
    await expect(page.getByRole('region', { name: 'Sponsored practice card' })).toHaveCount(0);

    for (let completed = 1; completed <= 4; completed += 1) {
      await skip.click();
      await expect(skip).toBeEnabled();
      await expect(page.getByRole('region', { name: 'Sponsored practice card' })).toHaveCount(0);
    }

    await skip.click();
    const sponsoredCard = page.getByRole('region', { name: 'Sponsored practice card' });
    await expect(sponsoredCard).toBeVisible();
    await expect(sponsoredCard).toContainText('After 5 cards');
    await sponsoredCard.getByRole('button', { name: 'Continue reviewing' }).click();
    await expect(skip).toBeVisible();
  });

  test('practice mode navigation identifies the active mode', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/practice?mode=review');

    const practiceMode = page.getByRole('navigation', { name: 'Practice mode' });
    await expect(practiceMode.getByRole('link', { name: /Review .*card.*needing review/i })).toHaveAttribute('aria-current', 'page');
    await expect(practiceMode.getByRole('link', { name: 'Learn New' })).not.toHaveAttribute('aria-current');

    await assertNoBrowserFailures();
  });

  test('practice answer control exposes its reveal state', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/practice');

    const revealButton = page.getByRole('button', { name: 'Show answer' });
    await expect(revealButton).toHaveAttribute('aria-expanded', 'false');
    await revealButton.click();

    const hideButton = page.getByRole('button', { name: 'Hide answer' });
    await expect(hideButton).toHaveAttribute('aria-expanded', 'true');
    await hideButton.click();
    await expect(page.getByRole('button', { name: 'Show answer' })).toHaveAttribute('aria-expanded', 'false');

    await assertNoBrowserFailures();
  });

  test('home respects reduced-motion preferences', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('.home-scroll-cue')).toHaveCSS('animation-iteration-count', '1');
    await assertNoBrowserFailures();
  });

  test('unknown routes provide a usable not-found recovery', async ({ page }) => {
    test.skip(
      usesDeployedPreview,
      'Not-found recovery is covered by the local Next.js browser suite.',
    );

    await page.goto('/this-route-does-not-exist');

    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return Home' })).toHaveAttribute('href', '/');
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

  test('personal knowledge exposes date controls and a trash view', async ({ page }) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);

    await page.goto('/my-knowledge');
    await expect(page.getByRole('heading', { name: 'My Knowledge' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Added date range' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Group cards by date' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Trash' })).toBeVisible();

    await page.getByRole('link', { name: 'Trash' }).click();
    await expect(page.getByRole('heading', { name: 'Knowledge Trash' })).toBeVisible();

    await assertNoBrowserFailures();
  });
});
