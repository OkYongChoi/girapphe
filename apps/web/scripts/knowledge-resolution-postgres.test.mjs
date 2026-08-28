import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';

const databaseUrl = process.env.LIVE_POSTGRES_TEST_DATABASE_URL?.trim();

test('PostgreSQL per-draft merge preserves lifecycle metadata and persists its relation atomically', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL resolution test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const imported = await import('../src/lib/knowledge-ingestion.ts');
  const knowledge = imported.default ?? imported;
  const {
    createKnowledgeDraftBatchForUser,
    DRAFT_RESOLUTION_EDGE_INSERT_SQL,
    getKnowledgeDraftBatchForUser,
    resolveKnowledgeDraftForUser,
  } = knowledge;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const userId = `live-resolution-${crypto.randomUUID()}`;
  const publicNodeId = `live-public-${crypto.randomUUID()}`;
  let targetItemId;
  let createdPublicNode = false;

  try {
    const insertedPublicNode = await pool.query(
      `INSERT INTO graph_nodes (id, label, domain)
       VALUES ($1, 'Live public node', 'Live resolution')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [publicNodeId],
    );
    createdPublicNode = insertedPublicNode.rowCount === 1;

    const hostname = new URL(databaseUrl).hostname;
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      const batchId = `live-batch-${crypto.randomUUID()}`;
      targetItemId = `live-item-${crypto.randomUUID()}`;
      const canonicalNodeId = `live-node-${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO knowledge_ingestion_batches
           (id, user_id, provider, request_id, status)
         VALUES ($1, $2, 'other', $3, 'pending')`,
        [batchId, userId, `live-request-${crypto.randomUUID()}`],
      );
      await pool.query(
        `INSERT INTO user_knowledge_items
           (id, user_id, title, content, topic, summary, tags, version, dedupe_key)
         VALUES ($1, $2, 'Canonical node lookup', 'Live SQL test', 'live-resolution', '', '[]'::jsonb, 1, $3)`,
        [targetItemId, userId, `live-dedupe-${crypto.randomUUID()}`],
      );
      await pool.query(
        `INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic)
         VALUES ($1, $2, $3, 'Canonical node lookup', 'live-resolution')`,
        [canonicalNodeId, userId, targetItemId],
      );
      const inserted = await pool.query(DRAFT_RESOLUTION_EDGE_INSERT_SQL, [
        `live-edge-${crypto.randomUUID()}`,
        userId,
        targetItemId,
        null,
        null,
        publicNodeId,
        'supports',
        0.65,
        batchId,
        'explicit_user',
      ]);
      assert.equal(inserted.rowCount, 1);
      assert.deepEqual((await pool.query(
        `SELECT source_private_node_id, target_public_node_id, type, weight,
           origin, source_batch_id, relation_origin
         FROM user_graph_edges WHERE user_id = $1`,
        [userId],
      )).rows, [{
        source_private_node_id: canonicalNodeId,
        target_public_node_id: publicNodeId,
        type: 'supports',
        weight: 0.65,
        origin: 'conversation',
        source_batch_id: batchId,
        relation_origin: 'explicit_user',
      }]);
      return;
    }

    const targetBatch = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'other',
      requestId: `live-target-${crypto.randomUUID()}`,
      cards: [{ title: 'Live canonical target', topic: 'live-resolution' }],
    });
    const targetDraft = (await getKnowledgeDraftBatchForUser(userId, targetBatch.batchId)).drafts[0];
    const targetResult = await resolveKnowledgeDraftForUser(userId, {
      batchId: targetBatch.batchId,
      draftId: targetDraft.id,
      expectedDraftVersion: targetDraft.version,
      action: 'create',
    });
    assert.equal(targetResult.resolved, true);
    targetItemId = targetResult.knowledgeItemId;
    assert.ok(targetItemId);

    await pool.query(
      `UPDATE user_knowledge_items SET
         observed_at = $3, valid_from = $4, valid_to = $5, review_at = $6
       WHERE id = $1 AND user_id = $2`,
      [
        targetItemId,
        userId,
        '2026-08-01T01:02:03.456Z',
        '2026-08-02T02:03:04.567Z',
        '2026-08-30T03:04:05.678Z',
        '2026-09-01T04:05:06.789Z',
      ],
    );
    const canonicalNodeId = (await pool.query(
      `SELECT id FROM user_graph_nodes WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, targetItemId],
    )).rows[0]?.id;
    assert.ok(canonicalNodeId);

    const mergeBatch = await createKnowledgeDraftBatchForUser(userId, {
      provider: 'chatgpt',
      requestId: `live-merge-${crypto.randomUUID()}`,
      cards: [{
        title: 'Live merge candidate',
        topic: 'live-resolution',
        relations: [{
          targetKind: 'public',
          targetId: `graph_${publicNodeId}`,
          type: 'supports',
          direction: 'outgoing',
          weight: 0.65,
          relationOrigin: 'explicit_user',
        }],
      }],
    });
    const mergeDraft = (await getKnowledgeDraftBatchForUser(userId, mergeBatch.batchId)).drafts[0];
    const merged = await resolveKnowledgeDraftForUser(userId, {
      batchId: mergeBatch.batchId,
      draftId: mergeDraft.id,
      expectedDraftVersion: mergeDraft.version,
      action: 'merge',
      targetKnowledgeItemId: targetItemId,
      expectedTargetVersion: 1,
      reviewed: {
        title: 'Live merged canonical item',
        summary: 'Lifecycle timestamps remain exact.',
        content: 'The confirmed item also retains its proposed relation.',
        topic: 'live-resolution',
        tags: ['live-test'],
        knowledgeType: null,
        centralQuestion: null,
        structuredContent: null,
        bundleSchemaVersion: null,
      },
    });
    assert.deepEqual(merged, {
      resolved: true,
      action: 'merge',
      knowledgeItemId: targetItemId,
      version: 2,
      skippedEdges: 0,
    });

    const item = (await pool.query(
      `SELECT version, observed_at, valid_from, valid_to, review_at
       FROM user_knowledge_items WHERE id = $1 AND user_id = $2`,
      [targetItemId, userId],
    )).rows[0];
    assert.equal(item.version, 2);
    assert.equal(item.observed_at.toISOString(), '2026-08-01T01:02:03.456Z');
    assert.equal(item.valid_from.toISOString(), '2026-08-02T02:03:04.567Z');
    assert.equal(item.valid_to.toISOString(), '2026-08-30T03:04:05.678Z');
    assert.equal(item.review_at.toISOString(), '2026-09-01T04:05:06.789Z');

    const nodes = await pool.query(
      `SELECT id FROM user_graph_nodes WHERE user_id = $1 AND knowledge_item_id = $2`,
      [userId, targetItemId],
    );
    assert.equal(nodes.rowCount, 1);
    assert.equal(nodes.rows[0].id, canonicalNodeId);
    assert.deepEqual((await pool.query(
      `SELECT source_private_node_id, source_public_node_id,
         target_private_node_id, target_public_node_id, type, weight, origin,
         source_batch_id, relation_origin
       FROM user_graph_edges
       WHERE user_id = $1 AND source_batch_id = $2 AND deleted_at IS NULL`,
      [userId, mergeBatch.batchId],
    )).rows, [{
      source_private_node_id: canonicalNodeId,
      source_public_node_id: null,
      target_private_node_id: null,
      target_public_node_id: publicNodeId,
      type: 'supports',
      weight: 0.65,
      origin: 'conversation',
      source_batch_id: mergeBatch.batchId,
      relation_origin: 'explicit_user',
    }]);
    assert.equal((await pool.query(
      `SELECT status FROM knowledge_card_drafts WHERE id = $1 AND user_id = $2`,
      [mergeDraft.id, userId],
    )).rows[0]?.status, 'approved');
  } finally {
    await pool.query('DELETE FROM user_knowledge_items WHERE user_id = $1', [userId]).catch(() => undefined);
    await pool.query('DELETE FROM knowledge_ingestion_batches WHERE user_id = $1', [userId]).catch(() => undefined);
    if (createdPublicNode) {
      await pool.query('DELETE FROM graph_nodes WHERE id = $1', [publicNodeId]).catch(() => undefined);
    }
    await pool.end();
  }
});

test('PostgreSQL reuse validation rejects a selection that expires behind the account lock', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL reuse test',
  timeout: 20_000,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const imported = await import('../src/lib/knowledge-ingestion.ts');
  const knowledge = imported.default ?? imported;
  const { recordKnowledgeReuseForUser } = knowledge;
  const lifecycleImported = await import('../src/lib/mcp-account-lifecycle.ts');
  const lifecycle = lifecycleImported.default ?? lifecycleImported;
  const { deriveMcpAccountAdvisoryLockKey } = lifecycle;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const userId = `live-reuse-retention-${crypto.randomUUID()}`;
  const activeItemId = `live-reuse-active-${crypto.randomUUID()}`;
  const expiredItemId = `live-reuse-expired-${crypto.randomUUID()}`;
  let blocker;
  let blockerTransaction = false;
  let reusePromise;

  try {
    await pool.query(
      `INSERT INTO user_knowledge_items
         (id, user_id, title, content, topic, summary, tags, version, dedupe_key, purge_at)
       VALUES
         ($1, $3, 'Retained reuse context', 'Still eligible', 'live-reuse-retention', '', '[]'::jsonb, 1, $4, NOW() + INTERVAL '1 day'),
         ($2, $3, 'Expiring reuse context', 'Expires while final validation waits', 'live-reuse-retention', '', '[]'::jsonb, 1, $5, NOW() + INTERVAL '1 day')`,
      [
        activeItemId,
        expiredItemId,
        userId,
        `live-reuse-active-${crypto.randomUUID()}`,
        `live-reuse-expired-${crypto.randomUUID()}`,
      ],
    );

    blocker = await pool.connect();
    await blocker.query('BEGIN');
    blockerTransaction = true;
    await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      deriveMcpAccountAdvisoryLockKey(userId),
    ]);
    reusePromise = recordKnowledgeReuseForUser(userId, [activeItemId, expiredItemId]);
    void reusePromise.catch(() => undefined);

    let observedWaiter = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const waiting = await blocker.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_stat_activity activity
           WHERE pg_backend_pid() = ANY(pg_blocking_pids(activity.pid))
         ) AS waiting`,
      );
      if (waiting.rows[0]?.waiting) {
        observedWaiter = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(observedWaiter, true, 'reuse transaction must wait behind the held account lock');

    await blocker.query(
      `UPDATE user_knowledge_items
       SET purge_at = clock_timestamp() + INTERVAL '200 milliseconds'
       WHERE id = $1 AND user_id = $2`,
      [expiredItemId, userId],
    );
    await blocker.query('SELECT pg_sleep(0.35)');
    await blocker.query('COMMIT');
    blockerTransaction = false;

    assert.equal(await reusePromise, 0);
    assert.equal((await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM knowledge_item_activity
       WHERE user_id = $1 AND activity_type = 'reused'`,
      [userId],
    )).rows[0]?.count, 0);

    assert.equal(await recordKnowledgeReuseForUser(userId, [activeItemId]), 1);
    assert.deepEqual((await pool.query(
      `SELECT knowledge_item_id
       FROM knowledge_item_activity
       WHERE user_id = $1 AND activity_type = 'reused'`,
      [userId],
    )).rows, [{ knowledge_item_id: activeItemId }]);
  } finally {
    if (blockerTransaction) await blocker.query('ROLLBACK').catch(() => undefined);
    blocker?.release();
    if (reusePromise) await reusePromise.catch(() => undefined);
    await pool.query('DELETE FROM user_knowledge_items WHERE user_id = $1', [userId]).catch(() => undefined);
    await pool.end();
  }
});

test('PostgreSQL Topic Hub relations expose only active private endpoints', {
  skip: databaseUrl ? false : 'set LIVE_POSTGRES_TEST_DATABASE_URL for the real PostgreSQL Topic Hub test',
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const imported = await import('../src/lib/topic-knowledge-hub.ts');
  const topicKnowledge = imported.default ?? imported;
  const { getTopicKnowledgeHubForUser } = topicKnowledge;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const userId = `live-topic-relations-${crypto.randomUUID()}`;
  const topic = 'live-topic-relations';
  const itemIds = {
    source: `live-item-source-${crypto.randomUUID()}`,
    active: `live-item-active-${crypto.randomUUID()}`,
    archived: `live-item-archived-${crypto.randomUUID()}`,
    deleted: `live-item-deleted-${crypto.randomUUID()}`,
    expired: `live-item-expired-${crypto.randomUUID()}`,
    superseded: `live-item-superseded-${crypto.randomUUID()}`,
    replacement: `live-item-replacement-${crypto.randomUUID()}`,
    deletedNode: `live-item-node-deleted-${crypto.randomUUID()}`,
  };
  const nodeIds = Object.fromEntries(Object.entries(itemIds).map(([state, itemId]) => [
    state,
    `live-node-${state}-${itemId.slice(-36)}`,
  ]));
  const activeEdgeId = `live-edge-active-${crypto.randomUUID()}`;
  const publicEdgeId = `live-edge-public-${crypto.randomUUID()}`;
  const publicIncomingEdgeId = `live-edge-public-incoming-${crypto.randomUUID()}`;
  const publicNodeId = `live-public-topic-${crypto.randomUUID()}`;
  let createdPublicNode = false;

  try {
    const insertedPublicNode = await pool.query(
      `INSERT INTO graph_nodes (id, label, domain)
       VALUES ($1, 'Live Topic Hub public node', 'Live Topic Hub')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [publicNodeId],
    );
    createdPublicNode = insertedPublicNode.rowCount === 1;

    for (const [state, itemId] of Object.entries(itemIds)) {
      await pool.query(
        `INSERT INTO user_knowledge_items
           (id, user_id, title, content, topic, summary, tags, version, dedupe_key)
         VALUES ($1, $2, $3, 'Live Topic Hub relation fixture', $4, '', '[]'::jsonb, 1, $5)`,
        [
          itemId,
          userId,
          `Live Topic Hub ${state}`,
          state === 'source' ? topic : 'live-topic-relation-targets',
          `live-topic-dedupe-${crypto.randomUUID()}`,
        ],
      );
      await pool.query(
        `INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic)
         VALUES ($1, $2, $3, $4, $5)`,
        [nodeIds[state], userId, itemId, `Live Topic Hub ${state}`, topic],
      );
    }

    await pool.query(
      `UPDATE user_knowledge_items SET archived_at = NOW() WHERE id = $1 AND user_id = $2`,
      [itemIds.archived, userId],
    );
    await pool.query(
      `UPDATE user_knowledge_items SET deleted_at = NOW() WHERE id = $1 AND user_id = $2`,
      [itemIds.deleted, userId],
    );
    await pool.query(
      `UPDATE user_knowledge_items SET purge_at = NOW() - INTERVAL '1 minute' WHERE id = $1 AND user_id = $2`,
      [itemIds.expired, userId],
    );
    await pool.query(
      `UPDATE user_graph_nodes SET deleted_at = NOW() WHERE id = $1 AND user_id = $2`,
      [nodeIds.deletedNode, userId],
    );
    await pool.query(
      `INSERT INTO knowledge_item_supersessions
         (id, user_id, superseded_item_id, replacement_item_id,
          replacement_live_item_id, replacement_live_user_id, reason)
       VALUES ($1, $2, $3, $4, $4, $2, 'Live Topic Hub inactive endpoint fixture')`,
      [
        `live-supersession-${crypto.randomUUID()}`,
        userId,
        itemIds.superseded,
        itemIds.replacement,
      ],
    );

    await pool.query(
      `INSERT INTO user_graph_edges
         (id, user_id, source_private_node_id, target_private_node_id, type, weight)
       VALUES ($1, $2, $3, $4, 'related', 1)`,
      [activeEdgeId, userId, nodeIds.source, nodeIds.active],
    );
    await pool.query(
      `INSERT INTO user_graph_edges
         (id, user_id, source_private_node_id, target_public_node_id, type, weight)
       VALUES ($1, $2, $3, $4, 'related', 1)`,
      [publicEdgeId, userId, nodeIds.source, publicNodeId],
    );
    await pool.query(
      `INSERT INTO user_graph_edges
         (id, user_id, source_public_node_id, target_private_node_id, type, weight)
       VALUES ($1, $2, $3, $4, 'supports', 1)`,
      [publicIncomingEdgeId, userId, publicNodeId, nodeIds.source],
    );
    for (const state of ['archived', 'deleted', 'expired', 'superseded', 'deletedNode']) {
      await pool.query(
        `INSERT INTO user_graph_edges
           (id, user_id, source_private_node_id, target_private_node_id, type, weight)
         VALUES ($1, $2, $3, $4, 'supports', 1),
                ($5, $2, $4, $3, 'answers', 1)`,
        [
          `live-edge-to-${state}-${crypto.randomUUID()}`,
          userId,
          nodeIds.source,
          nodeIds[state],
          `live-edge-from-${state}-${crypto.randomUUID()}`,
        ],
      );
    }

    const hub = await getTopicKnowledgeHubForUser(userId, topic);
    assert.deepEqual(hub.items.map((item) => item.id), [itemIds.source]);
    assert.deepEqual(hub.relations.map((relation) => ({
      id: relation.id,
      source: relation.source,
      target: relation.target,
    })), [{
      id: activeEdgeId,
      source: `personal:${itemIds.source}`,
      target: `personal:${itemIds.active}`,
    }, {
      id: publicEdgeId,
      source: `personal:${itemIds.source}`,
      target: `public:${publicNodeId}`,
    }, {
      id: publicIncomingEdgeId,
      source: `public:${publicNodeId}`,
      target: `personal:${itemIds.source}`,
    }]);
  } finally {
    await pool.query('DELETE FROM user_knowledge_items WHERE user_id = $1', [userId]).catch(() => undefined);
    if (createdPublicNode) {
      await pool.query('DELETE FROM graph_nodes WHERE id = $1', [publicNodeId]).catch(() => undefined);
    }
    await pool.end();
  }
});
