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
