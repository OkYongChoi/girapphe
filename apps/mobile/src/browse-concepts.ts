import type { GraphNode } from '@stem-brain/graph-engine';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';

export type PersonalBrowseConcept = {
  id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  knowledge_type?: KnowledgeBundleType | null;
  central_question?: string | null;
  structured_content?: KnowledgeBundleContent | null;
  bundle_schema_version?: number | null;
};

export type BrowseConcept =
  | { kind: 'public'; id: string; node: GraphNode }
  | { kind: 'personal'; id: `personal:${string}`; note: PersonalBrowseConcept };

type PersonalConceptFilter = {
  query: string;
  domain: string;
  difficulty: 'All' | number;
  locale: string;
  knowledgeType?: 'all' | 'legacy' | KnowledgeBundleType;
};

function normalizeBrowseSearch(value: string, locale: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase(locale)
    .replace(/^#+/u, '')
    .replace(/[\s/_-]+/gu, ' ');
}

export function isCurrentPrivateGraphOwner(
  isSignedIn: boolean | undefined,
  currentUserId: string | null | undefined,
  graphOwnerId: string | null,
) {
  return Boolean(isSignedIn && currentUserId && graphOwnerId === currentUserId);
}

export function canonicalizeBrowseDomain(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s/_-]+/gu, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function mergeBrowseDomains(
  publicDomains: readonly string[],
  personalNotes: readonly PersonalBrowseConcept[],
) {
  const domains = new Map<string, string>();
  const candidates = [
    ...publicDomains.filter((domain) => domain !== 'All'),
    ...personalNotes.map((note) => note.topic),
  ];

  for (const candidate of candidates) {
    const value = candidate.trim();
    const key = canonicalizeBrowseDomain(value);
    if (key && key !== 'all' && !domains.has(key)) domains.set(key, value);
  }

  return ['All', ...domains.values()];
}

export function resolveBrowseDomain(
  selectedDomain: string,
  publicDomains: readonly string[],
  personalNotes: readonly PersonalBrowseConcept[],
) {
  const selectedKey = canonicalizeBrowseDomain(selectedDomain);
  return mergeBrowseDomains(publicDomains, personalNotes)
    .find((domain) => canonicalizeBrowseDomain(domain) === selectedKey) ?? 'All';
}

export function filterPersonalBrowseConcepts<T extends PersonalBrowseConcept>(
  notes: readonly T[],
  { query, domain, difficulty, locale, knowledgeType = 'all' }: PersonalConceptFilter,
): T[] {
  if (difficulty !== 'All') return [];

  const normalizedQuery = normalizeBrowseSearch(query, locale);
  const normalizedDomain = canonicalizeBrowseDomain(domain);

  return notes.filter((note) => {
    const matchesDomain = domain === 'All' || canonicalizeBrowseDomain(note.topic) === normalizedDomain;
    const matchesType = knowledgeType === 'all'
      || (knowledgeType === 'legacy' ? !note.knowledge_type : note.knowledge_type === knowledgeType);
    if (!matchesDomain || !matchesType) return false;
    if (!normalizedQuery) return true;

    return [note.title, note.summary, note.content, note.topic, note.central_question, note.knowledge_type, ...(note.tags ?? [])]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => normalizeBrowseSearch(value, locale).includes(normalizedQuery));
  });
}

export function mergeBrowseConcepts(
  publicNodes: readonly GraphNode[],
  personalNotes: readonly PersonalBrowseConcept[],
): BrowseConcept[] {
  return [
    ...personalNotes.map((note) => ({
      kind: 'personal' as const,
      id: `personal:${note.id}` as const,
      note,
    })),
    ...publicNodes.map((node) => ({ kind: 'public' as const, id: node.id, node })),
  ];
}
