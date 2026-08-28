import assert from 'node:assert/strict';
import test from 'node:test';
import type { KnowledgeBundleContent } from '@stem-brain/shared';
import { buildMobileKnowledgeBundle, knowledgeBundleAnswerLines, mobileKnowledgeBundleEditValues } from './knowledge-bundle-ui';

const bundles: KnowledgeBundleContent[] = [
  { type: 'concept', definition: 'Definition', key_points: ['Point'], examples: ['Example'], non_examples: ['Counterexample'], misconceptions: [{ claim: 'Wrong', correction: 'Right' }] },
  { type: 'procedure', goal: 'Goal', prerequisites: ['Ready'], steps: [{ title: 'Step', detail: 'Detail' }], branches: [{ condition: 'If', action: 'Then' }], failure_modes: [{ symptom: 'Fail', response: 'Recover' }], done_when: ['Done'] },
  { type: 'comparison', targets: ['A', 'B'], criteria: [{ name: 'Cost', values: ['Low', 'High'] }], commonalities: ['Same'], differences: ['Different'], choice_guide: [{ condition: 'Budget', recommendation: 'A' }] },
  { type: 'mechanism', causes: ['Cause'], stages: [{ title: 'Stage', detail: 'Detail' }], results: ['Result'], conditions: ['Condition'], exceptions: ['Exception'] },
  { type: 'structure', purpose: 'Purpose', components: [{ id: 'root', label: 'Root', role: 'Parent' }, { id: 'child', label: 'Child', role: 'Part', parent_id: 'root' }], relations: [{ source_id: 'root', target_id: 'child', label: 'contains' }], boundaries: ['Boundary'] },
  { type: 'claim_evidence', claim: 'Claim', evidence: [{ statement: 'Evidence', source: 'Source' }], counterevidence: ['Counter'], scope: ['Scope'], limitations: ['Limit'], confidence: 'high' },
];

test('mobile full-field editors round-trip every version-one bundle type without data loss', () => {
  for (const bundle of bundles) {
    const fields = mobileKnowledgeBundleEditValues(bundle);
    assert.deepEqual(buildMobileKnowledgeBundle(bundle.type, fields), bundle);
  }
});

test('mobile structured answers expose every populated field', () => {
  for (const bundle of bundles) {
    const answer = knowledgeBundleAnswerLines(bundle).join('\n');
    assert.ok(answer.length > 0);
  }
  assert.match(knowledgeBundleAnswerLines(bundles[1]!).join('\n'), /Recover/);
  assert.match(knowledgeBundleAnswerLines(bundles[4]!).join('\n'), /contains/);
  assert.match(knowledgeBundleAnswerLines(bundles[5]!).join('\n'), /Source/);
});
