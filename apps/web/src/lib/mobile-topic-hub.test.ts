import assert from 'node:assert/strict';
import test from 'node:test';
import { readMobileKnowledgeCapabilities } from './mobile-knowledge-capabilities';
import {
  MAX_MOBILE_TOPIC_HUB_ACTIVITY,
  MAX_MOBILE_TOPIC_HUB_EVIDENCE_SELECTORS,
  MAX_MOBILE_TOPIC_HUB_ITEMS,
  MAX_MOBILE_TOPIC_HUB_RELATIONS,
  MAX_MOBILE_TOPIC_HUB_SOURCES,
  MAX_MOBILE_RELATION_EVIDENCE_SELECTORS,
  toMobileTopicHub,
} from './mobile-topic-hub';
import type { TopicKnowledgeHub } from './topic-knowledge-hub';

test('mobile Topic Hub projects provenance without revision-history payloads', () => {
  const hub = {
    topic: 'HTTP caching',
    generated_at: '2026-09-10T00:00:00.000Z',
    items: [],
    sources: [{
      id: 'evidence-source-1',
      knowledge_item_id: 'item-1',
      source_type: 'conversation',
      provider: 'chatgpt',
      conversation_ref: 'conversation-1',
      source_url: null,
      source_locator: {
        message_ref: 'message-1',
        transcript: 'must not reach mobile',
        nested: { raw_text: 'must not reach mobile' },
      },
      discussed_at: null,
      relation_origin: 'explicit_user',
      confirmed_at: '2026-09-10T00:00:00.000Z',
      created_at: '2026-09-10T00:00:00.000Z',
    }],
    activity: [],
    relations: [],
    revisions: [{ sensitive: 'not-for-mobile' }],
    supersessions: [{ sensitive: 'not-for-mobile' }],
    evidence_selectors: [{
      id: 'evidence-1',
      knowledge_item_id: 'item-1',
      source_id: 'evidence-source-1',
      selector_type: 'message',
      selector: { message_ref: 'message-1', raw_text: 'must not reach mobile' },
      polarity: 'supports',
      quality: 'high',
      relation_origin: 'explicit_user',
      confirmed_at: '2026-09-10T00:00:00.000Z',
      created_at: '2026-09-10T00:00:00.000Z',
    }],
  } as unknown as TopicKnowledgeHub;

  const projected = toMobileTopicHub(
    hub,
    readMobileKnowledgeCapabilities('expression-v1,event-chronology-v1,causal-relations-v1'),
  );

  assert.deepEqual(Object.keys(projected).sort(), [
    'activity',
    'evidence_selectors',
    'generated_at',
    'items',
    'relations',
    'sources',
    'topic',
  ]);
  assert.equal(projected.evidence_selectors[0]?.selector_type, 'message');
  assert.deepEqual(projected.evidence_selectors[0]?.selector, { message_ref: 'message-1' });
  assert.deepEqual(projected.sources[0]?.source_locator, { message_ref: 'message-1' });
  assert.equal('revisions' in projected, false);
  assert.equal('supersessions' in projected, false);
});

test('mobile Topic Hub normalizes bounded positions and drops invalid legacy selectors', () => {
  const timestamp = '2026-09-10T00:00:00.000Z';
  const hub = {
    topic: 'Safe provenance',
    generated_at: timestamp,
    items: [],
    sources: [
      {
        id: 'source-valid',
        knowledge_item_id: 'item-1',
        source_type: 'conversation',
        provider: 'chatgpt',
        conversation_ref: null,
        source_url: null,
        source_locator: {
          source_ref: 'https://example.com/evidence?token=secret#private',
          message_ref: 'a'.repeat(240),
          start: 0,
          end: 10_000_000,
          line_start: 1,
          line_end: 1_000_000,
          exact: true,
          transcript: 'must not reach mobile',
        },
        discussed_at: null,
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      },
      {
        id: 'source-invalid',
        knowledge_item_id: 'item-1',
        source_type: 'conversation',
        provider: 'chatgpt',
        conversation_ref: null,
        source_url: null,
        source_locator: {
          source_ref: 'https://user:password@example.com/private',
          message_ref: 'raw transcript words',
          start: '0',
          end: 1,
          line_start: 3,
          line_end: 2,
        },
        discussed_at: null,
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      },
    ],
    activity: [],
    relations: [{
      id: 'relation-1',
      source: 'personal:item-1',
      target: 'public:target-1',
      type: 'related',
      relation_origin: 'explicit_user',
      confirmed_at: timestamp,
      evidence_span_ids: [
        'evidence-message',
        'evidence-external',
        'evidence-text',
        'evidence-lines',
        'evidence-raw-message',
        'evidence-overlong-message',
        'evidence-credential-url',
        'evidence-string-offset',
        'evidence-fractional-offset',
        'evidence-incomplete-offset',
        'evidence-out-of-range-offset',
        'evidence-reversed-lines',
        'evidence-boolean-lines',
        'evidence-unsafe-lines',
      ],
    }],
    revisions: [],
    supersessions: [],
    evidence_selectors: [
      {
        id: 'evidence-message',
        knowledge_item_id: 'item-1',
        source_id: 'source-valid',
        selector_type: 'message',
        selector: {
          source_ref: `selected-export:${'b'.repeat(48)}`,
          message_ref: `selected-message:${'c'.repeat(48)}`,
          start: 0,
          end: 1,
        },
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      },
      {
        id: 'evidence-external',
        knowledge_item_id: 'item-1',
        source_id: 'source-valid',
        selector_type: 'external_ref',
        selector: { source_ref: 'https://example.com/source?token=secret#private' },
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      },
      {
        id: 'evidence-text',
        knowledge_item_id: 'item-1',
        source_id: 'source-valid',
        selector_type: 'text_position',
        selector: { start: 0, end: 10_000_000, message_ref: 'must-be-omitted' },
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      },
      {
        id: 'evidence-lines',
        knowledge_item_id: 'item-1',
        source_id: 'source-valid',
        selector_type: 'line_range',
        selector: { line_start: 1, line_end: 1_000_000, source_ref: 'must-be-omitted' },
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      },
      ...[
        ['evidence-raw-message', 'message', { message_ref: 'raw transcript words' }],
        ['evidence-overlong-message', 'message', { message_ref: 'a'.repeat(241) }],
        ['evidence-credential-url', 'external_ref', { source_ref: 'https://user:password@example.com/private' }],
        ['evidence-string-offset', 'text_position', { start: '0', end: 1 }],
        ['evidence-fractional-offset', 'text_position', { start: 0.5, end: 1 }],
        ['evidence-incomplete-offset', 'text_position', { start: 0 }],
        ['evidence-out-of-range-offset', 'text_position', { start: 0, end: 10_000_001 }],
        ['evidence-reversed-lines', 'line_range', { line_start: 2, line_end: 1 }],
        ['evidence-boolean-lines', 'line_range', { line_start: true, line_end: 1 }],
        ['evidence-unsafe-lines', 'line_range', { line_start: 1, line_end: Number.MAX_SAFE_INTEGER }],
      ].map(([id, selectorType, selector]) => ({
        id,
        knowledge_item_id: 'item-1',
        source_id: 'source-invalid',
        selector_type: selectorType,
        selector,
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
        confirmed_at: timestamp,
        created_at: timestamp,
      })),
    ],
  } as unknown as TopicKnowledgeHub;

  const projected = toMobileTopicHub(
    hub,
    readMobileKnowledgeCapabilities('expression-v1,event-chronology-v1,causal-relations-v1'),
  );

  assert.deepEqual(projected.sources[0]?.source_locator, {
    source_ref: 'https://example.com/evidence',
    message_ref: 'a'.repeat(240),
    start: 0,
    end: 10_000_000,
    line_start: 1,
    line_end: 1_000_000,
  });
  assert.equal(projected.sources[1]?.source_locator, null);
  assert.deepEqual(
    projected.evidence_selectors.map(({ id, selector }) => [id, selector]),
    [
      ['evidence-message', {
        source_ref: `selected-export:${'b'.repeat(48)}`,
        message_ref: `selected-message:${'c'.repeat(48)}`,
      }],
      ['evidence-external', { source_ref: 'https://example.com/source' }],
      ['evidence-text', { start: 0, end: 10_000_000 }],
      ['evidence-lines', { line_start: 1, line_end: 1_000_000 }],
    ],
  );
  assert.deepEqual(projected.relations[0]?.evidence_span_ids, [
    'evidence-message',
    'evidence-external',
    'evidence-text',
    'evidence-lines',
  ]);
  assert.doesNotMatch(JSON.stringify(projected), /raw transcript|token=secret|password|must-be-omitted/u);
});

test('mobile Topic Hub bounds provenance while retaining sources for relationship evidence', () => {
  const sources = Array.from({ length: MAX_MOBILE_TOPIC_HUB_SOURCES + 1 }, (_, index) => ({
    id: `source-${index}`,
    knowledge_item_id: `item-${index}`,
    source_type: 'conversation',
    provider: 'chatgpt',
    conversation_ref: null,
    source_url: null,
    source_locator: { message_ref: `message-${index}` },
    discussed_at: null,
    relation_origin: 'explicit_user' as const,
    confirmed_at: null,
    created_at: `2026-09-10T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
  }));
  const evidenceSelectors = Array.from(
    { length: MAX_MOBILE_TOPIC_HUB_EVIDENCE_SELECTORS },
    (_, index) => ({
      id: `evidence-${index}`,
      knowledge_item_id: 'item-0',
      source_id: `source-${index % MAX_MOBILE_TOPIC_HUB_SOURCES}`,
      selector_type: 'message' as const,
      selector: { message_ref: `message-${index}` },
      polarity: 'supports' as const,
      quality: 'high' as const,
      relation_origin: 'explicit_user' as const,
      confirmed_at: null,
      created_at: '2026-09-10T00:00:00.000Z',
    }),
  );
  evidenceSelectors.push({
    id: 'relationship-evidence',
    knowledge_item_id: `item-${MAX_MOBILE_TOPIC_HUB_SOURCES}`,
    source_id: `source-${MAX_MOBILE_TOPIC_HUB_SOURCES}`,
    selector_type: 'message',
    selector: { message_ref: 'relationship-message' },
    polarity: 'supports',
    quality: 'high',
    relation_origin: 'explicit_user',
    confirmed_at: null,
    created_at: '2026-09-10T00:00:00.000Z',
  });
  const items = Array.from({ length: MAX_MOBILE_TOPIC_HUB_ITEMS + 1 }, (_, index) => ({
    id: `item-${index}`,
    title: `Item ${index}`,
    summary: '',
    content: '',
    topic: 'Bounded provenance',
    tags: [],
    knowledge_type: null,
    central_question: null,
    structured_content: null,
    bundle_schema_version: null,
    version: 1,
    observed_at: null,
    valid_from: null,
    valid_to: null,
    last_verified_at: null,
    review_at: null,
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
  }));
  const activity = Array.from({ length: MAX_MOBILE_TOPIC_HUB_ACTIVITY + 1 }, (_, index) => ({
    id: `activity-${index}`,
    knowledge_item_id: 'item-0',
    activity_type: 'confirmed' as const,
    metadata: {},
    created_at: '2026-09-10T00:00:00.000Z',
  }));
  const relations = Array.from({ length: MAX_MOBILE_TOPIC_HUB_RELATIONS + 1 }, (_, index) => ({
    id: `relation-${index}`,
    source: 'personal:item-0',
    target: `personal:item-${index + 1}`,
    type: 'causes',
    relation_origin: 'explicit_user' as const,
    confirmed_at: null,
    evidence_span_ids: index === 0
      ? [
        'relationship-evidence',
        ...Array.from(
          { length: MAX_MOBILE_RELATION_EVIDENCE_SELECTORS + 5 },
          (_, evidenceIndex) => `evidence-${evidenceIndex}`,
        ),
      ]
      : [],
  }));
  const hub = {
    topic: 'Bounded provenance',
    generated_at: '2026-09-10T00:00:00.000Z',
    items,
    sources,
    activity,
    relations,
    revisions: [],
    supersessions: [],
    evidence_selectors: evidenceSelectors,
  } as TopicKnowledgeHub;

  const projected = toMobileTopicHub(
    hub,
    readMobileKnowledgeCapabilities('expression-v1,event-chronology-v1,causal-relations-v1'),
  );

  assert.equal(projected.items.length, MAX_MOBILE_TOPIC_HUB_ITEMS);
  assert.equal(projected.sources.length, MAX_MOBILE_TOPIC_HUB_SOURCES);
  assert.equal(projected.activity.length, MAX_MOBILE_TOPIC_HUB_ACTIVITY);
  assert.equal(projected.relations.length, MAX_MOBILE_TOPIC_HUB_RELATIONS);
  assert.ok(projected.evidence_selectors.length <= MAX_MOBILE_TOPIC_HUB_EVIDENCE_SELECTORS);
  assert.ok(projected.sources.some((source) => source.id === `source-${MAX_MOBILE_TOPIC_HUB_SOURCES}`));
  assert.equal(projected.sources.some((source) => source.id === `source-${MAX_MOBILE_TOPIC_HUB_SOURCES - 1}`), false);
  assert.ok(projected.evidence_selectors.some((entry) => entry.id === 'relationship-evidence'));
  assert.equal(
    projected.relations[0]?.evidence_span_ids.length,
    MAX_MOBILE_RELATION_EVIDENCE_SELECTORS,
  );
  assert.equal(projected.relations[0]?.evidence_span_ids[0], 'relationship-evidence');
  const sourceIds = new Set(projected.sources.map((source) => source.id));
  assert.ok(projected.evidence_selectors.every((entry) => sourceIds.has(entry.source_id)));
});
