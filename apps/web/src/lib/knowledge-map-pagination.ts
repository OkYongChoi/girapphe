import {
  isWithinAddedDateRangeOrUndated,
  sortConceptCards,
  type AddedDateRange,
  type ConceptSort,
} from '@/lib/knowledge-map-time';

export type KnowledgeMapListCard = {
  id: string;
  title: string;
  summary: string;
  domain: string;
  domains?: string[];
  tags?: string[];
  status: 'known' | 'saved' | null;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeMapPageOptions = {
  page?: number;
  pageSize?: number;
  query?: string;
  domain?: string | 'all';
  status?: 'known' | 'saved' | 'unstarted' | 'all';
  addedDateRange?: AddedDateRange;
  sort?: ConceptSort;
};

export const DEFAULT_KNOWLEDGE_MAP_PAGE_SIZE = 48;
export const MAX_KNOWLEDGE_MAP_PAGE_SIZE = 100;

const ADDED_DATE_RANGES = new Set<AddedDateRange>(['all', 'today', 'week', 'month', 'quarter', 'year']);
const CONCEPT_SORTS = new Set<ConceptSort>(['newest', 'updated', 'title']);

export function getKnowledgeMapCardDomains(card: Pick<KnowledgeMapListCard, 'domain' | 'domains'>) {
  const domains = card.domains && card.domains.length > 0 ? card.domains : [card.domain];
  return Array.from(new Set(domains.filter(Boolean)));
}

export function getKnowledgeMapSearchTerms(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^#/, ''))
    .filter(Boolean);
}

export function normalizeKnowledgeMapPageOptions(options?: KnowledgeMapPageOptions) {
  const page = Number.isFinite(options?.page) ? Math.max(1, Math.floor(options?.page ?? 1)) : 1;
  const pageSize = Number.isFinite(options?.pageSize)
    ? Math.min(MAX_KNOWLEDGE_MAP_PAGE_SIZE, Math.max(1, Math.floor(options?.pageSize ?? DEFAULT_KNOWLEDGE_MAP_PAGE_SIZE)))
    : DEFAULT_KNOWLEDGE_MAP_PAGE_SIZE;
  const addedDateRange = ADDED_DATE_RANGES.has(options?.addedDateRange ?? 'all')
    ? options?.addedDateRange ?? 'all'
    : 'all';
  const sort = CONCEPT_SORTS.has(options?.sort ?? 'newest') ? options?.sort ?? 'newest' : 'newest';

  return {
    page,
    pageSize,
    query: (options?.query ?? '').slice(0, 200),
    domain: options?.domain && options.domain !== 'all' ? options.domain : 'all',
    status: options?.status ?? 'all',
    addedDateRange,
    sort,
  };
}

export function matchesKnowledgeMapCard(card: KnowledgeMapListCard, options?: KnowledgeMapPageOptions) {
  const normalized = normalizeKnowledgeMapPageOptions(options);
  const domains = getKnowledgeMapCardDomains(card);
  const searchableText = [card.id, card.title, card.summary, ...domains, ...(card.tags ?? [])]
    .join(' ')
    .toLowerCase();
  const matchesQuery = getKnowledgeMapSearchTerms(normalized.query)
    .every((term) => searchableText.includes(term));
  const matchesDomain = normalized.domain === 'all' || domains.includes(normalized.domain);
  const matchesStatus = normalized.status === 'all'
    || (normalized.status === 'unstarted' ? card.status === null : card.status === normalized.status);

  return matchesQuery
    && matchesDomain
    && matchesStatus
    && isWithinAddedDateRangeOrUndated(card.createdAt, normalized.addedDateRange);
}

export function paginateKnowledgeMapCards<T extends KnowledgeMapListCard>(
  cards: readonly T[],
  options?: KnowledgeMapPageOptions,
) {
  const normalized = normalizeKnowledgeMapPageOptions(options);
  const filtered = cards.filter((card) => matchesKnowledgeMapCard(card, normalized));
  const sorted = sortConceptCards(filtered, normalized.sort);
  const total = sorted.length;
  const start = (normalized.page - 1) * normalized.pageSize;

  return {
    cards: sorted.slice(start, start + normalized.pageSize),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
    hasMore: start + normalized.pageSize < total,
  };
}
