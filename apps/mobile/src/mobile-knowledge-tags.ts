import {
  MAX_KNOWLEDGE_TAG_CODE_POINTS,
  MAX_KNOWLEDGE_TAGS,
  canonicalizeKnowledgeTag,
  normalizeKnowledgeTag,
  sanitizeKnowledgeTags,
} from '@stem-brain/shared';

export const MAX_RENDERED_MOBILE_TAG_SUGGESTIONS = 24;
const MAX_RAW_MOBILE_TAG_DRAFT_CODE_POINTS = 96;
const TAG_SEPARATOR = /[,،，]/u;

export type MobileKnowledgeTagNotice = 'invalid' | 'length' | 'limit' | null;

export type MobileKnowledgeTagDraftState = {
  tags: string[];
  draft: string;
  notice: MobileKnowledgeTagNotice;
};

function constrainDraft(value: string) {
  const normalized = value.normalize('NFKC');
  const rawCodePoints = Array.from(normalized);
  const canonicalCodePoints = Array.from(canonicalizeKnowledgeTag(normalized));
  const shouldUseCanonical = canonicalCodePoints.length > MAX_KNOWLEDGE_TAG_CODE_POINTS
    || rawCodePoints.length > MAX_RAW_MOBILE_TAG_DRAFT_CODE_POINTS;
  return {
    value: shouldUseCanonical
      ? canonicalCodePoints.slice(0, MAX_KNOWLEDGE_TAG_CODE_POINTS).join('')
      : normalized,
    truncated: shouldUseCanonical,
  };
}

export function updateMobileKnowledgeTagDraft(
  selectedTags: readonly string[],
  value: string,
): MobileKnowledgeTagDraftState {
  const segments = value.normalize('NFKC').split(TAG_SEPARATOR);
  const trailing = segments.pop() ?? '';
  const bounded = constrainDraft(trailing);
  if (segments.length === 0) {
    return {
      tags: sanitizeKnowledgeTags(selectedTags),
      draft: bounded.value,
      notice: bounded.truncated ? 'length' : null,
    };
  }

  const nonEmptySegments = segments.filter((segment) => segment.trim());
  const nextTags = sanitizeKnowledgeTags([...selectedTags, ...nonEmptySegments]);
  const containsInvalid = nonEmptySegments.some((segment) => normalizeKnowledgeTag(segment) === null);
  const hitLimit = nextTags.length >= MAX_KNOWLEDGE_TAGS
    && nonEmptySegments.some((segment) => {
      const normalized = normalizeKnowledgeTag(segment);
      return normalized !== null && !selectedTags.includes(normalized);
    });
  return {
    tags: nextTags,
    draft: nextTags.length >= MAX_KNOWLEDGE_TAGS ? '' : bounded.value,
    notice: hitLimit ? 'limit' : containsInvalid ? 'invalid' : bounded.truncated ? 'length' : null,
  };
}

export function commitMobileKnowledgeTagDraft(
  selectedTags: readonly string[],
  draft: string,
): MobileKnowledgeTagDraftState {
  const tags = sanitizeKnowledgeTags(selectedTags);
  if (!draft.trim()) return { tags, draft: '', notice: null };
  if (tags.length >= MAX_KNOWLEDGE_TAGS) return { tags, draft: '', notice: 'limit' };
  const normalized = normalizeKnowledgeTag(draft);
  if (!normalized) return { tags, draft: '', notice: 'invalid' };
  const nextTags = sanitizeKnowledgeTags([...tags, normalized]);
  return {
    tags: nextTags,
    draft: '',
    notice: nextTags.length >= MAX_KNOWLEDGE_TAGS ? 'limit' : null,
  };
}

export function removeMobileKnowledgeTag(selectedTags: readonly string[], tag: string): string[] {
  return sanitizeKnowledgeTags(selectedTags).filter((candidate) => candidate !== tag);
}

export function filterMobileKnowledgeTagSuggestions(
  suggestions: readonly string[],
  selectedTags: readonly string[],
  query: string,
): string[] {
  const selected = new Set(sanitizeKnowledgeTags(selectedTags));
  const normalizedQuery = canonicalizeKnowledgeTag(query);
  return Array.from(new Set(suggestions))
    .filter((tag) => !selected.has(tag) && (!normalizedQuery || tag.includes(normalizedQuery)))
    .slice(0, MAX_RENDERED_MOBILE_TAG_SUGGESTIONS);
}
