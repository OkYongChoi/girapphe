import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { type TestContext } from 'node:test';
import db from '@/lib/db';
import type { PersistedRecallSchedule } from '@/lib/recall-persistence';
import { withoutOptimisticRecallItem } from '@/lib/recall-review-optimistic-state';
import {
  getManualRecallPreRevealSessionForUser,
  getManualRecallRevealedSessionForUser,
  manualRecallRolloverDecision,
  reconcileActiveRecallSchedulesForUser,
  resolveManualRecallNextDeliveryAt,
} from './recall-runtime';

const USER_ID = 'user_recall_runtime';
const ITEM_ID = 'recall-runtime-item';
const ATTEMPT_ID = 'b3f04fc6-4573-4cb0-9d15-09ce2fc0dd73';
const ENROLLED_AT = '2026-09-01T00:00:00.000Z';
const D1_DUE_AT = '2026-09-02T00:00:00.000Z';

function activeSchedule(
  overrides: Partial<PersistedRecallSchedule['snapshot']> = {},
): PersistedRecallSchedule {
  return {
    knowledgeItemId: ITEM_ID,
    itemVersion: 1,
    scheduleVersion: 1,
    snapshot: {
      enrolledAt: ENROLLED_AT,
      state: 'd1_pending',
      dueAt: D1_DUE_AT,
      d1FinalizedIncomplete: false,
      d7Outcome: null,
      ...overrides,
    },
    practice: {
      status: null,
      knowledgeState: null,
      progressState: null,
      lastSeen: null,
    },
  };
}

function attemptRow() {
  return {
    attempt_id: ATTEMPT_ID,
    knowledge_item_id: ITEM_ID,
    item_version: 1,
    schedule_version: 1,
    recall_enrolled_at: ENROLLED_AT,
    milestone: 'd1',
    lifecycle_state: 'confidence_selected',
    confidence: 'medium',
    central_question: 'How does the safe boundary work?',
    knowledge_type: 'concept',
    provider: 'chatgpt',
    discussed_at: '2026-08-31T12:00:00.000Z',
  };
}

function withDatabase(context: TestContext) {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://isolated.test/recall';
  context.after(() => {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'DATABASE_URL');
    else process.env.DATABASE_URL = previous;
  });
}

test('pre-reveal session SQL and response omit approved content and detailed provenance', async (context) => {
  withDatabase(context);
  const original = db.query;
  let sql = '';
  context.after(() => { db.query = original; });
  db.query = (async (text: string) => {
    sql = text;
    return { rows: [attemptRow()] };
  }) as typeof db.query;

  const result = await getManualRecallPreRevealSessionForUser(USER_ID, ATTEMPT_ID);
  assert.equal(result?.phase, 'reconstruct');
  assert.equal(result?.centralQuestion, 'How does the safe boundary work?');
  assert.deepEqual(result?.source, {
    provider: 'chatgpt',
    discussedAt: '2026-08-31T12:00:00.000Z',
    approvalStatus: 'approved',
  });

  const projection = sql.slice(sql.indexOf('SELECT'), sql.indexOf('FROM recall_attempts'));
  assert.doesNotMatch(
    projection,
    /\b(?:title|summary|content|structured_content|source_url|source_locator|selector|conversation_ref)\b/,
  );
  assert.match(sql, /a\.user_id = \$1/);
  assert.match(sql, /a\.id = \$2/);
  assert.match(sql, /src\.supported_item_version = i\.version/);
  assert.doesNotMatch(sql, /src\.id AS source_id|d\.approved_at AS/u);
  assert.doesNotMatch(JSON.stringify(result), /approved-answer-sentinel|source_url|source_locator/);
});

test('revealed session returns only the current approved structured revision and sanitized source', async (context) => {
  withDatabase(context);
  const original = db.query;
  let sql = '';
  context.after(() => { db.query = original; });
  db.query = (async (text: string) => {
    sql = text;
    return {
      rows: [{
        ...attemptRow(),
        lifecycle_state: 'revealed',
        structured_content: {
          type: 'concept',
          definition: 'approved-answer-sentinel',
          key_points: ['Owner scoped'],
          examples: [],
          non_examples: [],
          misconceptions: [],
        },
        bundle_schema_version: 1,
        source_url: 'https://example.com/source?private=query#fragment',
        selector_count: '2',
        supported_item_version: 1,
      }],
    };
  }) as typeof db.query;

  const result = await getManualRecallRevealedSessionForUser(USER_ID, ATTEMPT_ID);
  assert.equal(result?.phase, 'revealed');
  assert.equal(
    result?.bundle.content.type === 'concept' ? result.bundle.content.definition : null,
    'approved-answer-sentinel',
  );
  assert.equal(result?.sourceDetails.sourceUrl, 'https://example.com/source');
  assert.equal(result?.sourceDetails.selectorCount, 2);
  assert.equal(result?.sourceDetails.supportedItemVersion, 1);
  assert.equal(result?.sourceDetails.verificationStatus, 'not_recorded');
  assert.match(sql, /a\.lifecycle_state = 'revealed'/);
  assert.match(sql, /src\.supported_item_version = i\.version/);
  assert.match(sql, /evidence\.source_id = provenance\.source_id/);
  assert.doesNotMatch(sql, /source_locator|conversation_ref/);
});

test('missing or foreign attempts reveal no private content', async (context) => {
  withDatabase(context);
  const original = db.query;
  context.after(() => { db.query = original; });
  db.query = (async () => ({ rows: [] })) as typeof db.query;
  assert.equal(await getManualRecallPreRevealSessionForUser(USER_ID, ATTEMPT_ID), null);
  assert.equal(await getManualRecallRevealedSessionForUser(USER_ID, ATTEMPT_ID), null);
});

test('manual rollover gives D+7 precedence and closes stale milestones into Practice', () => {
  const d7 = manualRecallRolloverDecision(
    activeSchedule(),
    '2026-09-08T00:00:00.000Z',
  );
  assert.equal(d7?.snapshot.state, 'd7_pending');
  assert.equal(d7?.snapshot.dueAt, '2026-09-08T00:00:00.000Z');
  assert.equal(d7?.snapshot.d1FinalizedIncomplete, true);

  const postD7 = manualRecallRolloverDecision(
    activeSchedule(),
    '2026-09-09T00:00:00.000Z',
  );
  assert.equal(postD7?.snapshot.state, 'ordinary_practice');
  assert.equal(postD7?.snapshot.dueAt, '2026-09-09T00:00:00.000Z');
  assert.equal(postD7?.snapshot.d7Outcome, 'unassessed');

  const closedD7 = manualRecallRolloverDecision(
    activeSchedule({
      state: 'd7_pending',
      dueAt: '2026-09-08T01:00:00.000Z',
      d1FinalizedIncomplete: true,
    }),
    '2026-09-09T00:00:00.000Z',
  );
  assert.equal(closedD7?.snapshot.state, 'ordinary_practice');
  assert.equal(closedD7?.snapshot.d7Outcome, 'unassessed');
});

test('stale reconciliation atomically rolls schedules and invalidates their replaced attempt generation', async (context) => {
  withDatabase(context);
  const original = db.accountTransaction;
  let transactionCalls = 0;
  let transactionUserId = '';
  let queries: Parameters<typeof db.accountTransaction>[1] = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, inputQueries) => {
    transactionCalls += 1;
    transactionUserId = userId;
    queries = inputQueries;
    return inputQueries.map(() => ({
      rows: Array.from({ length: 100 }, (_, index) => ({ knowledge_item_id: `item-${index}` })),
    })) as never;
  }) as typeof db.accountTransaction;

  const at = '2026-09-09T00:00:00.000Z';
  await reconcileActiveRecallSchedulesForUser(USER_ID, at);

  assert.equal(transactionCalls, 1);
  assert.equal(transactionUserId, USER_ID);
  assert.equal(queries.length, 1, 'query count stays constant even when 100 rows are returned');

  const update = queries[0]!;
  assert.deepEqual(update.params, [USER_ID, at, 'recall-schedule']);
  assert.match(update.text, /s\.user_id = \$1/);
  assert.match(update.text, /i\.id = s\.knowledge_item_id/);
  assert.match(update.text, /i\.user_id = s\.user_id/);
  assert.match(update.text, /s\.recall_item_version = i\.version/);
  assert.match(update.text, /i\.version = s\.recall_item_version/);
  assert.match(update.text, /i\.knowledge_type IN \('concept', 'procedure', 'comparison'\)/);
  assert.match(update.text, /src\.supported_item_version = i\.version/);
  assert.match(update.text, /s\.recall_schedule_state IN \('d1_pending', 'd1_retry'\)[\s\S]*INTERVAL '168 hours'/);
  assert.match(update.text, /s\.recall_schedule_state = 'd7_pending'[\s\S]*INTERVAL '192 hours'/);
  assert.match(update.text, /ORDER BY s\.knowledge_item_id[\s\S]*LIMIT 100/);

  assert.match(update.text, /locked_stale_recall_schedules AS MATERIALIZED/);
  assert.match(update.text, /pg_advisory_xact_lock/);
  assert.match(update.text, /\$3 \|\| ':' \|\| selected\.user_id \|\| ':' \|\| selected\.knowledge_item_id/);
  assert.match(update.text, /FROM stale_recall_schedules selected\s+ORDER BY selected\.knowledge_item_id/);
  assert.match(update.text, /locked_stale_recall_schedule_batch AS MATERIALIZED/);
  assert.match(update.text, /ARRAY_AGG\(locked\.knowledge_item_id ORDER BY locked\.knowledge_item_id\)/);
  assert.match(update.text, /BOOL_AND\(locked\.item_lock IS NOT NULL\) AS all_item_locks_acquired/);
  assert.match(
    update.text,
    /FROM locked_stale_recall_schedules locked\s+\),\s+rolled_recall_schedules AS MATERIALIZED/,
    'the lock barrier and rollover data-modifying CTE must be comma-delimited',
  );

  assert.match(update.text, /rolled_recall_schedules AS MATERIALIZED \(\s*UPDATE user_private_card_states s/);
  assert.match(update.text, /FROM locked_stale_recall_schedule_batch locked_batch, user_knowledge_items i/);
  assert.match(update.text, /WHERE locked_batch\.all_item_locks_acquired/);
  assert.match(update.text, /s\.knowledge_item_id = ANY\(locked_batch\.knowledge_item_ids\)/);
  assert.match(update.text, /\$2::timestamptz < s\.recall_enrolled_at \+ INTERVAL '192 hours'/);
  assert.match(update.text, /THEN s\.recall_enrolled_at \+ INTERVAL '192 hours'/);
  assert.match(update.text, /ELSE \$2::timestamptz/);
  assert.match(update.text, /THEN 'ordinary_practice'[\s\S]*ELSE 'd7_pending'/);
  assert.match(update.text, /WHEN s\.recall_schedule_state IN \('d1_pending', 'd1_retry'\) THEN TRUE/);
  assert.match(update.text, /THEN 'unassessed'[\s\S]*ELSE NULL/);
  assert.match(update.text, /recall_schedule_version = s\.recall_schedule_version \+ 1/);
  assert.equal(
    update.text.match(/recall_schedule_version = s\.recall_schedule_version \+ 1/g)?.length,
    1,
  );

  assert.match(
    update.text,
    /RETURNING\s+s\.user_id,\s+s\.knowledge_item_id,\s+s\.recall_item_version AS item_version,\s+s\.recall_schedule_version - 1 AS replaced_schedule_version,\s+s\.recall_enrolled_at/,
  );
  assert.match(
    update.text,
    /invalidated_replaced_recall_attempts AS MATERIALIZED \(\s*UPDATE recall_attempts a/,
  );
  assert.match(update.text, /SET lifecycle_state = 'invalidated'/);
  assert.match(update.text, /invalidation_reason = 'stale_context'/);
  assert.match(update.text, /a\.user_id = rolled\.user_id/);
  assert.match(update.text, /a\.knowledge_item_id = rolled\.knowledge_item_id/);
  assert.match(update.text, /a\.item_version = rolled\.item_version/);
  assert.match(update.text, /a\.schedule_version = rolled\.replaced_schedule_version/);
  assert.match(update.text, /a\.recall_enrolled_at = rolled\.recall_enrolled_at/);
  assert.match(
    update.text,
    /a\.lifecycle_state IN \('prepared', 'confidence_selected', 'revealed'\)/,
  );
  assert.match(
    update.text,
    /SELECT COUNT\(\*\)::integer AS invalidated_attempt_count\s+FROM invalidated_replaced_recall_attempts/,
    'the returned rollover rows must consume the invalidation CTE in the same statement',
  );

  const rolledAt = update.text.indexOf('rolled_recall_schedules AS MATERIALIZED');
  const invalidatedAt = update.text.indexOf('invalidated_replaced_recall_attempts AS MATERIALIZED');
  const resultAt = update.text.lastIndexOf('SELECT\n        rolled.knowledge_item_id');
  assert.ok(rolledAt >= 0 && invalidatedAt > rolledAt && resultAt > invalidatedAt);

  const migration = readFileSync(
    new URL('../../drizzle/migrations/0024_recall_prepared_attempts.sql', import.meta.url),
    'utf8',
  );
  assert.match(
    migration,
    /idx_recall_attempts_one_active_milestone[\s\S]*\("user_id", "knowledge_item_id", "item_version", "milestone"\)[\s\S]*WHERE "lifecycle_state" IN \('prepared', 'confidence_selected', 'revealed'\)/,
    'invalidating the replaced D+1 generation releases the active-attempt key before stop, re-enrollment, and a new D+1 start',
  );

  const setStart = update.text.indexOf('SET ');
  const fromStart = update.text.indexOf('FROM locked_stale_recall_schedule_batch', setStart);
  assert.ok(setStart >= 0 && fromStart > setStart);
  const setClause = update.text.slice(setStart, fromStart);
  assert.doesNotMatch(setClause, /\b(?:status|knowledge_state|progress_state|last_seen)\b/);
});

test('D+1 next delivery is server-owned and remains before or at the D+7 anchor', async () => {
  const base = {
    userId: USER_ID,
    knowledgeItemId: ITEM_ID,
    itemVersion: 1,
    scheduleVersion: 1,
    enrolledAt: ENROLLED_AT,
    milestone: 'd1' as const,
    completedAt: '2026-09-02T06:00:00.000Z',
  };
  assert.equal(await resolveManualRecallNextDeliveryAt({ ...base, outcome: 'remembered' }),
    '2026-09-08T00:00:00.000Z');
  assert.equal(await resolveManualRecallNextDeliveryAt({ ...base, outcome: 'partial' }),
    '2026-09-03T06:00:00.000Z');
  assert.equal(await resolveManualRecallNextDeliveryAt({
    ...base,
    completedAt: '2026-09-07T23:00:00.000Z',
    outcome: 'missed',
  }), '2026-09-08T00:00:00.000Z');
});

test('client adapter keeps recall text out of actions and uses logical, 44px controls', () => {
  const component = readFileSync(
    new URL('../components/recall-review-session.tsx', import.meta.url),
    'utf8',
  );
  const actions = [
    'enrollManualRecall',
    'startManualRecall',
    'selectManualRecallConfidence',
    'revealManualRecall',
    'completeManualRecall',
    'cancelManualRecall',
  ];
  for (const action of actions) {
    const match = component.match(new RegExp(`${action}\\(\\{([\\s\\S]*?)\\}\\)`, 'u'));
    assert.ok(match, `${action} invocation is present`);
    assert.doesNotMatch(match[1]!, /recallText|nextDueAt|hintUsed|userId|name/u);
  }
  const textarea = component.match(/<textarea[\s\S]*?\/>/u)?.[0] ?? '';
  assert.match(textarea, /autoComplete="off"/u);
  assert.match(textarea, /spellCheck=\{false\}/u);
  assert.doesNotMatch(textarea, /\bname=/u);

  const buttons = component
    .split('<button')
    .slice(1)
    .map((fragment) => fragment.slice(0, fragment.indexOf('</button>')));
  assert.ok(buttons.length > 0);
  assert.ok(buttons.every((button) => /min-h-11/u.test(button)), 'every button has a 44px minimum height');
  assert.match(
    component,
    /result\.kind === 'capacity_reached'[\s\S]*'recall\.capacityReached'/u,
    'the active-schedule cap has its own stable user-visible recovery state',
  );
  const enrollmentFlow = component.slice(
    component.indexOf('function enroll('),
    component.indexOf('function start('),
  );
  assert.match(
    enrollmentFlow,
    /setCancelledScheduleIds\(\(current\) => \([\s\S]*withoutOptimisticRecallItem\(current, candidate\.knowledgeItemId\)/u,
    'successful re-enrollment must reveal the newly active schedule in the current client session',
  );
  const cancellationFlow = component.slice(
    component.indexOf('function cancel('),
    component.indexOf('function closeSession('),
  );
  assert.match(
    cancellationFlow,
    /setHiddenCandidateIds\(\(current\) => \([\s\S]*withoutOptimisticRecallItem\(current, schedule\.knowledgeItemId\)/u,
    'successful cancellation must reveal the newly eligible candidate in the current client session',
  );
  assert.doesNotMatch(component, /(?:^|["'\s])(?:ml|mr|pl|pr|text-left|text-right)-/mu);
});

test('opposite Recall optimistic state is cleared without mutating the prior render snapshot', () => {
  const current = new Set(['recall-a', 'recall-b']);
  const next = withoutOptimisticRecallItem(current, 'recall-a');

  assert.deepEqual([...current], ['recall-a', 'recall-b']);
  assert.deepEqual([...next], ['recall-b']);
  assert.notEqual(next, current);
});

test('runtime actions gate only new enrollment and force hint use off', () => {
  const actions = readFileSync(
    new URL('../actions/recall-actions.ts', import.meta.url),
    'utf8',
  );
  const lifecycle = actions.slice(actions.indexOf('export async function startManualRecall'));
  assert.doesNotMatch(lifecycle, /isRecallRuntimeEnrollmentEnabledForUser/u);
  assert.match(actions, /\{ outcome: input\.outcome, hintUsed: false \}/u);
});
