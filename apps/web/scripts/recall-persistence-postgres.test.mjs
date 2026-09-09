import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';
import { parsePreviewMigration } from './apply-preview-schema.mjs';

const databaseUrl = process.env.LIVE_POSTGRES_TEST_DATABASE_URL?.trim();

function quoteIdentifier(value) {
  assert.match(value, /^[a-z][a-z0-9_]+$/);
  return `"${value}"`;
}

async function collectCleanupFailure(failures, label, cleanup) {
  try {
    await cleanup();
  } catch (error) {
    failures.push(new Error(`Recall PostgreSQL cleanup failed: ${label}`, { cause: error }));
  }
}

function surfaceCleanupFailures(bodyCompleted, failures) {
  if (bodyCompleted && failures.length > 0) {
    throw new AggregateError(failures, 'Recall PostgreSQL cleanup did not complete.');
  }
}

function cancellationExpectation(schedule) {
  return {
    itemVersion: schedule.itemVersion,
    scheduleVersion: schedule.scheduleVersion,
    enrolledAt: schedule.snapshot.enrolledAt,
  };
}

async function assertRejectsInSavepoint(client, operation, expected) {
  await client.query('SAVEPOINT expected_constraint_failure');
  try {
    await assert.rejects(operation(), expected);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_constraint_failure');
    await client.query('RELEASE SAVEPOINT expected_constraint_failure');
  }
}

async function installRepositoryPgAdapter(pool) {
  const importedDb = await import('../src/lib/db.ts');
  const repositoryDb = importedDb.default ?? importedDb;
  const importedAccountLifecycle = await import('../src/lib/account-lifecycle.ts');
  const accountLifecycle = importedAccountLifecycle.default ?? importedAccountLifecycle;
  const originalMethods = {
    query: repositoryDb.query,
    transaction: repositoryDb.transaction,
    accountTransaction: repositoryDb.accountTransaction,
  };
  const transaction = async (queries) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const results = [];
      for (const query of queries) {
        const result = await client.query(query.text, query.params ?? []);
        results.push({ rows: result.rows });
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };
  repositoryDb.query = async (text, params) => {
    const result = await pool.query(text, params ?? []);
    return { rows: result.rows };
  };
  repositoryDb.transaction = transaction;
  repositoryDb.accountTransaction = async (actorUserId, queries) => {
    const results = await transaction([
      ...accountLifecycle.buildActiveAccountGuardQueries(actorUserId),
      ...queries,
    ]);
    return results.slice(2);
  };
  return {
    transaction,
    restore() {
      repositoryDb.query = originalMethods.query;
      repositoryDb.transaction = originalMethods.transaction;
      repositoryDb.accountTransaction = originalMethods.accountTransaction;
    },
  };
}

test('Recall migration bootstraps an absent Practice table, preserves rows, and enforces honest snapshots', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const bootstrapSchemaName = `recall_bootstrap_${crypto.randomUUID().replaceAll('-', '_')}`;
  const bootstrapSchema = quoteIdentifier(bootstrapSchemaName);
  const schemaName = `recall_test_${crypto.randomUUID().replaceAll('-', '_')}`;
  const schema = quoteIdentifier(schemaName);
  const enrolledAt = '2026-09-03T00:00:00.000Z';
  let bodyCompleted = false;
  let transactionOpen = false;

  try {
    const migrationSql = await readFile(
      new URL('../drizzle/migrations/0022_recall_ping_persistence.sql', import.meta.url),
      'utf8',
    );
    const statements = parsePreviewMigration(migrationSql);
    await client.query(`CREATE SCHEMA ${bootstrapSchema}`);
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL search_path TO ${bootstrapSchema}, public`);
    await client.query(`
      CREATE TABLE user_knowledge_items (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        UNIQUE (id, user_id)
      )
    `);
    await client.query(`
      CREATE TABLE knowledge_item_revisions (
        knowledge_item_id text NOT NULL,
        version integer NOT NULL,
        UNIQUE (knowledge_item_id, version)
      )
    `);
    await client.query(`
      CREATE TABLE knowledge_card_sources (
        id text PRIMARY KEY,
        knowledge_item_id text NOT NULL
      )
    `);
    for (let run = 0; run < 2; run += 1) {
      for (const statement of statements) await client.query(statement);
    }
    assert.equal((await client.query(
      `SELECT to_regclass('user_private_card_states')::text AS table_name`,
    )).rows[0]?.table_name, 'user_private_card_states');
    assert.deepEqual((await client.query(`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'user_private_card_states'
        AND column_name = 'last_seen'
    `, [bootstrapSchemaName])).rows[0], { is_nullable: 'YES', column_default: null });
    assert.equal((await client.query(`
      SELECT COUNT(*)::integer AS count
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'user_private_card_states'
        AND column_name IN (
          'recall_enrolled_at', 'recall_item_version', 'recall_schedule_state',
          'recall_d1_finalized_incomplete', 'recall_d7_outcome', 'recall_schedule_version'
        )
    `, [bootstrapSchemaName])).rows[0]?.count, 6);
    assert.equal((await client.query(`
      SELECT COUNT(*)::integer AS count
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = 'user_private_card_states'
        AND indexname IN (
          'idx_user_private_card_states_user_status',
          'idx_user_private_card_states_user_due'
        )
    `, [bootstrapSchemaName])).rows[0]?.count, 2);
    assert.equal((await client.query(`
      SELECT COUNT(*)::integer AS count
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = $1 AND t.relname = 'user_private_card_states'
        AND c.conname = 'user_private_card_states_recall_schedule_check'
    `, [bootstrapSchemaName])).rows[0]?.count, 1);
    await client.query('COMMIT');
    transactionOpen = false;

    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE user_private_card_states (
        user_id text NOT NULL,
        knowledge_item_id text NOT NULL,
        status text NOT NULL,
        knowledge_state text NOT NULL,
        progress_state text NOT NULL,
        due_at timestamp with time zone,
        last_seen timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT user_private_card_states_user_id_knowledge_item_id_pk
          PRIMARY KEY (user_id, knowledge_item_id),
        CONSTRAINT user_private_card_states_status_check
          CHECK (status IN ('known', 'saved')),
        CONSTRAINT user_private_card_states_knowledge_state_check
          CHECK (knowledge_state IN ('unknown', 'known')),
        CONSTRAINT user_private_card_states_progress_state_check
          CHECK (progress_state IN ('learning', 'review')),
        CONSTRAINT user_private_card_states_consistency_check CHECK (
          (status = 'known' AND knowledge_state = 'known' AND progress_state = 'review')
          OR (status = 'saved' AND knowledge_state = 'unknown' AND progress_state = 'learning')
        )
      )
    `);
    await client.query(`
      CREATE TABLE knowledge_item_revisions (
        knowledge_item_id text NOT NULL,
        version integer NOT NULL,
        CONSTRAINT knowledge_item_revisions_item_version_key
          UNIQUE (knowledge_item_id, version)
      )
    `);
    await client.query(`
      CREATE TABLE knowledge_card_sources (
        id text PRIMARY KEY,
        knowledge_item_id text NOT NULL
      )
    `);
    await client.query(
      `INSERT INTO user_private_card_states
         (user_id, knowledge_item_id, status, knowledge_state, progress_state, due_at, last_seen)
       VALUES
         ('owner', 'known-item', 'known', 'known', 'review', $1, $2),
         ('owner', 'saved-item', 'saved', 'unknown', 'learning', $3, $4)`,
      [
        '2026-09-10T09:00:00.000Z',
        '2026-09-01T01:02:03.456Z',
        '2026-09-04T09:00:00.000Z',
        '2026-09-02T04:05:06.789Z',
      ],
    );
    await client.query(
      `INSERT INTO knowledge_item_revisions (knowledge_item_id, version) VALUES ('historical-item', 1)`,
    );
    await client.query(
      `INSERT INTO knowledge_card_sources (id, knowledge_item_id) VALUES ('historical-source', 'historical-item')`,
    );

    const before = (await client.query(`
      SELECT knowledge_item_id, status, knowledge_state, progress_state,
        due_at::text, last_seen::text
      FROM user_private_card_states
      ORDER BY knowledge_item_id
    `)).rows;

    for (let run = 0; run < 2; run += 1) {
      for (const statement of statements) await client.query(statement);
    }

    const after = (await client.query(`
      SELECT knowledge_item_id, status, knowledge_state, progress_state,
        due_at::text, last_seen::text
      FROM user_private_card_states
      WHERE knowledge_item_id IN ('known-item', 'saved-item')
      ORDER BY knowledge_item_id
    `)).rows;
    assert.deepEqual(after, before);
    assert.equal((await client.query(`
      SELECT column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'user_private_card_states'
        AND column_name = 'last_seen'
    `, [schemaName])).rows[0]?.column_default, null);
    assert.equal((await client.query(`
      SELECT column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'user_private_card_states'
        AND column_name = 'last_seen'
    `, [schemaName])).rows[0]?.is_nullable, 'YES');

    await client.query(`
      INSERT INTO user_private_card_states (
        user_id, knowledge_item_id, status, knowledge_state, progress_state,
        due_at, last_seen, recall_enrolled_at, recall_item_version,
        recall_schedule_state, recall_d1_finalized_incomplete,
        recall_d7_outcome, recall_schedule_version
      ) VALUES (
        'owner', 'unassessed-item', NULL, NULL, NULL,
        $1::timestamptz + INTERVAL '24 hours', NULL, $1, 1,
        'd1_pending', FALSE, NULL, 1
      )
    `, [enrolledAt]);

    for (let mask = 1; mask < 15; mask += 1) {
      const values = [
        mask & 1 ? 'saved' : null,
        mask & 2 ? 'unknown' : null,
        mask & 4 ? 'learning' : null,
        mask & 8 ? enrolledAt : null,
      ];
      await assertRejectsInSavepoint(client, () => client.query(`
        INSERT INTO user_private_card_states (
          user_id, knowledge_item_id, status, knowledge_state, progress_state,
          due_at, last_seen, recall_enrolled_at, recall_item_version,
          recall_schedule_state, recall_d1_finalized_incomplete,
          recall_d7_outcome, recall_schedule_version
        ) VALUES (
          'owner', $1, $3, $4, $5,
          $2::timestamptz + INTERVAL '24 hours', $6::timestamptz, $2, 1,
          'd1_pending', FALSE, NULL, 1
        )
      `, [`partial-projection-${mask}`, enrolledAt, ...values]),
      /user_private_card_states_consistency_check/);
    }

    const invalidSchedules = [
      { name: 'item-version', state: 'd1_pending', dueHours: 24, itemVersion: 0, flag: false, outcome: null, version: 1 },
      { name: 'schedule-version', state: 'd1_pending', dueHours: 24, itemVersion: 1, flag: false, outcome: null, version: 0 },
      { name: 'd1-close', state: 'd1_pending', dueHours: 48, itemVersion: 1, flag: false, outcome: null, version: 1 },
      { name: 'd1-finalized', state: 'd1_pending', dueHours: 24, itemVersion: 1, flag: true, outcome: null, version: 1 },
      { name: 'retry-close', state: 'd1_retry', dueHours: 168, itemVersion: 1, flag: false, outcome: null, version: 1 },
      { name: 'd7-early', state: 'd7_pending', dueHours: 167, itemVersion: 1, flag: true, outcome: null, version: 1 },
      { name: 'd7-outcome', state: 'd7_pending', dueHours: 168, itemVersion: 1, flag: true, outcome: 'remembered', version: 1 },
      { name: 'ordinary-early', state: 'ordinary_practice', dueHours: 191, itemVersion: 1, flag: true, outcome: 'unassessed', version: 1 },
      { name: 'ordinary-outcome', state: 'ordinary_practice', dueHours: 192, itemVersion: 1, flag: true, outcome: null, version: 1 },
    ];
    for (const invalid of invalidSchedules) {
      await assertRejectsInSavepoint(client, () => client.query(`
        INSERT INTO user_private_card_states (
          user_id, knowledge_item_id, status, knowledge_state, progress_state,
          due_at, last_seen, recall_enrolled_at, recall_item_version,
          recall_schedule_state, recall_d1_finalized_incomplete,
          recall_d7_outcome, recall_schedule_version
        ) VALUES (
          'owner', $1, NULL, NULL, NULL,
          $2::timestamptz + make_interval(hours => $3::integer), NULL, $2, $4,
          $5, $6, $7, $8
        )
      `, [
        `invalid-${invalid.name}`,
        enrolledAt,
        invalid.dueHours,
        invalid.itemVersion,
        invalid.state,
        invalid.flag,
        invalid.outcome,
        invalid.version,
      ]), /user_private_card_states_recall_schedule_check/);
    }

    assert.equal((await client.query(`
      SELECT supported_item_version
      FROM knowledge_card_sources WHERE id = 'historical-source'
    `)).rows[0]?.supported_item_version, null);
    await client.query(`
      INSERT INTO knowledge_card_sources (id, knowledge_item_id, supported_item_version)
      VALUES ('bound-source', 'historical-item', 1)
    `);
    await assertRejectsInSavepoint(client, () => client.query(`
      INSERT INTO knowledge_card_sources (id, knowledge_item_id, supported_item_version)
      VALUES ('false-source', 'historical-item', 2)
    `), /knowledge_card_sources_supported_revision_fk/);
    await client.query('COMMIT');
    transactionOpen = false;
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    if (transactionOpen) {
      await collectCleanupFailure(cleanupFailures, 'rollback isolated transaction', async () => {
        await client.query('ROLLBACK');
        transactionOpen = false;
      });
    }
    await collectCleanupFailure(cleanupFailures, 'reset isolated search path', () => (
      client.query('RESET search_path')
    ));
    await collectCleanupFailure(cleanupFailures, 'drop isolated schema', () => (
      client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    ));
    await collectCleanupFailure(cleanupFailures, 'drop bootstrap schema', () => (
      client.query(`DROP SCHEMA IF EXISTS ${bootstrapSchema} CASCADE`)
    ));
    await collectCleanupFailure(cleanupFailures, 'verify isolated schema removal', async () => {
      const remaining = (await client.query(
        `SELECT COUNT(*)::integer AS count
         FROM information_schema.schemata
         WHERE schema_name = ANY($1::text[])`,
        [[schemaName, bootstrapSchemaName]],
      )).rows[0]?.count;
      assert.equal(remaining, 0);
    });
    await collectCleanupFailure(cleanupFailures, 'release isolated database client', async () => {
      client.release();
    });
    await collectCleanupFailure(cleanupFailures, 'close isolated database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Recall repository serializes enrollment and rejects stale or foreign-owner transitions', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const importedRecall = await import('../src/lib/recall-persistence.ts');
  const recall = importedRecall.default ?? importedRecall;
  const sharedImport = await import('@stem-brain/shared');
  const shared = sharedImport.default ?? sharedImport;
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const repositoryAdapter = await installRepositoryPgAdapter(pool);
  const userId = `live-recall-owner-${crypto.randomUUID()}`;
  const otherUserId = `live-recall-other-${crypto.randomUUID()}`;
  const itemId = `live-recall-item-${crypto.randomUUID()}`;
  const batchId = `live-recall-batch-${crypto.randomUUID()}`;
  const draftId = `live-recall-draft-${crypto.randomUUID()}`;
  const sourceId = `live-recall-source-${crypto.randomUUID()}`;
  const revisionId = `live-recall-revision-${crypto.randomUUID()}`;
  const enrolledAt = '2026-09-03T00:00:00.000Z';
  const firstDueAt = '2026-09-04T00:00:00.000Z';
  let bodyCompleted = false;

  try {
    await pool.query(
      `INSERT INTO user_knowledge_items (
         id, user_id, title, summary, content, topic, tags, knowledge_type,
         central_question, structured_content, bundle_schema_version, version
       ) VALUES (
         $1, $2, 'Recall live fixture', '', '', 'recall-live', '[]'::jsonb,
         'concept', 'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1, 1
       )`,
      [itemId, userId],
    );
    await pool.query(
      `INSERT INTO knowledge_item_revisions
         (id, user_id, knowledge_item_id, version, snapshot, change_reason)
       VALUES ($1, $2, $3, 1, '{}'::jsonb, 'confirmed')`,
      [revisionId, userId, itemId],
    );
    await pool.query(
      `INSERT INTO knowledge_ingestion_batches (
         id, user_id, source_type, provider, scope, request_id, status, committed_at
       ) VALUES ($1, $2, 'conversation', 'chatgpt', 'current_conversation', $3, 'approved', NOW())`,
      [batchId, userId, `live-recall-request-${crypto.randomUUID()}`],
    );
    await pool.query(
      `INSERT INTO knowledge_card_drafts (
         id, batch_id, user_id, client_card_id, title, knowledge_type,
         central_question, structured_content, bundle_schema_version,
         status, knowledge_item_id, approved_at
       ) VALUES (
         $1, $2, $3, $4, 'Recall live fixture', 'concept',
         'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1,
         'approved', $5, NOW()
       )`,
      [draftId, batchId, userId, `live-recall-card-${crypto.randomUUID()}`, itemId],
    );
    await pool.query(
      `INSERT INTO knowledge_card_sources (
         id, user_id, knowledge_item_id, batch_id, draft_id, source_type,
         provider, conversation_ref, supported_item_version, confirmed_at
       ) VALUES ($1, $2, $3, $4, $5, 'conversation', 'chatgpt', $6, 1, NOW())`,
      [sourceId, userId, itemId, batchId, draftId, `conversation-${crypto.randomUUID()}`],
    );

    const enrollmentResults = await Promise.all([
      recall.enrollApprovedRecallScheduleForUser(
        userId, itemId, 1, enrolledAt, firstDueAt,
      ),
      recall.enrollApprovedRecallScheduleForUser(
        userId, itemId, 1, enrolledAt, firstDueAt,
      ),
    ]);
    assert.deepEqual(
      enrollmentResults.map((result) => result.kind).sort(),
      ['enrolled', 'unchanged'],
    );
    const enrolledSchedule = enrollmentResults[0].schedule;
    assert.ok(enrolledSchedule);
    assert.equal(enrolledSchedule.snapshot.enrolledAt, enrolledAt);
    assert.equal(enrolledSchedule.snapshot.dueAt, firstDueAt);
    assert.deepEqual(enrolledSchedule.practice, {
      status: null,
      knowledgeState: null,
      progressState: null,
      lastSeen: null,
    });
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM user_private_card_states WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    )).rows[0]?.count, 1);
    assert.equal(await recall.getRecallScheduleForUser(otherUserId, itemId), null);

    const retryDecision = shared.assessRecallSchedule(enrolledSchedule.snapshot, {
      at: firstDueAt,
      outcome: 'partial',
      nextPreferredDeliveryAt: '2026-09-04T12:00:00.000Z',
    });
    assert.deepEqual(await recall.enrollApprovedRecallScheduleForUser(
      otherUserId, itemId, 1, enrolledAt, firstDueAt,
    ), { kind: 'ineligible', schedule: null });
    assert.deepEqual(await recall.persistRecallScheduleDecisionForUser(
      otherUserId,
      itemId,
      enrolledSchedule,
      retryDecision,
      '2026-09-04T00:00:00.123Z',
    ), { kind: 'not_found', schedule: null });
    assert.deepEqual(await recall.cancelRecallScheduleForItem(
      otherUserId, itemId, cancellationExpectation(enrolledSchedule),
    ), { kind: 'not_found', schedule: null });
    const unchangedOwnerSchedule = await recall.getRecallScheduleForUser(userId, itemId);
    assert.equal(unchangedOwnerSchedule?.scheduleVersion, 1);
    assert.equal(unchangedOwnerSchedule?.snapshot.dueAt, firstDueAt);

    const retryResults = await Promise.all([
      recall.persistRecallScheduleDecisionForUser(
        userId, itemId, enrolledSchedule, retryDecision,
        '2026-09-04T00:00:00.123Z',
      ),
      recall.persistRecallScheduleDecisionForUser(
        userId, itemId, enrolledSchedule, retryDecision,
        '2026-09-04T00:00:00.123Z',
      ),
    ]);
    assert.deepEqual(
      retryResults.map((result) => result.kind).sort(),
      ['applied', 'unchanged'],
    );
    const retrySchedule = retryResults.find((result) => result.kind === 'applied')?.schedule;
    assert.ok(retrySchedule);
    assert.equal(retrySchedule.scheduleVersion, 2);
    assert.equal(retrySchedule.practice.status, 'saved');

    const differentStaleDecision = shared.assessRecallSchedule(enrolledSchedule.snapshot, {
      at: firstDueAt,
      outcome: 'missed',
      nextPreferredDeliveryAt: '2026-09-04T16:00:00.000Z',
    });
    const staleRetry = await recall.persistRecallScheduleDecisionForUser(
      userId, itemId, enrolledSchedule, differentStaleDecision,
      '2026-09-04T00:00:00.456Z',
    );
    assert.equal(staleRetry.kind, 'conflict');
    assert.equal(staleRetry.schedule?.snapshot.dueAt, retrySchedule.snapshot.dueAt);

    await pool.query(
      `UPDATE user_private_card_states
       SET last_seen = '2026-09-04T00:00:00.123456Z'::timestamptz
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    );
    const microsecondSchedule = await recall.getRecallScheduleForUser(userId, itemId);
    assert.ok(microsecondSchedule);
    assert.equal(microsecondSchedule.practice.lastSeen, '2026-09-04T00:00:00.123Z');

    const d7Decision = shared.assessRecallSchedule(microsecondSchedule.snapshot, {
      at: microsecondSchedule.snapshot.dueAt,
      outcome: 'remembered',
      nextPreferredDeliveryAt: '2026-09-10T01:00:00.000Z',
    });
    const d7Result = await recall.persistRecallScheduleDecisionForUser(
      userId,
      itemId,
      microsecondSchedule,
      d7Decision,
      '2026-09-04T12:00:00.456Z',
    );
    assert.equal(d7Result.kind, 'applied');
    assert.equal(d7Result.schedule?.snapshot.state, 'd7_pending');
    assert.equal(d7Result.schedule?.practice.status, 'known');

    const staleD1Decision = shared.rescheduleUnopenedRecall(retrySchedule.snapshot, {
      at: retrySchedule.snapshot.dueAt,
      nextPreferredDeliveryAt: '2026-09-05T00:00:00.000Z',
    });
    const staleD1 = await recall.persistRecallScheduleDecisionForUser(
      userId, itemId, retrySchedule, staleD1Decision, retrySchedule.snapshot.dueAt,
    );
    assert.equal(staleD1.kind, 'conflict');
    assert.equal(staleD1.schedule?.snapshot.state, 'd7_pending');

    await pool.query(
      `UPDATE user_knowledge_items
       SET version = 2, archived_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId],
    );
    const cancellation = await recall.cancelRecallScheduleForItem(
      userId,
      itemId,
      cancellationExpectation(d7Result.schedule),
    );
    assert.deepEqual(cancellation, { kind: 'cancelled', retainedPractice: true });
    assert.deepEqual((await pool.query(
      `SELECT status, knowledge_state, progress_state,
         recall_enrolled_at, recall_schedule_version
       FROM user_private_card_states WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    )).rows, [{
      status: 'known',
      knowledge_state: 'known',
      progress_state: 'review',
      recall_enrolled_at: null,
      recall_schedule_version: null,
    }]);

    const replacementEnrolledAt = '2026-09-10T00:00:00.000Z';
    const replacementDueAt = '2026-09-11T00:00:00.000Z';
    await pool.query(
      `UPDATE user_knowledge_items
       SET version = 1, archived_at = NULL
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId],
    );
    const replacementEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      1,
      replacementEnrolledAt,
      replacementDueAt,
    );
    assert.equal(replacementEnrollment.kind, 'enrolled');
    assert.ok(replacementEnrollment.schedule);
    assert.equal(replacementEnrollment.schedule.scheduleVersion, 1);
    assert.equal(replacementEnrollment.schedule.snapshot.enrolledAt, replacementEnrolledAt);

    const delayedCancellation = await recall.cancelRecallScheduleForItem(
      userId,
      itemId,
      cancellationExpectation(enrolledSchedule),
    );
    assert.equal(delayedCancellation.kind, 'conflict');
    assert.equal(delayedCancellation.schedule?.itemVersion, enrolledSchedule.itemVersion);
    assert.equal(delayedCancellation.schedule?.scheduleVersion, enrolledSchedule.scheduleVersion);
    assert.equal(delayedCancellation.schedule?.snapshot.enrolledAt, replacementEnrolledAt);

    assert.deepEqual(await recall.cancelRecallScheduleForItem(
      userId,
      itemId,
      cancellationExpectation(replacementEnrollment.schedule),
    ), { kind: 'cancelled', retainedPractice: true });
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    repositoryAdapter.restore();
    await collectCleanupFailure(cleanupFailures, 'delete synthetic knowledge item', () => (
      pool.query(
        `DELETE FROM user_knowledge_items WHERE id = $1 AND user_id = $2`,
        [itemId, userId],
      )
    ));
    await collectCleanupFailure(cleanupFailures, 'delete synthetic ingestion batch', () => (
      pool.query(
        `DELETE FROM knowledge_ingestion_batches WHERE id = $1 AND user_id = $2`,
        [batchId, userId],
      )
    ));
    await collectCleanupFailure(cleanupFailures, 'verify synthetic row removal', async () => {
      const remaining = (await pool.query(
        `SELECT
           EXISTS (SELECT 1 FROM user_knowledge_items WHERE id = $1) AS item_exists,
           EXISTS (SELECT 1 FROM user_private_card_states WHERE knowledge_item_id = $1) AS state_exists,
           EXISTS (SELECT 1 FROM knowledge_item_revisions WHERE id = $2) AS revision_exists,
           EXISTS (SELECT 1 FROM knowledge_card_sources WHERE id = $3) AS source_exists,
           EXISTS (SELECT 1 FROM knowledge_card_drafts WHERE id = $4) AS draft_exists,
           EXISTS (SELECT 1 FROM knowledge_ingestion_batches WHERE id = $5) AS batch_exists`,
        [itemId, revisionId, sourceId, draftId, batchId],
      )).rows[0];
      assert.deepEqual(remaining, {
        item_exists: false,
        state_exists: false,
        revision_exists: false,
        source_exists: false,
        draft_exists: false,
        batch_exists: false,
      });
    });
    await collectCleanupFailure(cleanupFailures, 'close repository database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Recall reconciliation acquires its full ordered item-lock batch before updating', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const importedDb = await import('../src/lib/db.ts');
  const repositoryDb = importedDb.default ?? importedDb;
  const importedRuntime = await import('../src/lib/recall-runtime.ts');
  const runtime = importedRuntime.default ?? importedRuntime;
  const originalAccountTransaction = repositoryDb.accountTransaction;
  const observerPool = new Pool({ connectionString: databaseUrl, max: 3 });
  const reconciliationPool = new Pool({ connectionString: databaseUrl, max: 1 });
  const blocker = await observerPool.connect();
  const rowProbe = await observerPool.connect();
  const userId = `live-recall-barrier-owner-${crypto.randomUUID()}`;
  const batchId = `live-recall-barrier-batch-${crypto.randomUUID()}`;
  const itemIds = [
    `live-recall-barrier-a-${crypto.randomUUID()}`,
    `live-recall-barrier-b-${crypto.randomUUID()}`,
  ];
  const at = '2026-09-09T03:00:00.000Z';
  const enrolledAt = [
    '2026-09-01T00:00:00.000Z',
    '2026-09-02T00:00:00.000Z',
  ];
  const firstDueAt = [
    '2026-09-02T00:00:00.000Z',
    '2026-09-03T00:00:00.000Z',
  ];
  let reconciliationBackendPid = null;
  let reconciliationPromise = null;
  let blockerTransactionOpen = false;
  let rowProbeTransactionOpen = false;
  let bodyCompleted = false;

  // Isolate the item-lock contract under test. The ordinary account guard is
  // intentionally omitted here because it would serialize the blocker before
  // the reconciliation query reaches its per-item lock batch.
  repositoryDb.accountTransaction = async (actorUserId, queries) => {
    assert.equal(actorUserId, userId);
    const client = await reconciliationPool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      // Exercise a legal row-at-a-time join plan that exposed the missing
      // aggregate barrier in the original query.
      await client.query('SET LOCAL enable_hashjoin = off');
      await client.query('SET LOCAL enable_mergejoin = off');
      reconciliationBackendPid = (await client.query(
        'SELECT pg_backend_pid()::integer AS pid',
      )).rows[0]?.pid ?? null;
      const results = [];
      for (const query of queries) {
        const result = await client.query(query.text, query.params ?? []);
        results.push({ rows: result.rows });
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };

  try {
    await runtime.reconcileActiveRecallSchedulesForUser(userId, at);
    await observerPool.query(
      `INSERT INTO knowledge_ingestion_batches (
         id, user_id, source_type, provider, scope, request_id, status, committed_at
       ) VALUES ($1, $2, 'conversation', 'chatgpt', 'current_conversation', $3, 'approved', NOW())`,
      [batchId, userId, `live-recall-barrier-request-${crypto.randomUUID()}`],
    );

    for (const [index, itemId] of itemIds.entries()) {
      const revisionId = `live-recall-barrier-revision-${crypto.randomUUID()}`;
      const draftId = `live-recall-barrier-draft-${crypto.randomUUID()}`;
      await observerPool.query(
        `INSERT INTO user_knowledge_items (
           id, user_id, title, summary, content, topic, tags, knowledge_type,
           central_question, structured_content, bundle_schema_version, version
         ) VALUES (
           $1, $2, 'Recall barrier fixture', '', '', 'recall-live', '[]'::jsonb,
           'concept', 'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1, 1
         )`,
        [itemId, userId],
      );
      await observerPool.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         VALUES ($1, $2, $3, 1, '{}'::jsonb, 'confirmed')`,
        [revisionId, userId, itemId],
      );
      await observerPool.query(
        `INSERT INTO knowledge_card_drafts (
           id, batch_id, user_id, client_card_id, title, knowledge_type,
           central_question, structured_content, bundle_schema_version,
           status, knowledge_item_id, approved_at
         ) VALUES (
           $1, $2, $3, $4, 'Recall barrier fixture', 'concept',
           'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1,
           'approved', $5, NOW()
         )`,
        [draftId, batchId, userId, `live-recall-barrier-card-${crypto.randomUUID()}`, itemId],
      );
      await observerPool.query(
        `INSERT INTO knowledge_card_sources (
           id, user_id, knowledge_item_id, batch_id, draft_id, source_type,
           provider, conversation_ref, supported_item_version, confirmed_at
         ) VALUES ($1, $2, $3, $4, $5, 'conversation', 'chatgpt', $6, 1, NOW())`,
        [
          `live-recall-barrier-source-${crypto.randomUUID()}`,
          userId,
          itemId,
          batchId,
          draftId,
          `conversation-${crypto.randomUUID()}`,
        ],
      );
      await observerPool.query(
        `INSERT INTO user_private_card_states (
           user_id, knowledge_item_id, status, knowledge_state, progress_state,
           due_at, last_seen, recall_enrolled_at, recall_item_version,
           recall_schedule_state, recall_d1_finalized_incomplete,
           recall_d7_outcome, recall_schedule_version
         ) VALUES (
           $1, $2,
           CASE WHEN $3::integer = 0 THEN 'saved' ELSE NULL END,
           CASE WHEN $3::integer = 0 THEN 'unknown' ELSE NULL END,
           CASE WHEN $3::integer = 0 THEN 'learning' ELSE NULL END,
           $4, CASE WHEN $3::integer = 0 THEN $5::timestamptz ELSE NULL END,
           $6, 1, 'd1_pending', FALSE, NULL, 1
         )`,
        [
          userId,
          itemId,
          index,
          firstDueAt[index],
          '2026-09-03T12:00:00.000Z',
          enrolledAt[index],
        ],
      );
    }

    await blocker.query('BEGIN');
    blockerTransactionOpen = true;
    await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `recall-schedule:${userId}:${itemIds[1]}`,
    ]);

    reconciliationPromise = runtime.reconcileActiveRecallSchedulesForUser(userId, at);
    let activity = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (reconciliationBackendPid !== null) {
        activity = (await observerPool.query(
          `SELECT wait_event_type, wait_event
           FROM pg_stat_activity
           WHERE pid = $1`,
          [reconciliationBackendPid],
        )).rows[0] ?? null;
        if (activity?.wait_event === 'advisory') break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.deepEqual(activity, { wait_event_type: 'Lock', wait_event: 'advisory' });
    assert.deepEqual((await observerPool.query(
      `SELECT granted, COUNT(*)::integer AS count
       FROM pg_locks
       WHERE pid = $1 AND locktype = 'advisory'
       GROUP BY granted
       ORDER BY granted`,
      [reconciliationBackendPid],
    )).rows, [
      { granted: false, count: 1 },
      { granted: true, count: 1 },
    ]);

    await rowProbe.query('BEGIN');
    rowProbeTransactionOpen = true;
    await rowProbe.query(
      `SELECT knowledge_item_id
       FROM user_private_card_states
       WHERE user_id = $1 AND knowledge_item_id = $2
       FOR UPDATE NOWAIT`,
      [userId, itemIds[0]],
    );
    await rowProbe.query('ROLLBACK');
    rowProbeTransactionOpen = false;

    await blocker.query(
      `UPDATE user_private_card_states
       SET due_at = $3::timestamptz,
           recall_schedule_state = 'd7_pending',
           recall_d1_finalized_incomplete = TRUE,
           recall_schedule_version = recall_schedule_version + 1
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemIds[1], at],
    );
    await blocker.query('COMMIT');
    blockerTransactionOpen = false;
    await reconciliationPromise;

    assert.deepEqual((await observerPool.query(
      `SELECT
         knowledge_item_id,
         status,
         knowledge_state,
         progress_state,
         last_seen::text,
         due_at::text,
         recall_schedule_state,
         recall_d1_finalized_incomplete,
         recall_d7_outcome,
         recall_schedule_version
       FROM user_private_card_states
       WHERE user_id = $1
       ORDER BY knowledge_item_id`,
      [userId],
    )).rows, [
      {
        knowledge_item_id: itemIds[0],
        status: 'saved',
        knowledge_state: 'unknown',
        progress_state: 'learning',
        last_seen: '2026-09-03 12:00:00+00',
        due_at: '2026-09-09 00:00:00+00',
        recall_schedule_state: 'ordinary_practice',
        recall_d1_finalized_incomplete: true,
        recall_d7_outcome: 'unassessed',
        recall_schedule_version: 2,
      },
      {
        knowledge_item_id: itemIds[1],
        status: null,
        knowledge_state: null,
        progress_state: null,
        last_seen: null,
        due_at: '2026-09-09 03:00:00+00',
        recall_schedule_state: 'd7_pending',
        recall_d1_finalized_incomplete: true,
        recall_d7_outcome: null,
        recall_schedule_version: 2,
      },
    ]);
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    if (rowProbeTransactionOpen) {
      await collectCleanupFailure(cleanupFailures, 'rollback barrier row probe', async () => {
        await rowProbe.query('ROLLBACK');
        rowProbeTransactionOpen = false;
      });
    }
    if (blockerTransactionOpen) {
      await collectCleanupFailure(cleanupFailures, 'release blocked barrier lock', async () => {
        await blocker.query('ROLLBACK');
        blockerTransactionOpen = false;
      });
    }
    await collectCleanupFailure(cleanupFailures, 'finish barrier reconciliation', async () => {
      await reconciliationPromise?.catch((error) => {
        if (bodyCompleted) throw error;
      });
    });
    repositoryDb.accountTransaction = originalAccountTransaction;
    rowProbe.release();
    blocker.release();
    await collectCleanupFailure(cleanupFailures, 'delete barrier knowledge items', () => (
      observerPool.query(
        'DELETE FROM user_knowledge_items WHERE user_id = $1 AND id = ANY($2::text[])',
        [userId, itemIds],
      )
    ));
    await collectCleanupFailure(cleanupFailures, 'delete barrier ingestion batch', () => (
      observerPool.query(
        'DELETE FROM knowledge_ingestion_batches WHERE id = $1 AND user_id = $2',
        [batchId, userId],
      )
    ));
    await collectCleanupFailure(cleanupFailures, 'close barrier reconciliation pool', () => (
      reconciliationPool.end()
    ));
    await collectCleanupFailure(cleanupFailures, 'close barrier observer pool', () => observerPool.end());
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Recall attempt migration enforces content-free lifecycle shapes and one active milestone', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const schemaName = `recall_attempt_${crypto.randomUUID().replaceAll('-', '_')}`;
  const schema = quoteIdentifier(schemaName);
  const itemId = `attempt-migration-${crypto.randomUUID()}`;
  const userId = `attempt-migration-owner-${crypto.randomUUID()}`;
  const firstAttemptId = crypto.randomUUID();
  let bodyCompleted = false;

  try {
    const migrationSql = await readFile(
      new URL('../drizzle/migrations/0024_recall_prepared_attempts.sql', import.meta.url),
      'utf8',
    );
    const statements = parsePreviewMigration(migrationSql);
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE user_knowledge_items (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        UNIQUE (id, user_id)
      )
    `);
    await client.query(
      'INSERT INTO user_knowledge_items (id, user_id) VALUES ($1, $2)',
      [itemId, userId],
    );
    for (let run = 0; run < 2; run += 1) {
      for (const statement of statements) await client.query(statement);
    }
    assert.equal((await client.query(
      `SELECT to_regclass('recall_attempts')::text AS table_name`,
    )).rows[0]?.table_name, 'recall_attempts');
    assert.equal((await client.query(`
      SELECT COUNT(*)::integer AS count
      FROM pg_indexes
      WHERE schemaname = $1 AND tablename = 'recall_attempts'
        AND indexname IN (
          'idx_recall_attempts_one_active_milestone',
          'idx_recall_attempts_user_item_started',
          'idx_recall_attempts_retention'
        )
    `, [schemaName])).rows[0]?.count, 3);

    const insertPrepared = `INSERT INTO recall_attempts (
      id, user_id, knowledge_item_id, item_version, schedule_version,
      recall_enrolled_at, milestone, exercise_type
    ) VALUES ($1, $2, $3, 1, 1, NOW() - INTERVAL '25 hours', 'd1', 'concept')`;
    await client.query(insertPrepared, [firstAttemptId, userId, itemId]);
    await assert.rejects(
      client.query(insertPrepared, [crypto.randomUUID(), userId, itemId]),
      /idx_recall_attempts_one_active_milestone/,
    );
    await client.query(
      `UPDATE recall_attempts
       SET lifecycle_state = 'invalidated', invalidated_at = NOW(),
           invalidation_reason = 'stale_context', updated_at = NOW()
       WHERE id = $1`,
      [firstAttemptId],
    );
    await client.query(insertPrepared, [crypto.randomUUID(), userId, itemId]);
    await assert.rejects(
      client.query(
        `UPDATE recall_attempts
         SET lifecycle_state = 'revealed', revealed_at = NOW(), updated_at = NOW()
         WHERE lifecycle_state = 'prepared'`,
      ),
      /recall_attempts_lifecycle_shape_check/,
    );
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    await collectCleanupFailure(cleanupFailures, 'reset attempt migration search path', () => (
      client.query('RESET search_path')
    ));
    await collectCleanupFailure(cleanupFailures, 'drop attempt migration schema', () => (
      client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    ));
    await collectCleanupFailure(cleanupFailures, 'release attempt migration client', async () => {
      client.release();
    });
    await collectCleanupFailure(cleanupFailures, 'close attempt migration pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Recall attempt retention purge deletes an expired row and preserves a current row', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const importedAttempts = await import('../src/lib/recall-attempts.ts');
  const attempts = importedAttempts.default ?? importedAttempts;
  const importedDb = await import('../src/lib/db.ts');
  const repositoryDb = importedDb.default ?? importedDb;
  const originalQuery = repositoryDb.query;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const schemaName = `recall_retention_${crypto.randomUUID().replaceAll('-', '_')}`;
  const schema = quoteIdentifier(schemaName);
  const userId = `retention-owner-${crypto.randomUUID()}`;
  const itemId = `retention-item-${crypto.randomUUID()}`;
  const expiredAttemptId = crypto.randomUUID();
  const currentAttemptId = crypto.randomUUID();
  let bodyCompleted = false;
  let transactionOpen = false;

  try {
    const migrationSql = await readFile(
      new URL('../drizzle/migrations/0024_recall_prepared_attempts.sql', import.meta.url),
      'utf8',
    );
    const statements = parsePreviewMigration(migrationSql);
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query('BEGIN');
    transactionOpen = true;
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE user_knowledge_items (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        UNIQUE (id, user_id)
      )
    `);
    await client.query(
      'INSERT INTO user_knowledge_items (id, user_id) VALUES ($1, $2)',
      [itemId, userId],
    );
    for (const statement of statements) await client.query(statement);
    await client.query(`
      INSERT INTO recall_attempts (
        id, user_id, knowledge_item_id, item_version, schedule_version,
        recall_enrolled_at, milestone, exercise_type,
        started_at, retention_expires_at
      ) VALUES
        (
          $1, $3, $4, 1, 1, NOW() - INTERVAL '367 days', 'd1', 'concept',
          NOW() - INTERVAL '366 days', NOW() - INTERVAL '1 day'
        ),
        (
          $2, $3, $4, 1, 1, NOW() - INTERVAL '2 days', 'd7', 'concept',
          NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day'
        )
    `, [expiredAttemptId, currentAttemptId, userId, itemId]);

    repositoryDb.query = async (text, params) => {
      const result = await client.query(text, params ?? []);
      return { rows: result.rows };
    };

    assert.equal(await attempts.purgeExpiredRecallAttempts(), 1);
    assert.deepEqual((await client.query(`
      SELECT id, lifecycle_state
      FROM recall_attempts
      ORDER BY id
    `)).rows, [{ id: currentAttemptId, lifecycle_state: 'prepared' }]);
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    repositoryDb.query = originalQuery;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (transactionOpen) {
      await collectCleanupFailure(cleanupFailures, 'rollback retention transaction', async () => {
        await client.query('ROLLBACK');
        transactionOpen = false;
      });
    }
    await collectCleanupFailure(cleanupFailures, 'reset retention search path', () => (
      client.query('RESET search_path')
    ));
    await collectCleanupFailure(cleanupFailures, 'drop retention schema', () => (
      client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    ));
    await collectCleanupFailure(cleanupFailures, 'verify retention schema removal', async () => {
      const remaining = (await client.query(
        `SELECT COUNT(*)::integer AS count
         FROM information_schema.schemata
         WHERE schema_name = $1`,
        [schemaName],
      )).rows[0]?.count;
      assert.equal(remaining, 0);
    });
    await collectCleanupFailure(cleanupFailures, 'release retention database client', async () => {
      client.release();
    });
    await collectCleanupFailure(cleanupFailures, 'close retention database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Recall prepared attempts start once, require confidence, reveal idempotently, and invalidate stale revisions', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const importedRecall = await import('../src/lib/recall-persistence.ts');
  const recall = importedRecall.default ?? importedRecall;
  const importedAttempts = await import('../src/lib/recall-attempts.ts');
  const attempts = importedAttempts.default ?? importedAttempts;
  const importedPractice = await import('../src/lib/private-practice-cards.ts');
  const practice = importedPractice.default ?? importedPractice;
  const importedAccountPurge = await import('../src/lib/account-private-purge.ts');
  const accountPurge = importedAccountPurge.default ?? importedAccountPurge;
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const repositoryAdapter = await installRepositoryPgAdapter(pool);
  const userId = `live-attempt-owner-${crypto.randomUUID()}`;
  const itemId = `live-attempt-item-${crypto.randomUUID()}`;
  const batchId = `live-attempt-batch-${crypto.randomUUID()}`;
  const draftId = `live-attempt-draft-${crypto.randomUUID()}`;
  const sourceId = `live-attempt-source-${crypto.randomUUID()}`;
  const revisionId = `live-attempt-revision-${crypto.randomUUID()}`;
  const now = Date.now();
  const enrolledAt = new Date(now - 25 * 60 * 60 * 1_000).toISOString();
  const firstDueAt = new Date(now - 30 * 60 * 1_000).toISOString();
  let bodyCompleted = false;
  try {
    await pool.query(
      `INSERT INTO user_knowledge_items (
         id, user_id, title, summary, content, topic, tags, knowledge_type,
         central_question, structured_content, bundle_schema_version, version
       ) VALUES (
         $1, $2, 'Prepared attempt fixture', '', '', 'recall-live', '[]'::jsonb,
         'concept', 'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1, 1
       )`,
      [itemId, userId],
    );
    await pool.query(
      `INSERT INTO knowledge_item_revisions
         (id, user_id, knowledge_item_id, version, snapshot, change_reason)
       VALUES ($1, $2, $3, 1, '{}'::jsonb, 'confirmed')`,
      [revisionId, userId, itemId],
    );
    await pool.query(
      `INSERT INTO knowledge_ingestion_batches (
         id, user_id, source_type, provider, scope, request_id, status, committed_at
       ) VALUES ($1, $2, 'conversation', 'chatgpt', 'current_conversation', $3, 'approved', NOW())`,
      [batchId, userId, `live-attempt-request-${crypto.randomUUID()}`],
    );
    await pool.query(
      `INSERT INTO knowledge_card_drafts (
         id, batch_id, user_id, client_card_id, title, knowledge_type,
         central_question, structured_content, bundle_schema_version,
         status, knowledge_item_id, approved_at
       ) VALUES (
         $1, $2, $3, $4, 'Prepared attempt fixture', 'concept',
         'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1,
         'approved', $5, NOW()
       )`,
      [draftId, batchId, userId, `live-attempt-card-${crypto.randomUUID()}`, itemId],
    );
    await pool.query(
      `INSERT INTO knowledge_card_sources (
         id, user_id, knowledge_item_id, batch_id, draft_id, source_type,
         provider, conversation_ref, supported_item_version, confirmed_at
       ) VALUES ($1, $2, $3, $4, $5, 'conversation', 'chatgpt', $6, 1, NOW())`,
      [sourceId, userId, itemId, batchId, draftId, `conversation-${crypto.randomUUID()}`],
    );

    const enrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      1,
      enrolledAt,
      firstDueAt,
    );
    assert.equal(enrollment.kind, 'enrolled');

    const starts = await Promise.all([
      attempts.startOrResumeRecallAttemptForUser(userId, itemId),
      attempts.startOrResumeRecallAttemptForUser(userId, itemId),
    ]);
    assert.deepEqual(starts.map((result) => result.kind).sort(), ['resumed', 'started']);
    const activeAttempt = starts[0].attempt;
    assert.ok(activeAttempt);
    assert.equal(activeAttempt.state, 'prepared');
    assert.equal(activeAttempt.milestone, 'd1');
    assert.equal(activeAttempt.exerciseType, 'concept');
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM recall_attempts
       WHERE user_id = $1
         AND knowledge_item_id = $2
         AND lifecycle_state IN ('prepared', 'confidence_selected', 'revealed')`,
      [userId, itemId],
    )).rows[0]?.count, 1);

    assert.deepEqual(
      await attempts.revealRecallAttemptForUser(userId, activeAttempt.id),
      { kind: 'confidence_required', attempt: null },
    );
    const confidence = await attempts.setRecallAttemptConfidenceForUser(
      userId,
      activeAttempt.id,
      'medium',
    );
    assert.equal(confidence.kind, 'selected');
    const reveal = await attempts.revealRecallAttemptForUser(userId, activeAttempt.id);
    assert.equal(reveal.kind, 'revealed');
    assert.equal(reveal.attempt?.state, 'revealed');
    assert.equal((await attempts.revealRecallAttemptForUser(userId, activeAttempt.id)).kind, 'unchanged');

    await pool.query(
      'UPDATE user_knowledge_items SET version = 2 WHERE id = $1 AND user_id = $2',
      [itemId, userId],
    );
    assert.deepEqual(
      await attempts.resumeRecallAttemptForUser(userId, activeAttempt.id),
      { kind: 'invalidated', attempt: null },
    );
    assert.equal((await pool.query(
      `SELECT invalidation_reason
       FROM recall_attempts WHERE id = $1 AND user_id = $2`,
      [activeAttempt.id, userId],
    )).rows[0]?.invalidation_reason, 'stale_context');

    await pool.query(
      'UPDATE user_knowledge_items SET version = 1 WHERE id = $1 AND user_id = $2',
      [itemId, userId],
    );
    const scheduleDriftAttempt = await attempts.startOrResumeRecallAttemptForUser(userId, itemId);
    assert.equal(scheduleDriftAttempt.kind, 'started');
    assert.ok(scheduleDriftAttempt.attempt);
    assert.equal((await pool.query(
      `UPDATE user_private_card_states
       SET recall_schedule_version = recall_schedule_version + 1
       WHERE user_id = $1 AND knowledge_item_id = $2
       RETURNING recall_schedule_version`,
      [userId, itemId],
    )).rows[0]?.recall_schedule_version, scheduleDriftAttempt.attempt.scheduleVersion + 1);
    assert.deepEqual(
      await attempts.resumeRecallAttemptForUser(userId, scheduleDriftAttempt.attempt.id),
      { kind: 'invalidated', attempt: null },
    );
    assert.deepEqual((await pool.query(
      `SELECT lifecycle_state, invalidation_reason,
         invalidated_at IS NOT NULL AS invalidated_at_recorded
       FROM recall_attempts WHERE id = $1 AND user_id = $2`,
      [scheduleDriftAttempt.attempt.id, userId],
    )).rows[0], {
      lifecycle_state: 'invalidated',
      invalidation_reason: 'stale_context',
      invalidated_at_recorded: true,
    });

    const removalAttempt = await attempts.startOrResumeRecallAttemptForUser(userId, itemId);
    assert.equal(removalAttempt.kind, 'started');
    assert.equal(await practice.removePrivatePracticeCardState(userId, itemId), true);
    assert.equal((await pool.query(
      `SELECT lifecycle_state, invalidation_reason
       FROM recall_attempts
       WHERE id = $1 AND user_id = $2`,
      [removalAttempt.attempt?.id, userId],
    )).rows[0]?.invalidation_reason, 'item_removed');

    const resetEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      1,
      enrolledAt,
      firstDueAt,
    );
    assert.equal(resetEnrollment.kind, 'enrolled');
    assert.equal((await attempts.startOrResumeRecallAttemptForUser(userId, itemId)).kind, 'started');
    await practice.resetPrivatePracticeProgress(userId);
    assert.deepEqual((await pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM recall_attempts WHERE user_id = $1) AS attempt_count,
         (SELECT COUNT(*)::integer FROM user_private_card_states WHERE user_id = $1) AS state_count`,
      [userId],
    )).rows[0], { attempt_count: 0, state_count: 0 });

    const accountPurgeEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      1,
      enrolledAt,
      firstDueAt,
    );
    assert.equal(accountPurgeEnrollment.kind, 'enrolled');
    assert.equal((await attempts.startOrResumeRecallAttemptForUser(userId, itemId)).kind, 'started');
    const [accountPurgeResult] = await repositoryAdapter.transaction([
      accountPurge.buildPrivateProductPurgeQuery(userId),
    ]);
    assert.equal(Number(accountPurgeResult.rows[0]?.deleted_recall_attempts), 1);
    assert.deepEqual((await pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM recall_attempts WHERE user_id = $1) AS attempts,
         (SELECT COUNT(*)::integer FROM user_private_card_states WHERE user_id = $1) AS states,
         (SELECT COUNT(*)::integer FROM user_knowledge_items WHERE user_id = $1) AS items,
         (SELECT COUNT(*)::integer FROM knowledge_card_sources WHERE user_id = $1) AS sources,
         (SELECT COUNT(*)::integer FROM knowledge_card_drafts WHERE user_id = $1) AS drafts,
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches WHERE user_id = $1) AS batches,
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_request_tombstones WHERE user_id = $1) AS tombstones`,
      [userId],
    )).rows[0], {
      attempts: 0,
      states: 0,
      items: 0,
      sources: 0,
      drafts: 0,
      batches: 0,
      tombstones: 0,
    });
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    repositoryAdapter.restore();
    await collectCleanupFailure(cleanupFailures, 'delete prepared attempt knowledge item', () => (
      pool.query('DELETE FROM user_knowledge_items WHERE id = $1 AND user_id = $2', [itemId, userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete prepared attempt ingestion batch', () => (
      pool.query('DELETE FROM knowledge_ingestion_batches WHERE id = $1 AND user_id = $2', [batchId, userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete prepared attempt tombstones', () => (
      pool.query('DELETE FROM knowledge_ingestion_request_tombstones WHERE user_id = $1', [userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'verify prepared attempt fixture removal', async () => {
      const remaining = (await pool.query(
        `SELECT
           EXISTS (SELECT 1 FROM user_knowledge_items WHERE id = $1) AS item_exists,
           EXISTS (SELECT 1 FROM recall_attempts WHERE knowledge_item_id = $1) AS attempt_exists,
           EXISTS (SELECT 1 FROM user_private_card_states WHERE knowledge_item_id = $1) AS state_exists,
           EXISTS (SELECT 1 FROM knowledge_item_revisions WHERE id = $2) AS revision_exists,
           EXISTS (SELECT 1 FROM knowledge_card_sources WHERE id = $3) AS source_exists,
           EXISTS (SELECT 1 FROM knowledge_card_drafts WHERE id = $4) AS draft_exists,
           EXISTS (SELECT 1 FROM knowledge_ingestion_batches WHERE id = $5) AS batch_exists,
           EXISTS (SELECT 1 FROM knowledge_ingestion_request_tombstones WHERE user_id = $6) AS tombstone_exists`,
        [itemId, revisionId, sourceId, draftId, batchId, userId],
      )).rows[0];
      assert.deepEqual(remaining, {
        item_exists: false,
        attempt_exists: false,
        state_exists: false,
        revision_exists: false,
        source_exists: false,
        draft_exists: false,
        batch_exists: false,
        tombstone_exists: false,
      });
    });
    await collectCleanupFailure(cleanupFailures, 'close prepared attempt database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Recall completion atomically advances one schedule and resolves concurrent semantic replays', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const importedRecall = await import('../src/lib/recall-persistence.ts');
  const recall = importedRecall.default ?? importedRecall;
  const importedAttempts = await import('../src/lib/recall-attempts.ts');
  const attempts = importedAttempts.default ?? importedAttempts;
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
  const repositoryAdapter = await installRepositoryPgAdapter(pool);
  const userId = `live-completion-owner-${crypto.randomUUID()}`;
  const batchId = `live-completion-batch-${crypto.randomUUID()}`;
  const fixtures = [
    'same-replay',
    'conflicting-replay',
    'd7-remembered',
    'practice-cas-conflict',
  ].map((label) => ({
    label,
    itemId: `live-completion-${label}-${crypto.randomUUID()}`,
    draftId: `live-completion-draft-${crypto.randomUUID()}`,
    sourceId: `live-completion-source-${crypto.randomUUID()}`,
    revisionId: `live-completion-revision-${crypto.randomUUID()}`,
  }));
  const now = Date.now();
  const enrolledAt = new Date(now - 25 * 60 * 60 * 1_000).toISOString();
  const firstDueAt = new Date(now - 30 * 60 * 1_000).toISOString();
  const d7EnrolledAt = new Date(now - 169 * 60 * 60 * 1_000).toISOString();
  const d7DueAt = new Date(now - 15 * 60 * 1_000).toISOString();
  const nextD7DueAt = new Date(new Date(enrolledAt).getTime() + 170 * 60 * 60 * 1_000)
    .toISOString();
  let bodyCompleted = false;

  try {
    await pool.query(
      `INSERT INTO knowledge_ingestion_batches (
         id, user_id, source_type, provider, scope, request_id, status, committed_at
       ) VALUES ($1, $2, 'conversation', 'chatgpt', 'current_conversation', $3, 'approved', NOW())`,
      [batchId, userId, `live-completion-request-${crypto.randomUUID()}`],
    );
    for (const fixture of fixtures) {
      await pool.query(
        `INSERT INTO user_knowledge_items (
           id, user_id, title, summary, content, topic, tags, knowledge_type,
           central_question, structured_content, bundle_schema_version, version
         ) VALUES (
           $1, $2, $3, '', '', 'recall-live', '[]'::jsonb,
           'concept', 'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1, 1
         )`,
        [fixture.itemId, userId, `Completion ${fixture.label}`],
      );
      await pool.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         VALUES ($1, $2, $3, 1, '{}'::jsonb, 'confirmed')`,
        [fixture.revisionId, userId, fixture.itemId],
      );
      await pool.query(
        `INSERT INTO knowledge_card_drafts (
           id, batch_id, user_id, client_card_id, title, knowledge_type,
           central_question, structured_content, bundle_schema_version,
           status, knowledge_item_id, approved_at
         ) VALUES (
           $1, $2, $3, $4, $5, 'concept',
           'What should be reconstructed?', '{"type":"concept"}'::jsonb, 1,
           'approved', $6, NOW()
         )`,
        [
          fixture.draftId,
          batchId,
          userId,
          `live-completion-card-${crypto.randomUUID()}`,
          `Completion ${fixture.label}`,
          fixture.itemId,
        ],
      );
      await pool.query(
        `INSERT INTO knowledge_card_sources (
           id, user_id, knowledge_item_id, batch_id, draft_id, source_type,
           provider, conversation_ref, supported_item_version, confirmed_at
         ) VALUES ($1, $2, $3, $4, $5, 'conversation', 'chatgpt', $6, 1, NOW())`,
        [
          fixture.sourceId,
          userId,
          fixture.itemId,
          batchId,
          fixture.draftId,
          `conversation-${crypto.randomUUID()}`,
        ],
      );
      const enrollment = await recall.enrollApprovedRecallScheduleForUser(
        userId,
        fixture.itemId,
        1,
        enrolledAt,
        firstDueAt,
      );
      assert.equal(enrollment.kind, 'enrolled');
      if (fixture.label === 'd7-remembered') {
        await pool.query(
          `UPDATE user_private_card_states
           SET status = 'saved',
               knowledge_state = 'unknown',
               progress_state = 'learning',
               last_seen = $3::timestamptz,
               due_at = $4::timestamptz,
               recall_enrolled_at = $3::timestamptz,
               recall_schedule_state = 'd7_pending',
               recall_schedule_version = 2
           WHERE user_id = $1 AND knowledge_item_id = $2`,
          [userId, fixture.itemId, d7EnrolledAt, d7DueAt],
        );
      }
      const started = await attempts.startOrResumeRecallAttemptForUser(userId, fixture.itemId);
      assert.equal(started.kind, 'started');
      assert.ok(started.attempt);
      fixture.attemptId = started.attempt.id;
      const retention = await pool.query(
        `SELECT retention_expires_at
         FROM recall_attempts
         WHERE id = $1 AND user_id = $2`,
        [fixture.attemptId, userId],
      );
      fixture.retentionExpiresAt = retention.rows[0]?.retention_expires_at.toISOString();
      assert.equal((await attempts.setRecallAttemptConfidenceForUser(
        userId,
        fixture.attemptId,
        'medium',
      )).kind, 'selected');
      assert.equal((await attempts.revealRecallAttemptForUser(
        userId,
        fixture.attemptId,
      )).kind, 'revealed');
    }

    const resolveNextDeliveryAt = async (context) => {
      assert.equal(context.userId, userId);
      assert.equal(context.milestone, 'd1');
      return nextD7DueAt;
    };
    const sameInput = { outcome: 'partial', hintUsed: true };
    const sameRace = await Promise.all([
      attempts.completeRecallAttemptForUser(
        userId,
        fixtures[0].attemptId,
        sameInput,
        resolveNextDeliveryAt,
      ),
      attempts.completeRecallAttemptForUser(
        userId,
        fixtures[0].attemptId,
        sameInput,
        resolveNextDeliveryAt,
      ),
    ]);
    assert.deepEqual(sameRace.map((result) => result.kind).sort(), ['completed', 'unchanged']);

    const conflictingRace = await Promise.all([
      attempts.completeRecallAttemptForUser(
        userId,
        fixtures[1].attemptId,
        { outcome: 'remembered', hintUsed: false },
        resolveNextDeliveryAt,
      ),
      attempts.completeRecallAttemptForUser(
        userId,
        fixtures[1].attemptId,
        { outcome: 'missed', hintUsed: true },
        resolveNextDeliveryAt,
      ),
    ]);
    assert.deepEqual(
      conflictingRace.map((result) => result.kind).sort(),
      ['completed', 'conflict'],
    );

    let d7ResolverCalls = 0;
    const d7Completion = await attempts.completeRecallAttemptForUser(
      userId,
      fixtures[2].attemptId,
      { outcome: 'remembered', hintUsed: false },
      async () => {
        d7ResolverCalls += 1;
        return nextD7DueAt;
      },
    );
    assert.equal(d7Completion.kind, 'completed');
    assert.equal(d7ResolverCalls, 0);

    const concurrentPracticeLastSeen = new Date(now - 5 * 60 * 1_000).toISOString();
    const practiceCasConflict = await attempts.completeRecallAttemptForUser(
      userId,
      fixtures[3].attemptId,
      { outcome: 'partial', hintUsed: false },
      async (context) => {
        assert.equal(context.userId, userId);
        await pool.query(
          `UPDATE user_private_card_states
           SET status = 'saved',
               knowledge_state = 'unknown',
               progress_state = 'learning',
               last_seen = $3::timestamptz
           WHERE user_id = $1 AND knowledge_item_id = $2`,
          [userId, fixtures[3].itemId, concurrentPracticeLastSeen],
        );
        return nextD7DueAt;
      },
    );
    assert.deepEqual(practiceCasConflict, { kind: 'conflict', attempt: null });
    assert.deepEqual((await pool.query(
      `SELECT
         a.lifecycle_state,
         a.self_assessed_outcome,
         a.completed_at,
         a.resulting_due_at,
         s.recall_schedule_version,
         s.recall_schedule_state,
         s.due_at,
         s.status,
         s.knowledge_state,
         s.progress_state,
         s.last_seen
       FROM recall_attempts a
       JOIN user_private_card_states s
         ON s.user_id = a.user_id
        AND s.knowledge_item_id = a.knowledge_item_id
       WHERE a.user_id = $1 AND a.id = $2`,
      [userId, fixtures[3].attemptId],
    )).rows.map((row) => ({
      ...row,
      due_at: row.due_at.toISOString(),
      last_seen: row.last_seen.toISOString(),
    })), [{
      lifecycle_state: 'revealed',
      self_assessed_outcome: null,
      completed_at: null,
      resulting_due_at: null,
      recall_schedule_version: 1,
      recall_schedule_state: 'd1_pending',
      due_at: firstDueAt,
      status: 'saved',
      knowledge_state: 'unknown',
      progress_state: 'learning',
      last_seen: concurrentPracticeLastSeen,
    }]);

    const persisted = (await pool.query(
      `SELECT
         a.id,
         a.lifecycle_state,
         a.self_assessed_outcome,
         a.hint_used,
         a.response_duration_bucket,
         a.completed_at,
         a.resulting_due_at,
         a.retention_expires_at,
         s.recall_schedule_version,
         s.recall_schedule_state,
         s.due_at,
         s.status,
         s.knowledge_state,
         s.progress_state,
         s.last_seen
       FROM recall_attempts a
       JOIN user_private_card_states s
         ON s.user_id = a.user_id
        AND s.knowledge_item_id = a.knowledge_item_id
       WHERE a.user_id = $1
         AND a.id = ANY($2::text[])
       ORDER BY a.id`,
      [userId, fixtures.slice(0, 3).map((fixture) => fixture.attemptId)],
    )).rows;
    assert.equal(persisted.length, 3);
    for (const row of persisted) {
      const fixture = fixtures.find((candidate) => candidate.attemptId === row.id);
      assert.ok(fixture);
      assert.equal(row.lifecycle_state, 'completed');
      assert.ok(['remembered', 'partial', 'missed'].includes(row.self_assessed_outcome));
      assert.equal(typeof row.hint_used, 'boolean');
      assert.ok([
        'under_30s',
        '30_to_89s',
        '90_to_179s',
        '3_to_5m',
        'over_5m',
      ].includes(row.response_duration_bucket));
      if (fixture.label === 'd7-remembered') {
        assert.equal(row.self_assessed_outcome, 'remembered');
        assert.equal(row.recall_schedule_version, 3);
        assert.equal(row.recall_schedule_state, 'ordinary_practice');
        assert.equal(
          row.due_at.getTime() - row.completed_at.getTime(),
          14 * 24 * 60 * 60 * 1_000,
        );
        assert.equal(row.resulting_due_at.toISOString(), row.due_at.toISOString());
      } else {
        assert.equal(row.recall_schedule_version, 2);
        assert.equal(row.recall_schedule_state, 'd7_pending');
        assert.equal(row.resulting_due_at.toISOString(), nextD7DueAt);
        assert.equal(row.due_at.toISOString(), nextD7DueAt);
      }
      assert.equal(row.last_seen.toISOString(), row.completed_at.toISOString());
      assert.equal(row.retention_expires_at.toISOString(), fixture.retentionExpiresAt);
      if (row.self_assessed_outcome === 'remembered') {
        assert.deepEqual(
          [row.status, row.knowledge_state, row.progress_state],
          ['known', 'known', 'review'],
        );
      } else {
        assert.deepEqual(
          [row.status, row.knowledge_state, row.progress_state],
          ['saved', 'unknown', 'learning'],
        );
      }
    }

    const samePersisted = persisted.find((row) => row.id === fixtures[0].attemptId);
    assert.ok(samePersisted);
    await pool.query(
      `UPDATE user_private_card_states
       SET recall_schedule_version = recall_schedule_version + 1
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, fixtures[0].itemId],
    );
    assert.equal((await attempts.completeRecallAttemptForUser(
      userId,
      fixtures[0].attemptId,
      {
        outcome: samePersisted.self_assessed_outcome,
        hintUsed: samePersisted.hint_used,
      },
      async () => {
        throw new Error('A completed replay must not resolve another delivery instant.');
      },
    )).kind, 'unchanged');
    assert.equal((await attempts.completeRecallAttemptForUser(
      userId,
      fixtures[0].attemptId,
      {
        outcome: samePersisted.self_assessed_outcome,
        hintUsed: !samePersisted.hint_used,
      },
      async () => {
        throw new Error('A conflicting replay must not resolve another delivery instant.');
      },
    )).kind, 'conflict');
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    repositoryAdapter.restore();
    await collectCleanupFailure(cleanupFailures, 'delete completion knowledge items', () => (
      pool.query(
        'DELETE FROM user_knowledge_items WHERE user_id = $1 AND id = ANY($2::text[])',
        [userId, fixtures.map((fixture) => fixture.itemId)],
      )
    ));
    await collectCleanupFailure(cleanupFailures, 'delete completion ingestion batch', () => (
      pool.query('DELETE FROM knowledge_ingestion_batches WHERE id = $1 AND user_id = $2', [batchId, userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete completion tombstones', () => (
      pool.query('DELETE FROM knowledge_ingestion_request_tombstones WHERE user_id = $1', [userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'verify completion fixture removal', async () => {
      const remaining = (await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE id = ANY($1::text[]))::integer AS items,
           (SELECT COUNT(*)::integer FROM recall_attempts WHERE user_id = $2) AS attempts,
           (SELECT COUNT(*)::integer FROM user_private_card_states WHERE user_id = $2) AS states,
           (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches WHERE id = $3) AS batches
         FROM user_knowledge_items`,
        [fixtures.map((fixture) => fixture.itemId), userId, batchId],
      )).rows[0];
      assert.deepEqual(remaining, { items: 0, attempts: 0, states: 0, batches: 0 });
    });
    await collectCleanupFailure(cleanupFailures, 'close completion database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('Private Practice executes Recall-compatible due, rating, removal, and reset SQL', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const importedPractice = await import('../src/lib/private-practice-cards.ts');
  const practice = importedPractice.default ?? importedPractice;
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const repositoryAdapter = await installRepositoryPgAdapter(pool);
  const userId = `live-practice-owner-${crypto.randomUUID()}`;
  const itemIds = {
    plain: `live-practice-plain-${crypto.randomUUID()}`,
    activeNull: `live-practice-active-null-${crypto.randomUUID()}`,
    dueKnown: `live-practice-due-known-${crypto.randomUUID()}`,
    futureKnown: `live-practice-future-known-${crypto.randomUUID()}`,
    terminalNull: `live-practice-terminal-null-${crypto.randomUUID()}`,
  };
  const now = Date.now();
  const d1EnrolledAt = new Date(now).toISOString();
  const d1DueAt = new Date(now + 24 * 60 * 60 * 1_000).toISOString();
  const d7EnrolledAt = new Date(now - 169 * 60 * 60 * 1_000).toISOString();
  const dueKnownAt = new Date(now - 30 * 60 * 1_000).toISOString();
  const futureKnownAt = new Date(now + 30 * 60 * 1_000).toISOString();
  const terminalEnrolledAt = new Date(now - 193 * 60 * 60 * 1_000).toISOString();
  const terminalDueAt = new Date(now - 60 * 1_000).toISOString();
  let bodyCompleted = false;

  try {
    for (const [label, itemId] of Object.entries(itemIds)) {
      await pool.query(
        `INSERT INTO user_knowledge_items (
           id, user_id, title, summary, content, topic, tags, knowledge_type,
           central_question, structured_content, bundle_schema_version, version
         ) VALUES (
           $1, $2, $3, '', '', 'recall-live', '[]'::jsonb,
           'concept', 'What should be reconstructed?',
           '{"type":"concept","definition":"A private definition.","key_points":[],"examples":[],"non_examples":[],"misconceptions":[]}'::jsonb,
           1, 1
         )`,
        [itemId, userId, `Recall Practice ${label}`],
      );
    }

    await pool.query(
      `INSERT INTO user_private_card_states (
         user_id, knowledge_item_id, status, knowledge_state, progress_state,
         due_at, last_seen, recall_enrolled_at, recall_item_version,
         recall_schedule_state, recall_d1_finalized_incomplete,
         recall_d7_outcome, recall_schedule_version
       ) VALUES
         ($1, $2, NULL, NULL, NULL, $3, NULL, $4, 1, 'd1_pending', FALSE, NULL, 1),
         ($1, $5, 'known', 'known', 'review', $6, $7, $8, 1, 'd7_pending', FALSE, NULL, 2),
         ($1, $9, 'known', 'known', 'review', $10, $7, $8, 1, 'd7_pending', FALSE, NULL, 2),
         ($1, $11, NULL, NULL, NULL, $12, NULL, $13, 1, 'ordinary_practice', TRUE, 'unassessed', 3)`,
      [
        userId,
        itemIds.activeNull,
        d1DueAt,
        d1EnrolledAt,
        itemIds.dueKnown,
        dueKnownAt,
        d7EnrolledAt,
        d7EnrolledAt,
        itemIds.futureKnown,
        futureKnownAt,
        itemIds.terminalNull,
        terminalDueAt,
        terminalEnrolledAt,
      ],
    );

    const newIds = (await practice.getEligiblePrivatePracticeCards(userId, 'new'))
      .map((card) => card.id)
      .sort();
    assert.deepEqual(newIds, [
      practice.toPersonalCardId(itemIds.plain),
      practice.toPersonalCardId(itemIds.terminalNull),
    ].sort());

    const reviewIds = (await practice.getEligiblePrivatePracticeCards(userId, 'review'))
      .map((card) => card.id);
    assert.ok(!reviewIds.includes(practice.toPersonalCardId(itemIds.dueKnown)));
    assert.ok(!reviewIds.includes(practice.toPersonalCardId(itemIds.futureKnown)));

    assert.deepEqual(
      await practice.savePrivatePracticeCardState(userId, itemIds.dueKnown, 'saved'),
      { kind: 'active_recall' },
    );
    assert.deepEqual((await pool.query(
      `SELECT status, recall_schedule_state, recall_schedule_version
       FROM user_private_card_states
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemIds.dueKnown],
    )).rows, [{ status: 'known', recall_schedule_state: 'd7_pending', recall_schedule_version: 2 }]);

    assert.deepEqual(
      await practice.savePrivatePracticeCardState(userId, itemIds.terminalNull, 'saved'),
      { kind: 'saved' },
    );
    assert.deepEqual((await pool.query(
      `SELECT status, recall_schedule_state, recall_d7_outcome, recall_schedule_version
       FROM user_private_card_states
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemIds.terminalNull],
    )).rows, [{
      status: 'saved',
      recall_schedule_state: 'ordinary_practice',
      recall_d7_outcome: 'unassessed',
      recall_schedule_version: 3,
    }]);

    const terminalReviewIds = (await practice.getEligiblePrivatePracticeCards(userId, 'review'))
      .map((card) => card.id);
    assert.ok(terminalReviewIds.includes(practice.toPersonalCardId(itemIds.terminalNull)));
    assert.deepEqual(await practice.getPrivatePracticeStats(userId), {
      known_count: 2,
      saved_count: 1,
      reviewable_count: 1,
    });

    assert.equal(await practice.removePrivatePracticeCardState(userId, itemIds.dueKnown), true);
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count FROM user_private_card_states
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemIds.dueKnown],
    )).rows[0]?.count, 0);

    await practice.resetPrivatePracticeProgress(userId);
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count FROM user_private_card_states WHERE user_id = $1`,
      [userId],
    )).rows[0]?.count, 0);
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    repositoryAdapter.restore();
    await collectCleanupFailure(cleanupFailures, 'delete private Practice fixtures', () => (
      pool.query('DELETE FROM user_knowledge_items WHERE user_id = $1', [userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'verify private Practice fixture removal', async () => {
      const remaining = (await pool.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM user_knowledge_items WHERE user_id = $1) AS item_count,
           (SELECT COUNT(*)::integer FROM user_private_card_states WHERE user_id = $1) AS state_count`,
        [userId],
      )).rows[0];
      assert.deepEqual(remaining, { item_count: 0, state_count: 0 });
    });
    await collectCleanupFailure(cleanupFailures, 'close private Practice database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});

test('knowledge revision and Trash cleanup remove stale Recall state and permit owner re-enrollment', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const importedRecall = await import('../src/lib/recall-persistence.ts');
  const recall = importedRecall.default ?? importedRecall;
  const importedAttempts = await import('../src/lib/recall-attempts.ts');
  const attempts = importedAttempts.default ?? importedAttempts;
  const importedLifecycle = await import('../src/lib/recall-lifecycle-cleanup.ts');
  const lifecycle = importedLifecycle.default ?? importedLifecycle;
  const pool = new Pool({ connectionString: databaseUrl, max: 3 });
  const repositoryAdapter = await installRepositoryPgAdapter(pool);
  const userId = `live-recall-revision-owner-${crypto.randomUUID()}`;
  const itemId = `live-recall-revision-item-${crypto.randomUUID()}`;
  const batchId = `live-recall-revision-batch-${crypto.randomUUID()}`;
  const draftId = `live-recall-revision-draft-${crypto.randomUUID()}`;
  const sourceId = `live-recall-revision-source-${crypto.randomUUID()}`;
  let trashClient = null;
  let trashTransactionOpen = false;
  let concurrentStartPromise = null;
  let bodyCompleted = false;

  try {
    await pool.query(
      `INSERT INTO user_knowledge_items (
         id, user_id, title, summary, content, topic, tags, knowledge_type,
         central_question, structured_content, bundle_schema_version, version
       ) VALUES (
         $1, $2, 'Recall revision fixture', '', '', 'recall-live', '[]'::jsonb,
         'concept', 'What changed?', '{"type":"concept"}'::jsonb, 1, 1
       )`,
      [itemId, userId],
    );
    await pool.query(
      `INSERT INTO knowledge_item_revisions
         (id, user_id, knowledge_item_id, version, snapshot, change_reason)
       VALUES ($1, $2, $3, 1, '{}'::jsonb, 'confirmed')`,
      [crypto.randomUUID(), userId, itemId],
    );
    await pool.query(
      `INSERT INTO knowledge_ingestion_batches (
         id, user_id, source_type, provider, scope, request_id, status, committed_at
       ) VALUES ($1, $2, 'conversation', 'chatgpt', 'current_conversation', $3, 'approved', NOW())`,
      [batchId, userId, `live-recall-revision-${crypto.randomUUID()}`],
    );
    await pool.query(
      `INSERT INTO knowledge_card_drafts (
         id, batch_id, user_id, client_card_id, title, knowledge_type,
         central_question, structured_content, bundle_schema_version,
         status, knowledge_item_id, approved_at
       ) VALUES (
         $1, $2, $3, $4, 'Recall revision fixture', 'concept', 'What changed?',
         '{"type":"concept"}'::jsonb, 1, 'approved', $5, NOW()
       )`,
      [draftId, batchId, userId, `live-recall-revision-card-${crypto.randomUUID()}`, itemId],
    );
    await pool.query(
      `INSERT INTO knowledge_card_sources (
         id, user_id, knowledge_item_id, batch_id, draft_id, source_type,
         provider, conversation_ref, supported_item_version, confirmed_at
       ) VALUES ($1, $2, $3, $4, $5, 'conversation', 'chatgpt', $6, 1, NOW())`,
      [sourceId, userId, itemId, batchId, draftId, `conversation-${crypto.randomUUID()}`],
    );

    const firstEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      1,
      '2026-09-03T00:00:00.000Z',
      '2026-09-04T00:00:00.000Z',
    );
    assert.equal(firstEnrollment.kind, 'enrolled');
    await pool.query(
      `INSERT INTO recall_attempts (
         id, user_id, knowledge_item_id, item_version, schedule_version,
         recall_enrolled_at, milestone, exercise_type
       ) VALUES ($1, $2, $3, 1, 1, $4, 'd1', 'concept')`,
      [crypto.randomUUID(), userId, itemId, firstEnrollment.schedule.snapshot.enrolledAt],
    );

    const firstLock = lifecycle.buildRecallLifecycleLockQuery(userId, itemId);
    const firstCleanup = lifecycle.buildStaleRecallEnrollmentCleanupQuery(userId, itemId);
    const firstResults = await repositoryAdapter.transaction([
      firstLock,
      {
        text: `INSERT INTO knowledge_item_revisions
          (id, user_id, knowledge_item_id, version, snapshot, change_reason)
          VALUES ($1, $2, $3, 2, '{}'::jsonb, 'manual_update')`,
        params: [crypto.randomUUID(), userId, itemId],
      },
      {
        text: 'UPDATE user_knowledge_items SET version = 2, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        params: [itemId, userId],
      },
      {
        text: 'UPDATE knowledge_card_sources SET supported_item_version = 2 WHERE id = $1 AND user_id = $2',
        params: [sourceId, userId],
      },
      firstCleanup,
    ]);
    assert.deepEqual(firstResults.at(-1)?.rows, [{
      invalidated_attempts: 1,
      deleted_states: 1,
      cleared_states: 0,
    }]);
    assert.deepEqual((await pool.query(
      `SELECT lifecycle_state, invalidation_reason
       FROM recall_attempts WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    )).rows, [{ lifecycle_state: 'invalidated', invalidation_reason: 'stale_context' }]);

    const secondEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      2,
      '2026-09-10T00:00:00.000Z',
      '2026-09-11T00:00:00.000Z',
    );
    assert.equal(secondEnrollment.kind, 'enrolled');
    await pool.query(
      `UPDATE user_private_card_states
       SET status = 'saved', knowledge_state = 'unknown', progress_state = 'learning', last_seen = NOW()
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    );
    await pool.query(
      `INSERT INTO recall_attempts (
         id, user_id, knowledge_item_id, item_version, schedule_version,
         recall_enrolled_at, milestone, exercise_type
       ) VALUES ($1, $2, $3, 2, 1, $4, 'd1', 'concept')`,
      [crypto.randomUUID(), userId, itemId, secondEnrollment.schedule.snapshot.enrolledAt],
    );

    const secondCleanup = lifecycle.buildStaleRecallEnrollmentCleanupQuery(userId, itemId);
    const secondResults = await repositoryAdapter.transaction([
      firstLock,
      {
        text: `INSERT INTO knowledge_item_revisions
          (id, user_id, knowledge_item_id, version, snapshot, change_reason)
          VALUES ($1, $2, $3, 3, '{}'::jsonb, 'manual_update')`,
        params: [crypto.randomUUID(), userId, itemId],
      },
      {
        text: 'UPDATE user_knowledge_items SET version = 3, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        params: [itemId, userId],
      },
      {
        text: 'UPDATE knowledge_card_sources SET supported_item_version = 3 WHERE id = $1 AND user_id = $2',
        params: [sourceId, userId],
      },
      secondCleanup,
    ]);
    assert.deepEqual(secondResults.at(-1)?.rows, [{
      invalidated_attempts: 1,
      deleted_states: 0,
      cleared_states: 1,
    }]);
    assert.deepEqual((await pool.query(
      `SELECT status, knowledge_state, progress_state, recall_enrolled_at, recall_item_version
       FROM user_private_card_states WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    )).rows, [{
      status: 'saved',
      knowledge_state: 'unknown',
      progress_state: 'learning',
      recall_enrolled_at: null,
      recall_item_version: null,
    }]);

    const thirdEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId,
      itemId,
      3,
      new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString(),
      new Date(Date.now() - 30 * 60 * 1_000).toISOString(),
    );
    assert.equal(thirdEnrollment.kind, 'enrolled');
    assert.equal(thirdEnrollment.schedule.practice.status, 'saved');
    assert.equal(thirdEnrollment.schedule.practice.knowledgeState, 'unknown');
    assert.equal(thirdEnrollment.schedule.practice.progressState, 'learning');
    assert.match(thirdEnrollment.schedule.practice.lastSeen, /^\d{4}-\d{2}-\d{2}T/);

    await pool.query(
      `UPDATE user_private_card_states
       SET status = NULL, knowledge_state = NULL, progress_state = NULL, last_seen = NULL
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    );
    const unassessedAttempt = await attempts.startOrResumeRecallAttemptForUser(userId, itemId);
    assert.equal(unassessedAttempt.kind, 'started');
    assert.ok(unassessedAttempt.attempt);

    const knowledgeLock = {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [`knowledge-item:${userId}:${itemId}`],
    };
    const trashCleanup = lifecycle.buildStaleRecallEnrollmentCleanupQuery(userId, itemId);
    trashClient = await pool.connect();
    await trashClient.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    trashTransactionOpen = true;
    const trashBackendPid = (await trashClient.query(
      'SELECT pg_backend_pid()::integer AS pid',
    )).rows[0]?.pid;
    await trashClient.query(firstLock.text, firstLock.params);

    concurrentStartPromise = attempts.startOrResumeRecallAttemptForUser(userId, itemId);
    let blockedStart = [];
    for (let probe = 0; probe < 100; probe += 1) {
      blockedStart = (await pool.query(
        `SELECT waiter.pid::integer AS pid
         FROM pg_locks holder
         JOIN pg_locks waiter
           ON waiter.locktype = holder.locktype
          AND waiter.database IS NOT DISTINCT FROM holder.database
          AND waiter.classid IS NOT DISTINCT FROM holder.classid
          AND waiter.objid IS NOT DISTINCT FROM holder.objid
          AND waiter.objsubid IS NOT DISTINCT FROM holder.objsubid
         WHERE holder.pid = $1
           AND holder.locktype = 'advisory'
           AND holder.granted
           AND NOT waiter.granted`,
        [trashBackendPid],
      )).rows;
      if (blockedStart.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(blockedStart.length, 1);

    await trashClient.query(knowledgeLock.text, knowledgeLock.params);
    await trashClient.query(
      `UPDATE user_knowledge_items
       SET deleted_at = NOW(), purge_at = NOW() + INTERVAL '14 days', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [itemId, userId],
    );
    assert.deepEqual((await trashClient.query(trashCleanup.text, trashCleanup.params)).rows, [{
      invalidated_attempts: 1,
      deleted_states: 1,
      cleared_states: 0,
    }]);
    await trashClient.query('COMMIT');
    trashTransactionOpen = false;
    assert.deepEqual(await concurrentStartPromise, { kind: 'not_available', attempt: null });
    concurrentStartPromise = null;
    trashClient.release();
    trashClient = null;

    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM user_private_card_states WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    )).rows[0]?.count, 0);
    assert.deepEqual((await pool.query(
      `SELECT lifecycle_state, invalidation_reason
       FROM recall_attempts WHERE id = $1 AND user_id = $2`,
      [unassessedAttempt.attempt.id, userId],
    )).rows[0], { lifecycle_state: 'invalidated', invalidation_reason: 'stale_context' });

    const restoreDeletedItem = async (nextVersion) => {
      const restoreResults = await repositoryAdapter.transaction([
        firstLock,
        knowledgeLock,
        {
          text: `WITH restored_item AS (
            UPDATE user_knowledge_items
            SET deleted_at = NULL, purge_at = NULL, version = version + 1, updated_at = NOW()
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL
            RETURNING id, user_id, version
          )
          INSERT INTO knowledge_item_revisions
            (id, user_id, knowledge_item_id, version, snapshot, change_reason)
          SELECT $3, user_id, id, version, '{}'::jsonb, 'restored'
          FROM restored_item
          RETURNING version`,
          params: [itemId, userId, crypto.randomUUID()],
        },
        lifecycle.buildStaleRecallEnrollmentCleanupQuery(userId, itemId),
      ]);
      assert.deepEqual(restoreResults[2]?.rows, [{ version: nextVersion }]);
      assert.deepEqual(restoreResults.at(-1)?.rows, [{
        invalidated_attempts: 0,
        deleted_states: 0,
        cleared_states: 0,
      }]);
    };

    await restoreDeletedItem(4);
    const fourthEnrolledAt = new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString();
    const fourthDueAt = new Date(Date.now() - 30 * 60 * 1_000).toISOString();
    assert.deepEqual(await recall.enrollApprovedRecallScheduleForUser(
      userId, itemId, 4, fourthEnrolledAt, fourthDueAt,
    ), { kind: 'ineligible', schedule: null });
    await pool.query(
      'UPDATE knowledge_card_sources SET supported_item_version = 4 WHERE id = $1 AND user_id = $2',
      [sourceId, userId],
    );
    const fourthEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId, itemId, 4, fourthEnrolledAt, fourthDueAt,
    );
    assert.equal(fourthEnrollment.kind, 'enrolled');
    assert.deepEqual(fourthEnrollment.schedule.practice, {
      status: null,
      knowledgeState: null,
      progressState: null,
      lastSeen: null,
    });

    await pool.query(
      `UPDATE user_private_card_states
       SET status = 'saved', knowledge_state = 'unknown', progress_state = 'learning', last_seen = NOW()
       WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    );
    const assessedAttempt = await attempts.startOrResumeRecallAttemptForUser(userId, itemId);
    assert.equal(assessedAttempt.kind, 'started');
    assert.ok(assessedAttempt.attempt);

    const assessedTrashResults = await repositoryAdapter.transaction([
      firstLock,
      knowledgeLock,
      {
        text: `UPDATE user_knowledge_items
          SET deleted_at = NOW(), purge_at = NOW() + INTERVAL '14 days', updated_at = NOW()
          WHERE id = $1 AND user_id = $2`,
        params: [itemId, userId],
      },
      lifecycle.buildStaleRecallEnrollmentCleanupQuery(userId, itemId),
    ]);
    assert.deepEqual(assessedTrashResults.at(-1)?.rows, [{
      invalidated_attempts: 1,
      deleted_states: 0,
      cleared_states: 1,
    }]);
    assert.deepEqual((await pool.query(
      `SELECT lifecycle_state, invalidation_reason
       FROM recall_attempts WHERE id = $1 AND user_id = $2`,
      [assessedAttempt.attempt.id, userId],
    )).rows[0], { lifecycle_state: 'invalidated', invalidation_reason: 'stale_context' });
    assert.deepEqual((await pool.query(
      `SELECT status, knowledge_state, progress_state,
         last_seen IS NOT NULL AS last_seen_recorded,
         recall_enrolled_at, recall_item_version
       FROM user_private_card_states WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, itemId],
    )).rows, [{
      status: 'saved',
      knowledge_state: 'unknown',
      progress_state: 'learning',
      last_seen_recorded: true,
      recall_enrolled_at: null,
      recall_item_version: null,
    }]);

    await restoreDeletedItem(5);
    const fifthEnrolledAt = new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString();
    const fifthDueAt = new Date(Date.now() - 30 * 60 * 1_000).toISOString();
    assert.deepEqual(await recall.enrollApprovedRecallScheduleForUser(
      userId, itemId, 5, fifthEnrolledAt, fifthDueAt,
    ), { kind: 'ineligible', schedule: null });
    await pool.query(
      'UPDATE knowledge_card_sources SET supported_item_version = 5 WHERE id = $1 AND user_id = $2',
      [sourceId, userId],
    );
    const fifthEnrollment = await recall.enrollApprovedRecallScheduleForUser(
      userId, itemId, 5, fifthEnrolledAt, fifthDueAt,
    );
    assert.equal(fifthEnrollment.kind, 'enrolled');
    assert.equal(fifthEnrollment.schedule.practice.status, 'saved');
    assert.equal(fifthEnrollment.schedule.practice.knowledgeState, 'unknown');
    assert.equal(fifthEnrollment.schedule.practice.progressState, 'learning');
    assert.match(fifthEnrollment.schedule.practice.lastSeen, /^\d{4}-\d{2}-\d{2}T/);
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    if (trashTransactionOpen && trashClient) {
      await collectCleanupFailure(cleanupFailures, 'rollback Trash lifecycle transaction', async () => {
        await trashClient.query('ROLLBACK');
        trashTransactionOpen = false;
      });
    }
    if (concurrentStartPromise) {
      await collectCleanupFailure(cleanupFailures, 'settle concurrent Recall start', () => concurrentStartPromise);
    }
    if (trashClient) {
      trashClient.release();
      trashClient = null;
    }
    repositoryAdapter.restore();
    await collectCleanupFailure(cleanupFailures, 'delete revision lifecycle knowledge item', () => (
      pool.query('DELETE FROM user_knowledge_items WHERE id = $1 AND user_id = $2', [itemId, userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete revision lifecycle ingestion batch', () => (
      pool.query('DELETE FROM knowledge_ingestion_batches WHERE id = $1 AND user_id = $2', [batchId, userId])
    ));
    await collectCleanupFailure(cleanupFailures, 'close revision lifecycle database pool', () => pool.end());
    surfaceCleanupFailures(bodyCompleted, cleanupFailures);
  }
});
