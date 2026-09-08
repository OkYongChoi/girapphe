import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GRAPH_EDGES, GRAPH_NODES } from '@stem-brain/graph-engine';
import {
  FEATURED_NODE_IDS,
  filterNodes,
  getAccessiblePublicNodeById,
  getAccessiblePublicNodes,
  getDependentNodes,
  getPracticeNodes,
  getPrerequisiteNodes,
  getRelatedNodes,
} from './knowledge';

test('ad_free unlocks the complete public graph while the free catalog stays bounded', () => {
  const freeNodes = filterNodes({ limit: 80 });
  const plusNodes = filterNodes({ fullPublicMap: true, limit: null });

  assert.ok(GRAPH_NODES.length > 80);
  assert.equal(freeNodes.length, 80);
  assert.equal(plusNodes.length, GRAPH_NODES.length);
  assert.ok(freeNodes.length < plusNodes.length);
});

test('free public-map access is a stable shared set that filters search and deep links', () => {
  const freeNodes = getAccessiblePublicNodes();
  const plusNodes = getAccessiblePublicNodes(true);
  const freeNodeIds = new Set(freeNodes.map((node) => node.id));
  const lockedNode = plusNodes.find((node) => !freeNodeIds.has(node.id));

  assert.ok(lockedNode);
  assert.ok(FEATURED_NODE_IDS.every((id) => freeNodeIds.has(id)));
  assert.equal(getAccessiblePublicNodeById(lockedNode.id), undefined);
  assert.equal(getAccessiblePublicNodeById(lockedNode.id, true)?.id, lockedNode.id);
  assert.ok(!filterNodes({ domain: lockedNode.domain, limit: null }).some((node) => node.id === lockedNode.id));
  assert.ok(filterNodes({ domain: lockedNode.domain, fullPublicMap: true, limit: null }).some((node) => node.id === lockedNode.id));
});

test('free learning practice cards retain an accessible topic detail', () => {
  const freeNodeIds = new Set(getAccessiblePublicNodes().map((node) => node.id));

  assert.ok(getPracticeNodes().length > 0);
  assert.ok(getPracticeNodes().every((node) => freeNodeIds.has(node.id)));
});

test('related, prerequisite, and dependent traversal cannot leave the free public-map set', () => {
  const freeNodeIds = new Set(getAccessiblePublicNodes().map((node) => node.id));
  const freeToLocked = GRAPH_EDGES.find((edge) =>
    edge.type === 'prerequisite'
      && freeNodeIds.has(edge.source)
      && !freeNodeIds.has(edge.target)
      && Boolean(getAccessiblePublicNodeById(edge.target, true)),
  );
  const lockedToFree = GRAPH_EDGES.find((edge) =>
    edge.type === 'prerequisite'
      && !freeNodeIds.has(edge.source)
      && freeNodeIds.has(edge.target)
      && Boolean(getAccessiblePublicNodeById(edge.source, true)),
  );

  assert.ok(freeToLocked);
  assert.ok(lockedToFree);
  assert.ok(!getRelatedNodes(freeToLocked.source, GRAPH_NODES.length).some((node) => node.id === freeToLocked.target));
  assert.ok(getRelatedNodes(freeToLocked.source, GRAPH_NODES.length, true).some((node) => node.id === freeToLocked.target));
  assert.ok(!getDependentNodes(freeToLocked.source).some((node) => node.id === freeToLocked.target));
  assert.ok(getDependentNodes(freeToLocked.source, true).some((node) => node.id === freeToLocked.target));
  assert.ok(!getPrerequisiteNodes(lockedToFree.target).some((node) => node.id === lockedToFree.source));
  assert.ok(getPrerequisiteNodes(lockedToFree.target, true).some((node) => node.id === lockedToFree.source));
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

test('related selections and topic deep links carry the canonical subscription entitlement', () => {
  const homeSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  const browseSource = readFileSync(new URL('../app/(tabs)/browse.tsx', import.meta.url), 'utf8');
  const practiceSource = readFileSync(new URL('../app/(tabs)/practice.tsx', import.meta.url), 'utf8');
  const topicSource = readFileSync(new URL('../app/topic/[id].tsx', import.meta.url), 'utf8');

  assert.match(homeSource, /getAccessiblePublicNodeById\(selectedNode\.id, subscription\.isAdFree\)/);
  assert.match(browseSource, /getAccessiblePublicNodeById\(selectedPublicNode\.id, subscription\.isAdFree\)/);
  assert.match(browseSource, /getRelatedNodes\(activeNode\.id, 4, subscription\.isAdFree\)/);
  assert.match(practiceSource, /getRelatedNodes\(currentNode\.id, 3, isAdFree\)/);
  assert.match(topicSource, /getAccessiblePublicNodeById\(id, subscription\.isAdFree\)/);
  assert.match(topicSource, /getPrerequisiteNodes\(node\.id, subscription\.isAdFree\)/);
  assert.match(topicSource, /getDependentNodes\(node\.id, subscription\.isAdFree\)/);
  assert.match(topicSource, /getRelatedNodes\(node\.id, 6, subscription\.isAdFree\)/);
});
