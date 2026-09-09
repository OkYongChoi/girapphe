import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_KNOWLEDGE_TAGS } from '@stem-brain/shared';
import {
  MAX_RENDERED_MOBILE_TAG_SUGGESTIONS,
  commitMobileKnowledgeTagDraft,
  filterMobileKnowledgeTagSuggestions,
  removeMobileKnowledgeTag,
  updateMobileKnowledgeTagDraft,
} from './mobile-knowledge-tags';

test('mobile tag entry commits ASCII, Arabic, and full-width comma segments', () => {
  const next = updateMobileKnowledgeTagDraft([], 'Machine Learning,العَرَبِيَّة，日本語');
  assert.deepEqual(next.tags, ['machine-learning', 'العَرَبِيَّة']);
  assert.equal(next.draft, '日本語');
  assert.deepEqual(commitMobileKnowledgeTagDraft(next.tags, next.draft).tags, [
    'machine-learning', 'العَرَبِيَّة', '日本語',
  ]);
});

test('mobile tag entry rejects reserved or punctuation-only tags and enforces the shared cap', () => {
  assert.equal(commitMobileKnowledgeTagDraft([], 'general').notice, 'invalid');
  assert.equal(commitMobileKnowledgeTagDraft([], '!!!').notice, 'invalid');
  const full = Array.from({ length: MAX_KNOWLEDGE_TAGS }, (_, index) => `tag-${index + 1}`);
  const limited = commitMobileKnowledgeTagDraft(full, 'another');
  assert.equal(limited.notice, 'limit');
  assert.deepEqual(limited.tags, full);
  const longDraft = updateMobileKnowledgeTagDraft([], 'a'.repeat(49));
  assert.equal(longDraft.notice, 'length');
  assert.equal(Array.from(longDraft.draft).length, 48);
});

test('mobile tag suggestions exclude selected values, search canonically, and stay render-bounded', () => {
  const suggestions = ['machine-learning', ...Array.from({ length: 40 }, (_, index) => `tag-${index}`)];
  assert.deepEqual(
    filterMobileKnowledgeTagSuggestions(suggestions, ['machine-learning'], 'TAG 1').slice(0, 3),
    ['tag-1', 'tag-10', 'tag-11'],
  );
  assert.equal(
    filterMobileKnowledgeTagSuggestions(suggestions, [], '').length,
    MAX_RENDERED_MOBILE_TAG_SUGGESTIONS,
  );
  assert.deepEqual(removeMobileKnowledgeTag(['one', 'two'], 'one'), ['two']);
});
