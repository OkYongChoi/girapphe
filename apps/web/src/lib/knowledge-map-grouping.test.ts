import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLAT_CONCEPT_GROUP_KEY,
  UNTAGGED_CONCEPT_GROUP_KEY,
  groupConceptCards,
  limitConceptCardGroups,
} from './knowledge-map-grouping';

type TestCard = {
  id: string;
  title: string;
  domain?: string;
  domains?: string[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
};

function cardIdsByGroup(groups: ReturnType<typeof groupConceptCards<TestCard>>) {
  return Object.fromEntries(groups.map((group) => [
    group.key,
    group.cards.map((card) => card.id),
  ]));
}

test('groups each card by only its first non-empty domain or tag', () => {
  const cards: TestCard[] = [
    { id: 'multi', title: 'Multi', domain: 'fallback', domains: ['math', 'physics'], tags: ['bayes', 'probability'] },
    { id: 'physics', title: 'Physics', domain: 'physics', domains: ['physics'], tags: ['probability'] },
    { id: 'blank-first', title: 'Blank first', domain: 'fallback', domains: [' ', 'chemistry'], tags: [' ', 'ml'] },
    { id: 'domain-fallback', title: 'Fallback', domain: 'biology', domains: [], tags: [] },
    { id: 'other-fallback', title: 'Other', domains: [], tags: [] },
  ];

  const domainGroups = groupConceptCards(cards, 'domain', 'title');
  assert.deepEqual(domainGroups.map((group) => group.key), ['biology', 'chemistry', 'math', 'other', 'physics']);
  assert.deepEqual(cardIdsByGroup(domainGroups), {
    biology: ['domain-fallback'],
    chemistry: ['blank-first'],
    math: ['multi'],
    other: ['other-fallback'],
    physics: ['physics'],
  });

  const tagGroups = groupConceptCards(cards, 'tag', 'title');
  assert.deepEqual(cardIdsByGroup(tagGroups), {
    bayes: ['multi'],
    ml: ['blank-first'],
    probability: ['physics'],
    [UNTAGGED_CONCEPT_GROUP_KEY]: ['domain-fallback', 'other-fallback'],
  });
});

test('orders group keys alphabetically with the untagged group last', () => {
  const cards: TestCard[] = [
    { id: 'untagged', title: 'Untagged', tags: [] },
    { id: 'zeta', title: 'Zeta', tags: ['zeta'] },
    { id: 'alpha', title: 'Alpha', tags: ['alpha'] },
  ];

  assert.deepEqual(
    groupConceptCards(cards, 'tag', 'title').map((group) => group.key),
    ['alpha', 'zeta', UNTAGGED_CONCEPT_GROUP_KEY],
  );
});

test('sorts cards independently within each group using the requested concept sort', () => {
  const cards: TestCard[] = [
    { id: 'math-old', title: 'Zeta', domain: 'math', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'physics-old', title: 'Beta', domain: 'physics', createdAt: '2026-08-02T00:00:00.000Z' },
    { id: 'math-new', title: 'Alpha', domain: 'math', createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'physics-new', title: 'Gamma', domain: 'physics', createdAt: '2026-08-19T00:00:00.000Z' },
  ];

  assert.deepEqual(cardIdsByGroup(groupConceptCards(cards, 'domain', 'newest')), {
    math: ['math-new', 'math-old'],
    physics: ['physics-new', 'physics-old'],
  });
  assert.deepEqual(cardIdsByGroup(groupConceptCards(cards, 'domain', 'title')), {
    math: ['math-new', 'math-old'],
    physics: ['physics-old', 'physics-new'],
  });
});

test('returns one sorted flat group when grouping is disabled', () => {
  const cards: TestCard[] = [
    { id: 'zeta', title: 'Zeta', domain: 'math' },
    { id: 'alpha', title: 'Alpha', domain: 'physics' },
  ];

  assert.deepEqual(groupConceptCards(cards, 'none', 'title'), [{
    key: FLAT_CONCEPT_GROUP_KEY,
    cards: [cards[1], cards[0]],
  }]);
  assert.deepEqual(groupConceptCards([], 'none', 'title'), [{
    key: FLAT_CONCEPT_GROUP_KEY,
    cards: [],
  }]);
});

test('limits grouped cards round-robin so early groups cannot monopolize initial rendering', () => {
  const groups = groupConceptCards([
    { id: 'a-1', title: 'A1', domain: 'a' },
    { id: 'a-2', title: 'A2', domain: 'a' },
    { id: 'a-3', title: 'A3', domain: 'a' },
    { id: 'b-1', title: 'B1', domain: 'b' },
    { id: 'b-2', title: 'B2', domain: 'b' },
    { id: 'c-1', title: 'C1', domain: 'c' },
  ], 'domain', 'title');

  assert.deepEqual(
    limitConceptCardGroups(groups, 4).map((group) => [group.key, group.cards.map((entry) => entry.id)]),
    [['a', ['a-1', 'a-2']], ['b', ['b-1']], ['c', ['c-1']]],
  );
});

test('does not mutate the input array or nested taxonomy arrays', () => {
  const cards: TestCard[] = [
    { id: 'zeta', title: 'Zeta', domain: 'math', domains: ['math', 'physics'], tags: ['zeta', 'secondary'] },
    { id: 'alpha', title: 'Alpha', domain: 'math', domains: ['math'], tags: ['alpha'] },
  ];
  const snapshot = structuredClone(cards);

  groupConceptCards(cards, 'domain', 'title');
  groupConceptCards(cards, 'tag', 'newest');
  groupConceptCards(cards, 'none', 'title');

  assert.deepEqual(cards, snapshot);
});
