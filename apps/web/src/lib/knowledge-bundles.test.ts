import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KNOWLEDGE_BUNDLE_TYPES,
  createKnowledgeBundleContentFromLegacy,
  projectKnowledgeBundleContent,
  type KnowledgeBundleContent,
} from '@stem-brain/shared';
import { parseKnowledgeBundleFields, projectKnowledgeBundle } from './knowledge-bundle-runtime';

const contents: Record<(typeof KNOWLEDGE_BUNDLE_TYPES)[number], KnowledgeBundleContent> = {
  concept: { type: 'concept', definition: 'A stable meaning.', key_points: ['One'], examples: [], non_examples: [], misconceptions: [] },
  procedure: { type: 'procedure', goal: 'Finish safely.', prerequisites: [], steps: [{ title: 'Start', detail: 'Check inputs.' }], branches: [], failure_modes: [], done_when: ['Verified'] },
  comparison: { type: 'comparison', targets: ['A', 'B'], criteria: [{ name: 'Cost', values: ['Low', 'High'] }], commonalities: [], differences: ['A costs less.'], choice_guide: [] },
  mechanism: { type: 'mechanism', causes: ['Input'], stages: [{ title: 'Transform', detail: 'Process input.' }], results: ['Output'], conditions: [], exceptions: [] },
  structure: { type: 'structure', purpose: 'Organize parts.', components: [{ id: 'root', label: 'Root', role: 'Contains children.' }], relations: [], boundaries: ['Private item'] },
  claim_evidence: { type: 'claim_evidence', claim: 'The result is repeatable.', evidence: [{ statement: 'Three independent runs matched.', source: 'run-log' }], counterevidence: [], scope: ['Test data'], limitations: [], confidence: 'high' },
  question: { type: 'question', question: 'What remains unknown?', context: 'A result needs follow-up.', known_facts: ['The first run passed.'], hypotheses: ['The input matters.'], next_steps: ['Run another test.'], answer_summary: '', status: 'open' },
  decision: { type: 'decision', decision: 'Use the protected release flow.', context: 'The change affects production.', options: [{ name: 'Protected PR', tradeoffs: 'Slower but verifiable.' }], criteria: ['Safety'], rationale: ['Checks and ancestry are recorded.'], reconsider_when: ['The release path changes.'], outcome: 'Production is verified.' },
  event: { type: 'event', event: 'The release completed.', occurred_at: '2026-08-28T03:02:19Z', context: 'The exact main revision deployed.', changes: ['The new bundle types became available.'], causes: ['The protected workflow completed.'], consequences: ['Users can create typed knowledge.'] },
  expression: { type: 'expression', expression: 'break the ice', language: 'en', pronunciation: '/breɪk ði aɪs/', meanings: ['Start a friendly conversation.'], translations: [{ language: 'ko', text: '서먹함을 깨다' }], register: 'neutral', nuance: 'Used to reduce initial social tension.', usage_contexts: ['First meetings'], examples: [{ text: 'A joke helped break the ice.', translation: '농담이 서먹함을 깨는 데 도움이 됐다.' }], contrasts: [{ expression: 'get down to business', difference: 'Moves directly to the main topic.' }], common_mistakes: [{ incorrect: 'break an ice', correction: 'break the ice' }] },
};

test('parses all ten version-one bundle discriminators and partial optional fields', () => {
  for (const type of KNOWLEDGE_BUNDLE_TYPES) {
    const parsed = parseKnowledgeBundleFields({
      knowledge_type: type,
      central_question: `How does ${type} work?`,
      structured_content: { type },
      bundle_schema_version: 1,
    });
    assert.equal(parsed?.knowledge_type, type);
    assert.equal(parsed?.structured_content.type, type);
  }
});

test('produces deterministic compatibility projections without serializing empty sections', () => {
  for (const type of KNOWLEDGE_BUNDLE_TYPES) {
    const first = projectKnowledgeBundleContent(contents[type]);
    const second = projectKnowledgeBundle({ structured_content: contents[type] });
    assert.deepEqual(second, first);
    assert.equal(first.content.includes('undefined'), false);
    assert.equal(first.content.includes('[]'), false);
  }
});

test('preserves a legacy note body when starting each explicit bundle conversion', () => {
  const legacy = 'Original user-authored note body';
  for (const type of KNOWLEDGE_BUNDLE_TYPES) {
    const content = createKnowledgeBundleContentFromLegacy(type, legacy);
    assert.match(projectKnowledgeBundleContent(content).content, new RegExp(legacy));
  }
});

test('rejects mismatched types, invalid nested references, unknown fields, and unsupported versions', () => {
  const mismatch = { knowledge_type: 'concept', central_question: 'Why?', structured_content: contents.procedure, bundle_schema_version: 1 };
  assert.equal(parseKnowledgeBundleFields(mismatch), null);

  const invalidStructure = {
    knowledge_type: 'structure', central_question: 'What contains what?', bundle_schema_version: 1,
    structured_content: { type: 'structure', purpose: '', components: [{ id: 'child', label: 'Child', role: '', parent_id: 'missing' }], relations: [], boundaries: [] },
  };
  assert.equal(parseKnowledgeBundleFields(invalidStructure), null);
  const cyclicStructure = {
    knowledge_type: 'structure', central_question: 'What contains what?', bundle_schema_version: 1,
    structured_content: { type: 'structure', purpose: '', components: [{ id: 'one', label: 'One', role: '', parent_id: 'two' }, { id: 'two', label: 'Two', role: '', parent_id: 'one' }], relations: [], boundaries: [] },
  };
  assert.equal(parseKnowledgeBundleFields(cyclicStructure), null);
  assert.equal(parseKnowledgeBundleFields({ ...mismatch, extra: 'rejected' }), null);
  assert.equal(parseKnowledgeBundleFields({ ...mismatch, knowledge_type: 'procedure', bundle_schema_version: 2 }), null);
  assert.equal(parseKnowledgeBundleFields({
    knowledge_type: 'question',
    central_question: 'What remains unknown?',
    structured_content: { ...contents.question, status: 'pending' },
    bundle_schema_version: 1,
  }), null);
  assert.equal(parseKnowledgeBundleFields({
    knowledge_type: 'event', central_question: 'When?', bundle_schema_version: 1,
    structured_content: { ...contents.event, chronology: { precision: 'century', start: { era: 'bce', year: 5 } } },
  })?.structured_content.type, 'event');
  assert.equal(parseKnowledgeBundleFields({
    knowledge_type: 'event', central_question: 'When?', bundle_schema_version: 1,
    structured_content: { ...contents.event, chronology: { precision: 'range', start: { era: 'ce', year: 1 } } },
  }), null);
  assert.equal(parseKnowledgeBundleFields({
    knowledge_type: 'expression', central_question: 'How is it used?', bundle_schema_version: 1,
    structured_content: { ...contents.expression, language: 'not a language tag' },
  }), null);
});
