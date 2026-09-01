import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type Request, type Response } from '@playwright/test';

const toleratedConsoleErrors = [/favicon\.ico/i];
const AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX = 'Girapphe authenticated overlay fixture';
const PRE_CLICK_IDLE_OBSERVATION_MS = 3_000;
const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL!);
const runCount = Math.min(10, Math.max(1, Number.parseInt(process.env.PLAYWRIGHT_RUNS ?? '3', 10) || 3));

function isSameOriginServerAction(request: Request) {
  return request.method() === 'POST'
    && new URL(request.url()).origin === baseURL.origin
    && Boolean(request.headers()['next-action']);
}

async function responseContainsFixture(response: Response) {
  if (!isSameOriginServerAction(response.request())) return false;
  try {
    return (await response.body()).toString('utf8').includes(AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX);
  } catch {
    return false;
  }
}

function attachBrowserFailureGuards(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!toleratedConsoleErrors.some((pattern) => pattern.test(text))) consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  return async () => {
    await page.waitForTimeout(250);
    expect(pageErrors, 'uncaught browser page errors').toEqual([]);
    expect(consoleErrors, 'browser console errors').toEqual([]);
  };
}

for (let run = 1; run <= runCount; run += 1) {
  test(`authenticated overlay measurement ${run} of ${runCount}`, async ({ page }, testInfo) => {
    const assertNoBrowserFailures = attachBrowserFailureGuards(page);
    const serverActionRequests: Request[] = [];
    const serverActionResponses: Response[] = [];
    const serverActionStartedAt = new WeakMap<Request, number>();

    page.on('request', (request) => {
      if (isSameOriginServerAction(request)) {
        serverActionRequests.push(request);
        serverActionStartedAt.set(request, performance.now());
      }
    });
    page.on('response', (response) => {
      if (isSameOriginServerAction(response.request())) serverActionResponses.push(response);
    });

    await page.goto('/grid', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Concepts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out of your account' })).toBeVisible();
    const graphButton = page.getByRole('button', { name: '3D Graph View' });
    await expect(graphButton).toBeVisible();
    await page.waitForLoadState('load');
    await page.waitForTimeout(PRE_CLICK_IDLE_OBSERVATION_MS);
    expect(serverActionRequests, 'Server Action requests sent before Graph click').toHaveLength(0);

    const overlayResponsePromise = page.waitForResponse(responseContainsFixture, { timeout: 30_000 });
    const clickStartedAt = performance.now();
    await graphButton.click();

    const graph = page.getByTestId('knowledge-graph-canvas');
    await expect(graph).toBeVisible();
    await expect(graph.locator('canvas').first()).toBeVisible();
    const canvasVisibleAt = performance.now();

    const overlayResponse = await overlayResponsePromise;
    await overlayResponse.finished();
    const overlayFinishedAt = performance.now();
    expect(overlayResponse.status(), 'overlay response status').toBe(200);
    const overlayActionId = overlayResponse.request().headers()['next-action'];
    expect(overlayActionId, 'overlay Server Action identifier').toBeTruthy();
    const overlayBody = await overlayResponse.body();
    expect(overlayBody.byteLength, 'overlay response body bytes').toBeGreaterThan(0);

    const graphSearch = page.getByTestId('graph-controls').locator('input[type="search"]');
    await graphSearch.fill(AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX);
    await expect.poll(
      async () => Number(await graph.getAttribute('data-visible-private-node-count')),
      { message: 'fixture private nodes reach the final canvas input' },
    ).toBeGreaterThanOrEqual(2);
    await expect.poll(
      async () => Number(await graph.getAttribute('data-visible-private-edge-count')),
      { message: 'fixture private edge reaches the final canvas input' },
    ).toBeGreaterThanOrEqual(1);

    const actionBodies = await Promise.all(serverActionResponses.map(async (response) => {
      await response.finished();
      try {
        return (await response.body()).toString('utf8');
      } catch {
        return '';
      }
    }));
    expect(
      actionBodies.filter((body) => body.includes(AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX)),
      'exactly one overlay response after Graph click',
    ).toHaveLength(1);
    await assertNoBrowserFailures();
    expect(
      serverActionRequests.filter(
        (request) => request.headers()['next-action'] === overlayActionId,
      ),
      'exactly one overlay request after Graph click',
    ).toHaveLength(1);

    let transferredBodyBytes: number | null = null;
    try {
      transferredBodyBytes = (await overlayResponse.request().sizes()).responseBodySize;
    } catch {
      // The decoded response body remains the portable size measurement.
    }
    const overlayStartedAt = serverActionStartedAt.get(overlayResponse.request()) ?? clickStartedAt;
    const metrics = {
      project: testInfo.project.name,
      run,
      preClickIdleObservationMs: PRE_CLICK_IDLE_OBSERVATION_MS,
      clickToCanvasMs: Math.round((canvasVisibleAt - clickStartedAt) * 10) / 10,
      overlayDurationMs: Math.round((overlayFinishedAt - overlayStartedAt) * 10) / 10,
      overlayBodyBytes: overlayBody.byteLength,
      overlayTransferredBodyBytes: transferredBodyBytes,
      overlayStatus: overlayResponse.status(),
      serverActionRequestCount: serverActionRequests.length,
      visiblePrivateNodes: Number(await graph.getAttribute('data-visible-private-node-count')),
      visiblePrivateEdges: Number(await graph.getAttribute('data-visible-private-edge-count')),
    };

    const metricsDirectory = path.resolve('test-results/authenticated-overlay-performance/metrics');
    await fs.mkdir(metricsDirectory, { recursive: true });
    await fs.writeFile(
      path.join(metricsDirectory, `${testInfo.project.name}-run-${run}.json`),
      `${JSON.stringify(metrics, null, 2)}\n`,
      'utf8',
    );
    await testInfo.attach('authenticated-overlay-metrics', {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: 'application/json',
    });
  });
}
