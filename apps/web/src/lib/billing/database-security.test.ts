import assert from 'node:assert/strict';
import test from 'node:test';
import db from '@/lib/db';
import {
  buildAccountDeletionFenceQueries,
  deriveAccountAdvisoryLockKey,
  deriveAccountBillingOperationScopeKey,
} from '@/lib/account-lifecycle';
import {
  claimAccountBillingOperation,
  claimAccountBillingOperationDuringAccountDeletion,
  claimWebhookEvent,
  commitDeletedAccountSuperwallSnapshot,
  commitWebhookCheckoutLink,
  commitWebhookSubscriptionSnapshot,
  createCheckoutAttempt,
  consumeBillingRequestRateLimit,
  grantFixedSubscriptionGrace,
  getProviderSubscriptionByCorrelation,
  isBillingOperationOwnerToken,
  persistMobilePurchasePendingBlock,
  providerCustomerBelongsToUser,
  reconcileAuthoritativeSubscriptions,
  recordWebhookFailure,
  releaseMobilePurchaseOperationForUser,
  resolveBillingAcquisitionBlockForOperator,
  saveCreemProviderAccountDuringAccountDeletion,
  saveProviderAccount,
  updateCheckoutAttempt,
  upsertCreemSubscriptionDuringAccountDeletion,
  upsertSubscription,
  requireAdFreeEntitlementStatus,
  requireBillingEntitlementState,
  type SubscriptionWrite,
} from './database';

const subscription: SubscriptionWrite = {
  provider: 'superwall',
  environment: 'test',
  providerCustomerId: 'alias_one',
  providerSubscriptionId: 'subscription_one',
  providerEventId: 'event_one',
  userId: 'user_owner',
  store: 'app_store',
  productId: 'plus.monthly',
  plan: 'monthly',
  status: 'active',
  entitlement: 'ad_free',
  currentPeriodStart: new Date('2030-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2030-02-01T00:00:00.000Z'),
  trialEnd: null,
  cancelAtPeriodEnd: false,
  autoRenew: true,
  providerEventAt: new Date('2030-01-01T00:00:01.000Z'),
  lastReconciledAt: new Date('2030-01-01T00:00:02.000Z'),
  graceReason: null,
  graceExpiresAt: null,
};

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

test('normal subscription writes are account-fenced and cannot transfer ownership', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;

  await upsertSubscription(subscription);

  assert.equal(captured?.[0], subscription.userId);
  const queries = captured?.[1] ?? [];
  const upsert = queries.find((query) => query.text.includes('INSERT INTO billing_subscriptions'));
  assert.ok(upsert);
  assert.match(upsert.text, /user_id = CASE/);
  assert.match(upsert.text, /billing_subscriptions\.user_id <> EXCLUDED\.user_id/);
  assert.doesNotMatch(upsert.text, /user_id = EXCLUDED\.user_id,/);
  const alias = queries.find((query) => query.text.includes('INSERT INTO billing_provider_accounts'));
  assert.ok(alias);
  assert.match(alias.text, /ON CONFLICT \(provider, environment, provider_customer_id\)/);
  assert.match(alias.text, /ELSE NULL/);
  const duplicate = queries.find((query) => query.text.includes("'duplicate_subscription'"));
  assert.ok(duplicate);
  assert.match(duplicate.text, /FROM qualifying WHERE total > 1/);
  assert.doesNotMatch(duplicate.text, /SET resolved_at = NOW\(\)/);
  assert.doesNotMatch(duplicate.text, /(?:DELETE|UPDATE)\s+(?:FROM\s+)?billing_subscriptions/);
  assert.doesNotMatch(duplicate.text, /AND provider =/);
});

test('out-of-order provider events cannot overwrite a newer subscription row', async (context) => {
  const original = db.accountTransaction;
  let upsertSql = '';
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (_userId, queries) => {
    upsertSql = queries.find((query) => query.text.includes('INSERT INTO billing_subscriptions'))?.text ?? '';
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;

  await upsertSubscription({
    ...subscription,
    providerEventId: 'stale_event',
    providerEventAt: new Date('2029-12-31T23:59:59.000Z'),
  });

  assert.match(upsertSql, /EXCLUDED\.provider_event_at > billing_subscriptions\.provider_event_at/);
  assert.match(upsertSql, /EXCLUDED\.reconciliation_generation > billing_subscriptions\.reconciliation_generation/);
  assert.match(upsertSql, /EXCLUDED\.reconciliation_generation IS NULL[\s\S]+billing_subscriptions\.reconciliation_generation IS NULL/);
  assert.match(
    upsertSql,
    /EXCLUDED\.provider_event_at = billing_subscriptions\.provider_event_at[\s\S]+EXCLUDED\.provider_event_id IS NOT DISTINCT FROM billing_subscriptions\.provider_event_id/,
  );
  assert.doesNotMatch(upsertSql, /EXCLUDED\.provider_event_at >= billing_subscriptions\.provider_event_at/);
});

test('authoritative generations resolve equal-time active and empty snapshot ordering', async (context) => {
  const original = db.accountTransaction;
  const calls: Array<Parameters<typeof db.accountTransaction>> = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    calls.push([userId, queries]);
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;

  const snapshotEventAt = new Date('2030-03-01T00:00:00.000Z');
  await reconcileAuthoritativeSubscriptions({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    subscriptions: [subscription], snapshotEventAt, reconciledAt: snapshotEventAt,
    reconciliationGeneration: '42',
  });
  await reconcileAuthoritativeSubscriptions({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    subscriptions: [], snapshotEventAt, reconciledAt: snapshotEventAt,
    reconciliationGeneration: '41',
  });

  const activeUpsert = calls[0]?.[1].find((query) => query.text.includes('INSERT INTO billing_subscriptions'));
  const staleExpiry = calls[1]?.[1].find((query) => query.text.includes("SET status = 'expired'"));
  assert.ok(activeUpsert && staleExpiry);
  assert.equal(activeUpsert.params?.[23], '42');
  assert.equal(staleExpiry.params?.[8], '41');
  assert.match(staleExpiry.text, /\$9::bigint > reconciliation_generation/);
  assert.doesNotMatch(staleExpiry.text, /\$5 >= provider_event_at\)\s*$/);
});

test('billing provider request limits are atomic, account-fenced, and return retry timing', async (context) => {
  const original = db.accountTransaction;
  const calls: Array<Parameters<typeof db.accountTransaction>> = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    calls.push([userId, queries]);
    return [{ rows: [{
      allowed: calls.length === 1,
      retry_after_seconds: calls.length === 1 ? 0 : 37,
    }] }];
  }) as typeof db.accountTransaction;

  assert.deepEqual(await consumeBillingRequestRateLimit({
    userId: 'user_owner', action: 'superwall_reconcile', limit: 3, windowSeconds: 60,
  }), { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(await consumeBillingRequestRateLimit({
    userId: 'user_owner', action: 'customer_portal', limit: 5, windowSeconds: 600,
  }), { allowed: false, retryAfterSeconds: 37 });
  assert.equal(calls.length, 2);
  for (const [userId, queries] of calls) {
    assert.equal(userId, 'user_owner');
    assert.match(queries[0]!.text, /INSERT INTO billing_request_rate_limits/);
    assert.match(queries[0]!.text, /ON CONFLICT \(user_id, action\) DO UPDATE/);
    assert.match(queries[0]!.text, /request_count < \$4/);
  }
});

test('provider account mappings allow aliases but never conflict on Clerk owner', async (context) => {
  const original = db.accountTransaction;
  const calls: Array<Parameters<typeof db.accountTransaction>> = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    calls.push([userId, queries]);
    return [{ rows: [{ provider_customer_id: queries[0]?.params?.[4] }] }];
  }) as typeof db.accountTransaction;

  await saveProviderAccount({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    providerCustomerId: 'alias_one',
  });
  await saveProviderAccount({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    providerCustomerId: 'alias_two',
  });

  assert.equal(calls.length, 2);
  for (const [userId, queries] of calls) {
    assert.equal(userId, 'user_owner');
    assert.match(queries[0]!.text, /ON CONFLICT \(provider, environment, provider_customer_id\)/);
    assert.match(queries[0]!.text, /billing_provider_accounts\.user_id = EXCLUDED\.user_id/);
    assert.doesNotMatch(queries[0]!.text, /ON CONFLICT \(user_id, provider, environment\)/);
  }
});

test('provider portal ownership checks the exact selected customer alias', async (context) => {
  const original = db.query;
  let captured: { text: string; params?: unknown[] } | undefined;
  context.after(() => { db.query = original; });
  db.query = (async (text: string, params?: unknown[]) => {
    captured = { text, params };
    return { rows: [{ owned: true }] };
  }) as typeof db.query;

  assert.equal(await providerCustomerBelongsToUser({
    userId: 'user_owner',
    provider: 'creem',
    environment: 'test',
    providerCustomerId: 'creem_selected_alias',
  }), true);
  assert.match(captured?.text ?? '', /provider_customer_id = \$4/);
  assert.deepEqual(captured?.params, [
    'user_owner', 'creem', 'test', 'creem_selected_alias',
  ]);
});

test('provider correlation can recover a root-null Superwall row by current store transaction', async (context) => {
  const original = db.query;
  context.after(() => { db.query = original; });
  db.query = (async (text: string, params?: unknown[]) => {
    assert.match(text, /\$3 = provider_root_transaction_id/);
    assert.match(text, /\$3 = provider_store_subscription_id/);
    assert.deepEqual(params, ['superwall', 'test', 'renewal_transaction_two']);
    return { rows: [{
      user_id: 'user_owner',
      provider_customer_id: 'user_owner',
      provider_subscription_id: 'superwall_subscription_one',
      provider_root_transaction_id: null,
      provider_store_subscription_id: 'renewal_transaction_two',
      provider_event_id: null,
      store: 'app_store',
      product_id: 'ios.plus.annual',
      plan: 'annual',
      status: 'active',
      entitlement: 'ad_free',
      current_period_start: new Date('2030-01-01T00:00:00.000Z'),
      current_period_end: new Date('2031-01-01T00:00:00.000Z'),
      trial_end: null,
      cancel_at_period_end: false,
      auto_renew: true,
      provider_event_at: new Date('2030-01-01T00:00:00.000Z'),
      last_reconciled_at: new Date('2030-01-01T00:00:01.000Z'),
      grace_reason: null,
      grace_expires_at: null,
    }] };
  }) as typeof db.query;

  const row = await getProviderSubscriptionByCorrelation(
    'superwall', 'test', 'renewal_transaction_two',
  );
  assert.equal(row?.providerSubscriptionId, 'superwall_subscription_one');
  assert.equal(row?.providerRootTransactionId, null);
  assert.equal(row?.providerStoreSubscriptionId, 'renewal_transaction_two');
});

test('canonical entitlement aggregates every qualifying provider row and detects duplicates', async (context) => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  context.after(() => {
    db.query = originalQuery;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });
  process.env.DATABASE_URL = 'postgresql://configured-for-test';
  const activeThrough = new Date('2099-01-01T00:00:00.000Z');
  db.query = (async (text: string) => {
    if (text.includes('FROM billing_subscriptions')) {
      return { rows: [
        {
          provider: 'creem', environment: 'test', provider_customer_id: 'creem_customer',
          provider_subscription_id: 'creem_annual', store: 'web', product_id: 'plus_annual',
          plan: 'annual', status: 'active', entitlement: 'ad_free',
          current_period_end: activeThrough, trial_end: null, cancel_at_period_end: false,
          auto_renew: true, grace_reason: null, grace_expires_at: null,
        },
        {
          provider: 'superwall', environment: 'test', provider_customer_id: 'superwall_alias',
          provider_subscription_id: 'apple_monthly', store: 'app_store', product_id: 'plus_monthly',
          plan: 'monthly', status: 'active', entitlement: 'ad_free',
          current_period_end: activeThrough, trial_end: null, cancel_at_period_end: false,
          auto_renew: true, grace_reason: null, grace_expires_at: null,
        },
      ] };
    }
    return { rows: [{ blocked: false }] };
  }) as typeof db.query;

  const state = await requireBillingEntitlementState('user_owner');

  assert.equal(state.isAdFree, true);
  assert.equal(state.duplicateDetected, true);
  assert.equal(state.acquisitionBlocked, true);
  assert.deepEqual(state.subscriptions.map(({ provider }) => provider), ['creem', 'superwall']);
});

test('authoritative empty snapshot expires only older rows in its exact fenced scope', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;
  const snapshotEventAt = new Date('2030-03-01T00:00:00.000Z');
  const reconciledAt = new Date('2030-03-01T00:00:01.000Z');

  await reconcileAuthoritativeSubscriptions({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    subscriptions: [], snapshotEventAt, reconciledAt,
  });

  assert.equal(captured?.[0], 'user_owner');
  const expiry = captured?.[1].find((query) => query.text.includes("SET status = 'expired'"));
  assert.ok(expiry);
  assert.match(expiry.text, /WHERE user_id = \$1[\s\S]+provider = \$2[\s\S]+environment = \$3/);
  assert.match(expiry.text, /NOT \(provider_subscription_id = ANY\(\$4::text\[\]\)\)/);
  assert.match(expiry.text, /provider_event_at IS NULL OR \$5 >= provider_event_at/);
  assert.deepEqual(expiry.params!.slice(0, 6), [
    'user_owner', 'superwall', 'test', [], snapshotEventAt, reconciledAt,
  ]);
  assert.equal(captured?.[1].some((query) => (
    query.text.includes("reason = 'mobile_purchase_pending'")
  )), false, 'an empty provider snapshot cannot release an in-flight mobile purchase');
});

test('historical Superwall rows cannot release a newer in-flight mobile purchase', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;
  const observedAt = new Date('2030-03-01T00:00:00.000Z');
  await reconcileAuthoritativeSubscriptions({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    subscriptions: [{
      ...subscription,
      status: 'expired',
      currentPeriodEnd: new Date('2030-01-01T00:00:00.000Z'),
      autoRenew: false,
    }],
    snapshotEventAt: observedAt,
    reconciledAt: observedAt,
    reconciliationGeneration: '88',
  });
  assert.equal(captured?.[1].some((query) => (
    query.text.includes("reason = 'mobile_purchase_pending'")
  )), false);
});

test('authoritative snapshot rejects cross-owner rows and duplicate ids', async () => {
  const base = {
    userId: 'user_owner' as const,
    provider: 'superwall' as const,
    environment: 'test' as const,
    snapshotEventAt: new Date('2030-03-01T00:00:00.000Z'),
    reconciledAt: new Date('2030-03-01T00:00:01.000Z'),
  };
  await assert.rejects(reconcileAuthoritativeSubscriptions({
    ...base,
    subscriptions: [{ ...subscription, userId: 'user_other' }],
  }), /scope does not match/);
  await assert.rejects(reconcileAuthoritativeSubscriptions({
    ...base,
    subscriptions: [subscription, { ...subscription }],
  }), /duplicate subscription id/);
});

test('webhook snapshot commits state and lease in one account-fenced transaction', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;

  await commitWebhookSubscriptionSnapshot({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    subscriptions: [subscription],
    snapshotEventAt: subscription.providerEventAt,
    reconciledAt: subscription.lastReconciledAt,
    lease: {
      provider: 'superwall', environment: 'test', eventId: 'webhook_one',
      eventType: 'renewal', ownerToken: 'lease_one',
    },
  });

  assert.equal(captured?.[0], 'user_owner');
  const completion = captured?.[1].at(-1);
  assert.ok(completion);
  assert.match(completion.text, /WITH completed AS/);
  assert.match(completion.text, /1 \/ COUNT\(\*\)::integer AS lease_assertion/);
  assert.deepEqual(completion.params, ['superwall', 'test', 'webhook_one', 'lease_one']);
  assert.ok(captured?.[1].some((query) => (
    query.text.includes("reason = 'mobile_purchase_pending'")
  )), 'a signed event with current provider access resolves durable purchase uncertainty');
});

test('fixed subscription grace is anchored once, can upgrade verification to billing, and cannot slide', async (context) => {
  const originalQuery = db.query;
  const originalAccountTransaction = db.accountTransaction;
  const updates: Parameters<typeof db.accountTransaction>[1] = [];
  let attempt = 0;
  context.after(() => {
    db.query = originalQuery;
    db.accountTransaction = originalAccountTransaction;
  });
  db.query = (async () => ({ rows: [{
    user_id: 'user_owner',
    provider_customer_id: 'creem_customer',
    provider_event_id: 'payment_failed',
    store: 'web',
    product_id: 'plus_annual',
    plan: 'annual',
    status: 'past_due',
    entitlement: 'ad_free',
    current_period_start: new Date('2030-01-01T00:00:00.000Z'),
    current_period_end: new Date('2031-01-01T00:00:00.000Z'),
    trial_end: null,
    cancel_at_period_end: false,
    auto_renew: true,
    provider_event_at: new Date('2031-01-01T00:00:01.000Z'),
    last_reconciled_at: new Date('2031-01-01T00:00:02.000Z'),
    grace_reason: null,
    grace_expires_at: null,
  }] })) as typeof db.query;
  db.accountTransaction = (async (_userId, queries) => {
    updates.push(...queries);
    attempt += 1;
    return [{ rows: attempt === 1 ? [{ provider_subscription_id: 'creem_annual' }] : [] }];
  }) as typeof db.accountTransaction;

  const input = {
    provider: 'creem' as const,
    environment: 'test' as const,
    providerSubscriptionId: 'creem_annual',
    reason: 'billing' as const,
    hours: 72 as const,
  };
  assert.equal(await grantFixedSubscriptionGrace(input), true);
  assert.equal(await grantFixedSubscriptionGrace(input), false);

  assert.equal(updates.length, 2);
  for (const update of updates) {
    assert.match(update.text, /grace_expires_at = current_period_end \+ \(\$5::text \|\| ' hours'\)::interval/);
    assert.match(update.text, /grace_expires_at IS NULL/);
    assert.match(update.text, /\$4 = 'billing' AND grace_reason = 'verification'/);
    assert.match(update.text, /status IN \('active', 'past_due'\)/);
    assert.doesNotMatch(update.text, /grace_expires_at\s*=\s*NOW\(\)/);
    assert.equal(update.params?.[4], 72);
  }
});

test('webhook duplicates are harmless and partial failures remain retryable', async (context) => {
  const original = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  let phase: 'processed' | 'busy' | 'failed' | 'retry' = 'processed';
  context.after(() => { db.query = original; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    if (text.includes('INSERT INTO billing_webhook_events')) {
      return phase === 'retry' ? { rows: [{ event_id: 'event_duplicate' }] } : { rows: [] };
    }
    if (text.includes('SELECT processed_at FROM billing_webhook_events')) {
      return {
        rows: [{ processed_at: phase === 'processed'
          ? new Date('2030-01-01T00:00:00.000Z')
          : null }],
      };
    }
    return { rows: [] };
  }) as typeof db.query;

  const event = {
    provider: 'superwall' as const,
    environment: 'test' as const,
    eventId: 'event_duplicate',
    eventType: 'renewal',
    providerEventAt: new Date('2030-01-01T00:00:00.000Z'),
  };
  assert.equal(await claimWebhookEvent(event), 'processed');
  phase = 'busy';
  assert.equal(await claimWebhookEvent(event), 'busy');

  phase = 'failed';
  await recordWebhookFailure({ ...event, ownerToken: 'failed_owner' }, 'provider_timeout');
  const failure = calls.at(-1);
  assert.ok(failure);
  const failureSet = failure.text.slice(failure.text.indexOf('SET'), failure.text.indexOf('WHERE'));
  assert.match(failureSet, /processing_owner_token = NULL/);
  assert.match(failureSet, /last_error_code = \$5/);
  assert.doesNotMatch(failureSet, /processed_at/);
  assert.match(failure.text, /processed_at IS NULL/);
  assert.deepEqual(failure.params, [
    'superwall', 'test', 'event_duplicate', 'failed_owner', 'provider_timeout',
  ]);

  phase = 'retry';
  const retry = await claimWebhookEvent(event);
  assert.notEqual(retry, 'processed');
  assert.notEqual(retry, 'busy');
  if (retry === 'processed' || retry === 'busy') assert.fail('retry must acquire a new lease');
  assert.match(retry.ownerToken, /^[0-9a-f-]{36}$/);
  const claim = calls.filter(({ text }) => text.includes('INSERT INTO billing_webhook_events')).at(-1);
  assert.ok(claim);
  assert.match(claim.text, /attempt_count = billing_webhook_events\.attempt_count \+ 1/);
  assert.match(claim.text, /billing_webhook_events\.processed_at IS NULL/);
  assert.match(claim.text, /processing_started_at IS NULL[\s\S]+processing_started_at < NOW\(\) - INTERVAL '10 minutes'/);
});

test('duplicate acquisition blocks can only be cleared through explicit operator API', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return [{ rows: [{ user_id: userId }] }];
  }) as typeof db.accountTransaction;

  assert.equal(await resolveBillingAcquisitionBlockForOperator(
    'user_owner', 'duplicate_subscription',
  ), true);
  assert.equal(captured?.[0], 'user_owner');
  assert.match(captured?.[1][0]?.text ?? '', /SET resolved_at = NOW\(\)/);
});

test('deletion reconciliation requires stopped Creem renewal and a deletion marker assertion', async (context) => {
  const original = db.transaction;
  let queries: Parameters<typeof db.transaction>[0] = [];
  context.after(() => { db.transaction = original; });
  db.transaction = (async (input) => {
    queries = input;
    return input.map(() => ({ rows: [] }));
  }) as typeof db.transaction;
  const deletionSubscription: SubscriptionWrite = {
    ...subscription,
    provider: 'creem', store: 'web', plan: 'annual', status: 'canceled',
    providerCustomerId: 'creem_customer', providerSubscriptionId: 'creem_subscription',
    productId: 'creem_plus_annual', cancelAtPeriodEnd: true, autoRenew: false,
  };

  await upsertCreemSubscriptionDuringAccountDeletion(deletionSubscription);
  assert.match(queries[0]?.text ?? '', /1 \/ COUNT\(\*\)::integer AS deletion_marker_assertion/);
  assert.match(queries[1]?.text ?? '', /INSERT INTO billing_subscriptions/);
  await assert.rejects(upsertCreemSubscriptionDuringAccountDeletion({
    ...deletionSubscription, status: 'active', cancelAtPeriodEnd: false, autoRenew: true,
  }), /non-renewing or terminal Creem state/);
});

test('deleted-account Creem lifecycle claims and aliases stay behind the permanent deletion fence', async (context) => {
  const originalTransaction = db.transaction;
  const originalAccountTransaction = db.accountTransaction;
  const calls: Array<Parameters<typeof db.transaction>[0]> = [];
  let activeAccountWrites = 0;
  context.after(() => {
    db.transaction = originalTransaction;
    db.accountTransaction = originalAccountTransaction;
  });
  db.accountTransaction = (async () => {
    activeAccountWrites += 1;
    throw new Error('active account fence must not be used after deletion');
  }) as typeof db.accountTransaction;
  db.transaction = (async (queries) => {
    calls.push(queries);
    if (queries.length === 3) {
      return queries.map((_query, index) => ({
        rows: index === 2 ? [{ scope_key: queries[2]?.params?.[0] }] : [],
      }));
    }
    return queries.map((_query, index) => ({
      rows: index === 1 ? [{ provider_customer_id: 'creem_customer' }] : [],
    }));
  }) as typeof db.transaction;

  const lease = await claimAccountBillingOperationDuringAccountDeletion(
    'user_deleted',
    'creem',
    'reconciliation',
  );
  assert.ok(lease);
  assert.equal(lease.provider, 'creem');
  assert.equal(lease.operation, 'reconciliation');
  assert.equal(lease.scopeKey, deriveAccountBillingOperationScopeKey('user_deleted'));

  const claim = calls[0] ?? [];
  assert.equal(claim.length, 3);
  assert.match(claim[0]?.text ?? '', /pg_advisory_xact_lock/);
  assert.deepEqual(claim[0]?.params, [deriveAccountAdvisoryLockKey('user_deleted')]);
  assert.match(claim[1]?.text ?? '', /deletion_marker_assertion/);
  assert.match(claim[2]?.text ?? '', /INSERT INTO billing_account_operations/);
  assert.match(claim[2]?.text ?? '', /WHERE billing_account_operations\.expires_at <= NOW\(\)/);
  assert.deepEqual(claim[2]?.params?.slice(0, 3), [
    deriveAccountBillingOperationScopeKey('user_deleted'),
    'creem',
    'reconciliation',
  ]);

  assert.equal(await saveCreemProviderAccountDuringAccountDeletion({
    userId: 'user_deleted',
    environment: 'test',
    providerCustomerId: 'creem_customer',
  }), 'creem_customer');
  const alias = calls[1] ?? [];
  assert.equal(alias.length, 2);
  assert.match(alias[0]?.text ?? '', /deletion_marker_assertion/);
  assert.match(alias[1]?.text ?? '', /INSERT INTO billing_provider_accounts/);
  assert.match(alias[1]?.text ?? '', /ON CONFLICT \(provider, environment, provider_customer_id\)/);
  assert.match(alias[1]?.text ?? '', /billing_provider_accounts\.user_id = EXCLUDED\.user_id/);
  assert.equal(alias[1]?.params?.[2], 'creem');
  assert.equal(alias[1]?.params?.[3], 'test');
  assert.equal(alias[1]?.params?.[4], 'creem_customer');
  assert.equal(activeAccountWrites, 0);
});

test('checkout writes and webhook checkout links use the account fence', async (context) => {
  const original = db.accountTransaction;
  const calls: Array<Parameters<typeof db.accountTransaction>> = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    calls.push([userId, queries]);
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.accountTransaction;

  await updateCheckoutAttempt({ id: 'attempt_one', userId: 'user_owner', status: 'failed' });
  await commitWebhookCheckoutLink({
    userId: 'user_owner', checkoutAttemptId: 'attempt_one',
    providerCheckoutId: 'checkout_one', providerCustomerId: 'customer_one',
    providerEventAt: new Date('2030-01-01T00:00:00.000Z'),
    lease: {
      provider: 'creem', environment: 'test', eventId: 'event_one',
      eventType: 'checkout.completed', ownerToken: 'lease_one',
    },
  });

  assert.equal(calls.length, 2);
  assert.ok(calls.every(([userId]) => userId === 'user_owner'));
  assert.match(calls[0]![1][0]!.text, /status IN \('creating', 'open', 'indeterminate'\)/);
  assert.match(calls[1]![1][0]!.text, /ON CONFLICT \(provider, environment, provider_customer_id\)/);
});

test('checkout creation never expires or replaces an uncertain attempt by local clock', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return [{ rows: [{
      id: String(queries[0]?.params?.[0]),
      user_id: userId,
      provider: 'creem',
      environment: 'test',
      plan: 'annual',
      product_id: 'plus_annual',
      status: 'creating',
      provider_customer_id: null,
      provider_checkout_id: null,
      checkout_url: null,
      expires_at: new Date('2030-01-01T00:30:00.000Z'),
      provider_event_at: null,
      last_error_code: null,
    }] }];
  }) as typeof db.accountTransaction;

  const attempt = await createCheckoutAttempt({
    userId: 'user_owner', provider: 'creem', environment: 'test',
    plan: 'annual', productId: 'plus_annual', lifetimeMinutes: 30,
  });

  assert.equal(attempt.status, 'creating');
  assert.equal(captured?.[0], 'user_owner');
  assert.equal(captured?.[1].length, 1);
  const creation = captured?.[1][0]?.text ?? '';
  assert.match(creation, /^INSERT INTO billing_checkout_attempts/);
  assert.doesNotMatch(creation, /UPDATE billing_checkout_attempts/);
  assert.doesNotMatch(creation, /expires_at\s*<=\s*NOW\(\)/);
  assert.doesNotMatch(creation, /status\s*=\s*'expired'/);
  assert.match(creation, /RETURNING id, user_id, provider/);
});

test('Creem and mobile leases share the account-deletion mutual-exclusion scope', async (context) => {
  const originalAccountTransaction = db.accountTransaction;
  context.after(() => { db.accountTransaction = originalAccountTransaction; });
  const calls: Array<Parameters<typeof db.accountTransaction>> = [];
  db.accountTransaction = (async (userId, queries) => {
    calls.push([userId, queries]);
    return queries.map((_query, index) => ({
      rows: calls.length === 1 && index === 0
        ? [{ scope_key: queries[0]?.params?.[0] }]
        : [],
    }));
  }) as typeof db.accountTransaction;

  const userId = 'user_sensitive';
  const creemLease = await claimAccountBillingOperation(userId, 'creem', 'checkout');
  const blockedMobileLease = await claimAccountBillingOperation(
    userId, 'superwall', 'mobile_purchase',
  );
  assert.ok(creemLease);
  assert.equal(blockedMobileLease, null);
  assert.equal(calls[0]?.[0], userId);
  assert.equal(calls[1]?.[0], userId);
  const creemClaim = calls[0]?.[1][0];
  const mobileClaim = calls[1]?.[1][0];
  assert.ok(creemClaim && mobileClaim);
  assert.match(creemClaim.text, /billing_account_operations/);
  assert.match(creemClaim.text, /ON CONFLICT \(scope_key\)/);
  assert.match(creemClaim.text, /WHERE billing_account_operations\.expires_at <= NOW\(\)/);
  assert.match(creemClaim.text, /NOT EXISTS \([\s\S]*billing_acquisition_blocks[\s\S]*resolved_at IS NULL/);
  assert.equal(creemClaim.params?.[1], 'creem');
  assert.equal(creemClaim.params?.[2], 'checkout');
  assert.equal(creemClaim.params?.[4], userId);
  assert.equal(mobileClaim.params?.[1], 'superwall');
  assert.equal(mobileClaim.params?.[2], 'mobile_purchase');
  assert.equal(creemClaim.params?.[0], mobileClaim.params?.[0]);
  assert.equal(creemClaim.params?.[0], deriveAccountBillingOperationScopeKey(userId));
  const deletion = buildAccountDeletionFenceQueries(userId)[1];
  assert.equal(deletion?.params[1], creemClaim.params?.[0]);
  assert.match(creemLease.scopeKey, /^[0-9a-f]{64}$/);
  assert.equal(creemLease.scopeKey.includes(userId), false);
});

test('authenticated mobile lease release is user-, provider-, operation-, and token-bound', async (context) => {
  const original = db.accountTransaction;
  const calls: Array<Parameters<typeof db.accountTransaction>> = [];
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    calls.push([userId, queries]);
    return [{ rows: calls.length === 1 ? [{ scope_key: queries[0]?.params?.[0] }] : [] }];
  }) as typeof db.accountTransaction;
  const ownerToken = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(isBillingOperationOwnerToken(ownerToken), true);
  assert.equal(isBillingOperationOwnerToken('not-a-token'), false);

  assert.equal(await releaseMobilePurchaseOperationForUser('user_owner', 'not-a-token'), false);
  assert.equal(calls.length, 0);
  assert.equal(await releaseMobilePurchaseOperationForUser('user_owner', ownerToken), true);
  assert.equal(await releaseMobilePurchaseOperationForUser(
    'user_owner', '123e4567-e89b-42d3-a456-426614174001',
  ), false);

  assert.equal(calls.length, 2);
  for (const [userId, queries] of calls) {
    assert.equal(userId, 'user_owner');
    const release = queries[0];
    assert.ok(release);
    assert.match(release.text, /DELETE FROM billing_account_operations/);
    assert.match(release.text, /scope_key = \$1/);
    assert.match(release.text, /provider = 'superwall'/);
    assert.match(release.text, /operation = 'mobile_purchase'/);
    assert.match(release.text, /owner_token = \$2/);
    assert.equal(release.params?.[0], deriveAccountBillingOperationScopeKey('user_owner'));
    const durableBlock = queries[1];
    assert.ok(durableBlock);
    assert.match(durableBlock.text, /UPDATE billing_acquisition_blocks/);
    assert.match(durableBlock.text, /reason = 'mobile_purchase_pending'/);
    assert.match(durableBlock.text, /operation_owner_token = \$2/);
  }
  assert.equal(calls[0]?.[1][0]?.params?.[1], ownerToken);
});

test('mobile purchase uncertainty survives lease expiry until exact or provider resolution', async (context) => {
  const original = db.accountTransaction;
  let captured: Parameters<typeof db.accountTransaction> | undefined;
  context.after(() => { db.accountTransaction = original; });
  db.accountTransaction = (async (userId, queries) => {
    captured = [userId, queries];
    return [{ rows: [{ user_id: userId }] }];
  }) as typeof db.accountTransaction;
  const lease = {
    scopeKey: deriveAccountBillingOperationScopeKey('user_owner'),
    provider: 'superwall' as const,
    operation: 'mobile_purchase' as const,
    ownerToken: '123e4567-e89b-42d3-a456-426614174000',
  };

  assert.equal(await persistMobilePurchasePendingBlock('user_owner', lease), true);
  const query = captured?.[1][0];
  assert.ok(query);
  assert.match(query.text, /INSERT INTO billing_acquisition_blocks/);
  assert.match(query.text, /'mobile_purchase_pending'/);
  assert.match(query.text, /FROM billing_account_operations/);
  assert.match(query.text, /owner_token = \$2/);
  assert.match(query.text, /resolved_at = NULL/);
  assert.deepEqual(query.params, ['user_owner', lease.ownerToken, lease.scopeKey]);
});

test('deleted-account Superwall webhook retains lifecycle state behind the permanent marker', async (context) => {
  const original = db.transaction;
  let captured: Parameters<typeof db.transaction> | undefined;
  context.after(() => { db.transaction = original; });
  db.transaction = (async (queries, options) => {
    captured = [queries, options];
    return queries.map(() => ({ rows: [] }));
  }) as typeof db.transaction;

  await commitDeletedAccountSuperwallSnapshot({
    userId: 'user_owner', provider: 'superwall', environment: 'test',
    subscriptions: [subscription],
    snapshotEventAt: subscription.providerEventAt,
    reconciledAt: subscription.lastReconciledAt,
    reconciliationGeneration: '77',
    lease: {
      provider: 'superwall', environment: 'test', eventId: 'deleted_event',
      eventType: 'expiration', ownerToken: 'lease_deleted',
    },
  });
  assert.match(captured?.[0][0]?.text ?? '', /deletion_marker_assertion/);
  assert.ok(captured?.[0].some((query) => query.text.includes('INSERT INTO billing_subscriptions')));
  assert.ok(captured?.[0].some((query) => query.text.includes('lease_assertion')));
});
