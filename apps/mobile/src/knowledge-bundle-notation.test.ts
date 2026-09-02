import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { KnowledgeBundleContent } from '@stem-brain/shared';
import {
  buildKnowledgeBundleNotationBlocks,
  hasKnowledgeBundleNotation,
  knowledgeBundleNotationAccessibilityText,
  knowledgeBundleNotationSources,
} from './knowledge-bundle-notation';

const notation = '\\(x^2\\)';

const bundles: KnowledgeBundleContent[] = [
  { type: 'concept', definition: 'Definition', key_points: ['Point'], examples: [], non_examples: [], misconceptions: [{ claim: 'Wrong', correction: notation }] },
  { type: 'procedure', goal: 'Goal', prerequisites: [], steps: [{ title: 'Step', detail: 'Detail' }], branches: [], failure_modes: [], done_when: [notation] },
  { type: 'comparison', targets: ['A', 'B'], criteria: [{ name: 'Cost', values: ['Low', 'High'] }], commonalities: [], differences: [], choice_guide: [{ condition: 'When', recommendation: notation }] },
  { type: 'mechanism', causes: ['Cause'], stages: [{ title: 'Stage', detail: 'Detail' }], results: [], conditions: [], exceptions: [notation] },
  { type: 'structure', purpose: 'Purpose', components: [{ id: 'root', label: 'Root', role: 'Parent' }], relations: [], boundaries: [notation] },
  { type: 'claim_evidence', claim: 'Claim', evidence: [{ statement: 'Evidence', source: 'Source' }], counterevidence: [], scope: [], limitations: [notation], confidence: 'high' },
  { type: 'question', question: 'Question', context: 'Context', known_facts: [], hypotheses: [], next_steps: [], answer_summary: notation, status: 'answered' },
  { type: 'decision', decision: 'Decision', context: 'Context', options: [], criteria: [], rationale: [], reconsider_when: [], outcome: notation },
  { type: 'event', event: 'Event', occurred_at: '2026', context: 'Context', changes: [], causes: [], consequences: [notation] },
  { type: 'expression', expression: 'Expression', language: 'en', pronunciation: '', meanings: [], translations: [], register: '', nuance: '', usage_contexts: [], examples: [], contrasts: [], common_mistakes: [{ incorrect: 'Wrong', correction: notation }] },
];

function replaceNotation(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(notation, 'plain');
  if (Array.isArray(value)) return value.map(replaceNotation);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceNotation(item)]));
  }
  return value;
}

test('aggregate notation blocks cover and detect every structured bundle type', () => {
  for (const bundle of bundles) {
    const blocks = buildKnowledgeBundleNotationBlocks(bundle);
    assert.ok(blocks.length > 0, `${bundle.type} should produce blocks`);
    assert.ok(knowledgeBundleNotationSources(blocks).includes(notation), `${bundle.type} should retain its exact notation field`);
    assert.equal(hasKnowledgeBundleNotation(bundle), true, `${bundle.type} should opt into one aggregate DOM boundary`);

    const plain = replaceNotation(bundle) as KnowledgeBundleContent;
    assert.equal(hasKnowledgeBundleNotation(plain), false, `${bundle.type} should remain native without notation`);
  }
});

test('builder keeps field boundaries and fenced code at the start of a list value', () => {
  const fenced = '```ts\nconst answer = 42;\n```';
  const content: KnowledgeBundleContent = {
    type: 'concept',
    definition: 'Definition',
    key_points: [fenced],
    examples: [],
    non_examples: [],
    misconceptions: [],
  };
  const blocks = buildKnowledgeBundleNotationBlocks(content);
  assert.equal(knowledgeBundleNotationSources(blocks)[1], fenced);
  assert.match(knowledgeBundleNotationAccessibilityText(blocks), /```ts\nconst answer = 42;\n```/);
  assert.equal(hasKnowledgeBundleNotation(content), true);
});

test('structured bundles have one aggregate DOM call site and inline DOM documents shrink-wrap', () => {
  const bundleView = readFileSync(new URL('./components/knowledge-bundle-view.tsx', import.meta.url), 'utf8');
  const notationGroup = readFileSync(new URL('./components/knowledge-notation-group.tsx', import.meta.url), 'utf8');
  const domSource = readFileSync(new URL('./components/knowledge-notation-dom.tsx', import.meta.url), 'utf8');
  assert.equal(bundleView.match(/<KnowledgeNotationDom/g)?.length, 1);
  assert.equal(notationGroup.match(/<KnowledgeNotationDom/g)?.length, 1);
  assert.match(bundleView, /bundleBlocks=\{notationBlocks\}/);
  assert.match(notationGroup, /knowledgeBundleNotationBlocksHaveNotation\(blocks\)/);
  assert.match(domSource, /width: max-content; max-width: 100vw/);
  assert.match(domSource, /bundleBlocks \|\| !inline/);
  assert.match(domSource, /token\.type === 'math'\) return token\.source/);
  assert.match(domSource, /knowledgeTextRequiresBlockContainer\(tokens\)/);
  assert.match(domSource, /inline && !containsBlockToken \? 'span' : 'div'/);
});

test('selected detail surfaces render notation while pressable list rows stay native', () => {
  const knowledgeTextSource = readFileSync(new URL('./components/knowledge-text.tsx', import.meta.url), 'utf8');
  const domSource = readFileSync(new URL('./components/knowledge-notation-dom.tsx', import.meta.url), 'utf8');
  const reviewSource = readFileSync(new URL('../app/(tabs)/review.tsx', import.meta.url), 'utf8');
  const browseSource = readFileSync(new URL('../app/(tabs)/browse.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');

  assert.match(knowledgeTextSource, /<Text numberOfLines=\{numberOfLines\}/);
  assert.match(knowledgeTextSource, /<KnowledgeNotationDom[\s\S]*numberOfLines=\{numberOfLines\}/);
  assert.match(domSource, /WebkitLineClamp: numberOfLines/);

  assert.match(reviewSource, /initialNumToRender=\{8\}/);
  assert.match(reviewSource, /maxToRenderPerBatch=\{6\}/);
  assert.match(reviewSource, /windowSize=\{5\}/);
  assert.match(reviewSource, /<KnowledgeNotationGroup/);
  assert.match(reviewSource, /numberOfLines: 2/);
  assert.match(reviewSource, /numberOfLines: 3/);

  assert.match(browseSource, /<KnowledgeText[\s\S]*value=\{activeNote\?\.title/);
  assert.match(browseSource, /<KnowledgeText value=\{activeNote\.central_question\}/);
  assert.match(browseSource, /activeNote\?\.structured_content[\s\S]*<MobileKnowledgeBundleView content=\{activeNote\.structured_content\}/);
  assert.match(homeSource, /<KnowledgeText value=\{labelFor\(selectedNode\)\}/);
  assert.match(homeSource, /<KnowledgeText value=\{summaryFor\(selectedNode\)\}/);
  assert.match(homeSource, /currentPersonalNotes\.slice\(0, 3\)[\s\S]*<KnowledgeText[\s\S]*value=\{note\.title\}[\s\S]*prefix="● "/);

  const browseRows = browseSource.slice(browseSource.indexOf('        renderItem={({ item }) => ('));
  const homeRows = homeSource.slice(homeSource.indexOf('        renderItem={({ item }) => ('));
  assert.match(browseRows, /<Text style=\{styles\.nodeTitle\}/);
  assert.doesNotMatch(browseRows, /<KnowledgeText/);
  assert.match(homeRows, /<Text style=\{styles\.nodeTitle\}/);
  assert.doesNotMatch(homeRows, /<KnowledgeText/);
});

test('virtualized mobile cards aggregate notation into at most one DOM boundary per row', () => {
  const paths = [
    '../app/candidate-inbox.tsx',
    '../app/knowledge-topic/[topic].tsx',
    '../app/(tabs)/review.tsx',
    '../app/(tabs)/notes.tsx',
  ];

  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const rows = source.slice(source.indexOf('renderItem='));
    assert.match(rows, /<KnowledgeNotationGroup/, `${path} should aggregate each notation-rich row`);
    assert.doesNotMatch(rows, /<KnowledgeNotationDom/, `${path} should not create direct row DOM boundaries`);
  }

  const candidates = readFileSync(new URL('../app/candidate-inbox.tsx', import.meta.url), 'utf8');
  assert.match(candidates, /duplicateSuggestionValues[\s\S]*kind: 'lines'/);
  assert.match(candidates, /duplicate_suggestions[\s\S]*<KnowledgeText key=\{item\.id\}/);
  assert.match(candidates, /knowledgeBundleRecallPrompt\(locale, draft\.structured_content\.type\)/);
  assert.doesNotMatch(candidates, /<KnowledgeNotationGroup accessibilityLabel=\{draft\.title\}/);
});
