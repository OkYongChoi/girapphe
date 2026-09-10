import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildAuthenticatedOverlaySummary,
  buildAuthenticatedThinkingHistorySummary,
  renderAuthenticatedOverlaySummary,
  renderAuthenticatedThinkingHistorySummary,
  summarizeAuthenticatedOverlayResults,
} from './summarize-authenticated-overlay-results.mjs';

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

test('authenticated result loader merges private-path metrics into persisted summaries', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'girapphe-auth-summary-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await Promise.all([
    fs.mkdir(path.join(root, 'metrics'), { recursive: true }),
    fs.mkdir(path.join(root, 'thinking-history'), { recursive: true }),
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
  ]);

  const { summary, markdown } = await summarizeAuthenticatedOverlayResults(root);
  assert.equal(
    summary.thinkingHistory.projects['authenticated-desktop'].contextRequestsBeforeIntentWorst,
    0,
  );
  assert.match(markdown, /Thinking History private path/);
  assert.match(markdown, /json, markdown, yaml/);
  const persisted = JSON.parse(await fs.readFile(path.join(root, 'summary.json'), 'utf8'));
  assert.equal(persisted.thinkingHistory.runs.length, 1);
  assert.equal(await fs.readFile(path.join(root, 'summary.md'), 'utf8'), markdown);
});
