import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';
import { parsePreviewMigration } from './apply-preview-schema.mjs';

const databaseUrl = process.env.LIVE_POSTGRES_TEST_DATABASE_URL?.trim();

function parentV1Digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function buildParentV1ChatGptBatchInput(value, parseInput, buildCurrentBatch) {
  const input = parseInput(value);
  const current = buildCurrentBatch(input);
  const selectionKey = input.selections
    .map((selection) => `${selection.conversationId}:${selection.messageId}`)
    .toSorted()
    .join('|');
  const importKey = parentV1Digest(`chatgpt:${selectionKey}`).slice(0, 48);
  const base = Object.fromEntries(
    Object.entries(current).filter(([key]) => key !== 'legacyRequestId'),
  );
  return {
    ...base,
    requestId: `chatgpt-export:${importKey}`,
    conversationRef: `chatgpt-export-selection:${importKey}`,
    cards: current.cards.map((card, index) => {
      const selection = input.selections[index];
      const conversationKey = parentV1Digest(`chatgpt:${selection.conversationId}`).slice(0, 48);
      const messageKey = parentV1Digest(
        `chatgpt:${selection.conversationId}:${selection.messageId}`,
      ).slice(0, 48);
      const legacyCard = Object.fromEntries(
        Object.entries(card).filter(([key]) => key !== 'duplicateClientCardIds'),
      );
      return {
        ...legacyCard,
        clientCardId: `export-exchange:${messageKey}`,
        proposedEvidence: card.proposedEvidence?.map((evidence) => ({
          ...evidence,
          sourceRef: `chatgpt-conversation:${conversationKey}`,
          messageRef: `chatgpt-message:${messageKey}`,
        })),
      };
    }),
  };
}

function functionSection(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source boundary: ${start}`);
  assert.notEqual(endIndex, -1, `missing source boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertSharedIngestionLockOrder(label, source) {
  const orderedMarkers = [
    'deriveMcpAccountAdvisoryLockKey(userId)',
    'ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL',
    '`knowledge-ingestion:${userId}`',
  ];
  let previousIndex = -1;
  for (const marker of orderedMarkers) {
    const markerIndex = source.indexOf(marker);
    assert.ok(markerIndex > previousIndex, `${label} must acquire/check ${marker} in the shared lock order`);
    previousIndex = markerIndex;
  }
}

async function collectCleanupFailure(failures, label, cleanup) {
  try {
    await cleanup();
  } catch (error) {
    failures.push(new Error(`Selected-export PostgreSQL cleanup failed: ${label}`, { cause: error }));
  }
}

function surfaceCleanupFailures(bodyCompleted, context, failures) {
  if (failures.length === 0) return;
  if (bodyCompleted) {
    throw new AggregateError(failures, 'Selected-export PostgreSQL cleanup did not complete.');
  }
  context.diagnostic('Selected-export cleanup also failed; preserving the primary test failure.');
}

async function executePgTransaction(pool, buildQueries, options = {}) {
  const client = await pool.connect();
  const isolationLevel = options.isolationLevel === 'Serializable' ? 'SERIALIZABLE' : 'READ COMMITTED';
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
    let queryChain = Promise.resolve();
    const queries = await buildQueries({
      query: (text, params = []) => {
        const result = queryChain.then(async () => (await client.query(text, params)).rows);
        queryChain = result.then(() => undefined);
        return result;
      },
    });
    const results = await Promise.all(queries);
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function waitForAdvisoryLockHeld(pool, lockKey, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const observer = await pool.connect();
    try {
      const acquired = (await observer.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
        [lockKey],
      )).rows[0]?.acquired === true;
      if (!acquired) return;
      await observer.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
    } finally {
      observer.release();
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for advisory lock: ${lockKey}`);
}

async function waitForBackendLockWait(pool, backendPid, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const activity = (await pool.query(
      `SELECT
         pg_catalog.cardinality(pg_catalog.pg_blocking_pids($1::integer)) > 0 AS blocked,
         (SELECT wait_event_type FROM pg_catalog.pg_stat_activity WHERE pid = $1) AS wait_event_type`,
      [backendPid],
    )).rows[0];
    if (activity?.blocked === true || activity?.wait_event_type === 'Lock') return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for PostgreSQL backend ${backendPid} to block on a lock.`);
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runInForcedAccountOrder(pool, {
  userId,
  accountLockKey,
  first,
  second,
}) {
  const blocker = await pool.connect();
  let blockerOpen = false;
  let firstPromise;
  let secondPromise;
  let orderedPromise;
  try {
    await blocker.query('BEGIN');
    blockerOpen = true;
    await blocker.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`knowledge-ingestion:${userId}`],
    );
    firstPromise = Promise.resolve().then(first);
    await waitForAdvisoryLockHeld(pool, accountLockKey);
    secondPromise = Promise.resolve().then(second);
    await blocker.query('COMMIT');
    blockerOpen = false;
    orderedPromise = Promise.all([firstPromise, secondPromise]);
    return await withTimeout(
      orderedPromise,
      10_000,
      'completion/deletion lock-order fixture',
    );
  } finally {
    if (blockerOpen) await blocker.query('ROLLBACK').catch(() => undefined);
    blocker.release();
    await withTimeout(
      Promise.allSettled([firstPromise, secondPromise].filter(Boolean)),
      9_000,
      'completion/deletion cleanup',
    ).catch(() => undefined);
  }
}

test('selected-export writes, completion, and deletion share the account-to-ingestion lock order', async () => {
  const source = await readFile(new URL('../src/lib/knowledge-ingestion.ts', import.meta.url), 'utf8');
  const eventSource = await readFile(new URL('../src/lib/knowledge-product-events.ts', import.meta.url), 'utf8');
  const create = functionSection(
    source,
    'export async function createKnowledgeDraftBatchForUser(',
    'export async function getKnowledgeDraftBatchesForUser(',
  );
  const resolve = functionSection(
    source,
    'export async function resolveKnowledgeDraftForUser(',
    'export async function verifyKnowledgeItemForUser(',
  );
  const ignore = functionSection(
    resolve,
    "if (input.action === 'ignore') {",
    'const target = context?.target;',
  );
  const discard = functionSection(
    source,
    'export async function discardKnowledgeDraftBatchForUser(',
    'export async function deleteKnowledgeImportBatchForUser(',
  );
  const deletion = functionSection(
    source,
    'export async function deleteKnowledgeImportBatchForUser(',
    'type SanitizedReviewedKnowledgePayload = {',
  );
  const completion = functionSection(
    eventSource,
    'export async function finalizeChatGptExportCompletionEventsForUser(',
    'export async function getDismissedKnowledgeSignalIdsForUser(',
  );

  assertSharedIngestionLockOrder('create', create);
  assertSharedIngestionLockOrder('ignore', ignore);
  assertSharedIngestionLockOrder('discard', discard);
  assertSharedIngestionLockOrder('deletion', deletion);
  assert.match(deletion, /WHERE owned\.scope = 'selected_export'/);
  assert.match(deletion, /DELETE FROM knowledge_product_events event/);
  assert.match(create, /sessionTombstoneId/);
  assert.match(deletion, /selected-export-session:v1:/);
  assert.match(completion, /db\.accountTransaction/);
  assert.ok(
    completion.indexOf('`knowledge-ingestion:${userId}`')
      < completion.indexOf('`knowledge-import:${userId}:${completion.batchId}`'),
  );
  assert.match(completion, /provider = 'chatgpt' AND scope = 'selected_export'/);
});

test('PostgreSQL keeps selected-export identity durable after import deletion and owner-scoped', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL selected-export test',
}, async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  const importModule = await import('../src/lib/chatgpt-export-import.ts');
  const knowledgeModule = await import('../src/lib/knowledge-ingestion.ts');
  const eventModule = await import('../src/lib/knowledge-product-events.ts');
  const telemetryModule = await import('../src/lib/chatgpt-export-telemetry.ts');
  const accountLifecycleModule = await import('../src/lib/mcp-account-lifecycle.ts');
  const accountDeletionLifecycleModule = await import('../src/lib/account-lifecycle.ts');
  const accountPurgeModule = await import('../src/lib/account-private-purge.ts');
  const {
    buildChatGptExportBatchInput,
    chatGptExportImportInputSchema,
    createChatGptExportDraftBatchForUser,
  } = importModule.default ?? importModule;
  const {
    createKnowledgeDraftBatchForUser,
    deleteKnowledgeImportBatchForUser,
    getKnowledgeDraftBatchForUser,
    MAX_SELECTED_EXPORT_IDEMPOTENCY_SLOTS_PER_USER,
    resolveKnowledgeDraftForUser,
    setKnowledgeTransactionSqlForTesting,
  } = knowledgeModule.default ?? knowledgeModule;
  const {
    deleteKnowledgeProductEventsForSubjectForUser,
    finalizeChatGptExportCompletionEventsForUser,
    knowledgeProductEventSubjectHash,
    recordKnowledgeProductEventsForUser,
    reassignKnowledgeProductEventsSubjectForUser,
  } = eventModule.default ?? eventModule;
  const { recordChatGptExportCompletionTelemetry } = telemetryModule.default ?? telemetryModule;
  const {
    deriveMcpAccountAdvisoryLockKey,
    deriveMcpDeletedAccountScopeKey,
  } = accountLifecycleModule.default ?? accountLifecycleModule;
  const { buildAccountDeletionFenceQueries } = (
    accountDeletionLifecycleModule.default ?? accountDeletionLifecycleModule
  );
  const { buildPrivateProductPurgeQuery } = accountPurgeModule.default ?? accountPurgeModule;
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 4,
    statement_timeout: 8_000,
  });
  const hostname = new URL(databaseUrl).hostname;
  const usesLocalPgAdapter = hostname === '127.0.0.1' || hostname === 'localhost';
  const dbImported = usesLocalPgAdapter ? await import('../src/lib/db.ts') : null;
  const db = dbImported ? dbImported.default : null;
  const originalDbQuery = db?.query;
  const originalDbTransaction = db?.transaction;
  if (db) {
    db.query = async (text, params = []) => ({ rows: (await pool.query(text, params)).rows });
    db.transaction = async (queries, options) => {
      const rowSets = await executePgTransaction(
        pool,
        (tx) => queries.map((query) => tx.query(query.text, query.params ?? [])),
        options,
      );
      return rowSets.map((rows) => ({ rows }));
    };
    setKnowledgeTransactionSqlForTesting({
      query: async (text, params = []) => (await pool.query(text, params)).rows,
      transaction: (buildQueries, options) => executePgTransaction(pool, buildQueries, options),
    });
  }
  let migrationStatements = null;
  if (usesLocalPgAdapter) {
    const migrationSql = await readFile(
      new URL('../drizzle/migrations/0023_knowledge_ingestion_request_tombstones.sql', import.meta.url),
      'utf8',
    );
    migrationStatements = parsePreviewMigration(migrationSql);
    for (const statement of migrationStatements) await pool.query(statement);
    const backfillUserId = `live-selected-export-marker-backfill-${crypto.randomUUID()}`;
    const backfillScopeKey = deriveMcpDeletedAccountScopeKey(backfillUserId);
    try {
      await pool.query(
        `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
         VALUES ($1, NOW())`,
        [backfillScopeKey],
      );
      await pool.query(
        `INSERT INTO knowledge_ingestion_request_tombstones (user_id, provider, request_id)
         VALUES ($1, 'other', 'legacy-marker-backfill')`,
        [backfillUserId],
      );
      for (const statement of migrationStatements) await pool.query(statement);
      assert.equal((await pool.query(
        `SELECT COUNT(*)::integer AS count
         FROM knowledge_ingestion_request_tombstones
         WHERE user_id = $1`,
        [backfillUserId],
      )).rows[0].count, 0, 'migration replay must purge pre-existing marker tombstones');
    } finally {
      await pool.query(
        'DELETE FROM knowledge_ingestion_request_tombstones WHERE user_id = $1',
        [backfillUserId],
      );
      await pool.query(
        'DELETE FROM mcp_deleted_account_markers WHERE scope_key = $1',
        [backfillScopeKey],
      );
    }
  }
  const fixtureId = crypto.randomUUID();
  const userId = `live-selected-export-owner-${fixtureId}`;
  const otherUserId = `live-selected-export-other-${fixtureId}`;
  const legacyUserId = `live-selected-export-legacy-${fixtureId}`;
  const legacyIgnoredUserId = `live-selected-export-legacy-ignored-${fixtureId}`;
  const legacyExpandedUserId = `live-selected-export-legacy-expanded-${fixtureId}`;
  const legacyCollisionUserId = `live-selected-export-legacy-collision-${fixtureId}`;
  const capacityUserId = `live-selected-export-capacity-${fixtureId}`;
  const crossScopeUserId = `live-selected-export-cross-scope-${fixtureId}`;
  const telemetryUserId = `live-selected-export-telemetry-${fixtureId}`;
  const telemetryExpandedUserId = `live-selected-export-telemetry-expanded-${fixtureId}`;
  const telemetryCompletionFirstUserId = `live-selected-export-telemetry-first-${fixtureId}`;
  const telemetryDeletionFirstUserId = `live-selected-export-deletion-first-${fixtureId}`;
  const telemetryQuotaUserId = `live-selected-export-telemetry-quota-${fixtureId}`;
  const mixedOldDeleteUserId = `live-selected-export-old-delete-${fixtureId}`;
  const mixedOldCompletionUserId = `live-selected-export-old-completion-${fixtureId}`;
  const eventGuardUserId = `live-selected-export-event-guard-${fixtureId}`;
  const mixedOldBatchGuardUserId = `live-selected-export-old-batch-guard-${fixtureId}`;
  const mixedOldDeletionGuardUserId = `live-selected-export-old-deletion-guard-${fixtureId}`;
  const mixedOldDeleteFirstUserId = `live-selected-export-old-delete-first-${fixtureId}`;
  const mixedOldInsertFirstUserId = `live-selected-export-old-insert-first-${fixtureId}`;
  const accountPurgeUserId = `live-selected-export-account-purge-${fixtureId}`;
  const accountPurgeScopeKey = deriveMcpDeletedAccountScopeKey(accountPurgeUserId);
  const accountBatchDeleteFirstUserId = `live-selected-export-account-batch-first-${fixtureId}`;
  const accountMarkerFirstUserId = `live-selected-export-account-marker-first-${fixtureId}`;
  const accountBlockedUserId = `live-selected-export-account-blocked-${fixtureId}`;
  const sourceBridgeUserId = `live-selected-export-source-bridge-${fixtureId}`;
  const accountBatchDeleteFirstScopeKey = deriveMcpDeletedAccountScopeKey(accountBatchDeleteFirstUserId);
  const accountMarkerFirstScopeKey = deriveMcpDeletedAccountScopeKey(accountMarkerFirstUserId);
  const triggerInsertFirstUserId = `live-selected-export-trigger-insert-first-${fixtureId}`;
  const triggerDeleteFirstUserId = `live-selected-export-trigger-delete-first-${fixtureId}`;
  const fixtureUserIds = [
    userId, otherUserId, legacyUserId, legacyIgnoredUserId, legacyExpandedUserId,
    legacyCollisionUserId, capacityUserId, crossScopeUserId, telemetryUserId,
    telemetryExpandedUserId,
    telemetryCompletionFirstUserId, telemetryDeletionFirstUserId, telemetryQuotaUserId,
    mixedOldDeleteUserId, mixedOldCompletionUserId,
    eventGuardUserId, mixedOldBatchGuardUserId, mixedOldDeletionGuardUserId,
    mixedOldDeleteFirstUserId, mixedOldInsertFirstUserId,
    accountPurgeUserId, accountBatchDeleteFirstUserId, accountMarkerFirstUserId,
    accountBlockedUserId, sourceBridgeUserId,
    triggerInsertFirstUserId, triggerDeleteFirstUserId,
  ];
  const selection = (suffix, question) => ({
    conversationId: `live-selected-export-conversation-${fixtureId}`,
    messageId: `live-selected-export-message-${suffix}-${fixtureId}`,
    title: `Live selected export ${fixtureId}`,
    question,
    answer: `${question} Answered by the isolated PostgreSQL fixture.`,
    createdAt: '2026-09-09T00:00:00.000Z',
  });
  const selectedA = selection('a', 'What makes selected source A durable?');
  const selectedB = selection('b', 'Why should only selected source B become novel?');
  const create = (owner, selections, importSessionId = crypto.randomUUID()) => createChatGptExportDraftBatchForUser(owner, {
    source: 'chatgpt_export',
    consent: true,
    importSessionId,
    selections,
  });
  let bodyCompleted = false;

  try {
    const installedTriggers = (await pool.query(
      `SELECT trigger.tgname, relation.relname, namespace.nspname,
         trigger.tgenabled, pg_get_triggerdef(trigger.oid) AS definition
       FROM pg_trigger AS trigger
       JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
       JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
       WHERE trigger.tgname = ANY($1::text[])
         AND NOT trigger.tgisinternal
       ORDER BY trigger.tgname`,
      [[
        'knowledge_ingestion_batches_00_lock_selected_export_owner',
        'knowledge_card_sources_preserve_selected_export_fingerprint',
        'knowledge_ingestion_batches_delete_product_events',
        'knowledge_ingestion_batches_guard_selected_export_insert',
        'knowledge_product_events_cleanup_import_batch_update',
        'knowledge_product_events_guard_import_batch_insert',
        'mcp_deleted_account_markers_purge_ingestion_tombstones',
      ]],
    )).rows;
    assert.deepEqual(installedTriggers.map((row) => ({
      tgname: row.tgname,
      relname: row.relname,
      nspname: row.nspname,
      tgenabled: row.tgenabled,
    })), [{
      tgname: 'knowledge_card_sources_preserve_selected_export_fingerprint',
      relname: 'knowledge_card_sources', nspname: 'public', tgenabled: 'O',
    }, {
      tgname: 'knowledge_ingestion_batches_00_lock_selected_export_owner',
      relname: 'knowledge_ingestion_batches', nspname: 'public', tgenabled: 'O',
    }, {
      tgname: 'knowledge_ingestion_batches_delete_product_events',
      relname: 'knowledge_ingestion_batches', nspname: 'public', tgenabled: 'O',
    }, {
      tgname: 'knowledge_ingestion_batches_guard_selected_export_insert',
      relname: 'knowledge_ingestion_batches', nspname: 'public', tgenabled: 'O',
    }, {
      tgname: 'knowledge_product_events_cleanup_import_batch_update',
      relname: 'knowledge_product_events', nspname: 'public', tgenabled: 'O',
    }, {
      tgname: 'knowledge_product_events_guard_import_batch_insert',
      relname: 'knowledge_product_events', nspname: 'public', tgenabled: 'O',
    }, {
      tgname: 'mcp_deleted_account_markers_purge_ingestion_tombstones',
      relname: 'mcp_deleted_account_markers', nspname: 'public', tgenabled: 'O',
    }]);
    assert.match(installedTriggers[0].definition, /BEFORE UPDATE OF batch_id, draft_id, source_locator[\s\S]+FOR EACH ROW/);
    assert.match(installedTriggers[1].definition, /BEFORE INSERT OR DELETE[\s\S]+FOR EACH ROW/);
    assert.match(installedTriggers[2].definition, /AFTER DELETE[\s\S]+REFERENCING OLD TABLE AS deleted_knowledge_ingestion_batches[\s\S]+FOR EACH STATEMENT/);
    assert.match(installedTriggers[3].definition, /BEFORE INSERT[\s\S]+FOR EACH ROW/);
    assert.match(installedTriggers[4].definition, /AFTER UPDATE OF subject_id[\s\S]+FOR EACH ROW/);
    assert.match(installedTriggers[5].definition, /BEFORE INSERT[\s\S]+FOR EACH ROW/);
    assert.match(installedTriggers[6].definition, /BEFORE INSERT[\s\S]+FOR EACH ROW/);

    const accountScopeIndex = (await pool.query(
      `SELECT indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'idx_knowledge_ingestion_request_tombstones_account_scope'`,
    )).rows[0]?.indexdef;
    assert.match(accountScopeIndex, /derive_account_lifecycle_scope_key\(user_id\)/);

    const unicodeHashFixture = {
      userId: `소유자-${fixtureId}`,
      batchId: `선택-배치-${fixtureId}`,
    };
    assert.equal((await pool.query(
      `SELECT pg_catalog.encode(
         pg_catalog.sha256(
           pg_catalog.convert_to($1::text, 'UTF8')
           || pg_catalog.decode('00', 'hex')
           || pg_catalog.convert_to($2::text, 'UTF8')
         ),
         'hex'
       ) AS subject_id`,
      [unicodeHashFixture.userId, unicodeHashFixture.batchId],
    )).rows[0].subject_id, knowledgeProductEventSubjectHash(
      unicodeHashFixture.userId,
      unicodeHashFixture.batchId,
    ));
    assert.equal((await pool.query(
      'SELECT public.derive_account_lifecycle_scope_key($1) AS scope_key',
      [unicodeHashFixture.userId],
    )).rows[0].scope_key, deriveMcpDeletedAccountScopeKey(unicodeHashFixture.userId));

    const mixedOldBatchGuardInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [selection(
        'mixed-old-batch-guard',
        'Can a delayed old Worker recreate a deleted selected export?',
      )],
    };
    const mixedOldBatchInput = buildParentV1ChatGptBatchInput(
      mixedOldBatchGuardInput,
      (value) => chatGptExportImportInputSchema.parse(value),
      buildChatGptExportBatchInput,
    );
    const mixedOldBatch = await createKnowledgeDraftBatchForUser(
      mixedOldBatchGuardUserId,
      mixedOldBatchInput,
      null,
      mixedOldBatchGuardInput.importSessionId,
    );
    assert.equal(mixedOldBatch.created, true);
    assert.deepEqual(await deleteKnowledgeImportBatchForUser(
      mixedOldBatchGuardUserId,
      mixedOldBatch.batchId,
    ), { deleted: true, approvedKnowledgePreserved: 0 });

    const directOldBatchInsert = (owner, id, requestId, executor = pool) => executor.query(
      `INSERT INTO knowledge_ingestion_batches
        (id, user_id, source_type, provider, scope, request_id)
       VALUES ($1, $2, 'conversation', 'chatgpt', 'selected_export', $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [id, owner, requestId],
    );
    const directOldKnowledgeImportDelete = async (owner, batchId) => (await pool.query(
      `WITH owned_batch AS MATERIALIZED (
         SELECT id FROM knowledge_ingestion_batches
         WHERE id = $1 AND user_id = $2
         FOR UPDATE
       ), approved_items AS MATERIALIZED (
         SELECT DISTINCT d.knowledge_item_id AS id
         FROM knowledge_card_drafts d
         JOIN owned_batch b ON b.id = d.batch_id
         WHERE d.user_id = $2 AND d.status = 'approved' AND d.knowledge_item_id IS NOT NULL
       ), detached_sources AS (
         UPDATE knowledge_card_sources s SET
           batch_id = NULL,
           draft_id = NULL,
           source_locator = CASE WHEN s.source_locator IS NULL THEN NULL
             ELSE s.source_locator - 'batch_id' - 'draft_id' - 'client_card_id' END
         WHERE s.user_id = $2 AND s.batch_id IN (SELECT id FROM owned_batch)
         RETURNING s.id
       ), deleted_batch AS (
         DELETE FROM knowledge_ingestion_batches b
         USING owned_batch owned
         WHERE b.id = owned.id AND b.user_id = $2
           AND (SELECT COUNT(*) FROM detached_sources) >= 0
         RETURNING b.id
       )
       SELECT EXISTS (SELECT 1 FROM deleted_batch) AS deleted,
         (SELECT COUNT(*)::integer FROM approved_items) AS approved_knowledge_preserved`,
      [batchId, owner],
    )).rows[0];
    assert.equal((await directOldBatchInsert(
      mixedOldBatchGuardUserId,
      mixedOldBatchGuardInput.importSessionId,
      mixedOldBatchInput.requestId,
    )).rowCount, 0, 'the exact pre-rollout retry must remain deleted');

    const changedLegacyRequestId = `chatgpt-export:${parentV1Digest(
      `${mixedOldBatchInput.requestId}:selection-growth`,
    ).slice(0, 48)}`;
    assert.notEqual(changedLegacyRequestId, mixedOldBatchInput.requestId);
    assert.equal((await directOldBatchInsert(
      mixedOldBatchGuardUserId,
      mixedOldBatchGuardInput.importSessionId,
      changedLegacyRequestId,
    )).rowCount, 0, 'the pre-rollout session identity must block selection-growth replay');
    assert.equal((await directOldBatchInsert(
      mixedOldBatchGuardUserId,
      crypto.randomUUID(),
      `${changedLegacyRequestId}:session:${mixedOldBatchGuardInput.importSessionId}`,
    )).rowCount, 0, 'the current request format must honor the same session tombstone');
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_ingestion_batches WHERE user_id = $1`,
      [mixedOldBatchGuardUserId],
    )).rows[0].count, 0);

    const mixedOldDeletionGuardInput = {
      ...mixedOldBatchGuardInput,
      importSessionId: crypto.randomUUID(),
      selections: [selection(
        'mixed-old-deletion-guard',
        'Can a deletion served by the draining Worker remain final?',
      )],
    };
    const mixedOldDeletionBatchInput = buildParentV1ChatGptBatchInput(
      mixedOldDeletionGuardInput,
      (value) => chatGptExportImportInputSchema.parse(value),
      buildChatGptExportBatchInput,
    );
    const mixedOldDeletionBatch = await createKnowledgeDraftBatchForUser(
      mixedOldDeletionGuardUserId,
      mixedOldDeletionBatchInput,
      null,
      mixedOldDeletionGuardInput.importSessionId,
    );
    assert.equal(mixedOldDeletionBatch.created, true);
    assert.equal((await pool.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [mixedOldDeletionBatch.batchId, mixedOldDeletionGuardUserId],
    )).rowCount, 1);
    assert.deepEqual((await pool.query(
      `SELECT request_id FROM knowledge_ingestion_request_tombstones
       WHERE user_id = $1 AND provider = 'chatgpt'
       ORDER BY request_id`,
      [mixedOldDeletionGuardUserId],
    )).rows, [{ request_id: mixedOldDeletionBatchInput.requestId }, {
      request_id: `selected-export-session:v1:${mixedOldDeletionGuardInput.importSessionId}`,
    }]);
    assert.equal((await directOldBatchInsert(
      mixedOldDeletionGuardUserId,
      mixedOldDeletionGuardInput.importSessionId,
      mixedOldDeletionBatchInput.requestId,
    )).rowCount, 0, 'the database must tombstone a deletion served by the draining Worker');

    const exerciseOldWorkerDeleteReplayOrder = async (owner, deletionFirst) => {
      const importSessionId = crypto.randomUUID();
      const input = {
        source: 'chatgpt_export', consent: true, importSessionId,
        selections: [selection(
          deletionFirst ? 'old-delete-first-race' : 'old-insert-first-race',
          'Can the database serialize a draining Worker deletion and replay?',
        )],
      };
      const batchInput = buildParentV1ChatGptBatchInput(
        input,
        (value) => chatGptExportImportInputSchema.parse(value),
        buildChatGptExportBatchInput,
      );
      const batch = await createKnowledgeDraftBatchForUser(
        owner,
        batchInput,
        null,
        importSessionId,
      );
      assert.deepEqual({ created: batch.created, batchId: batch.batchId }, {
        created: true,
        batchId: importSessionId,
      });

      const deleteClient = await pool.connect();
      const replayClient = await pool.connect();
      let deleteOpen = false;
      let replayOpen = false;
      let waitingPromise;
      try {
        if (deletionFirst) {
          await deleteClient.query('BEGIN');
          deleteOpen = true;
          assert.equal((await deleteClient.query(
            `DELETE FROM knowledge_ingestion_batches
             WHERE id = $1 AND user_id = $2 RETURNING id`,
            [batch.batchId, owner],
          )).rowCount, 1);

          await replayClient.query('BEGIN');
          replayOpen = true;
          const replayPid = (await replayClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          let replaySettled = false;
          waitingPromise = directOldBatchInsert(
            owner,
            importSessionId,
            batchInput.requestId,
            replayClient,
          ).then((result) => {
            replaySettled = true;
            return result;
          });
          await waitForBackendLockWait(pool, replayPid);
          assert.equal(replaySettled, false, 'replay must wait for the delete-side account lock');

          await deleteClient.query('COMMIT');
          deleteOpen = false;
          assert.equal((await waitingPromise).rowCount, 0);
          await replayClient.query('COMMIT');
          replayOpen = false;
        } else {
          await replayClient.query('BEGIN');
          replayOpen = true;
          assert.equal((await directOldBatchInsert(
            owner,
            importSessionId,
            batchInput.requestId,
            replayClient,
          )).rowCount, 0);

          await deleteClient.query('BEGIN');
          deleteOpen = true;
          const deletePid = (await deleteClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          let deleteSettled = false;
          waitingPromise = deleteClient.query(
            `DELETE FROM knowledge_ingestion_batches
             WHERE id = $1 AND user_id = $2 RETURNING id`,
            [batch.batchId, owner],
          ).then((result) => {
            deleteSettled = true;
            return result;
          });
          await waitForBackendLockWait(pool, deletePid);
          assert.equal(deleteSettled, false, 'deletion must wait for the insert-side account lock');

          await replayClient.query('COMMIT');
          replayOpen = false;
          assert.equal((await waitingPromise).rowCount, 1);
          await deleteClient.query('COMMIT');
          deleteOpen = false;
        }
      } finally {
        if (waitingPromise) await waitingPromise.catch(() => undefined);
        if (replayOpen) await replayClient.query('ROLLBACK').catch(() => undefined);
        if (deleteOpen) await deleteClient.query('ROLLBACK').catch(() => undefined);
        replayClient.release();
        deleteClient.release();
      }

      assert.deepEqual((await pool.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches
            WHERE user_id = $1) AS batches,
           (SELECT COUNT(*)::integer FROM knowledge_ingestion_request_tombstones
            WHERE user_id = $1) AS tombstones`,
        [owner],
      )).rows[0], { batches: 0, tombstones: 2 });
    };
    await exerciseOldWorkerDeleteReplayOrder(mixedOldDeleteFirstUserId, true);
    await exerciseOldWorkerDeleteReplayOrder(mixedOldInsertFirstUserId, false);

    const crossScopeInput = {
      source: 'chatgpt_export', consent: true, importSessionId: crypto.randomUUID(),
      selections: [selection('cross-scope', 'Can PostgreSQL isolate identical request IDs by scope?')],
    };
    const crossScopeBatchInput = buildChatGptExportBatchInput(
      chatGptExportImportInputSchema.parse(crossScopeInput),
    );
    const currentScopeBatch = await createKnowledgeDraftBatchForUser(crossScopeUserId, {
      provider: 'chatgpt', scope: 'current_conversation',
      requestId: crossScopeBatchInput.requestId,
      cards: [{ title: 'Current-conversation request identity fixture' }],
    });
    const selectedScopeBatch = await createChatGptExportDraftBatchForUser(
      crossScopeUserId,
      crossScopeInput,
    );
    assert.equal(currentScopeBatch.created, true);
    assert.equal(selectedScopeBatch.created, true);
    assert.notEqual(selectedScopeBatch.batchId, currentScopeBatch.batchId);
    assert.deepEqual((await pool.query(
      `SELECT scope FROM knowledge_ingestion_batches
       WHERE user_id = $1 ORDER BY scope`,
      [crossScopeUserId],
    )).rows, [{ scope: 'current_conversation' }, { scope: 'selected_export' }]);

    const nonChatGptSelectedBatch = await createKnowledgeDraftBatchForUser(eventGuardUserId, {
      provider: 'claude', scope: 'selected_export', requestId: 'non-chatgpt-selected-event-guard',
      cards: [{ clientCardId: 'non-chatgpt-selected-event-card', title: 'Non-ChatGPT event guard' }],
    });
    assert.equal(await recordKnowledgeProductEventsForUser(crossScopeUserId, [{
      eventName: 'conversation_import_first_value_viewed', eventVersion: 1,
      subjectId: selectedScopeBatch.batchId, selectionCount: 1,
    }, {
      eventName: 'knowledge_candidate_resolved', eventVersion: 1,
      subjectId: currentScopeBatch.batchId, outcome: 'approved', selectionCount: 1,
    }]), 2);
    await assert.rejects(recordKnowledgeProductEventsForUser(crossScopeUserId, [{
      eventName: 'conversation_import_first_value_viewed', eventVersion: 1,
      subjectId: currentScopeBatch.batchId, selectionCount: 1,
    }]), { name: 'KnowledgeProductEventLimitError' });
    await assert.rejects(recordKnowledgeProductEventsForUser(eventGuardUserId, [{
      eventName: 'conversation_import_confirmed', eventVersion: 1,
      subjectId: nonChatGptSelectedBatch.batchId, selectionCount: 1,
    }]), { name: 'KnowledgeProductEventLimitError' });
    await assert.rejects(recordKnowledgeProductEventsForUser(eventGuardUserId, [{
      eventName: 'conversation_import_confirmed', eventVersion: 1,
      subjectId: selectedScopeBatch.batchId, selectionCount: 1,
    }]), { name: 'KnowledgeProductEventLimitError' });
    assert.equal(await recordKnowledgeProductEventsForUser(eventGuardUserId, [{
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: crypto.randomUUID(), selectionCount: 1,
    }]), 1);
    assert.deepEqual((await pool.query(
      `SELECT event_name FROM knowledge_product_events
       WHERE user_id = $1 ORDER BY event_name`,
      [crossScopeUserId],
    )).rows, [{ event_name: 'conversation_import_first_value_viewed' }, {
      event_name: 'knowledge_candidate_resolved',
    }]);
    assert.deepEqual((await pool.query(
      `SELECT event_name FROM knowledge_product_events
       WHERE user_id = $1 ORDER BY event_name`,
      [eventGuardUserId],
    )).rows, [{ event_name: 'knowledge_context_created' }]);

    const triggerInsertFirstBatch = await create(triggerInsertFirstUserId, [selection(
      'trigger-insert-first',
      'Does a committed event remain removable when batch deletion waits?',
    )]);
    const insertFirstClient = await pool.connect();
    const insertFirstDeleteClient = await pool.connect();
    let insertFirstTransactionOpen = false;
    let insertFirstDeleteTransactionOpen = false;
    let insertFirstDeletePromise;
    try {
      await insertFirstClient.query('BEGIN');
      insertFirstTransactionOpen = true;
      assert.equal((await insertFirstClient.query(
        `INSERT INTO knowledge_product_events
          (id, user_id, event_name, event_version, subject_id, selection_count)
         VALUES ($1, $2, 'conversation_import_confirmed', 1, $3, 1)
         RETURNING id`,
        [
          crypto.randomUUID(),
          triggerInsertFirstUserId,
          knowledgeProductEventSubjectHash(triggerInsertFirstUserId, triggerInsertFirstBatch.batchId),
        ],
      )).rowCount, 1);
      await insertFirstDeleteClient.query('BEGIN');
      insertFirstDeleteTransactionOpen = true;
      const insertFirstDeletePid = (await insertFirstDeleteClient.query(
        'SELECT pg_backend_pid() AS pid',
      )).rows[0].pid;
      let deleteSettled = false;
      insertFirstDeletePromise = insertFirstDeleteClient.query(
        `DELETE FROM knowledge_ingestion_batches
         WHERE id = $1 AND user_id = $2 RETURNING id`,
        [triggerInsertFirstBatch.batchId, triggerInsertFirstUserId],
      ).then(
        (result) => { deleteSettled = true; return { result }; },
        (error) => { deleteSettled = true; return { error }; },
      );
      await waitForBackendLockWait(pool, insertFirstDeletePid);
      assert.equal(deleteSettled, false, 'batch deletion must wait for the event trigger key-share lock');
      await insertFirstClient.query('COMMIT');
      insertFirstTransactionOpen = false;
      const deletion = await insertFirstDeletePromise;
      if (deletion.error) throw deletion.error;
      assert.equal(deletion.result.rowCount, 1);
      await insertFirstDeleteClient.query('COMMIT');
      insertFirstDeleteTransactionOpen = false;
    } finally {
      if (insertFirstTransactionOpen) await insertFirstClient.query('ROLLBACK').catch(() => undefined);
      if (insertFirstDeletePromise) await insertFirstDeletePromise;
      if (insertFirstDeleteTransactionOpen) {
        await insertFirstDeleteClient.query('ROLLBACK').catch(() => undefined);
      }
      insertFirstClient.release();
      insertFirstDeleteClient.release();
    }
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [triggerInsertFirstUserId],
    )).rows[0].count, 0);

    const triggerDeleteFirstBatch = await create(triggerDeleteFirstUserId, [selection(
      'trigger-delete-first',
      'Does a late event stay blocked while batch deletion commits?',
    )]);
    const deleteFirstClient = await pool.connect();
    const deleteFirstInsertClient = await pool.connect();
    let deleteFirstTransactionOpen = false;
    let deleteFirstInsertTransactionOpen = false;
    let deleteFirstInsertPromise;
    try {
      await deleteFirstClient.query('BEGIN');
      deleteFirstTransactionOpen = true;
      assert.equal((await deleteFirstClient.query(
        `DELETE FROM knowledge_ingestion_batches
         WHERE id = $1 AND user_id = $2 RETURNING id`,
        [triggerDeleteFirstBatch.batchId, triggerDeleteFirstUserId],
      )).rowCount, 1);
      await deleteFirstInsertClient.query('BEGIN');
      deleteFirstInsertTransactionOpen = true;
      const deleteFirstInsertPid = (await deleteFirstInsertClient.query(
        'SELECT pg_backend_pid() AS pid',
      )).rows[0].pid;
      let insertSettled = false;
      deleteFirstInsertPromise = deleteFirstInsertClient.query(
        `INSERT INTO knowledge_product_events
          (id, user_id, event_name, event_version, subject_id, selection_count)
         VALUES ($1, $2, 'conversation_import_confirmed', 1, $3, 1)
         RETURNING id`,
        [
          crypto.randomUUID(),
          triggerDeleteFirstUserId,
          knowledgeProductEventSubjectHash(triggerDeleteFirstUserId, triggerDeleteFirstBatch.batchId),
        ],
      ).then(
        (result) => { insertSettled = true; return { result }; },
        (error) => { insertSettled = true; return { error }; },
      );
      await waitForBackendLockWait(pool, deleteFirstInsertPid);
      assert.equal(insertSettled, false, 'event insertion must wait for the deleting batch row');
      await deleteFirstClient.query('COMMIT');
      deleteFirstTransactionOpen = false;
      const insertion = await deleteFirstInsertPromise;
      if (insertion.error) throw insertion.error;
      assert.equal(insertion.result.rowCount, 0);
      await deleteFirstInsertClient.query('COMMIT');
      deleteFirstInsertTransactionOpen = false;
    } finally {
      if (deleteFirstTransactionOpen) await deleteFirstClient.query('ROLLBACK').catch(() => undefined);
      if (deleteFirstInsertPromise) await deleteFirstInsertPromise;
      if (deleteFirstInsertTransactionOpen) {
        await deleteFirstInsertClient.query('ROLLBACK').catch(() => undefined);
      }
      deleteFirstClient.release();
      deleteFirstInsertClient.release();
    }
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [triggerDeleteFirstUserId],
    )).rows[0].count, 0);

    const capacityGuardClient = await pool.connect();
    let capacityGuardTransactionOpen = false;
    try {
      await capacityGuardClient.query('BEGIN');
      capacityGuardTransactionOpen = true;
      await capacityGuardClient.query("SET LOCAL statement_timeout = '60s'");
      await capacityGuardClient.query(
        `SELECT pg_catalog.pg_advisory_xact_lock(
           pg_catalog.hashtextextended('girapphe:selected-export-capacity-fixture', 0)
         )`,
      );
      await capacityGuardClient.query(
        `DELETE FROM knowledge_ingestion_batches
         WHERE user_id LIKE 'live-selected-export-capacity-%'`,
      );
      await capacityGuardClient.query(
        `DELETE FROM knowledge_ingestion_request_tombstones
         WHERE user_id LIKE 'live-selected-export-capacity-%'`,
      );

      await pool.query(
        `INSERT INTO knowledge_ingestion_request_tombstones (user_id, provider, request_id)
         SELECT $1, 'chatgpt', 'selected-export-capacity-fixture:' || fixture_id::text
         FROM generate_series(1, $2::integer) AS fixture_id`,
        [capacityUserId, MAX_SELECTED_EXPORT_IDEMPOTENCY_SLOTS_PER_USER - 2],
      );
      const lastReservedSelectedExport = await createKnowledgeDraftBatchForUser(capacityUserId, {
        provider: 'chatgpt', scope: 'selected_export', requestId: 'last-reserved-selected-export',
        cards: [{ clientCardId: 'last-reserved-card', title: 'Last reserved selected export' }],
      });
      assert.equal(lastReservedSelectedExport.created, true);
      await assert.rejects(
        createKnowledgeDraftBatchForUser(capacityUserId, {
          provider: 'chatgpt', scope: 'selected_export', requestId: 'over-cap-selected-export',
          cards: [{ clientCardId: 'over-cap-card', title: 'Must not exceed durable identity capacity' }],
        }),
        /ingestion quota is unavailable/,
      );
      assert.equal((await directOldBatchInsert(
        capacityUserId,
        crypto.randomUUID(),
        'over-cap-draining-worker',
      )).rowCount, 0, 'the database bridge must reject an old Worker insert at capacity');
      const currentConversationAtSelectedExportCapacity = await createKnowledgeDraftBatchForUser(capacityUserId, {
        provider: 'chatgpt', scope: 'current_conversation', requestId: 'current-conversation-at-selected-export-capacity',
        cards: [{ clientCardId: 'current-at-cap-card', title: 'Current conversation remains independent' }],
      });
      assert.equal(currentConversationAtSelectedExportCapacity.created, true);
      assert.deepEqual((await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE scope = 'selected_export')::integer AS selected_batches,
           COUNT(*) FILTER (WHERE scope = 'current_conversation')::integer AS current_batches
         FROM knowledge_ingestion_batches WHERE user_id = $1`,
        [capacityUserId],
      )).rows[0], { selected_batches: 1, current_batches: 1 });
    } finally {
      try {
        if (capacityGuardTransactionOpen) {
          await capacityGuardClient.query(
            `DELETE FROM knowledge_ingestion_batches
             WHERE user_id LIKE 'live-selected-export-capacity-%'`,
          );
          await capacityGuardClient.query(
            `DELETE FROM knowledge_ingestion_request_tombstones
             WHERE user_id LIKE 'live-selected-export-capacity-%'`,
          );
          await capacityGuardClient.query('COMMIT');
          capacityGuardTransactionOpen = false;
        }
      } finally {
        if (capacityGuardTransactionOpen) {
          await capacityGuardClient.query('ROLLBACK').catch(() => undefined);
        }
        capacityGuardClient.release();
      }
    }

    const concurrent = await Promise.all([
      create(userId, [selectedA]),
      create(userId, [selectedA]),
    ]);
    const first = concurrent.find((result) => result.created);
    const serializedDuplicate = concurrent.find((result) => !result.created);
    assert.ok(first);
    assert.deepEqual({ created: first.created, draftCount: first.draftCount }, {
      created: true,
      draftCount: 1,
    });
    assert.deepEqual({
      batchId: serializedDuplicate?.batchId,
      created: serializedDuplicate?.created,
      draftCount: serializedDuplicate?.draftCount,
      reviewPath: serializedDuplicate?.reviewPath,
    }, {
      batchId: first.batchId,
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });
    const firstBatch = await getKnowledgeDraftBatchForUser(userId, first.batchId);
    const firstDraft = firstBatch?.drafts[0];
    assert.ok(firstDraft);
    assert.deepEqual((await pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM user_knowledge_items WHERE user_id = $1) AS canonical_knowledge,
         (SELECT COUNT(*)::integer FROM user_graph_nodes WHERE user_id = $1) AS private_graph_nodes,
         (SELECT COUNT(*)::integer FROM user_graph_edges WHERE user_id = $1) AS private_graph_edges,
         (SELECT COUNT(*)::integer FROM user_private_card_states WHERE user_id = $1) AS private_mastery,
         (SELECT COUNT(*)::integer FROM user_knowledge_states WHERE user_id = $1) AS public_mastery,
         (SELECT COUNT(*)::integer FROM user_card_states WHERE user_id = $1) AS ranking_inputs`,
      [userId],
    )).rows[0], {
      canonical_knowledge: 0,
      private_graph_nodes: 0,
      private_graph_edges: 0,
      private_mastery: 0,
      public_mastery: 0,
      ranking_inputs: 0,
    }, 'a pending selected export must not change canonical knowledge, graph, mastery, or ranking state');
    const resolution = await resolveKnowledgeDraftForUser(userId, {
      batchId: first.batchId,
      draftId: firstDraft.id,
      action: 'create',
      expectedDraftVersion: firstDraft.version,
      reviewed: {
        title: firstDraft.title,
        summary: firstDraft.summary,
        content: firstDraft.explanation,
        topic: firstDraft.topic,
        tags: firstDraft.tags,
        knowledgeType: firstDraft.knowledge_type,
        centralQuestion: firstDraft.central_question,
        structuredContent: firstDraft.structured_content,
        bundleSchemaVersion: firstDraft.bundle_schema_version,
        evidenceSelectors: [],
        relations: [],
      },
    });
    assert.equal(resolution.resolved, true);

    const durableBeforeDelete = (await pool.query(
      `SELECT source.batch_id, source.draft_id,
         source.source_locator ->> 'selected_export_fingerprint' AS source_fingerprint
       FROM knowledge_card_sources source
       WHERE source.user_id = $1 AND source.provider = 'chatgpt'`,
      [userId],
    )).rows;
    assert.equal(durableBeforeDelete.length, 1);
    assert.equal(durableBeforeDelete[0].batch_id, first.batchId);
    assert.equal(durableBeforeDelete[0].draft_id, firstDraft.id);
    assert.match(durableBeforeDelete[0].source_fingerprint, /^export-exchange:[0-9a-f]{48}$/);
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_evidence_spans WHERE user_id = $1',
      [userId],
    )).rows[0]?.count, 0);

    assert.deepEqual(await deleteKnowledgeImportBatchForUser(userId, first.batchId), {
      deleted: true,
      approvedKnowledgePreserved: 1,
    });
    assert.equal(await getKnowledgeDraftBatchForUser(userId, first.batchId), null);

    const durableAfterDelete = (await pool.query(
      `SELECT source.batch_id, source.draft_id,
         source.source_locator ?| ARRAY['batch_id', 'draft_id', 'client_card_id'] AS has_import_locator,
         source.source_locator ->> 'selected_export_fingerprint' AS source_fingerprint
       FROM knowledge_card_sources source
       WHERE source.user_id = $1 AND source.provider = 'chatgpt'`,
      [userId],
    )).rows;
    assert.deepEqual(durableAfterDelete, [{
      batch_id: null,
      draft_id: null,
      has_import_locator: false,
      source_fingerprint: durableBeforeDelete[0].source_fingerprint,
    }]);
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM user_knowledge_items WHERE user_id = $1',
      [userId],
    )).rows[0]?.count, 1);

    const detachedTelemetrySessionId = crypto.randomUUID();
    await recordKnowledgeProductEventsForUser(userId, [{
      eventName: 'conversation_import_started', eventVersion: 1,
      subjectId: detachedTelemetrySessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: detachedTelemetrySessionId, selectionCount: 1,
    }, {
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: detachedTelemetrySessionId, selectionCount: 1,
    }]);
    const durableRetry = await create(userId, [selectedA], detachedTelemetrySessionId);
    assert.equal(durableRetry.batchId, null);
    assert.deepEqual({
      created: durableRetry.created,
      draftCount: durableRetry.draftCount,
      reviewPath: durableRetry.reviewPath,
    }, {
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_ingestion_batches WHERE user_id = $1',
      [userId],
    )).rows[0]?.count, 0);
    await recordChatGptExportCompletionTelemetry(userId, {
      importSessionId: detachedTelemetrySessionId,
      selectionCount: 1,
      result: durableRetry,
    });
    assert.deepEqual((await pool.query(
      `SELECT event_name FROM knowledge_product_events
       WHERE user_id = $1 ORDER BY event_name`,
      [userId],
    )).rows, [{ event_name: 'knowledge_context_created' }]);

    const sourceBridge = await create(sourceBridgeUserId, [selectedA]);
    assert.deepEqual({ created: sourceBridge.created, draftCount: sourceBridge.draftCount }, {
      created: true,
      draftCount: 1,
    });
    const sourceBridgeBatch = await getKnowledgeDraftBatchForUser(
      sourceBridgeUserId,
      sourceBridge.batchId,
    );
    const sourceBridgeDraft = sourceBridgeBatch?.drafts[0];
    assert.ok(sourceBridgeDraft);
    assert.equal((await resolveKnowledgeDraftForUser(sourceBridgeUserId, {
      batchId: sourceBridge.batchId,
      draftId: sourceBridgeDraft.id,
      action: 'create',
      expectedDraftVersion: sourceBridgeDraft.version,
      reviewed: {
        title: sourceBridgeDraft.title,
        summary: sourceBridgeDraft.summary,
        content: sourceBridgeDraft.explanation,
        topic: sourceBridgeDraft.topic,
        tags: sourceBridgeDraft.tags,
        knowledgeType: sourceBridgeDraft.knowledge_type,
        centralQuestion: sourceBridgeDraft.central_question,
        structuredContent: sourceBridgeDraft.structured_content,
        bundleSchemaVersion: sourceBridgeDraft.bundle_schema_version,
        evidenceSelectors: [],
        relations: [],
      },
    })).resolved, true);
    assert.equal((await pool.query(
      `UPDATE knowledge_card_sources
       SET source_locator = source_locator - 'selected_export_fingerprint'
       WHERE user_id = $1 AND batch_id = $2`,
      [sourceBridgeUserId, sourceBridge.batchId],
    )).rowCount, 1);
    if (migrationStatements) {
      for (const statement of migrationStatements) await pool.query(statement);
      assert.equal((await pool.query(
        `SELECT source_locator ->> 'selected_export_fingerprint' AS fingerprint
         FROM knowledge_card_sources
         WHERE user_id = $1 AND batch_id = $2`,
        [sourceBridgeUserId, sourceBridge.batchId],
      )).rows[0]?.fingerprint, sourceBridgeDraft.client_card_id,
      'migration replay must backfill a still-linked pre-rollout selected-export source');
      assert.equal((await pool.query(
        `UPDATE knowledge_card_sources
         SET source_locator = source_locator - 'selected_export_fingerprint'
         WHERE user_id = $1 AND batch_id = $2`,
        [sourceBridgeUserId, sourceBridge.batchId],
      )).rowCount, 1);
    }
    assert.deepEqual(await directOldKnowledgeImportDelete(
      sourceBridgeUserId,
      sourceBridge.batchId,
    ), { deleted: true, approved_knowledge_preserved: 1 });
    assert.deepEqual((await pool.query(
      `SELECT source.batch_id, source.draft_id,
         source.source_locator ?| ARRAY['batch_id', 'draft_id', 'client_card_id'] AS has_import_locator,
         source.source_locator ->> 'selected_export_fingerprint' AS source_fingerprint
       FROM knowledge_card_sources source
       WHERE source.user_id = $1 AND source.provider = 'chatgpt'`,
      [sourceBridgeUserId],
    )).rows, [{
      batch_id: null,
      draft_id: null,
      has_import_locator: false,
      source_fingerprint: sourceBridgeDraft.client_card_id,
    }]);
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_evidence_spans WHERE user_id = $1',
      [sourceBridgeUserId],
    )).rows[0]?.count, 0);
    const sourceBridgeRetry = await create(sourceBridgeUserId, [selectedA], crypto.randomUUID());
    assert.deepEqual({
      batchId: sourceBridgeRetry.batchId,
      created: sourceBridgeRetry.created,
      draftCount: sourceBridgeRetry.draftCount,
      reviewPath: sourceBridgeRetry.reviewPath,
    }, {
      batchId: null,
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });

    const overlap = await create(userId, [selectedA, selectedB]);
    assert.deepEqual({ created: overlap.created, draftCount: overlap.draftCount }, {
      created: true,
      draftCount: 1,
    });
    const overlapBatch = await getKnowledgeDraftBatchForUser(userId, overlap.batchId);
    assert.equal(overlapBatch?.drafts.length, 1);
    assert.equal(overlapBatch?.drafts[0].central_question, selectedB.question);
    assert.deepEqual(overlapBatch?.drafts[0].relations, []);

    const otherOwner = await create(otherUserId, [selectedA, selectedB]);
    assert.deepEqual({ created: otherOwner.created, draftCount: otherOwner.draftCount }, {
      created: true,
      draftCount: 2,
    });
    const otherBatch = await getKnowledgeDraftBatchForUser(otherUserId, otherOwner.batchId);
    assert.deepEqual(
      otherBatch?.drafts.map((draft) => draft.central_question).toSorted(),
      [selectedA.question, selectedB.question].toSorted(),
    );

    const deletedPendingInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [selection('pending-delete', 'Can a delayed retry recreate deleted pending text?')],
    };
    const deletedPending = await createChatGptExportDraftBatchForUser(userId, deletedPendingInput);
    assert.deepEqual(await deleteKnowledgeImportBatchForUser(userId, deletedPending.batchId), {
      deleted: true,
      approvedKnowledgePreserved: 0,
    });
    const delayedRetry = await createChatGptExportDraftBatchForUser(userId, deletedPendingInput);
    assert.equal(delayedRetry.batchId, null);
    assert.deepEqual({
      created: delayedRetry.created,
      draftCount: delayedRetry.draftCount,
      reviewPath: delayedRetry.reviewPath,
    }, {
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });
    const deletedSelectedRequestId = buildChatGptExportBatchInput(
      chatGptExportImportInputSchema.parse(deletedPendingInput),
    ).requestId;
    const sameRequestOtherScope = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'chatgpt', scope: 'current_conversation',
      requestId: deletedSelectedRequestId,
      cards: [{ title: 'Current-conversation request outside selected-export tombstones' }],
    });
    assert.equal(sameRequestOtherScope.created, true);
    const retryAfterOtherScope = await createChatGptExportDraftBatchForUser(userId, deletedPendingInput);
    assert.equal(retryAfterOtherScope.batchId, null);
    assert.equal(retryAfterOtherScope.created, false);
    assert.equal(retryAfterOtherScope.draftCount, 0);
    const explicitReselection = await createChatGptExportDraftBatchForUser(userId, {
      ...deletedPendingInput,
      importSessionId: crypto.randomUUID(),
    });
    assert.equal(explicitReselection.created, true);
    assert.equal(explicitReselection.draftCount, 1);

    const legacyExpandedInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [selectedA],
    };
    const currentLegacyExpandedBatch = buildParentV1ChatGptBatchInput(
      legacyExpandedInput,
      (value) => chatGptExportImportInputSchema.parse(value),
      buildChatGptExportBatchInput,
    );
    const legacyExpandedBatch = await createKnowledgeDraftBatchForUser(
      legacyExpandedUserId,
      currentLegacyExpandedBatch,
      null,
      legacyExpandedInput.importSessionId,
    );
    const exactLegacyExpandedRetry = await createChatGptExportDraftBatchForUser(
      legacyExpandedUserId,
      legacyExpandedInput,
    );
    assert.equal(exactLegacyExpandedRetry.created, false);
    assert.equal(exactLegacyExpandedRetry.batchId, legacyExpandedBatch.batchId);
    const expandedLegacySelection = await createChatGptExportDraftBatchForUser(
      legacyExpandedUserId,
      { ...legacyExpandedInput, selections: [selectedA, selectedB] },
    );
    assert.equal(expandedLegacySelection.created, true);
    assert.notEqual(expandedLegacySelection.batchId, legacyExpandedBatch.batchId);
    assert.equal(expandedLegacySelection.draftCount, 1);
    const loadedExpandedLegacySelection = await getKnowledgeDraftBatchForUser(
      legacyExpandedUserId,
      expandedLegacySelection.batchId,
    );
    assert.equal(loadedExpandedLegacySelection?.drafts.length, 1);
    assert.equal(loadedExpandedLegacySelection?.drafts[0].central_question, selectedB.question);

    const legacyCollisionSessionId = crypto.randomUUID();
    const ambiguousLegacyCollisionInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: legacyCollisionSessionId,
      selections: [{
        conversationId: 'a',
        messageId: 'b|c:d',
        title: 'Legacy ambiguous PostgreSQL tuple',
        question: 'Which single legacy PostgreSQL tuple was selected?',
        answer: 'One delimiter-shaped tuple existed in the legacy batch.',
        createdAt: null,
      }],
    };
    const distinctCurrentCollisionInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: legacyCollisionSessionId,
      selections: [{
        conversationId: 'a',
        messageId: 'b',
        title: 'First current PostgreSQL tuple',
        question: 'Which first current PostgreSQL tuple was selected?',
        answer: 'The first current tuple is independent.',
        createdAt: null,
      }, {
        conversationId: 'c',
        messageId: 'd',
        title: 'Second current PostgreSQL tuple',
        question: 'Which second current PostgreSQL tuple was selected?',
        answer: 'The second current tuple is independent.',
        createdAt: null,
      }],
    };
    const ambiguousLegacyBatchInput = buildParentV1ChatGptBatchInput(
      ambiguousLegacyCollisionInput,
      (value) => chatGptExportImportInputSchema.parse(value),
      buildChatGptExportBatchInput,
    );
    const distinctCurrentBatchInput = buildChatGptExportBatchInput(
      chatGptExportImportInputSchema.parse(distinctCurrentCollisionInput),
    );
    assert.equal(distinctCurrentBatchInput.legacyRequestId, ambiguousLegacyBatchInput.requestId);
    const ambiguousLegacyBatch = await createKnowledgeDraftBatchForUser(
      legacyCollisionUserId,
      ambiguousLegacyBatchInput,
      null,
      legacyCollisionSessionId,
    );
    const distinctCurrentBatch = await createChatGptExportDraftBatchForUser(
      legacyCollisionUserId,
      distinctCurrentCollisionInput,
    );
    assert.equal(distinctCurrentBatch.created, true);
    assert.notEqual(distinctCurrentBatch.batchId, ambiguousLegacyBatch.batchId);
    assert.equal(distinctCurrentBatch.draftCount, 2);
    assert.deepEqual((await pool.query(
      `SELECT COUNT(DISTINCT b.id)::integer AS batch_count, COUNT(d.id)::integer AS draft_count
       FROM knowledge_ingestion_batches b
       LEFT JOIN knowledge_card_drafts d ON d.batch_id = b.id AND d.user_id = b.user_id
       WHERE b.user_id = $1`,
      [legacyCollisionUserId],
    )).rows[0], { batch_count: 2, draft_count: 3 });

    const legacyIgnoredInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [selection('legacy-ignored-retry', 'Can a pre-rollout ignored draft return on a delayed retry?')],
    };
    const currentLegacyIgnoredBatch = buildParentV1ChatGptBatchInput(
      legacyIgnoredInput,
      (value) => chatGptExportImportInputSchema.parse(value),
      buildChatGptExportBatchInput,
    );
    const legacyIgnoredBatch = await createKnowledgeDraftBatchForUser(
      legacyIgnoredUserId,
      currentLegacyIgnoredBatch,
      null,
      legacyIgnoredInput.importSessionId,
    );
    const loadedLegacyIgnoredBatch = await getKnowledgeDraftBatchForUser(
      legacyIgnoredUserId,
      legacyIgnoredBatch.batchId,
    );
    assert.ok(loadedLegacyIgnoredBatch);
    assert.equal((await resolveKnowledgeDraftForUser(legacyIgnoredUserId, {
      batchId: legacyIgnoredBatch.batchId,
      draftId: loadedLegacyIgnoredBatch.drafts[0].id,
      action: 'ignore',
      expectedDraftVersion: loadedLegacyIgnoredBatch.drafts[0].version,
    })).resolved, true);
    const delayedLegacyIgnoredTab = await createChatGptExportDraftBatchForUser(
      legacyIgnoredUserId,
      legacyIgnoredInput,
    );
    assert.deepEqual(delayedLegacyIgnoredTab, {
      batchId: legacyIgnoredBatch.batchId,
      created: false,
      draftCount: 1,
      reviewPath: `/knowledge-inbox/${encodeURIComponent(legacyIgnoredBatch.batchId)}`,
    });
    assert.deepEqual((await pool.query(
      `SELECT COUNT(*)::integer AS batch_count,
         COUNT(d.id)::integer AS draft_count,
         COUNT(d.id) FILTER (WHERE d.status = 'rejected')::integer AS rejected_count
       FROM knowledge_ingestion_batches b
       LEFT JOIN knowledge_card_drafts d ON d.batch_id = b.id AND d.user_id = b.user_id
       WHERE b.user_id = $1`,
      [legacyIgnoredUserId],
    )).rows[0], { batch_count: 1, draft_count: 1, rejected_count: 1 });
    const freshLegacyIgnoredSession = await createChatGptExportDraftBatchForUser(
      legacyIgnoredUserId,
      { ...legacyIgnoredInput, importSessionId: crypto.randomUUID() },
    );
    assert.equal(freshLegacyIgnoredSession.created, true);
    assert.equal(freshLegacyIgnoredSession.draftCount, 1);

    const legacyInput = {
      source: 'chatgpt_export',
      consent: true,
      importSessionId: crypto.randomUUID(),
      selections: [selection('legacy-pending-delete', 'Can a pre-rollout tab recreate deleted pending text?')],
    };
    const currentLegacyBatch = buildParentV1ChatGptBatchInput(
      legacyInput,
      (value) => chatGptExportImportInputSchema.parse(value),
      buildChatGptExportBatchInput,
    );
    const legacyBatch = await createKnowledgeDraftBatchForUser(
      legacyUserId,
      currentLegacyBatch,
      null,
      legacyInput.importSessionId,
    );
    assert.equal(legacyBatch.batchId, legacyInput.importSessionId);
    assert.deepEqual(await deleteKnowledgeImportBatchForUser(legacyUserId, legacyBatch.batchId), {
      deleted: true,
      approvedKnowledgePreserved: 0,
    });
    const delayedLegacyTab = await createChatGptExportDraftBatchForUser(legacyUserId, legacyInput);
    assert.equal(delayedLegacyTab.batchId, null);
    assert.deepEqual({
      created: delayedLegacyTab.created,
      draftCount: delayedLegacyTab.draftCount,
      reviewPath: delayedLegacyTab.reviewPath,
    }, {
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });
    const legacyExplicitReselection = await createChatGptExportDraftBatchForUser(legacyUserId, {
      ...legacyInput,
      importSessionId: crypto.randomUUID(),
    });
    assert.equal(legacyExplicitReselection.created, true);
    assert.equal(legacyExplicitReselection.draftCount, 1);

    const telemetrySessionId = crypto.randomUUID();
    const telemetrySelection = selection(
      'telemetry',
      'Can duplicate-only import telemetry stay attached to one deletable job?',
    );
    await recordKnowledgeProductEventsForUser(telemetryUserId, [{
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: telemetrySessionId, selectionCount: 1,
    }]);
    const telemetryCreated = await createChatGptExportDraftBatchForUser(telemetryUserId, {
      source: 'chatgpt_export', consent: true,
      importSessionId: telemetrySessionId, selections: [telemetrySelection],
    });
    assert.equal(telemetryCreated.created, true);
    await recordChatGptExportCompletionTelemetry(telemetryUserId, {
      importSessionId: telemetrySessionId,
      parsedExchangeCount: 7,
      selectionCount: 2,
      result: telemetryCreated,
    });
    await recordChatGptExportCompletionTelemetry(telemetryUserId, {
      importSessionId: telemetrySessionId,
      parsedExchangeCount: 7,
      selectionCount: 2,
      result: { ...telemetryCreated, created: false, draftCount: 0 },
    });

    const duplicateTelemetrySessionId = crypto.randomUUID();
    await recordKnowledgeProductEventsForUser(telemetryUserId, [{
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: duplicateTelemetrySessionId, selectionCount: 1,
    }]);
    const duplicateTelemetryResult = await createChatGptExportDraftBatchForUser(telemetryUserId, {
      source: 'chatgpt_export', consent: true,
      importSessionId: duplicateTelemetrySessionId, selections: [telemetrySelection],
    });
    assert.deepEqual({
      batchId: duplicateTelemetryResult.batchId,
      created: duplicateTelemetryResult.created,
      draftCount: duplicateTelemetryResult.draftCount,
      reviewPath: duplicateTelemetryResult.reviewPath,
    }, {
      batchId: telemetryCreated.batchId,
      created: false,
      draftCount: 0,
      reviewPath: '/knowledge-inbox',
    });
    await recordChatGptExportCompletionTelemetry(telemetryUserId, {
      importSessionId: duplicateTelemetrySessionId,
      parsedExchangeCount: 9,
      selectionCount: 1,
      result: duplicateTelemetryResult,
    });
    await recordChatGptExportCompletionTelemetry(telemetryUserId, {
      importSessionId: duplicateTelemetrySessionId,
      parsedExchangeCount: 9,
      selectionCount: 1,
      result: duplicateTelemetryResult,
    });
    const telemetryRows = (await pool.query(
      `SELECT event_name, subject_id, selection_count
       FROM knowledge_product_events
       WHERE user_id = $1
       ORDER BY created_at, event_name`,
      [telemetryUserId],
    )).rows;
    const importTelemetryRows = telemetryRows.filter((row) => row.event_name.startsWith('conversation_import_'));
    assert.deepEqual(importTelemetryRows.map((row) => row.event_name).toSorted(), [
      'conversation_import_candidates_ready',
      'conversation_import_confirmed',
      'conversation_import_confirmed',
      'conversation_import_parsed',
      'conversation_import_parsed',
      'conversation_import_started',
      'conversation_import_started',
    ]);
    assert.equal(new Set(importTelemetryRows.map((row) => row.subject_id)).size, 1);
    assert.deepEqual(importTelemetryRows
      .filter((row) => row.event_name === 'conversation_import_parsed')
      .map((row) => row.selection_count)
      .toSorted((left, right) => left - right), [7, 9]);
    const contextTelemetryRows = telemetryRows
      .filter((row) => row.event_name === 'knowledge_context_created');
    assert.equal(contextTelemetryRows.length, 2);
    assert.equal(new Set(contextTelemetryRows.map((row) => row.subject_id)).size, 2);
    assert.ok(contextTelemetryRows.every((row) => row.subject_id !== importTelemetryRows[0].subject_id));
    assert.deepEqual(
      await deleteKnowledgeImportBatchForUser(telemetryUserId, telemetryCreated.batchId),
      { deleted: true, approvedKnowledgePreserved: 0 },
    );
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [telemetryUserId],
    )).rows[0].count, 2);
    await recordChatGptExportCompletionTelemetry(telemetryUserId, {
      importSessionId: duplicateTelemetrySessionId,
      selectionCount: 1,
      result: duplicateTelemetryResult,
    });
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [telemetryUserId],
    )).rows[0].count, 2);

    const expandedTelemetrySessionId = crypto.randomUUID();
    const expandedTelemetryFirst = await create(
      telemetryExpandedUserId,
      [selectedA],
      expandedTelemetrySessionId,
    );
    const expandedTelemetrySecond = await create(
      telemetryExpandedUserId,
      [selectedA, selectedB],
      expandedTelemetrySessionId,
    );
    assert.equal(expandedTelemetryFirst.created, true);
    assert.equal(expandedTelemetrySecond.created, true);
    assert.notEqual(expandedTelemetryFirst.batchId, expandedTelemetrySecond.batchId);
    for (const [result, parsedExchangeCount, selectionCount] of [
      [expandedTelemetryFirst, 1, 1],
      [expandedTelemetrySecond, 2, 2],
    ]) {
      assert.equal(await finalizeChatGptExportCompletionEventsForUser(
        telemetryExpandedUserId,
        {
          importSessionId: expandedTelemetrySessionId,
          batchId: result.batchId,
          parsedExchangeCount,
          selectionCount,
          created: result.created,
          draftCount: result.draftCount,
        },
        { memoryBatchExists: () => true },
      ), 4);
    }
    assert.equal(await finalizeChatGptExportCompletionEventsForUser(
      telemetryExpandedUserId,
      {
        importSessionId: expandedTelemetrySessionId,
        batchId: expandedTelemetrySecond.batchId,
        parsedExchangeCount: 2,
        selectionCount: 2,
        created: false,
        draftCount: 0,
      },
      { memoryBatchExists: () => true },
    ), 0);
    const expandedTelemetryGroups = (await pool.query(
      `SELECT subject_id, COUNT(*)::integer AS count
       FROM knowledge_product_events
       WHERE user_id = $1
       GROUP BY subject_id
       ORDER BY subject_id`,
      [telemetryExpandedUserId],
    )).rows;
    assert.deepEqual(expandedTelemetryGroups.map((row) => row.count), [4, 4]);
    assert.equal(new Set(expandedTelemetryGroups.map((row) => row.subject_id)).size, 2);
    assert.deepEqual(
      await deleteKnowledgeImportBatchForUser(
        telemetryExpandedUserId,
        expandedTelemetryFirst.batchId,
      ),
      { deleted: true, approvedKnowledgePreserved: 0 },
    );
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [telemetryExpandedUserId],
    )).rows[0].count, 4);
    assert.deepEqual(
      await deleteKnowledgeImportBatchForUser(
        telemetryExpandedUserId,
        expandedTelemetrySecond.batchId,
      ),
      { deleted: true, approvedKnowledgePreserved: 0 },
    );
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [telemetryExpandedUserId],
    )).rows[0].count, 0);

    const exerciseTelemetryDeletionOrder = async (raceUserId, completionFirst) => {
      const raceSessionId = crypto.randomUUID();
      await recordKnowledgeProductEventsForUser(raceUserId, [{
        eventName: 'conversation_import_started', eventVersion: 1, subjectId: raceSessionId,
      }, {
        eventName: 'conversation_import_parsed', eventVersion: 1,
        subjectId: raceSessionId, selectionCount: 1,
      }, {
        eventName: 'knowledge_context_created', eventVersion: 1,
        subjectId: raceSessionId, selectionCount: 1,
      }]);
      const raceResult = await create(raceUserId, [selection(
        `telemetry-race-${completionFirst ? 'completion' : 'deletion'}`,
        `Can ${completionFirst ? 'completion' : 'deletion'} win the telemetry race safely?`,
      )], raceSessionId);
      assert.equal(raceResult.created, true);
      const completion = () => finalizeChatGptExportCompletionEventsForUser(raceUserId, {
        importSessionId: raceSessionId,
        batchId: raceResult.batchId,
        selectionCount: 1,
        created: raceResult.created,
        draftCount: raceResult.draftCount,
      }, {
        memoryBatchExists: () => true,
      });
      const deletion = () => deleteKnowledgeImportBatchForUser(raceUserId, raceResult.batchId);
      const orderedResults = await runInForcedAccountOrder(pool, {
        userId: raceUserId,
        accountLockKey: deriveMcpAccountAdvisoryLockKey(raceUserId),
        first: completionFirst ? completion : deletion,
        second: completionFirst ? deletion : completion,
      });
      assert.deepEqual(
        orderedResults.find((result) => result?.deleted === true),
        { deleted: true, approvedKnowledgePreserved: 0 },
      );
      assert.equal(
        orderedResults.find((result) => typeof result === 'number'),
        completionFirst ? 2 : 0,
      );
      assert.equal((await pool.query(
        'SELECT COUNT(*)::integer AS count FROM knowledge_ingestion_batches WHERE user_id = $1',
        [raceUserId],
      )).rows[0].count, 0);
      assert.deepEqual((await pool.query(
        `SELECT event_name FROM knowledge_product_events
         WHERE user_id = $1 ORDER BY event_name`,
        [raceUserId],
      )).rows, [{ event_name: 'knowledge_context_created' }]);
    };
    await exerciseTelemetryDeletionOrder(telemetryCompletionFirstUserId, true);
    await exerciseTelemetryDeletionOrder(telemetryDeletionFirstUserId, false);

    const quotaSessionId = crypto.randomUUID();
    await recordKnowledgeProductEventsForUser(telemetryQuotaUserId, [{
      eventName: 'conversation_import_started', eventVersion: 1, subjectId: quotaSessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: quotaSessionId, selectionCount: 1,
    }]);
    const quotaResult = await create(telemetryQuotaUserId, [selection(
      'telemetry-quota',
      'Can a full telemetry quota still preserve deletable import grouping?',
    )], quotaSessionId);
    await pool.query(
      `INSERT INTO knowledge_product_events
        (id, user_id, event_name, event_version, subject_id)
       SELECT $2 || ':' || ordinal::text, $1, 'knowledge_context_created', 1,
         pg_catalog.encode(
           pg_catalog.sha256(pg_catalog.convert_to($2 || ':' || ordinal::text, 'UTF8')),
           'hex'
         )
       FROM generate_series(1, 118) AS fixture(ordinal)`,
      [telemetryQuotaUserId, `quota-${fixtureId}`],
    );
    await assert.rejects(finalizeChatGptExportCompletionEventsForUser(
      telemetryQuotaUserId,
      {
        importSessionId: quotaSessionId,
        batchId: quotaResult.batchId,
        selectionCount: 1,
        created: true,
        draftCount: 1,
      },
      { memoryBatchExists: () => true },
    ), { name: 'KnowledgeProductEventLimitError' });
    const quotaSessionHash = knowledgeProductEventSubjectHash(telemetryQuotaUserId, quotaSessionId);
    const quotaBatchHash = knowledgeProductEventSubjectHash(telemetryQuotaUserId, quotaResult.batchId);
    assert.deepEqual((await pool.query(
      `SELECT
         COUNT(*)::integer AS total,
         COUNT(*) FILTER (WHERE subject_id = $2)::integer AS session_events,
         COUNT(*) FILTER (WHERE subject_id = $3)::integer AS batch_events
       FROM knowledge_product_events WHERE user_id = $1`,
      [telemetryQuotaUserId, quotaSessionHash, quotaBatchHash],
    )).rows[0], { total: 120, session_events: 0, batch_events: 2 });
    assert.deepEqual(await deleteKnowledgeImportBatchForUser(
      telemetryQuotaUserId,
      quotaResult.batchId,
    ), { deleted: true, approvedKnowledgePreserved: 0 });
    assert.deepEqual((await pool.query(
      `SELECT
         COUNT(*)::integer AS total,
         COUNT(*) FILTER (WHERE subject_id IN ($2, $3))::integer AS import_events
       FROM knowledge_product_events WHERE user_id = $1`,
      [telemetryQuotaUserId, quotaSessionHash, quotaBatchHash],
    )).rows[0], { total: 118, import_events: 0 });

    const oldDeleteSessionId = crypto.randomUUID();
    await recordKnowledgeProductEventsForUser(mixedOldDeleteUserId, [{
      eventName: 'conversation_import_started', eventVersion: 1, subjectId: oldDeleteSessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: oldDeleteSessionId, selectionCount: 1,
    }, {
      eventName: 'knowledge_context_created', eventVersion: 1,
      subjectId: oldDeleteSessionId, selectionCount: 1,
    }]);
    const oldDeleteResult = await create(mixedOldDeleteUserId, [selection(
      'mixed-old-delete',
      'Can an old two-transaction deletion overlap a new completion safely?',
    )], oldDeleteSessionId);
    assert.equal(
      await deleteKnowledgeProductEventsForSubjectForUser(
        mixedOldDeleteUserId,
        oldDeleteResult.batchId,
      ),
      0,
    );
    assert.equal(await finalizeChatGptExportCompletionEventsForUser(
      mixedOldDeleteUserId,
      {
        importSessionId: oldDeleteSessionId,
        batchId: oldDeleteResult.batchId,
        selectionCount: 1,
        created: true,
        draftCount: 1,
      },
      { memoryBatchExists: () => true },
    ), 2);
    assert.equal((await pool.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [oldDeleteResult.batchId, mixedOldDeleteUserId],
    )).rowCount, 1);
    assert.deepEqual((await pool.query(
      `SELECT event_name FROM knowledge_product_events
       WHERE user_id = $1 ORDER BY event_name`,
      [mixedOldDeleteUserId],
    )).rows, [{ event_name: 'knowledge_context_created' }]);

    const oldCompletionSessionId = crypto.randomUUID();
    await recordKnowledgeProductEventsForUser(mixedOldCompletionUserId, [{
      eventName: 'conversation_import_started', eventVersion: 1,
      subjectId: oldCompletionSessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: oldCompletionSessionId, selectionCount: 1,
    }]);
    const oldCompletionResult = await create(mixedOldCompletionUserId, [selection(
      'mixed-old-completion',
      'Can an old two-transaction completion overlap a new deletion safely?',
    )], oldCompletionSessionId);
    assert.equal((await pool.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [oldCompletionResult.batchId, mixedOldCompletionUserId],
    )).rowCount, 1);
    assert.equal(await reassignKnowledgeProductEventsSubjectForUser(
      mixedOldCompletionUserId,
      oldCompletionSessionId,
      oldCompletionResult.batchId,
    ), 2);
    await assert.rejects(recordKnowledgeProductEventsForUser(
      mixedOldCompletionUserId,
      [{
        eventName: 'conversation_import_confirmed', eventVersion: 1,
        subjectId: oldCompletionResult.batchId, selectionCount: 1,
      }, {
        eventName: 'conversation_import_candidates_ready', eventVersion: 1,
        subjectId: oldCompletionResult.batchId, selectionCount: 1,
      }, {
        eventName: 'conversation_import_first_value_viewed', eventVersion: 1,
        subjectId: oldCompletionResult.batchId, selectionCount: 1,
      }, {
        eventName: 'knowledge_candidate_resolved', eventVersion: 1,
        subjectId: oldCompletionResult.batchId, outcome: 'ignored', selectionCount: 1,
      }],
    ), { name: 'KnowledgeProductEventLimitError' });
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [mixedOldCompletionUserId],
    )).rows[0].count, 0);

    for (let index = 0; index < 3; index += 1) {
      const importSessionId = crypto.randomUUID();
      await recordKnowledgeProductEventsForUser(accountPurgeUserId, [{
        eventName: 'conversation_import_started', eventVersion: 1, subjectId: importSessionId,
      }, {
        eventName: 'conversation_import_parsed', eventVersion: 1,
        subjectId: importSessionId, selectionCount: 1,
      }]);
      const result = await create(accountPurgeUserId, [selection(
        `account-purge-${index}`,
        `Can account deletion remove import batch ${index + 1} without trigger conflicts?`,
      )], importSessionId);
      await recordChatGptExportCompletionTelemetry(accountPurgeUserId, {
        importSessionId,
        selectionCount: 1,
        result,
      });
      assert.equal(await recordKnowledgeProductEventsForUser(accountPurgeUserId, [{
        eventName: 'conversation_import_first_value_viewed', eventVersion: 1,
        subjectId: result.batchId, selectionCount: 1,
      }, {
        eventName: 'knowledge_candidate_resolved', eventVersion: 1,
        subjectId: result.batchId, outcome: 'ignored', selectionCount: 1,
      }]), 2);
    }
    assert.deepEqual((await pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches WHERE user_id = $1) AS batches,
         (SELECT COUNT(*)::integer FROM knowledge_product_events WHERE user_id = $1) AS events`,
      [accountPurgeUserId],
    )).rows[0], { batches: 3, events: 18 });
    const drainingAccountDeleteSessionId = crypto.randomUUID();
    const drainingAccountDeleteBatchId = crypto.randomUUID();
    assert.equal((await directOldBatchInsert(
      accountPurgeUserId,
      drainingAccountDeleteBatchId,
      `account-delete-window:session:${drainingAccountDeleteSessionId}`,
    )).rowCount, 1);
    assert.equal((await pool.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [drainingAccountDeleteBatchId, accountPurgeUserId],
    )).rowCount, 1);
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_ingestion_request_tombstones
       WHERE user_id = $1`,
      [accountPurgeUserId],
    )).rows[0].count, 2);
    assert.equal((await pool.query(
      `INSERT INTO knowledge_ingestion_request_tombstones (user_id, provider, request_id)
       VALUES ($1, 'other', $2)`,
      [otherUserId, `unrelated-account-delete:${fixtureId}`],
    )).rowCount, 1);
    assert.equal((await pool.query(
      `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
       VALUES ($1, NOW())
       ON CONFLICT (scope_key) DO NOTHING`,
      [accountPurgeScopeKey],
    )).rowCount, 1);
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_ingestion_request_tombstones
       WHERE user_id = $1`,
      [accountPurgeUserId],
    )).rows[0].count, 0, 'the deletion marker must purge draining-Worker tombstones');
    assert.equal((await pool.query(
      `INSERT INTO knowledge_ingestion_request_tombstones (user_id, provider, request_id)
       VALUES ($1, 'other', $2)`,
      [accountPurgeUserId, `account-delete-retry:${fixtureId}`],
    )).rowCount, 1);
    assert.equal((await pool.query(
      `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
       VALUES ($1, NOW())
       ON CONFLICT (scope_key) DO UPDATE SET deleted_at = EXCLUDED.deleted_at`,
      [accountPurgeScopeKey],
    )).rowCount, 1);
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_ingestion_request_tombstones
       WHERE user_id = $1`,
      [accountPurgeUserId],
    )).rows[0].count, 0, 'an account deletion retry must purge a late legacy tombstone');
    assert.equal((await pool.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_ingestion_request_tombstones
       WHERE user_id = $1`,
      [otherUserId],
    )).rows[0].count, 1, 'an unrelated owner tombstone must survive marker cleanup');

    const exerciseAccountDeletionBridgeOrder = async (owner, scopeKey, markerFirst) => {
      const batchId = crypto.randomUUID();
      assert.equal((await directOldBatchInsert(
        owner,
        batchId,
        `account-delete-race:session:${crypto.randomUUID()}`,
      )).rowCount, 1);
      const firstClient = await pool.connect();
      const waitingClient = await pool.connect();
      let firstOpen = false;
      let waitingOpen = false;
      let waitingPromise;
      try {
        await firstClient.query('BEGIN');
        firstOpen = true;
        if (markerFirst) {
          assert.equal((await firstClient.query(
            `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
             VALUES ($1, NOW()) RETURNING scope_key`,
            [scopeKey],
          )).rowCount, 1);
        } else {
          assert.equal((await firstClient.query(
            `DELETE FROM knowledge_ingestion_batches
             WHERE id = $1 AND user_id = $2 RETURNING id`,
            [batchId, owner],
          )).rowCount, 1);
        }

        await waitingClient.query('BEGIN');
        waitingOpen = true;
        const waitingPid = (await waitingClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        let waitingSettled = false;
        waitingPromise = (markerFirst
          ? waitingClient.query(
            `DELETE FROM knowledge_ingestion_batches
             WHERE id = $1 AND user_id = $2 RETURNING id`,
            [batchId, owner],
          )
          : waitingClient.query(
            `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
             VALUES ($1, NOW()) RETURNING scope_key`,
            [scopeKey],
          )).then((result) => {
          waitingSettled = true;
          return result;
        });
        await waitForBackendLockWait(pool, waitingPid);
        assert.equal(waitingSettled, false, 'the second account lifecycle operation must wait');
        await firstClient.query('COMMIT');
        firstOpen = false;
        assert.equal((await waitingPromise).rowCount, 1);
        await waitingClient.query('COMMIT');
        waitingOpen = false;
      } finally {
        if (firstOpen) await firstClient.query('ROLLBACK').catch(() => undefined);
        if (waitingPromise) await waitingPromise.catch(() => undefined);
        if (waitingOpen) await waitingClient.query('ROLLBACK').catch(() => undefined);
        waitingClient.release();
        firstClient.release();
      }
      assert.deepEqual((await pool.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches WHERE user_id = $1) AS batches,
           (SELECT COUNT(*)::integer FROM knowledge_ingestion_request_tombstones WHERE user_id = $1) AS tombstones,
           (SELECT COUNT(*)::integer FROM mcp_deleted_account_markers WHERE scope_key = $2) AS markers`,
        [owner, scopeKey],
      )).rows[0], { batches: 0, tombstones: 0, markers: 1 });
    };
    await exerciseAccountDeletionBridgeOrder(
      accountBatchDeleteFirstUserId,
      accountBatchDeleteFirstScopeKey,
      false,
    );
    await exerciseAccountDeletionBridgeOrder(
      accountMarkerFirstUserId,
      accountMarkerFirstScopeKey,
      true,
    );

    assert.equal((await pool.query(
      `INSERT INTO knowledge_ingestion_request_tombstones (user_id, provider, request_id)
       VALUES ($1, 'other', $2)`,
      [accountBlockedUserId, `blocked-account-delete:${fixtureId}`],
    )).rowCount, 1);
    await pool.query(
      `INSERT INTO billing_acquisition_blocks
         (user_id, reason, operation_owner_token, resolved_at)
       VALUES ($1, 'mobile_purchase_pending', $2, NULL)`,
      [accountBlockedUserId, `selected-export-test-${fixtureId}`],
    );
    const blockedFenceResults = await executePgTransaction(
      pool,
      (tx) => buildAccountDeletionFenceQueries(accountBlockedUserId)
        .map((query) => tx.query(query.text, query.params)),
    );
    assert.equal(blockedFenceResults[1].length, 0);
    assert.deepEqual((await pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM mcp_deleted_account_markers WHERE scope_key = $1) AS markers,
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_request_tombstones WHERE user_id = $2) AS tombstones`,
      [deriveMcpDeletedAccountScopeKey(accountBlockedUserId), accountBlockedUserId],
    )).rows[0], { markers: 0, tombstones: 1 }, 'a billing-blocked deletion must not purge tombstones');
    const accountPurgeQuery = buildPrivateProductPurgeQuery(accountPurgeUserId);
    await executePgTransaction(
      pool,
      (tx) => [tx.query(accountPurgeQuery.text, accountPurgeQuery.params)],
    );
    assert.deepEqual((await pool.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches WHERE user_id = $1) AS batches,
         (SELECT COUNT(*)::integer FROM knowledge_card_drafts WHERE user_id = $1) AS drafts,
         (SELECT COUNT(*)::integer FROM knowledge_product_events WHERE user_id = $1) AS events,
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_request_tombstones WHERE user_id = $1) AS tombstones`,
      [accountPurgeUserId],
    )).rows[0], { batches: 0, drafts: 0, events: 0, tombstones: 0 });
    bodyCompleted = true;
  } finally {
    const cleanupFailures = [];
    await collectCleanupFailure(cleanupFailures, 'delete isolated private knowledge', () => (
      pool.query('DELETE FROM user_knowledge_items WHERE user_id = ANY($1::text[])', [fixtureUserIds])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete isolated import batches', () => (
      pool.query('DELETE FROM knowledge_ingestion_batches WHERE user_id = ANY($1::text[])', [fixtureUserIds])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete isolated request tombstones', () => (
      pool.query('DELETE FROM knowledge_ingestion_request_tombstones WHERE user_id = ANY($1::text[])', [fixtureUserIds])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete isolated product events', () => (
      pool.query('DELETE FROM knowledge_product_events WHERE user_id = ANY($1::text[])', [fixtureUserIds])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete isolated billing acquisition block', () => (
      pool.query('DELETE FROM billing_acquisition_blocks WHERE user_id = $1', [accountBlockedUserId])
    ));
    await collectCleanupFailure(cleanupFailures, 'delete isolated account markers', () => (
      pool.query('DELETE FROM mcp_deleted_account_markers WHERE scope_key = ANY($1::text[])', [[
        accountPurgeScopeKey,
        accountBatchDeleteFirstScopeKey,
        accountMarkerFirstScopeKey,
      ]])
    ));
    await collectCleanupFailure(cleanupFailures, 'verify isolated fixture removal', async () => {
      const remaining = (await pool.query(
        `SELECT
           EXISTS (SELECT 1 FROM user_knowledge_items WHERE user_id = ANY($1::text[])) AS items,
           EXISTS (SELECT 1 FROM knowledge_ingestion_batches WHERE user_id = ANY($1::text[])) AS batches,
           EXISTS (SELECT 1 FROM knowledge_ingestion_request_tombstones WHERE user_id = ANY($1::text[])) AS tombstones,
           EXISTS (SELECT 1 FROM knowledge_card_drafts WHERE user_id = ANY($1::text[])) AS drafts,
           EXISTS (SELECT 1 FROM knowledge_card_sources WHERE user_id = ANY($1::text[])) AS sources,
           EXISTS (SELECT 1 FROM knowledge_evidence_spans WHERE user_id = ANY($1::text[])) AS evidence,
           EXISTS (SELECT 1 FROM knowledge_product_events WHERE user_id = ANY($1::text[])) AS events`,
        [fixtureUserIds],
      )).rows[0];
      assert.deepEqual(remaining, {
        items: false,
        batches: false,
        tombstones: false,
        drafts: false,
        sources: false,
        evidence: false,
        events: false,
      });
    });
    await collectCleanupFailure(cleanupFailures, 'close PostgreSQL pool', () => pool.end());
    if (db && originalDbQuery && originalDbTransaction) {
      db.query = originalDbQuery;
      db.transaction = originalDbTransaction;
      setKnowledgeTransactionSqlForTesting(null);
    }
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    surfaceCleanupFailures(bodyCompleted, context, cleanupFailures);
  }
});
