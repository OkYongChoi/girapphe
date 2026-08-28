import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  applyPreviewSchema,
  assertSafePreviewStatement,
  parsePreviewMigration,
} from './apply-preview-schema.mjs';

test('preview schema update contains only bounded idempotent statements', async () => {
  const migrations = [
    ['0014_guest_knowledge_limits.sql', 5],
    ['0015_typed_knowledge_bundles.sql', 4],
    ['0016_conversation_knowledge_hub.sql', 39],
  ];
  for (const [name, expectedCount] of migrations) {
    const sql = await readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), 'utf8');
    const statements = parsePreviewMigration(sql);
    assert.equal(statements.length, expectedCount, name);
    for (const statement of statements) assert.doesNotThrow(() => assertSafePreviewStatement(statement));
  }
});

test('conversation hub migration restores owner-key uniqueness before composite foreign keys', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0016_conversation_knowledge_hub.sql', import.meta.url), 'utf8');
  const statements = parsePreviewMigration(sql);
  const prerequisiteIndex = statements.findIndex((statement) => (
    /^CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_knowledge_items_id_user_id"/i.test(statement)
  ));
  const compositeForeignKeyIndexes = statements
    .map((statement, index) => ({ statement, index }))
    .filter(({ statement }) => (
      /REFERENCES "user_knowledge_items"\("id", "user_id"\)/i.test(statement)
    ))
    .map(({ index }) => index);

  assert.notEqual(prerequisiteIndex, -1);
  assert.ok(compositeForeignKeyIndexes.length > 0);
  assert.ok(compositeForeignKeyIndexes.every((index) => prerequisiteIndex < index));
});

test('preview schema update rejects destructive and unbounded SQL', () => {
  assert.throws(() => assertSafePreviewStatement('DROP TABLE knowledge_cards'));
  assert.throws(() => assertSafePreviewStatement('ALTER TABLE knowledge_cards ADD COLUMN unsafe text'));
  assert.throws(() => assertSafePreviewStatement('UPDATE knowledge_cards SET title = NULL'));
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "knowledge_card_sources" ALTER COLUMN "relation_origin" SET DEFAULT 'explicit_user'`,
  ));
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "knowledge_card_sources" ALTER COLUMN "provider" SET DEFAULT 'extracted_from_source'`,
  ));
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "user_graph_edges" ALTER COLUMN "relation_origin" DROP DEFAULT`,
  ));
});

test('typed bundle migration keeps all new fields nullable and does not rewrite legacy rows', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0015_typed_knowledge_bundles.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /\bNOT NULL\b/i);
  assert.doesNotMatch(sql, /\bDEFAULT\b/i);
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im);
  assert.match(sql, /ALTER TABLE "user_knowledge_items"/);
  assert.match(sql, /ALTER TABLE "knowledge_card_drafts"/);
});

test('conversation knowledge hub migration is owner-scoped and selector-only', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0016_conversation_knowledge_hub.sql', import.meta.url), 'utf8');
  for (const table of [
    'mcp_deleted_account_markers',
    'knowledge_item_revisions',
    'knowledge_item_activity',
    'knowledge_item_supersessions',
    'knowledge_evidence_spans',
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
  }
  for (const constraint of [
    'knowledge_item_revisions_item_owner_fk',
    'knowledge_item_activity_item_owner_fk',
    'knowledge_item_supersessions_old_owner_fk',
    'knowledge_item_supersessions_new_owner_fk',
    'knowledge_evidence_spans_source_owner_item_fk',
  ]) {
    assert.match(sql, new RegExp(`CONSTRAINT "${constraint}"[\\s\\S]+?ON DELETE cascade`));
  }
  assert.match(sql, /"selector_type" text NOT NULL/);
  const markerStatement = parsePreviewMigration(sql)
    .find((statement) => statement.includes('CREATE TABLE IF NOT EXISTS "mcp_deleted_account_markers"'));
  assert.ok(markerStatement);
  assert.match(sql, /"scope_key" text PRIMARY KEY NOT NULL/);
  assert.match(sql, /CHECK \("scope_key" ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.doesNotMatch(markerStatement, /"user_id"/);
  assert.match(sql, /"selector" jsonb NOT NULL/);
  assert.doesNotMatch(sql, /"(?:excerpt|transcript|raw_text|raw_transcript)"\s+(?:text|jsonb)/i);
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1/);
  assert.match(sql, /user_knowledge_items_bundle_shape_check[\s\S]+NOT VALID/);
  assert.match(sql, /'question', 'decision', 'event'/);
  assert.match(sql, /'supersedes', 'answers', 'supports', 'contradicts'/);
  assert.match(sql, /knowledge_item_supersessions_old_key"[\s\S]+UNIQUE \("user_id", "superseded_item_id"\)/);
  assert.doesNotMatch(sql, /UNIQUE \("user_id", "superseded_item_id", "replacement_item_id"\)/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_target_owner_fk"[\s\S]+ADD CONSTRAINT "knowledge_card_drafts_target_owner_fk"/);
  assert.ok(sql.includes('ADD CONSTRAINT "knowledge_ingestion_batches_conversation_ref_check"'));
  assert.ok(sql.includes('ADD CONSTRAINT "knowledge_card_sources_conversation_ref_check"'));
  assert.ok(sql.includes(`AND "conversation_ref" !~* '^[a-z][a-z0-9+.-]*://'`));
  assert.ok(sql.includes(`AND "source_url" !~ '^https://[^/?#]*@'`));
  assert.ok(sql.includes(`AND position('?' in "source_url") = 0`));
  assert.ok(sql.includes(`AND position('#' in "source_url") = 0`));
  assert.match(sql, /CONSTRAINT "knowledge_evidence_spans_selector_check"/);
  assert.ok(sql.includes(`AND position('?' in ("selector" ->> 'source_ref')) = 0`));
  assert.ok(sql.includes(`AND position('#' in ("selector" ->> 'source_ref')) = 0`));
  assert.ok(sql.includes(`AND ("selector" ->> 'source_ref') !~ '^https://[^/?#]*@'`));
});

test('preview schema update is fenced to an explicit preview environment', async () => {
  await assert.rejects(
    applyPreviewSchema({ databaseUrl: 'postgresql://unused', appEnv: 'prod' }),
    /APP_ENV=preview/,
  );
  await assert.rejects(
    applyPreviewSchema({ databaseUrl: '', appEnv: 'preview' }),
    /DATABASE_URL/,
  );
});

test('typed bundle persistence checks reject partial nullable shapes', async () => {
  const sources = [
    '../drizzle/migrations/0016_conversation_knowledge_hub.sql',
    '../drizzle/schema.ts',
    '../schema.sql',
    '../src/lib/knowledge-ingestion.ts',
  ];
  const constraints = [
    'user_knowledge_items_bundle_shape_check',
    'knowledge_card_drafts_bundle_shape_check',
  ];

  for (const source of sources) {
    const text = await readFile(new URL(source, import.meta.url), 'utf8');
    for (const constraint of constraints) {
      const definitionStart = new RegExp(`${constraint}(?:"|\\b)[\\s\\S]{0,100}?COALESCE\\(`, 'i').exec(text);
      assert.ok(definitionStart, `${source}: ${constraint}`);
      const definition = text.slice(definitionStart.index, definitionStart.index + 1_200);
      assert.match(definition, /,\s*FALSE\s*\)\)?/i, `${source}: ${constraint}`);
    }
  }
});
