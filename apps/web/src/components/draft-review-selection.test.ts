import assert from 'node:assert/strict';
import test from 'node:test';
import { draftDependencies, includeDraftDependencies } from './draft-review-selection';

test('selects draft relation targets by database ID or MCP client card ID', () => {
  const dependencies = draftDependencies([
    {
      id: 'draft-a',
      clientCardId: 'client-a',
      relations: [{ targetKind: 'draft', targetId: 'draft:client-b' }],
    },
    {
      id: 'draft-b',
      clientCardId: 'client-b',
      relations: [{ targetKind: 'draft', targetId: 'draft-c' }],
    },
    { id: 'draft-c', clientCardId: 'client-c', relations: [] },
  ]);

  assert.deepEqual([...dependencies.get('draft-a') ?? []], ['draft-b']);
  assert.deepEqual([...dependencies.get('draft-b') ?? []], ['draft-c']);
});

test('expands selected drafts transitively without adding public, private, or missing targets', () => {
  const dependencies = draftDependencies([
    {
      id: 'draft-a',
      relations: [
        { targetKind: 'draft', targetId: 'draft-b' },
        { targetKind: 'draft', targetId: 'missing-draft' },
        { targetKind: 'public', targetId: 'graph_probability' },
      ],
    },
    {
      id: 'draft-b',
      relations: [
        { targetKind: 'draft', targetId: 'draft-c' },
        { targetKind: 'private', targetId: 'personal:item-1' },
      ],
    },
    { id: 'draft-c', relations: [{ targetKind: 'draft', targetId: 'draft-a' }] },
  ]);

  assert.deepEqual(
    [...includeDraftDependencies(new Set(['draft-a']), dependencies)].sort(),
    ['draft-a', 'draft-b', 'draft-c']
  );
});
