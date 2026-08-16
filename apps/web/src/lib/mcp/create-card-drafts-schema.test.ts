import assert from 'node:assert/strict';
import test from 'node:test';
import { createCardDraftsInputSchema, toKnowledgeDraftBatchInput } from './create-card-drafts-schema';

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
      },
    ],
  });
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
