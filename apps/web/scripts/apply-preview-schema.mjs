import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const PREVIEW_MIGRATIONS = [
  new URL('../drizzle/migrations/0014_guest_knowledge_limits.sql', import.meta.url),
  new URL('../drizzle/migrations/0015_typed_knowledge_bundles.sql', import.meta.url),
  new URL('../drizzle/migrations/0016_conversation_knowledge_hub.sql', import.meta.url),
  new URL('../drizzle/migrations/0017_supersession_replacement_tombstones.sql', import.meta.url),
  new URL('../drizzle/migrations/0018_expression_history_causality.sql', import.meta.url),
  new URL('../drizzle/migrations/0019_recall_ping_persistence.sql', import.meta.url),
];

const SAFE_STATEMENT_PREFIXES = [
  /^CREATE TABLE IF NOT EXISTS\b/i,
  /^CREATE INDEX IF NOT EXISTS\b/i,
  /^CREATE UNIQUE INDEX IF NOT EXISTS\b/i,
  /^ALTER TABLE\s+"?(?:user_knowledge_items|knowledge_ingestion_batches|knowledge_card_drafts|knowledge_card_sources|user_graph_edges|knowledge_item_supersessions)"?\s+ADD COLUMN IF NOT EXISTS\b/i,
  /^ALTER TABLE\s+"?(?:user_knowledge_items|knowledge_ingestion_batches|knowledge_card_drafts|knowledge_card_sources|user_graph_edges|knowledge_item_supersessions)"?\s+DROP CONSTRAINT IF EXISTS\b/i,
  /^ALTER TABLE\s+"?(?:user_knowledge_items|knowledge_ingestion_batches|knowledge_card_drafts|knowledge_card_sources|user_graph_edges|knowledge_item_supersessions)"?\s+ADD CONSTRAINT\b/i,
];

const RECALL_COLUMN_TYPES = new Map([
  ['recall_enrolled_at', 'timestamp with time zone'],
  ['recall_item_version', 'integer'],
  ['recall_schedule_state', 'text'],
  ['recall_d1_finalized_incomplete', 'boolean'],
  ['recall_d7_outcome', 'text'],
  ['recall_schedule_version', 'integer'],
]);

const RECALL_STATE_CONSTRAINTS = new Set([
  'user_private_card_states_status_check',
  'user_private_card_states_knowledge_state_check',
  'user_private_card_states_progress_state_check',
  'user_private_card_states_consistency_check',
  'user_private_card_states_recall_schedule_check',
]);

function normalizedSql(statement) {
  return statement.replace(/\s+/g, ' ').trim().replace(/;$/, '');
}

function keywordCount(statement, keyword) {
  return statement.match(new RegExp(`\\b${keyword}\\b`, 'gi'))?.length ?? 0;
}

function isKnownRecallStateStatement(statement) {
  const normalized = normalizedSql(statement);
  const columnMatch = normalized.match(
    /^ALTER TABLE "user_private_card_states" ADD COLUMN IF NOT EXISTS "([a-z0-9_]+)" (.+)$/i,
  );
  if (columnMatch) {
    return RECALL_COLUMN_TYPES.get(columnMatch[1]) === columnMatch[2].toLowerCase();
  }

  if (normalized === 'ALTER TABLE "user_private_card_states" ALTER COLUMN "status" DROP NOT NULL, ALTER COLUMN "knowledge_state" DROP NOT NULL, ALTER COLUMN "progress_state" DROP NOT NULL, ALTER COLUMN "last_seen" DROP NOT NULL, ALTER COLUMN "last_seen" DROP DEFAULT') {
    return true;
  }

  if (/^ALTER TABLE "user_private_card_states" DROP CONSTRAINT IF EXISTS /i.test(normalized)) {
    const names = [...normalized.matchAll(/DROP CONSTRAINT IF EXISTS "([a-z0-9_]+)"/gi)]
      .map((match) => match[1]);
    return names.length === RECALL_STATE_CONSTRAINTS.size
      && new Set(names).size === names.length
      && names.every((name) => RECALL_STATE_CONSTRAINTS.has(name))
      && keywordCount(normalized, 'ALTER') === 1
      && keywordCount(normalized, 'DROP') === 5
      && keywordCount(normalized, 'CONSTRAINT') === 5
      && !normalized.includes(';');
  }

  if (/^ALTER TABLE "user_private_card_states" ADD CONSTRAINT /i.test(normalized)) {
    const names = [...normalized.matchAll(/ADD CONSTRAINT "([a-z0-9_]+)"/gi)]
      .map((match) => match[1]);
    return names.length === 5
      && new Set(names).size === names.length
      && names.every((name) => RECALL_STATE_CONSTRAINTS.has(name))
      && keywordCount(normalized, 'ALTER') === 1
      && keywordCount(normalized, 'ADD') === 5
      && keywordCount(normalized, 'CONSTRAINT') === 5
      && keywordCount(normalized, 'CHECK') === 5
      && normalized.includes('COALESCE(')
      && normalized.includes('"recall_schedule_state" = \'ordinary_practice\'')
      && normalized.includes('"due_at" >= "recall_enrolled_at" + INTERVAL \'192 hours\'')
      && !normalized.includes(';');
  }

  return false;
}

export function parsePreviewMigration(sql) {
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function assertSafePreviewStatement(statement) {
  const isBoundedRetentionBackfill = /^UPDATE "user_knowledge_items"\s+SET "purge_at"\s*=/i.test(statement)
    && /AND "purge_at" IS NULL;?$/i.test(statement);
  const isKnownRelationOriginDefault = /^ALTER TABLE\s+"knowledge_card_sources"\s+ALTER COLUMN\s+"relation_origin"\s+SET DEFAULT\s+'extracted_from_source';?$/i.test(statement)
    || /^ALTER TABLE\s+"user_graph_edges"\s+ALTER COLUMN\s+"relation_origin"\s+SET DEFAULT\s+'explicit_user';?$/i.test(statement);
  if (!isBoundedRetentionBackfill
    && !isKnownRelationOriginDefault
    && !isKnownRecallStateStatement(statement)
    && !SAFE_STATEMENT_PREFIXES.some((pattern) => pattern.test(statement))) {
    throw new Error(`Refusing non-idempotent preview migration statement: ${statement.slice(0, 80)}`);
  }
}

export async function applyPreviewSchema({ databaseUrl, appEnv }) {
  if (appEnv !== 'preview') {
    throw new Error('Preview schema preparation requires APP_ENV=preview');
  }
  if (!databaseUrl) {
    throw new Error('Preview schema preparation requires DATABASE_URL');
  }

  const migrations = await Promise.all(
    PREVIEW_MIGRATIONS.map(async (url) => ({
      name: url.pathname.split('/').at(-1),
      statements: parsePreviewMigration(await readFile(url, 'utf8')),
    })),
  );
  for (const migration of migrations) {
    for (const statement of migration.statements) assertSafePreviewStatement(statement);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('girapphe-preview-schema-v1'))");
    for (const migration of migrations) {
      for (const statement of migration.statements) await client.query(statement);
      console.log(`Applied preview schema update: ${migration.name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) {
  await applyPreviewSchema({
    databaseUrl: process.env.DATABASE_URL,
    appEnv: process.env.APP_ENV,
  });
}
