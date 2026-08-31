import assert from 'node:assert/strict';
import test from 'node:test';
import { getKnowledgeGraphRenderBudget } from './knowledge-graph-performance';

test('keeps full visual detail for small knowledge graphs', () => {
  assert.deepEqual(getKnowledgeGraphRenderBudget(120), {
    nodeResolution: 16,
    showDirectionalParticles: true,
    warmupTicks: 40,
    cooldownTicks: 160,
  });
});

test('bounds geometry, particles, and simulation work for the common free graph', () => {
  assert.deepEqual(getKnowledgeGraphRenderBudget(180), {
    nodeResolution: 8,
    showDirectionalParticles: false,
    warmupTicks: 20,
    cooldownTicks: 80,
  });
});

test('normalizes invalid node counts to the small-graph budget', () => {
  assert.equal(getKnowledgeGraphRenderBudget(Number.NaN).nodeResolution, 16);
  assert.equal(getKnowledgeGraphRenderBudget(-1).nodeResolution, 16);
});
