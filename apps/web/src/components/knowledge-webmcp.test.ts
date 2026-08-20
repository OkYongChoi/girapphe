import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterKnowledgeSearchCards,
  getKnowledgeSearchTerms,
  normalizeKnowledgeSearchInput,
  resolveKnowledgeSearchDomain,
  searchPublicKnowledgeCatalog,
  toCompactKnowledgeSearchResults,
  type KnowledgeSearchCard,
} from './knowledge-map-webmcp';

const NOW = new Date('2026-08-20T12:00:00.000Z');

const CARDS: KnowledgeSearchCard[] = [
  {
    id: 'graph_gradient_descent',
    title: 'Gradient descent',
    summary: 'Optimize a differentiable objective iteratively.',
    explanation: 'Follow the negative gradient.',
    domain: 'optimization',
    tags: ['machine_learning', 'first_order'],
    status: 'known',
    createdAt: '2026-08-19T12:00:00.000Z',
  },
  {
    id: 'personal:bayes-note',
    title: 'Bayes update note',
    summary: 'Posterior reasoning for a private example.',
    domain: 'probability',
    tags: ['bayes', 'evidence'],
    status: 'saved',
    createdAt: '2026-07-01T12:00:00.000Z',
    isPersonal: true,
  },
  {
    id: 'graph_convexity',
    title: 'Convexity',
    summary: 'A static curated concept without a creation date.',
    domain: 'optimization',
    tags: ['geometry'],
    status: null,
  },
];

test('normalizes WebMCP search input without introducing semantic behavior', () => {
  assert.deepEqual(normalizeKnowledgeSearchInput({
    query: '  #Machine_Learning gradient  ',
    domain: 'optimization',
    status: 'known',
    added_within: 'week',
    ignored: 'not part of the filter contract',
  }), {
    query: '#Machine_Learning gradient',
    domain: 'optimization',
    status: 'known',
    addedWithin: 'week',
  });
  assert.deepEqual(getKnowledgeSearchTerms('#Machine_Learning gradient'), [
    'machine_learning',
    'gradient',
  ]);
});

test('uses the Knowledge Map keyword, tag, domain, status, and date filters together', () => {
  const matches = filterKnowledgeSearchCards(CARDS, {
    query: '#machine_learning gradient',
    domain: 'optimization',
    status: 'known',
    addedWithin: 'week',
  }, NOW);

  assert.deepEqual(matches.map((card) => card.id), ['graph_gradient_descent']);
});

test('keeps undated curated cards visible for an active added-date filter', () => {
  const matches = filterKnowledgeSearchCards(CARDS, {
    query: 'convexity',
    domain: 'optimization',
    status: 'unstarted',
    addedWithin: 'today',
  }, NOW);

  assert.deepEqual(matches.map((card) => card.id), ['graph_convexity']);
});

test('resolves domain keys case-insensitively and returns compact bounded results', () => {
  assert.equal(resolveKnowledgeSearchDomain('Optimization', ['probability', 'optimization']), 'optimization');
  assert.equal(resolveKnowledgeSearchDomain('missing', ['probability', 'optimization']), null);
  assert.deepEqual(toCompactKnowledgeSearchResults(CARDS, 2), [
    {
      id: 'graph_gradient_descent',
      title: 'Gradient descent',
      domain: 'optimization',
    },
    {
      id: 'graph_convexity',
      title: 'Convexity',
      domain: 'optimization',
    },
  ]);
});

test('keeps personal and mastery metadata out of public WebMCP catalog results', () => {
  const catalogMatches = searchPublicKnowledgeCatalog(CARDS, {
    query: '',
    domain: 'all',
    status: 'known',
    addedWithin: 'all',
  }, NOW);
  const output = toCompactKnowledgeSearchResults(catalogMatches);

  assert.deepEqual(catalogMatches.map((card) => card.id), [
    'graph_gradient_descent',
    'graph_convexity',
  ]);
  assert.deepEqual(output, [
    { id: 'graph_gradient_descent', title: 'Gradient descent', domain: 'optimization' },
    { id: 'graph_convexity', title: 'Convexity', domain: 'optimization' },
  ]);
  assert.equal(output.some((card) => 'status' in card || card.id.startsWith('personal:')), false);
});

test('caps public WebMCP catalog output at five cards', () => {
  const publicCards = Array.from({ length: 8 }, (_, index): KnowledgeSearchCard => ({
    id: `graph_public_${index}`,
    title: `Public concept ${index}`,
    domain: 'public_domain',
    status: null,
  }));

  assert.equal(toCompactKnowledgeSearchResults(publicCards).length, 5);
});
