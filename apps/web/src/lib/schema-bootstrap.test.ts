import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canRunRuntimeSchemaBootstrap } from './schema-bootstrap';

test('production Workers only use checked-in migrations for schema changes', () => {
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'production', APP_ENV: 'prod' }), false);
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'production', APP_ENV: 'preview' }), false);
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'production' }), false);
});

test('local development retains schema bootstrap support', () => {
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'development' }), true);
});

test('ingestion inserts remain compatible while their uniqueness key expands', () => {
  const source = readFileSync(new URL('./knowledge-ingestion.ts', import.meta.url), 'utf8');
  const createStart = source.indexOf('export async function createKnowledgeDraftBatchForUser(');
  const createEnd = source.indexOf('export async function getKnowledgeDraftBatchesForUser(', createStart);
  assert.notEqual(createStart, -1);
  assert.notEqual(createEnd, -1);
  const createSource = source.slice(createStart, createEnd);
  assert.match(createSource, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(createSource, /ON CONFLICT \(user_id, provider, request_id\)/);
  assert.match(createSource, /b\.user_id = \$2 AND b\.provider = \$3 AND b\.scope = \$16 AND b\.request_id = \$4/);
});

test('fresh schema retains every legacy billing lifecycle table during migration', () => {
  const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
  for (const table of [
    'billing_customers',
    'toss_prepare_rate_limits',
    'toss_billing_key_intents',
    'toss_billing_agreements',
    'toss_billing_sessions',
    'toss_billing_charges',
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`));
  }
  assert.match(
    schema,
    /billing_subscriptions_provider_reference_key\s+UNIQUE\(provider, provider_subscription_id\)/,
  );
  assert.match(
    schema,
    /billing_subscriptions_provider_environment_reference_key\s+UNIQUE\(provider, environment, provider_subscription_id\)/,
  );
  const subscriptions = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS billing_subscriptions'));
  assert.match(subscriptions, /environment TEXT NOT NULL DEFAULT 'production'/);
  const webhooks = schema.slice(schema.indexOf('CREATE TABLE IF NOT EXISTS billing_webhook_events'));
  assert.match(webhooks, /PRIMARY KEY\(provider, event_id\)/);
  assert.match(
    webhooks,
    /billing_webhook_events_provider_environment_event_key\s+UNIQUE\(provider, environment, event_id\)/,
  );
  assert.match(
    schema,
    /operation IN \('checkout', 'mobile_purchase', 'prepare', 'activation', 'renewal', 'reconciliation'\)/,
  );

  const migration = readFileSync(
    new URL('../../drizzle/migrations/0021_billing_v1_domain.sql', import.meta.url),
    'utf8',
  );
  assert.match(
    migration,
    /CHECK \("operation" IN \('checkout', 'mobile_purchase', 'prepare', 'activation', 'renewal', 'reconciliation'\)\)/,
  );
});

test('fresh schema includes the content-free Recall attempt contract', () => {
  const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
  const attempts = schema.slice(
    schema.indexOf('CREATE TABLE IF NOT EXISTS recall_attempts'),
    schema.indexOf('CREATE TABLE IF NOT EXISTS mcp_access_tokens'),
  );

  assert.match(attempts, /FOREIGN KEY \(knowledge_item_id, user_id\)/);
  assert.match(attempts, /idx_recall_attempts_one_active_milestone/);
  assert.match(attempts, /retention_expires_at <= started_at \+ INTERVAL '365 days'/);
  assert.doesNotMatch(
    attempts,
    /\b(?:title|topic|question|answer|content|response_text|reconstructed_order|application_response|memory_cue|selector|source_url|source_locator|transcript)\s+(?:TEXT|JSONB)\b/i,
  );
});
