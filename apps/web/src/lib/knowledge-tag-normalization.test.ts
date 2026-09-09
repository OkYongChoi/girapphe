import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_KNOWLEDGE_TAG_CODE_POINTS,
  MAX_KNOWLEDGE_TAGS,
  normalizeKnowledgeTag,
  sanitizeKnowledgeTagFormValues,
  sanitizeKnowledgeTags,
} from './knowledge-tag-normalization';

test('knowledge tags share canonical separator, punctuation, and reserved-tag handling', () => {
  assert.equal(normalizeKnowledgeTag('  Machine / Learning  '), 'machine-learning');
  assert.equal(normalizeKnowledgeTag(`${'!'.repeat(60)}Tail Value`), 'tail-value');
  assert.equal(normalizeKnowledgeTag('!!!'), null);
  assert.equal(normalizeKnowledgeTag('general'), null);
  assert.deepEqual(
    sanitizeKnowledgeTags(['Machine Learning', 'machine/learning', '!!!', 'general', 'use_case']),
    ['machine-learning', 'use_case'],
  );
});

test('knowledge tags are bounded by Unicode code points and tag count', () => {
  const longTag = '知'.repeat(MAX_KNOWLEDGE_TAG_CODE_POINTS + 1);
  assert.equal(Array.from(normalizeKnowledgeTag(longTag) ?? '').length, MAX_KNOWLEDGE_TAG_CODE_POINTS);
  assert.deepEqual(
    sanitizeKnowledgeTags(Array.from({ length: MAX_KNOWLEDGE_TAGS + 1 }, (_, index) => `tag-${index + 1}`)),
    Array.from({ length: MAX_KNOWLEDGE_TAGS }, (_, index) => `tag-${index + 1}`),
  );
});

test('knowledge tags preserve meaningful combining marks across supported scripts', () => {
  assert.equal(normalizeKnowledgeTag('हिंदी ज्ञान'), 'हिंदी-ज्ञान');
  assert.equal(normalizeKnowledgeTag('العَرَبِيَّة'), 'العَرَبِيَّة');
  assert.equal(normalizeKnowledgeTag('\u0301abc'), 'abc');
  assert.equal(normalizeKnowledgeTag('-_\u0651abc'), 'abc');
  assert.equal(normalizeKnowledgeTag('\u0301\u0651'), null);
});

test('knowledge tags trim separators introduced at the code-point boundary', () => {
  const prefix = 'a'.repeat(MAX_KNOWLEDGE_TAG_CODE_POINTS - 1);
  assert.equal(normalizeKnowledgeTag(`${prefix}-trailing`), prefix);
  assert.equal(normalizeKnowledgeTag(`${prefix}_trailing`), prefix);
});

test('knowledge tag form values preserve the serialized selection and a progressive draft', () => {
  assert.deepEqual(
    sanitizeKnowledgeTagFormValues(['original, existing', 'new،日本語']),
    ['original', 'existing', 'new', '日本語'],
  );
});
