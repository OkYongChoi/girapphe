import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

export function summarize(values) {
  return {
    median: Math.round(median(values) * 10) / 10,
    worst: Math.round(Math.max(...values) * 10) / 10,
  };
}

export function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  return `${Math.round((value / 1024) * 10) / 10} KiB`;
}

export function buildAuthenticatedOverlaySummary(metrics, generatedAt = new Date().toISOString()) {
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => {
    const transferred = rows
      .map((row) => row.overlayTransferredBytesAtCanvas)
      .filter((value) => Number.isFinite(value));
    return [project, {
      runs: rows.length,
      clickToCanvasMs: summarize(rows.map((row) => row.clickToCanvasMs)),
      overlayResponseHeadersMs: summarize(rows.map((row) => row.overlayResponseHeadersMs)),
      overlayDecodedBytesAtCanvas: summarize(rows.map((row) => row.overlayDecodedBytesAtCanvas)),
      overlayTransferredBytesAtCanvas: transferred.length > 0 ? summarize(transferred) : null,
      worstStatus: Math.max(...rows.map((row) => row.overlayStatus)),
    }];
  }));
  return { generatedAt, projects, runs: metrics };
}

export function buildAuthenticatedThinkingHistorySummary(metrics) {
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => [
    project,
    {
      runs: rows.length,
      messageAssetRequests: summarize(rows.map((row) => row.messageAsset.requests)),
      messageAssetStatuses: [...new Set(rows.map((row) => row.messageAsset.status))],
      privateEvidenceMinimum: Math.min(...rows.map((row) => row.syntheticPrivateEvidenceCount)),
      contextRequestsBeforeIntentWorst: Math.max(
        ...rows.map((row) => row.contextRequestsBeforeIntent),
      ),
      contextFlows: [...new Set(rows.map((row) => row.contextApiStatuses.join(' -> ')))],
      signalOperations: [...new Set(rows.flatMap((row) => row.signalOperations ?? []))].sort(),
      contextFormats: [...new Set(rows.flatMap((row) => row.contextFormats ?? []).filter(Boolean))].sort(),
      importCloseoutPassed: rows.every((row) => (
        row.importEvidence?.selectedCount === 2
        && row.importEvidence?.preConsentPostCount === 0
        && row.importEvidence?.preConsentImportEventRows === 0
        && row.importEvidence?.preSubmitImportEventRows === 0
        && row.importEvidence?.postConsentImportEventNames?.join(',') === [
          'conversation_import_candidates_ready',
          'conversation_import_confirmed',
          'conversation_import_parsed',
          'conversation_import_started',
        ].join(',')
        && row.importEvidence?.unselectedContentSent === false
        && row.importEvidence?.archiveFilenameSent === false
        && row.importEvidence?.pendingCandidatesBeforeReview === 2
        && row.importEvidence?.preApprovalPublishedStateUnchanged === true
        && row.importEvidence?.preApprovalActivationRows === 0
        && row.importEvidence?.batchDeleted === true
      )),
      contextBytes: summarize(rows.map((row) => row.contextBytes)),
      browserErrorCount: rows.reduce((total, row) => total + row.browserErrorCount, 0),
      durationMs: summarize(rows.map((row) => row.durationMs)),
    },
  ]));
  return { projects, runs: metrics };
}

const MOBILE_API_GATES = [
  'noteLifecycle',
  'topicsAndHub',
  'rankingAnonymous',
  'practiceNewAndReview',
  'candidateApproveIgnoreAndStale',
  'cleanup',
];

export function buildAuthenticatedMobileApiSummary(metrics) {
  const byProject = Map.groupBy(metrics, (metric) => metric.project);
  const projects = Object.fromEntries([...byProject.entries()].map(([project, rows]) => [
    project,
    {
      runs: rows.length,
      privateNoStoreReadsMinimum: Math.min(...rows.map((row) => row.privateNoStoreReads)),
      gates: Object.fromEntries(MOBILE_API_GATES.map((gate) => [
        gate,
        rows.every((row) => row[gate] === true),
      ])),
      closeoutPassed: rows.every((row) => (
        row.schemaVersion === 1
        && Number.isSafeInteger(row.privateNoStoreReads)
        && row.privateNoStoreReads > 0
        && MOBILE_API_GATES.every((gate) => row[gate] === true)
      )),
    },
  ]));
  return { projects, runs: metrics };
}

export function buildAuthenticatedMcpProviderSummary(metrics) {
  const normal = metrics.filter((metric) => metric.createdOneTimePat === true);
  const routeFault = metrics.filter((metric) => metric.databaseFallbackRan === true);
  const readOnly = metrics.filter((metric) => metric.rtlLayout === true);
  return {
    patMutationRuns: normal.length + routeFault.length,
    readOnlyRuns: readOnly.length,
    normalUiRevocationPassed: normal.length === 1 && normal.every((metric) => (
      metric.revokedBeforeScreenshot === true
      && metric.remainingActiveAfterUiRevoke === 0
      && metric.clipboardEmptyAfterTest === true
    )),
    routeFaultFallbackPassed: routeFault.length === 1 && routeFault.every((metric) => (
      metric.postResponseCaptured === true
      && metric.postResponseRedacted === true
      && metric.uiCleanupFailureCount === 2
      && metric.routeFaultedRequestCount > 0
      && metric.remainingActiveAfterFallback === 0
      && metric.originalSentinelIdentityPreserved === true
      && metric.clipboardEmptyAfterTest === true
    )),
    readOnlyProviderChecksPassed: readOnly.length > 0 && readOnly.every((metric) => (
      metric.rtlLayout === true
      && metric.ltrCodeBlock === true
      && metric.copiedWithoutRawPat === true
      && metric.clipboardEmptyAfterTest === true
      && metric.browserErrorCount === 0
      && metric.pageOverflow === false
    )),
  };
}

export function assertRequiredMcpPatCloseoutEvidence(metrics, summary) {
  const normalArtifacts = metrics.filter((metric) => metric.createdOneTimePat === true);
  const routeFaultArtifacts = metrics.filter((metric) => metric.databaseFallbackRan === true);
  if (
    normalArtifacts.length !== 1
    || routeFaultArtifacts.length !== 1
    || summary?.patMutationRuns !== 2
    || summary.normalUiRevocationPassed !== true
    || summary.routeFaultFallbackPassed !== true
  ) {
    throw new Error(
      'Required Preview MCP PAT closeout evidence is incomplete: expected one successful UI-revocation artifact and one successful route-fault fallback artifact.',
    );
  }
}

export function renderAuthenticatedMcpProviderSummary(summary) {
  if (!summary) {
    return [
      '## MCP provider PAT closeout',
      '',
      'No provider evidence artifacts were produced.',
      '',
    ].join('\n');
  }
  return [
    '## MCP provider PAT closeout',
    '',
    '| PAT mutation runs | Read-only runs | Normal UI revoke active=0 | Route-fault exact fallback | Read-only provider checks |',
    '| ---: | ---: | --- | --- | --- |',
    `| ${summary.patMutationRuns} | ${summary.readOnlyRuns} | ${summary.normalUiRevocationPassed ? 'passed' : 'not run or failed'} | ${summary.routeFaultFallbackPassed ? 'passed' : 'not run or failed'} | ${summary.readOnlyProviderChecksPassed ? 'passed' : 'failed'} |`,
    '',
    'Only counts and pass/fail booleans are summarized; raw PATs, labels, run markers, response bodies, and account identity are excluded.',
    '',
  ].join('\n');
}

export function renderAuthenticatedThinkingHistorySummary(summary) {
  if (!summary) {
    return [
      '## Thinking History private path',
      '',
      'Not enabled for this run. Production evidence remains separately gated.',
      '',
    ].join('\n');
  }

  return [
    '## Thinking History private path',
    '',
    '| Project | Runs | Message asset requests median / worst; statuses | Private evidence minimum | Pre-intent context requests worst | Signal operations | Context formats | Context API flow | Import closeout | Context bytes median / worst | Browser errors | Duration median / worst |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: |',
    ...Object.entries(summary.projects).map(([project, value]) => (
      `| ${project} | ${value.runs} | ${value.messageAssetRequests.median} / ${value.messageAssetRequests.worst}; ${value.messageAssetStatuses.join(', ')} | ${value.privateEvidenceMinimum} | ${value.contextRequestsBeforeIntentWorst} | ${value.signalOperations.join(', ')} | ${value.contextFormats.join(', ')} | ${value.contextFlows.join(', ')} | ${value.importCloseoutPassed ? 'passed' : 'failed'} | ${formatBytes(value.contextBytes.median)} / ${formatBytes(value.contextBytes.worst)} | ${value.browserErrorCount} | ${value.durationMs.median} ms / ${value.durationMs.worst} ms |`
    )),
    '',
    'Synthetic owner-scoped Playwright evidence. It separately proves privacy-safe signal operations, copy/download for JSON, Markdown, and YAML, and selected-import deletion; this is not production user telemetry.',
    '',
  ].join('\n');
}

export function renderAuthenticatedMobileApiSummary(summary) {
  if (!summary) {
    return [
      '## Mobile API deployed path',
      '',
      'Not enabled for this run. Physical-device and store evidence remain separately gated.',
      '',
    ].join('\n');
  }

  return [
    '## Mobile API deployed path',
    '',
    '| Project | Runs | Private no-store reads minimum | Notes | Topics / hub | Anonymous ranking | Practice new / review | Candidate approve / ignore / stale | Exact cleanup | Closeout |',
    '| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |',
    ...Object.entries(summary.projects).map(([project, value]) => (
      `| ${project} | ${value.runs} | ${value.privateNoStoreReadsMinimum} | ${value.gates.noteLifecycle ? 'passed' : 'failed'} | ${value.gates.topicsAndHub ? 'passed' : 'failed'} | ${value.gates.rankingAnonymous ? 'passed' : 'failed'} | ${value.gates.practiceNewAndReview ? 'passed' : 'failed'} | ${value.gates.candidateApproveIgnoreAndStale ? 'passed' : 'failed'} | ${value.gates.cleanup ? 'passed' : 'failed'} | ${value.closeoutPassed ? 'passed' : 'failed'} |`
    )),
    '',
    'Synthetic owner-scoped Preview API evidence with sanitized counts and booleans only. It is not physical-device, accessibility, signed-binary, or store-release evidence.',
    '',
  ].join('\n');
}

export function renderAuthenticatedOverlaySummary(
  summary,
  thinkingHistory = null,
  mobileApi = null,
  mcpProvider = null,
) {
  const projectEntries = Object.entries(summary.projects);
  const overlay = projectEntries.length === 0
    ? [
      '# Authenticated overlay performance',
      '',
      'No overlay metrics completed for this run.',
      '',
    ].join('\n')
    : [
      '# Authenticated overlay performance',
      '',
      '| Project | Runs | Click to canvas median / worst | Overlay headers median / worst | Decoded by canvas median / worst | Transfer by canvas median / worst |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...projectEntries.map(([project, value]) => {
    const transfer = value.overlayTransferredBytesAtCanvas
      ? `${formatBytes(value.overlayTransferredBytesAtCanvas.median)} / ${formatBytes(value.overlayTransferredBytesAtCanvas.worst)}`
      : 'n/a';
    return `| ${project} | ${value.runs} | ${value.clickToCanvasMs.median} ms / ${value.clickToCanvasMs.worst} ms | ${value.overlayResponseHeadersMs.median} ms / ${value.overlayResponseHeadersMs.worst} ms | ${formatBytes(value.overlayDecodedBytesAtCanvas.median)} / ${formatBytes(value.overlayDecodedBytesAtCanvas.worst)} | ${transfer} |`;
      }),
      '',
      'Synthetic Playwright measurements. Overlay timing ends at response headers, and byte counts include data received through canvas display so streaming RSC responses do not block the evidence run. These are not production user telemetry.',
      '',
    ].join('\n');
  return `${overlay}\n${renderAuthenticatedThinkingHistorySummary(thinkingHistory)}\n${renderAuthenticatedMobileApiSummary(mobileApi)}\n${renderAuthenticatedMcpProviderSummary(mcpProvider)}`;
}

export async function summarizeAuthenticatedOverlayResults(
  resultsDirectory = path.resolve('test-results/authenticated-overlay-performance'),
  {
    requireMcpPatCloseout = process.env.E2E_REQUIRE_MCP_PAT_CLOSEOUT === 'true',
  } = {},
) {
  const metricsDirectory = path.join(resultsDirectory, 'metrics');
  let names = [];
  try {
    names = (await fs.readdir(metricsDirectory)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const metrics = await Promise.all(names.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(metricsDirectory, name), 'utf8'))
  )));
  const thinkingHistoryDirectory = path.join(resultsDirectory, 'thinking-history');
  let thinkingHistoryNames = [];
  try {
    thinkingHistoryNames = (await fs.readdir(thinkingHistoryDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const thinkingHistoryMetrics = await Promise.all(thinkingHistoryNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(thinkingHistoryDirectory, name), 'utf8'))
  )));
  const thinkingHistory = thinkingHistoryMetrics.length > 0
    ? buildAuthenticatedThinkingHistorySummary(thinkingHistoryMetrics)
    : null;
  const mobileApiDirectory = path.join(resultsDirectory, 'mobile-api');
  let mobileApiNames = [];
  try {
    mobileApiNames = (await fs.readdir(mobileApiDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const mobileApiMetrics = await Promise.all(mobileApiNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(mobileApiDirectory, name), 'utf8'))
  )));
  const mobileApi = mobileApiMetrics.length > 0
    ? buildAuthenticatedMobileApiSummary(mobileApiMetrics)
    : null;
  const mcpProviderDirectory = path.join(resultsDirectory, 'mcp-provider-setup');
  let mcpProviderNames = [];
  try {
    mcpProviderNames = (await fs.readdir(mcpProviderDirectory))
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const mcpProviderMetrics = await Promise.all(mcpProviderNames.map(async (name) => (
    JSON.parse(await fs.readFile(path.join(mcpProviderDirectory, name), 'utf8'))
  )));
  const mcpProvider = mcpProviderMetrics.length > 0
    ? buildAuthenticatedMcpProviderSummary(mcpProviderMetrics)
    : null;
  if (
    metrics.length === 0
    && thinkingHistoryMetrics.length === 0
    && mobileApiMetrics.length === 0
    && mcpProviderMetrics.length === 0
  ) {
    throw new Error(`No authenticated evidence metrics found at ${resultsDirectory}.`);
  }
  if (requireMcpPatCloseout) {
    assertRequiredMcpPatCloseoutEvidence(mcpProviderMetrics, mcpProvider);
  }
  const summary = {
    ...buildAuthenticatedOverlaySummary(metrics),
    thinkingHistory,
    mobileApi,
    mcpProvider,
  };
  const markdown = renderAuthenticatedOverlaySummary(
    summary,
    thinkingHistory,
    mobileApi,
    mcpProvider,
  );

  await fs.mkdir(resultsDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(resultsDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(resultsDirectory, 'summary.md'), markdown, 'utf8'),
  ]);
  return { summary, markdown };
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  summarizeAuthenticatedOverlayResults()
    .then(({ markdown }) => console.log(markdown))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
