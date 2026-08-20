import assert from 'node:assert/strict';
import test from 'node:test';
import type { GraphNode } from '@stem-brain/graph-engine';
import {
  filterPersonalBrowseConcepts,
  isCurrentPrivateGraphOwner,
  mergeBrowseConcepts,
  mergeBrowseDomains,
  resolveBrowseDomain,
} from './browse-concepts';

const publicNode: GraphNode = {
  id: 'gradient_descent',
  label: 'Gradient Descent',
  domain: 'Machine Learning',
  level: 2,
  difficulty: 3,
  type: 'algorithm',
};

const privateNote = {
  id: 'note-1',
  title: 'Learning-rate checklist',
  summary: 'A short optimization reminder',
  content: 'Reduce the step size when training diverges.',
  topic: 'machine-learning',
  tags: ['optimization'],
};

test('injects private notes into Concepts with collision-safe personal ids', () => {
  const concepts = mergeBrowseConcepts([{ ...publicNode, id: privateNote.id }], [privateNote]);

  assert.deepEqual(concepts.map((concept) => concept.id), ['personal:note-1', 'note-1']);
  assert.equal(concepts[0]?.kind, 'personal');
  assert.equal(concepts[1]?.kind, 'public');
});

test('shows private graph state only for the currently authenticated owner', () => {
  assert.equal(isCurrentPrivateGraphOwner(true, 'user-a', 'user-a'), true);
  assert.equal(isCurrentPrivateGraphOwner(true, 'user-b', 'user-a'), false);
  assert.equal(isCurrentPrivateGraphOwner(false, 'user-a', 'user-a'), false);
  assert.equal(isCurrentPrivateGraphOwner(true, null, 'user-a'), false);
});

test('normalizes personal topics and resolves removed topic filters', () => {
  assert.deepEqual(
    mergeBrowseDomains(['All', 'Machine Learning'], [privateNote]),
    ['All', 'Machine Learning'],
  );
  assert.deepEqual(
    mergeBrowseDomains(['All', 'Machine Learning'], [{ ...privateNote, topic: 'all' }]),
    ['All', 'Machine Learning'],
  );
  assert.equal(
    resolveBrowseDomain('machine-learning', ['All', 'Machine Learning'], [privateNote]),
    'Machine Learning',
  );
  assert.equal(
    resolveBrowseDomain('custom-topic', ['All', 'Machine Learning'], [
      { ...privateNote, topic: 'custom-topic' },
    ]),
    'custom-topic',
  );
  assert.equal(
    resolveBrowseDomain('custom-topic', ['All', 'Machine Learning'], []),
    'All',
  );
});

test('searches private concept content and respects concept filters', () => {
  assert.deepEqual(
    filterPersonalBrowseConcepts([privateNote], {
      query: 'step size',
      domain: 'All',
      difficulty: 'All',
      locale: 'en',
    }),
    [privateNote],
  );
  assert.deepEqual(
    filterPersonalBrowseConcepts([privateNote], {
      query: 'optimization',
      domain: 'Machine Learning',
      difficulty: 'All',
      locale: 'en',
    }),
    [privateNote],
  );
  assert.deepEqual(
    filterPersonalBrowseConcepts([privateNote], {
      query: 'machine learning',
      domain: 'All',
      difficulty: 'All',
      locale: 'en',
    }),
    [privateNote],
  );
  assert.deepEqual(
    filterPersonalBrowseConcepts([privateNote], {
      query: '#optimization',
      domain: 'All',
      difficulty: 'All',
      locale: 'en',
    }),
    [privateNote],
  );
  assert.deepEqual(
    filterPersonalBrowseConcepts([privateNote], {
      query: '',
      domain: 'Mathematics',
      difficulty: 'All',
      locale: 'en',
    }),
    [],
  );
  assert.deepEqual(
    filterPersonalBrowseConcepts([privateNote], {
      query: '',
      domain: 'All',
      difficulty: 3,
      locale: 'en',
    }),
    [],
  );
});
