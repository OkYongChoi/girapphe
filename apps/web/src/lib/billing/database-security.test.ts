import assert from 'node:assert/strict';
import test from 'node:test';
import db from '@/lib/db';
import {
  claimAccountBillingOperation,
  moveVerifiedRevenueCatSubscription,
  releaseAccountBillingOperation,
  requireAdFreeEntitlementStatus,
} from './database';

test('strict entitlement reads reject an unavailable billing database', async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  context.after(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  delete process.env.DATABASE_URL;

  await assert.rejects(
    requireAdFreeEntitlementStatus('user_123'),
    /Billing database is unavailable/,
  );
});

test('strict entitlement reads propagate query failures instead of returning false', async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  context.after(() => {
    db.query = originalQuery;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = 'postgresql://configured-for-test';
  db.query = (async () => {
    throw new Error('query failed');
  }) as typeof db.query;

  await assert.rejects(requireAdFreeEntitlementStatus('user_123'), /query failed/);
});

test('account billing leases are guarded, anonymized, stale-reclaimable, and owner-released', async (context) => {
  const originalAccountTransaction = db.accountTransaction;
  const originalQuery = db.query;
  const transactions: Array<{
    userId: string;
    queries: Parameters<typeof db.accountTransaction>[1];
  }> = [];
  const releases: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => {
    db.accountTransaction = originalAccountTransaction;
    db.query = originalQuery;
  });
  db.accountTransaction = (async (userId, queries) => {
    transactions.push({ userId, queries });
    return [{ rows: [{ event_id: String(queries[0]?.params?.[1]) }] }];
  }) as typeof db.accountTransaction;
  db.query = (async (text: string, params?: unknown[]) => {
    releases.push({ text, params });
    return { rows: [] };
  }) as typeof db.query;

  const userId = 'user_sensitive_billing_owner';
  const lease = await claimAccountBillingOperation(userId, 'stripe', 'checkout');
  assert.ok(lease);
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0]?.userId, userId);
  const claim = transactions[0]?.queries[0];
  assert.ok(claim);
  assert.match(claim.text, /INSERT INTO billing_webhook_events/);
  assert.match(claim.text, /created_at < NOW\(\) - INTERVAL '10 minutes'/);
  assert.match(lease.eventId, /^account-billing:[0-9a-f]{64}$/);
  assert.equal(lease.eventId.includes(userId), false);
  assert.equal(lease.eventType.includes(userId), false);
  assert.equal(claim.params?.[2], lease.eventType);

  await releaseAccountBillingOperation(lease);
  assert.equal(releases.length, 1);
  assert.match(releases[0]!.text, /event_type = \$3/);
  assert.deepEqual(releases[0]!.params, ['stripe', lease.eventId, lease.eventType]);

  db.accountTransaction = (async () => [{ rows: [] }]) as typeof db.accountTransaction;
  assert.equal(await claimAccountBillingOperation(userId, 'stripe', 'checkout'), null);
});

test('verified RevenueCat transfer uses one exact-row atomic upsert', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [] };
  }) as typeof db.query;

  await moveVerifiedRevenueCatSubscription({
    providerSubscriptionId: 'production_transaction_456',
    userId: 'user_destination',
    store: 'app_store',
    plan: 'monthly',
    status: 'active',
    entitlement: 'ad_free',
    currentPeriodStart: new Date('2030-01-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2030-02-01T00:00:00.000Z'),
    trialEnd: null,
    cancelAtPeriodEnd: false,
    providerEventAt: new Date('2030-01-01T00:00:01.000Z'),
  }, ['user_source']);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /ON CONFLICT \(provider, provider_subscription_id\) DO UPDATE SET/);
  assert.match(calls[0].text, /user_id = EXCLUDED\.user_id/);
  assert.match(calls[0].text, /billing_subscriptions\.user_id = ANY\(\$13::text\[\]\)/);
  assert.match(calls[0].text, /EXCLUDED\.provider_event_at >= billing_subscriptions\.provider_event_at/);
  assert.doesNotMatch(calls[0].text, /provider_subscription_id <>/);
  assert.doesNotMatch(calls[0].text, /SET status = 'expired'/);
  assert.equal(calls[0].params?.[2], 'production_transaction_456');
  assert.equal(calls[0].params?.[1], 'user_destination');
  assert.deepEqual(calls[0].params?.[12], ['user_source']);
});
