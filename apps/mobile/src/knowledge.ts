import {
  CARD_CONTENT,
  GRAPH_EDGES,
  GRAPH_NODES,
  type GraphNode,
} from '@stem-brain/graph-engine';

export const ROOT_DOMAINS = [
  'Mathematics',
  'Computer Science',
  'Machine Learning',
  'Artificial Intelligence',
];

export const FEATURED_NODE_IDS = [
  'linear_algebra',
  'gradient_descent',
  'bayes_theorem',
  'transformer',
  'graph_algorithms',
];

export type DomainOption = 'All' | string;
export type DifficultyOption = 'All' | 1 | 2 | 3 | 4 | 5;

export function getDomainOptions(): DomainOption[] {
  const primaryDomains = ROOT_DOMAINS.filter((domain) =>
    GRAPH_NODES.some((node) => node.domain === domain || node.label === domain),
  );

  return ['All', ...primaryDomains];
}

export function getFeaturedNodes(): GraphNode[] {
  return FEATURED_NODE_IDS.map((id) => GRAPH_NODES.find((node) => node.id === id)).filter(
    (node): node is GraphNode => Boolean(node),
  );
}

export function getLevelCount(): number {
  return Math.max(...GRAPH_NODES.map((node) => node.level)) + 1;
}

export function getNodeById(nodeId: string): GraphNode | undefined {
  return GRAPH_NODES.find((node) => node.id === nodeId);
}

export function getPrerequisiteCount(nodeId: string): number {
  return GRAPH_EDGES.filter((edge) => edge.target === nodeId && edge.type === 'prerequisite').length;
}

export function getPrerequisiteNodes(nodeId: string): GraphNode[] {
  return GRAPH_EDGES.filter((edge) => edge.target === nodeId && edge.type === 'prerequisite')
    .map((edge) => getNodeById(edge.source))
    .filter((node): node is GraphNode => Boolean(node));
}

export function getDependentNodes(nodeId: string): GraphNode[] {
  return GRAPH_EDGES.filter((edge) => edge.source === nodeId && edge.type === 'prerequisite')
    .map((edge) => getNodeById(edge.target))
    .filter((node): node is GraphNode => Boolean(node));
}

export function getNodeSummary(nodeId: string): string {
  return CARD_CONTENT[nodeId]?.summary ?? 'No practice summary has been added for this topic yet.';
}

export function getNodeExplanation(nodeId: string): string {
  return CARD_CONTENT[nodeId]?.explanation ?? 'No explanation has been added for this topic yet.';
}

export function getPracticeNodes(): GraphNode[] {
  return GRAPH_NODES.filter((node) => CARD_CONTENT[node.id])
    .sort((a, b) => a.difficulty - b.difficulty || a.level - b.level || a.label.localeCompare(b.label))
    .slice(0, 80);
}

export function getRelatedNodes(nodeId: string, limit = 4): GraphNode[] {
  const relatedIds = GRAPH_EDGES.filter((edge) => edge.source === nodeId || edge.target === nodeId).map((edge) =>
    edge.source === nodeId ? edge.target : edge.source,
  );

  return [...new Set(relatedIds)]
    .map((id) => GRAPH_NODES.find((node) => node.id === id))
    .filter((node): node is GraphNode => Boolean(node))
    .slice(0, limit);
}

export function filterNodes({
  query,
  domain,
  difficulty,
  limit = 60,
}: {
  query?: string;
  domain?: DomainOption;
  difficulty?: DifficultyOption;
  limit?: number;
}): GraphNode[] {
  const normalizedQuery = query?.trim().toLowerCase() ?? '';

  return GRAPH_NODES.filter((node) => node.level <= 3)
    .filter((node) => {
      if (!normalizedQuery) return true;
      return (
        node.label.toLowerCase().includes(normalizedQuery) ||
        node.domain.toLowerCase().includes(normalizedQuery) ||
        node.type.toLowerCase().includes(normalizedQuery)
      );
    })
    .filter((node) => {
      if (!domain || domain === 'All') return true;
      return node.domain === domain || node.label === domain;
    })
    .filter((node) => {
      if (!difficulty || difficulty === 'All') return true;
      return node.difficulty === difficulty;
    })
    .sort((a, b) => a.level - b.level || a.difficulty - b.difficulty || a.label.localeCompare(b.label))
    .slice(0, limit);
}
