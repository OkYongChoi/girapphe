import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const PREVIEW_MIGRATIONS = [
  new URL('../drizzle/migrations/0014_guest_knowledge_limits.sql', import.meta.url),
  new URL('../drizzle/migrations/0015_typed_knowledge_bundles.sql', import.meta.url),
  new URL('../drizzle/migrations/0016_conversation_knowledge_hub.sql', import.meta.url),
  new URL('../drizzle/migrations/0017_supersession_replacement_tombstones.sql', import.meta.url),
  new URL('../drizzle/migrations/0018_expression_history_causality.sql', import.meta.url),
  new URL('../drizzle/migrations/0019_selected_export_ingestion.sql', import.meta.url),
  new URL('../drizzle/migrations/0020_knowledge_intelligence_events.sql', import.meta.url),
  new URL('../drizzle/migrations/0021_billing_v1_domain.sql', import.meta.url),
];

const SAFE_STATEMENT_PREFIXES = [
  /^CREATE TABLE IF NOT EXISTS\b/i,
  /^CREATE INDEX IF NOT EXISTS\b/i,
  /^CREATE UNIQUE INDEX IF NOT EXISTS\b/i,
  /^CREATE SEQUENCE IF NOT EXISTS\b/i,
  /^ALTER TABLE\s+"?(?:user_knowledge_items|knowledge_ingestion_batches|knowledge_card_drafts|knowledge_card_sources|user_graph_edges|knowledge_item_supersessions)"?\s+ADD COLUMN IF NOT EXISTS\b/i,
  /^ALTER TABLE\s+"?(?:user_knowledge_items|knowledge_ingestion_batches|knowledge_card_drafts|knowledge_card_sources|user_graph_edges|knowledge_item_supersessions)"?\s+DROP CONSTRAINT IF EXISTS\b/i,
  /^ALTER TABLE\s+"?(?:user_knowledge_items|knowledge_ingestion_batches|knowledge_card_drafts|knowledge_card_sources|user_graph_edges|knowledge_item_supersessions)"?\s+ADD CONSTRAINT\b/i,
  /^ALTER TABLE\s+"?(?:billing_subscriptions|billing_webhook_events)"?\s+(?:ADD COLUMN IF NOT EXISTS|ALTER COLUMN|DROP CONSTRAINT IF EXISTS|ADD CONSTRAINT)\b/i,
  /^ALTER TABLE\s+"?billing_provider_accounts"?\s+DROP CONSTRAINT IF EXISTS\b/i,
  /^DROP INDEX IF EXISTS\s+"?idx_billing_webhook_events_pending"?\b/i,
];

// 0021 defaults legacy rows to production so the same migration is safe for
// production. Preview owns a separate database: immediately reclassify the
// pre-existing legacy rows and its compatibility defaults inside this fenced
// transaction so old Preview subscriptions and event leases remain visible.
export const PREVIEW_BILLING_ENVIRONMENT_STATEMENTS = [
  `UPDATE "billing_subscriptions"
   SET "environment" = 'test'
   WHERE "environment" = 'production'`,
  `ALTER TABLE "billing_subscriptions"
   ALTER COLUMN "environment" SET DEFAULT 'test'`,
  `UPDATE "billing_webhook_events"
   SET "environment" = 'test'
   WHERE "environment" = 'production'`,
  `ALTER TABLE "billing_webhook_events"
   ALTER COLUMN "environment" SET DEFAULT 'test'`,
];

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
  const isKnownBillingNormalization = /^UPDATE "billing_subscriptions"\s+SET "store"\s*=/i.test(statement)
    && /OR "last_reconciled_at" IS NULL;?$/i.test(statement);
  const isPreviewBillingEnvironmentStatement = PREVIEW_BILLING_ENVIRONMENT_STATEMENTS
    .includes(statement.replace(/;$/, ''));
  if (!isBoundedRetentionBackfill
    && !isKnownRelationOriginDefault
    && !isKnownBillingNormalization
    && !isPreviewBillingEnvironmentStatement
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
    for (const statement of PREVIEW_BILLING_ENVIRONMENT_STATEMENTS) {
      assertSafePreviewStatement(statement);
      await client.query(statement);
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
