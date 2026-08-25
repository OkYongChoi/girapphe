export const FREE_PUBLIC_GRAPH_CARD_LIMIT = 144;

export type KnowledgeGraphAccess = {
  level: 'free' | 'full';
  publicCardLimit: number | null;
  publicCardCount: number;
};

type GraphCardCandidate = {
  id: string;
  domain?: string | null;
  domains?: string[] | null;
};

function normalizeDomain(domain: string | null | undefined) {
  return domain?.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    || 'other';
}

function primaryDomain(card: GraphCardCandidate) {
  const firstDomain = card.domains?.find((domain) => domain.trim());
  return normalizeDomain(firstDomain ?? card.domain);
}

/**
 * Select a representative free-map sample without letting the alphabetically
 * first domain consume the whole graph. Order inside each domain is preserved.
 */
export function selectBalancedGraphCards<T extends GraphCardCandidate>(
  cards: readonly T[],
  limit = FREE_PUBLIC_GRAPH_CARD_LIMIT,
): T[] {
  const boundedLimit = Math.max(0, Math.trunc(limit));
  if (boundedLimit === 0) return [];
  if (cards.length <= boundedLimit) return [...cards];

  const buckets = new Map<string, T[]>();
  for (const card of cards) {
    const key = primaryDomain(card);
    const bucket = buckets.get(key) ?? [];
    bucket.push(card);
    buckets.set(key, bucket);
  }

  const result: T[] = [];
  const domainKeys = [...buckets.keys()].sort();
  let row = 0;

  while (result.length < boundedLimit && domainKeys.length > 0) {
    let added = false;
    for (const key of domainKeys) {
      const card = buckets.get(key)?.[row];
      if (!card) continue;
      result.push(card);
      added = true;
      if (result.length >= boundedLimit) break;
    }
    if (!added) break;
    row += 1;
  }

  return result;
}
