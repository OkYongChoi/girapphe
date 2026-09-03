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

test('Recall migration bootstraps an absent Practice table, preserves rows, and enforces honest snapshots', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Recall test',
}, async (context) => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const bootstrapSchemaName = `recall_bootstrap_${crypto.randomUUID().replaceAll('-', '_')}`;
  const bootstrapSchema = quoteIdentifier(bootstrapSchemaName);
  const schemaName = `recall_test_${crypto.randomUUID().replaceAll('-', '_')}`;
  const schema = quoteIdentifier(schemaName);
  const enrolledAt = '2026-09-03T00:00:00.000Z';
  let bodyCompleted = false;

  try {
    const migrationSql = await readFile(
      new URL('../drizzle/migrations/0019_recall_ping_persistence.sql', import.meta.url),
      'utf8',
    );
    const statements = parsePreviewMigration(migrationSql);
    await client.query(`CREATE SCHEMA ${bootstrapSchema}`);
    await client.query(`SET search_path TO ${bootstrapSchema}, public`);
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
    await client.query('RESET search_path');

    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
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
      await client.query('BEGIN');
      try {
        for (const statement of statements) await client.query(statement);
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          context.diagnostic('ROLLBACK cleanup also failed; preserving the primary migration error.');
        }
        throw error;
      }
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
      await assert.rejects(client.query(`
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
      await assert.rejects(client.query(`
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
    await assert.rejects(client.query(`
      INSERT INTO knowledge_card_sources (id, knowledge_item_id, supported_item_version)
      VALUES ('false-source', 'historical-item', 2)
    `), /knowledge_card_sources_supported_revision_fk/);
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    await collectCleanupFailure(cleanupFailures, 'reset isolated search path', () => (
      client.query('RESET search_path')
    ));
    await collectCleanupFailure(cleanupFailures, 'drop isolated schema', () => (
      client.query(`DROP SCHEMA IF EXISTS ${schema} CAS`)
    ));
    await collectCleanupFailure(cleanupFailures, 'drop bootstrap schema', () => (
      client.query(`DROP SCHEMA IF EXISTS ${bootstrapSchema} CAS`)
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
      otherUserId, itemId, enrolledSchedule.scheduleVersion,
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
      d7Result.schedule.scheduleVersion,
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
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
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
