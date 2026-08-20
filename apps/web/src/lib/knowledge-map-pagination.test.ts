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

test('knowledge map pagination searches and title-sorts the localized compact fields it receives', () => {
  const localizedCards = [
    {
      id: 'public_z',
      title: 'Zulu',
      summary: '기본 개념입니다.',
      domain: 'mathematics',
      status: null,
    },
    {
      id: 'public_a',
      title: 'Alpha',
      summary: '한국어 검색 대상입니다.',
      domain: 'mathematics',
      status: null,
    },
  ];

  const searched = paginateKnowledgeMapCards(localizedCards, { query: '한국어', sort: 'title' });
  const sorted = paginateKnowledgeMapCards(localizedCards, { sort: 'title' });

  assert.deepEqual(searched.cards.map((card) => card.id), ['public_a']);
  assert.deepEqual(sorted.cards.map((card) => card.id), ['public_a', 'public_z']);
});

test('knowledge map pagination globally sorts compact public and personal cards together', () => {
  const page = paginateKnowledgeMapCards([
    {
      id: 'public_z',
      title: 'Zulu',
      summary: 'A public concept.',
      domain: 'mathematics',
      status: null,
    },
    {
      id: 'personal_alpha',
      title: 'Alpha',
      summary: 'A private concept.',
      domain: 'personal',
      tags: ['private'],
      status: null,
    },
  ], { sort: 'title' });

  assert.deepEqual(page.cards.map((card) => card.id), ['personal_alpha', 'public_z']);
});
