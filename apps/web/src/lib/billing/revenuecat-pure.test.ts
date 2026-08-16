import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalRevenueCatSubscriptionId,
  isRevenueCatEventInScope,
  parseRevenueCatEvent,
  planFromRevenueCatProductId,
  processRevenueCatEvent,
  processRevenueCatTransfer,
  REVENUECAT_REQUEST_TIMEOUT_MS,
  verifyRevenueCatTransferDestination,
  type RevenueCatEvent,
} from './revenuecat';

function revenueCatEvent(
  type: string,
  payload: Record<string, unknown> = {},
): RevenueCatEvent {
  return {
    id: 'evt_rc_123',
    type,
    payload: {
      id: 'evt_rc_123',
      type,
      app_id: 'app_girapphe',
      ...payload,
    },
  };
}

test('parses a RevenueCat webhook envelope without rewriting its event payload', () => {
  const payload = {
    id: 'evt_rc_123',
    type: 'INITIAL_PURCHASE',
    app_id: 'app_girapphe',
    event_timestamp_ms: 1_700_000_000_000,
  };
  const event = parseRevenueCatEvent({ event: payload });

  assert.ok(event);
  assert.equal(event.id, 'evt_rc_123');
  assert.equal(event.type, 'INITIAL_PURCHASE');
  assert.strictEqual(event.payload, payload);
});

test('rejects malformed RevenueCat webhook envelopes', () => {
  const validEvent = { id: 'evt_rc_123', type: 'INITIAL_PURCHASE' };
  const malformed: unknown[] = [
    null,
    [],
    {},
    { event: null },
    { event: [] },
    { event: { ...validEvent, id: '' } },
    { event: { ...validEvent, id: 123 } },
    { event: { ...validEvent, type: '' } },
    { event: { ...validEvent, type: null } },
  ];

  for (const payload of malformed) {
    assert.equal(parseRevenueCatEvent(payload), null);
  }
});

test('requires an exact RevenueCat app id from the configured platform allowlist', (context) => {
  const previousAppEnv = process.env.APP_ENV;
  context.after(() => {
    if (previousAppEnv === undefined) Reflect.deleteProperty(process.env, 'APP_ENV');
    else process.env.APP_ENV = previousAppEnv;
  });
  process.env.APP_ENV = 'preview';

  const event = revenueCatEvent('INITIAL_PURCHASE', { environment: 'SANDBOX' });
  assert.equal(isRevenueCatEventInScope(event, 'app_ios, app_girapphe'), true);
  assert.equal(isRevenueCatEventInScope(event, 'APP_GIRAPPHE'), false);
  assert.equal(isRevenueCatEventInScope(event, ''), false);
  assert.equal(
    isRevenueCatEventInScope(
      revenueCatEvent('INITIAL_PURCHASE', { app_id: undefined }),
      'app_girapphe',
    ),
    false,
  );
});

test('accepts only production RevenueCat purchase events in production', (context) => {
  const previousAppEnv = process.env.APP_ENV;
  context.after(() => {
    if (previousAppEnv === undefined) Reflect.deleteProperty(process.env, 'APP_ENV');
    else process.env.APP_ENV = previousAppEnv;
  });
  process.env.APP_ENV = 'prod';

  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('RENEWAL', { environment: 'PRODUCTION' }),
    'app_girapphe',
  ), true);
  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('RENEWAL', { environment: 'production' }),
    'app_girapphe',
  ), true);
  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('RENEWAL', { environment: 'SANDBOX' }),
    'app_girapphe',
  ), false);
  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('RENEWAL', { environment: undefined }),
    'app_girapphe',
  ), false);
});

test('allows a production transfer without an environment but rejects sandbox transfers', (context) => {
  const previousAppEnv = process.env.APP_ENV;
  context.after(() => {
    if (previousAppEnv === undefined) Reflect.deleteProperty(process.env, 'APP_ENV');
    else process.env.APP_ENV = previousAppEnv;
  });
  process.env.APP_ENV = 'prod';

  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('TRANSFER', { environment: undefined }),
    'app_girapphe',
  ), true);
  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('TRANSFER', { environment: 'PRODUCTION' }),
    'app_girapphe',
  ), true);
  assert.equal(isRevenueCatEventInScope(
    revenueCatEvent('TRANSFER', { environment: 'SANDBOX' }),
    'app_girapphe',
  ), false);
});

test('maps only explicitly configured RevenueCat store product identifiers', (context) => {
  const previousMonthly = process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS;
  const previousAnnual = process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS;
  context.after(() => {
    if (previousMonthly === undefined) delete process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS;
    else process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS = previousMonthly;
    if (previousAnnual === undefined) delete process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS;
    else process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS = previousAnnual;
  });
  process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS = 'ios.monthly, android.monthly';
  process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS = 'ios.annual, android.annual';

  assert.equal(planFromRevenueCatProductId('android.monthly'), 'monthly');
  assert.equal(planFromRevenueCatProductId('ios.annual'), 'annual');
  assert.equal(planFromRevenueCatProductId('adfree_12m'), 'unknown');
  process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS = 'ios.annual,android.monthly';
  assert.equal(planFromRevenueCatProductId('android.monthly'), 'unknown');
});

test('rejects malformed RevenueCat event timestamps before any reconciliation', async () => {
  const malformedTimestamps: unknown[] = [
    undefined,
    null,
    '1700000000000',
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_VALUE,
  ];

  for (const eventTimestamp of malformedTimestamps) {
    await assert.rejects(
      processRevenueCatEvent(revenueCatEvent('INITIAL_PURCHASE', {
        event_timestamp_ms: eventTimestamp,
      })),
      /RevenueCat event timestamp is missing/,
    );
  }
});

test('accepts a finite RevenueCat millisecond timestamp before store filtering', async () => {
  await assert.doesNotReject(processRevenueCatEvent(revenueCatEvent('INITIAL_PURCHASE', {
    event_timestamp_ms: 1_700_000_000_000,
    store: 'STRIPE',
  })));
});

test('bounds the authoritative RevenueCat request before the webhook response deadline', async (context) => {
  const previousApiKey = process.env.REVENUECAT_SECRET_API_KEY;
  const originalFetch = globalThis.fetch;
  const observedSignals: AbortSignal[] = [];
  context.after(() => {
    if (previousApiKey === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
    else process.env.REVENUECAT_SECRET_API_KEY = previousApiKey;
    globalThis.fetch = originalFetch;
  });
  process.env.REVENUECAT_SECRET_API_KEY = 'rc_test_secret';
  globalThis.fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    assert.ok(signal);
    observedSignals.push(signal);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  })) as typeof fetch;

  assert.equal(REVENUECAT_REQUEST_TIMEOUT_MS, 10_000);
  await assert.rejects(
    verifyRevenueCatTransferDestination(
      'user_timeout_test',
      new Date('2030-01-01T00:00:00.000Z'),
      20,
    ),
    /RevenueCat Customer Info request timed out/,
  );
  assert.equal(observedSignals[0]?.aborted, true);
});

test('an environment-less sandbox transfer cannot mutate any subscription row', async (context) => {
  const previous = {
    appEnv: process.env.APP_ENV,
    apiKey: process.env.REVENUECAT_SECRET_API_KEY,
    monthlyIds: process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS,
  };
  const originalFetch = globalThis.fetch;
  context.after(() => {
    if (previous.appEnv === undefined) Reflect.deleteProperty(process.env, 'APP_ENV');
    else process.env.APP_ENV = previous.appEnv;
    if (previous.apiKey === undefined) delete process.env.REVENUECAT_SECRET_API_KEY;
    else process.env.REVENUECAT_SECRET_API_KEY = previous.apiKey;
    if (previous.monthlyIds === undefined) delete process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS;
    else process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS = previous.monthlyIds;
    globalThis.fetch = originalFetch;
  });
  process.env.APP_ENV = 'prod';
  process.env.REVENUECAT_SECRET_API_KEY = 'rc_test_secret';
  process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS = 'girapphe.monthly';

  const requestedUsers: string[] = [];
  let isSandbox = true;
  let transactionId: string | undefined = 'sandbox_transaction_123';
  globalThis.fetch = async (input) => {
    requestedUsers.push(decodeURIComponent(String(input).split('/').at(-1) ?? ''));
    return Response.json({
      request_date: '2030-01-01T00:00:00.000Z',
      subscriber: {
        entitlements: {
          ad_free: {
            product_identifier: 'girapphe.monthly',
            expires_date: '2099-01-01T00:00:00.000Z',
          },
        },
        subscriptions: {
          'girapphe.monthly': {
            store: 'APP_STORE',
            is_sandbox: isSandbox,
            store_transaction_id: transactionId,
            purchase_date: '2029-12-01T00:00:00.000Z',
            expires_date: '2099-01-01T00:00:00.000Z',
          },
        },
      },
    });
  };

  const moved: unknown[] = [];
  await processRevenueCatTransfer(
    revenueCatEvent('TRANSFER', {
      environment: undefined,
      transferred_from: ['user_source'],
      transferred_to: ['user_destination'],
    }),
    new Date('2030-01-01T00:00:00.000Z'),
    verifyRevenueCatTransferDestination,
    async (subscription) => {
      moved.push(subscription);
      return true;
    },
  );

  assert.deepEqual(requestedUsers, ['user_destination']);
  assert.equal(moved.length, 0);

  isSandbox = false;
  transactionId = 'production_transaction_456';
  await processRevenueCatTransfer(
    revenueCatEvent('TRANSFER', {
      environment: undefined,
      transferred_from: ['user_source'],
      transferred_to: ['user_destination'],
    }),
    new Date('2030-01-01T00:00:00.000Z'),
    verifyRevenueCatTransferDestination,
    async (subscription) => {
      moved.push(subscription);
      return true;
    },
  );
  assert.equal(moved.length, 1);
  assert.equal(
    (moved[0] as { providerSubscriptionId: string }).providerSubscriptionId,
    canonicalRevenueCatSubscriptionId(
      'app_store',
      'girapphe.monthly',
      'production_transaction_456',
    ),
  );

  transactionId = undefined;
  await processRevenueCatTransfer(
    revenueCatEvent('TRANSFER', {
      environment: undefined,
      transferred_from: ['user_source'],
      transferred_to: ['user_destination'],
    }),
    new Date('2030-01-01T00:00:00.000Z'),
    verifyRevenueCatTransferDestination,
    async (subscription) => {
      moved.push(subscription);
      return true;
    },
  );
  assert.equal(moved.length, 1);
});

test('a transfer moves only the exact production transaction verified for its destination', async () => {
  const verifiedAt = new Date('2030-01-01T00:00:00.000Z');
  const moved: unknown[] = [];
  const verifiedSubscription = {
    providerSubscriptionId: 'production_transaction_456',
    userId: 'user_destination',
    store: 'play_store' as const,
    plan: 'annual' as const,
    status: 'active',
    entitlement: 'ad_free',
    currentPeriodStart: verifiedAt,
    currentPeriodEnd: new Date('2031-01-01T00:00:00.000Z'),
    trialEnd: null,
    cancelAtPeriodEnd: false,
    providerEventAt: verifiedAt,
  };

  await processRevenueCatTransfer(
    revenueCatEvent('TRANSFER', {
      transferred_from: ['user_source', 'user_unrelated'],
      transferred_to: ['user_destination'],
    }),
    verifiedAt,
    async (userId) => {
      assert.equal(userId, 'user_destination');
      return verifiedSubscription;
    },
    async (subscription, allowedPreviousUserIds) => {
      assert.deepEqual(allowedPreviousUserIds, ['user_source', 'user_unrelated']);
      moved.push(subscription);
      return true;
    },
  );

  assert.deepEqual(moved, [verifiedSubscription]);
});

test('a transfer without a Clerk destination performs no verification or mutation', async () => {
  let verified = false;
  let moved = false;
  await processRevenueCatTransfer(
    revenueCatEvent('TRANSFER', { transferred_from: ['user_source'] }),
    new Date('2030-01-01T00:00:00.000Z'),
    async () => {
      verified = true;
      return null;
    },
    async () => {
      moved = true;
      return true;
    },
  );
  assert.equal(verified, false);
  assert.equal(moved, false);
});

test('a transfer with ambiguous Clerk destinations performs no verification or mutation', async () => {
  let verified = false;
  let moved = false;
  await processRevenueCatTransfer(
    revenueCatEvent('TRANSFER', {
      transferred_from: ['user_source'],
      transferred_to: ['user_destination_one', 'user_destination_two'],
    }),
    new Date('2030-01-01T00:00:00.000Z'),
    async () => {
      verified = true;
      return null;
    },
    async () => {
      moved = true;
      return true;
    },
  );
  assert.equal(verified, false);
  assert.equal(moved, false);
});

test('RevenueCat canonical ids bind store, exact product, and exact transaction', () => {
  const base = canonicalRevenueCatSubscriptionId('app_store', 'girapphe.monthly', 'tx_123');
  assert.notEqual(
    base,
    canonicalRevenueCatSubscriptionId('app_store', 'girapphe.annual', 'tx_123'),
  );
  assert.notEqual(
    base,
    canonicalRevenueCatSubscriptionId('app_store', 'girapphe.monthly', 'tx_456'),
  );
  assert.notEqual(
    base,
    canonicalRevenueCatSubscriptionId('play_store', 'girapphe.monthly', 'tx_123'),
  );
});
