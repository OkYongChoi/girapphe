import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseRecallAttemptActionInput,
  parseRecallCancelActionInput,
  parseRecallCompleteActionInput,
  parseRecallConfidenceActionInput,
  parseRecallEnrollActionInput,
  parseRecallStartActionInput,
} from './recall-action-input';

const ATTEMPT_ID = 'b3f04fc6-4573-4cb0-9d15-09ce2fc0dd73';

test('Recall action inputs accept only their bounded identifier and enum fields', () => {
  assert.deepEqual(parseRecallEnrollActionInput({ knowledgeItemId: 'item_1', itemVersion: 2 }), {
    knowledgeItemId: 'item_1',
    itemVersion: 2,
  });
  assert.deepEqual(parseRecallStartActionInput({ knowledgeItemId: 'item_1' }), {
    knowledgeItemId: 'item_1',
  });
  assert.deepEqual(parseRecallAttemptActionInput({ attemptId: ATTEMPT_ID }), {
    attemptId: ATTEMPT_ID,
  });
  assert.deepEqual(parseRecallConfidenceActionInput({ attemptId: ATTEMPT_ID, confidence: 'high' }), {
    attemptId: ATTEMPT_ID,
    confidence: 'high',
  });
  assert.deepEqual(parseRecallCompleteActionInput({ attemptId: ATTEMPT_ID, outcome: 'partial' }), {
    attemptId: ATTEMPT_ID,
    outcome: 'partial',
  });
  assert.deepEqual(parseRecallCancelActionInput({
    knowledgeItemId: 'item_1',
    itemVersion: 2,
    scheduleVersion: 3,
    enrolledAt: '2026-09-01T00:00:00.000Z',
  }), {
    knowledgeItemId: 'item_1',
    itemVersion: 2,
    scheduleVersion: 3,
    enrolledAt: '2026-09-01T00:00:00.000Z',
  });
});

test('Recall actions reject response content, caller-owned due times, user ids, and extra fields', () => {
  const invalidValues: unknown[] = [
    { knowledgeItemId: 'item_1', itemVersion: 1, recallText: 'private answer' },
    { knowledgeItemId: 'item_1', userId: 'user_foreign' },
    { attemptId: ATTEMPT_ID, confidence: 'high', response: 'private answer' },
    { attemptId: ATTEMPT_ID, outcome: 'remembered', nextDueAt: '2026-09-08T00:00:00.000Z' },
    { attemptId: ATTEMPT_ID, outcome: 'remembered', hintUsed: true },
  ];
  assert.throws(() => parseRecallEnrollActionInput(invalidValues[0]), /Invalid Recall action input/);
  assert.throws(() => parseRecallStartActionInput(invalidValues[1]), /Invalid Recall action input/);
  assert.throws(() => parseRecallConfidenceActionInput(invalidValues[2]), /Invalid Recall action input/);
  assert.throws(() => parseRecallCompleteActionInput(invalidValues[3]), /Invalid Recall action input/);
  assert.throws(() => parseRecallCompleteActionInput(invalidValues[4]), /Invalid Recall action input/);
});

test('Recall actions reject malformed identifiers, enum values, versions, and instants', () => {
  assert.throws(
    () => parseRecallStartActionInput({ knowledgeItemId: '../foreign' }),
    /Invalid Recall knowledge item id/,
  );
  assert.throws(
    () => parseRecallAttemptActionInput({ attemptId: 'not-an-attempt' }),
    /Invalid Recall attempt id/,
  );
  assert.throws(
    () => parseRecallConfidenceActionInput({ attemptId: ATTEMPT_ID, confidence: 'certain' }),
    /Invalid Recall confidence/,
  );
  assert.throws(
    () => parseRecallCompleteActionInput({ attemptId: ATTEMPT_ID, outcome: 'perfect' }),
    /Invalid Recall outcome/,
  );
  assert.throws(
    () => parseRecallEnrollActionInput({ knowledgeItemId: 'item_1', itemVersion: 0 }),
    /Invalid Recall item version/,
  );
  assert.throws(() => parseRecallCancelActionInput({
    knowledgeItemId: 'item_1',
    itemVersion: 1,
    scheduleVersion: 1,
    enrolledAt: 'tomorrow',
  }), /Invalid Recall enrollment instant/);
});
