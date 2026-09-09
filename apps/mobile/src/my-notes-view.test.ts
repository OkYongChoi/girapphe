import assert from 'node:assert/strict';
import test from 'node:test';
import type { KnowledgeBundleType } from '@stem-brain/shared';
import {
  buildMyNotesListRows,
  createMyNotesPendingActionGuard,
  createMyNotesViewRequestGuard,
  filterAndSortMyNotes,
  localCalendarPeriod,
  myNotesViewCapabilities,
  type MyNotesViewItem,
  type MyNotesViewOptions,
} from './my-notes-view';

const now = new Date(2026, 8, 9, 12);

function localIso(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

function note(overrides: Partial<MyNotesViewItem> & { id: string }): MyNotesViewItem {
  return {
    id: overrides.id,
    title: overrides.title ?? `Note ${overrides.id}`,
    topic: overrides.topic ?? 'Physics',
    summary: overrides.summary ?? '',
    content: overrides.content ?? '',
    tags: overrides.tags ?? [],
    knowledge_type: overrides.knowledge_type ?? null,
    central_question: overrides.central_question ?? null,
    created_at: overrides.created_at ?? localIso(2026, 9, 9),
    updated_at: overrides.updated_at ?? localIso(2026, 9, 9),
  };
}

const baseOptions: MyNotesViewOptions = {
  query: '',
  topic: 'all',
  knowledgeType: 'all',
  dateRange: 'all',
  sortBy: 'created',
  locale: 'en',
};

test('search includes plain and hash-prefixed tags', () => {
  const tagged = note({ id: 'tagged', tags: ['relativity', 'spacetime'] });
  const other = note({ id: 'other', tags: ['chemistry'] });

  assert.deepEqual(
    filterAndSortMyNotes([other, tagged], { ...baseOptions, query: 'spacetime' }, now),
    [tagged],
  );
  assert.deepEqual(
    filterAndSortMyNotes([other, tagged], { ...baseOptions, query: '#relativity' }, now),
    [tagged],
  );
});

test('filters quick notes and each typed knowledge bundle independently', () => {
  const legacy = note({ id: 'legacy' });
  const concept = note({ id: 'concept', knowledge_type: 'concept' });
  const question = note({ id: 'question', knowledge_type: 'question' });

  assert.deepEqual(
    filterAndSortMyNotes([legacy, concept, question], { ...baseOptions, knowledgeType: 'legacy' }, now),
    [legacy],
  );
  assert.deepEqual(
    filterAndSortMyNotes([legacy, concept, question], { ...baseOptions, knowledgeType: 'question' }, now),
    [question],
  );

  const everyType: KnowledgeBundleType[] = [
    'concept', 'procedure', 'comparison', 'mechanism', 'structure', 'claim_evidence',
    'question', 'decision', 'event', 'expression',
  ];
  assert.ok(everyType.every((knowledgeType) =>
    filterAndSortMyNotes(
      [note({ id: knowledgeType, knowledge_type: knowledgeType })],
      { ...baseOptions, knowledgeType },
      now,
    ).length === 1));
});

test('date ranges use local day, Monday week, and month boundaries', () => {
  const today = note({ id: 'today', created_at: localIso(2026, 9, 9) });
  const week = note({ id: 'week', created_at: localIso(2026, 9, 7) });
  const month = note({ id: 'month', created_at: localIso(2026, 9, 1) });
  const earlier = note({ id: 'earlier', created_at: localIso(2026, 8, 31) });
  const items = [earlier, month, week, today];

  assert.deepEqual(filterAndSortMyNotes(items, { ...baseOptions, dateRange: 'today' }, now).map(({ id }) => id), ['today']);
  assert.deepEqual(filterAndSortMyNotes(items, { ...baseOptions, dateRange: 'week' }, now).map(({ id }) => id), ['today', 'week']);
  assert.deepEqual(filterAndSortMyNotes(items, { ...baseOptions, dateRange: 'month' }, now).map(({ id }) => id), ['today', 'week', 'month']);
  assert.deepEqual(filterAndSortMyNotes(items, baseOptions, now).map(({ id }) => id), ['today', 'week', 'month', 'earlier']);
});

test('sort choice is applied after query, topic, type, and date filters', () => {
  const beta = note({
    id: 'beta', title: 'Beta', topic: 'Math', knowledge_type: 'concept', tags: ['proof'],
    created_at: localIso(2026, 9, 8), updated_at: localIso(2026, 9, 9, 11),
  });
  const alpha = note({
    id: 'alpha', title: 'Alpha', topic: 'Math', knowledge_type: 'concept', tags: ['proof'],
    created_at: localIso(2026, 9, 9), updated_at: localIso(2026, 9, 8),
  });

  const filtered = [beta, alpha];
  assert.deepEqual(filterAndSortMyNotes(filtered, {
    ...baseOptions, query: 'proof', topic: 'Math', knowledgeType: 'concept', dateRange: 'week', sortBy: 'title',
  }, now).map(({ id }) => id), ['alpha', 'beta']);
  assert.deepEqual(filterAndSortMyNotes(filtered, { ...baseOptions, sortBy: 'updated' }, now).map(({ id }) => id), ['beta', 'alpha']);
});

test('flattens local calendar groups into stable FlatList rows', () => {
  const items = [
    note({ id: 'today', created_at: localIso(2026, 9, 9) }),
    note({ id: 'earlier', created_at: localIso(2026, 8, 31) }),
    note({ id: 'month', created_at: localIso(2026, 9, 1) }),
    note({ id: 'today-again', created_at: localIso(2026, 9, 9, 8) }),
    note({ id: 'week', created_at: localIso(2026, 9, 7) }),
  ];

  assert.deepEqual(items.map((item) => localCalendarPeriod(item.created_at, now)), [
    'today', 'earlier', 'this-month', 'today', 'this-week',
  ]);
  assert.deepEqual(buildMyNotesListRows(items, 'created', now).map((row) => row.key), [
    'group:today', 'note:today', 'note:today-again',
    'group:this-week', 'note:week',
    'group:this-month', 'note:month',
    'group:earlier', 'note:earlier',
  ]);
});

test('preserves global title and updated sorts instead of regrouping by created period', () => {
  const olderAlpha = note({
    id: 'older-alpha',
    title: 'Alpha',
    created_at: localIso(2026, 8, 31),
    updated_at: localIso(2026, 9, 9, 11),
  });
  const todayZulu = note({
    id: 'today-zulu',
    title: 'Zulu',
    created_at: localIso(2026, 9, 9),
    updated_at: localIso(2026, 9, 8),
  });

  const byTitle = filterAndSortMyNotes([todayZulu, olderAlpha], { ...baseOptions, sortBy: 'title' }, now);
  const byUpdated = filterAndSortMyNotes([todayZulu, olderAlpha], { ...baseOptions, sortBy: 'updated' }, now);

  assert.deepEqual(buildMyNotesListRows(byTitle, 'title', now).map((row) => row.key), [
    'note:older-alpha', 'note:today-zulu',
  ]);
  assert.deepEqual(buildMyNotesListRows(byUpdated, 'updated', now).map((row) => row.key), [
    'note:older-alpha', 'note:today-zulu',
  ]);
});

test('view capabilities keep editing active-only and expose lifecycle actions safely', () => {
  assert.deepEqual(myNotesViewCapabilities('active'), {
    showsEditor: true,
    canEdit: true,
    canArchive: true,
    canRestoreArchived: false,
    canMoveToTrash: true,
    canRestoreTrash: false,
  });
  assert.deepEqual(myNotesViewCapabilities('archive'), {
    showsEditor: false,
    canEdit: false,
    canArchive: false,
    canRestoreArchived: true,
    canMoveToTrash: true,
    canRestoreTrash: false,
  });
  assert.deepEqual(myNotesViewCapabilities('trash'), {
    showsEditor: false,
    canEdit: false,
    canArchive: false,
    canRestoreArchived: false,
    canMoveToTrash: false,
    canRestoreTrash: true,
  });
});

test('view request guard rejects responses from a previously selected lifecycle tab', () => {
  const guard = createMyNotesViewRequestGuard();
  const activeRequest = guard.begin();
  assert.equal(guard.isCurrent('active', activeRequest), true);

  guard.select('archive');
  const archiveRequest = guard.begin();
  assert.equal(guard.isCurrent('active', activeRequest), false);
  assert.equal(guard.isCurrent('archive', archiveRequest), true);
  assert.equal(guard.isSelected('active'), false);
  assert.equal(guard.isSelected('archive'), true);
  assert.equal(guard.selected(), 'archive');

  guard.select('trash');
  assert.equal(guard.isCurrent('archive', archiveRequest), false);
  assert.equal(guard.selected(), 'trash');
});

test('pending action guard rejects rapid duplicate and cross-note mutations', () => {
  const guard = createMyNotesPendingActionGuard();

  assert.equal(guard.begin('note-a'), true);
  assert.equal(guard.isPending(), true);
  assert.equal(guard.pendingId(), 'note-a');
  assert.equal(guard.begin('note-a'), false);
  assert.equal(guard.begin('note-b'), false);

  guard.finish('note-b');
  assert.equal(guard.isPending(), true);
  assert.equal(guard.pendingId(), 'note-a');

  guard.finish('note-a');
  assert.equal(guard.isPending(), false);
  assert.equal(guard.pendingId(), null);
  assert.equal(guard.begin('note-b'), true);
});
