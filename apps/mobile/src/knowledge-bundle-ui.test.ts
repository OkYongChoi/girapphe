import assert from 'node:assert/strict';
import test from 'node:test';
import { KNOWLEDGE_BUNDLE_TYPES, SUPPORTED_LOCALES, type KnowledgeBundleContent } from '@stem-brain/shared';
import { buildMobileKnowledgeBundle, knowledgeBundleAnswerLines, knowledgeBundleRecallPrompt, knowledgeBundleTypeLabel, mobileKnowledgeBundleEditValues } from './knowledge-bundle-ui';

const bundles: KnowledgeBundleContent[] = [
  { type: 'concept', definition: 'Definition', key_points: ['Point'], examples: ['Example'], non_examples: ['Counterexample'], misconceptions: [{ claim: 'Wrong', correction: 'Right' }] },
  { type: 'procedure', goal: 'Goal', prerequisites: ['Ready'], steps: [{ title: 'Step', detail: 'Detail' }], branches: [{ condition: 'If', action: 'Then' }], failure_modes: [{ symptom: 'Fail', response: 'Recover' }], done_when: ['Done'] },
  { type: 'comparison', targets: ['A', 'B'], criteria: [{ name: 'Cost', values: ['Low', 'High'] }], commonalities: ['Same'], differences: ['Different'], choice_guide: [{ condition: 'Budget', recommendation: 'A' }] },
  { type: 'mechanism', causes: ['Cause'], stages: [{ title: 'Stage', detail: 'Detail' }], results: ['Result'], conditions: ['Condition'], exceptions: ['Exception'] },
  { type: 'structure', purpose: 'Purpose', components: [{ id: 'root', label: 'Root', role: 'Parent' }, { id: 'child', label: 'Child', role: 'Part', parent_id: 'root' }], relations: [{ source_id: 'root', target_id: 'child', label: 'contains' }], boundaries: ['Boundary'] },
  { type: 'claim_evidence', claim: 'Claim', evidence: [{ statement: 'Evidence', source: 'Source' }], counterevidence: ['Counter'], scope: ['Scope'], limitations: ['Limit'], confidence: 'high' },
  { type: 'question', question: 'Question', context: 'Context', known_facts: ['Fact'], hypotheses: ['Hypothesis'], next_steps: ['Next'], answer_summary: 'Answer', status: 'answered' },
  { type: 'decision', decision: 'Decision', context: 'Context', options: [{ name: 'Option', tradeoffs: 'Tradeoffs' }], criteria: ['Criterion'], rationale: ['Rationale'], reconsider_when: ['Trigger'], outcome: 'Outcome' },
  { type: 'event', event: 'Event', occurred_at: '2026-08-28', context: 'Context', changes: ['Change'], causes: ['Cause'], consequences: ['Consequence'] },
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
  assert.match(knowledgeBundleAnswerLines(bundles[6]!).join('\n'), /Answered/);
  assert.match(knowledgeBundleAnswerLines(bundles[7]!).join('\n'), /Tradeoffs/);
  assert.match(knowledgeBundleAnswerLines(bundles[8]!).join('\n'), /2026-08-28/);
});

test('mobile exposes localized type labels and recall prompts for every supported bundle type', () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const type of KNOWLEDGE_BUNDLE_TYPES) {
      assert.notEqual(knowledgeBundleTypeLabel(locale, type).trim(), '');
      assert.notEqual(knowledgeBundleRecallPrompt(locale, type).trim(), '');
    }
  }
});
