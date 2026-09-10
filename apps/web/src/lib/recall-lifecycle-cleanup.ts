import {
  strictRecallEligibilityExcludingBatchPredicate,
  strictRecallEligibilityPredicate,
} from '@/lib/recall-eligibility-sql';
import {
  RECALL_SCHEDULE_LOCK_PREFIX,
  recallScheduleLockKey,
} from '@/lib/recall-schedule-lock';

export type RecallLifecycleQuery = {
  text: string;
  params: unknown[];
};

function recallEnrollmentCleanupMutations(lockBatchName?: string): string {
  const lockJoin = lockBatchName ? `\n  CROSS JOIN ${lockBatchName} locked_batch` : '';
  const lockPredicates = lockBatchName
    ? `\n    AND locked_batch.all_item_locks_acquired\n    AND stale.knowledge_item_id = ANY(locked_batch.knowledge_item_ids)`
    : '';
  return `invalidated_attempts AS (
  UPDATE recall_attempts a
  SET lifecycle_state = 'invalidated',
      invalidated_at = GREATEST(NOW(), a.started_at),
      invalidation_reason = 'stale_context',
      updated_at = GREATEST(NOW(), a.started_at)
  FROM stale_schedule stale${lockJoin}
  WHERE a.user_id = stale.user_id
    AND a.knowledge_item_id = stale.knowledge_item_id
    AND a.lifecycle_state IN ('prepared', 'confidence_selected', 'revealed')${lockPredicates}
  RETURNING a.id
), deleted_unassessed_state AS (
  DELETE FROM user_private_card_states s
  USING stale_schedule stale${lockJoin}
  WHERE s.user_id = stale.user_id
    AND s.knowledge_item_id = stale.knowledge_item_id
    AND s.recall_item_version = stale.recall_item_version
    AND s.recall_schedule_version = stale.recall_schedule_version
    AND s.recall_enrolled_at = stale.recall_enrolled_at
    AND stale.is_unassessed
    AND (SELECT COUNT(*) FROM invalidated_attempts) >= 0${lockPredicates}
  RETURNING s.knowledge_item_id
), cleared_assessed_state AS (
  UPDATE user_private_card_states s
  SET recall_enrolled_at = NULL,
      recall_item_version = NULL,
      recall_schedule_state = NULL,
      recall_d1_finalized_incomplete = NULL,
      recall_d7_outcome = NULL,
      recall_schedule_version = NULL
  FROM stale_schedule stale${lockJoin}
  WHERE s.user_id = stale.user_id
    AND s.knowledge_item_id = stale.knowledge_item_id
    AND s.recall_item_version = stale.recall_item_version
    AND s.recall_schedule_version = stale.recall_schedule_version
    AND s.recall_enrolled_at = stale.recall_enrolled_at
    AND NOT stale.is_unassessed
    AND (SELECT COUNT(*) FROM invalidated_attempts) >= 0${lockPredicates}
  RETURNING s.knowledge_item_id
)
SELECT
  (SELECT COUNT(*)::integer FROM invalidated_attempts) AS invalidated_attempts,
  (SELECT COUNT(*)::integer FROM deleted_unassessed_state) AS deleted_states,
  (SELECT COUNT(*)::integer FROM cleared_assessed_state) AS cleared_states`;
}

export const STALE_RECALL_ENROLLMENT_CLEANUP_QUERY = `WITH stale_schedule AS MATERIALIZED (
  SELECT
    s.user_id,
    s.knowledge_item_id,
    s.recall_item_version,
    s.recall_schedule_version,
    s.recall_enrolled_at,
    (
      s.status IS NULL
      AND s.knowledge_state IS NULL
      AND s.progress_state IS NULL
      AND s.last_seen IS NULL
    ) AS is_unassessed
  FROM user_private_card_states s
  JOIN user_knowledge_items i
    ON i.id = s.knowledge_item_id
   AND i.user_id = s.user_id
  WHERE s.user_id = $1
    AND s.knowledge_item_id = $2
    AND s.recall_enrolled_at IS NOT NULL
    AND s.recall_item_version IS NOT NULL
    AND s.recall_schedule_version IS NOT NULL
    AND NOT (${strictRecallEligibilityPredicate('s.recall_item_version')})
), ${recallEnrollmentCleanupMutations()}`;

const BATCH_PROVENANCE_RECALL_ENROLLMENT_CLEANUP_QUERY = `WITH target_batch AS MATERIALIZED (
  SELECT b.id
  FROM knowledge_ingestion_batches b
  WHERE b.id = $2
    AND b.user_id = $1
    AND (NOT $3::boolean OR b.status IN ('pending', 'partial'))
  FOR UPDATE
), affected_items AS MATERIALIZED (
  SELECT DISTINCT d.knowledge_item_id
  FROM knowledge_card_drafts d
  JOIN target_batch target ON target.id = d.batch_id
  WHERE d.user_id = $1
    AND d.status = 'approved'
    AND d.knowledge_item_id IS NOT NULL
), stale_schedule AS MATERIALIZED (
  SELECT
    s.user_id,
    s.knowledge_item_id,
    s.recall_item_version,
    s.recall_schedule_version,
    s.recall_enrolled_at,
    (
      s.status IS NULL
      AND s.knowledge_state IS NULL
      AND s.progress_state IS NULL
      AND s.last_seen IS NULL
    ) AS is_unassessed
  FROM user_private_card_states s
  JOIN user_knowledge_items i
    ON i.id = s.knowledge_item_id
   AND i.user_id = s.user_id
  JOIN affected_items affected
    ON affected.knowledge_item_id = s.knowledge_item_id
  WHERE s.user_id = $1
    AND s.recall_enrolled_at IS NOT NULL
    AND s.recall_item_version IS NOT NULL
    AND s.recall_schedule_version IS NOT NULL
    AND NOT (${strictRecallEligibilityExcludingBatchPredicate('s.recall_item_version', '$2::text')})
), locked_stale_schedules AS MATERIALIZED (
  SELECT
    stale.knowledge_item_id,
    pg_advisory_xact_lock(
      hashtext($4 || ':' || stale.user_id || ':' || stale.knowledge_item_id)
    ) AS item_lock
  FROM stale_schedule stale
  ORDER BY stale.knowledge_item_id
), locked_stale_schedule_batch AS MATERIALIZED (
  SELECT
    COALESCE(
      ARRAY_AGG(locked.knowledge_item_id ORDER BY locked.knowledge_item_id),
      ARRAY[]::text[]
    ) AS knowledge_item_ids,
    COALESCE(BOOL_AND(locked.item_lock IS NOT NULL), TRUE) AS all_item_locks_acquired
  FROM locked_stale_schedules locked
), ${recallEnrollmentCleanupMutations('locked_stale_schedule_batch')}`;

export function buildRecallLifecycleLockQuery(
  userId: string,
  knowledgeItemId: string,
): RecallLifecycleQuery {
  return {
    text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
    params: [recallScheduleLockKey(userId, knowledgeItemId)],
  };
}

export function buildStaleRecallEnrollmentCleanupQuery(
  userId: string,
  knowledgeItemId: string,
): RecallLifecycleQuery {
  return {
    text: STALE_RECALL_ENROLLMENT_CLEANUP_QUERY,
    params: [userId, knowledgeItemId],
  };
}

export function buildRecallProvenanceBatchCleanupQuery(
  userId: string,
  batchId: string,
  mode: 'discard' | 'delete',
): RecallLifecycleQuery {
  return {
    text: BATCH_PROVENANCE_RECALL_ENROLLMENT_CLEANUP_QUERY,
    params: [userId, batchId, mode === 'discard', RECALL_SCHEDULE_LOCK_PREFIX],
  };
}
