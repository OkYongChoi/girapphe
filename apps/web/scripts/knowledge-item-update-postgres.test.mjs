import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import updateQueryModule from '../src/lib/knowledge-item-update-query.ts';

const { KNOWLEDGE_ITEM_UPDATE_QUERY } = updateQueryModule;
const databaseUrl = process.env.ACCOUNT_BILLING_FENCE_TEST_DATABASE_URL?.trim();

test('knowledge item update qualifies fallback columns from the update target', () => {
  for (const column of [
    'tags',
    'summary',
    'knowledge_type',
    'central_question',
    'structured_content',
    'bundle_schema_version',
  ]) {
    assert.match(
      KNOWLEDGE_ITEM_UPDATE_QUERY,
      new RegExp(`(?:THEN|ELSE) i\\.${column}(?: ELSE| END)`),
      column,
    );
  }
});

test('PostgreSQL round-trips plain edits and legacy-to-structured conversion', {
  skip: databaseUrl ? false : 'set ACCOUNT_BILLING_FENCE_TEST_DATABASE_URL for the real PostgreSQL update test',
}, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const schema = `knowledge_item_update_${crypto.randomUUID().replaceAll('-', '')}`;
  assert.match(schema, /^[a-z0-9_]+$/);
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`CREATE TABLE user_knowledge_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT 'general',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      knowledge_type TEXT,
      central_question TEXT,
      structured_content JSONB,
      bundle_schema_version INTEGER,
      dedupe_key TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      last_verified_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ
    )`);
    await client.query(`CREATE TABLE knowledge_item_supersessions (
      user_id TEXT NOT NULL,
      superseded_item_id TEXT NOT NULL
    )`);
    await client.query(`CREATE TABLE knowledge_item_revisions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      knowledge_item_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot JSONB NOT NULL,
      change_reason TEXT,
      UNIQUE (knowledge_item_id, version)
    )`);
    await client.query(`CREATE TABLE knowledge_item_activity (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      knowledge_item_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      metadata JSONB NOT NULL
    )`);
    await client.query(`CREATE TABLE user_graph_nodes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      knowledge_item_id TEXT NOT NULL,
      label TEXT NOT NULL,
      topic TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )`);

    async function insertItem(id, title, summary, content) {
      await client.query(
        `INSERT INTO user_knowledge_items
           (id, user_id, title, summary, content, topic, tags, dedupe_key)
         VALUES ($1, 'guest_test', $2, $3, $4, 'general', '["original"]'::jsonb, 'original-key')`,
        [id, title, summary, content],
      );
      await client.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, user_id, id, version, to_jsonb(user_knowledge_items), 'confirmed'
         FROM user_knowledge_items WHERE id = $2`,
        [`revision-${id}-1`, id],
      );
    }

    async function updateItem({
      id,
      title,
      summary,
      content,
      tags,
      bundle,
      dedupeKey,
    }) {
      const result = await client.query(KNOWLEDGE_ITEM_UPDATE_QUERY, [
        id,
        'guest_test',
        title,
        content,
        'general',
        tags === undefined ? null : JSON.stringify(tags),
        summary === undefined ? null : summary,
        false,
        Boolean(bundle),
        bundle?.type ?? null,
        bundle?.question ?? null,
        bundle ? JSON.stringify(bundle.content) : null,
        bundle ? 1 : null,
        1,
        dedupeKey,
        `revision-${id}-before`,
        `revision-${id}-2`,
        `activity-${id}-2`,
      ]);
      assert.equal(result.rowCount, 1);
    }

    await insertItem('plain', 'Plain note', 'Keep summary', 'Keep body');
    await updateItem({
      id: 'plain',
      title: 'Plain note updated',
      content: 'Updated body',
      dedupeKey: 'plain-updated-key',
    });
    const plain = (await client.query(
      `SELECT title, summary, content, tags, knowledge_type, version
       FROM user_knowledge_items WHERE id = 'plain'`,
    )).rows[0];
    assert.deepEqual(plain, {
      title: 'Plain note updated',
      summary: 'Keep summary',
      content: 'Updated body',
      tags: ['original'],
      knowledge_type: null,
      version: 2,
    });

    const legacyBody = 'Keep this user-authored body during conversion.';
    const structuredContent = {
      type: 'procedure',
      goal: legacyBody,
      prerequisites: [],
      steps: [],
      branches: [],
      failure_modes: [],
      done_when: [],
    };
    await insertItem('legacy', 'Legacy note', '', legacyBody);
    await updateItem({
      id: 'legacy',
      title: 'Legacy note',
      summary: '',
      content: legacyBody,
      tags: [],
      bundle: {
        type: 'procedure',
        question: 'How is the original note retained?',
        content: structuredContent,
      },
      dedupeKey: 'legacy-procedure-key',
    });
    const converted = (await client.query(
      `SELECT summary, content, tags, knowledge_type, central_question,
         structured_content, bundle_schema_version, version
       FROM user_knowledge_items WHERE id = 'legacy'`,
    )).rows[0];
    assert.deepEqual(converted, {
      summary: '',
      content: legacyBody,
      tags: [],
      knowledge_type: 'procedure',
      central_question: 'How is the original note retained?',
      structured_content: structuredContent,
      bundle_schema_version: 1,
      version: 2,
    });

    for (const id of ['plain', 'legacy']) {
      const revisions = await client.query(
        `SELECT version, change_reason FROM knowledge_item_revisions
         WHERE knowledge_item_id = $1 ORDER BY version`,
        [id],
      );
      assert.deepEqual(revisions.rows, [
        { version: 1, change_reason: 'confirmed' },
        { version: 2, change_reason: 'manual_update' },
      ]);
      assert.equal((await client.query(
        `SELECT COUNT(*)::int AS count FROM knowledge_item_activity
         WHERE knowledge_item_id = $1 AND activity_type = 'revised'`,
        [id],
      )).rows[0]?.count, 1);
    }
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    client.release();
    await pool.end();
  }
});
