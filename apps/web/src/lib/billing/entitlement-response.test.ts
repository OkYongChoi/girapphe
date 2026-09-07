import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authenticationRequiredEntitlementResponse,
  readEntitlementResponse,
} from './entitlement-response';

test('returns a no-store entitlement response for an authoritative result', async () => {
  const response = await readEntitlementResponse(async () => false);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vary'), 'Authorization, Cookie');
  assert.deepEqual(await response.json(), { isAdFree: false });
});

test('returns provider-neutral subscription detail without changing the isAdFree contract', async () => {
  const response = await readEntitlementResponse(async () => ({
    isAdFree: true,
    acquisitionBlocked: true,
    duplicateDetected: false,
    subscriptions: [],
  }));

  assert.deepEqual(await response.json(), {
    isAdFree: true,
    acquisitionBlocked: true,
    duplicateDetected: false,
    subscriptions: [],
  });
});

test('never serializes internal provider ownership or environment identifiers', async () => {
  const response = await readEntitlementResponse(async () => ({
    isAdFree: true,
    acquisitionBlocked: true,
    duplicateDetected: false,
    subscriptions: [{
      provider: 'superwall',
      store: 'app_store',
      plan: 'annual',
      status: 'active',
      entitlement: 'ad_free',
      productId: 'ios.plus.annual',
      currentPeriodEnd: '2030-01-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      autoRenew: true,
      graceExpiresAt: null,
      graceReason: null,
      environment: 'production',
      providerCustomerId: 'user_private',
      providerSubscriptionId: 'superwall_private',
    }],
  }));

  const body = await response.json() as { subscriptions: Array<Record<string, unknown>> };
  assert.equal(body.subscriptions[0]?.provider, 'superwall');
  assert.equal('environment' in body.subscriptions[0], false);
  assert.equal('providerCustomerId' in body.subscriptions[0], false);
  assert.equal('providerSubscriptionId' in body.subscriptions[0], false);
});

test('returns 503 instead of treating an unavailable entitlement as false', async (context) => {
  const originalConsoleError = console.error;
  context.after(() => { console.error = originalConsoleError; });
  console.error = () => undefined;

  const response = await readEntitlementResponse(async () => {
    throw new Error('database unavailable');
  });

  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: 'entitlement_unavailable' });
});

test('returns 401 without consulting an entitlement reader for unauthenticated requests', async () => {
  const response = authenticationRequiredEntitlementResponse();

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'authentication_required' });
});
