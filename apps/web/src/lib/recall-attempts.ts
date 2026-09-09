import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  assessRecallSchedule,
  type RecallAssessmentOutcome,
  type RecallInstant,
  type RecallScheduleDecision,
  type RecallScheduleSnapshot,
} from '@stem-brain/shared';
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
export type RecallAttemptResponseDurationBucket =
  | 'under_30s'
  | '30_to_89s'
  | '90_to_179s'
  | '3_to_5m'
  | 'over_5m';

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

export type RecallAttemptCompletionInput = {
  outcome: RecallAssessmentOutcome;
  hintUsed: boolean;
};

export type RecallAttemptNextDeliveryContext = {
  userId: string;
  knowledgeItemId: string;
  itemVersion: number;
  scheduleVersion: number;
  enrolledAt: string;
  milestone: 'd1';
  completedAt: string;
  outcome: RecallAssessmentOutcome;
};

export type ResolveRecallNextDeliveryAt = (
  context: RecallAttemptNextDeliveryContext,
) => Promise<RecallInstant>;

export type PersistedCompletedRecallAttempt = Omit<
  PersistedRecallAttempt,
  'state' | 'confidence' | 'confidenceSelectedAt' | 'revealedAt'
> & {
  state: 'completed';
  confidence: RecallAttemptConfidence;
  confidenceSelectedAt: string;
  revealedAt: string;
  selfAssessedOutcome: RecallAssessmentOutcome;
  hintUsed: boolean;
  responseDurationBucket: RecallAttemptResponseDurationBucket;
  completedAt: string;
  resultingDueAt: string;
};

export type RecallAttemptCompletionResult =
  | { kind: 'completed' | 'unchanged'; attempt: PersistedCompletedRecallAttempt }
  | {
      kind:
        | 'confidence_required'
        | 'reveal_required'
        | 'invalidated'
        | 'conflict'
        | 'not_available';
      attempt: null;
    };

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

type RecallAttemptCompletionRow = RecallAttemptRow & {
  self_assessed_outcome: string | null;
  hint_used: boolean | null;
  response_duration_bucket: string | null;
  completed_at: Date | string | null;
  resulting_due_at: Date | string | null;
};

type RecallAttemptProbeRow = Partial<RecallAttemptCompletionRow> & {
  lifecycle_state: string;
};

type RecallCompletionContextRow = RecallAttemptRow & {
  transition_at: Date | string;
  schedule_state: string;
  schedule_due_at: Date | string;
  schedule_d1_finalized_incomplete: boolean;
  schedule_d7_outcome: string | null;
  practice_status: string | null;
  practice_knowledge_state: string | null;
  practice_progress_state: string | null;
  practice_last_seen: Date | string | null;
};

type RecallCompletionContext = {
  attempt: PersistedRecallAttempt;
  completedAt: string;
  schedule: {
    snapshot: RecallScheduleSnapshot;
    practice: {
      status: 'known' | 'saved' | null;
      knowledgeState: 'unknown' | 'known' | null;
      progressState: 'learning' | 'review' | null;
      lastSeen: string | null;
    };
  };
};

const ACTIVE_ATTEMPT_STATES = `('prepared', 'confidence_selected', 'revealed')`;
const COMPLETION_CLOCK_BASE_SQL = 'GREATEST('
  + 'CURRENT_TIMESTAMP, COALESCE(a.revealed_at, CURRENT_TIMESTAMP)'
  + ')';
const COMPLETION_TIMESTAMP_SQL = `(
  date_trunc('milliseconds', ${COMPLETION_CLOCK_BASE_SQL})
  + CASE
      WHEN ${COMPLETION_CLOCK_BASE_SQL}
        > date_trunc('milliseconds', ${COMPLETION_CLOCK_BASE_SQL})
        THEN INTERVAL '1 millisecond'
      ELSE INTERVAL '0 milliseconds'
    END
)`;
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
const ATTEMPT_COMPLETION_COLUMNS = `${ATTEMPT_COLUMNS},
  a.self_assessed_outcome,
  a.hint_used,
  a.response_duration_bucket,
  a.completed_at,
  a.resulting_due_at
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

function requireCompletionInput(
  input: RecallAttemptCompletionInput,
): RecallAttemptCompletionInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Invalid Recall completion input.');
  }
  const keys = Object.keys(input);
  if (keys.length !== 2 || !keys.includes('outcome') || !keys.includes('hintUsed')) {
    throw new Error('Invalid Recall completion input.');
  }
  if (!['remembered', 'partial', 'missed'].includes(input.outcome)) {
    throw new Error('Invalid Recall outcome.');
  }
  if (typeof input.hintUsed !== 'boolean') {
    throw new Error('Invalid Recall hint use.');
  }
  return { outcome: input.outcome, hintUsed: input.hintUsed };
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

function mapCompletedAttemptRow(
  row: RecallAttemptCompletionRow,
): PersistedCompletedRecallAttempt {
  if (row.lifecycle_state !== 'completed') {
    throw new Error('Invalid completed Recall attempt state.');
  }
  if (!['d1', 'd7'].includes(row.milestone)) throw new Error('Invalid Recall milestone.');
  if (!['concept', 'procedure', 'comparison'].includes(row.exercise_type)) {
    throw new Error('Invalid Recall exercise type.');
  }
  if (!['low', 'medium', 'high'].includes(row.confidence ?? '')) {
    throw new Error('Invalid persisted Recall confidence.');
  }
  if (!['remembered', 'partial', 'missed'].includes(row.self_assessed_outcome ?? '')) {
    throw new Error('Invalid persisted Recall outcome.');
  }
  if (typeof row.hint_used !== 'boolean') {
    throw new Error('Invalid persisted Recall hint use.');
  }
  if (![
    'under_30s',
    '30_to_89s',
    '90_to_179s',
    '3_to_5m',
    'over_5m',
  ].includes(row.response_duration_bucket ?? '')) {
    throw new Error('Invalid persisted Recall duration bucket.');
  }
  if (
    row.confidence_selected_at === null
    || row.revealed_at === null
    || row.completed_at === null
    || row.resulting_due_at === null
  ) {
    throw new Error('Invalid completed Recall attempt timestamps.');
  }
  return {
    id: requireAttemptId(row.id),
    knowledgeItemId: requireKnowledgeItemId(row.knowledge_item_id),
    itemVersion: toPositiveInteger(row.item_version, 'item version'),
    scheduleVersion: toPositiveInteger(row.schedule_version, 'schedule version'),
    enrolledAt: toInstant(row.recall_enrolled_at, 'enrollment instant'),
    milestone: row.milestone as RecallAttemptMilestone,
    exerciseType: row.exercise_type as RecallAttemptExerciseType,
    state: 'completed',
    confidence: row.confidence as RecallAttemptConfidence,
    startedAt: toInstant(row.started_at, 'attempt start'),
    confidenceSelectedAt: toInstant(row.confidence_selected_at, 'confidence selection'),
    revealedAt: toInstant(row.revealed_at, 'reveal instant'),
    selfAssessedOutcome: row.self_assessed_outcome as RecallAssessmentOutcome,
    hintUsed: row.hint_used,
    responseDurationBucket: row.response_duration_bucket as RecallAttemptResponseDurationBucket,
    completedAt: toInstant(row.completed_at, 'completion instant'),
    resultingDueAt: toInstant(row.resulting_due_at, 'resulting due instant'),
  };
}

function mapCompletionContext(row: RecallCompletionContextRow): RecallCompletionContext {
  if (!['d1_pending', 'd1_retry', 'd7_pending'].includes(row.schedule_state)) {
    throw new Error('Invalid active Recall schedule state.');
  }
  if (
    row.schedule_d7_outcome !== null
    && !['remembered', 'partial', 'missed', 'unassessed'].includes(row.schedule_d7_outcome)
  ) {
    throw new Error('Invalid persisted Recall D+7 outcome.');
  }
  const practiceValues = [
    row.practice_status,
    row.practice_knowledge_state,
    row.practice_progress_state,
    row.practice_last_seen,
  ];
  const emptyPractice = practiceValues.every((value) => value === null);
  const knownPractice = row.practice_status === 'known'
    && row.practice_knowledge_state === 'known'
    && row.practice_progress_state === 'review'
    && row.practice_last_seen !== null;
  const savedPractice = row.practice_status === 'saved'
    && row.practice_knowledge_state === 'unknown'
    && row.practice_progress_state === 'learning'
    && row.practice_last_seen !== null;
  if (!emptyPractice && !knownPractice && !savedPractice) {
    throw new Error('Invalid persisted Recall Practice projection.');
  }
  return {
    attempt: mapAttemptRow(row),
    completedAt: toInstant(row.transition_at, 'completion instant'),
    schedule: {
      snapshot: {
        enrolledAt: toInstant(row.recall_enrolled_at, 'enrollment instant'),
        state: row.schedule_state as RecallScheduleSnapshot['state'],
        dueAt: toInstant(row.schedule_due_at, 'schedule due instant'),
        d1FinalizedIncomplete: row.schedule_d1_finalized_incomplete,
        d7Outcome: row.schedule_d7_outcome as RecallScheduleSnapshot['d7Outcome'],
      },
      practice: {
        status: row.practice_status as RecallCompletionContext['schedule']['practice']['status'],
        knowledgeState: row.practice_knowledge_state as RecallCompletionContext['schedule']['practice']['knowledgeState'],
        progressState: row.practice_progress_state as RecallCompletionContext['schedule']['practice']['progressState'],
        lastSeen: row.practice_last_seen === null
          ? null
          : toInstant(row.practice_last_seen, 'Practice last seen'),
      },
    },
  };
}

function completedAttemptReplayResult(
  row: RecallAttemptCompletionRow,
  input: RecallAttemptCompletionInput,
): RecallAttemptCompletionResult {
  const attempt = mapCompletedAttemptRow(row);
  if (
    attempt.selfAssessedOutcome === input.outcome
    && attempt.hintUsed === input.hintUsed
  ) {
    return { kind: 'unchanged', attempt };
  }
  return { kind: 'conflict', attempt: null };
}

function currentAttemptContextPredicate(atExpression = 'NOW()'): string {
  return `
    s.user_id = a.user_id
    AND s.knowledge_item_id = a.knowledge_item_id
    AND s.recall_item_version = a.item_version
    AND s.recall_schedule_version = a.schedule_version
    AND s.recall_enrolled_at = a.recall_enrolled_at
    AND s.due_at IS NOT NULL
    AND s.due_at <= ${atExpression}
    AND (
      (
        a.milestone = 'd1'
        AND s.recall_schedule_state IN ('d1_pending', 'd1_retry')
        AND ${atExpression} < s.recall_enrolled_at + INTERVAL '168 hours'
      )
      OR (
        a.milestone = 'd7'
        AND s.recall_schedule_state = 'd7_pending'
        AND ${atExpression} < s.recall_enrolled_at + INTERVAL '192 hours'
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

function invalidateStaleAttemptQuery(
  userId: string,
  attemptId: string,
  evaluation?: { expression: string; instant?: string },
) {
  const atExpression = evaluation?.expression ?? 'NOW()';
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
        WHERE ${currentAttemptContextPredicate(atExpression)}
      )
    RETURNING a.id, a.lifecycle_state`,
    params: evaluation?.instant === undefined
      ? [userId, attemptId]
      : [userId, attemptId, evaluation.instant],
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

function completionContextReadQuery(): string {
  return `SELECT ${ATTEMPT_COLUMNS},
      ${COMPLETION_TIMESTAMP_SQL} AS transition_at,
      s.recall_schedule_state AS schedule_state,
      s.due_at AS schedule_due_at,
      s.recall_d1_finalized_incomplete AS schedule_d1_finalized_incomplete,
      s.recall_d7_outcome AS schedule_d7_outcome,
      s.status AS practice_status,
      s.knowledge_state AS practice_knowledge_state,
      s.progress_state AS practice_progress_state,
      s.last_seen AS practice_last_seen
    FROM recall_attempts a
    JOIN user_private_card_states s
      ON s.user_id = a.user_id
     AND s.knowledge_item_id = a.knowledge_item_id
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    WHERE a.user_id = $1
      AND a.id = $2
      AND a.lifecycle_state IN ${ACTIVE_ATTEMPT_STATES}
      AND ${currentAttemptContextPredicate(COMPLETION_TIMESTAMP_SQL)}
    LIMIT 1`;
}

function attemptProbeQuery(userId: string, attemptId: string) {
  return {
    text: `SELECT ${ATTEMPT_COMPLETION_COLUMNS}
      FROM recall_attempts a
      WHERE a.user_id = $1
        AND a.id = $2
      LIMIT 1`,
    params: [userId, attemptId],
  };
}

function completionMutationQuery(
  userId: string,
  attemptId: string,
  context: RecallCompletionContext,
  decision: RecallScheduleDecision,
  input: RecallAttemptCompletionInput,
) {
  if (decision.practiceProjection.action !== 'set') {
    throw new Error('A completed Recall assessment must update Practice.');
  }
  const expected = context.schedule;
  const next = decision.snapshot;
  const projection = decision.practiceProjection;
  return {
    text: `WITH updated_schedule AS (
      UPDATE user_private_card_states s
      SET due_at = $14::timestamptz,
          recall_schedule_state = $15,
          recall_d1_finalized_incomplete = $16,
          recall_d7_outcome = $17,
          recall_schedule_version = s.recall_schedule_version + 1,
          status = $18,
          knowledge_state = $19,
          progress_state = $20,
          last_seen = $21::timestamptz
      FROM user_knowledge_items i, recall_attempts a
      WHERE a.user_id = $1
        AND a.id = $2
        AND a.lifecycle_state = 'revealed'
        AND a.confidence IS NOT NULL
        AND a.confidence_selected_at IS NOT NULL
        AND a.revealed_at IS NOT NULL
        AND s.user_id = a.user_id
        AND s.knowledge_item_id = a.knowledge_item_id
        AND s.recall_item_version = a.item_version
        AND s.recall_schedule_version = a.schedule_version
        AND s.recall_enrolled_at = a.recall_enrolled_at
        AND s.recall_item_version = $3
        AND s.recall_schedule_version = $4
        AND s.recall_enrolled_at = $5::timestamptz
        AND s.recall_schedule_state = $6
        AND s.due_at = $7::timestamptz
        AND s.recall_d1_finalized_incomplete = $8
        AND s.recall_d7_outcome IS NOT DISTINCT FROM $9::text
        AND s.status IS NOT DISTINCT FROM $10::text
        AND s.knowledge_state IS NOT DISTINCT FROM $11::text
        AND s.progress_state IS NOT DISTINCT FROM $12::text
        AND date_trunc('milliseconds', s.last_seen)
          IS NOT DISTINCT FROM $13::timestamptz
        AND ${currentAttemptContextPredicate('$21::timestamptz')}
      RETURNING s.knowledge_item_id, s.due_at AS resulting_due_at
    ), completed_attempt AS (
      UPDATE recall_attempts a
      SET lifecycle_state = 'completed',
          self_assessed_outcome = $22,
          hint_used = $23,
          response_duration_bucket = CASE
            WHEN a.confidence_selected_at - a.started_at < INTERVAL '30 seconds'
              THEN 'under_30s'
            WHEN a.confidence_selected_at - a.started_at < INTERVAL '90 seconds'
              THEN '30_to_89s'
            WHEN a.confidence_selected_at - a.started_at < INTERVAL '180 seconds'
              THEN '90_to_179s'
            WHEN a.confidence_selected_at - a.started_at < INTERVAL '360 seconds'
              THEN '3_to_5m'
            ELSE 'over_5m'
          END,
          completed_at = $21::timestamptz,
          resulting_due_at = updated_schedule.resulting_due_at,
          updated_at = $21::timestamptz
      FROM updated_schedule
      WHERE a.user_id = $1
        AND a.id = $2
        AND a.knowledge_item_id = updated_schedule.knowledge_item_id
        AND a.lifecycle_state = 'revealed'
      RETURNING ${ATTEMPT_COMPLETION_COLUMNS}
    )
    SELECT * FROM completed_attempt`,
    params: [
      userId,
      attemptId,
      context.attempt.itemVersion,
      context.attempt.scheduleVersion,
      context.attempt.enrolledAt,
      expected.snapshot.state,
      expected.snapshot.dueAt,
      expected.snapshot.d1FinalizedIncomplete,
      expected.snapshot.d7Outcome,
      expected.practice.status,
      expected.practice.knowledgeState,
      expected.practice.progressState,
      expected.practice.lastSeen,
      next.dueAt,
      next.state,
      next.d1FinalizedIncomplete,
      next.d7Outcome,
      projection.status,
      projection.knowledgeState,
      projection.progressState,
      context.completedAt,
      input.outcome,
      input.hintUsed,
    ],
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

export async function completeRecallAttemptForUser(
  userId: string,
  attemptIdInput: string,
  inputValue: RecallAttemptCompletionInput,
  resolveNextDeliveryAt: ResolveRecallNextDeliveryAt,
): Promise<RecallAttemptCompletionResult> {
  const attemptId = requireAttemptId(attemptIdInput);
  const input = requireCompletionInput(inputValue);
  const [, invalidated, current, probe] = await db.accountTransaction<RecallAttemptProbeRow>(
    userId,
    [
      attemptItemLockQuery(userId, attemptId),
      invalidateStaleAttemptQuery(userId, attemptId, {
        expression: COMPLETION_TIMESTAMP_SQL,
      }),
      {
        text: completionContextReadQuery(),
        params: [userId, attemptId],
      },
      attemptProbeQuery(userId, attemptId),
    ],
  );

  if (invalidated.rows[0]) return { kind: 'invalidated', attempt: null };
  if (!current.rows[0]) {
    const persisted = probe.rows[0];
    if (persisted?.lifecycle_state === 'completed') {
      return completedAttemptReplayResult(
        persisted as RecallAttemptCompletionRow,
        input,
      );
    }
    return { kind: unavailableKind(persisted), attempt: null };
  }

  const context = mapCompletionContext(current.rows[0] as RecallCompletionContextRow);
  if (context.attempt.state === 'prepared') {
    return { kind: 'confidence_required', attempt: null };
  }
  if (context.attempt.state === 'confidence_selected') {
    return { kind: 'reveal_required', attempt: null };
  }

  const nextPreferredDeliveryAt = context.attempt.milestone === 'd1'
    ? await resolveNextDeliveryAt({
        userId,
        knowledgeItemId: context.attempt.knowledgeItemId,
        itemVersion: context.attempt.itemVersion,
        scheduleVersion: context.attempt.scheduleVersion,
        enrolledAt: context.attempt.enrolledAt,
        milestone: 'd1',
        completedAt: context.completedAt,
        outcome: input.outcome,
      })
    : undefined;
  const decision = assessRecallSchedule(context.schedule.snapshot, {
    at: context.completedAt,
    outcome: input.outcome,
    nextPreferredDeliveryAt,
  });

  const [, invalidatedDuringWrite, completed, finalProbe] = await db.accountTransaction<RecallAttemptProbeRow>(
    userId,
    [
      attemptItemLockQuery(userId, attemptId),
      invalidateStaleAttemptQuery(userId, attemptId, {
        expression: '$3::timestamptz',
        instant: context.completedAt,
      }),
      completionMutationQuery(userId, attemptId, context, decision, input),
      attemptProbeQuery(userId, attemptId),
    ],
  );

  if (invalidatedDuringWrite.rows[0]) return { kind: 'invalidated', attempt: null };
  if (completed.rows[0]) {
    return {
      kind: 'completed',
      attempt: mapCompletedAttemptRow(completed.rows[0] as RecallAttemptCompletionRow),
    };
  }
  const persisted = finalProbe.rows[0];
  if (persisted?.lifecycle_state === 'completed') {
    return completedAttemptReplayResult(
      persisted as RecallAttemptCompletionRow,
      input,
    );
  }
  if (persisted?.lifecycle_state === 'invalidated') {
    return { kind: 'invalidated', attempt: null };
  }
  return { kind: persisted ? 'conflict' : 'not_available', attempt: null };
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
