import { recallScheduleLockKey } from '@/lib/recall-schedule-lock';

export type RecallLifecycleQuery = {
  text: string;
  params: unknown[];
};

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
    AND (
      s.recall_item_version IS DISTINCT FROM i.version
      OR i.archived_at IS NOT NULL
      OR i.deleted_at IS NOT NULL
      OR i.purge_at IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM knowledge_item_supersessions supersession
        WHERE supersession.user_id = i.user_id
          AND supersession.superseded_item_id = i.id
      )
    )
), invalidated_attempts AS (
  UPDATE recall_attempts a
  SET lifecycle_state = 'invalidated',
      invalidated_at = GREATEST(NOW(), a.started_at),
      invalidation_reason = 'stale_context',
      updated_at = GREATEST(NOW(), a.started_at)
  FROM stale_schedule stale
  WHERE a.user_id = stale.user_id
    AND a.knowledge_item_id = stale.knowledge_item_id
    AND a.lifecycle_state IN ('prepared', 'confidence_selected', 'revealed')
  RETURNING a.id
), deleted_unassessed_state AS (
  DELETE FROM user_private_card_states s
  USING stale_schedule stale
  WHERE s.user_id = stale.user_id
    AND s.knowledge_item_id = stale.knowledge_item_id
    AND s.recall_item_version = stale.recall_item_version
    AND s.recall_schedule_version = stale.recall_schedule_version
    AND s.recall_enrolled_at = stale.recall_enrolled_at
    AND stale.is_unassessed
    AND (SELECT COUNT(*) FROM invalidated_attempts) >= 0
  RETURNING s.knowledge_item_id
), cleared_assessed_state AS (
  UPDATE user_private_card_states s
  SET recall_enrolled_at = NULL,
      recall_item_version = NULL,
      recall_schedule_state = NULL,
      recall_d1_finalized_incomplete = NULL,
      recall_d7_outcome = NULL,
      recall_schedule_version = NULL
  FROM stale_schedule stale
  WHERE s.user_id = stale.user_id
    AND s.knowledge_item_id = stale.knowledge_item_id
    AND s.recall_item_version = stale.recall_item_version
    AND s.recall_schedule_version = stale.recall_schedule_version
    AND s.recall_enrolled_at = stale.recall_enrolled_at
    AND NOT stale.is_unassessed
    AND (SELECT COUNT(*) FROM invalidated_attempts) >= 0
  RETURNING s.knowledge_item_id
)
SELECT
  (SELECT COUNT(*)::integer FROM invalidated_attempts) AS invalidated_attempts,
  (SELECT COUNT(*)::integer FROM deleted_unassessed_state) AS deleted_states,
  (SELECT COUNT(*)::integer FROM cleared_assessed_state) AS cleared_states`;

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
