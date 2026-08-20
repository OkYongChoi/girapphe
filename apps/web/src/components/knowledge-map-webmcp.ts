import {
  isWithinAddedDateRangeOrUndated,
  type AddedDateRange,
} from '@/lib/knowledge-map-time';

export type KnowledgeSearchStatus = 'all' | 'known' | 'saved' | 'unstarted';

export type KnowledgeSearchFilters = {
  query: string;
  domain: string | 'all';
  status: KnowledgeSearchStatus;
  addedWithin: AddedDateRange;
};

export type KnowledgeSearchCard = {
  id: string;
  title: string;
  summary?: string;
  explanation?: string;
  domain: string;
  domains?: string[];
  tags?: string[];
  status: 'known' | 'saved' | null;
  createdAt?: string;
  isPersonal?: boolean;
};

export const KNOWLEDGE_SEARCH_RESULT_LIMIT = 5;

const KNOWLEDGE_SEARCH_STATUSES = new Set<KnowledgeSearchStatus>([
  'all',
  'known',
  'saved',
  'unstarted',
]);
const KNOWLEDGE_ADDED_DATE_RANGES = new Set<AddedDateRange>([
  'all',
  'today',
  'week',
  'month',
  'quarter',
  'year',
]);

export function getKnowledgeSearchCardDomains(card: KnowledgeSearchCard) {
  const domains = card.domains && card.domains.length > 0 ? card.domains : [card.domain];
  return Array.from(new Set(domains.filter(Boolean)));
}

export function isPublicKnowledgeSearchCard(card: KnowledgeSearchCard) {
  return !card.isPersonal && !card.id.startsWith('personal:');
}

export function getKnowledgeSearchTerms(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^#/, ''))
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeKnowledgeSearchInput(input: unknown): KnowledgeSearchFilters {
  const record = asRecord(input);
  const query = typeof record.query === 'string' ? record.query.trim().slice(0, 240) : '';
  const domain = typeof record.domain === 'string' && record.domain.trim()
    ? record.domain.trim().slice(0, 80)
    : 'all';
  const status = typeof record.status === 'string'
    && KNOWLEDGE_SEARCH_STATUSES.has(record.status as KnowledgeSearchStatus)
    ? record.status as KnowledgeSearchStatus
    : 'all';
  const addedWithin = typeof record.added_within === 'string'
    && KNOWLEDGE_ADDED_DATE_RANGES.has(record.added_within as AddedDateRange)
    ? record.added_within as AddedDateRange
    : 'all';

  return { query, domain, status, addedWithin };
}

export function resolveKnowledgeSearchDomain(
  requestedDomain: string,
  availableDomains: readonly string[],
) {
  if (requestedDomain.toLowerCase() === 'all') return 'all' as const;
  const normalizedDomain = requestedDomain.toLocaleLowerCase();
  return availableDomains.find((domain) => domain.toLocaleLowerCase() === normalizedDomain) ?? null;
}

export function filterKnowledgeSearchCards<T extends KnowledgeSearchCard>(
  cards: readonly T[],
  filters: KnowledgeSearchFilters,
  now = new Date(),
) {
  const searchTerms = getKnowledgeSearchTerms(filters.query);

  return cards.filter((card) => {
    const domains = getKnowledgeSearchCardDomains(card);
    const searchableText = [
      card.id,
      card.title,
      card.summary ?? '',
      card.explanation ?? '',
      ...domains,
      ...(card.tags ?? []),
    ].join(' ').toLowerCase();
    const matchesFilter = searchTerms.every((term) => searchableText.includes(term));
    const matchesDomain = filters.domain === 'all' || domains.includes(filters.domain);
    const matchesStatus = filters.status === 'all'
      || (filters.status === 'unstarted' ? card.status === null : card.status === filters.status);
    const matchesAddedDate = isWithinAddedDateRangeOrUndated(
      card.createdAt,
      filters.addedWithin,
      now,
    );

    return matchesFilter && matchesDomain && matchesStatus && matchesAddedDate;
  });
}

export function searchPublicKnowledgeCatalog<T extends KnowledgeSearchCard>(
  cards: readonly T[],
  filters: KnowledgeSearchFilters,
  now = new Date(),
) {
  return filterKnowledgeSearchCards(
    cards.filter(isPublicKnowledgeSearchCard),
    { ...filters, status: 'all' },
    now,
  );
}

export function toCompactKnowledgeSearchResults(
  cards: readonly KnowledgeSearchCard[],
  limit = KNOWLEDGE_SEARCH_RESULT_LIMIT,
) {
  const safeLimit = Math.max(0, Math.min(KNOWLEDGE_SEARCH_RESULT_LIMIT, Math.floor(limit)));
  return cards.filter(isPublicKnowledgeSearchCard).slice(0, safeLimit).map((card) => ({
    id: card.id,
    title: card.title,
    domain: getKnowledgeSearchCardDomains(card)[0] ?? card.domain,
  }));
}
