import assert from 'node:assert/strict';
import test from 'node:test';
import faultRouting from '../e2e-authenticated/authenticated-mcp-provider-setup-fault-routing.ts';

const {
  createExactMcpCreateQuiescenceTracker,
  isExactMcpCreateServerAction,
  retryExactMcpPatCleanupAfterCreate,
  targetsExactSettingsDocument,
} = faultRouting;

const SETTINGS_DOCUMENT = 'https://pr-192-girapphe-preview.example.workers.dev/en/settings#ai-connections';
const RUN_MARKER = 'authenticated-overlay-e2e:mcp-pat:00000000-0000-4000-8000-000000000000';

function request({
  method = 'POST',
  url = 'https://pr-192-girapphe-preview.example.workers.dev/en/settings',
  headers = { 'next-action': 'server-action-id' },
  postData = `label=PAT+${RUN_MARKER}`,
} = {}) {
  return {
    method: () => method,
    url: () => url,
    headers: () => headers,
    postData: () => postData,
  };
}

test('recognizes only the marker-bearing Settings create Server Action', () => {
  assert.equal(
    isExactMcpCreateServerAction(request(), SETTINGS_DOCUMENT, RUN_MARKER),
    true,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({
      url: 'https://pr-192-girapphe-preview.example.workers.dev/en/settings?_rsc=route',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    true,
  );
  assert.equal(
    targetsExactSettingsDocument(
      'https://pr-192-girapphe-preview.example.workers.dev/en/settings?_rsc=route',
      SETTINGS_DOCUMENT,
    ),
    true,
  );
});

test('does not arm the fault for Clerk or unrelated browser traffic', () => {
  assert.equal(
    isExactMcpCreateServerAction(request({
      url: 'https://example.clerk.accounts.dev/v1/client',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({ headers: {} }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({ method: 'GET', postData: null }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({
      url: 'https://pr-192-girapphe-preview.example.workers.dev/en/practice',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({
      postData: 'label=PAT+authenticated-overlay-e2e%3Amcp-pat%3Aother-run',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
});

test('retries exact cleanup after a timed-out step body commits a late PAT', async () => {
  const tracker = createExactMcpCreateQuiescenceTracker();
  let releaseBody;
  let releaseRequest;
  const bodyGate = new Promise((resolve) => {
    releaseBody = resolve;
  });
  const requestGate = new Promise((resolve) => {
    releaseRequest = resolve;
  });
  let rowState = 'absent';
  const body = tracker.trackCreateAction(async () => bodyGate);
  const request = tracker.trackExactRequest(async () => {
    await requestGate;
    rowState = 'active';
  });
  await assert.rejects(
    Promise.race([
      body,
      new Promise((_, reject) => setTimeout(() => reject(new Error('step timeout')), 5)),
    ]),
    /step timeout/,
  );

  const observedStates = [];
  const closeout = retryExactMcpPatCleanupAfterCreate({
    tracker,
    deadlineMs: Date.now() + 2_000,
    cleanup: async () => {
      observedStates.push(rowState);
      if (rowState === 'absent') throw new Error('SYNTHETIC_MCP_MARKER_CLEANUP_TARGET_NOT_OWNED');
      rowState = 'revoked';
      return { matched: 1, remainingActive: 0 };
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  releaseRequest();
  releaseBody();
  await body;
  await request;
  const result = await closeout;
  assert.equal(rowState, 'revoked');
  assert.ok(observedStates.includes('absent'));
  assert.equal(observedStates.at(-1), 'active');
  assert.ok(result.cleanupAttempts >= 2);
  assert.equal(result.exactRequestsStarted, 1);
  assert.equal(result.exactRequestsSucceeded, 1);
  assert.equal(result.exactRequestsFailed, 0);
  assert.equal(result.remainingActive, 0);
});

test('does not accept an absent sweep after failed Create transport', async () => {
  const tracker = createExactMcpCreateQuiescenceTracker();
  await tracker.trackCreateAction(async () => undefined);
  await assert.rejects(
    tracker.trackExactRequest(async () => {
      throw new Error('transport failed');
    }),
    /transport failed/,
  );
  await assert.rejects(
    retryExactMcpPatCleanupAfterCreate({
      tracker,
      deadlineMs: Date.now() + 150,
      cleanup: async () => ({ matched: 0, remainingActive: 0 }),
    }),
    /MCP_PAT_CREATE_CLEANUP_DEADLINE_EXCEEDED/,
  );
});

test('fails fast for non-retryable owner or marker errors', async () => {
  const tracker = createExactMcpCreateQuiescenceTracker();
  await tracker.trackCreateAction(async () => undefined);
  let attempts = 0;
  await assert.rejects(
    retryExactMcpPatCleanupAfterCreate({
      tracker,
      deadlineMs: Date.now() + 2_000,
      cleanup: async () => {
        attempts += 1;
        throw new Error('SYNTHETIC_MCP_MARKER_CLEANUP_MARKER_INVALID');
      },
    }),
    /SYNTHETIC_MCP_MARKER_CLEANUP_MARKER_INVALID/,
  );
  assert.equal(attempts, 1);
});

test('retries sanitized wrapper-level connection failures', async () => {
  const tracker = createExactMcpCreateQuiescenceTracker();
  await tracker.trackCreateAction(async () => undefined);
  await tracker.trackExactRequest(async () => undefined);
  let attempts = 0;
  const result = await retryExactMcpPatCleanupAfterCreate({
    tracker,
    deadlineMs: Date.now() + 2_000,
    cleanup: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('SYNTHETIC_MCP_MARKER_CLEANUP_FAILED:0123456789ab');
      }
      return { matched: 1, remainingActive: 0 };
    },
  });
  assert.equal(result.remainingActive, 0);
  assert.equal(attempts, 2);
});
