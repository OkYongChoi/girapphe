export const MAX_KNOWLEDGE_TAGS = 12;
export const MAX_KNOWLEDGE_TAG_CODE_POINTS = 48;
export const MAX_KNOWLEDGE_TAG_SUGGESTIONS = 500;

export function canonicalizeKnowledgeTag(input: string): string {
  return input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/gu, '-')
    .replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^(?:[-_]|\p{M})+|[-_]+$/gu, '');
}

export function normalizeKnowledgeTag(input: string): string | null {
  const bounded = Array.from(canonicalizeKnowledgeTag(input))
    .slice(0, MAX_KNOWLEDGE_TAG_CODE_POINTS)
    .join('')
    .replace(/^(?:[-_]|\p{M})+|[-_]+$/gu, '');
  return bounded && /[\p{L}\p{N}]/u.test(bounded) && bounded !== 'general' ? bounded : null;
}

export function sanitizeKnowledgeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => normalizeKnowledgeTag(tag))
    .filter((tag): tag is string => tag !== null);
  return Array.from(new Set(normalized)).slice(0, MAX_KNOWLEDGE_TAGS);
}

export function sanitizeKnowledgeTagFormValues(values: readonly FormDataEntryValue[]): string[] {
  return sanitizeKnowledgeTags(values.flatMap((value) => String(value).split(/[,،，]/u)));
}
