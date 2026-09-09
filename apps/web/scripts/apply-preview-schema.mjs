import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const PREVIEW_MIGRATIONS = [
  { url: new URL('../drizzle/migrations/0005_add_quiz_rate_limits.sql', import.meta.url) },
  {
    url: new URL('../drizzle/migrations/0008_billing_entitlements.sql', import.meta.url),
    parse: parseLegacyAdditiveMigration,
  },
  {
    url: new URL('../drizzle/migrations/0010_stripe_portal_rate_limit.sql', import.meta.url),
    parse: parseLegacyBillingUpgradeMigration,
  },
  {
    url: new URL('../drizzle/migrations/0011_toss_billing_key_intents.sql', import.meta.url),
    parse: parseLegacyBillingUpgradeMigration,
  },
  { url: new URL('../drizzle/migrations/0014_guest_knowledge_limits.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0015_typed_knowledge_bundles.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0016_conversation_knowledge_hub.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0017_supersession_replacement_tombstones.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0018_expression_history_causality.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0019_selected_export_ingestion.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0020_knowledge_intelligence_events.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0021_billing_v1_domain.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0022_recall_ping_persistence.sql', import.meta.url) },
  { url: new URL('../drizzle/migrations/0023_knowledge_ingestion_request_tombstones.sql', import.meta.url) },
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

const SAFE_LEGACY_BILLING_UPGRADE_DIGESTS = new Set([
  '8cdb4bad3f2d1ef15239a85c835dd2d73d69a2a8e5fd8b837276cc92945c9867',
  '22278ea8a554c29ad3fa0bfd9d03ad728adf2108e44205011567b29efe370ed4',
]);

const SAFE_LEGACY_BILLING_UPGRADE_STATEMENTS = new Set([
  `ALTER TABLE "billing_customers"
    ADD COLUMN IF NOT EXISTS "stripe_portal_window_started_at"
      timestamp with time zone NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS "stripe_portal_request_count"
      integer NOT NULL DEFAULT 0`,
  `DO $$
   BEGIN
     ALTER TABLE "billing_customers"
       ADD CONSTRAINT "billing_customers_stripe_portal_request_count_check"
       CHECK ("stripe_portal_request_count" >= 0);
   EXCEPTION
     WHEN duplicate_object THEN NULL;
   END $$`,
  `ALTER TABLE "toss_billing_agreements"
    ADD COLUMN IF NOT EXISTS "billing_key_intent_id" text`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'toss_billing_agreements_intent_owner_fk'
     ) THEN
       ALTER TABLE "toss_billing_agreements"
         ADD CONSTRAINT "toss_billing_agreements_intent_owner_fk"
         FOREIGN KEY ("billing_key_intent_id", "id", "user_id")
         REFERENCES "toss_billing_key_intents"("id", "agreement_id", "user_id")
         ON DELETE RESTRICT;
     END IF;
   END $$`,
  `INSERT INTO "toss_billing_key_intents" (
     "id", "agreement_id", "user_id", "customer_key", "plan",
     "billing_key_ciphertext", "status", "created_at", "updated_at"
   )
   SELECT
     'toss_legacy_' || md5(a."id" || ':' || a."billing_key_ciphertext"),
     a."id", a."user_id", c."toss_customer_key", a."plan",
     a."billing_key_ciphertext", 'live', a."created_at", now()
   FROM "toss_billing_agreements" a
   JOIN "billing_customers" c ON c."user_id" = a."user_id"
   WHERE a."billing_key_intent_id" IS NULL
     AND c."toss_customer_key" IS NOT NULL
   ON CONFLICT DO NOTHING`,
  `UPDATE "toss_billing_agreements" a
   SET "billing_key_intent_id" = i."id", "updated_at" = now()
   FROM "toss_billing_key_intents" i
   WHERE a."billing_key_intent_id" IS NULL
     AND i."id" = 'toss_legacy_' || md5(a."id" || ':' || a."billing_key_ciphertext")
     AND i."agreement_id" = a."id"
     AND i."user_id" = a."user_id"
     AND i."billing_key_ciphertext" = a."billing_key_ciphertext"
     AND i."status" = 'live'`,
].map(normalizedSql));

const SAFE_KNOWLEDGE_IMPORT_BRIDGE_STATEMENTS = new Set([
  `CREATE OR REPLACE FUNCTION public.derive_account_lifecycle_scope_key(account_user_id text)
   RETURNS text
   LANGUAGE sql
   IMMUTABLE
   STRICT
   PARALLEL SAFE
   SECURITY INVOKER
   SET search_path = pg_catalog
   AS $$
     SELECT pg_catalog.encode(
       pg_catalog.sha256(
         pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
         || pg_catalog.decode('00', 'hex')
         || pg_catalog.convert_to(account_user_id, 'UTF8')
       ),
       'hex'
     )
   $$`,
  `CREATE OR REPLACE FUNCTION public.purge_deleted_account_ingestion_tombstones()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = pg_catalog
   AS $$
   BEGIN
     PERFORM pg_catalog.pg_advisory_xact_lock(
       pg_catalog.hashtext('mcp-account-lifecycle:' || NEW.scope_key)
     );
     DELETE FROM public.knowledge_ingestion_request_tombstones AS tombstone
     WHERE public.derive_account_lifecycle_scope_key(tombstone.user_id) = NEW.scope_key;
     RETURN NEW;
   END;
   $$`,
  `CREATE OR REPLACE TRIGGER mcp_deleted_account_markers_purge_ingestion_tombstones
   BEFORE INSERT ON public.mcp_deleted_account_markers
   FOR EACH ROW
   EXECUTE FUNCTION public.purge_deleted_account_ingestion_tombstones()`,
  `DELETE FROM public.knowledge_ingestion_request_tombstones AS tombstone
   USING public.mcp_deleted_account_markers AS marker
   WHERE public.derive_account_lifecycle_scope_key(tombstone.user_id) = marker.scope_key`,
  `CREATE OR REPLACE FUNCTION public.lock_selected_export_batch_owner()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = pg_catalog
   AS $$
   DECLARE
     batch_user_id text;
   BEGIN
     IF TG_OP = 'DELETE' THEN
       IF OLD.scope <> 'selected_export' THEN
         RETURN OLD;
       END IF;
       batch_user_id := OLD.user_id;
     ELSE
       IF NEW.scope <> 'selected_export' THEN
         RETURN NEW;
       END IF;
       batch_user_id := NEW.user_id;
     END IF;

     PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
       'mcp-account-lifecycle:' || pg_catalog.encode(
         pg_catalog.sha256(
           pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
           || pg_catalog.decode('00', 'hex')
           || pg_catalog.convert_to(batch_user_id, 'UTF8')
         ),
         'hex'
       )
     ));

     IF TG_OP = 'DELETE' THEN
       RETURN OLD;
     END IF;
     RETURN NEW;
   END;
   $$`,
  `CREATE OR REPLACE TRIGGER knowledge_ingestion_batches_00_lock_selected_export_owner
   BEFORE INSERT OR DELETE ON public.knowledge_ingestion_batches
   FOR EACH ROW
   EXECUTE FUNCTION public.lock_selected_export_batch_owner()`,
  `CREATE OR REPLACE FUNCTION public.guard_deleted_selected_export_batch_insert()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = pg_catalog
   AS $$
   DECLARE
     session_tombstone_id text := NULL;
   BEGIN
     IF NEW.scope <> 'selected_export' THEN
       RETURN NEW;
     END IF;

     IF pg_catalog.lower(NEW.request_id) ~ ':session:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
       session_tombstone_id := 'selected-export-session:v1:'
         || pg_catalog.substring(
           pg_catalog.lower(NEW.request_id),
           ':session:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
         );
     ELSIF NEW.provider = 'chatgpt'
       AND pg_catalog.lower(NEW.request_id) ~ '^chatgpt-export:[0-9a-f]{48}$'
       AND pg_catalog.lower(NEW.id) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
       session_tombstone_id := 'selected-export-session:v1:' || pg_catalog.lower(NEW.id);
     END IF;

     PERFORM 1
     FROM public.mcp_deleted_account_markers AS marker
     WHERE marker.scope_key = pg_catalog.encode(
       pg_catalog.sha256(
         pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
         || pg_catalog.decode('00', 'hex')
         || pg_catalog.convert_to(NEW.user_id, 'UTF8')
       ),
       'hex'
     )
     FOR KEY SHARE;
     IF FOUND THEN
       RETURN NULL;
     END IF;

     PERFORM 1
     FROM public.knowledge_ingestion_request_tombstones AS tombstone
     WHERE tombstone.user_id = NEW.user_id
       AND tombstone.provider = NEW.provider
       AND (
         tombstone.request_id = NEW.request_id
         OR (
           session_tombstone_id IS NOT NULL
           AND tombstone.request_id = session_tombstone_id
         )
       )
     FOR KEY SHARE;
     IF FOUND THEN
       RETURN NULL;
     END IF;

     IF (
       SELECT COUNT(*)
       FROM public.knowledge_ingestion_request_tombstones AS tombstone
       WHERE tombstone.user_id = NEW.user_id
     ) + (2 * (
       SELECT COUNT(*)
       FROM public.knowledge_ingestion_batches AS batch
       WHERE batch.user_id = NEW.user_id
         AND batch.scope = 'selected_export'
     )) + 2 > 40000 THEN
       RETURN NULL;
     END IF;

     RETURN NEW;
   END;
   $$`,
  `CREATE OR REPLACE TRIGGER knowledge_ingestion_batches_guard_selected_export_insert
   BEFORE INSERT ON public.knowledge_ingestion_batches
   FOR EACH ROW
   EXECUTE FUNCTION public.guard_deleted_selected_export_batch_insert()`,
  `CREATE OR REPLACE FUNCTION public.delete_knowledge_import_batch_product_events()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = pg_catalog
   AS $$
   BEGIN
     INSERT INTO public.knowledge_ingestion_request_tombstones
       (user_id, provider, request_id)
     SELECT batch.user_id, batch.provider, candidate.request_id
     FROM deleted_knowledge_ingestion_batches AS batch
     CROSS JOIN LATERAL (
       VALUES
         (batch.request_id),
         (CASE
           WHEN pg_catalog.lower(batch.request_id) ~ ':session:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             THEN 'selected-export-session:v1:' || pg_catalog.substring(
               pg_catalog.lower(batch.request_id),
               ':session:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
             )
           WHEN batch.provider = 'chatgpt'
             AND pg_catalog.lower(batch.request_id) ~ '^chatgpt-export:[0-9a-f]{48}$'
             AND pg_catalog.lower(batch.id) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             THEN 'selected-export-session:v1:' || pg_catalog.lower(batch.id)
           ELSE NULL
         END)
     ) AS candidate(request_id)
     WHERE batch.scope = 'selected_export'
       AND candidate.request_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.mcp_deleted_account_markers AS marker
         WHERE marker.scope_key = pg_catalog.encode(
           pg_catalog.sha256(
             pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
             || pg_catalog.decode('00', 'hex')
             || pg_catalog.convert_to(batch.user_id, 'UTF8')
           ),
           'hex'
         )
       )
     ON CONFLICT (user_id, provider, request_id) DO NOTHING;

     DELETE FROM public.knowledge_product_events AS event
     USING deleted_knowledge_ingestion_batches AS batch
     WHERE event.user_id = batch.user_id
       AND event.subject_id = pg_catalog.encode(
         pg_catalog.sha256(
           pg_catalog.convert_to(batch.user_id, 'UTF8')
           || pg_catalog.decode('00', 'hex')
           || pg_catalog.convert_to(batch.id, 'UTF8')
         ),
         'hex'
       );
     RETURN NULL;
   END;
   $$`,
  `CREATE OR REPLACE TRIGGER knowledge_ingestion_batches_delete_product_events
   AFTER DELETE ON public.knowledge_ingestion_batches
   REFERENCING OLD TABLE AS deleted_knowledge_ingestion_batches
   FOR EACH STATEMENT
   EXECUTE FUNCTION public.delete_knowledge_import_batch_product_events()`,
  `CREATE OR REPLACE FUNCTION public.guard_knowledge_import_batch_event()
   RETURNS trigger
   LANGUAGE plpgsql
   SECURITY INVOKER
   SET search_path = pg_catalog
   AS $$
   DECLARE
     requires_live_batch boolean := FALSE;
     requires_selected_export_batch boolean := FALSE;
   BEGIN
     IF NEW.event_name = 'knowledge_candidate_resolved' THEN
       requires_live_batch := TRUE;
     ELSIF NEW.event_name IN (
       'conversation_import_confirmed',
       'conversation_import_candidates_ready',
       'conversation_import_first_value_viewed'
     ) OR (
       TG_OP = 'UPDATE'
       AND NEW.event_name IN ('conversation_import_started', 'conversation_import_parsed')
     ) THEN
       requires_live_batch := TRUE;
       requires_selected_export_batch := TRUE;
     END IF;

     IF NOT requires_live_batch THEN
       RETURN NEW;
     END IF;

     PERFORM 1
     FROM public.knowledge_ingestion_batches AS batch
     WHERE batch.user_id = NEW.user_id
       AND (
         NOT requires_selected_export_batch
         OR (batch.provider = 'chatgpt' AND batch.scope = 'selected_export')
       )
       AND NEW.subject_id = pg_catalog.encode(
         pg_catalog.sha256(
           pg_catalog.convert_to(batch.user_id, 'UTF8')
           || pg_catalog.decode('00', 'hex')
           || pg_catalog.convert_to(batch.id, 'UTF8')
         ),
         'hex'
       )
     FOR KEY SHARE;
     IF FOUND THEN
       RETURN NEW;
     END IF;

     IF TG_OP = 'UPDATE' THEN
       DELETE FROM public.knowledge_product_events AS event
       WHERE event.id = NEW.id;
     END IF;
     RETURN NULL;
   END;
   $$`,
  `CREATE OR REPLACE TRIGGER knowledge_product_events_guard_import_batch_insert
   BEFORE INSERT ON public.knowledge_product_events
   FOR EACH ROW
   EXECUTE FUNCTION public.guard_knowledge_import_batch_event()`,
  `CREATE OR REPLACE TRIGGER knowledge_product_events_cleanup_import_batch_update
   AFTER UPDATE OF subject_id ON public.knowledge_product_events
   FOR EACH ROW
   EXECUTE FUNCTION public.guard_knowledge_import_batch_event()`,
].map(normalizedSql));

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

export function parseLegacyAdditiveMigration(sql) {
  if (sql.includes('--> statement-breakpoint') || sql.includes('$$')) {
    throw new Error('Legacy additive preview migrations must contain only semicolon-delimited SQL');
  }
  return sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export function parseLegacyBillingUpgradeMigration(sql) {
  const digest = createHash('sha256').update(sql).digest('hex');
  if (!SAFE_LEGACY_BILLING_UPGRADE_DIGESTS.has(digest)) {
    throw new Error('Legacy billing Preview upgrades must exactly match a checked-in migration');
  }
  if (sql.includes('--> statement-breakpoint') || sql.includes('/*') || sql.includes('--')) {
    throw new Error('Legacy billing Preview upgrades must use auditable comment-free SQL');
  }

  const statements = [];
  let statementStart = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote = false;

  for (let index = 0; index < sql.length; index += 1) {
    if (inDollarQuote) {
      if (sql.startsWith('$$', index)) {
        inDollarQuote = false;
        index += 1;
      }
      continue;
    }

    const character = sql[index];
    const next = sql[index + 1];
    if (inSingleQuote) {
      if (character === "'" && next === "'") index += 1;
      else if (character === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (character === '"' && next === '"') index += 1;
      else if (character === '"') inDoubleQuote = false;
      continue;
    }
    if (sql.startsWith('$$', index)) {
      inDollarQuote = true;
      index += 1;
    } else if (character === "'") {
      inSingleQuote = true;
    } else if (character === '"') {
      inDoubleQuote = true;
    } else if (character === ';') {
      const statement = sql.slice(statementStart, index).trim();
      if (statement) statements.push(statement);
      statementStart = index + 1;
    }
  }

  if (inSingleQuote || inDoubleQuote || inDollarQuote) {
    throw new Error('Legacy billing Preview upgrade contains an unterminated quoted value');
  }
  const tail = sql.slice(statementStart).trim();
  if (tail) statements.push(tail);
  return statements;
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
  const isKnownKnowledgeImportBridgeStatement = SAFE_KNOWLEDGE_IMPORT_BRIDGE_STATEMENTS
    .has(normalizedSql(statement));
  const isKnownLegacyBillingUpgradeStatement = SAFE_LEGACY_BILLING_UPGRADE_STATEMENTS
    .has(normalizedSql(statement));
  if (!isBoundedRetentionBackfill
    && !isKnownRelationOriginDefault
    && !isKnownRecallStateStatement(statement)
    && !isKnownBillingNormalization
    && !isPreviewBillingEnvironmentStatement
    && !isKnownKnowledgeImportBridgeStatement
    && !isKnownLegacyBillingUpgradeStatement
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
    PREVIEW_MIGRATIONS.map(async ({ url, parse = parsePreviewMigration }) => ({
      name: url.pathname.split('/').at(-1),
      statements: parse(await readFile(url, 'utf8')),
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
