import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAddedDateRangeStart,
  isWithinAddedDateRange,
  isWithinAddedDateRangeOrUndated,
  sortConceptCards,
} from './knowledge-map-time';

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

test('added-date filtering keeps undated static concepts visible', () => {
  const now = new Date('2026-08-19T12:00:00.000Z');

  assert.equal(isWithinAddedDateRangeOrUndated(undefined, 'week', now), true);
  assert.equal(isWithinAddedDateRangeOrUndated('not-a-date', 'week', now), false);
  assert.equal(isWithinAddedDateRangeOrUndated('2026-08-12T11:59:59.999Z', 'week', now), false);
});

test('concept sorting is global rather than limited to a domain group', () => {
  const cards = [
    { title: 'Older mathematics', createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-18T12:00:00.000Z' },
    { title: 'Newest physics', createdAt: '2026-08-19T12:00:00.000Z', updatedAt: '2026-08-10T12:00:00.000Z' },
    { title: 'Newest update computer science', createdAt: '2026-08-02T12:00:00.000Z', updatedAt: '2026-08-19T12:00:00.000Z' },
  ];

  assert.deepEqual(
    sortConceptCards(cards, 'newest').map((card) => card.title),
    ['Newest physics', 'Newest update computer science', 'Older mathematics'],
  );
  assert.deepEqual(
    sortConceptCards(cards, 'updated').map((card) => card.title),
    ['Newest update computer science', 'Older mathematics', 'Newest physics'],
  );
});
