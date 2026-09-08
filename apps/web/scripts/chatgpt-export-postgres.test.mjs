import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';

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

test('selected-export create, ignore, discard, and deletion share the account-to-ingestion lock order', async () => {
  const source = await readFile(new URL('../src/lib/knowledge-ingestion.ts', import.meta.url), 'utf8');
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

  assertSharedIngestionLockOrder('create', create);
  assertSharedIngestionLockOrder('ignore', ignore);
  assertSharedIngestionLockOrder('discard', discard);
  assertSharedIngestionLockOrder('deletion', deletion);
  assert.match(deletion, /WHERE owned\.scope = 'selected_export'/);
  assert.match(create, /sessionTombstoneId/);
  assert.match(deletion, /selected-export-session:v1:/);
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
  const {
    buildChatGptExportBatchInput,
    chatGptExportImportInputSchema,
    createChatGptExportDraftBatchForUser,
  } = importModule.default ?? importModule;
  const {
    createKnowledgeDraftBatchForUser,
    deleteKnowledgeImportBatchForUser,
    getKnowledgeDraftBatchForUser,
    resolveKnowledgeDraftForUser,
    setKnowledgeTransactionSqlForTesting,
  } = knowledgeModule.default ?? knowledgeModule;
  const {
    deleteKnowledgeProductEventsForSubjectForUser,
    recordKnowledgeProductEventsForUser,
  } = eventModule.default ?? eventModule;
  const { recordChatGptExportCompletionTelemetry } = telemetryModule.default ?? telemetryModule;
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });
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
  const fixtureId = crypto.randomUUID();
  const userId = `live-selected-export-owner-${fixtureId}`;
  const otherUserId = `live-selected-export-other-${fixtureId}`;
  const legacyUserId = `live-selected-export-legacy-${fixtureId}`;
  const legacyIgnoredUserId = `live-selected-export-legacy-ignored-${fixtureId}`;
  const legacyExpandedUserId = `live-selected-export-legacy-expanded-${fixtureId}`;
  const crossScopeUserId = `live-selected-export-cross-scope-${fixtureId}`;
  const telemetryUserId = `live-selected-export-telemetry-${fixtureId}`;
  const fixtureUserIds = [
    userId, otherUserId, legacyUserId, legacyIgnoredUserId, legacyExpandedUserId,
    crossScopeUserId, telemetryUserId,
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
      eventName: 'conversation_import_started', eventVersion: 1, subjectId: telemetrySessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: telemetrySessionId, selectionCount: 7,
    }, {
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
      selectionCount: 2,
      result: telemetryCreated,
    });

    const duplicateTelemetrySessionId = crypto.randomUUID();
    await recordKnowledgeProductEventsForUser(telemetryUserId, [{
      eventName: 'conversation_import_started', eventVersion: 1,
      subjectId: duplicateTelemetrySessionId,
    }, {
      eventName: 'conversation_import_parsed', eventVersion: 1,
      subjectId: duplicateTelemetrySessionId, selectionCount: 9,
    }, {
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
    assert.equal(
      await deleteKnowledgeProductEventsForSubjectForUser(telemetryUserId, telemetryCreated.batchId),
      7,
    );
    assert.equal((await pool.query(
      'SELECT COUNT(*)::integer AS count FROM knowledge_product_events WHERE user_id = $1',
      [telemetryUserId],
    )).rows[0].count, 2);
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
