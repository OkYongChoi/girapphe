import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isDirectedKnowledgeMapEdge,
  isPrivateKnowledgeMapEdgeType,
  KNOWLEDGE_MAP_EDGE_COLORS,
  PRIVATE_CAUSAL_EDGE_TYPES,
} from './knowledge-map-private-edges';

test('private Knowledge Map edges admit and direct every causal relation', () => {
  for (const type of PRIVATE_CAUSAL_EDGE_TYPES) {
    assert.equal(isPrivateKnowledgeMapEdgeType(type), true);
    assert.equal(isDirectedKnowledgeMapEdge(type), true);
    assert.match(KNOWLEDGE_MAP_EDGE_COLORS[type], /^#[0-9a-f]{6}$/iu);
  }
  assert.equal(new Set(PRIVATE_CAUSAL_EDGE_TYPES.map((type) => KNOWLEDGE_MAP_EDGE_COLORS[type])).size, 4);
});

test('private Knowledge Map edge validation retains legacy direction semantics', () => {
  assert.equal(isPrivateKnowledgeMapEdgeType('prerequisite'), true);
  assert.equal(isDirectedKnowledgeMapEdge('prerequisite'), true);
  assert.equal(isDirectedKnowledgeMapEdge('related'), false);
  assert.equal(isDirectedKnowledgeMapEdge('equivalent_to'), false);
  assert.equal(isPrivateKnowledgeMapEdgeType('supports'), false);
});
