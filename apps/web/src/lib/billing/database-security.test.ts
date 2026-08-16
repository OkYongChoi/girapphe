import assert from 'node:assert/strict';
import test from 'node:test';
import db from '@/lib/db';
import { moveVerifiedRevenueCatSubscription } from './database';

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
