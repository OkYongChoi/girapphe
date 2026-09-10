import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_MOBILE_KNOWLEDGE_MUTATION_BYTES } from './mobile-knowledge.ts';

test('the mobile knowledge mutation limit accepts the JSON-escaped expression worst case', () => {
  const worstCaseCodeUnit = '\u0001';
  const detail = worstCaseCodeUnit.repeat(6_000);
  const short = worstCaseCodeUnit.repeat(500);
  const details = Array.from({ length: 24 }, () => detail);
  const payload = {
    action: 'create-note',
    title: worstCaseCodeUnit.repeat(240),
    summary: short,
    content: worstCaseCodeUnit.repeat(8_000),
    topic: worstCaseCodeUnit.repeat(120),
    tags: Array.from({ length: 12 }, () => '界'.repeat(48)),
    requestId: 'r'.repeat(160),
    knowledge_type: 'expression',
    central_question: short,
    bundle_schema_version: 1,
    structured_content: {
      type: 'expression',
      expression: worstCaseCodeUnit.repeat(4_000),
      language: 'zh-Hans',
      pronunciation: short,
      meanings: details,
      translations: Array.from({ length: 24 }, () => ({ language: 'zh-Hans', text: worstCaseCodeUnit.repeat(4_000) })),
      register: short,
      nuance: worstCaseCodeUnit.repeat(4_000),
      usage_contexts: details,
      examples: Array.from({ length: 24 }, () => ({
        text: worstCaseCodeUnit.repeat(4_000),
        translation: worstCaseCodeUnit.repeat(4_000),
        note: worstCaseCodeUnit.repeat(4_000),
      })),
      contrasts: Array.from({ length: 24 }, () => ({
        expression: short,
        difference: worstCaseCodeUnit.repeat(4_000),
      })),
      common_mistakes: Array.from({ length: 24 }, () => ({
        incorrect: short,
        correction: worstCaseCodeUnit.repeat(4_000),
      })),
    },
  };

  const bytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  assert.ok(bytes > 4_194_304, `${bytes} must exercise the former undersized limit`);
  assert.ok(bytes < MAX_MOBILE_KNOWLEDGE_MUTATION_BYTES, `${bytes} must fit the bounded native mutation contract`);
  assert.equal(MAX_MOBILE_KNOWLEDGE_MUTATION_BYTES, 6_291_456);
});
