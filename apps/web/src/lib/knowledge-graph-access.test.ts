import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FREE_PUBLIC_GRAPH_CARD_LIMIT,
  selectBalancedGraphCards,
} from './knowledge-graph-access';

test('free public graph limit stays at the documented product boundary', () => {
  assert.equal(FREE_PUBLIC_GRAPH_CARD_LIMIT, 144);
});

test('selects graph cards round-robin across domains while preserving domain order', () => {
  const cards = [
    { id: 'a-1', domain: 'A' },
    { id: 'a-2', domain: 'A' },
    { id: 'a-3', domain: 'A' },
    { id: 'b-1', domain: 'B' },
    { id: 'b-2', domain: 'B' },
    { id: 'c-1', domains: ['C', 'A'] },
  ];

  assert.deepEqual(
    selectBalancedGraphCards(cards, 5).map((card) => card.id),
    ['a-1', 'b-1', 'c-1', 'a-2', 'b-2'],
  );
  assert.deepEqual(cards.map((card) => card.id), ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'c-1']);
});

test('returns all available cards when the graph is below the limit', () => {
  const cards = [{ id: 'one', domain: 'math' }, { id: 'two', domain: 'physics' }];
  assert.deepEqual(selectBalancedGraphCards(cards, 144), cards);
  assert.notEqual(selectBalancedGraphCards(cards, 144), cards);
});

test('returns no cards for a zero or negative limit', () => {
  assert.deepEqual(selectBalancedGraphCards([{ id: 'one' }], 0), []);
  assert.deepEqual(selectBalancedGraphCards([{ id: 'one' }], -1), []);
});
