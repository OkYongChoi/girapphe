import assert from 'node:assert/strict';
import test from 'node:test';
import { getAddedDateRangeStart, isWithinAddedDateRange } from './knowledge-map-time';

test('today starts at the KST calendar boundary', () => {
  const now = new Date('2026-08-19T16:30:00.000Z');

  assert.equal(
    getAddedDateRangeStart('today', now),
    Date.parse('2026-08-19T15:00:00.000Z'),
  );
});

test('rolling added-date ranges use their displayed durations', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');

  assert.equal(
    getAddedDateRangeStart('quarter', now),
    Date.parse('2026-05-21T12:00:00.000Z'),
  );
  assert.equal(
    getAddedDateRangeStart('year', now),
    Date.parse('2025-08-19T12:00:00.000Z'),
  );
});

test('added-date filtering excludes unavailable or older timestamps only when a period is active', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');

  assert.equal(isWithinAddedDateRange(undefined, 'all', now), true);
  assert.equal(isWithinAddedDateRange(undefined, 'week', now), false);
  assert.equal(isWithinAddedDateRange('2026-08-12T11:59:59.999Z', 'week', now), false);
  assert.equal(isWithinAddedDateRange('2026-08-12T12:00:00.000Z', 'week', now), true);
});
