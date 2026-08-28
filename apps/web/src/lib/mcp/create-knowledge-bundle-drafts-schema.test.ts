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

  const duplicate = { ...validInput, bundles: [validInput.bundles[0], validInput.bundles[0]] };
  assert.equal(createKnowledgeBundleDraftsInputSchema.safeParse(duplicate).success, false);
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
