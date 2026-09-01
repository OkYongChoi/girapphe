import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page, type Request } from '@playwright/test';
import { isNoArgumentServerActionBody } from '../scripts/authenticated-overlay-network.mjs';

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

function readHeader(headers: Record<string, string>, name: string) {
  const expected = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === expected)?.[1] ?? '';
}

type OverlayNetworkSample = {
  requestId: string;
  actionId: string;
  startedAtSeconds: number;
  responseAtSeconds: number | null;
  status: number | null;
  decodedBytes: number;
  transferredBytes: number;
};

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
    const overlayNetworkSamples = new Map<string, OverlayNetworkSample>();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');

    cdp.on('Network.requestWillBeSent', (event: {
      requestId: string;
      timestamp: number;
      request: { method: string; url: string; headers: Record<string, string>; postData?: string };
    }) => {
      const actionId = readHeader(event.request.headers, 'next-action');
      if (
        event.request.method !== 'POST'
        || new URL(event.request.url).origin !== baseURL.origin
        || !actionId
        || !isNoArgumentServerActionBody(event.request.postData)
      ) return;
      overlayNetworkSamples.set(event.requestId, {
        requestId: event.requestId,
        actionId,
        startedAtSeconds: event.timestamp,
        responseAtSeconds: null,
        status: null,
        decodedBytes: 0,
        transferredBytes: 0,
      });
    });
    cdp.on('Network.responseReceived', (event: {
      requestId: string;
      timestamp: number;
      response: { status: number };
    }) => {
      const sample = overlayNetworkSamples.get(event.requestId);
      if (!sample) return;
      sample.responseAtSeconds = event.timestamp;
      sample.status = event.response.status;
    });
    cdp.on('Network.dataReceived', (event: {
      requestId: string;
      dataLength: number;
      encodedDataLength: number;
    }) => {
      const sample = overlayNetworkSamples.get(event.requestId);
      if (!sample) return;
      sample.decodedBytes += event.dataLength;
      sample.transferredBytes += event.encodedDataLength;
    });

    page.on('request', (request) => {
      if (isSameOriginServerAction(request)) {
        serverActionRequests.push(request);
      }
    });

    await page.goto('/grid', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Concepts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out of your account' })).toBeVisible();
    const graphButton = page.getByRole('button', { name: '3D Graph View' });
    await expect(graphButton).toBeVisible();
    await page.waitForLoadState('load');
    await page.waitForTimeout(PRE_CLICK_IDLE_OBSERVATION_MS);
    expect(serverActionRequests, 'Server Action requests sent before Graph click').toHaveLength(0);

    const clickStartedAt = performance.now();
    await graphButton.evaluate((button: HTMLButtonElement) => button.click());
    await expect(page).toHaveURL(/\/grid(?:[?#]|$)/);

    const graph = page.getByTestId('knowledge-graph-canvas');
    await expect(graph).toBeVisible();
    await expect(graph.locator('canvas').first()).toBeVisible();
    const canvasVisibleAt = performance.now();

    await expect.poll(
      () => overlayNetworkSamples.size,
      { message: 'exactly one no-argument overlay request after Graph click' },
    ).toBe(1);
    const overlaySample = [...overlayNetworkSamples.values()][0];
    await expect.poll(
      () => overlaySample.status,
      { message: 'overlay response status' },
    ).toBe(200);
    expect(overlaySample.responseAtSeconds, 'overlay response headers received').not.toBeNull();
    const overlayDecodedBytesAtCanvas = overlaySample.decodedBytes;
    const overlayTransferredBytesAtCanvas = overlaySample.transferredBytes;
    expect(overlayDecodedBytesAtCanvas, 'overlay decoded bytes received by canvas display').toBeGreaterThan(0);

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

    await assertNoBrowserFailures();
    expect(
      serverActionRequests.filter(
        (request) => request.headers()['next-action'] === overlaySample.actionId,
      ),
      'exactly one overlay request after Graph click',
    ).toHaveLength(1);

    const overlayResponseAtSeconds = overlaySample.responseAtSeconds!;
    const metrics = {
      project: testInfo.project.name,
      run,
      preClickIdleObservationMs: PRE_CLICK_IDLE_OBSERVATION_MS,
      clickToCanvasMs: Math.round((canvasVisibleAt - clickStartedAt) * 10) / 10,
      overlayResponseHeadersMs: Math.round(
        (overlayResponseAtSeconds - overlaySample.startedAtSeconds) * 1_000 * 10,
      ) / 10,
      overlayDecodedBytesAtCanvas,
      overlayTransferredBytesAtCanvas: overlayTransferredBytesAtCanvas > 0
        ? overlayTransferredBytesAtCanvas
        : null,
      overlayStatus: overlaySample.status,
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
