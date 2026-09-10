import {
  sanitizeKnowledgeTags,
  splitKnowledgeTagInput,
} from '@stem-brain/shared';

export {
  MAX_KNOWLEDGE_TAG_CODE_POINTS,
  MAX_KNOWLEDGE_TAG_SUGGESTIONS,
  MAX_KNOWLEDGE_TAGS,
  canonicalizeKnowledgeTag,
  normalizeKnowledgeTag,
  sanitizeKnowledgeTags,
} from '@stem-brain/shared';

export function sanitizeKnowledgeTagFormValues(values: readonly FormDataEntryValue[]): string[] {
  return sanitizeKnowledgeTags(values.flatMap((value) => splitKnowledgeTagInput(String(value))));
}
