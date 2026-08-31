export type KnowledgeGraphRenderBudget = {
  nodeResolution: number;
  showDirectionalParticles: boolean;
  warmupTicks: number;
  cooldownTicks: number;
};

const DENSE_GRAPH_NODE_THRESHOLD = 120;

/**
 * Keep WebGL work bounded as the public/private graph grows. The free public
 * map already exceeds one hundred nodes, so waiting until 240 nodes before
 * reducing geometry and simulation work leaves the common path on the most
 * expensive settings.
 */
export function getKnowledgeGraphRenderBudget(nodeCount: number): KnowledgeGraphRenderBudget {
  const normalizedNodeCount = Number.isFinite(nodeCount) ? Math.max(0, nodeCount) : 0;
  const dense = normalizedNodeCount > DENSE_GRAPH_NODE_THRESHOLD;

  if (dense) {
    return {
      nodeResolution: 8,
      showDirectionalParticles: false,
      warmupTicks: 20,
      cooldownTicks: 80,
    };
  }

  return {
    nodeResolution: 16,
    showDirectionalParticles: true,
    warmupTicks: 40,
    cooldownTicks: 160,
  };
}
