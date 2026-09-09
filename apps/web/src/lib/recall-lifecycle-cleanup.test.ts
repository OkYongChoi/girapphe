import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildRecallLifecycleLockQuery,
  buildStaleRecallEnrollmentCleanupQuery,
} from './recall-lifecycle-cleanup';

const USER_ID = 'owner-recall-lifecycle';
const ITEM_ID = 'private-knowledge-item';

function sourceSection(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.ok(startIndex >= 0 && endIndex > startIndex, `Missing source section: ${start}`);
  return source.slice(startIndex, endIndex);
}

test('stale Recall cleanup is owner-scoped, invalidates active attempts, and preserves assessed Practice', () => {
  const lock = buildRecallLifecycleLockQuery(USER_ID, ITEM_ID);
  const cleanup = buildStaleRecallEnrollmentCleanupQuery(USER_ID, ITEM_ID);

  assert.deepEqual(lock.params, [`recall-schedule:${USER_ID}:${ITEM_ID}`]);
  assert.deepEqual(cleanup.params, [USER_ID, ITEM_ID]);
  assert.match(cleanup.text, /s\.user_id = \$1/);
  assert.match(cleanup.text, /s\.knowledge_item_id = \$2/);
  assert.match(cleanup.text, /s\.recall_item_version IS DISTINCT FROM i\.version/);
  assert.match(cleanup.text, /i\.archived_at IS NOT NULL/);
  assert.match(cleanup.text, /i\.deleted_at IS NOT NULL/);
  assert.match(cleanup.text, /knowledge_item_supersessions/);
  assert.match(cleanup.text, /a\.lifecycle_state IN \('prepared', 'confidence_selected', 'revealed'\)/);
  assert.match(cleanup.text, /invalidation_reason = 'stale_context'/);
  assert.match(cleanup.text, /DELETE FROM user_private_card_states s/);
  assert.match(cleanup.text, /AND stale\.is_unassessed/);
  assert.match(cleanup.text, /UPDATE user_private_card_states s[\s\S]*AND NOT stale\.is_unassessed/);
  assert.match(cleanup.text, /SET recall_enrolled_at = NULL,[\s\S]*recall_schedule_version = NULL/);
  assert.doesNotMatch(cleanup.text, /title|summary|content|central_question|structured_content/);
});

test('every knowledge-item version mutation holds the Recall lock and cleans stale enrollment atomically', () => {
  const actionsSource = readFileSync(new URL('../actions/user-knowledge-actions.ts', import.meta.url), 'utf8');
  const ingestionSource = readFileSync(new URL('./knowledge-ingestion.ts', import.meta.url), 'utf8');
  const manualUpdate = sourceSection(actionsSource, 'export async function updateKnowledgeItem(', 'export async function updateKnowledgeItemFormAction(');
  const trashRestore = sourceSection(actionsSource, 'export async function restoreKnowledgeItem(', 'export async function getTopicKnowledgeHub(');
  const draftResolution = sourceSection(ingestionSource, 'export async function resolveKnowledgeDraftForUser(', 'export async function verifyKnowledgeItemForUser(');
  const verification = sourceSection(ingestionSource, 'export async function verifyKnowledgeItemForUser(', 'export type KnowledgeArchiveResult');
  const archiveRestore = sourceSection(ingestionSource, 'async function setKnowledgeArchivedStateForUser(', 'export async function archiveKnowledgeItemForUser(');
  const supersession = sourceSection(ingestionSource, 'export async function supersedeKnowledgeItemForUser(', 'export type KnowledgeReuseMetadata');

  assert.match(manualUpdate, /buildRecallLifecycleLockQuery\(user\.id, id\)[\s\S]*KNOWLEDGE_ITEM_UPDATE_QUERY[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(user\.id, id\)/);
  assert.match(trashRestore, /buildRecallLifecycleLockQuery\(user\.id, id\)[\s\S]*restoreQuery[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(user\.id, id\)/);
  assert.match(draftResolution, /input\.action !== 'create'[\s\S]*buildRecallLifecycleLockQuery\(userId, itemId\)[\s\S]*version = version \+ 1[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(userId, itemId\)/);
  assert.match(verification, /buildRecallLifecycleLockQuery\(userId, itemId\)[\s\S]*version = version \+ 1[\s\S]*tx\.query\(recallCleanup\.text/);
  assert.match(archiveRestore, /buildRecallLifecycleLockQuery\(userId, itemId\)[\s\S]*archive_guard[\s\S]*version = version \+ 1[\s\S]*tx\.query\(recallCleanup\.text/);
  assert.match(supersession, /buildRecallLifecycleLockQuery\(userId, supersededItemId\)[\s\S]*version_guard[\s\S]*version = version \+ 1[\s\S]*tx\.query\(recallCleanup\.text/);
});
