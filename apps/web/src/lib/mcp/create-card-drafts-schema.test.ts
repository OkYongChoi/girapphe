import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCardDraftsInputSchema,
  MAX_CREATE_CARD_DRAFTS_INPUT_BYTES,
  MAX_MCP_REQUEST_BYTES,
  toKnowledgeDraftBatchInput,
} from './create-card-drafts-schema';

const validInput = {
  provider: 'chatgpt',
  request_id: 'request-2026-08-16-1',
  provenance: {
    type: 'current_conversation',
    conversation_ref: 'conversation-opaque-123',
  },
  cards: [
    {
      client_card_id: 'draft-1',
      title: 'Bayes theorem',
      summary: 'A rule for updating probabilities with evidence.',
      tags: ['probability', 'bayes'],
      relations: [
        {
          target_kind: 'public',
          target_id: 'conditional_probability',
          type: 'prerequisite',
          weight: 0.8,
        },
      ],
    },
  ],
} as const;

test('maps a strict current-conversation draft request to the ingestion contract', () => {
  const parsed = createCardDraftsInputSchema.parse(validInput);
  assert.deepEqual(toKnowledgeDraftBatchInput(parsed), {
    provider: 'chatgpt',
    requestId: 'request-2026-08-16-1',
    conversationRef: 'conversation-opaque-123',
    cards: [
      {
        clientCardId: 'draft-1',
        title: 'Bayes theorem',
        summary: 'A rule for updating probabilities with evidence.',
        explanation: undefined,
        topic: undefined,
        tags: ['probability', 'bayes'],
        relations: [
          {
            targetKind: 'public',
            targetId: 'conditional_probability',
            type: 'prerequisite',
            direction: undefined,
            weight: 0.8,
          },
        ],
        knowledgeType: 'concept',
        centralQuestion: 'Bayes theorem',
        structuredContent: {
          type: 'concept',
          definition: 'A rule for updating probabilities with evidence.',
          key_points: [],
          examples: [],
          non_examples: [],
          misconceptions: [],
        },
        bundleSchemaVersion: 1,
      },
    ],
  });
});

test('accepts only a bounded HTTPS source location and preserves its discussion time', () => {
  const parsed = createCardDraftsInputSchema.parse({
    ...validInput,
    provenance: {
      ...validInput.provenance,
      source_url: 'https://chat.example/conversations/current-1?access_token=secret#private',
      discussed_at: '2026-08-28T09:30:00+09:00',
    },
  });
  const mapped = toKnowledgeDraftBatchInput(parsed);
  assert.equal(mapped.sourceUrl, 'https://chat.example/conversations/current-1');
  assert.equal(mapped.discussedAt, '2026-08-28T09:30:00+09:00');

  assert.equal(createCardDraftsInputSchema.safeParse({
    ...validInput,
    provenance: { ...validInput.provenance, source_url: 'http://chat.example/current-1' },
  }).success, false);
  for (const source_url of [
    'https://user:password@chat.example/current-1',
    'HTTPS://user:password@chat.example/current-1',
  ]) {
    assert.equal(createCardDraftsInputSchema.safeParse({
      ...validInput,
      provenance: { ...validInput.provenance, source_url },
    }).success, false);
  }
});

test('maps the complete relation grammar and selector-only evidence without source text', () => {
  const parsed = createCardDraftsInputSchema.parse({
    ...validInput,
    cards: [{
      ...validInput.cards[0],
      relations: [{ target_kind: 'draft', target_id: 'question-2', type: 'answers' }],
      evidence_selectors: [{
        selector_type: 'message',
        message_ref: 'message-7',
        polarity: 'supports',
        quality: 'high',
        relation_origin: 'explicit_user',
      }],
    }],
  });
  const card = toKnowledgeDraftBatchInput(parsed).cards[0];
  assert.equal(card?.relations?.[0]?.type, 'answers');
  assert.deepEqual(card?.proposedEvidence, [{
    selectorType: 'message',
    messageRef: 'message-7',
    polarity: 'supports',
    quality: 'high',
    relationOrigin: 'explicit_user',
  }]);
  assert.equal(createCardDraftsInputSchema.safeParse({
    ...validInput,
    cards: [{
      ...validInput.cards[0],
      evidence_selectors: [{ selector_type: 'message', message_ref: 'message-7', excerpt: 'raw text' }],
    }],
  }).success, false);
});

test('requires valid evidence indexes on causal legacy-card relationships', () => {
  const input = {
    ...validInput,
    cards: [{
      ...validInput.cards[0],
      evidence_selectors: [{ selector_type: 'message', message_ref: 'message-7' }],
      relations: [{ target_kind: 'public', target_id: 'conditional_probability', type: 'contributes_to', evidence_selector_indexes: [0] }],
    }],
  };
  const parsed = createCardDraftsInputSchema.parse(input);
  assert.deepEqual(toKnowledgeDraftBatchInput(parsed).cards[0]?.relations?.[0]?.evidenceSelectorIndexes, [0]);
  assert.equal(createCardDraftsInputSchema.safeParse({
    ...input,
    cards: [{ ...input.cards[0], relations: [{ ...input.cards[0].relations[0], evidence_selector_indexes: [] }] }],
  }).success, false);
});

test('normalizes safe evidence URLs and rejects credential-bearing or non-HTTPS schemes', () => {
  const parsed = createCardDraftsInputSchema.parse({
    ...validInput,
    cards: [{
      ...validInput.cards[0],
      evidence_selectors: [{
        selector_type: 'external_ref',
        source_ref: 'https://evidence.example/source?signature=secret#private',
      }],
    }],
  });
  assert.equal(
    toKnowledgeDraftBatchInput(parsed).cards[0]?.proposedEvidence?.[0]?.sourceRef,
    'https://evidence.example/source',
  );
  const longHttpsReference = `https://evidence.example/${'a'.repeat(300)}`;
  const longParsed = createCardDraftsInputSchema.parse({
    ...validInput,
    cards: [{
      ...validInput.cards[0],
      evidence_selectors: [{ selector_type: 'external_ref', source_ref: longHttpsReference }],
    }],
  });
  assert.equal(
    toKnowledgeDraftBatchInput(longParsed).cards[0]?.proposedEvidence?.[0]?.sourceRef,
    longHttpsReference,
  );
  assert.equal(createCardDraftsInputSchema.safeParse({
    ...validInput,
    cards: [{
      ...validInput.cards[0],
      evidence_selectors: [{ selector_type: 'external_ref', source_ref: `opaque-${'a'.repeat(240)}` }],
    }],
  }).success, false);
  for (const source_ref of [
    'https://user:password@evidence.example/source',
    'HTTPS://user:password@evidence.example/source',
    'FTP://evidence.example/source',
  ]) {
    assert.equal(createCardDraftsInputSchema.safeParse({
      ...validInput,
      cards: [{
        ...validInput.cards[0],
        evidence_selectors: [{ selector_type: 'external_ref', source_ref }],
      }],
    }).success, false);
  }
});

test('rejects transcript, history, messages, and non-current provenance at the schema boundary', () => {
  const historical = {
    ...validInput,
    provenance: { type: 'historical_conversation', conversation_ref: 'old-conversation' },
  };

  for (const forbiddenField of ['transcript', 'history', 'messages'] as const) {
    const rawConversationPayload = {
      ...validInput,
      [forbiddenField]: 'entire conversation must never be accepted here',
    };
    assert.equal(
      createCardDraftsInputSchema.safeParse(rawConversationPayload).success,
      false,
      `${forbiddenField} must be rejected`
    );
  }
  assert.equal(createCardDraftsInputSchema.safeParse(historical).success, false);
});

test('enforces batch and per-card relation limits', () => {
  const tooManyRelations = {
    ...validInput,
    cards: [
      {
        ...validInput.cards[0],
        relations: Array.from({ length: 13 }, (_, index) => ({
          target_kind: 'public' as const,
          target_id: `node-${index}`,
          type: 'related' as const,
        })),
      },
    ],
  };

  assert.equal(createCardDraftsInputSchema.safeParse(tooManyRelations).success, false);
});

test('requires relation weights to be greater than zero', () => {
  const zeroWeight = {
    ...validInput,
    cards: [
      {
        ...validInput.cards[0],
        relations: [
          {
            target_kind: 'public' as const,
            target_id: 'conditional_probability',
            type: 'prerequisite' as const,
            weight: 0,
          },
        ],
      },
    ],
  };

  assert.equal(createCardDraftsInputSchema.safeParse(zeroWeight).success, false);
});

test('rejects aggregate UTF-8 input that cannot fit the bounded MCP transport', () => {
  const oversized = {
    ...validInput,
    request_id: 'oversized-multibyte-request',
    cards: Array.from({ length: 50 }, (_, index) => ({
      client_card_id: `card-${index}`,
      title: `개념 ${index}`,
      explanation: '가'.repeat(6000),
    })),
  };
  const serializedBytes = new TextEncoder().encode(JSON.stringify(oversized)).byteLength;

  assert.ok(serializedBytes > MAX_CREATE_CARD_DRAFTS_INPUT_BYTES);
  assert.ok(MAX_CREATE_CARD_DRAFTS_INPUT_BYTES < MAX_MCP_REQUEST_BYTES);
  const result = createCardDraftsInputSchema.safeParse(oversized);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.error.issues.some((issue) => /UTF-8 bytes/.test(issue.message)));
  }
});
