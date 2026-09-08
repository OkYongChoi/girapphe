import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PREVIEW_BILLING_ENVIRONMENT_STATEMENTS,
  applyPreviewSchema,
  assertSafePreviewStatement,
  parsePreviewMigration,
} from './apply-preview-schema.mjs';

test('preview schema update contains only bounded idempotent statements', async () => {
  const migrations = [
    ['0014_guest_knowledge_limits.sql', 5],
    ['0015_typed_knowledge_bundles.sql', 4],
    ['0016_conversation_knowledge_hub.sql', 39],
    ['0017_supersession_replacement_tombstones.sql', 7],
    ['0018_expression_history_causality.sql', 11],
    ['0019_selected_export_ingestion.sql', 3],
    ['0020_knowledge_intelligence_events.sql', 3],
    ['0021_billing_v1_domain.sql', 63],
    ['0022_recall_ping_persistence.sql', 15],
    ['0023_knowledge_ingestion_request_tombstones.sql', 9],
  ];
  for (const [name, expectedCount] of migrations) {
    const sql = await readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), 'utf8');
    const statements = parsePreviewMigration(sql);
    assert.equal(statements.length, expectedCount, name);
    for (const statement of statements) assert.doesNotThrow(() => assertSafePreviewStatement(statement));
  }
});

test('preview upgrade reclassifies existing legacy billing rows and compatibility defaults', () => {
  assert.equal(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS.length, 4);
  for (const statement of PREVIEW_BILLING_ENVIRONMENT_STATEMENTS) {
    assert.doesNotThrow(() => assertSafePreviewStatement(statement));
  }
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[0], /billing_subscriptions/);
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[0], /SET "environment" = 'test'/);
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[0], /WHERE "environment" = 'production'/);
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[1], /SET DEFAULT 'test'/);
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[2], /billing_webhook_events/);
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[2], /WHERE "environment" = 'production'/);
  assert.match(PREVIEW_BILLING_ENVIRONMENT_STATEMENTS[3], /SET DEFAULT 'test'/);
});

test('billing V1 migration preserves mixed-version legacy contracts', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0021_billing_v1_domain.sql', import.meta.url), 'utf8');
  const statements = parsePreviewMigration(sql);
  const subscriptionBootstrap = statements.findIndex((statement) => (
    /^CREATE TABLE IF NOT EXISTS "billing_subscriptions"/i.test(statement)
  ));
  const subscriptionUpgrade = statements.findIndex((statement) => (
    /^ALTER TABLE "billing_subscriptions"/i.test(statement)
  ));
  const eventBootstrap = statements.findIndex((statement) => (
    /^CREATE TABLE IF NOT EXISTS "billing_webhook_events"/i.test(statement)
  ));
  const eventUpgrade = statements.findIndex((statement) => (
    /^ALTER TABLE "billing_webhook_events"/i.test(statement)
  ));

  assert.notEqual(subscriptionBootstrap, -1);
  assert.notEqual(eventBootstrap, -1);
  assert.ok(subscriptionBootstrap < subscriptionUpgrade);
  assert.ok(eventBootstrap < eventUpgrade);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(
    sql,
    /DROP CONSTRAINT IF EXISTS "billing_subscriptions_provider_reference_key"/,
  );
  assert.doesNotMatch(
    sql,
    /DROP CONSTRAINT IF EXISTS "billing_webhook_events_pkey"/,
  );
  assert.match(
    sql,
    /ADD CONSTRAINT "billing_subscriptions_provider_environment_reference_key"\s+UNIQUE \("provider", "environment", "provider_subscription_id"\)/,
  );
  assert.match(
    sql,
    /ADD CONSTRAINT "billing_webhook_events_provider_environment_event_key"\s+UNIQUE \("provider", "environment", "event_id"\)/,
  );
  assert.doesNotMatch(sql, /ALTER COLUMN "environment" DROP DEFAULT/);
});

test('billing V1 provider accounts retain multiple immutable aliases per user', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0021_billing_v1_domain.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /CONSTRAINT "billing_provider_accounts_user_provider_environment_key"\s+UNIQUE/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "billing_provider_accounts_user_provider_environment_key"/);
  assert.match(sql, /idx_billing_provider_accounts_user_provider_environment/);
  assert.match(sql, /CONSTRAINT "billing_provider_accounts_provider_customer_key"\s+UNIQUE \("provider", "environment", "provider_customer_id"\)/);
});

test('billing V1 rebuilds the pending-event index on retry timestamps', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0021_billing_v1_domain.sql', import.meta.url), 'utf8');
  assert.match(sql, /DROP INDEX IF EXISTS "idx_billing_webhook_events_pending"/);
  assert.match(
    sql,
    /ON "billing_webhook_events" \("updated_at"\)[\s\S]+WHERE "processed_at" IS NULL/,
  );
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
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "user_private_card_states" ADD COLUMN IF NOT EXISTS "recall_payload" jsonb`,
  ));
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "user_private_card_states" ALTER COLUMN "status" SET NOT NULL`,
  ));
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "user_private_card_states" DROP COLUMN "due_at"`,
  ));
  assert.throws(() => assertSafePreviewStatement(
    `ALTER TABLE "user_private_card_states"
       DROP CONSTRAINT IF EXISTS "user_private_card_states_status_check",
       DROP CONSTRAINT IF EXISTS "user_private_card_states_knowledge_state_check",
       DROP CONSTRAINT IF EXISTS "user_private_card_states_progress_state_check",
       DROP CONSTRAINT IF EXISTS "user_private_card_states_consistency_check",
       DROP CONSTRAINT IF EXISTS "user_private_card_states_recall_schedule_check",
       DROP COLUMN "due_at"`,
  ));
});

test('recall persistence migration preserves one scheduling authority and legacy source honesty', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0022_recall_ping_persistence.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "user_private_card_states"/);
  assert.equal((sql.match(/ADD COLUMN IF NOT EXISTS "recall_[a-z0-9_]+"/g) ?? []).length, 6);
  assert.doesNotMatch(sql, /ADD COLUMN IF NOT EXISTS "recall_due_at"/);
  assert.match(sql, /"due_at" >= "recall_enrolled_at" \+ INTERVAL '24 hours'/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "supported_item_version" integer/);
  assert.match(sql, /FOREIGN KEY \("knowledge_item_id", "supported_item_version"\)/);
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im);
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

test('expression and causality migration is additive, owner-scoped, and selector-only', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0018_expression_history_causality.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im);
  assert.match(sql, /'question', 'decision', 'event', 'expression'/);
  assert.match(sql, /'causes', 'contributes_to', 'enables', 'inhibits'/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "knowledge_relation_evidence"/);
  assert.match(sql, /FOREIGN KEY \("edge_id", "user_id"\)/);
  assert.match(sql, /FOREIGN KEY \("evidence_span_id", "user_id"\)/);
  assert.doesNotMatch(sql, /"(?:excerpt|transcript|raw_text|raw_transcript)"\s+(?:text|jsonb)/i);
});

test('selected export migration widens only the explicit ingestion scope', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0019_selected_export_ingestion.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE|INSERT)\b/im);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_scope_check"/);
  assert.match(sql, /CHECK \("scope" IN \('current_conversation', 'selected_export'\)\) NOT VALID/);
});

test('selected export deletion tombstones are content-free and owner scoped', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0023_knowledge_ingestion_request_tombstones.sql', import.meta.url), 'utf8');
  const statements = parsePreviewMigration(sql);
  assert.ok(statements.every((statement) => !/^\s*(?:UPDATE|DELETE|INSERT)\b/i.test(statement)));
  assert.match(sql, /PRIMARY KEY\("user_id", "provider", "request_id"\)/);
  assert.match(sql, /"created_at" timestamp with time zone DEFAULT now\(\) NOT NULL/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_user_provider_request_key"/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_user_id_provider_request_id_key"/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS "idx_knowledge_ingestion_batches_user_provider_scope_request"/);
  assert.match(sql, /\("user_id", "provider", "scope", "request_id"\)/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS "idx_knowledge_product_events_user_subject"/);
  assert.match(sql, /AFTER DELETE ON public\.knowledge_ingestion_batches/);
  assert.match(sql, /REFERENCING OLD TABLE AS deleted_knowledge_ingestion_batches/);
  assert.match(sql, /FOR EACH STATEMENT/);
  assert.match(sql, /DELETE FROM public\.knowledge_product_events AS event[\s\S]+USING deleted_knowledge_ingestion_batches AS batch/);
  assert.match(sql, /BEFORE INSERT ON public\.knowledge_product_events/);
  assert.match(sql, /AFTER UPDATE OF subject_id ON public\.knowledge_product_events/);
  assert.match(sql, /NEW\.event_name IN \([\s\S]+conversation_import_confirmed[\s\S]+conversation_import_candidates_ready[\s\S]+conversation_import_first_value_viewed/);
  assert.match(sql, /NEW\.event_name = 'knowledge_candidate_resolved'/);
  assert.match(sql, /NEW\.event_name IN \('conversation_import_started', 'conversation_import_parsed'\)/);
  assert.match(sql, /batch\.provider = 'chatgpt' AND batch\.scope = 'selected_export'/);
  assert.equal((sql.match(/pg_catalog\.decode\('00', 'hex'\)/g) ?? []).length, 2);
  for (const statement of statements.slice(4)) {
    assert.doesNotThrow(() => assertSafePreviewStatement(statement));
  }
  assert.doesNotMatch(sql, /"(?:title|topic|message|content|filename|source_url|conversation_ref|selection)"\s+(?:text|jsonb)/i);
});

test('thinking-history events persist only opaque identifiers and aggregate dimensions', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0020_knowledge_intelligence_events.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /^\s*(?:UPDATE|DELETE|INSERT)\b/im);
  assert.match(sql, /"subject_id" text NOT NULL/);
  assert.match(sql, /"subject_id" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /"selection_count" integer/);
  assert.doesNotMatch(sql, /"(?:title|topic|message|content|filename|source_url|context_output)"\s+(?:text|jsonb)/i);
  assert.match(sql, /knowledge_product_events_shape_check/);
});

test('supersession tombstone migration upgrades already-created hub tables safely', async () => {
  const sql = await readFile(new URL('../drizzle/migrations/0017_supersession_replacement_tombstones.sql', import.meta.url), 'utf8');
  for (const statement of parsePreviewMigration(sql)) assertSafePreviewStatement(statement);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "replacement_live_item_id" text/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "replacement_live_user_id" text/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS "knowledge_item_supersessions_new_owner_fk"/);
  assert.match(sql, /FOREIGN KEY \("replacement_live_item_id", "replacement_live_user_id"\)/);
  assert.match(sql, /ON DELETE set null/);
  assert.match(sql, /"replacement_live_item_id" = "replacement_item_id"/);
  assert.match(sql, /"replacement_live_user_id" = "user_id"/);
  assert.doesNotMatch(sql, /^\s*UPDATE\b/im);
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
