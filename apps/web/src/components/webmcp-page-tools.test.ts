import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolvePracticeMode,
  selectPendingReview,
} from './webmcp-page-tools';

const BATCHES = [
  { id: 'batch-newest' },
  { id: 'batch-older' },
] as const;

test('selectPendingReview defaults to the first pending batch', () => {
  assert.deepEqual(selectPendingReview(BATCHES), BATCHES[0]);
});

test('selectPendingReview only selects an exact current batch ID', () => {
  assert.deepEqual(selectPendingReview(BATCHES, 'batch-older'), BATCHES[1]);
  assert.equal(selectPendingReview(BATCHES, 'missing'), undefined);
});

test('resolvePracticeMode requires an explicit visible practice choice', () => {
  assert.equal(resolvePracticeMode(undefined), null);
});

test('resolvePracticeMode rejects modes outside the visible practice choices', () => {
  assert.equal(resolvePracticeMode('new'), 'new');
  assert.equal(resolvePracticeMode('review'), 'review');
  assert.equal(resolvePracticeMode('rate'), null);
});
