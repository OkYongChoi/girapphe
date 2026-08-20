import type { ForceGraphData, GraphEdge, GraphNodeWithKnowledge } from '@stem-brain/graph-engine';

const DEFAULT_MAX_NODES = 180;
const DEFAULT_MAX_LINKS = 280;
const RESERVED_NEIGHBOR_SLOTS = 40;
const MAX_DOMAIN_REPRESENTATION = 28;

type BuildHomeGraphPreviewOptions = {
  maxNodes?: number;
  maxLinks?: number;
};

type ScoredNode = {
  node: GraphNodeWithKnowledge;
  score: number;
};

function scoreNode(node: GraphNodeWithKnowledge) {
  return (
    node.knowledge * 6
    + node.confidence * 3
    + node.growth_weekly * 4
    + node.growth_monthly * 2
    + (node.growth_daily > 0 ? 1.2 : 0)
    + Math.max(0, 5 - node.level) * 0.15
  );
}

function buildAdjacency(links: GraphEdge[]) {
  const adjacency = new Map<string, GraphEdge[]>();

  for (const link of links) {
    const sourceLinks = adjacency.get(link.source) ?? [];
    sourceLinks.push(link);
    adjacency.set(link.source, sourceLinks);

    const targetLinks = adjacency.get(link.target) ?? [];
    targetLinks.push(link);
    adjacency.set(link.target, targetLinks);
  }

  return adjacency;
}

function addNode(
  selectedIds: Set<string>,
  domainCounts: Map<string, number>,
  node: GraphNodeWithKnowledge,
) {
  if (selectedIds.has(node.id)) return false;
  selectedIds.add(node.id);
  domainCounts.set(node.domain, (domainCounts.get(node.domain) ?? 0) + 1);
  return true;
}

function sortScoredNodes(left: ScoredNode, right: ScoredNode) {
  return right.score - left.score
    || right.node.knowledge - left.node.knowledge
    || right.node.confidence - left.node.confidence
    || left.node.id.localeCompare(right.node.id);
}

export function buildHomeGraphPreview(
  graphData: ForceGraphData,
  options?: BuildHomeGraphPreviewOptions,
): ForceGraphData {
  const maxNodes = Math.max(48, options?.maxNodes ?? DEFAULT_MAX_NODES);
  const maxLinks = Math.max(64, options?.maxLinks ?? DEFAULT_MAX_LINKS);
  if (graphData.nodes.length <= maxNodes && graphData.links.length <= maxLinks) return graphData;

  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
  const scoredNodes = graphData.nodes
    .map((node) => ({ node, score: scoreNode(node) }))
    .sort(sortScoredNodes);
  const adjacency = buildAdjacency(graphData.links);
  const scoredByDomain = new Map<string, ScoredNode[]>();

  for (const entry of scoredNodes) {
    const existing = scoredByDomain.get(entry.node.domain) ?? [];
    existing.push(entry);
    scoredByDomain.set(entry.node.domain, existing);
  }

  const selectedIds = new Set<string>();
  const domainCounts = new Map<string, number>();
  const domainsByPriority = [...scoredByDomain.entries()]
    .sort((left, right) => sortScoredNodes(left[1][0], right[1][0]));
  const minPerDomain = Math.max(
    3,
    Math.min(10, Math.floor(maxNodes / Math.max(1, domainsByPriority.length)))
  );
  const directNodeBudget = Math.max(minPerDomain * domainsByPriority.length, maxNodes - RESERVED_NEIGHBOR_SLOTS);

  // Keep a representative slice from every active domain so the home graph
  // remains legible without pulling the full personalized network.
  for (const [, entries] of domainsByPriority) {
    for (const entry of entries.slice(0, minPerDomain)) {
      if (selectedIds.size >= maxNodes) break;
      addNode(selectedIds, domainCounts, entry.node);
    }
  }

  for (const entry of scoredNodes) {
    if (selectedIds.size >= directNodeBudget) break;
    if ((domainCounts.get(entry.node.domain) ?? 0) >= MAX_DOMAIN_REPRESENTATION) continue;
    addNode(selectedIds, domainCounts, entry.node);
  }

  const neighborCandidates = new Map<string, number>();
  for (const selectedId of selectedIds) {
    for (const link of adjacency.get(selectedId) ?? []) {
      const neighborId = link.source === selectedId ? link.target : link.source;
      if (selectedIds.has(neighborId)) continue;
      const neighbor = nodeById.get(neighborId);
      if (!neighbor) continue;

      const existing = neighborCandidates.get(neighborId) ?? Number.NEGATIVE_INFINITY;
      const candidateScore = scoreNode(neighbor) * 0.65 + link.weight * 4;
      if (candidateScore > existing) neighborCandidates.set(neighborId, candidateScore);
    }
  }

  const sortedNeighborCandidates = [...neighborCandidates.entries()]
    .map(([nodeId, score]) => {
      const node = nodeById.get(nodeId);
      return node ? { node, score } : null;
    })
    .filter((entry): entry is ScoredNode => Boolean(entry))
    .sort(sortScoredNodes);

  for (const entry of sortedNeighborCandidates) {
    if (selectedIds.size >= maxNodes) break;
    if ((domainCounts.get(entry.node.domain) ?? 0) >= MAX_DOMAIN_REPRESENTATION) continue;
    addNode(selectedIds, domainCounts, entry.node);
  }

  const selectedLinks = graphData.links
    .filter((link) => selectedIds.has(link.source) && selectedIds.has(link.target))
    .sort((left, right) => right.weight - left.weight || left.source.localeCompare(right.source) || left.target.localeCompare(right.target))
    .slice(0, maxLinks);

  const connectedIds = new Set<string>();
  for (const link of selectedLinks) {
    connectedIds.add(link.source);
    connectedIds.add(link.target);
  }

  const prioritizedIds = [...selectedIds].sort((leftId, rightId) => {
    const left = nodeById.get(leftId);
    const right = nodeById.get(rightId);
    if (!left || !right) return leftId.localeCompare(rightId);

    const connectivityDelta = Number(connectedIds.has(rightId)) - Number(connectedIds.has(leftId));
    if (connectivityDelta !== 0) return connectivityDelta;

    return scoreNode(right) - scoreNode(left)
      || leftId.localeCompare(rightId);
  });

  const selectedNodes = prioritizedIds
    .map((id) => nodeById.get(id))
    .filter((node): node is GraphNodeWithKnowledge => Boolean(node))
    .slice(0, maxNodes);
  const allowedNodeIds = new Set(selectedNodes.map((node) => node.id));

  return {
    nodes: selectedNodes,
    links: selectedLinks.filter((link) => allowedNodeIds.has(link.source) && allowedNodeIds.has(link.target)),
  };
}
