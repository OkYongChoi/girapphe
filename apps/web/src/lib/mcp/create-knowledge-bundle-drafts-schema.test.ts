import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createKnowledgeBundleDraftsInputSchema,
  toKnowledgeBundleDraftBatchInput,
} from './create-knowledge-bundle-drafts-schema';

const validInput = {
  provider: 'chatgpt',
  request_id: 'bundle-request-1',
  provenance: { type: 'current_conversation', conversation_ref: 'current-conversation-1' },
  bundles: [{
    client_bundle_id: 'procedure-1',
    title: 'Safe release',
    central_question: 'How do I release safely?',
    knowledge_type: 'procedure',
    summary: 'Validate, release, then verify.',
    topic: 'delivery',
    tags: ['release'],
    structured_content: {
      type: 'procedure',
      goal: 'Release safely.',
      prerequisites: ['Passing checks'],
      steps: [{ title: 'Deploy', detail: 'Use the protected workflow.' }],
      branches: [], failure_modes: [], done_when: ['Production verified'],
    },
    bundle_schema_version: 1,
  }],
} as const;

test('maps a strict structured bundle request to the shared pending ingestion contract', () => {
  const mapped = toKnowledgeBundleDraftBatchInput(createKnowledgeBundleDraftsInputSchema.parse(validInput));
  assert.equal(mapped.cards.length, 1);
  assert.equal(mapped.cards[0]?.knowledgeType, 'procedure');
  assert.equal(mapped.cards[0]?.centralQuestion, 'How do I release safely?');
  assert.equal(mapped.cards[0]?.structuredContent?.type, 'procedure');
  assert.equal(mapped.cards[0]?.bundleSchemaVersion, 1);
});

test('maps an optional HTTPS source location without accepting insecure links', () => {
  const parsed = createKnowledgeBundleDraftsInputSchema.parse({
    ...validInput,
    provenance: {
      ...validInput.provenance,
      source_url: 'https://assistant.example/thread/current-1?token=secret#private',
      discussed_at: '2026-08-28T00:30:00Z',
    },
  });
  const mapped = toKnowledgeBundleDraftBatchInput(parsed);
  assert.equal(mapped.sourceUrl, 'https://assistant.example/thread/current-1');
  assert.equal(mapped.discussedAt, '2026-08-28T00:30:00Z');
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({
    ...validInput,
    provenance: { ...validInput.provenance, source_url: 'javascript:alert(1)' },
  }).success, false);
  for (const source_url of [
    'https://user:password@assistant.example/thread/current-1',
    'HTTPS://user:password@assistant.example/thread/current-1',
  ]) {
    assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({
      ...validInput,
      provenance: { ...validInput.provenance, source_url },
    }).success, false);
  }
});

test('accepts selector-only evidence on typed bundles', () => {
  const parsed = createKnowledgeBundleDraftsInputSchema.parse({
    ...validInput,
    bundles: [{
      ...validInput.bundles[0],
      evidence_selectors: [{ selector_type: 'line_range', line_start: 4, line_end: 8 }],
    }],
  });
  assert.deepEqual(toKnowledgeBundleDraftBatchInput(parsed).cards[0]?.proposedEvidence, [{
    selectorType: 'line_range',
    lineStart: 4,
    lineEnd: 8,
    polarity: 'supports',
    quality: 'unknown',
    relationOrigin: 'model_inferred',
  }]);
});

test('accepts the exact question, decision, event, and expression version-one shapes', () => {
  const newTypes = [
    { type: 'question', question: 'What remains unknown?', context: 'A follow-up is needed.', known_facts: ['One fact'], hypotheses: ['One hypothesis'], next_steps: ['Test it'], answer_summary: '', status: 'open' },
    { type: 'decision', decision: 'Use a protected PR.', context: 'Production is affected.', options: [{ name: 'Protected PR', tradeoffs: 'More verification time.' }], criteria: ['Safety'], rationale: ['Checks are recorded.'], reconsider_when: ['The release path changes.'], outcome: '' },
    { type: 'event', event: 'The release completed.', occurred_at: '2026-08-28T03:02:19Z', context: 'The exact main revision deployed.', changes: ['Types became available.'], causes: ['The workflow completed.'], consequences: ['Users can save them.'] },
    { type: 'expression', expression: 'break the ice', language: 'en', pronunciation: '/breɪk ði aɪs/', meanings: ['Start a friendly conversation.'], translations: [{ language: 'ko', text: '서먹함을 깨다' }], register: 'neutral', nuance: 'Reduces initial social tension.', usage_contexts: ['First meetings'], examples: [{ text: 'A joke helped break the ice.', translation: '농담이 서먹함을 깨는 데 도움이 됐다.' }], contrasts: [{ expression: 'get down to business', difference: 'Moves directly to the topic.' }], common_mistakes: [{ incorrect: 'break an ice', correction: 'break the ice' }] },
  ] as const;
  for (const structuredContent of newTypes) {
    const input = {
      ...validInput,
      bundles: [{
        ...validInput.bundles[0],
        client_bundle_id: `${structuredContent.type}-1`,
        knowledge_type: structuredContent.type,
        structured_content: structuredContent,
      }],
    };
    const parsed = createKnowledgeBundleDraftsInputSchema.parse(input);
    assert.equal(parsed.bundles[0]?.knowledge_type, structuredContent.type);
    assert.equal(parsed.bundles[0]?.structured_content.type, structuredContent.type);
  }
  const expression = newTypes[3];
  for (const language of ['x-pig-latin', 'i-klingon', 'sl-rozaj-biske-1994']) {
    assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({
      ...validInput,
      bundles: [{
        ...validInput.bundles[0],
        knowledge_type: 'expression',
        structured_content: { ...expression, language },
      }],
    }).success, true);
  }
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({
    ...validInput,
    bundles: [{
      ...validInput.bundles[0],
      knowledge_type: 'expression',
      structured_content: { ...expression, language: 'en-US-US' },
    }],
  }).success, false);
});

test('requires selected evidence for causal relationship suggestions', () => {
  const causal = {
    ...validInput,
    bundles: [{
      ...validInput.bundles[0],
      evidence_selectors: [{ selector_type: 'message', message_ref: 'm-1' }],
      relations: [{ target_kind: 'public', target_id: 'graph_gradient_descent', type: 'causes', direction: 'outgoing', evidence_selector_indexes: [0] }],
    }],
  };
  const parsed = createKnowledgeBundleDraftsInputSchema.parse(causal);
  assert.deepEqual(toKnowledgeBundleDraftBatchInput(parsed).cards[0]?.relations?.[0]?.evidenceSelectorIndexes, [0]);
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({
    ...causal,
    bundles: [{ ...causal.bundles[0], relations: [{ ...causal.bundles[0].relations[0], evidence_selector_indexes: [] }] }],
  }).success, false);
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({
    ...causal,
    bundles: [{ ...causal.bundles[0], relations: [{ ...causal.bundles[0].relations[0], evidence_selector_indexes: [1] }] }],
  }).success, false);
});

test('rejects raw conversation fields, unknown nested fields, type mismatches, and duplicate ids', () => {
  for (const field of ['transcript', 'history', 'messages']) {
    assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse({ ...validInput, [field]: 'raw conversation' }).success, false);
  }
  const unknownNested = {
    ...validInput,
    bundles: [{ ...validInput.bundles[0], structured_content: { ...validInput.bundles[0].structured_content, unknown: 'not allowed' } }],
  };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(unknownNested).success, false);

  const mismatch = { ...validInput, bundles: [{ ...validInput.bundles[0], knowledge_type: 'concept' }] };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(mismatch).success, false);

  const blankExpressionLanguage = {
    ...validInput,
    bundles: [{
      ...validInput.bundles[0],
      knowledge_type: 'expression',
      structured_content: {
        type: 'expression', expression: 'hello', language: '', pronunciation: '', meanings: [], translations: [],
        register: '', nuance: '', usage_contexts: [], examples: [], contrasts: [], common_mistakes: [],
      },
    }],
  };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(blankExpressionLanguage).success, false);

  const duplicate = { ...validInput, bundles: [validInput.bundles[0], validInput.bundles[0]] };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(duplicate).success, false);
});

test('reserves generated bundle ids during validation and mapping', () => {
  const withoutId = { ...validInput.bundles[0], client_bundle_id: undefined };
  const collision = {
    ...validInput,
    bundles: [withoutId, { ...validInput.bundles[0], client_bundle_id: 'card-1' }],
  };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(collision).success, false);

  const parsed = createKnowledgeBundleDraftsInputSchema.parse({ ...validInput, bundles: [withoutId] });
  assert.equal(toKnowledgeBundleDraftBatchInput(parsed).cards[0]?.clientCardId, 'card-1');

  const selfRelation = {
    ...validInput,
    bundles: [{
      ...withoutId,
      relations: [{ target_kind: 'draft', target_id: 'card-1', type: 'related', direction: 'outgoing' }],
    }],
  };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(selfRelation).success, false);
});

test('rejects oversized structured content before it reaches storage', () => {
  const largeSteps = Array.from({ length: 30 }, (_, index) => ({ title: `Step ${index}`, detail: '가'.repeat(4000) }));
  const oversized = {
    ...validInput,
    bundles: Array.from({ length: 7 }, (_, index) => ({
      ...validInput.bundles[0],
      client_bundle_id: `large-procedure-${index}`,
      structured_content: { ...validInput.bundles[0].structured_content, steps: largeSteps },
    })),
  };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(oversized).success, false);
});
