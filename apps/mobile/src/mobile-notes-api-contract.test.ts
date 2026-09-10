import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const mobileApiSource = readFileSync(join(sourceDir, 'api.ts'), 'utf8');
const mobileNotesSource = readFileSync(join(sourceDir, '../app/(tabs)/notes.tsx'), 'utf8');
const mobileTagPickerSource = readFileSync(
  join(sourceDir, 'components/knowledge-tag-picker.tsx'),
  'utf8',
);
const mobileTagHelpersSource = readFileSync(join(sourceDir, 'mobile-knowledge-tags.ts'), 'utf8');
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

test('My Notes invalidates its active list request on blur', () => {
  assert.match(
    mobileNotesSource,
    /useFocusEffect\(useCallback\(\(\) => \{\s*void load\(\);\s*return \(\) => viewRequestGuard\.current\.invalidate\(\);\s*\}, \[load\]\)\)/,
  );
});

test('native note tags are owner-scoped, controlled, and included on create or update', () => {
  assert.match(
    mobileNotesSource,
    /collectKnowledgeTagSuggestions\(items\.map\(\(item\) => item\.tags\), locale\)/,
  );
  assert.match(mobileNotesSource, /const submittedTags = sanitizeKnowledgeTags\(\[\.\.\.tags, tagDraft\]\)/);
  assert.match(mobileNotesSource, /action: 'create-note'[\s\S]*tags: submittedTags/);
  assert.match(mobileNotesSource, /action: 'update-note'[\s\S]*tags: submittedTags/);
  assert.match(
    mobileNotesSource,
    /<KnowledgeTagPicker[\s\S]*key=\{tagEditorKey\}[\s\S]*value=\{tags\}[\s\S]*draft=\{tagDraft\}[\s\S]*suggestions=\{tagSuggestions\}[\s\S]*disabled=\{submitting\}/,
  );
  assert.ok((mobileNotesSource.match(/setTagEditorKey\(\(current\) => current \+ 1\)/g) ?? []).length >= 3);
});

test('native create retries keep one editor request and preserve edits after a replayed response', () => {
  assert.match(mobileNotesSource, /createRequestGuard = useRef\(createMyNotesCreateRequestGuard\(\)\)/);
  assert.match(
    mobileNotesSource,
    /const submittedDraftKey = JSON\.stringify\(createPayload\)[\s\S]*?createRequestGuard\.current\.begin\(submittedDraftKey\)[\s\S]*?requestId: createRequest\.requestId[\s\S]*?result\.outcome[\s\S]*?createRequestGuard\.current\.confirm\(createRequest\)/,
  );
  assert.match(
    mobileNotesSource,
    /preserveEditedReplay && editorRequestGuard\.current\.isCurrent\(editorRequest\)[\s\S]*?setEditorNotice\(t\('notes\.replayEditedNotice'\)\)[\s\S]*?await load\(sourceView\);[\s\S]*?return;/,
  );
  assert.match(
    mobileNotesSource,
    /reason\.code === 'KNOWLEDGE_ITEM_QUOTA_EXCEEDED'[\s\S]*?t\('notes\.quotaError'\)[\s\S]*?t\('notes\.quotaRetention'\)/,
  );
  assert.ok((mobileNotesSource.match(/createRequestGuard\.current\.reset\(\)/g) ?? []).length >= 5);
});

test('native tag picker keeps suggestions opt-in, render-bounded, and touch accessible', () => {
  assert.match(mobileTagPickerSource, /useState\(false\)/);
  assert.match(mobileTagPickerSource, /accessibilityState=\{\{ expanded: showSuggestions \}\}/);
  assert.match(mobileTagPickerSource, /if \(next\.draft\.trim\(\)\) closeSuggestions\(\)/);
  assert.match(mobileTagPickerSource, /showSuggestions && !disabled && !draft\.trim\(\) \? \(/);
  assert.match(mobileTagHelpersSource, /MAX_RENDERED_MOBILE_TAG_SUGGESTIONS = 24/);
  assert.match(mobileTagHelpersSource, /\.slice\(0, MAX_RENDERED_MOBILE_TAG_SUGGESTIONS\)/);
  for (const styleName of ['chip', 'removeButton', 'input', 'suggestionToggle', 'suggestion']) {
    assert.match(mobileTagPickerSource, new RegExp(styleName + ': \\{[^\\n]*minHeight: 44'));
  }
  assert.match(mobileTagPickerSource, /removeButton: \{[^\n]*minWidth: 44/);
  assert.match(mobileTagPickerSource, /disabled\?: boolean/);
  assert.match(mobileTagPickerSource, /editable=\{!disabled && !atLimit\}/);
  assert.match(mobileTagPickerSource, /accessibilityState=\{\{ disabled \}\}[\s\S]*?disabled=\{disabled\}[\s\S]*?onChange\(removeMobileKnowledgeTag/);
});

test('mobile create and update share the bounded Unicode tag parser', () => {
  assert.equal((mobileRouteSource.match(/parseMobileTags\(body\.tags\)/g) ?? []).length, 2);
  assert.match(
    mobileRouteSource,
    /function parseMobileTags\(value: unknown\)[\s\S]*?return parseStrictKnowledgeTags\(value\);/,
  );
});

test('a stale note edit reloads and installs the winning server editor version', () => {
  assert.match(
    mobileNotesSource,
    /const editorRequest = editorRequestGuard\.current\.capture\(\)[\s\S]*?reason instanceof MobileApiRequestError[\s\S]*?reason\.code === 'NOTE_STALE'[\s\S]*?reloadMyNoteAfterStale\([\s\S]*?staleEditingNote\.id,[\s\S]*?\(\) => load\(sourceView\),[\s\S]*?editorRequestGuard\.current\.isCurrent\(editorRequest\)[\s\S]*?if \(winner\) startEdit\(winner\);[\s\S]*?else preserveEditorAsNewNote\(\)/,
  );
  assert.match(
    mobileNotesSource,
    /function resetEditor\(\)[\s\S]*?editorRequestGuard\.current\.select\(null\)[\s\S]*?function startEdit\(note: PersonalNote\)[\s\S]*?editorRequestGuard\.current\.select\(note\.id\)[\s\S]*?setEditing\(note\)[\s\S]*?setTags\(note\.tags\)/,
  );
});

test('saving locks editor mutations while cancel and note switching keep their identity controls', () => {
  assert.ok((mobileNotesSource.match(/editable=\{!submitting\}/g) ?? []).length >= 5);
  assert.ok((mobileNotesSource.match(/disabled=\{submitting\}/g) ?? []).length >= 4);
  assert.match(mobileNotesSource, /<KnowledgeTagPicker[\s\S]*?disabled=\{submitting\}/);
  assert.match(
    mobileNotesSource,
    /editing \|\| copyDraftSourceId \? <Pressable accessibilityRole="button" onPress=\{resetEditor\}/,
  );
  assert.match(
    mobileNotesSource,
    /capabilities\.canEdit \? <Pressable accessibilityRole="button"[\s\S]*?onPress=\{\(\) => startEdit\(item\)\}/,
  );
});

test('a missing stale winner becomes an unsaved new note without clearing fields', () => {
  const preserveBlock = mobileNotesSource.match(
    /function preserveEditorAsNewNote\(\) \{([\s\S]*?)\n {2}\}/,
  )?.[1] ?? '';

  assert.match(preserveBlock, /editorRequestGuard\.current\.select\(null\)/);
  assert.match(preserveBlock, /setEditing\(null\)/);
  assert.doesNotMatch(
    preserveBlock,
    /setTitle|setTopic|setContent|setTags|setTagDraft|setSummary|setKnowledgeType|setCentralQuestion|setBundleFields/,
  );
  assert.match(
    mobileNotesSource,
    /reloadResult\.winner \? 'notes\.staleError' : 'notes\.staleMissingError'/,
  );
});
