import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getKnowledgeMapSearchTerms,
  matchesKnowledgeMapCard,
  paginateKnowledgeMapCards,
} from './knowledge-map-pagination';

const cards = [
  {
    id: 'linear_algebra',
    title: 'Linear Algebra',
    summary: 'Vectors and matrices.',
    domain: 'mathematics',
    domains: ['mathematics'],
    status: null,
  },
  {
    id: 'neural_network',
    title: 'Neural Network',
    summary: 'A layered learning model.',
    domain: 'machine_learning',
    domains: ['machine_learning', 'computer_science'],
    tags: ['deep-learning'],
    status: 'saved' as const,
  },
  {
    id: 'bayes_rule',
    title: 'Bayes Rule',
    summary: 'Update probabilities with evidence.',
    domain: 'statistics',
    domains: ['statistics'],
    status: 'known' as const,
  },
];

test('knowledge map search preserves title, summary, domain, and tag matching without explanations', () => {
  assert.deepEqual(getKnowledgeMapSearchTerms(' neural #machine_learning '), ['neural', 'machine_learning']);
  assert.equal(matchesKnowledgeMapCard(cards[1], { query: 'layered' }), true);
  assert.equal(matchesKnowledgeMapCard(cards[1], { query: '#machine_learning' }), true);
  assert.equal(matchesKnowledgeMapCard(cards[1], { query: '#deep-learning' }), true);
  assert.equal(matchesKnowledgeMapCard(cards[1], { query: 'backpropagation' }), false);
});

test('knowledge map pagination returns a bounded server window and exact total', () => {
  const page = paginateKnowledgeMapCards(cards, { page: 2, pageSize: 2, sort: 'title' });

  assert.equal(page.total, 3);
  assert.equal(page.hasMore, false);
  assert.deepEqual(page.cards.map((card) => card.id), ['neural_network']);
});
