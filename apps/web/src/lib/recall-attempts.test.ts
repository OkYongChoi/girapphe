import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import db from '@/lib/db';
import {
  invalidateStaleRecallAttemptForUser,
  purgeExpiredRecallAttempts,
  resumeRecallAttemptForUser,
  revealRecallAttemptForUser,
  setRecallAttemptConfidenceForUser,
  startOrResumeRecallAttemptForUser,
  type PersistedRecallAttempt,
} from './recall-attempts';

const USER_ID = 'user_recall_attempt_owner';
const ITEM_ID = 'recall-attempt-item';
const ATTEMPT_ID = 'b3f04fc6-4573-4cb0-9d15-09ce2fc0dd73';
const ENROLLED_AT = '2026-09-01T00:00:00.000Z';
const STARTED_AT = '2026-09-02T06:00:00.000Z';
const CONFIDENCE_AT = '2026-09-02T06:01:00.000Z';
const REVEALED_AT = '2026-09-02T06:02:00.000Z';

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

function attemptRow(value: PersistedRecallAttempt = attempt()) {
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
