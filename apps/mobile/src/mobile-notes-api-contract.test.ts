import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mobileApiSource = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
const mobileNotesSource = readFileSync(join(sourceDir, '../app/(tabs)/notes.tsx'), 'utf8');
const mobileRouteSource = readFileSync(
  join(sourceDir, '../../web/src/app/api/mobile/route.ts'),
  'utf8',
);

test('mobile notes expose all lifecycle views and archived metadata', () => {
  assert.match(
    mobileApiSource,
    /notes: \(view: 'active' \| 'archive' \| 'trash' = 'active'\)/,
  );
  assert.match(mobileApiSource, /archived_at: string \| null/);
  assert.match(mobileRouteSource, /view === 'archive'[\s\S]*getArchivedKnowledgeItems\(\)/);
  assert.match(mobileRouteSource, /archived_at: item\.archived_at/);
});

test('archive and unarchive mutations require the current optimistic version', () => {
  const lifecycleBlock = mobileRouteSource.match(
    /if \(action === 'archive-note' \|\| action === 'restore-archived-note'\) \{([\s\S]*?)\n {2}\}/,
  )?.[1] ?? '';

  assert.match(lifecycleBlock, /Number\.isSafeInteger\(version\)/);
  assert.match(lifecycleBlock, /archiveKnowledgeItem\(toFormData\(\{ id, version: String\(version\) \}\)\)/);
  assert.match(lifecycleBlock, /restoreArchivedKnowledgeItem\(toFormData\(\{ id, version: String\(version\) \}\)\)/);
  assert.match(lifecycleBlock, /code: 'NOTE_STALE'/);
  assert.match(lifecycleBlock, /status: 409/);
});

test('my notes lifecycle controls meet the native accessibility contract', () => {
  assert.match(mobileNotesSource, /accessibilityLiveRegion="assertive" accessibilityRole="alert"/);
  for (const styleName of ['tab', 'filter', 'typeButton', 'actionButton']) {
    assert.match(mobileNotesSource, new RegExp(styleName + ': \\{[^\\n]*minHeight: 44'));
  }
  assert.ok((mobileNotesSource.match(/styles\.actionButton/g) ?? []).length >= 7);
});
