import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOBILE_CAUSAL_RELATION_TYPES,
  mobileCandidateApprovalRequiresCapability,
  mobileCandidateRequiresDetailedCausalReview,
  mobileKnowledgeEditRequiresCapability,
  readMobileKnowledgeCapabilities,
  withMobileKnowledgeCompatibility,
  withMobileKnowledgeListCompatibility,
  withMobileRelationCompatibility,
} from './mobile-knowledge-capabilities';

const allCapabilities = 'expression-v1,event-chronology-v1,causal-relations-v1';

test('older mobile clients receive additive knowledge as legacy-compatible data', () => {
  const legacy = readMobileKnowledgeCapabilities(null);
  const expressionInput = {
    title: 'Break the ice', summary: 'Start a conversation.', content: 'Legacy projection',
    knowledge_type: 'expression', central_question: 'How is it used?', bundle_schema_version: 1,
    structured_content: { type: 'expression' as const, expression: 'break the ice', language: 'en', pronunciation: '', meanings: ['Start a conversation'], translations: [], register: '', nuance: '', usage_contexts: [], examples: [], contrasts: [], common_mistakes: [] },
  };
  const expression = withMobileKnowledgeCompatibility(expressionInput, legacy);
  assert.equal(expression.knowledge_type, null);
  assert.equal(expression.structured_content, null);
  assert.equal(expression.content, 'Legacy projection');

  const savedCards = withMobileKnowledgeListCompatibility([expressionInput, {
    title: 'Founded', summary: 'A historical event.', content: 'Legacy event projection',
    knowledge_type: 'event', central_question: 'When?', bundle_schema_version: 1,
    structured_content: { type: 'event' as const, event: 'Founded', occurred_at: '5th century BCE', chronology: { precision: 'century' as const, start: { era: 'bce' as const, year: 5 } }, context: '', changes: [], causes: [], consequences: [] },
  }], legacy);
  assert.equal(savedCards[0]?.knowledge_type, null);
  assert.equal(savedCards[0]?.structured_content, null);
  assert.equal(savedCards[1]?.structured_content?.type === 'event' ? savedCards[1].structured_content.chronology : undefined, undefined);

  const historicalEvent = {
    knowledge_type: 'event', central_question: 'When?', bundle_schema_version: 1,
    structured_content: { type: 'event' as const, event: 'Founded', occurred_at: '5th century BCE', chronology: { precision: 'century' as const, start: { era: 'bce' as const, year: 5 } }, context: '', changes: [], causes: [], consequences: [] },
  };
  const event = withMobileKnowledgeCompatibility(historicalEvent, legacy);
  assert.equal(event.structured_content?.type, 'event');
  assert.equal(event.structured_content?.type === 'event' ? event.structured_content.chronology : undefined, undefined);
  assert.ok(MOBILE_CAUSAL_RELATION_TYPES.has('causes'));
  assert.deepEqual(withMobileRelationCompatibility([
    { id: 'related', type: 'related' },
    { id: 'cause', type: 'causes' },
  ], legacy), [{ id: 'related', type: 'related' }]);
  assert.equal(mobileKnowledgeEditRequiresCapability({
    structured_content: { type: 'expression' as const, expression: 'hola', language: 'es', pronunciation: '', meanings: [], translations: [], register: '', nuance: '', usage_contexts: [], examples: [], contrasts: [], common_mistakes: [] },
  }, legacy), true);
  assert.equal(mobileKnowledgeEditRequiresCapability(historicalEvent, legacy), true);
  assert.equal(mobileCandidateApprovalRequiresCapability(expressionInput, legacy), true);
  assert.equal(mobileCandidateApprovalRequiresCapability(historicalEvent, legacy), true);
  assert.equal(mobileCandidateApprovalRequiresCapability({ relations: [{ type: 'causes' }] }, legacy), true);
  assert.equal(mobileCandidateApprovalRequiresCapability({ relations: [{ type: 'related' }] }, legacy), false);
  assert.equal(mobileCandidateRequiresDetailedCausalReview({ relations: [{ type: 'causes' }] }), true);
  assert.equal(mobileCandidateRequiresDetailedCausalReview({ relations: [{ type: 'related' }] }), false);
});

test('capable mobile clients retain expression and historical chronology', () => {
  const capabilities = readMobileKnowledgeCapabilities(allCapabilities);
  assert.deepEqual(capabilities, { expression: true, eventChronology: true, causalRelations: true });
  const item = {
    knowledge_type: 'expression', central_question: 'How?', bundle_schema_version: 1,
    structured_content: { type: 'expression' as const, expression: 'hola', language: 'es', pronunciation: '', meanings: ['hello'], translations: [], register: '', nuance: '', usage_contexts: [], examples: [], contrasts: [], common_mistakes: [] },
  };
  assert.equal(withMobileKnowledgeCompatibility(item, capabilities), item);
  assert.equal(mobileKnowledgeEditRequiresCapability(item, capabilities), false);
  assert.equal(mobileCandidateApprovalRequiresCapability(item, capabilities), false);
  assert.equal(mobileCandidateApprovalRequiresCapability({ relations: [{ type: 'causes' }] }, capabilities), false);
});
