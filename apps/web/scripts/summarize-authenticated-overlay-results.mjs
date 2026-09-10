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

export function renderAuthenticatedOverlaySummary(summary, thinkingHistory = null) {
  const overlay = [
  '# Authenticated overlay performance',
  '',
  '| Project | Runs | Click to canvas median / worst | Overlay headers median / worst | Decoded by canvas median / worst | Transfer by canvas median / worst |',
  '| --- | ---: | ---: | ---: | ---: | ---: |',
  ...Object.entries(summary.projects).map(([project, value]) => {
    const transfer = value.overlayTransferredBytesAtCanvas
      ? `${formatBytes(value.overlayTransferredBytesAtCanvas.median)} / ${formatBytes(value.overlayTransferredBytesAtCanvas.worst)}`
      : 'n/a';
    return `| ${project} | ${value.runs} | ${value.clickToCanvasMs.median} ms / ${value.clickToCanvasMs.worst} ms | ${value.overlayResponseHeadersMs.median} ms / ${value.overlayResponseHeadersMs.worst} ms | ${formatBytes(value.overlayDecodedBytesAtCanvas.median)} / ${formatBytes(value.overlayDecodedBytesAtCanvas.worst)} | ${transfer} |`;
  }),
  '',
  'Synthetic Playwright measurements. Overlay timing ends at response headers, and byte counts include data received through canvas display so streaming RSC responses do not block the evidence run. These are not production user telemetry.',
  '',
  ].join('\n');
  return `${overlay}\n${renderAuthenticatedThinkingHistorySummary(thinkingHistory)}`;
}

export async function summarizeAuthenticatedOverlayResults(
  resultsDirectory = path.resolve('test-results/authenticated-overlay-performance'),
) {
  const metricsDirectory = path.join(resultsDirectory, 'metrics');
  let names;
  try {
    names = (await fs.readdir(metricsDirectory)).filter((name) => name.endsWith('.json')).sort();
  } catch {
    throw new Error(`No authenticated overlay metrics found at ${metricsDirectory}.`);
  }
  if (names.length === 0) throw new Error(`No authenticated overlay metrics found at ${metricsDirectory}.`);

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
  const summary = {
    ...buildAuthenticatedOverlaySummary(metrics),
    thinkingHistory,
  };
  const markdown = renderAuthenticatedOverlaySummary(summary, thinkingHistory);

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
