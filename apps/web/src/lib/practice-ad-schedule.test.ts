import assert from 'node:assert/strict';
import test from 'node:test';
import { getPracticeAdSequence } from './practice-ad-schedule';

test('shows one ad after each exact group of five successful actions', () => {
  assert.deepEqual(
    Array.from({ length: 12 }, (_, index) => getPracticeAdSequence(index + 1, false)),
    [null, null, null, null, 1, null, null, null, null, 2, null, null],
  );
});

test('never schedules ads for ad-free subscribers', () => {
  assert.equal(getPracticeAdSequence(5, true), null);
  assert.equal(getPracticeAdSequence(10, true), null);
});
