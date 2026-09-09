import assert from 'node:assert/strict';
import test from 'node:test';
import { collectKnowledgeTagSuggestions } from './knowledge-tag-suggestions';

test('tag suggestions are canonical, frequency-ranked, deterministic, and bounded before serialization', () => {
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
  assert.equal(suggestions.includes('tag-520'), false);
});
