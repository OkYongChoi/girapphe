import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMobilePracticeCursorState,
  type MobilePracticeCursorState,
} from './mobile-practice-cursor';
import { loadMobilePracticeCardAfterCursor } from './mobile-practice-selector';

type Card = { id: string };

function laneLoader(
  lane: 'public' | 'private',
  cards: Card[],
  calls: string[],
): (afterCardId: string | null) => Promise<Card | null> {
  return async (afterCardId) => {
    calls.push(lane + ':' + (afterCardId ?? 'null'));
    return cards
      .filter((card) => card.id > (afterCardId ?? ''))
      .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))[0]
      ?? null;
  };
}

test('alternates public and private lanes and visits every key exactly once', async () => {
  const calls: string[] = [];
  const loadNextPublic = laneLoader('public', [{ id: 'public-a' }, { id: 'public-c' }], calls);
  const loadNextPrivate = laneLoader(
    'private',
    [{ id: 'personal:b' }, { id: 'personal:d' }],
    calls,
  );
  let cursor: MobilePracticeCursorState | null = null;
  const visited: string[] = [];

  for (let index = 0; index < 5; index += 1) {
    const result: {
      card: Card | null;
      nextCursor: MobilePracticeCursorState;
    } = await loadMobilePracticeCardAfterCursor({
      mode: 'new',
      cursor,
      getCardId: (card) => card.id,
      loadNextPublic,
      loadNextPrivate,
    });
    cursor = result.nextCursor;
    if (result.card) visited.push(result.card.id);
  }

  assert.deepEqual(visited, ['public-a', 'personal:b', 'public-c', 'personal:d']);
  assert.equal(new Set(visited).size, visited.length);
  assert.equal(cursor?.publicDone, true);
  assert.equal(cursor?.privateDone, true);
  assert.deepEqual(calls, [
    'public:null',
    'private:null',
    'public:public-a',
    'private:personal:b',
    'public:public-c',
    'private:personal:d',
  ]);
});

test('falls through an empty preferred lane and never queries a completed lane again', async () => {
  const calls: string[] = [];
  const first = await loadMobilePracticeCardAfterCursor({
    mode: 'review',
    cursor: null,
    getCardId: (card: Card) => card.id,
    loadNextPublic: laneLoader('public', [], calls),
    loadNextPrivate: laneLoader('private', [{ id: 'personal:only' }], calls),
  });
  assert.equal(first.card?.id, 'personal:only');
  assert.equal(first.nextCursor.publicDone, true);
  assert.deepEqual(calls, ['public:null', 'private:null']);

  calls.length = 0;
  const second = await loadMobilePracticeCardAfterCursor({
    mode: 'review',
    cursor: first.nextCursor,
    getCardId: (card: Card) => card.id,
    loadNextPublic: laneLoader('public', [{ id: 'should-not-run' }], calls),
    loadNextPrivate: laneLoader('private', [{ id: 'personal:only' }], calls),
  });
  assert.equal(second.card, null);
  assert.deepEqual(calls, ['private:personal:only']);
});

test('does not mutate an input cursor and rejects an empty selected id', async () => {
  const cursor = createMobilePracticeCursorState('new');
  const snapshot = structuredClone(cursor);
  const result = await loadMobilePracticeCardAfterCursor({
    mode: 'new',
    cursor,
    getCardId: (card: Card) => card.id,
    loadNextPublic: async () => ({ id: 'public-a' }),
    loadNextPrivate: async () => null,
  });
  assert.deepEqual(cursor, snapshot);
  assert.notEqual(result.nextCursor, cursor);

  await assert.rejects(
    () => loadMobilePracticeCardAfterCursor({
      mode: 'new',
      cursor: null,
      getCardId: (card: Card) => card.id,
      loadNextPublic: async () => ({ id: '' }),
      loadNextPrivate: async () => null,
    }),
    /Practice card id cannot be empty/,
  );
});
