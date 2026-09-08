import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeKnowledgeProductMetrics,
  generateKnowledgeIntelligence,
  parseKnowledgeProductEventInput,
  parseSelectedConversationImportResult,
} from './ai-thinking-history.ts';

const now = '2026-09-06T00:00:00.000Z';
const item = (id, daysAgo, overrides = {}) => ({
  id,
  title: `Knowledge ${id}`,
  summary: `A detailed summary about compiler runtime architecture ${id}`,
  content: `Compiler runtime architecture and backend abstraction ${id}`,
  topic: 'compiler-runtime',
  tags: ['compiler', 'runtime'],
  centralQuestion: 'How does compiler runtime architecture work?',
  version: 1,
  occurredAt: new Date(Date.parse(now) - daysAgo * 86_400_000).toISOString(),
  createdAt: new Date(Date.parse(now) - daysAgo * 86_400_000).toISOString(),
  updatedAt: new Date(Date.parse(now) - daysAgo * 86_400_000).toISOString(),
  sourceSelectorCount: 1,
  ...overrides,
});

test('provider-neutral selected import accepts a synthetic adapter and rejects raw archive fields', () => {
  const result = parseSelectedConversationImportResult({
    schemaVersion: 1,
    provider: 'synthetic',
    sourceKind: 'export',
    consent: true,
    selections: [{
      conversationRef: 'conversation-1',
      messageRef: 'message-1',
      title: 'Compiler notes',
      prompt: 'What is a compiler runtime?',
      response: 'It coordinates generated programs with devices.',
      occurredAt: '2026-09-01T09:00:00+09:00',
    }],
  });
  assert.equal(result.provider, 'synthetic');
  assert.equal(result.selections[0].occurredAt, '2026-09-01T00:00:00.000Z');
  assert.throws(() => parseSelectedConversationImportResult({ ...result, rawArchive: '{}' }));
  assert.throws(() => parseSelectedConversationImportResult({ ...result, selections: [result.selections[0], result.selections[0]] }));
});

test('intelligence emits material revision changes with two revision-backed evidence entries', () => {
  const current = item('changed', 5, { version: 2, summary: 'Runtime state and conversation memory must be separated.' });
  const signals = generateKnowledgeIntelligence({
    items: [current],
    revisions: [
      { itemId: current.id, version: 1, title: current.title, summary: 'All memory belongs directly inside one runtime process.', content: 'Short term state and durable memory are one layer.', centralQuestion: current.centralQuestion, createdAt: '2026-05-01T00:00:00.000Z' },
      { itemId: current.id, version: 2, title: current.title, summary: current.summary, content: 'Durable conversation memory is separate from ephemeral runtime state.', centralQuestion: current.centralQuestion, createdAt: current.updatedAt },
    ],
    activity: [],
    relations: [],
  }, { now });
  const change = signals.find((signal) => signal.type === 'thought_change');
  assert.ok(change);
  assert.deepEqual(change.evidence.map((entry) => entry.revisionVersion), [1, 2]);
  assert.deepEqual(change.contextItemIds, ['changed']);
});

test('intelligence trusts only confirmed private contradiction and connection relations', () => {
  const first = item('first', 10);
  const second = item('second', 8);
  const signals = generateKnowledgeIntelligence({
    items: [first, second], revisions: [], activity: [],
    relations: [
      { id: 'confirmed-contradiction', sourceItemId: first.id, targetItemId: second.id, type: 'contradicts', origin: 'explicit_user', confirmedAt: now, evidenceSelectorCount: 1 },
      { id: 'unconfirmed-connection', sourceItemId: first.id, targetItemId: second.id, type: 'related', origin: 'model_inferred', confirmedAt: null, evidenceSelectorCount: 0 },
    ],
  }, { now });
  assert.equal(signals.filter((signal) => signal.type === 'contradiction').length, 1);
  assert.equal(signals.filter((signal) => signal.type === 'connection').length, 0);
  assert.equal(signals[0].confidence, 'high');
});

test('rediscovery requires recent topical relevance and excludes recently reused old knowledge', () => {
  const old = item('old', 120);
  const recent = item('recent', 3);
  const base = { items: [old, recent], revisions: [], relations: [] };
  assert.ok(generateKnowledgeIntelligence({ ...base, activity: [] }, { now })
    .some((signal) => signal.type === 'rediscovery'));
  assert.equal(generateKnowledgeIntelligence({
    ...base,
    activity: [{ itemId: old.id, type: 'reused', createdAt: new Date(Date.parse(now) - 2 * 86_400_000).toISOString() }],
  }, { now }).some((signal) => signal.type === 'rediscovery'), false);
});

test('intelligence is bounded and fails closed for unsupported text-only contradictions', () => {
  const items = Array.from({ length: 12 }, (_, index) => item(`item-${index}`, index + 1));
  const signals = generateKnowledgeIntelligence({ items, revisions: [], activity: [], relations: [] }, { now, maxSignals: 3 });
  assert.ok(signals.length <= 3);
  assert.equal(signals.some((signal) => signal.type === 'contradiction'), false);
});

test('privacy-safe events reject authored content and enforce signal outcomes', () => {
  const parsed = parseKnowledgeProductEventInput({
    eventName: 'knowledge_signal_dismissed', eventVersion: 1,
    subjectId: 'kis_abc123', signalType: 'contradiction', outcome: 'scope_changed',
  });
  assert.equal(parsed.outcome, 'scope_changed');
  assert.throws(() => parseKnowledgeProductEventInput({ ...parsed, title: 'private title' }));
  assert.throws(() => parseKnowledgeProductEventInput({ ...parsed, outcome: 'approved' }));
  assert.throws(() => parseKnowledgeProductEventInput({
    eventName: 'knowledge_signal_viewed', eventVersion: 1, subjectId: 'kis_abc123', message: 'raw text',
  }));
});

test('metric definitions reproduce activation, retention, and knowledge reuse from versioned events', () => {
  const events = [
    ['conversation_import_confirmed', 'job-1', 0],
    ['conversation_import_first_value_viewed', 'job-1', 0],
    ['knowledge_candidate_resolved', 'draft-1', 1],
    ['knowledge_signal_evidence_opened', 'signal-1', 2],
    ['knowledge_context_created', 'signal-1', 8],
    ['knowledge_signal_dismissed', 'signal-2', 32],
  ].map(([eventName, subjectId, days]) => ({
    actorId: 'opaque-user-1', eventName, subjectId,
    createdAt: new Date(Date.parse(now) + Number(days) * 86_400_000).toISOString(),
  }));
  const metrics = computeKnowledgeProductMetrics(events);
  assert.equal(metrics.importActivation, 1);
  assert.equal(metrics.reviewActivation, 1);
  assert.equal(metrics.d7Retention, 1);
  assert.equal(metrics.d30Retention, 1);
  assert.equal(metrics.knowledgeReuseRate, 1);
});
