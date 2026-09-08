import assert from 'node:assert/strict';
import test from 'node:test';
import {
  requestRecallSnooze,
  rollRecallWindow,
  type RecallInstant,
  type RecallScheduleDecision,
  type RecallScheduleSnapshot,
} from '@stem-brain/shared';
import db from '@/lib/db';
import {
  cancelRecallScheduleForItem,
  enrollApprovedRecallScheduleForUser,
  getRecallScheduleForUser,
  persistRecallScheduleDecisionForUser,
  type RecallCancellationExpectation,
  type PersistedRecallPractice,
  type PersistedRecallSchedule,
} from './recall-persistence';

const USER_ID = 'user_recall_owner';
const ITEM_ID = 'recall-item-1';
const ENROLLED_AT = '2026-09-01T00:00:00.000Z';
const D1_DUE_AT = '2026-09-02T06:00:00.000Z';
const D1_RETRY_AT = '2026-09-03T12:00:00.000Z';
const D7_DUE_AT = '2026-09-08T06:00:00.000Z';
const ORDINARY_DUE_AT = '2026-09-22T07:00:00.000Z';

const EMPTY_PRACTICE: PersistedRecallPractice = {
  status: null,
  knowledgeState: null,
  progressState: null,
  lastSeen: null,
};

function snapshot(overrides: Partial<RecallScheduleSnapshot> = {}): RecallScheduleSnapshot {
  return {
    enrolledAt: ENROLLED_AT,
    state: 'd1_pending',
    dueAt: D1_DUE_AT,
    d1FinalizedIncomplete: false,
    d7Outcome: null,
    ...overrides,
  };
}

function persistedSchedule(
  overrides: Partial<Omit<PersistedRecallSchedule, 'snapshot' | 'practice'>> & {
    snapshot?: RecallScheduleSnapshot;
    practice?: PersistedRecallPractice;
  } = {},
): PersistedRecallSchedule {
  return {
    knowledgeItemId: ITEM_ID,
    itemVersion: 1,
    scheduleVersion: 1,
    snapshot: snapshot(),
    practice: EMPTY_PRACTICE,
    ...overrides,
  };
}

function cancellationExpectation(
  schedule: PersistedRecallSchedule = persistedSchedule(),
): RecallCancellationExpectation {
  return {
    itemVersion: schedule.itemVersion,
    scheduleVersion: schedule.scheduleVersion,
    enrolledAt: schedule.snapshot.enrolledAt,
  };
}

function scheduleRow(schedule: PersistedRecallSchedule = persistedSchedule()) {
  return {
    knowledge_item_id: schedule.knowledgeItemId,
    item_version: schedule.itemVersion,
    schedule_version: schedule.scheduleVersion,
    recall_enrolled_at: schedule.snapshot.enrolledAt,
    recall_schedule_state: schedule.snapshot.state,
    due_at: schedule.snapshot.dueAt,
    recall_d1_finalized_incomplete: schedule.snapshot.d1FinalizedIncomplete,
    recall_d7_outcome: schedule.snapshot.d7Outcome,
    status: schedule.practice.status,
    knowledge_state: schedule.practice.knowledgeState,
    progress_state: schedule.practice.progressState,
    last_seen: schedule.practice.lastSeen,
  };
}

test('enrolls only an active, current, approved typed conversation item and returns no content', async (context) => {
  const original = db.accountTransaction;
  let transactionUserId = '';
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, inputQueries) => {
    transactionUserId = userId;
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [scheduleRow()] },
      { rows: [] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await enrollApprovedRecallScheduleForUser(
    USER_ID,
    ITEM_ID,
    1,
    ENROLLED_AT,
    D1_DUE_AT,
  );

  assert.equal(result.kind, 'enrolled');
  assert.deepEqual(result.schedule, persistedSchedule());
  assert.deepEqual(Object.keys(result.schedule ?? {}).sort(), [
    'itemVersion',
    'knowledgeItemId',
    'practice',
    'scheduleVersion',
    'snapshot',
  ]);
  assert.equal(transactionUserId, USER_ID);
  assert.equal(queries.length, 3);
  assert.match(queries[0]!.text, /pg_advisory_xact_lock/);
  assert.deepEqual(queries[0]!.params, [`recall-schedule:${USER_ID}:${ITEM_ID}`]);

  const enrollmentSql = queries[1]!.text;
  assert.match(enrollmentSql, /INSERT INTO user_private_card_states AS s/);
  assert.match(enrollmentSql, /i\.user_id = \$1/);
  assert.match(enrollmentSql, /i\.id = \$2/);
  assert.match(enrollmentSql, /i\.version = \$3::integer/);
  assert.match(enrollmentSql, /i\.knowledge_type IN \('concept', 'procedure', 'comparison'\)/);
  assert.match(enrollmentSql, /i\.bundle_schema_version = 1/);
  assert.match(enrollmentSql, /d\.status = 'approved'/);
  assert.match(enrollmentSql, /d\.approved_at IS NOT NULL/);
  assert.match(enrollmentSql, /b\.scope = 'current_conversation'/);
  assert.match(enrollmentSql, /b\.status IN \('partial', 'approved'\)/);
  assert.match(enrollmentSql, /src\.supported_item_version = i\.version/);
  assert.match(enrollmentSql, /i\.archived_at IS NULL/);
  assert.match(enrollmentSql, /i\.deleted_at IS NULL/);
  assert.match(enrollmentSql, /i\.purge_at IS NULL/);
  assert.match(enrollmentSql, /knowledge_item_supersessions/);
  assert.match(enrollmentSql, /NULL,\s*NULL,\s*NULL,\s*\$5::timestamptz,\s*NULL,/);
  assert.doesNotMatch(enrollmentSql, /i\.title|i\.content|source_url|source_locator/);
});

test('enrollment preserves an existing assessed Practice projection and duplicate enrollment is unchanged', async (context) => {
  const original = db.accountTransaction;
  const assessed = persistedSchedule({
    practice: {
      status: 'saved',
      knowledgeState: 'unknown',
      progressState: 'learning',
      lastSeen: '2026-09-01T10:00:00.000Z',
    },
  });
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [] },
      { rows: [scheduleRow(assessed)] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await enrollApprovedRecallScheduleForUser(
    USER_ID,
    ITEM_ID,
    1,
    ENROLLED_AT,
    D1_DUE_AT,
  );

  assert.deepEqual(result, { kind: 'unchanged', schedule: assessed });
  const conflictClause = queries[1]!.text.slice(queries[1]!.text.indexOf('ON CONFLICT'));
  assert.match(conflictClause, /WHERE s\.recall_enrolled_at IS NULL/);
  assert.doesNotMatch(conflictClause, /status\s*=/);
  assert.doesNotMatch(conflictClause, /knowledge_state\s*=/);
  assert.doesNotMatch(conflictClause, /progress_state\s*=/);
  assert.doesNotMatch(conflictClause, /last_seen\s*=/);
});

test('owner-scoped reads require the current approved source version and expose only schedule metadata', async (context) => {
  const original = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = original; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [scheduleRow()] };
  }) as typeof db.query;

  const result = await getRecallScheduleForUser(USER_ID, ITEM_ID);
  assert.deepEqual(result, persistedSchedule());
  assert.deepEqual(calls[0]?.params, [USER_ID, ITEM_ID]);
  assert.match(calls[0]?.text ?? '', /s\.user_id = \$1/);
  assert.match(calls[0]?.text ?? '', /s\.knowledge_item_id = \$2/);
  assert.match(calls[0]?.text ?? '', /s\.recall_item_version = i\.version/);
  assert.match(calls[0]?.text ?? '', /i\.version = s\.recall_item_version/);
  assert.match(calls[0]?.text ?? '', /src\.supported_item_version = i\.version/);
  assert.doesNotMatch(calls[0]?.text ?? '', /i\.title|i\.content|source_url|source_locator/);
});

test('applies a preserve decision with a full schedule snapshot CAS', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule();
  const decision: RecallScheduleDecision = {
    snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
    practiceProjection: { action: 'preserve' },
  };
  const applied = persistedSchedule({
    scheduleVersion: 2,
    snapshot: decision.snapshot,
  });
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [scheduleRow(applied)] },
      { rows: [scheduleRow(applied)] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    D1_DUE_AT,
  );

  assert.deepEqual(result, { kind: 'applied', schedule: applied });
  const update = queries[1]!;
  assert.match(update.text, /s\.recall_schedule_version = \$4/);
  assert.match(update.text, /s\.recall_enrolled_at = \$5::timestamptz/);
  assert.match(update.text, /s\.recall_schedule_state = \$6/);
  assert.match(update.text, /s\.due_at = \$7::timestamptz/);
  assert.match(update.text, /s\.recall_d1_finalized_incomplete = \$8/);
  assert.match(update.text, /s\.recall_d7_outcome IS NOT DISTINCT FROM \$9::text/);
  assert.match(update.text, /NOT \$18::boolean/);
  assert.match(update.text, /s\.status IS NOT DISTINCT FROM \$10::text/);
  assert.match(update.text, /date_trunc\('milliseconds', s\.last_seen\)/);
  assert.match(update.text, /recall_schedule_version = s\.recall_schedule_version \+ 1/);
  assert.equal(update.params?.[17], false);
  assert.equal(update.params?.[21], null);
});

test('persists a late D+7 rollover whose preferred delivery is already due', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule({
    scheduleVersion: 2,
    snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
  });
  const rolloverAt = '2026-09-08T02:00:00.000Z';
  const decision = rollRecallWindow(expected.snapshot, {
    at: rolloverAt,
    nextD7DeliveryAt: '2026-09-08T01:00:00.000Z',
  });
  const applied = persistedSchedule({
    scheduleVersion: 3,
    snapshot: decision.snapshot,
  });
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => [
    { rows: [] },
    { rows: [scheduleRow(applied)] },
    { rows: [scheduleRow(applied)] },
  ] as never) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    rolloverAt,
  );

  assert.deepEqual(result, { kind: 'applied', schedule: applied });
  assert.ok(new Date(decision.snapshot.dueAt) < new Date(rolloverAt));
});

test('persists a D+7 snooze that closes at the milestone boundary', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule({
    scheduleVersion: 2,
    snapshot: snapshot({ state: 'd7_pending', dueAt: D7_DUE_AT }),
  });
  const snoozedAt = '2026-09-08T23:30:00.000Z';
  const decision = requestRecallSnooze(expected.snapshot, {
    at: snoozedAt,
    alreadySnoozed: false,
  });
  const applied = persistedSchedule({
    scheduleVersion: 3,
    snapshot: decision.snapshot,
  });
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => [
    { rows: [] },
    { rows: [scheduleRow(applied)] },
    { rows: [scheduleRow(applied)] },
  ] as never) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    snoozedAt,
  );

  assert.equal(decision.kind, 'cancelled_for_boundary');
  assert.deepEqual(result, { kind: 'applied', schedule: applied });
});

test('atomically writes a one-shot Practice projection and transition instant', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule({
    scheduleVersion: 4,
    snapshot: snapshot({ state: 'd7_pending', dueAt: D7_DUE_AT }),
    practice: {
      status: 'saved',
      knowledgeState: 'unknown',
      progressState: 'learning',
      lastSeen: '2026-09-02T08:00:00.000Z',
    },
  });
  const transitionedAt = '2026-09-08T07:00:00.000Z';
  const decision: RecallScheduleDecision = {
    snapshot: snapshot({
      state: 'ordinary_practice',
      dueAt: ORDINARY_DUE_AT,
      d7Outcome: 'remembered',
    }),
    practiceProjection: {
      action: 'set',
      status: 'known',
      knowledgeState: 'known',
      progressState: 'review',
    },
  };
  const applied = persistedSchedule({
    scheduleVersion: 5,
    snapshot: decision.snapshot,
    practice: {
      status: 'known',
      knowledgeState: 'known',
      progressState: 'review',
      lastSeen: transitionedAt,
    },
  });
  let updateSql = '';
  let updateParams: unknown[] | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, queries) => {
    updateSql = queries[1]!.text;
    updateParams = queries[1]!.params;
    return [
      { rows: [] },
      { rows: [scheduleRow(applied)] },
      { rows: [scheduleRow(applied)] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    transitionedAt,
  );

  assert.deepEqual(result, { kind: 'applied', schedule: applied });
  assert.match(updateSql, /NOT \$18::boolean\s+OR/);
  assert.deepEqual(updateParams?.slice(9, 13), [
    'saved',
    'unknown',
    'learning',
    '2026-09-02T08:00:00.000Z',
  ]);
  assert.deepEqual(updateParams?.slice(17), [
    true,
    'known',
    'known',
    'review',
    transitionedAt,
  ]);
});

test('does not overwrite a concurrent manual Practice projection', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule();
  const concurrent = persistedSchedule({
    practice: {
      status: 'known',
      knowledgeState: 'known',
      progressState: 'review',
      lastSeen: '2026-09-02T05:30:00.000Z',
    },
  });
  const decision: RecallScheduleDecision = {
    snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
    practiceProjection: {
      action: 'set',
      status: 'saved',
      knowledgeState: 'unknown',
      progressState: 'learning',
    },
  };
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => [
    { rows: [] },
    { rows: [] },
    { rows: [scheduleRow(concurrent)] },
  ] as never) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    '2026-09-02T06:30:00.000Z',
  );

  assert.deepEqual(result, { kind: 'conflict', schedule: concurrent });
});

test('recognizes an identical CAS replay but reports a different winner as a conflict', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule();
  const decision: RecallScheduleDecision = {
    snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
    practiceProjection: { action: 'preserve' },
  };
  const replayed = persistedSchedule({ scheduleVersion: 2, snapshot: decision.snapshot });
  let current = replayed;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => [
    { rows: [] },
    { rows: [] },
    { rows: [scheduleRow(current)] },
  ] as never) as typeof db.accountTransaction;

  const replay = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    D1_DUE_AT,
  );
  assert.deepEqual(replay, { kind: 'unchanged', schedule: replayed });

  current = persistedSchedule({
    scheduleVersion: 2,
    snapshot: snapshot({ state: 'd7_pending', dueAt: D7_DUE_AT }),
  });
  const conflict = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    D1_DUE_AT,
  );
  assert.deepEqual(conflict, { kind: 'conflict', schedule: current });
});

test('a preserve replay remains idempotent after an independent Practice update', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule();
  const decision: RecallScheduleDecision = {
    snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
    practiceProjection: { action: 'preserve' },
  };
  const current = persistedSchedule({
    scheduleVersion: 2,
    snapshot: decision.snapshot,
    practice: {
      status: 'known',
      knowledgeState: 'known',
      progressState: 'review',
      lastSeen: '2026-09-02T07:00:00.000Z',
    },
  });
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => [
    { rows: [] },
    { rows: [] },
    { rows: [scheduleRow(current)] },
  ] as never) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    decision,
    D1_DUE_AT,
  );
  assert.deepEqual(result, { kind: 'unchanged', schedule: current });
});

test('an unchanged preserve decision verifies current state without incrementing its version', async (context) => {
  const original = db.accountTransaction;
  const expected = persistedSchedule();
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [scheduleRow(expected)] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await persistRecallScheduleDecisionForUser(
    USER_ID,
    ITEM_ID,
    expected,
    {
      snapshot: expected.snapshot,
      practiceProjection: { action: 'preserve' },
    },
    D1_DUE_AT,
  );

  assert.deepEqual(result, { kind: 'unchanged', schedule: expected });
  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => !/\bUPDATE\b/.test(query.text)));
});

test('rejects invalid snapshots and projection writes before opening a transaction', async (context) => {
  const original = db.accountTransaction;
  let calls = 0;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => {
    calls += 1;
    return [] as never;
  }) as typeof db.accountTransaction;

  const expected = persistedSchedule();
  await assert.rejects(
    persistRecallScheduleDecisionForUser(USER_ID, ITEM_ID, expected, {
      snapshot: snapshot({ state: 'd7_pending' }),
      practiceProjection: { action: 'preserve' },
    }, D1_DUE_AT),
    /d7_pending must stay inside the D\+7 window/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(USER_ID, ITEM_ID, expected, {
      snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
      practiceProjection: {
        action: 'set',
        status: 'saved',
        knowledgeState: 'unknown',
        progressState: 'learning',
      },
    }, undefined as unknown as RecallInstant),
    /Invalid transitionedAt/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(USER_ID, ITEM_ID, expected, {
      snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
      practiceProjection: { action: 'preserve' },
    }, D1_RETRY_AT),
    /scheduled after its event/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(
      USER_ID,
      ITEM_ID,
      persistedSchedule({
        snapshot: snapshot({ state: 'd7_pending', dueAt: D7_DUE_AT }),
      }),
      {
        snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
        practiceProjection: { action: 'preserve' },
      },
      D7_DUE_AT,
    ),
    /move its due instant forward|cannot transition/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(USER_ID, ITEM_ID, expected, {
      snapshot: snapshot({
        state: 'ordinary_practice',
        dueAt: ORDINARY_DUE_AT,
        d1FinalizedIncomplete: true,
        d7Outcome: 'remembered',
      }),
      practiceProjection: { action: 'preserve' },
    }, '2026-09-09T00:00:00.000Z'),
    /only after an unassessed D\+7 close/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(
      USER_ID,
      ITEM_ID,
      persistedSchedule({
        snapshot: snapshot({ state: 'd7_pending', dueAt: D7_DUE_AT }),
      }),
      {
        snapshot: snapshot({
          state: 'ordinary_practice',
          dueAt: ORDINARY_DUE_AT,
          d7Outcome: 'remembered',
        }),
        practiceProjection: {
          action: 'set',
          status: 'saved',
          knowledgeState: 'unknown',
          progressState: 'learning',
        },
      },
      '2026-09-08T07:00:00.000Z',
    ),
    /does not match its Practice projection/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(USER_ID, ITEM_ID, expected, {
      snapshot: snapshot({ state: 'd1_retry', dueAt: D1_RETRY_AT }),
      practiceProjection: { action: 'preserve' },
    }, '2026-09-02T05:59:59.999Z'),
    /cannot precede its current due instant/,
  );
  await assert.rejects(
    persistRecallScheduleDecisionForUser(
      USER_ID,
      ITEM_ID,
      persistedSchedule({
        snapshot: snapshot({ state: 'd7_pending', dueAt: D7_DUE_AT }),
      }),
      {
        snapshot: snapshot({
          state: 'ordinary_practice',
          dueAt: '2026-09-22T08:00:00.000Z',
          d7Outcome: 'remembered',
        }),
        practiceProjection: {
          action: 'set',
          status: 'known',
          knowledgeState: 'known',
          progressState: 'review',
        },
      },
      '2026-09-08T07:00:00.000Z',
    ),
    /returns 14 days after its assessment/,
  );
  assert.equal(calls, 0);
});

test('cancellation deletes an unassessed row and clears only Recall fields for assessed Practice', async (context) => {
  const original = db.accountTransaction;
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  let assessed = false;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return assessed
      ? [
          { rows: [] },
          { rows: [] },
          { rows: [{ knowledge_item_id: ITEM_ID, retained_practice: true }] },
          { rows: [] },
        ] as never
      : [
          { rows: [] },
          { rows: [{ knowledge_item_id: ITEM_ID, retained_practice: false }] },
          { rows: [] },
          { rows: [] },
        ] as never;
  }) as typeof db.accountTransaction;

  const deleted = await cancelRecallScheduleForItem(
    USER_ID,
    ITEM_ID,
    cancellationExpectation(),
  );
  assert.deepEqual(deleted, { kind: 'cancelled', retainedPractice: false });
  assert.match(queries[0]!.text, /pg_advisory_xact_lock/);
  assert.match(queries[1]!.text, /DELETE FROM user_private_card_states s/);
  assert.match(queries[1]!.text, /s\.status IS NULL/);
  assert.match(queries[1]!.text, /s\.last_seen IS NULL/);
  assert.doesNotMatch(
    queries[1]!.text,
    /archived_at|deleted_at|purge_at|supported_item_version|knowledge_item_supersessions/,
  );
  assert.doesNotMatch(queries[1]!.text, /s\.recall_item_version = i\.version/);
  assert.match(queries[1]!.text, /s\.recall_item_version = \$3/);
  assert.match(queries[1]!.text, /s\.recall_schedule_version = \$4/);
  assert.match(queries[1]!.text, /s\.recall_enrolled_at = \$5::timestamptz/);
  assert.deepEqual(queries[1]!.params, [USER_ID, ITEM_ID, 1, 1, ENROLLED_AT]);

  assessed = true;
  const cleared = await cancelRecallScheduleForItem(
    USER_ID,
    ITEM_ID,
    cancellationExpectation(),
  );
  assert.deepEqual(cleared, { kind: 'cancelled', retainedPractice: true });
  const clearSql = queries[2]!.text;
  assert.match(clearSql, /SET recall_enrolled_at = NULL/);
  assert.match(clearSql, /recall_schedule_version = NULL/);
  const setClause = clearSql.slice(clearSql.indexOf('SET'), clearSql.indexOf('FROM user_knowledge_items'));
  assert.doesNotMatch(setClause, /\bstatus\s*=/);
  assert.doesNotMatch(setClause, /knowledge_state\s*=/);
  assert.doesNotMatch(setClause, /progress_state\s*=/);
  assert.doesNotMatch(setClause, /due_at\s*=/);
  assert.doesNotMatch(setClause, /last_seen\s*=/);
  assert.doesNotMatch(
    clearSql,
    /archived_at|deleted_at|purge_at|supported_item_version|knowledge_item_supersessions/,
  );
  assert.doesNotMatch(clearSql, /s\.recall_item_version = i\.version/);
  assert.match(clearSql, /s\.recall_item_version = \$3/);
  assert.match(clearSql, /s\.recall_schedule_version = \$4/);
  assert.match(clearSql, /s\.recall_enrolled_at = \$5::timestamptz/);
  assert.deepEqual(queries[2]!.params, [USER_ID, ITEM_ID, 1, 1, ENROLLED_AT]);
});

test('cancellation stays owner-scoped and rejects stale versions or enrollment generations', async (context) => {
  const original = db.accountTransaction;
  const active = persistedSchedule({ scheduleVersion: 2 });
  const replacement = persistedSchedule({
    snapshot: snapshot({
      enrolledAt: '2026-09-02T00:00:00.000Z',
      dueAt: '2026-09-03T06:00:00.000Z',
    }),
  });
  let conflict = false;
  let conflictSchedule = active;
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return conflict
      ? [
          { rows: [] },
          { rows: [] },
          { rows: [] },
          { rows: [{
            owner_item_id: ITEM_ID,
            ...scheduleRow(conflictSchedule),
          }] },
        ] as never
      : [
          { rows: [] },
          { rows: [] },
          { rows: [] },
          { rows: [{ owner_item_id: ITEM_ID, knowledge_item_id: null }] },
        ] as never;
  }) as typeof db.accountTransaction;

  const expected = cancellationExpectation();
  const replay = await cancelRecallScheduleForItem(USER_ID, ITEM_ID, expected);
  assert.deepEqual(replay, { kind: 'unchanged', retainedPractice: false });

  const ownerProbeSql = queries[3]!.text;
  assert.match(ownerProbeSql, /i\.user_id = \$1/);
  assert.match(ownerProbeSql, /s\.knowledge_item_id,/);
  assert.doesNotMatch(ownerProbeSql, /state_row_item_id/);
  assert.doesNotMatch(ownerProbeSql, /archived_at|deleted_at|purge_at|knowledge_item_supersessions/);
  assert.doesNotMatch(ownerProbeSql, /supported_item_version|i\.version = s\.recall_item_version/);

  conflict = true;
  const stale = await cancelRecallScheduleForItem(USER_ID, ITEM_ID, expected);
  assert.deepEqual(stale, { kind: 'conflict', schedule: active });

  conflictSchedule = replacement;
  const delayed = await cancelRecallScheduleForItem(USER_ID, ITEM_ID, expected);
  assert.deepEqual(delayed, { kind: 'conflict', schedule: replacement });
  assert.equal(delayed.schedule.scheduleVersion, expected.scheduleVersion);
  assert.equal(delayed.schedule.itemVersion, expected.itemVersion);
  assert.notEqual(delayed.schedule.snapshot.enrolledAt, expected.enrolledAt);
});
