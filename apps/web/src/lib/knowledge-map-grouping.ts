import {
  sortConceptCards,
  type ConceptSort,
  type SortableConceptCard,
} from './knowledge-map-time';

export type ConceptGroupBy = 'domain' | 'tag' | 'none';

export const UNTAGGED_CONCEPT_GROUP_KEY = '__untagged__';
export const FLAT_CONCEPT_GROUP_KEY = '__all__';

export type GroupableConceptCard = SortableConceptCard & {
  domain?: string | null;
  domains?: readonly (string | null | undefined)[] | null;
  tags?: readonly (string | null | undefined)[] | null;
};

export type ConceptCardGroup<T extends GroupableConceptCard> = {
  key: string;
  cards: T[];
};

function firstNonEmpty(values: readonly (string | null | undefined)[] | null | undefined) {
  for (const value of values ?? []) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return undefined;
}

function getGroupKey(card: GroupableConceptCard, groupBy: Exclude<ConceptGroupBy, 'none'>) {
  if (groupBy === 'tag') {
    return firstNonEmpty(card.tags) ?? UNTAGGED_CONCEPT_GROUP_KEY;
  }

  return firstNonEmpty(card.domains)
    ?? (typeof card.domain === 'string' && card.domain.trim() ? card.domain.trim() : undefined)
    ?? 'other';
}

function compareGroupKeys(a: string, b: string) {
  if (a === UNTAGGED_CONCEPT_GROUP_KEY) return b === UNTAGGED_CONCEPT_GROUP_KEY ? 0 : 1;
  if (b === UNTAGGED_CONCEPT_GROUP_KEY) return -1;
  return a.localeCompare(b);
}

export function groupConceptCards<T extends GroupableConceptCard>(
  cards: readonly T[],
  groupBy: ConceptGroupBy,
  sort: ConceptSort,
): ConceptCardGroup<T>[] {
  if (groupBy === 'none') {
    return [{ key: FLAT_CONCEPT_GROUP_KEY, cards: sortConceptCards(cards, sort) }];
  }

  const cardsByGroup = new Map<string, T[]>();

  for (const card of cards) {
    const key = getGroupKey(card, groupBy);
    const groupCards = cardsByGroup.get(key);

    if (groupCards) groupCards.push(card);
    else cardsByGroup.set(key, [card]);
  }

  return Array.from(cardsByGroup, ([key, groupCards]) => ({
    key,
    cards: sortConceptCards(groupCards, sort),
  })).sort((a, b) => compareGroupKeys(a.key, b.key));
}

export function limitConceptCardGroups<T extends GroupableConceptCard>(
  groups: readonly ConceptCardGroup<T>[],
  limit: number,
): ConceptCardGroup<T>[] {
  const boundedLimit = Math.max(0, Math.trunc(limit));
  if (boundedLimit === 0) return [];

  const limited = groups.map(({ key }) => ({ key, cards: [] as T[] }));
  let count = 0;
  let row = 0;

  while (count < boundedLimit) {
    let added = false;
    for (let index = 0; index < groups.length && count < boundedLimit; index += 1) {
      const card = groups[index]?.cards[row];
      if (!card) continue;
      limited[index]?.cards.push(card);
      count += 1;
      added = true;
    }
    if (!added) break;
    row += 1;
  }

  return limited.filter((group) => group.cards.length > 0);
}
