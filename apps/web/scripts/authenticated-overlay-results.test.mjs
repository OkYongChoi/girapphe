import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertRequiredMcpPatCloseoutEvidence,
  buildAuthenticatedMcpProviderSummary,
  buildAuthenticatedMobileApiSummary,
  buildAuthenticatedOverlaySummary,
  buildAuthenticatedRecallSummary,
  buildAuthenticatedThinkingHistorySummary,
  renderAuthenticatedMcpProviderSummary,
  renderAuthenticatedMobileApiSummary,
  renderAuthenticatedOverlaySummary,
  renderAuthenticatedRecallSummary,
  renderAuthenticatedThinkingHistorySummary,
  summarizeAuthenticatedOverlayResults,
} from './summarize-authenticated-overlay-results.mjs';

const MOBILE_API_EVIDENCE = {
  schemaVersion: 1,
  project: 'authenticated-mobile',
  privateNoStoreReads: 12,
  noteLifecycle: true,
  topicsAndHub: true,
  rankingAnonymous: true,
  practiceNewAndReview: true,
  candidateApproveIgnoreAndStale: true,
  cleanup: true,
};

const successfulMcpNormalMetric = {
  artifactName: 'authenticated-desktop.json',
  schemaVersion: 1,
  evidenceKind: 'normal_ui_revocation',
  project: 'authenticated-desktop',
  createdOneTimePat: true,
  copiedWithoutRawPat: true,
  revokedBeforeScreenshot: true,
  revokedHiddenByDefault: true,
  clearedOneTimePatImmediatelyOnRevoke: true,
  remainingActiveAfterUiRevoke: 0,
  deletedPermanentlyBeforeScreenshot: true,
  absentAfterDeleteReload: true,
  clipboardEmptyAfterTest: true,
  browserErrorCount: 0,
  pageOverflow: false,
};

const successfulMcpRouteFaultMetric = {
  artifactName: 'authenticated-desktop-route-fault.json',
  schemaVersion: 1,
  evidenceKind: 'route_fault_fallback',
  project: 'authenticated-desktop',
  postResponseCaptured: true,
  postResponseRedacted: true,
  routeFaultedRequestCount: 2,
  uiCleanupFailureCount: 2,
  databaseFallbackRan: true,
  remainingActiveAfterFallback: 0,
  originalSentinelIdentityPreserved: true,
  clipboardEmptyAfterTest: true,
};

const successfulMcpReadOnlyMetric = {
  artifactName: 'authenticated-desktop-ar.json',
  schemaVersion: 1,
  evidenceKind: 'read_only_provider',
  project: 'authenticated-desktop',
  rtlLayout: true,
  ltrCodeBlock: true,
  keyboardProviderSwitch: true,
  copiedWithoutRawPat: true,
  clipboardEmptyAfterTest: true,
  browserErrorCount: 0,
  pageOverflow: false,
};

test('authenticated overlay summary reports median and worst values per device', () => {
  const metrics = [100, 300, 200].flatMap((clickToCanvasMs, index) => ([
    {
      project: 'authenticated-desktop',
      run: index + 1,
      clickToCanvasMs,
      overlayResponseHeadersMs: clickToCanvasMs / 2,
      overlayDecodedBytesAtCanvas: 1_024 + index * 1_024,
      overlayTransferredBytesAtCanvas: 512 + index * 512,
      overlayStatus: 200,
    },
    {
      project: 'authenticated-mobile',
      run: index + 1,
      clickToCanvasMs: clickToCanvasMs + 50,
      overlayResponseHeadersMs: clickToCanvasMs / 2 + 25,
      overlayDecodedBytesAtCanvas: 1_024 + index * 1_024,
      overlayTransferredBytesAtCanvas: null,
      overlayStatus: 200,
    },
  ]));

  const summary = buildAuthenticatedOverlaySummary(metrics, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(summary.projects['authenticated-desktop'].clickToCanvasMs, {
    median: 200,
    worst: 300,
  });
  assert.deepEqual(summary.projects['authenticated-mobile'].overlayResponseHeadersMs, {
    median: 125,
    worst: 175,
  });
  assert.equal(summary.projects['authenticated-desktop'].overlayDecodedBytesAtCanvas.median, 2_048);
  assert.equal(summary.projects['authenticated-mobile'].overlayTransferredBytesAtCanvas, null);

  const markdown = renderAuthenticatedOverlaySummary(summary);
  assert.match(markdown, /authenticated-desktop \| 3 \| 200 ms \/ 300 ms/);
  assert.match(markdown, /2 KiB \/ 3 KiB/);
  assert.match(markdown, /streaming RSC responses/i);
  assert.match(markdown, /synthetic Playwright measurements/i);
});

test('authenticated summary reports private Thinking History evidence separately', () => {
  const summary = buildAuthenticatedThinkingHistorySummary([
    {
      project: 'authenticated-desktop',
      syntheticPrivateEvidenceCount: 2,
      messageAsset: { requests: 1, status: 200, bytes: 2_048 },
      signalOperations: ['viewed', 'evidence_opened', 'dismissed'],
      contextFormats: ['json', 'json', 'yaml', 'yaml', 'markdown', 'markdown'],
      contextApiStatuses: [200, 200, 200, 200, 200, 200],
      contextRequestsBeforeIntent: 0,
      contextBytes: 4_096,
      importEvidence: {
        selectedCount: 2,
        preConsentPostCount: 0,
        preConsentImportEventRows: 0,
        preSubmitImportEventRows: 0,
        postConsentImportEventNames: [
          'conversation_import_candidates_ready',
          'conversation_import_confirmed',
          'conversation_import_parsed',
          'conversation_import_started',
        ],
        unselectedContentSent: false,
        archiveFilenameSent: false,
        pendingCandidatesBeforeReview: 2,
        preApprovalPublishedStateUnchanged: true,
        preApprovalActivationRows: 0,
        batchDeleted: true,
      },
      browserErrorCount: 0,
      durationMs: 750,
    },
    {
      project: 'authenticated-mobile',
      syntheticPrivateEvidenceCount: 2,
      messageAsset: { requests: 1, status: 200, bytes: 2_048 },
      signalOperations: ['viewed', 'evidence_opened', 'dismissed'],
      contextFormats: ['json', 'json', 'yaml', 'yaml', 'markdown', 'markdown'],
      contextApiStatuses: [200, 200, 200, 200, 200, 200],
      contextRequestsBeforeIntent: 0,
      contextBytes: 4_096,
      importEvidence: {
        selectedCount: 2,
        preConsentPostCount: 0,
        preConsentImportEventRows: 0,
        preSubmitImportEventRows: 0,
        postConsentImportEventNames: [
          'conversation_import_candidates_ready',
          'conversation_import_confirmed',
          'conversation_import_parsed',
          'conversation_import_started',
        ],
        unselectedContentSent: false,
        archiveFilenameSent: false,
        pendingCandidatesBeforeReview: 2,
        preApprovalPublishedStateUnchanged: true,
        preApprovalActivationRows: 0,
        batchDeleted: true,
      },
      browserErrorCount: 0,
      durationMs: 900,
    },
  ]);

  assert.equal(summary.projects['authenticated-desktop'].privateEvidenceMinimum, 2);
  assert.equal(summary.projects['authenticated-mobile'].contextRequestsBeforeIntentWorst, 0);
  assert.deepEqual(summary.projects['authenticated-mobile'].contextFlows, [
    '200 -> 200 -> 200 -> 200 -> 200 -> 200',
  ]);
  assert.deepEqual(summary.projects['authenticated-mobile'].signalOperations, [
    'dismissed',
    'evidence_opened',
    'viewed',
  ]);
  assert.deepEqual(summary.projects['authenticated-mobile'].contextFormats, [
    'json',
    'markdown',
    'yaml',
  ]);
  assert.equal(summary.projects['authenticated-mobile'].importCloseoutPassed, true);
  const markdown = renderAuthenticatedThinkingHistorySummary(summary);
  assert.match(markdown, /authenticated-desktop \| 1 \| 1 \/ 1; 200/);
  assert.match(markdown, /json, markdown, yaml/);
  assert.match(markdown, /passed/);
  assert.match(markdown, /4 KiB \/ 4 KiB/);
  assert.match(markdown, /production user telemetry/i);

  const gated = renderAuthenticatedThinkingHistorySummary(null);
  assert.match(gated, /production evidence remains separately gated/i);
});

test('authenticated summary reports deployed mobile API closeout separately', () => {
  const summary = buildAuthenticatedMobileApiSummary([MOBILE_API_EVIDENCE]);
  assert.equal(summary.projects['authenticated-mobile'].privateNoStoreReadsMinimum, 12);
  assert.equal(summary.projects['authenticated-mobile'].closeoutPassed, true);
  assert.equal(summary.projects['authenticated-mobile'].gates.cleanup, true);

  const markdown = renderAuthenticatedMobileApiSummary(summary);
  assert.match(markdown, /Mobile API deployed path/);
  assert.match(markdown, /authenticated-mobile \| 1 \| 12/);
  assert.match(markdown, /physical-device, accessibility, signed-binary, or store-release/i);

  const failed = buildAuthenticatedMobileApiSummary([{
    ...MOBILE_API_EVIDENCE,
    cleanup: false,
  }]);
  assert.equal(failed.projects['authenticated-mobile'].closeoutPassed, false);
  assert.match(renderAuthenticatedMobileApiSummary(failed), /failed/);
});

test('authenticated result loader persists mobile-only failure evidence', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'girapphe-auth-mobile-summary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'mobile-api'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'mobile-api', 'authenticated-mobile.json'),
    JSON.stringify({ ...MOBILE_API_EVIDENCE, noteLifecycle: false }),
  );

  const { summary, markdown } = await summarizeAuthenticatedOverlayResults(root);
  assert.deepEqual(summary.projects, {});
  assert.equal(summary.mobileApi.projects['authenticated-mobile'].closeoutPassed, false);
  assert.match(markdown, /No overlay metrics completed for this run/);
  assert.match(markdown, /authenticated-mobile[\s\S]*failed/);
  assert.equal(await fs.readFile(path.join(root, 'summary.md'), 'utf8'), markdown);
});

test('authenticated summary reports only safe MCP PAT counts and booleans', () => {
  const summary = buildAuthenticatedMcpProviderSummary([
    successfulMcpNormalMetric,
    successfulMcpRouteFaultMetric,
    successfulMcpReadOnlyMetric,
  ]);
  assert.deepEqual(summary, {
    patMutationRuns: 2,
    readOnlyRuns: 1,
    normalUiRevocationPassed: true,
    routeFaultFallbackPassed: true,
    readOnlyProviderChecksPassed: true,
  });
  const markdown = renderAuthenticatedMcpProviderSummary(summary);
  assert.match(markdown, /MCP provider PAT closeout/);
  assert.match(markdown, /\| 2 \| 1 \| passed \| passed \| passed \|/);
  assert.match(markdown, /counts and pass\/fail booleans/);
  assert.doesNotMatch(markdown, /girapphe_mcp_|authenticated-overlay-e2e:mcp-pat/);
});

test('required Preview MCP PAT closeout rejects missing mutation artifacts', () => {
  const cases = [
    ['no provider artifacts', []],
    ['read-only only', [successfulMcpReadOnlyMetric]],
    ['normal mutation only', [successfulMcpNormalMetric]],
    ['route-fault mutation only', [successfulMcpRouteFaultMetric]],
  ];

  for (const [name, metrics] of cases) {
    const summary = metrics.length > 0 ? buildAuthenticatedMcpProviderSummary(metrics) : null;
    assert.throws(
      () => assertRequiredMcpPatCloseoutEvidence(metrics, summary),
      /Required Preview MCP PAT closeout evidence is incomplete/,
      name,
    );
  }

  const completeMetrics = [successfulMcpNormalMetric, successfulMcpRouteFaultMetric];
  assert.doesNotThrow(() => assertRequiredMcpPatCloseoutEvidence(
    completeMetrics,
    buildAuthenticatedMcpProviderSummary(completeMetrics),
  ));
});

test('required Preview MCP PAT closeout rejects ambiguous or malformed evidence', () => {
  const corruptedNormalMetrics = [
    { ...successfulMcpNormalMetric, schemaVersion: 99 },
    { ...successfulMcpNormalMetric, artifactName: 'unexpected.json' },
    { ...successfulMcpNormalMetric, evidenceKind: 'route_fault_fallback' },
    { ...successfulMcpNormalMetric, project: 'authenticated-mobile' },
    { ...successfulMcpNormalMetric, clearedOneTimePatImmediatelyOnRevoke: false },
    { ...successfulMcpNormalMetric, deletedPermanentlyBeforeScreenshot: false },
    { ...successfulMcpNormalMetric, absentAfterDeleteReload: false },
    {
      ...successfulMcpNormalMetric,
      databaseFallbackRan: true,
      remainingActiveAfterFallback: 0,
    },
  ];

  for (const corruptedNormal of corruptedNormalMetrics) {
    const metrics = [corruptedNormal, successfulMcpRouteFaultMetric];
    assert.throws(
      () => assertRequiredMcpPatCloseoutEvidence(
        metrics,
        buildAuthenticatedMcpProviderSummary(metrics),
      ),
      /Required Preview MCP PAT closeout evidence is incomplete/,
    );
  }

  const fallbackNotRunMetrics = [
    successfulMcpNormalMetric,
    { ...successfulMcpRouteFaultMetric, databaseFallbackRan: false },
  ];
  assert.throws(
    () => assertRequiredMcpPatCloseoutEvidence(
      fallbackNotRunMetrics,
      buildAuthenticatedMcpProviderSummary(fallbackNotRunMetrics),
    ),
    /Required Preview MCP PAT closeout evidence is incomplete/,
  );

  const dualShapedArtifact = {
    ...successfulMcpNormalMetric,
    ...successfulMcpRouteFaultMetric,
    artifactName: 'authenticated-desktop.json',
    evidenceKind: 'normal_ui_revocation',
  };
  assert.throws(
    () => assertRequiredMcpPatCloseoutEvidence(
      [dualShapedArtifact],
      buildAuthenticatedMcpProviderSummary([dualShapedArtifact]),
    ),
    /Required Preview MCP PAT closeout evidence is incomplete/,
  );
});

test('authenticated result loader fails closed when Preview PAT artifacts are absent', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'girapphe-auth-mcp-required-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'metrics'), { recursive: true });
  await fs.writeFile(path.join(root, 'metrics', 'desktop-1.json'), JSON.stringify({
    project: 'authenticated-desktop',
    clickToCanvasMs: 200,
    overlayResponseHeadersMs: 100,
    overlayDecodedBytesAtCanvas: 2_048,
    overlayTransferredBytesAtCanvas: 1_024,
    overlayStatus: 200,
  }));

  await assert.rejects(
    summarizeAuthenticatedOverlayResults(root, { requireMcpPatCloseout: true }),
    /Required Preview MCP PAT closeout evidence is incomplete/,
  );

  const providerDirectory = path.join(root, 'mcp-provider-setup');
  await fs.mkdir(providerDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(
      path.join(providerDirectory, 'authenticated-desktop.json'),
      JSON.stringify(successfulMcpNormalMetric),
    ),
    fs.writeFile(
      path.join(providerDirectory, 'authenticated-desktop-route-fault.json'),
      JSON.stringify(successfulMcpRouteFaultMetric),
    ),
  ]);
  await assert.doesNotReject(
    summarizeAuthenticatedOverlayResults(root, { requireMcpPatCloseout: true }),
  );
});

test('authenticated summary links Recall render, action, database, and browser evidence', () => {
  const metric = (project, routeReadyMs) => ({
    project,
    syntheticOwnerAllowlisted: true,
    rendered: {
      privateQuestionVisible: true,
      preRevealAnswerHidden: true,
      localDraftAbsentFromActions: true,
      localDraftVisibleAfterReveal: true,
      postRevealAnswerVisible: true,
      completionVisible: true,
    },
    routeStatus: 200,
    routeReadyMs,
    routeHtmlBytes: 4_096,
    serverActionRequestCount: 4,
    actionFlow: [
      { stage: 'start', status: 200 },
      { stage: 'confidence', status: 200 },
      { stage: 'reveal', status: 200 },
      { stage: 'complete', status: 200 },
    ],
    actionResponseHeadersTotalMs: 400,
    actionDecodedBytesTotal: 8_192,
    actionTransferredBytesTotal: 4_096,
    persisted: {
      attemptCount: 1,
      attemptLifecycleState: 'completed',
      confidence: 'high',
      outcome: 'remembered',
      hintUsed: false,
      scheduleState: 'd7_pending',
      scheduleVersion: 2,
      practiceStatus: 'known',
      dueMatchesAttempt: true,
    },
    browserErrorCount: 0,
    durationMs: routeReadyMs + 1_000,
    screenshots: ['pre.png', 'post.png', 'complete.png'],
  });
  const summary = buildAuthenticatedRecallSummary([
    metric('authenticated-desktop', 700),
    metric('authenticated-mobile', 900),
  ]);

  assert.equal(summary.projects['authenticated-desktop'].preRevealAnswerHiddenEveryRun, true);
  assert.equal(summary.projects['authenticated-desktop'].localDraftAbsentFromActionsEveryRun, true);
  assert.equal(summary.projects['authenticated-mobile'].completedDbStateEveryRun, true);
  assert.deepEqual(summary.projects['authenticated-desktop'].serverActionRequests, {
    median: 4,
    worst: 4,
  });
  assert.deepEqual(summary.projects['authenticated-desktop'].actionFlows, [
    'start:200 -> confidence:200 -> reveal:200 -> complete:200',
  ]);
  const markdown = renderAuthenticatedRecallSummary(summary);
  assert.match(markdown, /hidden -> revealed -> complete/);
  assert.match(markdown, /start:200 -> confidence:200 -> reveal:200 -> complete:200/);
  assert.match(markdown, /completed; D\+7; due matched/);
  assert.match(markdown, /owner-and-ID-scoped Preview evidence/);

  const gated = renderAuthenticatedRecallSummary(null);
  assert.match(gated, /production-default-off/);
  assert.match(gated, /allowlisted Preview synthetic owner/);
});

test('authenticated result loader merges private-path metrics into persisted summaries', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'girapphe-auth-summary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await Promise.all([
    fs.mkdir(path.join(root, 'metrics'), { recursive: true }),
    fs.mkdir(path.join(root, 'thinking-history'), { recursive: true }),
    fs.mkdir(path.join(root, 'mobile-api'), { recursive: true }),
    fs.mkdir(path.join(root, 'mcp-provider-setup'), { recursive: true }),
    fs.mkdir(path.join(root, 'recall'), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(root, 'metrics', 'desktop-1.json'), JSON.stringify({
      project: 'authenticated-desktop',
      clickToCanvasMs: 200,
      overlayResponseHeadersMs: 100,
      overlayDecodedBytesAtCanvas: 2_048,
      overlayTransferredBytesAtCanvas: 1_024,
      overlayStatus: 200,
    })),
    fs.writeFile(path.join(root, 'thinking-history', 'authenticated-desktop.json'), JSON.stringify({
      project: 'authenticated-desktop',
      syntheticPrivateEvidenceCount: 2,
      messageAsset: { requests: 1, status: 200, bytes: 2_048 },
      signalOperations: ['viewed', 'evidence_opened', 'dismissed'],
      contextFormats: ['json', 'json', 'yaml', 'yaml', 'markdown', 'markdown'],
      contextApiStatuses: [200, 200, 200, 200, 200, 200],
      contextRequestsBeforeIntent: 0,
      contextBytes: 4_096,
      importEvidence: {
        selectedCount: 2,
        preConsentPostCount: 0,
        preConsentImportEventRows: 0,
        preSubmitImportEventRows: 0,
        postConsentImportEventNames: [
          'conversation_import_candidates_ready',
          'conversation_import_confirmed',
          'conversation_import_parsed',
          'conversation_import_started',
        ],
        unselectedContentSent: false,
        archiveFilenameSent: false,
        pendingCandidatesBeforeReview: 2,
        preApprovalPublishedStateUnchanged: true,
        preApprovalActivationRows: 0,
        batchDeleted: true,
      },
      browserErrorCount: 0,
      durationMs: 750,
    })),
    fs.writeFile(
      path.join(root, 'mobile-api', 'authenticated-mobile.json'),
      JSON.stringify(MOBILE_API_EVIDENCE),
    ),
    fs.writeFile(
      path.join(root, 'mcp-provider-setup', 'authenticated-desktop.json'),
      JSON.stringify(successfulMcpNormalMetric),
    ),
    fs.writeFile(path.join(root, 'recall', 'authenticated-desktop.json'), JSON.stringify({
      project: 'authenticated-desktop',
      syntheticOwnerAllowlisted: true,
      rendered: {
        privateQuestionVisible: true,
        preRevealAnswerHidden: true,
        localDraftAbsentFromActions: true,
        localDraftVisibleAfterReveal: true,
        postRevealAnswerVisible: true,
        completionVisible: true,
      },
      routeStatus: 200,
      routeReadyMs: 700,
      routeHtmlBytes: 4_096,
      serverActionRequestCount: 4,
      actionFlow: [
        { stage: 'start', status: 200 },
        { stage: 'confidence', status: 200 },
        { stage: 'reveal', status: 200 },
        { stage: 'complete', status: 200 },
      ],
      actionResponseHeadersTotalMs: 400,
      actionDecodedBytesTotal: 8_192,
      actionTransferredBytesTotal: 4_096,
      persisted: {
        attemptCount: 1,
        attemptLifecycleState: 'completed',
        confidence: 'high',
        outcome: 'remembered',
        hintUsed: false,
        scheduleState: 'd7_pending',
        scheduleVersion: 2,
        practiceStatus: 'known',
        dueMatchesAttempt: true,
      },
      browserErrorCount: 0,
      durationMs: 1_700,
      screenshots: ['pre.png', 'post.png', 'complete.png'],
    })),
  ]);

  const { summary, markdown } = await summarizeAuthenticatedOverlayResults(root);
  assert.equal(
    summary.thinkingHistory.projects['authenticated-desktop'].contextRequestsBeforeIntentWorst,
    0,
  );
  assert.match(markdown, /Thinking History private path/);
  assert.match(markdown, /json, markdown, yaml/);
  assert.equal(summary.mobileApi.projects['authenticated-mobile'].closeoutPassed, true);
  assert.match(markdown, /Mobile API deployed path/);
  assert.equal(summary.mcpProvider.normalUiRevocationPassed, true);
  assert.match(markdown, /MCP provider PAT closeout/);
  assert.equal(summary.recall.projects['authenticated-desktop'].completedDbStateEveryRun, true);
  assert.match(markdown, /Recall private review path/);
  assert.match(markdown, /hidden -> revealed -> complete/);
  const persisted = JSON.parse(await fs.readFile(path.join(root, 'summary.json'), 'utf8'));
  assert.equal(persisted.thinkingHistory.runs.length, 1);
  assert.equal(persisted.mobileApi.runs.length, 1);
  assert.equal(persisted.mcpProvider.patMutationRuns, 1);
  assert.equal(persisted.recall.runs.length, 1);
  assert.equal(await fs.readFile(path.join(root, 'summary.md'), 'utf8'), markdown);
});
