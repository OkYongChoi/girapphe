import type { GraphNode, GraphEdge, UserKnowledgeState } from '@/lib/graph-types';

// ============================================================
// Knowledge Diffusion Engine
// Simplified diffusion: K_new = alpha * K + (1 - alpha) * normalized_adjacent_mean
// ============================================================

interface DiffusionInput {
  nodes: GraphNode[];
  edges: GraphEdge[];
  knowledgeStates: Map<string, UserKnowledgeState>;
  alpha?: number; // diffusion rate, default 0.3
}

interface DiffusionResult {
  updatedStates: Map<string, number>; // node_id -> new knowledge value
}

function toContinuousKnowledge(state: UserKnowledgeState | undefined): number {
  if (!state) return 0;
  return Math.max(0, Math.min(1, state.knowledge_state * 0.8 + state.confidence * 0.2));
}

/**
 * Build adjacency list from edges.
 * For prerequisite edges: knowledge flows from source to target
 * For related/equivalent_to: bidirectional
 * For generalizes: knowledge flows from parent to child
 * For derived_from: knowledge flows from source to derived
 */
function buildAdjacencyList(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, { neighbor: string; weight: number }[]> {
  const adj = new Map<string, { neighbor: string; weight: number }[]>();

  // Initialize all nodes
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    // For all edge types, the target benefits from source knowledge
    const targetList = adj.get(edge.target);
    if (targetList) {
      targetList.push({ neighbor: edge.source, weight: edge.weight });
    }

    // For bidirectional types, source also benefits from target
    if (edge.type === 'related' || edge.type === 'equivalent_to') {
      const sourceList = adj.get(edge.source);
      if (sourceList) {
        sourceList.push({ neighbor: edge.target, weight: edge.weight });
      }
    }
  }

  return adj;
}

/**
 * Run a single step of knowledge diffusion.
 *
 * K_new(v) = alpha * K(v) + (1 - alpha) * weighted_neighbor_mean(v)
 *
 * Where weighted_neighbor_mean = sum(w_i * K(n_i)) / sum(w_i)
 * for all neighbors n_i of v with weights w_i.
 *
 * Constraint: knowledge can only increase through diffusion (never decrease).
 */
export function runDiffusion({
  nodes,
  edges,
  knowledgeStates,
  alpha = 0.3,
}: DiffusionInput): DiffusionResult {
  const adj = buildAdjacencyList(nodes, edges);
  const updatedStates = new Map<string, number>();

  for (const node of nodes) {
    const currentK = toContinuousKnowledge(knowledgeStates.get(node.id));
    const neighbors = adj.get(node.id) ?? [];

    if (neighbors.length === 0) {
      // No neighbors: keep current knowledge
      updatedStates.set(node.id, currentK);
      continue;
    }

    // Calculate weighted neighbor mean
    let weightedSum = 0;
    let totalWeight = 0;

    for (const { neighbor, weight } of neighbors) {
      const neighborK = toContinuousKnowledge(knowledgeStates.get(neighbor));
      weightedSum += weight * neighborK;
      totalWeight += weight;
    }

    const neighborMean = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Diffusion formula
    const newK = alpha * currentK + (1 - alpha) * neighborMean;

    // Knowledge can only increase (or stay same) through diffusion
    updatedStates.set(node.id, Math.max(currentK, Math.min(1, newK)));
  }

  return { updatedStates };
}

/**
 * Compute the Graph Laplacian for future advanced diffusion.
 * L = D - A where D is degree matrix, A is adjacency matrix.
 *
 * Returns sparse representation for efficiency.
 */
export function computeLaplacian(
  nodes: GraphNode[],
  edges: GraphEdge[]
): {
  nodeIds: string[];
  adjacency: number[][];
  degree: number[];
  laplacian: number[][];
} {
  const nodeIds = nodes.map((n) => n.id);
  const idxMap = new Map(nodeIds.map((id, i) => [id, i]));
  const n = nodeIds.length;

  // Initialize matrices
  const adjacency: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const degree: number[] = new Array(n).fill(0);

  for (const edge of edges) {
    const i = idxMap.get(edge.source);
    const j = idxMap.get(edge.target);
    if (i === undefined || j === undefined) continue;

    adjacency[i][j] = edge.weight;
    degree[i] += edge.weight;

    if (edge.type === 'related' || edge.type === 'equivalent_to') {
      adjacency[j][i] = edge.weight;
      degree[j] += edge.weight;
    }
  }

  // L = D - A
  const laplacian: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return degree[i] - adjacency[i][j];
      return -adjacency[i][j];
    })
  );

  return { nodeIds, adjacency, degree, laplacian };
}

/**
 * Propagate quiz result through the graph.
 * When a node's knowledge changes, adjacent nodes may receive partial diffusion.
 */
export function propagateQuizResult(
  nodes: GraphNode[],
  edges: GraphEdge[],
  knowledgeStates: Map<string, UserKnowledgeState>,
  nodeId: string,
  result: number, // 0, 0.5, or 1
  propagationDepth: number = 2,
  decayFactor: number = 0.3
): Map<string, number> {
  // Update the directly assessed node
  const updatedStates = new Map<string, number>();
  updatedStates.set(nodeId, result);

  // Build adjacency for propagation
  const adj = buildAdjacencyList(nodes, edges);

  // BFS propagation with decay
  const visited = new Set<string>([nodeId]);
  let currentLayer = [nodeId];

  for (let depth = 0; depth < propagationDepth; depth++) {
    const nextLayer: string[] = [];
    const currentDecay = Math.pow(decayFactor, depth + 1);

    for (const currentNodeId of currentLayer) {
      const neighbors = adj.get(currentNodeId) ?? [];

      for (const { neighbor, weight } of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);

        const currentK = toContinuousKnowledge(knowledgeStates.get(neighbor));
        const influence = result * weight * currentDecay;
        const newK = Math.max(currentK, Math.min(1, currentK + influence * (1 - currentK)));

        updatedStates.set(neighbor, newK);
        nextLayer.push(neighbor);
      }
    }

    currentLayer = nextLayer;
  }

  return updatedStates;
}
