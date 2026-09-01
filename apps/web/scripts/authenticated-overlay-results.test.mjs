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
