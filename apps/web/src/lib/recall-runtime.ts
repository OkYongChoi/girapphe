import 'server-only';

import {
  RECALL_D1_OPEN_MS,
  RECALL_D7_OPEN_MS,
  classifyRecallWindow,
  isRecallSupportedBundleType,
  rollRecallWindow,
  type KnowledgeBundleContent,
  type RecallInstant,
  type RecallScheduleDecision,
} from '@stem-brain/shared';
import db from '@/lib/db';
import { normalizeKnowledgeSourceUrl } from '@/lib/knowledge-source-url';
import { parseKnowledgeBundleFields } from '@/lib/knowledge-bundle-runtime';
import { strictRecallEligibilityPredicate } from '@/lib/recall-eligibility-sql';
import type { PersistedRecallSchedule } from '@/lib/recall-persistence';
import { RECALL_SCHEDULE_LOCK_PREFIX } from '@/lib/recall-schedule-lock';
import type {
  PersistedRecallAttempt,
  RecallAttemptConfidence,
  RecallAttemptExerciseType,
  RecallAttemptMilestone,
  RecallAttemptNextDeliveryContext,
} from '@/lib/recall-attempts';

const MAX_RECALL_CANDIDATES = 24;
const MAX_ACTIVE_RECALL_SCHEDULES = 100;

export type RecallSourceSummary = {
  provider: 'chatgpt' | 'claude' | 'gemini' | 'other';
  discussedAt: string | null;
  approvalStatus: 'approved';
};

export type ManualRecallCandidate = {
  knowledgeItemId: string;
  itemVersion: number;
  centralQuestion: string;
  exerciseType: RecallAttemptExerciseType;
  source: RecallSourceSummary;
};

export type ManualRecallScheduleCard = ManualRecallCandidate & {
  scheduleVersion: number;
  enrolledAt: string;
  scheduleState: 'd1_pending' | 'd1_retry' | 'd7_pending';
  dueAt: string;
  isDue: boolean;
};

export type ManualRecallOverview = {
  databaseAvailable: boolean;
  candidates: ManualRecallCandidate[];
  schedules: ManualRecallScheduleCard[];
};

type ManualRecallSessionBase = {
  attemptId: string;
  knowledgeItemId: string;
  itemVersion: number;
  scheduleVersion: number;
  enrolledAt: string;
  milestone: RecallAttemptMilestone;
  exerciseType: RecallAttemptExerciseType;
  centralQuestion: string;
  confidence: RecallAttemptConfidence | null;
  source: RecallSourceSummary;
};

export type ManualRecallPreRevealSession = ManualRecallSessionBase & {
  phase: 'reconstruct';
};

export type ManualRecallRevealedSession = ManualRecallSessionBase & {
  phase: 'revealed';
  bundle: {
    type: RecallAttemptExerciseType;
    centralQuestion: string;
    content: KnowledgeBundleContent;
  };
  sourceDetails: RecallSourceSummary & {
    selectorCount: number;
    sourceUrl: string | null;
    supportedItemVersion: number;
    verificationStatus: 'not_recorded';
  };
};

export type ManualRecallSession =
  | ManualRecallPreRevealSession
  | ManualRecallRevealedSession;

type SafeRecallItemRow = {
  knowledge_item_id: string;
  item_version: number | string;
  central_question: string;
  knowledge_type: string;
  provider: string;
  discussed_at: Date | string | null;
};

type SafeRecallScheduleRow = SafeRecallItemRow & {
  schedule_version: number | string;
  recall_enrolled_at: Date | string;
  recall_schedule_state: string;
  due_at: Date | string;
  is_due: boolean;
};

type SafeRecallAttemptRow = SafeRecallItemRow & {
  attempt_id: string;
  schedule_version: number | string;
  recall_enrolled_at: Date | string;
  milestone: string;
  lifecycle_state: string;
  confidence: string | null;
};

type RevealedRecallAttemptRow = SafeRecallAttemptRow & {
  structured_content: unknown;
  bundle_schema_version: number | string;
  source_url: string | null;
  selector_count: number | string;
  supported_item_version: number | string;
};

const SAFE_PROVENANCE_LATERAL_SQL = `
  JOIN LATERAL (
    SELECT
      src.provider,
      src.discussed_at
    FROM knowledge_card_drafts d
    JOIN knowledge_ingestion_batches b
      ON b.id = d.batch_id
     AND b.user_id = i.user_id
     AND b.source_type = 'conversation'
     AND b.scope = 'current_conversation'
     AND b.status IN ('partial', 'approved')
    JOIN knowledge_card_sources src
      ON src.knowledge_item_id = i.id
     AND src.user_id = i.user_id
     AND src.draft_id = d.id
     AND src.batch_id = b.id
     AND src.source_type = 'conversation'
     AND src.supported_item_version = i.version
    WHERE d.knowledge_item_id = i.id
      AND d.user_id = i.user_id
      AND d.status = 'approved'
      AND d.approved_at IS NOT NULL
    ORDER BY src.created_at DESC, src.id DESC
    LIMIT 1
  ) provenance ON TRUE
`;

function positiveInteger(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${field}.`);
  return parsed;
}

function instant(value: Date | string | null, field: string): string | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ${field}.`);
  return parsed.toISOString();
}

function sourceProvider(value: string): RecallSourceSummary['provider'] {
  return value === 'chatgpt' || value === 'claude' || value === 'gemini'
    ? value
    : 'other';
}

function sourceSummary(row: SafeRecallItemRow): RecallSourceSummary {
  return {
    provider: sourceProvider(row.provider),
    discussedAt: instant(row.discussed_at, 'Recall discussion instant'),
    approvalStatus: 'approved',
  };
}

function mapSafeRecallItem(row: SafeRecallItemRow): ManualRecallCandidate {
  if (!row.knowledge_item_id || !row.central_question.trim()) {
    throw new Error('Invalid Recall item metadata.');
  }
  if (!isRecallSupportedBundleType(row.knowledge_type)) {
    throw new Error('Invalid Recall exercise type.');
  }
  return {
    knowledgeItemId: row.knowledge_item_id,
    itemVersion: positiveInteger(row.item_version, 'Recall item version'),
    centralQuestion: row.central_question,
    exerciseType: row.knowledge_type,
    source: sourceSummary(row),
  };
}

function mapSafeRecallSchedule(row: SafeRecallScheduleRow): ManualRecallScheduleCard {
  if (!['d1_pending', 'd1_retry', 'd7_pending'].includes(row.recall_schedule_state)) {
    throw new Error('Invalid active Recall schedule state.');
  }
  const item = mapSafeRecallItem(row);
  return {
    ...item,
    scheduleVersion: positiveInteger(row.schedule_version, 'Recall schedule version'),
    enrolledAt: instant(row.recall_enrolled_at, 'Recall enrollment instant')!,
    scheduleState: row.recall_schedule_state as ManualRecallScheduleCard['scheduleState'],
    dueAt: instant(row.due_at, 'Recall due instant')!,
    isDue: row.is_due === true,
  };
}

function mapSafeRecallAttempt(row: SafeRecallAttemptRow): ManualRecallPreRevealSession {
  const item = mapSafeRecallItem(row);
  if (!['d1', 'd7'].includes(row.milestone)) throw new Error('Invalid Recall milestone.');
  if (!['prepared', 'confidence_selected', 'revealed'].includes(row.lifecycle_state)) {
    throw new Error('Invalid active Recall attempt state.');
  }
  if (row.confidence !== null && !['low', 'medium', 'high'].includes(row.confidence)) {
    throw new Error('Invalid Recall confidence.');
  }
  return {
    phase: 'reconstruct',
    attemptId: row.attempt_id,
    knowledgeItemId: item.knowledgeItemId,
    itemVersion: item.itemVersion,
    scheduleVersion: positiveInteger(row.schedule_version, 'Recall schedule version'),
    enrolledAt: instant(row.recall_enrolled_at, 'Recall enrollment instant')!,
    milestone: row.milestone as RecallAttemptMilestone,
    exerciseType: item.exerciseType,
    centralQuestion: item.centralQuestion,
    confidence: row.confidence as RecallAttemptConfidence | null,
    source: item.source,
  };
}

function currentAttemptPredicate(): string {
  return `
    s.user_id = a.user_id
    AND s.knowledge_item_id = a.knowledge_item_id
    AND s.recall_item_version = a.item_version
    AND s.recall_schedule_version = a.schedule_version
    AND s.recall_enrolled_at = a.recall_enrolled_at
    AND s.due_at IS NOT NULL
    AND s.due_at <= NOW()
    AND (
      (a.milestone = 'd1'
        AND s.recall_schedule_state IN ('d1_pending', 'd1_retry')
        AND NOW() < s.recall_enrolled_at + INTERVAL '168 hours')
      OR
      (a.milestone = 'd7'
        AND s.recall_schedule_state = 'd7_pending'
        AND NOW() < s.recall_enrolled_at + INTERVAL '192 hours')
    )
    AND i.id = s.knowledge_item_id
    AND i.user_id = s.user_id
    AND i.knowledge_type = a.exercise_type
    AND ${strictRecallEligibilityPredicate('a.item_version')}
  `;
}

export function manualRecallRolloverDecision(
  schedule: PersistedRecallSchedule,
  at: RecallInstant,
): RecallScheduleDecision | null {
  const window = classifyRecallWindow(schedule.snapshot.enrolledAt, at);
  if ((schedule.snapshot.state === 'd1_pending' || schedule.snapshot.state === 'd1_retry')
    && window === 'd7') {
    return rollRecallWindow(schedule.snapshot, { at, nextD7DeliveryAt: at });
  }
  if ((schedule.snapshot.state === 'd1_pending' || schedule.snapshot.state === 'd1_retry')
    && window === 'post_d7') {
    return rollRecallWindow(schedule.snapshot, { at });
  }
  if (schedule.snapshot.state === 'd7_pending' && window === 'post_d7') {
    return rollRecallWindow(schedule.snapshot, { at });
  }
  return null;
}

function staleRecallScheduleSelectionSql(): string {
  return `stale_recall_schedules AS MATERIALIZED (
    SELECT s.user_id, s.knowledge_item_id
    FROM user_private_card_states s
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    WHERE s.user_id = $1
      AND s.recall_enrolled_at IS NOT NULL
      AND s.recall_item_version IS NOT NULL
      AND s.recall_schedule_version IS NOT NULL
      AND s.due_at IS NOT NULL
      AND s.recall_schedule_state IN ('d1_pending', 'd1_retry', 'd7_pending')
      AND s.recall_item_version = i.version
      AND (
        (
          s.recall_schedule_state IN ('d1_pending', 'd1_retry')
          AND $2::timestamptz >= s.recall_enrolled_at + INTERVAL '168 hours'
        )
        OR (
          s.recall_schedule_state = 'd7_pending'
          AND $2::timestamptz >= s.recall_enrolled_at + INTERVAL '192 hours'
        )
      )
      AND ${strictRecallEligibilityPredicate('s.recall_item_version')}
    ORDER BY s.knowledge_item_id
    LIMIT ${MAX_ACTIVE_RECALL_SCHEDULES}
  )`;
}

export async function reconcileActiveRecallSchedulesForUser(
  userId: string,
  at: RecallInstant = new Date(),
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const normalizedAt = instant(at instanceof Date ? at : new Date(at), 'Recall reconciliation instant')!;
  const selectedSchedules = staleRecallScheduleSelectionSql();

  // Materialize one bounded ID set, lock it in item order, then consume every
  // lock through one aggregate barrier before exposing the exact ID array to
  // the update. The repeated predicates re-check the winner's current schedule
  // and item eligibility before incrementing its generation.
  await db.accountTransaction(userId, [{
    text: `WITH ${selectedSchedules},
      locked_stale_recall_schedules AS MATERIALIZED (
        SELECT
          selected.user_id,
          selected.knowledge_item_id,
          pg_advisory_xact_lock(
            hashtext($3 || ':' || selected.user_id || ':' || selected.knowledge_item_id)
          ) AS item_lock
        FROM stale_recall_schedules selected
        ORDER BY selected.knowledge_item_id
      ),
      locked_stale_recall_schedule_batch AS MATERIALIZED (
        SELECT
          ARRAY_AGG(locked.knowledge_item_id ORDER BY locked.knowledge_item_id)
            AS knowledge_item_ids,
          BOOL_AND(locked.item_lock IS NOT NULL) AS all_item_locks_acquired
        FROM locked_stale_recall_schedules locked
      )
      UPDATE user_private_card_states s
      SET due_at = CASE
            WHEN $2::timestamptz >= s.recall_enrolled_at + INTERVAL '192 hours'
              THEN s.recall_enrolled_at + INTERVAL '192 hours'
            ELSE $2::timestamptz
          END,
          recall_schedule_state = CASE
            WHEN $2::timestamptz >= s.recall_enrolled_at + INTERVAL '192 hours'
              THEN 'ordinary_practice'
            ELSE 'd7_pending'
          END,
          recall_d1_finalized_incomplete = CASE
            WHEN s.recall_schedule_state IN ('d1_pending', 'd1_retry') THEN TRUE
            ELSE s.recall_d1_finalized_incomplete
          END,
          recall_d7_outcome = CASE
            WHEN $2::timestamptz >= s.recall_enrolled_at + INTERVAL '192 hours'
              THEN 'unassessed'
            ELSE NULL
          END,
          recall_schedule_version = s.recall_schedule_version + 1
      FROM locked_stale_recall_schedule_batch locked_batch, user_knowledge_items i
      WHERE locked_batch.all_item_locks_acquired
        AND s.user_id = $1
        AND s.knowledge_item_id = ANY(locked_batch.knowledge_item_ids)
        AND i.id = s.knowledge_item_id
        AND i.user_id = s.user_id
        AND s.recall_item_version = i.version
        AND s.recall_schedule_state IN ('d1_pending', 'd1_retry', 'd7_pending')
        AND (
          (
            s.recall_schedule_state IN ('d1_pending', 'd1_retry')
            AND $2::timestamptz >= s.recall_enrolled_at + INTERVAL '168 hours'
            AND $2::timestamptz < s.recall_enrolled_at + INTERVAL '192 hours'
          )
          OR (
            s.recall_schedule_state IN ('d1_pending', 'd1_retry', 'd7_pending')
            AND $2::timestamptz >= s.recall_enrolled_at + INTERVAL '192 hours'
          )
        )
        AND ${strictRecallEligibilityPredicate('s.recall_item_version')}
      RETURNING s.knowledge_item_id`,
    params: [userId, normalizedAt, RECALL_SCHEDULE_LOCK_PREFIX],
  }]);
}

export async function hasActiveRecallScheduleForUser(userId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const result = await db.query<{ has_active: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM user_private_card_states s
      JOIN user_knowledge_items i
        ON i.id = s.knowledge_item_id
       AND i.user_id = s.user_id
      WHERE s.user_id = $1
        AND s.recall_enrolled_at IS NOT NULL
        AND s.recall_item_version IS NOT NULL
        AND s.recall_schedule_version IS NOT NULL
        AND s.recall_schedule_state IN ('d1_pending', 'd1_retry', 'd7_pending')
        AND s.recall_item_version = i.version
        AND ${strictRecallEligibilityPredicate('s.recall_item_version')}
    ) AS has_active`, [userId]);
  return result.rows[0]?.has_active === true;
}

async function listManualRecallCandidatesForUser(userId: string): Promise<ManualRecallCandidate[]> {
  const result = await db.query<SafeRecallItemRow>(`
    SELECT
      i.id AS knowledge_item_id,
      i.version AS item_version,
      i.central_question,
      i.knowledge_type,
      provenance.provider,
      provenance.discussed_at
    FROM user_knowledge_items i
    ${SAFE_PROVENANCE_LATERAL_SQL}
    WHERE ${strictRecallEligibilityPredicate('i.version')}
      AND NOT EXISTS (
        SELECT 1
        FROM user_private_card_states s
        WHERE s.user_id = i.user_id
          AND s.knowledge_item_id = i.id
          AND s.recall_enrolled_at IS NOT NULL
      )
    ORDER BY i.id
    LIMIT ${MAX_RECALL_CANDIDATES}`, [userId]);
  return result.rows.map(mapSafeRecallItem);
}

async function listManualRecallScheduleCardsForUser(
  userId: string,
): Promise<ManualRecallScheduleCard[]> {
  const result = await db.query<SafeRecallScheduleRow>(`
    SELECT
      i.id AS knowledge_item_id,
      i.version AS item_version,
      i.central_question,
      i.knowledge_type,
      provenance.provider,
      provenance.discussed_at,
      s.recall_schedule_version AS schedule_version,
      s.recall_enrolled_at,
      s.recall_schedule_state,
      s.due_at,
      s.due_at <= NOW() AS is_due
    FROM user_private_card_states s
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    ${SAFE_PROVENANCE_LATERAL_SQL}
    WHERE s.user_id = $1
      AND s.recall_enrolled_at IS NOT NULL
      AND s.recall_item_version IS NOT NULL
      AND s.recall_schedule_version IS NOT NULL
      AND s.recall_schedule_state IN ('d1_pending', 'd1_retry', 'd7_pending')
      AND s.recall_item_version = i.version
      AND ${strictRecallEligibilityPredicate('s.recall_item_version')}
    ORDER BY s.due_at, i.id
    LIMIT ${MAX_ACTIVE_RECALL_SCHEDULES}`, [userId]);
  return result.rows.map(mapSafeRecallSchedule);
}

export async function getManualRecallOverviewForUser(
  userId: string,
  options: { enrollmentEnabled: boolean; at?: RecallInstant },
): Promise<ManualRecallOverview> {
  if (!process.env.DATABASE_URL) {
    return { databaseAvailable: false, candidates: [], schedules: [] };
  }
  await reconcileActiveRecallSchedulesForUser(userId, options.at ?? new Date());
  const [candidates, schedules] = await Promise.all([
    options.enrollmentEnabled ? listManualRecallCandidatesForUser(userId) : Promise.resolve([]),
    listManualRecallScheduleCardsForUser(userId),
  ]);
  return { databaseAvailable: true, candidates, schedules };
}

async function getSafeRecallAttemptRow(
  userId: string,
  attemptId: string,
): Promise<SafeRecallAttemptRow | null> {
  const result = await db.query<SafeRecallAttemptRow>(`
    SELECT
      a.id AS attempt_id,
      a.knowledge_item_id,
      a.item_version,
      a.schedule_version,
      a.recall_enrolled_at,
      a.milestone,
      a.lifecycle_state,
      a.confidence,
      i.central_question,
      i.knowledge_type,
      provenance.provider,
      provenance.discussed_at
    FROM recall_attempts a
    JOIN user_private_card_states s
      ON s.user_id = a.user_id
     AND s.knowledge_item_id = a.knowledge_item_id
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    ${SAFE_PROVENANCE_LATERAL_SQL}
    WHERE a.user_id = $1
      AND a.id = $2
      AND a.lifecycle_state IN ('prepared', 'confidence_selected', 'revealed')
      AND ${currentAttemptPredicate()}
    LIMIT 1`, [userId, attemptId]);
  return result.rows[0] ?? null;
}

export async function getManualRecallPreRevealSessionForUser(
  userId: string,
  attemptId: string,
): Promise<ManualRecallPreRevealSession | null> {
  if (!process.env.DATABASE_URL) return null;
  const row = await getSafeRecallAttemptRow(userId, attemptId);
  return row ? mapSafeRecallAttempt(row) : null;
}

export async function getManualRecallRevealedSessionForUser(
  userId: string,
  attemptId: string,
): Promise<ManualRecallRevealedSession | null> {
  if (!process.env.DATABASE_URL) return null;
  const result = await db.query<RevealedRecallAttemptRow>(`
    SELECT
      a.id AS attempt_id,
      a.knowledge_item_id,
      a.item_version,
      a.schedule_version,
      a.recall_enrolled_at,
      a.milestone,
      a.lifecycle_state,
      a.confidence,
      i.central_question,
      i.knowledge_type,
      i.structured_content,
      i.bundle_schema_version,
      provenance.provider,
      provenance.discussed_at,
      provenance.source_url,
      provenance.supported_item_version,
      (
        SELECT COUNT(*)
        FROM knowledge_evidence_spans evidence
        WHERE evidence.user_id = a.user_id
          AND evidence.knowledge_item_id = a.knowledge_item_id
          AND evidence.source_id = provenance.source_id
      ) AS selector_count
    FROM recall_attempts a
    JOIN user_private_card_states s
      ON s.user_id = a.user_id
     AND s.knowledge_item_id = a.knowledge_item_id
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    JOIN LATERAL (
      SELECT
        src.id AS source_id,
        src.provider,
        src.discussed_at,
        src.source_url,
        src.supported_item_version
      FROM knowledge_card_drafts d
      JOIN knowledge_ingestion_batches b
        ON b.id = d.batch_id
       AND b.user_id = i.user_id
       AND b.source_type = 'conversation'
       AND b.scope = 'current_conversation'
       AND b.status IN ('partial', 'approved')
      JOIN knowledge_card_sources src
        ON src.knowledge_item_id = i.id
       AND src.user_id = i.user_id
       AND src.draft_id = d.id
       AND src.batch_id = b.id
       AND src.source_type = 'conversation'
       AND src.supported_item_version = i.version
      WHERE d.knowledge_item_id = i.id
        AND d.user_id = i.user_id
        AND d.status = 'approved'
        AND d.approved_at IS NOT NULL
      ORDER BY src.created_at DESC, src.id DESC
      LIMIT 1
    ) provenance ON TRUE
    WHERE a.user_id = $1
      AND a.id = $2
      AND a.lifecycle_state = 'revealed'
      AND ${currentAttemptPredicate()}
    LIMIT 1`, [userId, attemptId]);
  const row = result.rows[0];
  if (!row) return null;
  const preReveal = mapSafeRecallAttempt(row);
  const bundle = parseKnowledgeBundleFields({
    knowledge_type: row.knowledge_type,
    central_question: row.central_question,
    structured_content: row.structured_content,
    bundle_schema_version: positiveInteger(row.bundle_schema_version, 'bundle schema version'),
  });
  if (!bundle || !isRecallSupportedBundleType(bundle.knowledge_type)) return null;
  return {
    ...preReveal,
    phase: 'revealed',
    bundle: {
      type: bundle.knowledge_type,
      centralQuestion: bundle.central_question,
      content: bundle.structured_content,
    },
    sourceDetails: {
      ...preReveal.source,
      selectorCount: Math.max(0, positiveIntegerOrZero(row.selector_count)),
      sourceUrl: normalizeKnowledgeSourceUrl(row.source_url),
      supportedItemVersion: positiveInteger(
        row.supported_item_version,
        'supported item version',
      ),
      verificationStatus: 'not_recorded',
    },
  };
}

function positiveIntegerOrZero(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Invalid selector count.');
  return parsed;
}

export async function getManualRecallSessionForAttempt(
  userId: string,
  attempt: PersistedRecallAttempt,
): Promise<ManualRecallSession | null> {
  return attempt.state === 'revealed'
    ? getManualRecallRevealedSessionForUser(userId, attempt.id)
    : getManualRecallPreRevealSessionForUser(userId, attempt.id);
}

export async function resolveManualRecallNextDeliveryAt(
  context: RecallAttemptNextDeliveryContext,
): Promise<RecallInstant> {
  const enrolledAt = new Date(context.enrolledAt).getTime();
  const completedAt = new Date(context.completedAt).getTime();
  if (!Number.isFinite(enrolledAt) || !Number.isFinite(completedAt)) {
    throw new Error('Invalid Recall delivery context.');
  }
  const d7OpensAt = enrolledAt + RECALL_D7_OPEN_MS;
  if (context.outcome === 'remembered') return new Date(d7OpensAt).toISOString();
  return new Date(Math.min(completedAt + RECALL_D1_OPEN_MS, d7OpensAt)).toISOString();
}
