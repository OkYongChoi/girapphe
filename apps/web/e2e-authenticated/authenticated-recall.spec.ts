import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type Page, type Request, type Response } from './authenticated-test';
import pg from 'pg';

const { Pool } = pg;
const baseURL = new URL(process.env.PLAYWRIGHT_BASE_URL!);
const fixtureMetadataPath = resolve(
  process.cwd(),
  'playwright/.clerk/authenticated-overlay-fixture.json',
);
const evidenceDirectory = resolve(
  process.cwd(),
  'test-results/authenticated-overlay-performance/recall',
);
const localRecallSentinel =
  'Synthetic browser-only recall draft E2E; this sentence must never enter a Server Action.';
const actionStages = ['start', 'confidence', 'reveal', 'complete'] as const;

type RecallActionStage = (typeof actionStages)[number];

type RecallNetworkSample = {
  requestId: string;
  actionId: string;
  startedAtSeconds: number;
  responseAtSeconds: number | null;
  status: number | null;
  decodedBytes: number;
  transferredBytes: number;
};

type RecallFixtureMetadata = {
  userId: string;
  recall: { itemId: string } | null;
};

function readHeader(headers: Record<string, string>, name: string): string {
  const expected = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === expected)?.[1] ?? '';
}

function isSameOriginServerAction(request: Request): boolean {
  return request.method() === 'POST'
    && new URL(request.url()).origin === baseURL.origin
    && Boolean(request.headers()['next-action']);
}

function isSameOriginServerActionResponse(response: Response): boolean {
  return isSameOriginServerAction(response.request());
}

function installBrowserErrorGuards(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !/favicon\.ico/i.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

function readFixtureMetadata(): RecallFixtureMetadata {
  const value = JSON.parse(readFileSync(fixtureMetadataPath, 'utf8')) as Partial<RecallFixtureMetadata>;
  if (
    typeof value.userId !== 'string'
    || !value.userId
    || typeof value.recall?.itemId !== 'string'
    || !value.recall.itemId
  ) {
    throw new Error('Authenticated Recall fixture metadata is unavailable.');
  }
  return value as RecallFixtureMetadata;
}

test.skip(
  process.env.E2E_RECALL_ENABLED !== 'true',
  'Recall rendered evidence is enabled only for the allowlisted Preview synthetic owner.',
);

test('keeps approved Recall content private until reveal and persists one completion', async ({
  page,
}, testInfo) => {
  const {
    AUTHENTICATED_RECALL_FIXTURE,
    cleanupAuthenticatedRecallFixtureWithClient,
    fixtureIdsForUser,
    readAuthenticatedRecallFixtureStateWithClient,
    resetAuthenticatedRecallFixtureWithClient,
  } = await import('../scripts/authenticated-overlay-fixture.mjs');
  const fixtureMetadata = readFixtureMetadata();
  const expectedIds = fixtureIdsForUser(fixtureMetadata.userId);
  expect(fixtureMetadata.recall?.itemId).toBe(expectedIds.recall.itemId);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required for authenticated Recall evidence.');
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();

  try {
    const seededFixture = await resetAuthenticatedRecallFixtureWithClient(
      client,
      fixtureMetadata.userId,
    );
    expect(seededFixture.itemId).toBe(expectedIds.recall.itemId);
    expect(seededFixture.state.eligibleItemCount).toBe(1);
    expect(seededFixture.state.schedule.state).toBe('d1_pending');
    expect(seededFixture.state.attemptCount).toBe(0);

    const startedAt = Date.now();
    const browserErrors = installBrowserErrorGuards(page);
    const serverActionRequests: Request[] = [];
    const serverActionResponses: Response[] = [];
    const networkSamples = new Map<string, RecallNetworkSample>();
    const consumedNetworkRequestIds = new Set<string>();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');

    cdp.on('Network.requestWillBeSent', (event: {
      requestId: string;
      timestamp: number;
      request: { method: string; url: string; headers: Record<string, string> };
    }) => {
      const actionId = readHeader(event.request.headers, 'next-action');
      if (
        event.request.method !== 'POST'
        || new URL(event.request.url).origin !== baseURL.origin
        || !actionId
      ) return;
      networkSamples.set(event.requestId, {
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
      const sample = networkSamples.get(event.requestId);
      if (!sample) return;
      sample.responseAtSeconds = event.timestamp;
      sample.status = event.response.status;
    });
    cdp.on('Network.dataReceived', (event: {
      requestId: string;
      dataLength: number;
      encodedDataLength: number;
    }) => {
      const sample = networkSamples.get(event.requestId);
      if (!sample) return;
      sample.decodedBytes += event.dataLength;
      sample.transferredBytes += event.encodedDataLength;
    });

    page.on('request', (request) => {
      if (isSameOriginServerAction(request)) serverActionRequests.push(request);
    });
    page.on('response', (response) => {
      if (isSameOriginServerActionResponse(response)) serverActionResponses.push(response);
    });

    const routeStartedAt = performance.now();
    const routeResponse = await page.goto('/en/recall', { waitUntil: 'domcontentloaded' });
    expect(routeResponse?.status()).toBe(200);
    const routeHtmlBytes = Buffer.byteLength(await routeResponse!.body());
    await expect(page.getByRole('heading', { name: 'Recall Review', level: 1 })).toBeVisible();
    const routeReadyMs = Math.round((performance.now() - routeStartedAt) * 10) / 10;
    await page.waitForLoadState('load');
    await page.waitForTimeout(250);
    expect(serverActionRequests, 'Server Actions before an explicit Recall interaction').toHaveLength(0);
    expect(serverActionResponses).toHaveLength(0);

    await expect(page.getByRole('heading', { name: 'Choose an approved item' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New enrollment is paused' })).toHaveCount(0);
    await expect(page.getByText(AUTHENTICATED_RECALL_FIXTURE.centralQuestion, { exact: true }))
      .toBeVisible();
    expect(await page.content()).not.toContain(AUTHENTICATED_RECALL_FIXTURE.definition);
    expect(await page.content()).not.toContain(AUTHENTICATED_RECALL_FIXTURE.keyPoint);

    const actionMetrics: Array<{
      stage: RecallActionStage;
      status: number;
      responseHeadersMs: number;
      requestBytes: number;
      decodedBytesAtSettledUi: number;
      transferredBytesAtSettledUi: number | null;
    }> = [];

    async function performAction(
      stage: RecallActionStage,
      invoke: () => Promise<void>,
      expectSettledUi: () => Promise<void>,
    ): Promise<void> {
      const requestsBefore = serverActionRequests.length;
      const responsesBefore = serverActionResponses.length;
      const responsePromise = page.waitForResponse(isSameOriginServerActionResponse);
      await invoke();
      const response = await responsePromise;
      expect(response.status(), `${stage} Server Action status`).toBe(200);
      await expectSettledUi();
      await expect.poll(() => serverActionRequests.length).toBe(requestsBefore + 1);
      await expect.poll(() => serverActionResponses.length).toBe(responsesBefore + 1);

      const request = response.request();
      const requestBody = request.postData() ?? '';
      expect(requestBody).not.toContain(localRecallSentinel);
      expect(requestBody).not.toContain(encodeURIComponent(localRecallSentinel));
      const actionId = request.headers()['next-action'];
      expect(actionId).toBeTruthy();
      await expect.poll(
        () => [...networkSamples.values()].some((sample) => (
          sample.actionId === actionId
          && sample.responseAtSeconds !== null
          && !consumedNetworkRequestIds.has(sample.requestId)
        )),
        { message: `${stage} CDP response headers` },
      ).toBe(true);
      const sample = [...networkSamples.values()].find((candidate) => (
        candidate.actionId === actionId
        && candidate.responseAtSeconds !== null
        && !consumedNetworkRequestIds.has(candidate.requestId)
      ))!;
      consumedNetworkRequestIds.add(sample.requestId);
      await page.waitForTimeout(50);
      expect(sample.status).toBe(200);
      expect(sample.decodedBytes, `${stage} decoded response bytes`).toBeGreaterThan(0);
      actionMetrics.push({
        stage,
        status: response.status(),
        responseHeadersMs: Math.round(
          (sample.responseAtSeconds! - sample.startedAtSeconds) * 1_000 * 10,
        ) / 10,
        requestBytes: Buffer.byteLength(requestBody),
        decodedBytesAtSettledUi: sample.decodedBytes,
        transferredBytesAtSettledUi: sample.transferredBytes > 0
          ? sample.transferredBytes
          : null,
      });
    }

    await performAction(
      'start',
      () => page.getByRole('button', { name: 'Start recall' }).click(),
      async () => {
        await expect(page.getByRole('heading', {
          name: AUTHENTICATED_RECALL_FIXTURE.centralQuestion,
          level: 2,
        })).toBeVisible();
      },
    );

    const workspace = page.getByLabel('Your private recall workspace');
    const revealButton = page.getByRole('button', { name: 'Reveal approved version' });
    await expect(workspace).toBeVisible();
    await workspace.fill(localRecallSentinel);
    await expect(workspace).toHaveValue(localRecallSentinel);
    await expect(revealButton).toBeDisabled();
    expect(await page.content()).not.toContain(AUTHENTICATED_RECALL_FIXTURE.definition);
    expect(await page.content()).not.toContain(AUTHENTICATED_RECALL_FIXTURE.keyPoint);

    await performAction(
      'confidence',
      () => page.getByRole('button', { name: 'High confidence' }).click(),
      async () => {
        await expect(page.getByRole('button', { name: 'High confidence' }))
          .toHaveAttribute('aria-pressed', 'true');
        await expect(revealButton).toBeEnabled();
      },
    );
    const preRevealAnswerHidden = !(await page.content())
      .includes(AUTHENTICATED_RECALL_FIXTURE.definition);
    expect(preRevealAnswerHidden).toBe(true);
    const preRevealScreenshot = resolve(
      evidenceDirectory,
      `${testInfo.project.name}-pre-reveal.png`,
    );
    mkdirSync(evidenceDirectory, { recursive: true });
    await page.screenshot({ path: preRevealScreenshot, fullPage: true });

    await performAction(
      'reveal',
      () => revealButton.click(),
      async () => {
        await expect(page.getByRole('heading', { name: 'Approved version' })).toBeVisible();
        await expect(page.getByText(AUTHENTICATED_RECALL_FIXTURE.definition, { exact: true }))
          .toBeVisible();
        await expect(page.getByText(AUTHENTICATED_RECALL_FIXTURE.keyPoint, { exact: true }))
          .toBeVisible();
        await expect(page.getByText(localRecallSentinel, { exact: true })).toBeVisible();
      },
    );
    const postRevealAnswerVisible = (await page.content())
      .includes(AUTHENTICATED_RECALL_FIXTURE.definition);
    expect(postRevealAnswerVisible).toBe(true);
    const postRevealScreenshot = resolve(
      evidenceDirectory,
      `${testInfo.project.name}-post-reveal.png`,
    );
    await page.screenshot({ path: postRevealScreenshot, fullPage: true });

    await performAction(
      'complete',
      () => page.getByRole('button', { name: 'Remembered', exact: true }).click(),
      async () => {
        await expect(page.getByRole('heading', { name: 'Review complete' })).toBeVisible();
      },
    );
    const completionVisible = await page.getByRole('heading', { name: 'Review complete' })
      .isVisible();
    expect(completionVisible).toBe(true);

    const persisted = await readAuthenticatedRecallFixtureStateWithClient(
      client,
      fixtureMetadata.userId,
    );
    expect(persisted).not.toBeNull();
    expect(persisted!.attemptCount).toBe(1);
    expect(persisted!.attempt).toEqual({
      lifecycleState: 'completed',
      confidence: 'high',
      outcome: 'remembered',
      hintUsed: false,
      resultingDueAt: persisted!.schedule.dueAt,
    });
    expect(persisted!.schedule).toMatchObject({
      status: 'known',
      knowledgeState: 'known',
      progressState: 'review',
      itemVersion: 1,
      state: 'd7_pending',
      d1FinalizedIncomplete: false,
      d7Outcome: null,
      version: 2,
    });
    expect(persisted!.schedule.lastSeen).not.toBeNull();

    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(250);
    expect(browserErrors).toEqual([]);
    expect(actionMetrics.map((metric) => metric.stage)).toEqual(actionStages);
    expect(actionMetrics.map((metric) => metric.status)).toEqual([200, 200, 200, 200]);
    expect(serverActionRequests).toHaveLength(4);
    expect(serverActionResponses).toHaveLength(4);
    const localDraftAbsentFromActions = serverActionRequests.every(
      (request) => !(request.postData() ?? '').includes(localRecallSentinel),
    );
    expect(localDraftAbsentFromActions).toBe(true);

    const completionScreenshot = resolve(
      evidenceDirectory,
      `${testInfo.project.name}-completed.png`,
    );
    await page.screenshot({ path: completionScreenshot, fullPage: true });
    const transferredValues = actionMetrics
      .map((metric) => metric.transferredBytesAtSettledUi)
      .filter((value): value is number => value !== null);
    const metrics = {
      schemaVersion: 1,
      route: '/en/recall',
      project: testInfo.project.name,
      syntheticOwnerAllowlisted: true,
      rendered: {
        privateQuestionVisible: true,
        preRevealAnswerHidden,
        localDraftAbsentFromActions,
        localDraftVisibleAfterReveal: true,
        postRevealAnswerVisible,
        completionVisible,
      },
      routeStatus: routeResponse!.status(),
      routeReadyMs,
      routeHtmlBytes,
      serverActionRequestCount: serverActionRequests.length,
      actionFlow: actionMetrics,
      actionResponseHeadersTotalMs: Math.round(
        actionMetrics.reduce((total, metric) => total + metric.responseHeadersMs, 0) * 10,
      ) / 10,
      actionDecodedBytesTotal: actionMetrics.reduce(
        (total, metric) => total + metric.decodedBytesAtSettledUi,
        0,
      ),
      actionTransferredBytesTotal: transferredValues.length === actionMetrics.length
        ? transferredValues.reduce((total, value) => total + value, 0)
        : null,
      persisted: {
        attemptCount: persisted!.attemptCount,
        attemptLifecycleState: persisted!.attempt?.lifecycleState,
        confidence: persisted!.attempt?.confidence,
        outcome: persisted!.attempt?.outcome,
        hintUsed: persisted!.attempt?.hintUsed,
        scheduleState: persisted!.schedule.state,
        scheduleVersion: persisted!.schedule.version,
        practiceStatus: persisted!.schedule.status,
        dueMatchesAttempt: persisted!.schedule.dueAt === persisted!.attempt?.resultingDueAt,
      },
      browserErrorCount: browserErrors.length,
      durationMs: Date.now() - startedAt,
      screenshots: [
        `${testInfo.project.name}-pre-reveal.png`,
        `${testInfo.project.name}-post-reveal.png`,
        `${testInfo.project.name}-completed.png`,
      ],
    };
    const metricsPath = resolve(evidenceDirectory, `${testInfo.project.name}.json`);
    writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
    for (const [name, filePath] of [
      ['authenticated-recall-pre-reveal', preRevealScreenshot],
      ['authenticated-recall-post-reveal', postRevealScreenshot],
      ['authenticated-recall-completed', completionScreenshot],
      ['authenticated-recall-metrics', metricsPath],
    ] as const) {
      await testInfo.attach(name, {
        path: filePath,
        contentType: filePath.endsWith('.json') ? 'application/json' : 'image/png',
      });
    }
  } finally {
    try {
      await cleanupAuthenticatedRecallFixtureWithClient(client, fixtureMetadata.userId);
    } finally {
      client.release();
      await pool.end();
    }
  }
});
