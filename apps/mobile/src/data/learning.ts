import {
  CARD_CONTENT,
  GRAPH_NODES,
  getDomainColor,
  type GraphNode,
} from '@stem-brain/graph-engine';

export type PracticeCard = GraphNode & {
  summary: string;
  explanation: string;
  color: string;
};

const priorityDomains = [
  'Linear Algebra',
  'Probability & Statistics',
  'Optimization',
  'Calculus',
  'Algorithms',
  'Data Structures',
  'Supervised Learning',
  'Deep Learning',
];

export const practiceCards: PracticeCard[] = GRAPH_NODES
  .filter((node) => CARD_CONTENT[node.id])
  .sort((a, b) => {
    const aDomain = priorityDomains.indexOf(a.domain);
    const bDomain = priorityDomains.indexOf(b.domain);
    const normalizedA = aDomain === -1 ? priorityDomains.length : aDomain;
    const normalizedB = bDomain === -1 ? priorityDomains.length : bDomain;

    return normalizedA - normalizedB || a.difficulty - b.difficulty || a.label.localeCompare(b.label);
  })
  .map((node) => ({
    ...node,
    summary: CARD_CONTENT[node.id].summary,
    explanation: CARD_CONTENT[node.id].explanation,
    color: getDomainColor(node.domain),
  }));

export const featuredCards = practiceCards.slice(0, 24);

export const domains = Array.from(new Set(practiceCards.map((card) => card.domain))).sort((a, b) =>
  a.localeCompare(b),
);

export function getCardById(id: string) {
  return practiceCards.find((card) => card.id === id);
}
