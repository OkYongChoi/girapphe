import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthenticatedOverlaySummary,
  renderAuthenticatedOverlaySummary,
} from './summarize-authenticated-overlay-results.mjs';

test('authenticated overlay summary reports median and worst values per device', () => {
  const metrics = [100, 300, 200].flatMap((clickToCanvasMs, index) => ([
    {
      project: 'authenticated-desktop',
      run: index + 1,
      clickToCanvasMs,
      overlayDurationMs: clickToCanvasMs / 2,
      overlayBodyBytes: 1_024 + index * 1_024,
      overlayTransferredBodyBytes: 512 + index * 512,
      overlayStatus: 200,
    },
    {
      project: 'authenticated-mobile',
      run: index + 1,
      clickToCanvasMs: clickToCanvasMs + 50,
      overlayDurationMs: clickToCanvasMs / 2 + 25,
      overlayBodyBytes: 1_024 + index * 1_024,
      overlayTransferredBodyBytes: null,
      overlayStatus: 200,
    },
  ]));

  const summary = buildAuthenticatedOverlaySummary(metrics, '2026-09-01T00:00:00.000Z');
  assert.deepEqual(summary.projects['authenticated-desktop'].clickToCanvasMs, {
    median: 200,
    worst: 300,
  });
  assert.deepEqual(summary.projects['authenticated-mobile'].overlayDurationMs, {
    median: 125,
    worst: 175,
  });
  assert.equal(summary.projects['authenticated-desktop'].overlayBodyBytes.median, 2_048);
  assert.equal(summary.projects['authenticated-mobile'].overlayTransferredBodyBytes, null);

  const markdown = renderAuthenticatedOverlaySummary(summary);
  assert.match(markdown, /authenticated-desktop \| 3 \| 200 ms \/ 300 ms/);
  assert.match(markdown, /2 KiB \/ 3 KiB/);
  assert.match(markdown, /synthetic Playwright measurements/i);
});
