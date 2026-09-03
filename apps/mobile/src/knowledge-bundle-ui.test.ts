import assert from 'node:assert/strict';
import test from 'node:test';
import { KNOWLEDGE_BUNDLE_TYPES, SUPPORTED_LOCALES, type KnowledgeBundleContent } from '@stem-brain/shared';
import { buildMobileKnowledgeBundle, expressionHasReverseRecallCue, expressionRecallCue, knowledgeBundleAnswerLines, knowledgeBundleRecallPrompt, knowledgeBundleTypeLabel, mobileKnowledgeBundleEditValues, parseMobileChronology } from './knowledge-bundle-ui';

const bundles: KnowledgeBundleContent[] = [
  { type: 'concept', definition: 'Definition', key_points: ['Point'], examples: ['Example'], non_examples: ['Counterexample'], misconceptions: [{ claim: 'Wrong', correction: 'Right' }] },
  { type: 'procedure', goal: 'Goal', prerequisites: ['Ready'], steps: [{ title: 'Step', detail: 'Detail' }], branches: [{ condition: 'If', action: 'Then' }], failure_modes: [{ symptom: 'Fail', response: 'Recover' }], done_when: ['Done'] },
  { type: 'comparison', targets: ['A', 'B'], criteria: [{ name: 'Cost', values: ['Low', 'High'] }], commonalities: ['Same'], differences: ['Different'], choice_guide: [{ condition: 'Budget', recommendation: 'A' }] },
  { type: 'mechanism', causes: ['Cause'], stages: [{ title: 'Stage', detail: 'Detail' }], results: ['Result'], conditions: ['Condition'], exceptions: ['Exception'] },
  { type: 'structure', purpose: 'Purpose', components: [{ id: 'root', label: 'Root', role: 'Parent' }, { id: 'child', label: 'Child', role: 'Part', parent_id: 'root' }], relations: [{ source_id: 'root', target_id: 'child', label: 'contains' }], boundaries: ['Boundary'] },
  { type: 'claim_evidence', claim: 'Claim', evidence: [{ statement: 'Evidence', source: 'Source' }], counterevidence: ['Counter'], scope: ['Scope'], limitations: ['Limit'], confidence: 'high' },
  { type: 'question', question: 'Question', context: 'Context', known_facts: ['Fact'], hypotheses: ['Hypothesis'], next_steps: ['Next'], answer_summary: 'Answer', status: 'answered' },
  { type: 'decision', decision: 'Decision', context: 'Context', options: [{ name: 'Option', tradeoffs: 'Tradeoffs' }], criteria: ['Criterion'], rationale: ['Rationale'], reconsider_when: ['Trigger'], outcome: 'Outcome' },
  { type: 'event', event: 'Event', occurred_at: '', chronology: { precision: 'range', start: { era: 'bce', year: 300 }, end: { era: 'bce', year: 250 } }, context: 'Context', changes: ['Change'], causes: ['Cause'], consequences: ['Consequence'] },
  { type: 'expression', expression: 'break the ice', language: 'en', pronunciation: '/breɪk ði aɪs/', meanings: ['Start a conversation'], translations: [{ language: 'ko', text: '서먹함을 깨다' }, { language: 'ja', text: '緊張をほぐす' }], register: 'neutral', nuance: 'Friendly', usage_contexts: ['First meeting'], examples: [{ text: 'A joke broke the ice.', translation: '농담으로 서먹함이 풀렸다.', note: 'Past tense' }], contrasts: [{ expression: 'get down to business', difference: 'More direct' }], common_mistakes: [{ incorrect: 'break an ice', correction: 'break the ice' }] },
];

test('mobile full-field editors round-trip every version-one bundle type without data loss', () => {
  for (const bundle of bundles) {
    const fields = mobileKnowledgeBundleEditValues(bundle);
    assert.deepEqual(buildMobileKnowledgeBundle(bundle.type, fields), bundle);
  }
});

test('mobile scalar prose editors preserve complete visual directive source', () => {
  const flow = ':::flow\n["Input", "Output", "produces"]\n["\\\\(m\\\\)", "\\\\(E = mc^2\\\\)", "maps to"]\n:::';
  const timeline = ':::timeline\n["1905", "Special relativity", "Mass and energy are related"]\n["1915", "General relativity"]\n:::';

  const concept = buildMobileKnowledgeBundle('concept', [flow, '', '', '', '']);
  assert.equal(concept.type, 'concept');
  assert.equal(concept.definition, flow);
  assert.equal(mobileKnowledgeBundleEditValues(concept)[0], flow);

  const question = buildMobileKnowledgeBundle('question', ['What changed?', timeline, '', '', '', '', 'open']);
  assert.equal(question.type, 'question');
  assert.equal(question.context, timeline);
  assert.equal(mobileKnowledgeBundleEditValues(question)[1], timeline);
});

test('mobile rejects invalid non-empty chronology instead of silently deleting it', () => {
  assert.equal(parseMobileChronology(''), undefined);
  assert.equal(parseMobileChronology('range :: ce :: 2026 :: 2 :: 29 :: ce :: 2025'), null);
  assert.equal(parseMobileChronology('exact :: ce :: 2026 :: 1 :: 1 :: ce :: 2027 :: 1 :: 1'), null);
  assert.throws(
    () => buildMobileKnowledgeBundle('event', ['Event', '', '', '', '', '', 'range :: ce :: 2026 :: 1 :: 1 :: ce :: 2025 :: 1 :: 1']),
    /valid event chronology/,
  );
});

test('mobile multi-column editors preserve inline code with :: and | across bundle types', () => {
  const code = '`std::vector`';
  const expressionCode = '`a | b`';
  const withStructuredRows: KnowledgeBundleContent[] = [
    { ...bundles[0] as Extract<KnowledgeBundleContent, { type: 'concept' }>, misconceptions: [{ claim: code, correction: expressionCode }] },
    { ...bundles[1] as Extract<KnowledgeBundleContent, { type: 'procedure' }>, steps: [{ title: code, detail: expressionCode }], branches: [{ condition: expressionCode, action: code }], failure_modes: [{ symptom: code, response: expressionCode }] },
    { ...bundles[2] as Extract<KnowledgeBundleContent, { type: 'comparison' }>, criteria: [{ name: code, values: [expressionCode, 'x :: y'] }], choice_guide: [{ condition: expressionCode, recommendation: code }] },
    { ...bundles[3] as Extract<KnowledgeBundleContent, { type: 'mechanism' }>, stages: [{ title: code, detail: expressionCode }] },
    { ...bundles[4] as Extract<KnowledgeBundleContent, { type: 'structure' }>, components: [{ id: 'root', label: code, role: expressionCode }, { id: 'child', label: expressionCode, role: 'x :: y', parent_id: 'root' }], relations: [{ source_id: 'root', target_id: 'child', label: `${code} → ${expressionCode}` }] },
    { ...bundles[5] as Extract<KnowledgeBundleContent, { type: 'claim_evidence' }>, evidence: [{ statement: code, source: expressionCode }] },
    { ...bundles[7] as Extract<KnowledgeBundleContent, { type: 'decision' }>, options: [{ name: code, tradeoffs: expressionCode }] },
  ];

  for (const bundle of withStructuredRows) {
    assert.deepEqual(buildMobileKnowledgeBundle(bundle.type, mobileKnowledgeBundleEditValues(bundle)), bundle);
  }

  const expression = bundles[9];
  assert.equal(expression?.type, 'expression');
  if (!expression || expression.type !== 'expression') return;
  const withDelimiters: KnowledgeBundleContent = {
    ...expression,
    translations: [{ language: code, text: expressionCode }],
    examples: [{ text: code, translation: expressionCode, note: 'C:\\names :: note' }],
    contrasts: [{ expression: code, difference: expressionCode }],
    common_mistakes: [{ incorrect: expressionCode, correction: code }],
  };
  assert.deepEqual(
    buildMobileKnowledgeBundle('expression', mobileKnowledgeBundleEditValues(withDelimiters)),
    withDelimiters,
  );
  const directFields = mobileKnowledgeBundleEditValues(expression);
  directFields[8] = 'namespace :: name';
  const direct = buildMobileKnowledgeBundle('expression', directFields);
  assert.equal(direct.type, 'expression');
  assert.deepEqual(direct.examples, [{ text: 'namespace :: name' }]);

  const partialPair = mobileKnowledgeBundleEditValues(bundles[0]!);
  partialPair[4] = '["`std::vector`"';
  assert.throws(() => buildMobileKnowledgeBundle('concept', partialPair), /JSON pair/);

  const bracketPrefixedPair = mobileKnowledgeBundleEditValues(bundles[0]!);
  bracketPrefixedPair[4] = '[Optional] :: Handle x';
  const bracketConcept = buildMobileKnowledgeBundle('concept', bracketPrefixedPair);
  assert.equal(bracketConcept.type, 'concept');
  assert.deepEqual(bracketConcept.misconceptions, [{ claim: '[Optional]', correction: 'Handle x' }]);

  const bracketExample = mobileKnowledgeBundleEditValues(expression);
  bracketExample[8] = '[x, y] is an interval';
  const bracketExpression = buildMobileKnowledgeBundle('expression', bracketExample);
  assert.equal(bracketExpression.type, 'expression');
  assert.deepEqual(bracketExpression.examples, [{ text: '[x, y] is an interval' }]);

  const quotedArrayExample = mobileKnowledgeBundleEditValues(expression);
  quotedArrayExample[8] = '["a", "b"] is a JavaScript array';
  const quotedArrayExpression = buildMobileKnowledgeBundle('expression', quotedArrayExample);
  assert.equal(quotedArrayExpression.type, 'expression');
  assert.deepEqual(quotedArrayExpression.examples, [{ text: '["a", "b"] is a JavaScript array' }]);

  for (const malformedStep of [
    '["Step", "Detail"],',
    '["Step", "Detail"]junk',
    '["Step", "Detail"] ,',
    '["Step",] explanatory tail',
    '["Step" "Detail"] explanatory tail',
    '["Step", undefined] explanatory tail',
  ]) {
    const malformedProcedure = mobileKnowledgeBundleEditValues(bundles[1]!);
    malformedProcedure[2] = malformedStep;
    assert.throws(() => buildMobileKnowledgeBundle('procedure', malformedProcedure), /JSON pair/);
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
  assert.match(knowledgeBundleAnswerLines(bundles[9]!).join('\n'), /서먹함을 깨다/);
});

test('expression practice chooses a locale-matched reverse cue and preserves the forward cue', () => {
  const expression = bundles[9];
  assert.equal(expression?.type, 'expression');
  if (!expression || expression.type !== 'expression') return;
  assert.equal(expressionRecallCue(expression, 'en', 'forward'), 'break the ice');
  assert.equal(expressionRecallCue(expression, 'ja', 'reverse'), '緊張をほぐす');
  assert.equal(expressionRecallCue(expression, 'zh-CN', 'reverse'), '서먹함을 깨다');
  assert.equal(expressionHasReverseRecallCue(expression), true);
  assert.equal(expressionHasReverseRecallCue({ ...expression, translations: [], meanings: [] }), false);
});

test('mobile exposes localized type labels and recall prompts for every supported bundle type', () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const type of KNOWLEDGE_BUNDLE_TYPES) {
      assert.notEqual(knowledgeBundleTypeLabel(locale, type).trim(), '');
      assert.notEqual(knowledgeBundleRecallPrompt(locale, type).trim(), '');
    }
  }
});
