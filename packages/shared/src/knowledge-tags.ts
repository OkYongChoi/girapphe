export const MAX_KNOWLEDGE_TAGS = 12;
export const MAX_KNOWLEDGE_TAG_CODE_POINTS = 48;
export const MAX_KNOWLEDGE_TAG_SUGGESTIONS = 500;

function trimKnowledgeTagBoundaries(input: string): string {
  return input.replace(/^(?:[-_]|\p{M})+|[-_]+$/gu, '');
}

export function canonicalizeKnowledgeTag(input: string): string {
  return trimKnowledgeTagBoundaries(input
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/gu, '-')
    .replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '')
    .replace(/-{2,}/g, '-'));
}

function isMeaningfulKnowledgeTag(input: string): boolean {
  return Boolean(input) && /[\p{L}\p{N}]/u.test(input) && input !== 'general';
}

export function normalizeKnowledgeTag(input: string): string | null {
  const bounded = trimKnowledgeTagBoundaries(Array.from(canonicalizeKnowledgeTag(input))
    .slice(0, MAX_KNOWLEDGE_TAG_CODE_POINTS)
    .join(''));
  return isMeaningfulKnowledgeTag(bounded) ? bounded : null;
}

export function sanitizeKnowledgeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const normalized = tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => normalizeKnowledgeTag(tag))
    .filter((tag): tag is string => tag !== null);
  return Array.from(new Set(normalized)).slice(0, MAX_KNOWLEDGE_TAGS);
}

export function splitKnowledgeTagInput(input: string): string[] {
  return input
    .split(/[,،，]/u)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseStrictKnowledgeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const normalized = new Set<string>();
  for (const input of value) {
    if (typeof input !== 'string') return null;
    const tag = canonicalizeKnowledgeTag(input);
    if (!isMeaningfulKnowledgeTag(tag)) return null;
    if (Array.from(tag).length > MAX_KNOWLEDGE_TAG_CODE_POINTS) return null;
    normalized.add(tag);
    if (normalized.size > MAX_KNOWLEDGE_TAGS) return null;
  }
  return Array.from(normalized);
}
