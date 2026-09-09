import 'server-only';

import { randomUUID } from 'node:crypto';
import db from '@/lib/db';
import { strictRecallEligibilityPredicate } from '@/lib/recall-eligibility-sql';
import {
  RECALL_SCHEDULE_LOCK_PREFIX,
  recallScheduleLockKey,
} from '@/lib/recall-schedule-lock';

export const RECALL_ATTEMPT_RETENTION_DAYS = 365;

export type RecallAttemptMilestone = 'd1' | 'd7';
export type RecallAttemptExerciseType = 'concept' | 'procedure' | 'comparison';
export type RecallAttemptConfidence = 'low' | 'medium' | 'high';
export type RecallAttemptLifecycleState = 'prepared' | 'confidence_selected' | 'revealed';

export type PersistedRecallAttempt = {
  id: string;
  knowledgeItemId: string;
  itemVersion: number;
  scheduleVersion: number;
  enrolledAt: string;
  milestone: RecallAttemptMilestone;
  exerciseType: RecallAttemptExerciseType;
  state: RecallAttemptLifecycleState;
  confidence: RecallAttemptConfidence | null;
  startedAt: string;
  confidenceSelectedAt: string | null;
  revealedAt: string | null;
};

export type RecallAttemptStartResult =
  | { kind: 'started' | 'resumed'; attempt: PersistedRecallAttempt }
  | { kind: 'not_available'; attempt: null };

export type RecallAttemptResumeResult =
  | { kind: 'resumed'; attempt: PersistedRecallAttempt }
  | { kind: 'invalidated' | 'not_available'; attempt: null };

export type RecallAttemptConfidenceResult =
  | { kind: 'selected' | 'unchanged'; attempt: PersistedRecallAttempt }
  | { kind: 'locked' | 'invalidated' | 'not_available'; attempt: null };

export type RecallAttemptRevealResult =
  | { kind: 'revealed' | 'unchanged'; attempt: PersistedRecallAttempt }
  | { kind: 'confidence_required' | 'invalidated' | 'not_available'; attempt: null };

export type RecallAttemptValidationResult =
  | { kind: 'current'; attempt: PersistedRecallAttempt }
  | { kind: 'invalidated' | 'not_available'; attempt: null };

type RecallAttemptRow = {
  id: string;
  knowledge_item_id: string;
  item_version: number | string;
  schedule_version: number | string;
  recall_enrolled_at: Date | string;
  milestone: string;
  exercise_type: string;
  lifecycle_state: string;
  confidence: string | null;
  started_at: Date | string;
  confidence_selected_at: Date | string | null;
  revealed_at: Date | string | null;
};

type RecallAttemptProbeRow = Partial<RecallAttemptRow> & {
  lifecycle_state: string;
};

const ACTIVE_ATTEMPT_STATES = `('prepared', 'confidence_selected', 'revealed')`;
const ATTEMPT_COLUMNS = `
  a.id,
  a.knowledge_item_id,
  a.item_version,
  a.schedule_version,
  a.recall_enrolled_at,
  a.milestone,
  a.exercise_type,
  a.lifecycle_state,
  a.confidence,
  a.started_at,
  a.confidence_selected_at,
  a.revealed_at
`;

function requireKnowledgeItemId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(normalized)) {
    throw new Error('Invalid knowledge item id.');
  }
  return normalized;
}

function requireAttemptId(value: string): string {
  const normalized = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error('Invalid Recall attempt id.');
  }
  return normalized;
}

function requireConfidence(value: RecallAttemptConfidence): RecallAttemptConfidence {
  if (!['low', 'medium', 'high'].includes(value)) {
    throw new Error('Invalid Recall confidence.');
  }
  return value;
}

function toPositiveInteger(value: number | string, field: string): number {
  const normalized = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isSafeInteger(normalized) || normalized < 1) {
    throw new Error(`Invalid ${field}.`);
  }
  return normalized;
}

function toInstant(value: Date | string, field: string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error(`Invalid ${field}.`);
  return instant.toISOString();
}

function optionalInstant(value: Date | string | null, field: string): string | null {
  return value === null ? null : toInstant(value, field);
}

function mapAttemptRow(row: RecallAttemptRow): PersistedRecallAttempt {
  if (!['d1', 'd7'].includes(row.milestone)) throw new Error('Invalid Recall milestone.');
  if (!['concept', 'procedure', 'comparison'].includes(row.exercise_type)) {
    throw new Error('Invalid Recall exercise type.');
  }
  if (!['prepared', 'confidence_selected', 'revealed'].includes(row.lifecycle_state)) {
    throw new Error('Invalid active Recall attempt state.');
  }
  if (row.confidence !== null && !['low', 'medium', 'high'].includes(row.confidence)) {
    throw new Error('Invalid persisted Recall confidence.');
  }
  return {
    id: requireAttemptId(row.id),
    knowledgeItemId: requireKnowledgeItemId(row.knowledge_item_id),
    itemVersion: toPositiveInteger(row.item_version, 'item version'),
    scheduleVersion: toPositiveInteger(row.schedule_version, 'schedule version'),
    enrolledAt: toInstant(row.recall_enrolled_at, 'enrollment instant'),
    milestone: row.milestone as RecallAttemptMilestone,
    exerciseType: row.exercise_type as RecallAttemptExerciseType,
    state: row.lifecycle_state as RecallAttemptLifecycleState,
    confidence: row.confidence as RecallAttemptConfidence | null,
    startedAt: toInstant(row.started_at, 'attempt start'),
    confidenceSelectedAt: optionalInstant(
      row.confidence_selected_at,
      'confidence selection',
    ),
    revealedAt: optionalInstant(row.revealed_at, 'reveal instant'),
  };
}

function currentAttemptContextPredicate(): string {
  return `
    s.user_id = a.user_id
    AND s.knowledge_item_id = a.knowledge_item_id
    AND s.recall_item_version = a.item_version
    AND s.recall_schedule_version = a.schedule_version
    AND s.recall_enrolled_at = a.recall_enrolled_at
    AND s.due_at IS NOT NULL
    AND s.due_at <= NOW()
    AND (
      (
        a.milestone = 'd1'
        AND s.recall_schedule_state IN ('d1_pending', 'd1_retry')
        AND NOW() < s.recall_enrolled_at + INTERVAL '168 hours'
      )
      OR (
        a.milestone = 'd7'
        AND s.recall_schedule_state = 'd7_pending'
        AND NOW() < s.recall_enrolled_at + INTERVAL '192 hours'
      )
    )
    AND i.id = s.knowledge_item_id
    AND i.user_id = s.user_id
    AND i.knowledge_type = a.exercise_type
    AND ${strictRecallEligibilityPredicate('a.item_version')}
  `;
}

function attemptItemLockQuery(userId: string, attemptId: string) {
  return {
    text: `SELECT pg_advisory_xact_lock(
      hashtext($3 || ':' || a.user_id || ':' || a.knowledge_item_id)
    )
    FROM recall_attempts a
    WHERE a.user_id = $1
      AND a.id = $2
    LIMIT 1`,
    params: [userId, attemptId, RECALL_SCHEDULE_LOCK_PREFIX],
  };
}

function invalidateStaleAttemptQuery(userId: string, attemptId: string) {
  return {
    text: `UPDATE recall_attempts a
    SET lifecycle_state = 'invalidated',
        invalidated_at = NOW(),
        invalidation_reason = 'stale_context',
        updated_at = NOW()
    WHERE a.user_id = $1
      AND a.id = $2
      AND a.lifecycle_state IN ${ACTIVE_ATTEMPT_STATES}
      AND NOT EXISTS (
        SELECT 1
        FROM user_private_card_states s
        JOIN user_knowledge_items i
          ON i.id = s.knowledge_item_id
         AND i.user_id = s.user_id
        WHERE ${currentAttemptContextPredicate()}
      )
    RETURNING a.id, a.lifecycle_state`,
    params: [userId, attemptId],
  };
}

function currentAttemptReadQuery(byItem: boolean): string {
  return `SELECT ${ATTEMPT_COLUMNS}
    FROM recall_attempts a
    JOIN user_private_card_states s
      ON s.user_id = a.user_id
     AND s.knowledge_item_id = a.knowledge_item_id
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    WHERE a.user_id = $1
      AND ${byItem ? 'a.knowledge_item_id = $2' : 'a.id = $2'}
      AND a.lifecycle_state IN ${ACTIVE_ATTEMPT_STATES}
      AND ${currentAttemptContextPredicate()}
    ORDER BY a.started_at DESC
    LIMIT 1`;
}

function attemptProbeQuery(userId: string, attemptId: string) {
  return {
    text: `SELECT ${ATTEMPT_COLUMNS}
      FROM recall_attempts a
      WHERE a.user_id = $1
        AND a.id = $2
      LIMIT 1`,
    params: [userId, attemptId],
  };
}

function unavailableKind(
  probe: RecallAttemptProbeRow | undefined,
): 'invalidated' | 'not_available' {
  return probe?.lifecycle_state === 'invalidated' ? 'invalidated' : 'not_available';
}

export async function startOrResumeRecallAttemptForUser(
  userId: string,
  knowledgeItemIdInput: string,
): Promise<RecallAttemptStartResult> {
  const knowledgeItemId = requireKnowledgeItemId(knowledgeItemIdInput);
  const attemptId = randomUUID();
  const [, , inserted, current] = await db.accountTransaction<RecallAttemptRow>(userId, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [recallScheduleLockKey(userId, knowledgeItemId)],
    },
    {
      text: `UPDATE recall_attempts a
      SET lifecycle_state = 'invalidated',
          invalidated_at = NOW(),
          invalidation_reason = 'stale_context',
          updated_at = NOW()
      WHERE a.user_id = $1
        AND a.knowledge_item_id = $2
        AND a.lifecycle_state IN ${ACTIVE_ATTEMPT_STATES}
        AND NOT EXISTS (
          SELECT 1
          FROM user_private_card_states s
          JOIN user_knowledge_items i
            ON i.id = s.knowledge_item_id
           AND i.user_id = s.user_id
          WHERE ${currentAttemptContextPredicate()}
        )
      RETURNING ${ATTEMPT_COLUMNS}`,
      params: [userId, knowledgeItemId],
    },
    {
      text: `INSERT INTO recall_attempts AS a (
        id,
        user_id,
        knowledge_item_id,
        item_version,
        schedule_version,
        recall_enrolled_at,
        milestone,
        exercise_type,
        lifecycle_state,
        started_at,
        retention_expires_at,
        updated_at
      )
      SELECT
        $3,
        s.user_id,
        s.knowledge_item_id,
        s.recall_item_version,
        s.recall_schedule_version,
        s.recall_enrolled_at,
        CASE
          WHEN s.recall_schedule_state IN ('d1_pending', 'd1_retry') THEN 'd1'
          ELSE 'd7'
        END,
        i.knowledge_type,
        'prepared',
        NOW(),
        NOW() + INTERVAL '${RECALL_ATTEMPT_RETENTION_DAYS} days',
        NOW()
      FROM user_private_card_states s
      JOIN user_knowledge_items i
        ON i.id = s.knowledge_item_id
       AND i.user_id = s.user_id
      WHERE s.user_id = $1
        AND s.knowledge_item_id = $2
        AND s.recall_enrolled_at IS NOT NULL
        AND s.recall_item_version IS NOT NULL
        AND s.recall_schedule_version IS NOT NULL
        AND s.recall_schedule_state IN ('d1_pending', 'd1_retry', 'd7_pending')
        AND s.due_at IS NOT NULL
        AND s.due_at <= NOW()
        AND (
          (
            s.recall_schedule_state IN ('d1_pending', 'd1_retry')
            AND NOW() < s.recall_enrolled_at + INTERVAL '168 hours'
          )
          OR (
            s.recall_schedule_state = 'd7_pending'
            AND NOW() < s.recall_enrolled_at + INTERVAL '192 hours'
          )
        )
        AND ${strictRecallEligibilityPredicate('s.recall_item_version')}
      ON CONFLICT (user_id, knowledge_item_id, item_version, milestone)
        WHERE lifecycle_state IN ('prepared', 'confidence_selected', 'revealed')
      DO NOTHING
      RETURNING ${ATTEMPT_COLUMNS}`,
      params: [userId, knowledgeItemId, attemptId],
    },
    {
      text: currentAttemptReadQuery(true),
      params: [userId, knowledgeItemId],
    },
  ]);

  if (inserted.rows[0]) return { kind: 'started', attempt: mapAttemptRow(inserted.rows[0]) };
  if (current.rows[0]) return { kind: 'resumed', attempt: mapAttemptRow(current.rows[0]) };
  return { kind: 'not_available', attempt: null };
}

export async function resumeRecallAttemptForUser(
  userId: string,
  attemptIdInput: string,
): Promise<RecallAttemptResumeResult> {
  const attemptId = requireAttemptId(attemptIdInput);
  const [, invalidated, current, probe] = await db.accountTransaction<RecallAttemptProbeRow>(
    userId,
    [
      attemptItemLockQuery(userId, attemptId),
      invalidateStaleAttemptQuery(userId, attemptId),
      {
        text: currentAttemptReadQuery(false),
        params: [userId, attemptId],
      },
      attemptProbeQuery(userId, attemptId),
    ],
  );

  if (invalidated.rows[0]) return { kind: 'invalidated', attempt: null };
  if (current.rows[0]) {
    return { kind: 'resumed', attempt: mapAttemptRow(current.rows[0] as RecallAttemptRow) };
  }
  return { kind: unavailableKind(probe.rows[0]), attempt: null };
}

export async function setRecallAttemptConfidenceForUser(
  userId: string,
  attemptIdInput: string,
  confidenceInput: RecallAttemptConfidence,
): Promise<RecallAttemptConfidenceResult> {
  const attemptId = requireAttemptId(attemptIdInput);
  const confidence = requireConfidence(confidenceInput);
  const [, invalidated, updated, current, probe] = await db.accountTransaction<RecallAttemptProbeRow>(
    userId,
    [
      attemptItemLockQuery(userId, attemptId),
      invalidateStaleAttemptQuery(userId, attemptId),
      {
        text: `UPDATE recall_attempts a
        SET lifecycle_state = 'confidence_selected',
            confidence = $3,
            confidence_selected_at = COALESCE(a.confidence_selected_at, NOW()),
            updated_at = NOW()
        WHERE a.user_id = $1
          AND a.id = $2
          AND a.lifecycle_state IN ('prepared', 'confidence_selected')
          AND (a.lifecycle_state = 'prepared' OR a.confidence IS DISTINCT FROM $3)
          AND EXISTS (
            SELECT 1
            FROM user_private_card_states s
            JOIN user_knowledge_items i
              ON i.id = s.knowledge_item_id
             AND i.user_id = s.user_id
            WHERE ${currentAttemptContextPredicate()}
          )
        RETURNING ${ATTEMPT_COLUMNS}`,
        params: [userId, attemptId, confidence],
      },
      {
        text: currentAttemptReadQuery(false),
        params: [userId, attemptId],
      },
      attemptProbeQuery(userId, attemptId),
    ],
  );

  if (invalidated.rows[0]) return { kind: 'invalidated', attempt: null };
  if (updated.rows[0]) {
    return { kind: 'selected', attempt: mapAttemptRow(updated.rows[0] as RecallAttemptRow) };
  }
  const active = current.rows[0] as RecallAttemptRow | undefined;
  if (active && active.confidence === confidence) {
    return { kind: 'unchanged', attempt: mapAttemptRow(active) };
  }
  if (active?.lifecycle_state === 'revealed') return { kind: 'locked', attempt: null };
  return { kind: unavailableKind(probe.rows[0]), attempt: null };
}

export async function revealRecallAttemptForUser(
  userId: string,
  attemptIdInput: string,
): Promise<RecallAttemptRevealResult> {
  const attemptId = requireAttemptId(attemptIdInput);
  const [, invalidated, updated, current, probe] = await db.accountTransaction<RecallAttemptProbeRow>(
    userId,
    [
      attemptItemLockQuery(userId, attemptId),
      invalidateStaleAttemptQuery(userId, attemptId),
      {
        text: `UPDATE recall_attempts a
        SET lifecycle_state = 'revealed',
            revealed_at = NOW(),
            updated_at = NOW()
        WHERE a.user_id = $1
          AND a.id = $2
          AND a.lifecycle_state = 'confidence_selected'
          AND a.confidence IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM user_private_card_states s
            JOIN user_knowledge_items i
              ON i.id = s.knowledge_item_id
             AND i.user_id = s.user_id
            WHERE ${currentAttemptContextPredicate()}
          )
        RETURNING ${ATTEMPT_COLUMNS}`,
        params: [userId, attemptId],
      },
      {
        text: currentAttemptReadQuery(false),
        params: [userId, attemptId],
      },
      attemptProbeQuery(userId, attemptId),
    ],
  );

  if (invalidated.rows[0]) return { kind: 'invalidated', attempt: null };
  if (updated.rows[0]) {
    return { kind: 'revealed', attempt: mapAttemptRow(updated.rows[0] as RecallAttemptRow) };
  }
  const active = current.rows[0] as RecallAttemptRow | undefined;
  if (active?.lifecycle_state === 'revealed') {
    return { kind: 'unchanged', attempt: mapAttemptRow(active) };
  }
  if (active?.lifecycle_state === 'prepared') {
    return { kind: 'confidence_required', attempt: null };
  }
  return { kind: unavailableKind(probe.rows[0]), attempt: null };
}

export async function invalidateStaleRecallAttemptForUser(
  userId: string,
  attemptIdInput: string,
): Promise<RecallAttemptValidationResult> {
  const attemptId = requireAttemptId(attemptIdInput);
  const [, invalidated, current, probe] = await db.accountTransaction<RecallAttemptProbeRow>(
    userId,
    [
      attemptItemLockQuery(userId, attemptId),
      invalidateStaleAttemptQuery(userId, attemptId),
      {
        text: currentAttemptReadQuery(false),
        params: [userId, attemptId],
      },
      attemptProbeQuery(userId, attemptId),
    ],
  );

  if (invalidated.rows[0]) return { kind: 'invalidated', attempt: null };
  if (current.rows[0]) {
    return { kind: 'current', attempt: mapAttemptRow(current.rows[0] as RecallAttemptRow) };
  }
  return { kind: unavailableKind(probe.rows[0]), attempt: null };
}

export async function purgeExpiredRecallAttempts(): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const result = await db.query<{ deleted_count: string | number }>(`
    WITH deleted_attempts AS (
      DELETE FROM recall_attempts
      WHERE retention_expires_at <= NOW()
      RETURNING id
    )
    SELECT COUNT(*) AS deleted_count FROM deleted_attempts
  `);
  return Number.parseInt(String(result.rows[0]?.deleted_count ?? '0'), 10);
}
