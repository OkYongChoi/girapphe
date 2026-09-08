import {
  GRAPH_EDGES,
  GRAPH_NODES,
  type GraphNode,
} from '@stem-brain/graph-engine';
import { CARD_CONTENT } from '@stem-brain/graph-engine/card-content';

export const ROOT_DOMAINS = [
  'Mathematics',
  'Computer Science',
  'Machine Learning',
  'Artificial Intelligence',
  'Engineering Science',
];

export const FEATURED_NODE_IDS = [
  'engineering_science',
  'reynolds_number',
  'thermal_resistance_network',
  'linear_algebra',
  'gradient_descent',
];

const FREE_PUBLIC_MAP_BROWSE_LIMIT = 80;
const FREE_PRACTICE_NODE_LIMIT = 80;

export type DomainOption = 'All' | string;
export type DifficultyOption = 'All' | 1 | 2 | 3 | 4 | 5;

function compareNodes(a: GraphNode, b: GraphNode): number {
  return a.level - b.level || a.difficulty - b.difficulty || a.label.localeCompare(b.label);
}

const ORDERED_PUBLIC_NODES = [...GRAPH_NODES].sort(compareNodes);
const PUBLIC_NODE_BY_ID = new Map(ORDERED_PUBLIC_NODES.map((node) => [node.id, node]));
const FREE_PRACTICE_NODES = GRAPH_NODES.filter((node) => CARD_CONTENT[node.id])
  .sort((a, b) => a.difficulty - b.difficulty || a.level - b.level || a.label.localeCompare(b.label))
  .slice(0, FREE_PRACTICE_NODE_LIMIT);
// The free map is bounded, but every topic deliberately surfaced by the free
// Home and Practice learning flows must keep a usable detail destination.
const FREE_PUBLIC_MAP_NODE_IDS = new Set([
  ...ORDERED_PUBLIC_NODES
    .filter((node) => node.level <= 3)
    .slice(0, FREE_PUBLIC_MAP_BROWSE_LIMIT)
    .map((node) => node.id),
  ...FEATURED_NODE_IDS,
  ...FREE_PRACTICE_NODES.map((node) => node.id),
]);

export function getAccessiblePublicNodes(fullPublicMap = false): GraphNode[] {
  if (fullPublicMap) return [...ORDERED_PUBLIC_NODES];
  return ORDERED_PUBLIC_NODES.filter((node) => FREE_PUBLIC_MAP_NODE_IDS.has(node.id));
}

export function getAccessiblePublicNodeById(
  nodeId: string,
  fullPublicMap = false,
): GraphNode | undefined {
  const node = PUBLIC_NODE_BY_ID.get(nodeId);
  if (!node || (!fullPublicMap && !FREE_PUBLIC_MAP_NODE_IDS.has(nodeId))) return undefined;
  return node;
}

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

export function getPrerequisiteCount(nodeId: string, fullPublicMap = false): number {
  if (!getAccessiblePublicNodeById(nodeId, fullPublicMap)) return 0;
  return GRAPH_EDGES.filter((edge) =>
    edge.target === nodeId
      && edge.type === 'prerequisite'
      && Boolean(getAccessiblePublicNodeById(edge.source, fullPublicMap)),
  ).length;
}

export function getPrerequisiteNodes(nodeId: string, fullPublicMap = false): GraphNode[] {
  if (!getAccessiblePublicNodeById(nodeId, fullPublicMap)) return [];
  return GRAPH_EDGES.filter((edge) => edge.target === nodeId && edge.type === 'prerequisite')
    .map((edge) => getAccessiblePublicNodeById(edge.source, fullPublicMap))
    .filter((node): node is GraphNode => Boolean(node));
}

export function getDependentNodes(nodeId: string, fullPublicMap = false): GraphNode[] {
  if (!getAccessiblePublicNodeById(nodeId, fullPublicMap)) return [];
  return GRAPH_EDGES.filter((edge) => edge.source === nodeId && edge.type === 'prerequisite')
    .map((edge) => getAccessiblePublicNodeById(edge.target, fullPublicMap))
    .filter((node): node is GraphNode => Boolean(node));
}

export function getNodeSummary(nodeId: string): string {
  return CARD_CONTENT[nodeId]?.summary ?? '';
}

export function getNodeExplanation(nodeId: string): string {
  return CARD_CONTENT[nodeId]?.explanation ?? '';
}

export function getPracticeNodes(): GraphNode[] {
  return [...FREE_PRACTICE_NODES];
}

export function getRelatedNodes(nodeId: string, limit = 4, fullPublicMap = false): GraphNode[] {
  if (!getAccessiblePublicNodeById(nodeId, fullPublicMap)) return [];
  const relatedIds = GRAPH_EDGES.filter((edge) => edge.source === nodeId || edge.target === nodeId).map((edge) =>
    edge.source === nodeId ? edge.target : edge.source,
  );

  return [...new Set(relatedIds)]
    .map((id) => getAccessiblePublicNodeById(id, fullPublicMap))
    .filter((node): node is GraphNode => Boolean(node))
    .slice(0, limit);
}

export function filterNodes({
  query,
  domain,
  difficulty,
  limit = 60,
  fullPublicMap = false,
}: {
  query?: string;
  domain?: DomainOption;
  difficulty?: DifficultyOption;
  limit?: number | null;
  fullPublicMap?: boolean;
}): GraphNode[] {
  const normalizedQuery = query?.trim().toLowerCase() ?? '';

  const nodes = getAccessiblePublicNodes(fullPublicMap)
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
    });
  return limit === null ? nodes : nodes.slice(0, limit);
}
