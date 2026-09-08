import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SuperwallProviderRequestError,
  correlateSuperwallEventSnapshot,
  isSuperwallEventInScope,
  normalizeSuperwallSnapshotItem,
  parseSuperwallAliases,
  parseSuperwallEvent,
  parseSuperwallSubscriptionPage,
  readSuperwallResponse,
  superwallEventCorrelationIdentifiers,
} from './superwall';

const ORIGINAL_ENV = { ...process.env };

test.before(() => {
  Object.assign(process.env, {
    APP_ENV: 'test',
    SUPERWALL_ENVIRONMENT: 'test',
    SUPERWALL_ORGANIZATION_API_KEY: 'org_test',
    SUPERWALL_WEBHOOK_SECRET: 'whsec_test',
    SUPERWALL_PROJECT_ID: '101',
    SUPERWALL_IOS_APPLICATION_ID: '201',
    SUPERWALL_ANDROID_APPLICATION_ID: '202',
    SUPERWALL_IOS_BUNDLE_ID: 'com.girapphe.ios',
    SUPERWALL_ANDROID_PACKAGE_ID: 'com.girapphe.android',
    SUPERWALL_IOS_MONTHLY_PRODUCT_ID: 'ios.plus.monthly',
    SUPERWALL_IOS_ANNUAL_PRODUCT_ID: 'ios.plus.annual',
    SUPERWALL_ANDROID_MONTHLY_PRODUCT_ID: 'android.plus.monthly',
    SUPERWALL_ANDROID_ANNUAL_PRODUCT_ID: 'android.plus.annual',
  });
});

test.after(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

function eventPayload(overrides: Record<string, unknown> = {}) {
  return {
    object: 'event',
    type: 'renewal',
    projectId: 101,
    applicationId: 201,
    timestamp: Date.parse('2030-01-02T00:00:00.000Z'),
    data: {
      id: 'event_one',
      name: 'renewal',
      price: 9.99,
      transactionId: 'transaction_one',
      originalTransactionId: 'root_subscription_one',
      originalAppUserId: 'user_owner',
      store: 'APP_STORE',
      environment: 'SANDBOX',
      productId: 'ios.plus.annual',
      newProductId: null,
      bundleId: 'com.girapphe.ios',
      ts: Date.parse('2030-01-01T00:00:00.000Z'),
      ...overrides,
    },
  };
}

function subscriptionItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'superwall_subscription_one',
    object: 'subscription',
    customer_id: 'user_owner',
    original_customer_id: 'user_owner',
    product_id: 'ios.plus.monthly',
    starts_at: Date.parse('2030-01-01T00:00:00.000Z'),
    current_period_starts_at: Date.parse('2030-01-01T00:00:00.000Z'),
    current_period_ends_at: Date.parse('2030-02-01T00:00:00.000Z'),
    ends_at: null,
    gives_access: true,
    pending_payment: false,
    auto_renewal_status: 'will_renew',
    status: 'active',
    total_revenue_in_usd: null,
    presented_offering_id: null,
    entitlements: {
      object: 'list',
      url: '/revenuecat/projects/101/customers/user_owner/active_entitlements',
      next_page: null,
      items: [{
        object: 'entitlement',
        project_id: '101',
        id: 'entitlement_ad_free',
        lookup_key: 'ad_free',
        display_name: 'Girapphe Plus',
        created_at: Date.parse('2029-01-01T00:00:00.000Z'),
      }],
    },
    environment: 'sandbox',
    store: 'app_store',
    store_subscription_identifier: 'root_subscription_one',
    ownership: 'purchased',
    pending_changes: null,
    country: null,
    management_url: 'https://apps.apple.com/account/subscriptions',
    ...overrides,
  };
}

test('parses and scopes exact Superwall project, app, store, environment and product events', () => {
  const event = parseSuperwallEvent(eventPayload());
  assert.ok(event);
  assert.equal(event.providerRootTransactionId, 'root_subscription_one');
  assert.equal(isSuperwallEventInScope(event), true);
  const wrongBundle = parseSuperwallEvent(eventPayload({ bundleId: 'com.attacker.app' }));
  assert.ok(wrongBundle);
  assert.equal(isSuperwallEventInScope(wrongBundle), false);
  assert.equal(parseSuperwallEvent(eventPayload({ store: 'STRIPE' })), null);
  assert.equal(parseSuperwallEvent({ ...eventPayload(), type: 'refund' }), null);
});

test('webhook identity recovery tries stable root and current renewal transaction aliases', () => {
  const event = parseSuperwallEvent(eventPayload({ transactionId: 'renewal_transaction_two' }));
  assert.ok(event);
  assert.deepEqual(superwallEventCorrelationIdentifiers(event), [
    'root_subscription_one',
    'renewal_transaction_two',
  ]);
});

test('normalizes localized mobile product state into provider-neutral monthly and annual rows', () => {
  const monthly = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem(),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  });
  assert.ok(monthly);
  assert.equal(monthly.plan, 'monthly');
  assert.equal(monthly.store, 'app_store');
  assert.equal(monthly.status, 'active');
  assert.equal(monthly.providerSubscriptionId, 'superwall_subscription_one');
  assert.equal(monthly.providerRootTransactionId, null);
  assert.equal(monthly.providerStoreSubscriptionId, 'root_subscription_one');

  const annual = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ product_id: 'ios.plus.annual' }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  });
  assert.equal(annual?.plan, 'annual');
});

test('preserves scheduled cancellation, and removes access on expiration or revocation state', () => {
  const canceled = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ auto_renewal_status: 'will_not_renew' }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  });
  assert.equal(canceled?.status, 'canceled');
  assert.equal(canceled?.cancelAtPeriodEnd, true);
  assert.equal(canceled?.autoRenew, false);

  const expired = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({
      gives_access: false,
      status: 'expired',
      auto_renewal_status: 'will_not_renew',
      starts_at: Date.parse('2029-11-01T00:00:00.000Z'),
      current_period_starts_at: Date.parse('2029-11-01T00:00:00.000Z'),
      current_period_ends_at: Date.parse('2029-12-01T00:00:00.000Z'),
    }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  });
  assert.equal(expired?.status, 'expired');
});

test('normalizes provider-verified mobile billing grace without inventing an unlimited period', () => {
  const reconciledAt = new Date('2030-01-02T00:00:00.000Z');
  const grace = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({
      status: 'in_grace_period',
      gives_access: true,
      starts_at: Date.parse('2029-12-01T00:00:00.000Z'),
      current_period_starts_at: Date.parse('2029-12-01T00:00:00.000Z'),
      current_period_ends_at: Date.parse('2030-01-01T00:00:00.000Z'),
    }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt,
  });
  assert.ok(grace);
  assert.equal(grace.status, 'past_due');
  assert.equal(grace.graceReason, 'billing');
  assert.equal(
    grace.graceExpiresAt?.toISOString(),
    new Date(reconciledAt.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
  );
  assert.equal(grace.currentPeriodEnd?.toISOString(), '2030-01-01T00:00:00.000Z');
});

test('a partial-refund event cannot override an authoritative active snapshot', () => {
  const partialRefund = parseSuperwallEvent(eventPayload({ price: -1 }));
  const active = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem(),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
    providerEventId: partialRefund?.id,
  });
  assert.ok(partialRefund);
  assert.equal(active?.status, 'active');
  assert.equal(active?.graceReason, null);
});

test('partial refunds retain current provider access while missing entitlement fails closed', () => {
  const stillActive = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ gives_access: true }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
    providerEventId: 'negative_price_event',
  });
  assert.equal(stillActive?.status, 'active');

  const missingEntitlement = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({
      entitlements: {
        object: 'list',
        url: '/revenuecat/projects/101/customers/user_owner/active_entitlements',
        next_page: null,
        items: [],
      },
    }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  });
  assert.equal(missingEntitlement?.status, 'incomplete');
});

test('keeps the stable provider resource id when a renewal rotates the store identifier', () => {
  const first = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ store_subscription_identifier: 'transaction_one' }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  });
  const renewal = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({
      store_subscription_identifier: 'transaction_two',
      current_period_ends_at: Date.parse('2030-03-01T00:00:00.000Z'),
    }),
    snapshotEventAt: new Date('2030-02-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-02-02T00:00:00.000Z'),
  });
  assert.equal(first?.providerSubscriptionId, 'superwall_subscription_one');
  assert.equal(renewal?.providerSubscriptionId, 'superwall_subscription_one');
  assert.equal(first?.providerStoreSubscriptionId, 'transaction_one');
  assert.equal(renewal?.providerStoreSubscriptionId, 'transaction_two');

  const event = parseSuperwallEvent(eventPayload({
    transactionId: 'transaction_two',
    productId: 'ios.plus.monthly',
  }));
  assert.ok(event && renewal);
  const correlated = correlateSuperwallEventSnapshot({
    subscriptions: [renewal],
    event,
    store: 'app_store',
  });
  assert.equal(correlated.providerSubscriptionId, 'superwall_subscription_one');
  assert.equal(correlated.providerRootTransactionId, 'root_subscription_one');
  assert.equal(correlated.providerStoreSubscriptionId, 'transaction_two');
});

test('never binds an old event root by product and store cardinality alone', () => {
  const newer = normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({
      id: 'newer_subscription',
      store_subscription_identifier: 'newer_transaction',
      current_period_ends_at: Date.parse('2030-03-01T00:00:00.000Z'),
    }),
    snapshotEventAt: new Date('2030-02-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-02-02T00:00:00.000Z'),
  });
  const delayedOldEvent = parseSuperwallEvent(eventPayload({
    originalTransactionId: 'old_root',
    transactionId: 'old_transaction',
    productId: 'ios.plus.monthly',
  }));
  assert.ok(newer && delayedOldEvent);
  assert.throws(() => correlateSuperwallEventSnapshot({
    subscriptions: [newer],
    event: delayedOldEvent,
    store: 'app_store',
    existingProviderSubscriptionId: 'old_subscription',
  }), /could not be correlated/);
  assert.equal(newer.providerRootTransactionId, null);
});

test('accepts only the exact non-retryable resource-missing 404 as an empty snapshot', async () => {
  const missing = new Response(JSON.stringify({
    _tag: '@superwall/api-schema/v2/errors/RcResourceMissing',
    message: 'Customer was not found.',
  }), { status: 404, headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await readSuperwallResponse(missing, { notFoundAsEmpty: true }), {
    object: 'list',
    url: '/resource-missing',
    items: [],
    next_page: null,
  });

  for (const payload of [
    { message: 'not found' },
    { _tag: '@superwall/api-schema/v2/errors/RcResourceMissing', message: 'Missing', retryable: true },
  ]) {
    await assert.rejects(
      readSuperwallResponse(new Response(JSON.stringify(payload), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }), { notFoundAsEmpty: true }),
      SuperwallProviderRequestError,
    );
  }
});

test('rejects malformed subscription pages instead of converting them into revocations', () => {
  assert.deepEqual(parseSuperwallSubscriptionPage({
    object: 'list', url: '/subscriptions', items: [], next_page: null,
  }), {
    items: [],
    nextPage: null,
  });
  for (const payload of [
    { object: 'list', url: '/subscriptions', items: [subscriptionItem(), 'bad'], next_page: null },
    { url: '/subscriptions', items: [], next_page: null },
    { object: 'list', url: '/subscriptions', items: [] },
    { object: 'list', url: '/subscriptions', items: [], next_page: 42 },
    { object: 'list', url: '/subscriptions', items: [], next_page: 'https://attacker.example/next' },
  ]) {
    assert.throws(() => parseSuperwallSubscriptionPage(payload), SuperwallProviderRequestError);
  }

  assert.throws(
    () => parseSuperwallSubscriptionPage({
      object: 'list',
      url: '/revenuecat/projects/101/customers/user_other/subscriptions',
      items: [],
      next_page: null,
    }, new URL(
      'https://api.superwall.com/revenuecat/projects/101/customers/user_owner/subscriptions?limit=100',
    )),
    /does not match the requested customer/,
  );

  const expected = new URL(
    'https://api.superwall.com/revenuecat/projects/101/customers/user_owner/subscriptions?limit=100',
  );
  for (const nextPage of [
    'https://api.superwall.com/revenuecat/projects/101/customers/user_other/subscriptions?limit=100&starting_after=cursor',
    'https://api.superwall.com/revenuecat/projects/101/customers/user_owner/active_entitlements?limit=100&starting_after=cursor',
    'https://api.superwall.com/revenuecat/projects/101/customers/user_owner/subscriptions?limit=100&ending_before=cursor',
    'https://api.superwall.com/revenuecat/projects/101/customers/user_owner/subscriptions?limit=50&starting_after=cursor',
  ]) {
    assert.throws(
      () => parseSuperwallSubscriptionPage({
        object: 'list',
        url: expected.pathname,
        items: [],
        next_page: nextPage,
      }, expected),
      /escaped the requested customer subscription scope/,
    );
  }

  assert.equal(parseSuperwallSubscriptionPage({
    object: 'list',
    url: expected.pathname,
    items: [],
    next_page: `${expected.origin}${expected.pathname}?limit=100&starting_after=cursor`,
  }, expected).nextPage?.searchParams.get('starting_after'), 'cursor');
});

test('binds aliases to the exact requested Superwall identity response', () => {
  assert.deepEqual(parseSuperwallAliases({
    object: 'user_aliases',
    app_user_id: 'anonymous_one',
    aliases: ['user_owner', 'anonymous_one'],
  }, 'anonymous_one'), ['anonymous_one', 'user_owner']);
  assert.throws(() => parseSuperwallAliases({
    object: 'user_aliases', app_user_id: 'other', aliases: ['user_owner'],
  }, 'anonymous_one'), /does not match/);
  assert.throws(() => parseSuperwallAliases({
    object: 'user_aliases', app_user_id: 'anonymous_one', aliases: ['user_owner', { id: 'other' }],
  }, 'anonymous_one'), /does not match/);
});

test('requires stable provider and current store identity plus a bounded access-through time', () => {
  assert.throws(() => normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ id: null }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  }), SuperwallProviderRequestError);
  assert.throws(() => normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ store_subscription_identifier: null }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  }), SuperwallProviderRequestError);
  assert.throws(() => normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ current_period_ends_at: null, ends_at: null }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  }), /future access-through timestamp/);
  assert.throws(() => normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ status: 'future_status' }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  }), /incomplete or unknown/);
  assert.throws(() => normalizeSuperwallSnapshotItem({
    userId: 'user_owner',
    item: subscriptionItem({ entitlements: undefined }),
    snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
    reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
  }), /entitlements are malformed/);
  for (const invalid of [
    { customer_id: 'user_other' },
    { original_customer_id: null },
    { ownership: 'transferred' },
    { starts_at: '2030-01-01T00:00:00.000Z' },
    { current_period_starts_at: null },
    { pending_changes: {} },
  ]) {
    assert.throws(() => normalizeSuperwallSnapshotItem({
      userId: 'user_owner',
      item: subscriptionItem(invalid),
      snapshotEventAt: new Date('2030-01-02T00:00:01.000Z'),
      reconciledAt: new Date('2030-01-02T00:00:00.000Z'),
    }), SuperwallProviderRequestError);
  }
});
