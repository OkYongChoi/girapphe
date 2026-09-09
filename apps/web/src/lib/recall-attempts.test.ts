import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import db from '@/lib/db';
import {
  completeRecallAttemptForUser,
  invalidateStaleRecallAttemptForUser,
  purgeExpiredRecallAttempts,
  resumeRecallAttemptForUser,
  revealRecallAttemptForUser,
  setRecallAttemptConfidenceForUser,
  startOrResumeRecallAttemptForUser,
  type PersistedCompletedRecallAttempt,
  type PersistedRecallAttempt,
} from './recall-attempts';

const USER_ID = 'user_recall_attempt_owner';
const ITEM_ID = 'recall-attempt-item';
const ATTEMPT_ID = 'b3f04fc6-4573-4cb0-9d15-09ce2fc0dd73';
const ENROLLED_AT = '2026-09-01T00:00:00.000Z';
const STARTED_AT = '2026-09-02T06:00:00.000Z';
const CONFIDENCE_AT = '2026-09-02T06:01:00.000Z';
const REVEALED_AT = '2026-09-02T06:02:00.000Z';
const COMPLETED_AT = '2026-09-02T06:03:00.000Z';
const D1_DUE_AT = '2026-09-02T06:00:00.000Z';
const D7_DUE_AT = '2026-09-08T06:00:00.000Z';

function attempt(
  overrides: Partial<PersistedRecallAttempt> = {},
): PersistedRecallAttempt {
  return {
    id: ATTEMPT_ID,
    knowledgeItemId: ITEM_ID,
    itemVersion: 1,
    scheduleVersion: 1,
    enrolledAt: ENROLLED_AT,
    milestone: 'd1',
    exerciseType: 'concept',
    state: 'prepared',
    confidence: null,
    startedAt: STARTED_AT,
    confidenceSelectedAt: null,
    revealedAt: null,
    ...overrides,
  };
}

function attemptRow(
  value: PersistedRecallAttempt | PersistedCompletedRecallAttempt = attempt(),
) {
  return {
    id: value.id,
    knowledge_item_id: value.knowledgeItemId,
    item_version: value.itemVersion,
    schedule_version: value.scheduleVersion,
    recall_enrolled_at: value.enrolledAt,
    milestone: value.milestone,
    exercise_type: value.exerciseType,
    lifecycle_state: value.state,
    confidence: value.confidence,
    started_at: value.startedAt,
    confidence_selected_at: value.confidenceSelectedAt,
    revealed_at: value.revealedAt,
  };
}

function completedAttempt(
  overrides: Partial<PersistedCompletedRecallAttempt> = {},
): PersistedCompletedRecallAttempt {
  return {
    ...attempt({
      state: 'revealed',
      confidence: 'medium',
      confidenceSelectedAt: CONFIDENCE_AT,
      revealedAt: REVEALED_AT,
    }),
    state: 'completed',
    confidence: 'medium',
    confidenceSelectedAt: CONFIDENCE_AT,
    revealedAt: REVEALED_AT,
    selfAssessedOutcome: 'partial',
    hintUsed: true,
    responseDurationBucket: '30_to_89s',
    completedAt: COMPLETED_AT,
    resultingDueAt: D7_DUE_AT,
    ...overrides,
  };
}

function completedAttemptRow(
  value: PersistedCompletedRecallAttempt = completedAttempt(),
) {
  return {
    ...attemptRow(value),
    self_assessed_outcome: value.selfAssessedOutcome,
    hint_used: value.hintUsed,
    response_duration_bucket: value.responseDurationBucket,
    completed_at: value.completedAt,
    resulting_due_at: value.resultingDueAt,
  };
}

function completionContextRow(
  value: PersistedRecallAttempt = attempt({
    state: 'revealed',
    confidence: 'medium',
    confidenceSelectedAt: CONFIDENCE_AT,
    revealedAt: REVEALED_AT,
  }),
  overrides: Record<string, unknown> = {},
) {
  return {
    ...attemptRow(value),
    transition_at: COMPLETED_AT,
    schedule_state: value.milestone === 'd1' ? 'd1_pending' : 'd7_pending',
    schedule_due_at: D1_DUE_AT,
    schedule_d1_finalized_incomplete: false,
    schedule_d7_outcome: null,
    practice_status: null,
    practice_knowledge_state: null,
    practice_progress_state: null,
    practice_last_seen: null,
    ...overrides,
  };
}

test('starts a content-free attempt only from a server-due, current eligible schedule', async (context) => {
  const original = db.accountTransaction;
  let transactionUserId = '';
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, inputQueries) => {
    transactionUserId = userId;
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [] },
      { rows: [attemptRow()] },
      { rows: [attemptRow()] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await startOrResumeRecallAttemptForUser(USER_ID, ITEM_ID);

  assert.deepEqual(result, { kind: 'started', attempt: attempt() });
  assert.deepEqual(Object.keys(result.attempt).sort(), [
    'confidence',
    'confidenceSelectedAt',
    'enrolledAt',
    'exerciseType',
    'id',
    'itemVersion',
    'knowledgeItemId',
    'milestone',
    'revealedAt',
    'scheduleVersion',
    'startedAt',
    'state',
  ]);
  assert.equal(transactionUserId, USER_ID);
  assert.equal(queries.length, 4);
  assert.deepEqual(queries[0]!.params, [`recall-schedule:${USER_ID}:${ITEM_ID}`]);

  const insert = queries[2]!;
  assert.match(insert.text, /INSERT INTO recall_attempts AS a/);
  assert.match(insert.text, /s\.due_at <= NOW\(\)/);
  assert.match(insert.text, /NOW\(\) < s\.recall_enrolled_at \+ INTERVAL '168 hours'/);
  assert.match(insert.text, /NOW\(\) < s\.recall_enrolled_at \+ INTERVAL '192 hours'/);
  assert.match(insert.text, /s\.recall_item_version/);
  assert.match(insert.text, /s\.recall_schedule_version/);
  assert.match(insert.text, /src\.supported_item_version = i\.version/);
  assert.match(insert.text, /i\.knowledge_type IN \('concept', 'procedure', 'comparison'\)/);
  assert.match(insert.text, /b\.scope = 'current_conversation'/);
  assert.match(insert.text, /ON CONFLICT \(user_id, knowledge_item_id, item_version, milestone\)/);
  assert.equal(insert.params?.length, 3);
  assert.equal(insert.params?.[0], USER_ID);
  assert.equal(insert.params?.[1], ITEM_ID);
  assert.match(String(insert.params?.[2]), /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(
    insert.text,
    /i\.(?:title|summary|content)|source_url|source_locator|conversation_ref/,
  );
});

test('resumes the one active attempt instead of creating a cross-device duplicate', async (context) => {
  const original = db.accountTransaction;
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [attemptRow()] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await startOrResumeRecallAttemptForUser(USER_ID, ITEM_ID);

  assert.deepEqual(result, { kind: 'resumed', attempt: attempt() });
  assert.match(queries[1]!.text, /UPDATE recall_attempts a/);
  assert.match(queries[1]!.text, /invalidation_reason = 'stale_context'/);
  assert.match(queries[3]!.text, /a\.lifecycle_state IN \('prepared', 'confidence_selected', 'revealed'\)/);
});

test('resume takes the schedule lock and invalidates stale item or schedule generations', async (context) => {
  const original = db.accountTransaction;
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [{ id: ATTEMPT_ID, lifecycle_state: 'invalidated' }] },
      { rows: [] },
      { rows: [{ lifecycle_state: 'invalidated' }] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await resumeRecallAttemptForUser(USER_ID, ATTEMPT_ID);

  assert.deepEqual(result, { kind: 'invalidated', attempt: null });
  assert.deepEqual(queries[0]!.params, [USER_ID, ATTEMPT_ID, 'recall-schedule']);
  assert.match(queries[0]!.text, /a\.user_id = \$1/);
  assert.match(queries[0]!.text, /a\.id = \$2/);
  const invalidation = queries[1]!.text;
  assert.match(invalidation, /s\.due_at <= NOW\(\)/);
  assert.match(invalidation, /s\.recall_item_version = a\.item_version/);
  assert.match(invalidation, /s\.recall_schedule_version = a\.schedule_version/);
  assert.match(invalidation, /s\.recall_enrolled_at = a\.recall_enrolled_at/);
  assert.match(invalidation, /i\.version = a\.item_version/);
  assert.match(invalidation, /i\.archived_at IS NULL/);
  assert.match(invalidation, /i\.deleted_at IS NULL/);
  assert.match(invalidation, /knowledge_item_supersessions/);
  assert.match(invalidation, /src\.supported_item_version = i\.version/);
});

test('explicit stale validation returns current metadata without private content', async (context) => {
  const original = db.accountTransaction;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => [
    { rows: [] },
    { rows: [] },
    { rows: [attemptRow()] },
    { rows: [attemptRow()] },
  ] as never) as typeof db.accountTransaction;

  assert.deepEqual(
    await invalidateStaleRecallAttemptForUser(USER_ID, ATTEMPT_ID),
    { kind: 'current', attempt: attempt() },
  );
});

test('confidence is server-persisted before reveal and identical retries are unchanged', async (context) => {
  const original = db.accountTransaction;
  const selected = attempt({
    state: 'confidence_selected',
    confidence: 'medium',
    confidenceSelectedAt: CONFIDENCE_AT,
  });
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  let write = true;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [] },
      { rows: write ? [attemptRow(selected)] : [] },
      { rows: [attemptRow(selected)] },
      { rows: [attemptRow(selected)] },
    ] as never;
  }) as typeof db.accountTransaction;

  assert.deepEqual(
    await setRecallAttemptConfidenceForUser(USER_ID, ATTEMPT_ID, 'medium'),
    { kind: 'selected', attempt: selected },
  );
  assert.match(queries[2]!.text, /lifecycle_state = 'confidence_selected'/);
  assert.match(queries[2]!.text, /confidence_selected_at = COALESCE/);
  assert.match(queries[2]!.text, /a\.confidence IS DISTINCT FROM \$3/);
  assert.deepEqual(queries[2]!.params, [USER_ID, ATTEMPT_ID, 'medium']);

  write = false;
  assert.deepEqual(
    await setRecallAttemptConfidenceForUser(USER_ID, ATTEMPT_ID, 'medium'),
    { kind: 'unchanged', attempt: selected },
  );
});

test('invalid confidence is rejected before opening an account transaction', async (context) => {
  const original = db.accountTransaction;
  let calls = 0;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => {
    calls += 1;
    return [] as never;
  }) as typeof db.accountTransaction;

  await assert.rejects(
    setRecallAttemptConfidenceForUser(
      USER_ID,
      ATTEMPT_ID,
      'certain' as unknown as 'high',
    ),
    /Invalid Recall confidence/,
  );
  assert.equal(calls, 0);
});

test('reveal requires confidence and is idempotent without returning answer content', async (context) => {
  const original = db.accountTransaction;
  const revealed = attempt({
    state: 'revealed',
    confidence: 'high',
    confidenceSelectedAt: CONFIDENCE_AT,
    revealedAt: REVEALED_AT,
  });
  let resultRows: ReturnType<typeof attemptRow>[] = [attemptRow(revealed)];
  let currentRows: ReturnType<typeof attemptRow>[] = [attemptRow(revealed)];
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, inputQueries) => {
    queries = inputQueries;
    return [
      { rows: [] },
      { rows: [] },
      { rows: resultRows },
      { rows: currentRows },
      { rows: currentRows },
    ] as never;
  }) as typeof db.accountTransaction;

  assert.deepEqual(
    await revealRecallAttemptForUser(USER_ID, ATTEMPT_ID),
    { kind: 'revealed', attempt: revealed },
  );
  assert.match(queries[2]!.text, /a\.lifecycle_state = 'confidence_selected'/);
  assert.match(queries[2]!.text, /a\.confidence IS NOT NULL/);
  assert.doesNotMatch(
    queries[2]!.text,
    /i\.(?:title|summary|content)|source_url|source_locator|conversation_ref/,
  );

  resultRows = [];
  assert.deepEqual(
    await revealRecallAttemptForUser(USER_ID, ATTEMPT_ID),
    { kind: 'unchanged', attempt: revealed },
  );

  currentRows = [attemptRow(attempt())];
  assert.deepEqual(
    await revealRecallAttemptForUser(USER_ID, ATTEMPT_ID),
    { kind: 'confidence_required', attempt: null },
  );
});

test('completion atomically advances D+1 schedule and stores only server-owned coarse metadata', async (context) => {
  const original = db.accountTransaction;
  const revealed = attempt({
    state: 'revealed',
    confidence: 'medium',
    confidenceSelectedAt: CONFIDENCE_AT,
    revealedAt: REVEALED_AT,
  });
  const completed = completedAttempt();
  const transactions: Parameters<typeof db.accountTransaction>[1][] = [];
  let calls = 0;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, queries) => {
    transactions.push(queries);
    calls += 1;
    if (calls === 1) {
      return [
        { rows: [] },
        { rows: [] },
        { rows: [completionContextRow(revealed)] },
        { rows: [attemptRow(revealed)] },
      ] as never;
    }
    return [
      { rows: [] },
      { rows: [] },
      { rows: [completedAttemptRow(completed)] },
      { rows: [completedAttemptRow(completed)] },
    ] as never;
  }) as typeof db.accountTransaction;

  let resolverContext: unknown;
  const result = await completeRecallAttemptForUser(
    USER_ID,
    ATTEMPT_ID,
    { outcome: 'partial', hintUsed: true },
    async (value) => {
      resolverContext = value;
      return D7_DUE_AT;
    },
  );

  assert.deepEqual(result, { kind: 'completed', attempt: completed });
  assert.deepEqual(resolverContext, {
    userId: USER_ID,
    knowledgeItemId: ITEM_ID,
    itemVersion: 1,
    scheduleVersion: 1,
    enrolledAt: ENROLLED_AT,
    milestone: 'd1',
    completedAt: COMPLETED_AT,
    outcome: 'partial',
  });
  assert.equal(transactions.length, 2);
  const preflightInvalidation = transactions[0]![1]!;
  assert.match(
    preflightInvalidation.text,
    /GREATEST\([\s\S]+CURRENT_TIMESTAMP[\s\S]+a\.revealed_at/,
  );
  assert.match(preflightInvalidation.text, /date_trunc\('milliseconds', GREATEST\(/);
  assert.match(preflightInvalidation.text, /INTERVAL '1 millisecond'/);
  assert.doesNotMatch(preflightInvalidation.text, /s\.due_at <= NOW\(\)/);
  const preflightRead = transactions[0]![2]!.text;
  assert.match(
    preflightRead,
    /GREATEST\([\s\S]+a\.revealed_at[\s\S]+AS transition_at/,
  );
  assert.match(preflightRead, /date_trunc\('milliseconds', GREATEST\(/);
  assert.match(preflightRead, /INTERVAL '1 millisecond'/);
  assert.doesNotMatch(preflightRead, /s\.due_at <= NOW\(\)/);
  assert.doesNotMatch(
    preflightRead,
    /i\.(?:title|summary|content)|source_url|source_locator|conversation_ref/,
  );

  const finalInvalidation = transactions[1]![1]!;
  assert.deepEqual(finalInvalidation.params, [USER_ID, ATTEMPT_ID, COMPLETED_AT]);
  assert.match(finalInvalidation.text, /s\.due_at <= \$3::timestamptz/);
  assert.doesNotMatch(finalInvalidation.text, /s\.due_at <= NOW\(\)/);

  const mutation = transactions[1]![2]!;
  assert.match(mutation.text, /^WITH updated_schedule AS/);
  assert.match(mutation.text, /recall_schedule_version = s\.recall_schedule_version \+ 1/);
  assert.match(mutation.text, /s\.recall_schedule_version = \$4/);
  assert.match(mutation.text, /s\.recall_schedule_state = \$6/);
  assert.match(mutation.text, /s\.due_at = \$7::timestamptz/);
  assert.match(mutation.text, /date_trunc\('milliseconds', s\.last_seen\)/);
  assert.match(mutation.text, /AND s\.due_at <= \$21::timestamptz/);
  assert.match(mutation.text, /completed_attempt AS/);
  assert.match(mutation.text, /FROM updated_schedule/);
  assert.match(mutation.text, /completed_at = \$21::timestamptz/);
  assert.match(mutation.text, /resulting_due_at = updated_schedule\.resulting_due_at/);
  assert.match(mutation.text, /INTERVAL '30 seconds'/);
  assert.match(mutation.text, /INTERVAL '90 seconds'/);
  assert.match(mutation.text, /INTERVAL '180 seconds'/);
  assert.match(mutation.text, /INTERVAL '360 seconds'/);
  assert.doesNotMatch(mutation.text, /retention_expires_at\s*=/);
  assert.deepEqual(mutation.params?.slice(13), [
    D7_DUE_AT,
    'd7_pending',
    true,
    null,
    'saved',
    'unknown',
    'learning',
    COMPLETED_AT,
    'partial',
    true,
  ]);
  assert.deepEqual(Object.keys(result.attempt).sort(), [
    'completedAt',
    'confidence',
    'confidenceSelectedAt',
    'enrolledAt',
    'exerciseType',
    'hintUsed',
    'id',
    'itemVersion',
    'knowledgeItemId',
    'milestone',
    'responseDurationBucket',
    'resultingDueAt',
    'revealedAt',
    'scheduleVersion',
    'selfAssessedOutcome',
    'startedAt',
    'state',
  ]);
});

test('D+7 completion derives its due instant without calling the D+1 resolver', async (context) => {
  const original = db.accountTransaction;
  const d7CompletedAt = '2026-09-08T01:00:00.000Z';
  const ordinaryDueAt = '2026-09-22T01:00:00.000Z';
  const revealed = attempt({
    scheduleVersion: 2,
    milestone: 'd7',
    state: 'revealed',
    confidence: 'high',
    confidenceSelectedAt: '2026-09-08T00:58:00.000Z',
    revealedAt: '2026-09-08T00:59:00.000Z',
  });
  const completed = completedAttempt({
    scheduleVersion: 2,
    milestone: 'd7',
    confidence: 'high',
    confidenceSelectedAt: '2026-09-08T00:58:00.000Z',
    revealedAt: '2026-09-08T00:59:00.000Z',
    selfAssessedOutcome: 'remembered',
    hintUsed: false,
    completedAt: d7CompletedAt,
    resultingDueAt: ordinaryDueAt,
  });
  let calls = 0;
  let resolverCalls = 0;
  let mutationParams: unknown[] | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, queries) => {
    calls += 1;
    if (calls === 1) {
      return [
        { rows: [] },
        { rows: [] },
        {
          rows: [completionContextRow(revealed, {
            transition_at: d7CompletedAt,
            schedule_state: 'd7_pending',
            schedule_due_at: '2026-09-08T00:30:00.000Z',
            practice_status: 'saved',
            practice_knowledge_state: 'unknown',
            practice_progress_state: 'learning',
            practice_last_seen: '2026-09-02T06:03:00.000Z',
          })],
        },
        { rows: [attemptRow(revealed)] },
      ] as never;
    }
    mutationParams = queries[2]!.params;
    return [
      { rows: [] },
      { rows: [] },
      { rows: [completedAttemptRow(completed)] },
      { rows: [completedAttemptRow(completed)] },
    ] as never;
  }) as typeof db.accountTransaction;

  const result = await completeRecallAttemptForUser(
    USER_ID,
    ATTEMPT_ID,
    { outcome: 'remembered', hintUsed: false },
    async () => {
      resolverCalls += 1;
      return D7_DUE_AT;
    },
  );

  assert.deepEqual(result, { kind: 'completed', attempt: completed });
  assert.equal(resolverCalls, 0);
  assert.equal(mutationParams?.[13], ordinaryDueAt);
  assert.equal(mutationParams?.[14], 'ordinary_practice');
  assert.equal(mutationParams?.[17], 'known');
  assert.equal(mutationParams?.[20], d7CompletedAt);
});

test('completion gates active states and replays one immutable semantic result', async (context) => {
  const original = db.accountTransaction;
  const completed = completedAttempt();
  const cases = [
    {
      rows: [completionContextRow(attempt())],
      probe: attemptRow(),
      input: { outcome: 'partial', hintUsed: true } as const,
      kind: 'confidence_required',
    },
    {
      rows: [completionContextRow(attempt({
        state: 'confidence_selected',
        confidence: 'medium',
        confidenceSelectedAt: CONFIDENCE_AT,
      }))],
      probe: attemptRow(),
      input: { outcome: 'partial', hintUsed: true } as const,
      kind: 'reveal_required',
    },
    {
      rows: [],
      probe: completedAttemptRow(completed),
      input: { outcome: 'partial', hintUsed: true } as const,
      kind: 'unchanged',
    },
    {
      rows: [],
      probe: completedAttemptRow(completed),
      input: { outcome: 'missed', hintUsed: true } as const,
      kind: 'conflict',
    },
  ];
  let index = 0;
  let resolverCalls = 0;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => {
    const value = cases[index++]!;
    return [
      { rows: [] },
      { rows: [] },
      { rows: value.rows },
      { rows: [value.probe] },
    ] as never;
  }) as typeof db.accountTransaction;

  for (const value of cases) {
    const result = await completeRecallAttemptForUser(
      USER_ID,
      ATTEMPT_ID,
      value.input,
      async () => {
        resolverCalls += 1;
        return D7_DUE_AT;
      },
    );
    assert.equal(result.kind, value.kind);
    if (value.kind === 'unchanged') assert.deepEqual(result.attempt, completed);
    else assert.equal(result.attempt, null);
  }
  assert.equal(resolverCalls, 0);
});

test('completion validates outcome and hint before opening a transaction', async (context) => {
  const original = db.accountTransaction;
  let calls = 0;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async () => {
    calls += 1;
    return [] as never;
  }) as typeof db.accountTransaction;

  await assert.rejects(
    completeRecallAttemptForUser(
      USER_ID,
      ATTEMPT_ID,
      null as unknown as { outcome: 'remembered'; hintUsed: boolean },
      async () => D7_DUE_AT,
    ),
    /Invalid Recall completion input/,
  );
  await assert.rejects(
    completeRecallAttemptForUser(
      USER_ID,
      ATTEMPT_ID,
      {
        outcome: 'remembered',
        hintUsed: false,
        response: 'must remain ephemeral',
      } as unknown as { outcome: 'remembered'; hintUsed: boolean },
      async () => D7_DUE_AT,
    ),
    /Invalid Recall completion input/,
  );
  await assert.rejects(
    completeRecallAttemptForUser(
      USER_ID,
      ATTEMPT_ID,
      { outcome: 'great' as 'remembered', hintUsed: false },
      async () => D7_DUE_AT,
    ),
    /Invalid Recall outcome/,
  );
  await assert.rejects(
    completeRecallAttemptForUser(
      USER_ID,
      ATTEMPT_ID,
      { outcome: 'remembered', hintUsed: 'yes' as unknown as boolean },
      async () => D7_DUE_AT,
    ),
    /Invalid Recall hint use/,
  );
  assert.equal(calls, 0);
});

test('retention purge deletes only server-expired attempt rows', async (context) => {
  const originalQuery = db.query;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let sql = '';
  context.after(() => {
    db.query = originalQuery;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = 'postgresql://configured-without-use';
  db.query = (async (text: string) => {
    sql = text;
    return { rows: [{ deleted_count: '3' }] };
  }) as typeof db.query;

  assert.equal(await purgeExpiredRecallAttempts(), 3);
  assert.match(sql, /DELETE FROM recall_attempts/);
  assert.match(sql, /retention_expires_at <= NOW\(\)/);
  assert.doesNotMatch(sql, /INTERVAL '365 days'/);
});

test('the existing authenticated daily purge also runs Recall retention cleanup', () => {
  const route = readFileSync(
    new URL('../app/api/internal/personal-knowledge-purge/route.ts', import.meta.url),
    'utf8',
  );
  const workflow = readFileSync(
    new URL('../../../../.github/workflows/personal-knowledge-purge.yml', import.meta.url),
    'utf8',
  );

  assert.match(route, /purgeExpiredPersonalKnowledgeItems/);
  assert.match(route, /purgeExpiredRecallAttempts/);
  assert.match(route, /recall_attempts_deleted: recallAttemptsDeleted/);
  assert.match(workflow, /Purge cards and Recall attempts past retention/);
  assert.match(workflow, /PERSONAL_KNOWLEDGE_PURGE_TOKEN/);
});
