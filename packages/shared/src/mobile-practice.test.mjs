import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_MOBILE_PRACTICE_BODY_BYTES,
  MAX_MOBILE_PRACTICE_CARD_ID_LENGTH,
  MAX_MOBILE_PRACTICE_CURSOR_LENGTH,
  mergePracticeRoundExclusions,
} from './mobile-practice.ts';

test('mobile Practice keeps its stateless cursor request small and bounded', () => {
  assert.equal(MAX_MOBILE_PRACTICE_CARD_ID_LENGTH, 160);
  assert.equal(MAX_MOBILE_PRACTICE_CURSOR_LENGTH, 1_024);
  assert.equal(MAX_MOBILE_PRACTICE_BODY_BYTES, 2_048);
  const maximumRequestBytes = new TextEncoder().encode(JSON.stringify({
    mode: 'review',
    cursor: 'x'.repeat(MAX_MOBILE_PRACTICE_CURSOR_LENGTH),
    cycleOnEmpty: true,
  })).byteLength;
  assert.ok(maximumRequestBytes < MAX_MOBILE_PRACTICE_BODY_BYTES);
});

test('mixed Practice actions exclude rated and currently skipped cards once', () => {
  assert.deepEqual(
    mergePracticeRoundExclusions([
      ['rated-a', 'shared'],
      ['skipped-b', 'shared'],
      ['current-c'],
    ]),
    ['rated-a', 'shared', 'skipped-b', 'current-c'],
  );
});
