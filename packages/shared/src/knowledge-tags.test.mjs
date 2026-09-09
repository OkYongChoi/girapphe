import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_KNOWLEDGE_TAG_CODE_POINTS,
  MAX_KNOWLEDGE_TAGS,
  canonicalizeKnowledgeTag,
  collectKnowledgeTagSuggestions,
  normalizeKnowledgeTag,
  parseStrictKnowledgeTags,
  sanitizeKnowledgeTags,
  splitKnowledgeTagInput,
} from './knowledge-tags.ts';

test('knowledge tag input recognizes ASCII, Arabic, and fullwidth commas', () => {
  assert.deepEqual(
    splitKnowledgeTagInput('machine learning، العربية，量子力学,  '),
    ['machine learning', 'العربية', '量子力学'],
  );
});

test('owner tag suggestions remain frequency-ranked, deterministic, and bounded', () => {
  const uniqueTags = Array.from({ length: 521 }, (_, index) => `tag-${String(index).padStart(3, '0')}`);
  const suggestions = collectKnowledgeTagSuggestions(
    [uniqueTags, ['ZZ Top', 'zz/top', '!!!', 'general']],
    'en',
    500,
  );
  assert.equal(suggestions.length, 500);
  assert.equal(suggestions[0], 'zz-top');
  assert.equal(suggestions[1], 'tag-000');
  assert.equal(suggestions.at(-1), 'tag-498');
});

test('strict API tags normalize before validating Unicode code-point length', () => {
  const maximumAstralTag = '𠮷'.repeat(MAX_KNOWLEDGE_TAG_CODE_POINTS);
  const tooLongAstralTag = `${maximumAstralTag}𠮷`;

  assert.deepEqual(parseStrictKnowledgeTags([maximumAstralTag]), [maximumAstralTag]);
  assert.equal(parseStrictKnowledgeTags([tooLongAstralTag]), null);
  assert.equal(parseStrictKnowledgeTags(['㌀'.repeat(13)]), null);
  assert.deepEqual(
    parseStrictKnowledgeTags([' Machine / Learning ', 'machine learning']),
    ['machine-learning'],
  );
});

test('strict API tags reject invalid shapes while permissive form tags retain existing bounds', () => {
  assert.equal(parseStrictKnowledgeTags('tag'), null);
  assert.equal(parseStrictKnowledgeTags(['valid', 7]), null);
  assert.equal(parseStrictKnowledgeTags(['!!!']), null);
  assert.equal(parseStrictKnowledgeTags(['general']), null);
  assert.equal(canonicalizeKnowledgeTag('  Machine / Learning  '), 'machine-learning');
  assert.equal(normalizeKnowledgeTag('!!!'), null);
  assert.deepEqual(
    sanitizeKnowledgeTags(['Machine Learning', 'machine/learning', 'general']),
    ['machine-learning'],
  );
});

test('strict API tag count is enforced after canonicalization and deduplication', () => {
  assert.equal(
    parseStrictKnowledgeTags(Array.from(
      { length: MAX_KNOWLEDGE_TAGS + 1 },
      (_, index) => `tag-${index}`,
    )),
    null,
  );
  assert.deepEqual(
    parseStrictKnowledgeTags(Array.from(
      { length: MAX_KNOWLEDGE_TAGS + 1 },
      (_, index) => index % 2 === 0
        ? ' Machine / Learning '
        : 'ＭＡＣＨＩＮＥ　／　ＬＥＡＲＮＩＮＧ',
    )),
    ['machine-learning'],
  );
});
