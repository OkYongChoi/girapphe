import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildRecallLifecycleLockQuery,
  buildRecallProvenanceBatchCleanupQuery,
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

test('stale Recall cleanup invalidates every owner-item attempt generation and preserves assessed Practice', () => {
  const lock = buildRecallLifecycleLockQuery(USER_ID, ITEM_ID);
  const cleanup = buildStaleRecallEnrollmentCleanupQuery(USER_ID, ITEM_ID);
  const attemptCleanup = cleanup.text.slice(
    cleanup.text.indexOf('invalidated_attempts AS ('),
    cleanup.text.indexOf('), deleted_unassessed_state AS ('),
  );

  assert.deepEqual(lock.params, [`recall-schedule:${USER_ID}:${ITEM_ID}`]);
  assert.deepEqual(cleanup.params, [USER_ID, ITEM_ID]);
  assert.match(cleanup.text, /s\.user_id = \$1/);
  assert.match(cleanup.text, /s\.knowledge_item_id = \$2/);
  assert.match(cleanup.text, /NOT \([\s\S]*i\.version = s\.recall_item_version/);
  assert.match(cleanup.text, /NOT \([\s\S]*i\.archived_at IS NULL/);
  assert.match(cleanup.text, /i\.deleted_at IS NULL/);
  assert.match(cleanup.text, /knowledge_item_supersessions/);
  assert.match(cleanup.text, /b\.scope = 'current_conversation'/);
  assert.match(cleanup.text, /b\.status IN \('partial', 'approved'\)/);
  assert.match(cleanup.text, /src\.supported_item_version = i\.version/);
  assert.match(attemptCleanup, /a\.user_id = stale\.user_id/);
  assert.match(attemptCleanup, /a\.knowledge_item_id = stale\.knowledge_item_id/);
  assert.match(attemptCleanup, /a\.lifecycle_state IN \('prepared', 'confidence_selected', 'revealed'\)/);
  assert.doesNotMatch(attemptCleanup, /a\.(?:item_version|schedule_version|recall_enrolled_at)/);
  assert.match(cleanup.text, /invalidation_reason = 'stale_context'/);
  assert.match(cleanup.text, /DELETE FROM user_private_card_states s/);
  assert.match(cleanup.text, /AND stale\.is_unassessed/);
  assert.match(cleanup.text, /UPDATE user_private_card_states s[\s\S]*AND NOT stale\.is_unassessed/);
  assert.match(cleanup.text, /SET recall_enrolled_at = NULL,[\s\S]*recall_schedule_version = NULL/);
  assert.doesNotMatch(cleanup.text, /i\.(?:title|summary|content)|source_url|source_locator/);
});

test('batch provenance cleanup locks affected items in order and preserves alternate eligible provenance', () => {
  const batchId = 'conversation-batch';
  const discard = buildRecallProvenanceBatchCleanupQuery(USER_ID, batchId, 'discard');
  const deletion = buildRecallProvenanceBatchCleanupQuery(USER_ID, batchId, 'delete');
  const sql = discard.text;
  const targetBatch = sql.indexOf('target_batch AS MATERIALIZED');
  const staleSchedules = sql.indexOf('stale_schedule AS MATERIALIZED');
  const orderedLocks = sql.indexOf('locked_stale_schedules AS MATERIALIZED');
  const lockBarrier = sql.indexOf('locked_stale_schedule_batch AS MATERIALIZED');
  const attemptCleanup = sql.indexOf('invalidated_attempts AS (');

  assert.deepEqual(discard.params, [USER_ID, batchId, true, 'recall-schedule']);
  assert.deepEqual(deletion.params, [USER_ID, batchId, false, 'recall-schedule']);
  assert.equal(deletion.text, discard.text);
  assert.ok(targetBatch >= 0 && staleSchedules > targetBatch);
  assert.ok(orderedLocks > staleSchedules && lockBarrier > orderedLocks && attemptCleanup > lockBarrier);
  assert.match(sql, /b\.id = \$2[\s\S]*b\.user_id = \$1/);
  assert.match(sql, /NOT \$3::boolean OR b\.status IN \('pending', 'partial'\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /SELECT DISTINCT d\.knowledge_item_id/);
  assert.match(sql, /d\.status = 'approved'/);
  assert.match(sql, /JOIN target_batch target ON target\.id = d\.batch_id/);
  assert.match(sql, /b\.id <> \$2::text/);
  assert.match(sql, /b\.scope = 'current_conversation'/);
  assert.match(sql, /src\.supported_item_version = i\.version/);
  assert.match(sql, /FROM stale_schedule stale\s+ORDER BY stale\.knowledge_item_id/);
  assert.match(sql, /ARRAY_AGG\(locked\.knowledge_item_id ORDER BY locked\.knowledge_item_id\)/);
  assert.match(sql, /BOOL_AND\(locked\.item_lock IS NOT NULL\)/);
  assert.match(sql, /locked_batch\.all_item_locks_acquired/);
  assert.match(sql, /stale\.knowledge_item_id = ANY\(locked_batch\.knowledge_item_ids\)/);
  assert.equal(
    sql.match(/CROSS JOIN locked_stale_schedule_batch locked_batch/g)?.length,
    3,
  );
  assert.equal(
    sql.match(/locked_batch\.all_item_locks_acquired/g)?.length,
    3,
  );
  assert.doesNotMatch(sql, /i\.(?:title|summary|content)|source_url|source_locator/);
});

test('every knowledge-item lifecycle or version mutation holds the Recall lock and cleans stale enrollment atomically', () => {
  const actionsSource = readFileSync(new URL('../actions/user-knowledge-actions.ts', import.meta.url), 'utf8');
  const ingestionSource = readFileSync(new URL('./knowledge-ingestion.ts', import.meta.url), 'utf8');
  const manualUpdate = sourceSection(actionsSource, 'export async function updateKnowledgeItem(', 'export async function updateKnowledgeItemFormAction(');
  const trashDelete = sourceSection(actionsSource, 'export async function deleteKnowledgeItem(', 'export async function getDeletedKnowledgeItems(');
  const trashRestore = sourceSection(actionsSource, 'export async function restoreKnowledgeItem(', 'export async function getTopicKnowledgeHub(');
  const draftResolution = sourceSection(ingestionSource, 'export async function resolveKnowledgeDraftForUser(', 'export async function verifyKnowledgeItemForUser(');
  const verification = sourceSection(ingestionSource, 'export async function verifyKnowledgeItemForUser(', 'export type KnowledgeArchiveResult');
  const archiveRestore = sourceSection(ingestionSource, 'async function setKnowledgeArchivedStateForUser(', 'export async function archiveKnowledgeItemForUser(');
  const supersession = sourceSection(ingestionSource, 'export async function supersedeKnowledgeItemForUser(', 'export type KnowledgeReuseMetadata');
  const discard = sourceSection(ingestionSource, 'export async function discardKnowledgeDraftBatchForUser(', 'export async function deleteKnowledgeImportBatchForUser(');
  const importDeletion = sourceSection(ingestionSource, 'export async function deleteKnowledgeImportBatchForUser(', 'type SanitizedReviewedKnowledgePayload = {');

  assert.match(manualUpdate, /buildRecallLifecycleLockQuery\(user\.id, id\)[\s\S]*KNOWLEDGE_ITEM_UPDATE_QUERY[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(user\.id, id\)/);
  assert.match(trashDelete, /accountTransaction\(user\.id, \[[\s\S]*buildRecallLifecycleLockQuery\(user\.id, id\)[\s\S]*knowledge-item:\$\{user\.id\}:\$\{id\}[\s\S]*text: deleteQuery[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(user\.id, id\)/);
  assert.match(trashRestore, /buildRecallLifecycleLockQuery\(user\.id, id\)[\s\S]*restoreQuery[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(user\.id, id\)/);
  assert.match(draftResolution, /input\.action !== 'create'[\s\S]*buildRecallLifecycleLockQuery\(userId, itemId\)[\s\S]*version = version \+ 1[\s\S]*buildStaleRecallEnrollmentCleanupQuery\(userId, itemId\)/);
  assert.match(verification, /buildRecallLifecycleLockQuery\(userId, itemId\)[\s\S]*version = version \+ 1[\s\S]*tx\.query\(recallCleanup\.text/);
  assert.match(archiveRestore, /buildRecallLifecycleLockQuery\(userId, itemId\)[\s\S]*archive_guard[\s\S]*version = version \+ 1[\s\S]*tx\.query\(recallCleanup\.text/);
  assert.match(supersession, /buildRecallLifecycleLockQuery\(userId, supersededItemId\)[\s\S]*version_guard[\s\S]*version = version \+ 1[\s\S]*tx\.query\(recallCleanup\.text/);
  assert.match(discard, /buildRecallProvenanceBatchCleanupQuery\(userId, batchId, 'discard'\)/);
  assert.ok(discard.indexOf('`knowledge-ingestion:${userId}`') < discard.indexOf('tx.query(recallCleanup.text'));
  assert.ok(discard.indexOf('tx.query(recallCleanup.text') < discard.indexOf('WITH discarded AS'));
  assert.match(discard, /\], \{ isolationLevel: 'ReadCommitted' \}\);/);
  assert.doesNotMatch(discard, /isolationLevel: 'Serializable'/);
  assert.match(importDeletion, /buildRecallProvenanceBatchCleanupQuery\(userId, batchId, 'delete'\)/);
  assert.ok(importDeletion.indexOf('`knowledge-ingestion:${userId}`') < importDeletion.indexOf('`knowledge-import:${userId}:${batchId}`'));
  assert.ok(importDeletion.indexOf('`knowledge-import:${userId}:${batchId}`') < importDeletion.indexOf('tx.query(recallCleanup.text'));
  assert.ok(importDeletion.indexOf('tx.query(recallCleanup.text') < importDeletion.indexOf('WITH owned_batch AS MATERIALIZED'));
});
