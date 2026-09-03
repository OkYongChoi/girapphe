import 'server-only';

import {
  RECALL_D1_INITIAL_DELIVERY_CLOSE_MS,
  RECALL_D7_CLOSE_MS,
  classifyRecallWindow,
  createRecallEnrollmentSchedule,
  type RecallInstant,
  type RecallPracticeProjection,
  type RecallScheduleDecision,
  type RecallScheduleSnapshot,
} from '@stem-brain/shared';
import db from '@/lib/db';

export type PersistedRecallPractice = {
  status: 'known' | 'saved' | null;
  knowledgeState: 'unknown' | 'known' | null;
  progressState: 'learning' | 'review' | null;
  lastSeen: string | null;
};

export type PersistedRecallSchedule = {
  knowledgeItemId: string;
  itemVersion: number;
  scheduleVersion: number;
  snapshot: RecallScheduleSnapshot;
  practice: PersistedRecallPractice;
};

export type RecallEnrollmentPersistenceResult =
  | { kind: 'enrolled' | 'unchanged'; schedule: PersistedRecallSchedule }
  | { kind: 'ineligible'; schedule: null };

export type RecallDecisionPersistenceResult =
  | { kind: 'applied' | 'unchanged'; schedule: PersistedRecallSchedule }
  | { kind: 'conflict'; schedule: PersistedRecallSchedule }
  | { kind: 'not_found'; schedule: null };

export type RecallCancellationPersistenceResult =
  | { kind: 'cancelled' | 'unchanged'; retainedPractice: boolean }
  | { kind: 'conflict'; schedule: PersistedRecallSchedule }
  | { kind: 'not_found'; schedule: null };

type RecallScheduleRow = {
  knowledge_item_id: string;
  item_version: number;
  schedule_version: number;
  recall_enrolled_at: Date | string;
  recall_schedule_state: string;
  due_at: Date | string;
  recall_d1_finalized_incomplete: boolean;
  recall_d7_outcome: string | null;
  status: string | null;
  knowledge_state: string | null;
  progress_state: string | null;
  last_seen: Date | string | null;
};

type RecallCancellationRow = Partial<RecallScheduleRow> & {
  knowledge_item_id?: string;
  owner_item_id?: string;
  state_row_item_id?: string | null;
  retained_practice?: boolean;
};

const ACTIVE_RECALL_ITEM_PREDICATE = `
  i.user_id = $1
  AND i.archived_at IS NULL
  AND i.deleted_at IS NULL
  AND i.purge_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM knowledge_item_supersessions supersession
    WHERE supersession.user_id = i.user_id
      AND supersession.superseded_item_id = i.id
  )
`;

const APPROVED_CURRENT_CONVERSATION_PREDICATE = `
  EXISTS (
    SELECT 1
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
  )
`;

function strictRecallEligibilityPredicate(versionExpression: string): string {
  return `
    ${ACTIVE_RECALL_ITEM_PREDICATE}
    AND i.version = ${versionExpression}
    AND i.bundle_schema_version = 1
    AND i.knowledge_type IN ('concept', 'procedure', 'comparison')
    AND i.central_question IS NOT NULL
    AND i.structured_content IS NOT NULL
    AND ${APPROVED_CURRENT_CONVERSATION_PREDICATE}
  `;
}

const RECALL_SCHEDULE_COLUMNS = `
  s.knowledge_item_id,
  s.recall_item_version AS item_version,
  s.recall_schedule_version AS schedule_version,
  s.recall_enrolled_at,
  s.recall_schedule_state,
  s.due_at,
  s.recall_d1_finalized_incomplete,
  s.recall_d7_outcome,
  s.status,
  s.knowledge_state,
  s.progress_state,
  s.last_seen
`;

function recallScheduleReadQuery(versionExpression: string): string {
  return `
    SELECT ${RECALL_SCHEDULE_COLUMNS}
    FROM user_private_card_states s
    JOIN user_knowledge_items i
      ON i.id = s.knowledge_item_id
     AND i.user_id = s.user_id
    WHERE s.user_id = $1
      AND s.knowledge_item_id = $2
      AND s.recall_enrolled_at IS NOT NULL
      AND s.recall_item_version IS NOT NULL
      AND s.recall_schedule_version IS NOT NULL
      AND s.recall_item_version = i.version
      AND ${strictRecallEligibilityPredicate(versionExpression)}
    LIMIT 1
  `;
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

function normalizeInstant(value: RecallInstant, field: string): string {
  try {
    classifyRecallWindow(value, value);
    return new Date(value).toISOString();
  } catch {
    throw new Error(`Invalid ${field}.`);
  }
}

function normalizeSnapshot(snapshot: RecallScheduleSnapshot): RecallScheduleSnapshot {
  const enrolledAt = normalizeInstant(snapshot.enrolledAt, 'enrolledAt');
  const dueAt = normalizeInstant(snapshot.dueAt, 'dueAt');
  const window = classifyRecallWindow(enrolledAt, dueAt);

  if (snapshot.state === 'd1_pending') {
    const elapsed = new Date(dueAt).getTime() - new Date(enrolledAt).getTime();
    if (window !== 'd1' || elapsed >= RECALL_D1_INITIAL_DELIVERY_CLOSE_MS) {
      throw new Error('d1_pending must stay inside the initial D+1 delivery window.');
    }
  } else if (snapshot.state === 'd1_retry') {
    if (window !== 'd1') throw new Error('d1_retry must stay inside the D+1 window.');
  } else if (snapshot.state === 'd7_pending') {
    if (window !== 'd7') throw new Error('d7_pending must stay inside the D+7 window.');
  } else if (snapshot.state === 'ordinary_practice') {
    if (window !== 'post_d7') {
      throw new Error('ordinary_practice must start after the D+7 window.');
    }
  } else {
    throw new Error('Invalid Recall schedule state.');
  }

  if ((snapshot.state === 'd1_pending' || snapshot.state === 'd1_retry')
    && (snapshot.d1FinalizedIncomplete || snapshot.d7Outcome !== null)) {
    throw new Error('D+1 state cannot contain finalized D+1 or D+7 outcomes.');
  }
  if (snapshot.state === 'd7_pending' && snapshot.d7Outcome !== null) {
    throw new Error('Pending D+7 state cannot contain a D+7 outcome.');
  }
  if (snapshot.state === 'ordinary_practice'
    && !['remembered', 'partial', 'missed', 'unassessed'].includes(snapshot.d7Outcome ?? '')) {
    throw new Error('Ordinary Practice requires a D+7 outcome.');
  }
  if (typeof snapshot.d1FinalizedIncomplete !== 'boolean') {
    throw new Error('Invalid D+1 finalization flag.');
  }

  return {
    enrolledAt,
    state: snapshot.state,
    dueAt,
    d1FinalizedIncomplete: snapshot.d1FinalizedIncomplete,
    d7Outcome: snapshot.d7Outcome,
  };
}

function normalizePractice(practice: PersistedRecallPractice): PersistedRecallPractice {
  const allNull = practice.status === null
    && practice.knowledgeState === null
    && practice.progressState === null
    && practice.lastSeen === null;
  if (allNull) return practice;

  const known = practice.status === 'known'
    && practice.knowledgeState === 'known'
    && practice.progressState === 'review';
  const saved = practice.status === 'saved'
    && practice.knowledgeState === 'unknown'
    && practice.progressState === 'learning';
  if ((!known && !saved) || practice.lastSeen === null) {
    throw new Error('Invalid persisted Practice projection.');
  }
  return {
    ...practice,
    lastSeen: normalizeInstant(practice.lastSeen, 'lastSeen'),
  };
}

function normalizePersistedSchedule(schedule: PersistedRecallSchedule): PersistedRecallSchedule {
  if (!schedule.knowledgeItemId) throw new Error('Invalid knowledge item id.');
  requirePositiveInteger(schedule.itemVersion, 'itemVersion');
  requirePositiveInteger(schedule.scheduleVersion, 'scheduleVersion');
  return {
    ...schedule,
    snapshot: normalizeSnapshot(schedule.snapshot),
    practice: normalizePractice(schedule.practice),
  };
}

function mapRecallScheduleRow(row: RecallScheduleRow): PersistedRecallSchedule {
  const itemVersion = Number(row.item_version);
  const scheduleVersion = Number(row.schedule_version);
  const schedule = normalizePersistedSchedule({
    knowledgeItemId: row.knowledge_item_id,
    itemVersion,
    scheduleVersion,
    snapshot: {
      enrolledAt: row.recall_enrolled_at instanceof Date
        ? row.recall_enrolled_at.toISOString()
        : row.recall_enrolled_at,
      state: row.recall_schedule_state as RecallScheduleSnapshot['state'],
      dueAt: row.due_at instanceof Date ? row.due_at.toISOString() : row.due_at,
      d1FinalizedIncomplete: row.recall_d1_finalized_incomplete,
      d7Outcome: row.recall_d7_outcome as RecallScheduleSnapshot['d7Outcome'],
    },
    practice: {
      status: row.status as PersistedRecallPractice['status'],
      knowledgeState: row.knowledge_state as PersistedRecallPractice['knowledgeState'],
      progressState: row.progress_state as PersistedRecallPractice['progressState'],
      lastSeen: row.last_seen instanceof Date ? row.last_seen.toISOString() : row.last_seen,
    },
  });
  return schedule;
}

function snapshotEquals(left: RecallScheduleSnapshot, right: RecallScheduleSnapshot): boolean {
  return left.enrolledAt === right.enrolledAt
    && left.state === right.state
    && left.dueAt === right.dueAt
    && left.d1FinalizedIncomplete === right.d1FinalizedIncomplete
    && left.d7Outcome === right.d7Outcome;
}

function practiceEquals(left: PersistedRecallPractice, right: PersistedRecallPractice): boolean {
  return left.status === right.status
    && left.knowledgeState === right.knowledgeState
    && left.progressState === right.progressState
    && left.lastSeen === right.lastSeen;
}

function desiredPractice(
  current: PersistedRecallPractice,
  projection: RecallPracticeProjection,
  transitionedAt: string | null,
): PersistedRecallPractice {
  if (projection.action === 'preserve') return current;
  if (transitionedAt === null) throw new Error('Practice projection requires transitionedAt.');
  return {
    status: projection.status,
    knowledgeState: projection.knowledgeState,
    progressState: projection.progressState,
    lastSeen: transitionedAt,
  };
}

function validateProjection(
  projection: RecallPracticeProjection,
  transitionedAt: RecallInstant | undefined,
): string | null {
  if (projection.action === 'preserve') {
    if (transitionedAt !== undefined) {
      throw new Error('Preserved Practice projection cannot change lastSeen.');
    }
    return null;
  }
  const known = projection.status === 'known'
    && projection.knowledgeState === 'known'
    && projection.progressState === 'review';
  const saved = projection.status === 'saved'
    && projection.knowledgeState === 'unknown'
    && projection.progressState === 'learning';
  if (!known && !saved) throw new Error('Invalid Practice projection.');
  if (transitionedAt === undefined) {
    throw new Error('Practice projection requires transitionedAt.');
  }
  return normalizeInstant(transitionedAt, 'transitionedAt');
}

type ProjectionKind = 'preserve' | 'known' | 'saved';

function projectionKind(projection: RecallPracticeProjection): ProjectionKind {
  if (projection.action === 'preserve') return 'preserve';
  return projection.status === 'known' ? 'known' : 'saved';
}

function validateScheduleTransition(
  expected: RecallScheduleSnapshot,
  next: RecallScheduleSnapshot,
  projection: RecallPracticeProjection,
): void {
  const projected = projectionKind(projection);
  if (snapshotEquals(expected, next)) {
    if (projected !== 'preserve') {
      throw new Error('An unchanged Recall schedule must preserve Practice.');
    }
    return;
  }

  const expectedDueAt = new Date(expected.dueAt).getTime();
  const nextDueAt = new Date(next.dueAt).getTime();
  if (nextDueAt <= expectedDueAt) {
    throw new Error('A Recall transition must move its due instant forward.');
  }
  if (expected.d1FinalizedIncomplete && !next.d1FinalizedIncomplete) {
    throw new Error('A finalized D+1 milestone cannot be reopened.');
  }
  if (expected.d7Outcome !== null && next.d7Outcome !== expected.d7Outcome) {
    throw new Error('A terminal D+7 outcome cannot change.');
  }

  if (expected.state === 'd1_pending' || expected.state === 'd1_retry') {
    if (next.state === 'd1_retry') {
      if (projected === 'known') {
        throw new Error('A remembered D+1 result must advance to D+7.');
      }
      return;
    }
    if (next.state === 'd7_pending') {
      const allowed = next.d1FinalizedIncomplete
        ? projected === 'saved' || projected === 'preserve'
        : projected === 'known';
      if (!allowed) {
        throw new Error('The D+1 result does not match its D+7 Practice projection.');
      }
      return;
    }
    if (next.state === 'ordinary_practice') {
      const closeAt = new Date(next.enrolledAt).getTime() + RECALL_D7_CLOSE_MS;
      if (next.d7Outcome !== 'unassessed'
        || !next.d1FinalizedIncomplete
        || projected !== 'preserve'
        || nextDueAt !== closeAt) {
        throw new Error('D+1 can skip to ordinary Practice only after an unassessed D+7 close.');
      }
      return;
    }
    throw new Error(`Recall state ${expected.state} cannot transition to ${next.state}.`);
  }

  if (expected.state === 'd7_pending') {
    if (next.d1FinalizedIncomplete !== expected.d1FinalizedIncomplete) {
      throw new Error('D+7 cannot rewrite the finalized D+1 result.');
    }
    if (next.state === 'd7_pending') {
      if (projected !== 'preserve') {
        throw new Error('A pending D+7 reschedule must preserve Practice.');
      }
      return;
    }
    if (next.state === 'ordinary_practice') {
      const requiredProjection = next.d7Outcome === 'remembered'
        ? 'known'
        : next.d7Outcome === 'unassessed' ? 'preserve' : 'saved';
      if (projected !== requiredProjection) {
        throw new Error('The D+7 outcome does not match its Practice projection.');
      }
      if (next.d7Outcome !== 'remembered') {
        const closeAt = new Date(next.enrolledAt).getTime() + RECALL_D7_CLOSE_MS;
        if (nextDueAt !== closeAt) {
          throw new Error('An incomplete D+7 result returns at the D+7 close.');
        }
      }
      return;
    }
    throw new Error(`Recall state d7_pending cannot transition to ${next.state}.`);
  }

  throw new Error('Ordinary Practice is terminal for the Recall milestone schedule.');
}

function recallItemLockKey(userId: string, knowledgeItemId: string): string {
  return `recall-schedule:${userId}:${knowledgeItemId}`;
}

export async function enrollApprovedRecallScheduleForUser(
  userId: string,
  knowledgeItemId: string,
  expectedItemVersion: number,
  enrolledAt: RecallInstant,
  firstDeliveryAt: RecallInstant,
): Promise<RecallEnrollmentPersistenceResult> {
  requirePositiveInteger(expectedItemVersion, 'expectedItemVersion');
  const decision = createRecallEnrollmentSchedule(enrolledAt, firstDeliveryAt);
  const snapshot = normalizeSnapshot(decision.snapshot);
  const [, inserted, current] = await db.accountTransaction<RecallScheduleRow>(userId, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [recallItemLockKey(userId, knowledgeItemId)],
    },
    {
      text: `INSERT INTO user_private_card_states AS s (
        user_id,
        knowledge_item_id,
        status,
        knowledge_state,
        progress_state,
        due_at,
        last_seen,
        recall_enrolled_at,
        recall_item_version,
        recall_schedule_state,
        recall_d1_finalized_incomplete,
        recall_d7_outcome,
        recall_schedule_version
      )
      SELECT
        i.user_id,
        i.id,
        NULL,
        NULL,
        NULL,
        $5::timestamptz,
        NULL,
        $4::timestamptz,
        i.version,
        'd1_pending',
        FALSE,
        NULL,
        1
      FROM user_knowledge_items i
      WHERE i.id = $2
        AND ${strictRecallEligibilityPredicate('$3::integer')}
      ON CONFLICT (user_id, knowledge_item_id)
      DO UPDATE SET
        due_at = EXCLUDED.due_at,
        recall_enrolled_at = EXCLUDED.recall_enrolled_at,
        recall_item_version = EXCLUDED.recall_item_version,
        recall_schedule_state = EXCLUDED.recall_schedule_state,
        recall_d1_finalized_incomplete = EXCLUDED.recall_d1_finalized_incomplete,
        recall_d7_outcome = EXCLUDED.recall_d7_outcome,
        recall_schedule_version = EXCLUDED.recall_schedule_version
      WHERE s.recall_enrolled_at IS NULL
      RETURNING ${RECALL_SCHEDULE_COLUMNS}`,
      params: [userId, knowledgeItemId, expectedItemVersion, snapshot.enrolledAt, snapshot.dueAt],
    },
    {
      text: recallScheduleReadQuery('$3::integer'),
      params: [userId, knowledgeItemId, expectedItemVersion],
    },
  ]);

  if (inserted.rows[0]) {
    return { kind: 'enrolled', schedule: mapRecallScheduleRow(inserted.rows[0]) };
  }
  if (current.rows[0]) {
    return { kind: 'unchanged', schedule: mapRecallScheduleRow(current.rows[0]) };
  }
  return { kind: 'ineligible', schedule: null };
}

export async function getRecallScheduleForUser(
  userId: string,
  knowledgeItemId: string,
): Promise<PersistedRecallSchedule | null> {
  const result = await db.query<RecallScheduleRow>(
    recallScheduleReadQuery('s.recall_item_version'),
    [userId, knowledgeItemId],
  );
  return result.rows[0] ? mapRecallScheduleRow(result.rows[0]) : null;
}

export async function persistRecallScheduleDecisionForUser(
  userId: string,
  knowledgeItemId: string,
  expectedInput: PersistedRecallSchedule,
  decision: RecallScheduleDecision,
  transitionedAt?: RecallInstant,
): Promise<RecallDecisionPersistenceResult> {
  const expected = normalizePersistedSchedule(expectedInput);
  if (expected.knowledgeItemId !== knowledgeItemId) {
    throw new Error('Expected Recall schedule belongs to a different item.');
  }
  const nextSnapshot = normalizeSnapshot(decision.snapshot);
  if (nextSnapshot.enrolledAt !== expected.snapshot.enrolledAt) {
    throw new Error('Recall enrollment instant cannot change.');
  }
  validateScheduleTransition(expected.snapshot, nextSnapshot, decision.practiceProjection);
  const normalizedTransitionedAt = validateProjection(decision.practiceProjection, transitionedAt);
  if (snapshotEquals(expected.snapshot, nextSnapshot)
    && decision.practiceProjection.action === 'preserve') {
    const [, current] = await db.accountTransaction<RecallScheduleRow>(userId, [
      {
        text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
        params: [recallItemLockKey(userId, knowledgeItemId)],
      },
      {
        text: recallScheduleReadQuery('$3::integer'),
        params: [userId, knowledgeItemId, expected.itemVersion],
      },
    ]);
    if (!current.rows[0]) return { kind: 'not_found', schedule: null };
    const currentSchedule = mapRecallScheduleRow(current.rows[0]);
    if (currentSchedule.scheduleVersion === expected.scheduleVersion
      && snapshotEquals(currentSchedule.snapshot, expected.snapshot)) {
      return { kind: 'unchanged', schedule: currentSchedule };
    }
    return { kind: 'conflict', schedule: currentSchedule };
  }
  const projection = decision.practiceProjection.action === 'set'
    ? decision.practiceProjection
    : null;
  const shouldSetPractice = projection !== null;

  const [, updated, current] = await db.accountTransaction<RecallScheduleRow>(userId, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [recallItemLockKey(userId, knowledgeItemId)],
    },
    {
      text: `UPDATE user_private_card_states s
      SET due_at = $14::timestamptz,
          recall_schedule_state = $15,
          recall_d1_finalized_incomplete = $16,
          recall_d7_outcome = $17,
          recall_schedule_version = s.recall_schedule_version + 1,
          status = CASE WHEN $18::boolean THEN $19 ELSE s.status END,
          knowledge_state = CASE WHEN $18::boolean THEN $20 ELSE s.knowledge_state END,
          progress_state = CASE WHEN $18::boolean THEN $21 ELSE s.progress_state END,
          last_seen = CASE WHEN $18::boolean THEN $22::timestamptz ELSE s.last_seen END
      FROM user_knowledge_items i
      WHERE s.user_id = $1
        AND s.knowledge_item_id = $2
        AND i.id = s.knowledge_item_id
        AND i.user_id = s.user_id
        AND s.recall_item_version = $3
        AND s.recall_schedule_version = $4
        AND s.recall_enrolled_at = $5::timestamptz
        AND s.recall_schedule_state = $6
        AND s.due_at = $7::timestamptz
        AND s.recall_d1_finalized_incomplete = $8
        AND s.recall_d7_outcome IS NOT DISTINCT FROM $9::text
        AND (
          NOT $18::boolean
          OR (
            s.status IS NOT DISTINCT FROM $10::text
            AND s.knowledge_state IS NOT DISTINCT FROM $11::text
            AND s.progress_state IS NOT DISTINCT FROM $12::text
            AND date_trunc('milliseconds', s.last_seen)
              IS NOT DISTINCT FROM $13::timestamptz
          )
        )
        AND ${strictRecallEligibilityPredicate('$3::integer')}
      RETURNING ${RECALL_SCHEDULE_COLUMNS}`,
      params: [
        userId,
        knowledgeItemId,
        expected.itemVersion,
        expected.scheduleVersion,
        expected.snapshot.enrolledAt,
        expected.snapshot.state,
        expected.snapshot.dueAt,
        expected.snapshot.d1FinalizedIncomplete,
        expected.snapshot.d7Outcome,
        expected.practice.status,
        expected.practice.knowledgeState,
        expected.practice.progressState,
        expected.practice.lastSeen,
        nextSnapshot.dueAt,
        nextSnapshot.state,
        nextSnapshot.d1FinalizedIncomplete,
        nextSnapshot.d7Outcome,
        shouldSetPractice,
        projection?.status ?? null,
        projection?.knowledgeState ?? null,
        projection?.progressState ?? null,
        normalizedTransitionedAt,
      ],
    },
    {
      text: recallScheduleReadQuery('$3::integer'),
      params: [userId, knowledgeItemId, expected.itemVersion],
    },
  ]);

  if (updated.rows[0]) {
    return { kind: 'applied', schedule: mapRecallScheduleRow(updated.rows[0]) };
  }
  if (!current.rows[0]) return { kind: 'not_found', schedule: null };

  const currentSchedule = mapRecallScheduleRow(current.rows[0]);
  const replayPractice = desiredPractice(
    expected.practice,
    decision.practiceProjection,
    normalizedTransitionedAt,
  );
  const replayPracticeMatches = decision.practiceProjection.action === 'preserve'
    || practiceEquals(currentSchedule.practice, replayPractice);
  if (currentSchedule.itemVersion === expected.itemVersion
    && currentSchedule.scheduleVersion === expected.scheduleVersion + 1
    && snapshotEquals(currentSchedule.snapshot, nextSnapshot)
    && replayPracticeMatches) {
    return { kind: 'unchanged', schedule: currentSchedule };
  }
  return { kind: 'conflict', schedule: currentSchedule };
}

export async function cancelRecallScheduleForItem(
  userId: string,
  knowledgeItemId: string,
  expectedScheduleVersion: number,
): Promise<RecallCancellationPersistenceResult> {
  requirePositiveInteger(expectedScheduleVersion, 'expectedScheduleVersion');
  const [, deleted, cleared, probe] = await db.accountTransaction<RecallCancellationRow>(userId, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [recallItemLockKey(userId, knowledgeItemId)],
    },
    {
      text: `DELETE FROM user_private_card_states s
      USING user_knowledge_items i
      WHERE s.user_id = $1
        AND s.knowledge_item_id = $2
        AND s.recall_schedule_version = $3
        AND i.id = s.knowledge_item_id
        AND i.user_id = s.user_id
        AND i.user_id = $1
        AND s.status IS NULL
        AND s.knowledge_state IS NULL
        AND s.progress_state IS NULL
        AND s.last_seen IS NULL
      RETURNING s.knowledge_item_id, FALSE AS retained_practice`,
      params: [userId, knowledgeItemId, expectedScheduleVersion],
    },
    {
      text: `UPDATE user_private_card_states s
      SET recall_enrolled_at = NULL,
          recall_item_version = NULL,
          recall_schedule_state = NULL,
          recall_d1_finalized_incomplete = NULL,
          recall_d7_outcome = NULL,
          recall_schedule_version = NULL
      FROM user_knowledge_items i
      WHERE s.user_id = $1
        AND s.knowledge_item_id = $2
        AND s.recall_schedule_version = $3
        AND i.id = s.knowledge_item_id
        AND i.user_id = s.user_id
        AND i.user_id = $1
        AND s.status IS NOT NULL
        AND s.knowledge_state IS NOT NULL
        AND s.progress_state IS NOT NULL
        AND s.last_seen IS NOT NULL
      RETURNING s.knowledge_item_id, TRUE AS retained_practice`,
      params: [userId, knowledgeItemId, expectedScheduleVersion],
    },
    {
      text: `SELECT
        i.id AS owner_item_id,
        s.knowledge_item_id AS state_row_item_id,
        s.recall_item_version AS item_version,
        s.recall_schedule_version AS schedule_version,
        s.recall_enrolled_at,
        s.recall_schedule_state,
        s.due_at,
        s.recall_d1_finalized_incomplete,
        s.recall_d7_outcome,
        s.status,
        s.knowledge_state,
        s.progress_state,
        s.last_seen
      FROM user_knowledge_items i
      LEFT JOIN user_private_card_states s
        ON s.user_id = i.user_id
       AND s.knowledge_item_id = i.id
      WHERE i.id = $2
        AND i.user_id = $1
      LIMIT 1`,
      params: [userId, knowledgeItemId],
    },
  ]);

  if (deleted.rows[0]) return { kind: 'cancelled', retainedPractice: false };
  if (cleared.rows[0]) return { kind: 'cancelled', retainedPractice: true };
  const probeRow = probe.rows[0];
  if (!probeRow?.owner_item_id) return { kind: 'not_found', schedule: null };
  if (!probeRow.recall_enrolled_at) {
    return { kind: 'unchanged', retainedPractice: Boolean(probeRow.state_row_item_id) };
  }
  return { kind: 'conflict', schedule: mapRecallScheduleRow(probeRow as RecallScheduleRow) };
}
