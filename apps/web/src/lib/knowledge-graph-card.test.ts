import assert from 'node:assert/strict';
import test from 'node:test';
import { toKnowledgeGraphCard } from './knowledge-graph-card';

const ALLOWED_GRAPH_CARD_KEYS = [
  'domain',
  'domains',
  'explanation',
  'id',
  'level',
  'status',
  'summary',
  'title',
  'wiki_url',
] as const;

test('keeps only fields consumed by the public 3D graph', () => {
  const graphCard = toKnowledgeGraphCard({
    id: 'graph_bayes_theorem',
    title: '베이즈 정리',
    summary: '새 증거로 믿음을 갱신하는 규칙입니다.',
    explanation: '사전확률과 가능도를 결합해 사후확률을 구합니다.',
    wiki_url: 'https://en.wikipedia.org/wiki/Bayes%27_theorem',
    domain: 'probability_and_statistics',
    domains: ['mathematics', 'probability_and_statistics'],
    level: 'understand' as const,
    status: 'saved' as const,
    createdAt: '2026-08-30T00:00:00.000Z',
    updatedAt: '2026-08-30T01:00:00.000Z',
    aliases: ['Bayes theorem', 'Bayes rule'],
    prerequisites: [{ id: 'graph_conditional_probability', label: 'Conditional probability', status: null }],
    related_concepts: ['Conditional probability'],
    structured_content: {
      type: 'concept',
      sections: [{ heading: 'Derivation', content: 'detail that the graph does not render' }],
    },
    bundle_schema_version: 1,
    translation_status: 'human',
  });

  assert.deepEqual(Object.keys(graphCard).sort(), [...ALLOWED_GRAPH_CARD_KEYS]);
  assert.deepEqual(graphCard, {
    id: 'graph_bayes_theorem',
    title: '베이즈 정리',
    summary: '새 증거로 믿음을 갱신하는 규칙입니다.',
    explanation: '사전확률과 가능도를 결합해 사후확률을 구합니다.',
    wiki_url: 'https://en.wikipedia.org/wiki/Bayes%27_theorem',
    domain: 'probability_and_statistics',
    domains: ['mathematics', 'probability_and_statistics'],
    level: 'understand',
    status: 'saved',
  });
});

test('removes large structured content before graph snapshot serialization', () => {
  const largeMarker = 'typed-bundle-payload-marker';
  const sourceCard = {
    id: 'graph_large_bundle',
    title: 'Compact graph card',
    summary: 'Short graph summary',
    explanation: 'Only this graph explanation should cross the server action boundary.',
    wiki_url: '',
    domain: 'computer_science',
    domains: ['computer_science'],
    level: 'connect' as const,
    status: null,
    structured_content: {
      type: 'mechanism',
      central_question: 'How does the mechanism work?',
      sections: Array.from({ length: 128 }, (_, index) => ({
        heading: `Section ${index}`,
        content: `${largeMarker}:${index}:${'x'.repeat(2_048)}`,
      })),
    },
    aliases: Array.from({ length: 256 }, (_, index) => `search-alias-${index}`),
    prerequisites: Array.from({ length: 128 }, (_, index) => ({
      id: `prerequisite-${index}`,
      label: `Prerequisite ${index}`,
      status: null,
    })),
    related_concepts: Array.from({ length: 128 }, (_, index) => `Related concept ${index}`),
  };

  const sourceJson = JSON.stringify(sourceCard);
  const compactJson = JSON.stringify(toKnowledgeGraphCard(sourceCard));

  assert.equal(compactJson.includes(largeMarker), false);
  assert.ok(sourceJson.length > 250_000);
  assert.ok(compactJson.length < sourceJson.length / 500);
});

test('provides the primary domain when legacy graph cards have no domains array', () => {
  const graphCard = toKnowledgeGraphCard({
    id: 'graph_legacy',
    title: 'Legacy card',
    summary: 'Legacy summary',
    explanation: 'Legacy explanation',
    wiki_url: '',
    domain: 'mathematics',
    level: 'memorize',
    status: null,
  });

  assert.deepEqual(graphCard.domains, ['mathematics']);
});
