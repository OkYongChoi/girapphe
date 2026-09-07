import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GRAPH_NODES } from '@stem-brain/graph-engine';
import { filterNodes } from './knowledge';

test('ad_free unlocks the complete public graph while the free catalog stays bounded', () => {
  const freeNodes = filterNodes({ limit: 80 });
  const plusNodes = filterNodes({ fullPublicMap: true, limit: null });

  assert.ok(GRAPH_NODES.length > 80);
  assert.equal(freeNodes.length, 80);
  assert.equal(plusNodes.length, GRAPH_NODES.length);
  assert.ok(freeNodes.length < plusNodes.length);
});

test('both mobile public-map surfaces use the canonical subscription entitlement', () => {
  for (const relativePath of [
    '../app/(tabs)/index.tsx',
    '../app/(tabs)/browse.tsx',
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, /useSubscription\(\)/);
    assert.match(source, /fullPublicMap: subscription\.isAdFree/);
    assert.match(source, /limit: subscription\.isAdFree \? null/);
  }
});
