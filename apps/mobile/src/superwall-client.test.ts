import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfiguredSuperwallClient } from './superwall-loader';
import {
  createSuperwallClient,
  establishSuperwallIdentity,
  mapConfiguredProducts,
  superwallStatusAllowsPurchase,
  superwallStatusHasAdFree,
  type SuperwallNativeModule,
} from './superwall-contract';

test('does not load Superwall for web or an unconfigured native build', () => {
  let loadCount = 0;
  const unavailableLoader = () => {
    loadCount += 1;
    throw new Error('native_module_unavailable');
  };
  const configuration = {
    apiKey: 'pk_test',
    store: 'app_store' as const,
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  };

  assert.equal(createConfiguredSuperwallClient('web', configuration, unavailableLoader), null);
  assert.equal(createConfiguredSuperwallClient('ios', null, unavailableLoader), null);
  assert.equal(loadCount, 0);
});

test('maps monthly and annual products using store-localized prices', () => {
  assert.deepEqual(mapConfiguredProducts(
    { monthlyProductId: 'plus.monthly', annualProductId: 'plus.annual' },
    [
      { productIdentifier: 'plus.annual', localizedPrice: '₩14,000', hasFreeTrial: false },
      { productIdentifier: 'plus.monthly', localizedPrice: 'US$0.99', hasFreeTrial: true },
    ],
  ), [
    {
      plan: 'monthly',
      configuredIdentifier: 'plus.monthly',
      purchaseIdentifier: 'plus.monthly',
      localizedPrice: 'US$0.99',
      hasFreeTrial: true,
    },
    {
      plan: 'annual',
      configuredIdentifier: 'plus.annual',
      purchaseIdentifier: 'plus.annual',
      localizedPrice: '₩14,000',
      hasFreeTrial: false,
    },
  ]);
});

test('preserves an Android full identifier so sw-none can exclude offers', () => {
  const [product] = mapConfiguredProducts(
    {
      monthlyProductId: 'plus_monthly:monthly:sw-none',
      annualProductId: 'plus_annual:annual:sw-none',
    },
    [
      {
        productIdentifier: 'plus_monthly',
        fullIdentifier: 'plus_monthly:monthly:sw-none',
        localizedPrice: '$0.99',
      },
      {
        productIdentifier: 'plus_annual',
        fullIdentifier: 'plus_annual:annual:sw-none',
        localizedPrice: '$9.99',
      },
    ],
  );
  assert.equal(product?.purchaseIdentifier, 'plus_monthly:monthly:sw-none');
});

test('recognizes only the existing ad_free Superwall entitlement', () => {
  assert.equal(superwallStatusHasAdFree({
    status: 'ACTIVE',
    entitlements: [{ id: 'ad_free' }],
  }), true);
  assert.equal(superwallStatusHasAdFree({
    status: 'ACTIVE',
    entitlements: [{ id: 'other' }],
  }), false);
  assert.equal(superwallStatusHasAdFree({ status: 'INACTIVE' }), false);
  assert.equal(superwallStatusAllowsPurchase({ status: 'INACTIVE' }), true);
  assert.equal(superwallStatusAllowsPurchase({ status: 'UNKNOWN' }), false);
  assert.equal(superwallStatusAllowsPurchase({
    status: 'ACTIVE', entitlements: [{ id: 'other' }],
  }), false);
});

test('resets the old identity before identifying a different Clerk account', async () => {
  const calls: string[] = [];
  let appUserId: string | null = 'persisted_user';
  const native = {
    configure: async () => { calls.push('configure'); },
    identify: async (userId: string) => { calls.push(`identify:${userId}`); appUserId = userId; },
    reset: async () => { calls.push('reset'); appUserId = null; },
    getUserAttributes: async () => appUserId ? { appUserId } : {},
    getProducts: async () => [],
    purchaseProduct: async () => ({ type: 'purchased' as const }),
    restorePurchases: async () => ({ result: 'restored' as const }),
    getSubscriptionStatus: async () => ({ status: 'INACTIVE' as const }),
    addListener: () => ({ remove() {} }),
  } satisfies SuperwallNativeModule;
  const client = createSuperwallClient(native, {
    apiKey: 'pk_test',
    store: 'app_store',
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  });

  await client.transitionIdentity('user_first');
  await client.transitionIdentity('user_second');
  await client.resetIdentity();

  assert.deepEqual(calls, [
    'configure',
    'reset',
    'identify:user_first',
    'reset',
    'identify:user_second',
    'reset',
  ]);
});

test('never identifies a new Clerk account when resetting the previous identity fails', async () => {
  const calls: string[] = [];
  let resetCount = 0;
  let appUserId: string | null = 'persisted_user';
  const native = {
    configure: async () => { calls.push('configure'); },
    identify: async (userId: string) => { calls.push(`identify:${userId}`); appUserId = userId; },
    reset: async () => {
      calls.push('reset');
      resetCount += 1;
      if (resetCount > 1) throw new Error('native_reset_failed');
      appUserId = null;
    },
    getUserAttributes: async () => appUserId ? { appUserId } : {},
    getProducts: async () => [],
    purchaseProduct: async () => ({ type: 'purchased' as const }),
    restorePurchases: async () => ({ result: 'restored' as const }),
    getSubscriptionStatus: async () => ({ status: 'INACTIVE' as const }),
    addListener: () => ({ remove() {} }),
  } satisfies SuperwallNativeModule;
  const client = createSuperwallClient(native, {
    apiKey: 'pk_test',
    store: 'play_store',
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  });

  await client.transitionIdentity('user_first');
  await assert.rejects(client.transitionIdentity('user_second'), /native_reset_failed/);

  assert.deepEqual(calls, ['configure', 'reset', 'identify:user_first', 'reset']);
});

test('signed-out cold start clears a native identity persisted by an earlier process', async () => {
  const calls: string[] = [];
  let appUserId: string | null = 'persisted_user';
  const native = {
    configure: async () => { calls.push('configure'); },
    identify: async (userId: string) => { calls.push(`identify:${userId}`); appUserId = userId; },
    reset: async () => { calls.push('reset'); appUserId = null; },
    getUserAttributes: async () => appUserId ? { appUserId } : {},
    getProducts: async () => [],
    purchaseProduct: async () => ({ type: 'purchased' as const }),
    restorePurchases: async () => ({ result: 'restored' as const }),
    getSubscriptionStatus: async () => ({ status: 'INACTIVE' as const }),
    addListener: () => ({ remove() {} }),
  } satisfies SuperwallNativeModule;
  const client = createSuperwallClient(native, {
    apiKey: 'pk_test',
    store: 'app_store',
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  });

  await client.resetIdentity();
  await client.transitionIdentity('user_new');

  assert.deepEqual(calls, ['configure', 'reset', 'identify:user_new']);
});

test('serializes an in-flight native purchase before switching Clerk identities', async () => {
  const calls: string[] = [];
  let appUserId: string | null = 'persisted_user';
  let releasePurchase: () => void = () => undefined;
  let markPurchaseStarted: () => void = () => undefined;
  const purchaseGate = new Promise<void>((resolve) => { releasePurchase = resolve; });
  const purchaseStarted = new Promise<void>((resolve) => { markPurchaseStarted = resolve; });
  const native = {
    configure: async () => { calls.push('configure'); },
    identify: async (userId: string) => { calls.push(`identify:${userId}`); appUserId = userId; },
    reset: async () => { calls.push('reset'); appUserId = null; },
    getUserAttributes: async () => appUserId ? { appUserId } : {},
    getProducts: async () => [],
    purchaseProduct: async () => {
      calls.push('purchase:start');
      markPurchaseStarted();
      await purchaseGate;
      calls.push('purchase:end');
      return { type: 'purchased' as const };
    },
    restorePurchases: async () => ({ result: 'restored' as const }),
    getSubscriptionStatus: async () => ({ status: 'INACTIVE' as const }),
    addListener: () => ({ remove() {} }),
  } satisfies SuperwallNativeModule;
  const client = createSuperwallClient(native, {
    apiKey: 'pk_test',
    store: 'app_store',
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  });

  await client.transitionIdentity('user_first');
  const purchasing = client.purchase('user_first', 'monthly');
  await purchaseStarted;
  const switching = client.transitionIdentity('user_second');
  await Promise.resolve();
  assert.deepEqual(calls, ['configure', 'reset', 'identify:user_first', 'purchase:start']);

  releasePurchase();
  await Promise.all([purchasing, switching]);
  assert.deepEqual(calls, [
    'configure',
    'reset',
    'identify:user_first',
    'purchase:start',
    'purchase:end',
    'reset',
    'identify:user_second',
  ]);
});

test('waits for the native identity actor before reading subscription state', async () => {
  const calls: string[] = [];
  let appUserId: string | null = 'persisted_user';
  let pendingIdentity: string | null | undefined;
  let attributeReads = 0;
  const native = {
    configure: async () => { calls.push('configure'); },
    identify: async (userId: string) => {
      calls.push(`identify:${userId}:returned`);
      pendingIdentity = userId;
    },
    reset: async () => {
      calls.push('reset:returned');
      pendingIdentity = null;
    },
    getUserAttributes: async () => {
      attributeReads += 1;
      calls.push(`attributes:${appUserId ?? 'none'}`);
      if (attributeReads % 2 === 0 && pendingIdentity !== undefined) {
        appUserId = pendingIdentity;
        pendingIdentity = undefined;
      }
      return appUserId ? { appUserId } : {};
    },
    getProducts: async () => [],
    purchaseProduct: async () => ({ type: 'purchased' as const }),
    restorePurchases: async () => ({ result: 'restored' as const }),
    getSubscriptionStatus: async () => {
      calls.push(`status:${appUserId ?? 'none'}`);
      return { status: 'INACTIVE' as const };
    },
    addListener: () => ({ remove() {} }),
  } satisfies SuperwallNativeModule;
  const client = createSuperwallClient(native, {
    apiKey: 'pk_test',
    store: 'play_store',
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  });

  await client.transitionIdentity('user_exact');
  await client.readSubscriptionStatus('user_exact');

  assert.equal(appUserId, 'user_exact');
  assert.equal(calls.at(-1), 'status:user_exact');
  assert.ok(calls.indexOf('attributes:persisted_user') > calls.indexOf('reset:returned'));
  assert.ok(calls.indexOf('status:user_exact') > calls.indexOf('identify:user_exact:returned'));
});

test('failed initial identity transition is re-established before Restore runs', async () => {
  const calls: string[] = [];
  let appUserId: string | null = 'persisted_user';
  let identifyAttempts = 0;
  const native = {
    configure: async () => { calls.push('configure'); },
    identify: async (userId: string) => {
      identifyAttempts += 1;
      calls.push(`identify:${userId}:${identifyAttempts}`);
      if (identifyAttempts === 1) throw new Error('initial_identity_failed');
      appUserId = userId;
    },
    reset: async () => { calls.push('reset'); appUserId = null; },
    getUserAttributes: async () => appUserId ? { appUserId } : {},
    getProducts: async () => [],
    purchaseProduct: async () => ({ type: 'purchased' as const }),
    restorePurchases: async () => {
      calls.push(`restore:${appUserId ?? 'anonymous'}`);
      return { result: 'restored' as const };
    },
    getSubscriptionStatus: async () => ({ status: 'INACTIVE' as const }),
    addListener: () => ({ remove() {} }),
  } satisfies SuperwallNativeModule;
  const client = createSuperwallClient(native, {
    apiKey: 'pk_test',
    store: 'app_store',
    monthlyProductId: 'monthly',
    annualProductId: 'annual',
  });
  const establish = () => establishSuperwallIdentity({
    userId: 'user_current',
    transitionIdentity: client.transitionIdentity,
    registerIdentity: async () => { calls.push('backend:register:user_current'); },
    isCurrentUser: (userId) => userId === 'user_current',
  });

  await assert.rejects(establish(), /initial_identity_failed/);
  assert.doesNotMatch(calls.join(','), /backend:register|restore:/);

  await establish();
  const restored = await client.restore('user_current');

  assert.deepEqual(restored, { result: 'restored' });
  assert.deepEqual(calls, [
    'configure',
    'reset',
    'identify:user_current:1',
    'reset',
    'identify:user_current:2',
    'backend:register:user_current',
    'restore:user_current',
  ]);
});
