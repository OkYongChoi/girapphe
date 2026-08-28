import assert from 'node:assert/strict';
import test from 'node:test';
import { KNOWLEDGE_BUNDLE_TYPES, projectKnowledgeBundleContent, type KnowledgeBundleContent } from '@stem-brain/shared';
import { parseKnowledgeBundleFields, projectKnowledgeBundle } from './knowledge-bundle-runtime';

const contents: Record<(typeof KNOWLEDGE_BUNDLE_TYPES)[number], KnowledgeBundleContent> = {
  concept: { type: 'concept', definition: 'A stable meaning.', key_points: ['One'], examples: [], non_examples: [], misconceptions: [] },
  procedure: { type: 'procedure', goal: 'Finish safely.', prerequisites: [], steps: [{ title: 'Start', detail: 'Check inputs.' }], branches: [], failure_modes: [], done_when: ['Verified'] },
  comparison: { type: 'comparison', targets: ['A', 'B'], criteria: [{ name: 'Cost', values: ['Low', 'High'] }], commonalities: [], differences: ['A costs less.'], choice_guide: [] },
  mechanism: { type: 'mechanism', causes: ['Input'], stages: [{ title: 'Transform', detail: 'Process input.' }], results: ['Output'], conditions: [], exceptions: [] },
  structure: { type: 'structure', purpose: 'Organize parts.', components: [{ id: 'root', label: 'Root', role: 'Contains children.' }], relations: [], boundaries: ['Private item'] },
  claim_evidence: { type: 'claim_evidence', claim: 'The result is repeatable.', evidence: [{ statement: 'Three independent runs matched.', source: 'run-log' }], counterevidence: [], scope: ['Test data'], limitations: [], confidence: 'high' },
};

test('parses all six version-one bundle discriminators and partial optional fields', () => {
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
});
