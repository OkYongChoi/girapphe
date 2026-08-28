import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('empty topic routes clear loading and cannot restore a stale private hub', () => {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const topicScreen = readFileSync(join(sourceDir, '../app/knowledge-topic/[topic].tsx'), 'utf8');

  assert.match(
    topicScreen,
    /const request = \+\+loadRequest\.current;\s*if \(!topic\) \{\s*setHub\(null\);\s*setError\(null\);\s*setLoading\(false\);\s*return;/,
  );
  assert.match(topicScreen, /if \(request === loadRequest\.current\) setHub\(nextHub\)/);
  assert.match(topicScreen, /if \(request === loadRequest\.current\) setLoading\(false\)/);
});
