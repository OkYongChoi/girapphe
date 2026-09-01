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

export function renderAuthenticatedOverlaySummary(summary) {
  return [
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
  const summary = buildAuthenticatedOverlaySummary(metrics);
  const markdown = renderAuthenticatedOverlaySummary(summary);

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
