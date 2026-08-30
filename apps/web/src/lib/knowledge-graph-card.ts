import type { CardLevel } from '@stem-brain/graph-engine';

export type KnowledgeGraphCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  wiki_url: string;
  domain: string;
  domains: string[];
  level: CardLevel;
  status: 'known' | 'saved' | null;
};

type KnowledgeGraphCardSource = Omit<KnowledgeGraphCard, 'domains'> & {
  domains?: readonly string[] | null;
};

/**
 * Keep the public 3D graph payload limited to fields rendered by the graph.
 *
 * Knowledge-card rows can also carry large typed bundles, localization search
 * aliases, and relationship metadata. Those fields belong to card detail and
 * editing flows, so copying them into the graph snapshot only increases the
 * server-action serialization and hydration cost.
 */
export function toKnowledgeGraphCard<T extends KnowledgeGraphCardSource>(
  card: T,
): KnowledgeGraphCard {
  return {
    id: card.id,
    title: card.title,
    summary: card.summary,
    explanation: card.explanation,
    wiki_url: card.wiki_url,
    domain: card.domain,
    domains: card.domains?.length ? [...card.domains] : [card.domain],
    level: card.level,
    status: card.status,
  };
}
