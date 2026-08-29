import type { EdgeType } from '@stem-brain/graph-engine';

export const PRIVATE_CAUSAL_EDGE_TYPES = [
  'causes',
  'contributes_to',
  'enables',
  'inhibits',
] as const;

export type PrivateCausalEdgeType = typeof PRIVATE_CAUSAL_EDGE_TYPES[number];
export type KnowledgeMapGraphEdgeType = EdgeType | PrivateCausalEdgeType;

const PRIVATE_KNOWLEDGE_MAP_EDGE_TYPES = new Set<string>([
  'prerequisite',
  'related',
  'generalizes',
  'derived_from',
  'equivalent_to',
  ...PRIVATE_CAUSAL_EDGE_TYPES,
]);

export const KNOWLEDGE_MAP_EDGE_COLORS: Readonly<Record<KnowledgeMapGraphEdgeType, string>> = {
  prerequisite: '#38bdf8',
  related: '#94a3b8',
  generalizes: '#f59e0b',
  derived_from: '#a78bfa',
  equivalent_to: '#34d399',
  causes: '#fb7185',
  contributes_to: '#f97316',
  enables: '#22c55e',
  inhibits: '#e11d48',
};

export function isPrivateKnowledgeMapEdgeType(value: string): value is KnowledgeMapGraphEdgeType {
  return PRIVATE_KNOWLEDGE_MAP_EDGE_TYPES.has(value);
}

export function isDirectedKnowledgeMapEdge(type: KnowledgeMapGraphEdgeType) {
  return type === 'prerequisite'
    || type === 'generalizes'
    || type === 'derived_from'
    || PRIVATE_CAUSAL_EDGE_TYPES.includes(type as PrivateCausalEdgeType);
}
