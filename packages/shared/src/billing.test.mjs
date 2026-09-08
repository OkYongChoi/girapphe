import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateAdFreeEntitlement,
  hasDuplicateQualifyingSubscriptions,
  managementDestinationFor,
  subscriptionGrantsAdFree,
} from './billing.ts';

const NOW = new Date('2030-01-01T00:00:00.000Z');

function subscription(overrides = {}) {
  return {
    provider: 'creem',
    store: 'web',
    plan: 'annual',
    status: 'active',
    entitlement: 'ad_free',
    productId: 'prod_plus_annual',
    currentPeriodEnd: '2031-01-01T00:00:00.000Z',
    cancelAtPeriodEnd: false,
    autoRenew: true,
    graceExpiresAt: null,
    graceReason: null,
    ...overrides,
  };
}

test('any valid provider keeps the canonical entitlement active', () => {
  assert.equal(aggregateAdFreeEntitlement([
    subscription({ status: 'expired', currentPeriodEnd: '2029-12-01T00:00:00.000Z' }),
    subscription({ provider: 'superwall', store: 'app_store', plan: 'monthly' }),
  ], NOW), true);
  assert.equal(aggregateAdFreeEntitlement([
    subscription({ status: 'expired', currentPeriodEnd: '2029-12-01T00:00:00.000Z' }),
    subscription({ provider: 'superwall', store: 'play_store', status: 'revoked' }),
  ], NOW), false);
});

test('scheduled cancellation preserves access only through the paid period', () => {
  assert.equal(subscriptionGrantsAdFree(subscription({
    status: 'canceled',
    cancelAtPeriodEnd: true,
  }), NOW), true);
  assert.equal(subscriptionGrantsAdFree(subscription({
    status: 'canceled',
    cancelAtPeriodEnd: true,
    currentPeriodEnd: NOW.toISOString(),
  }), NOW), false);
});

test('past-due access needs a fixed unexpired grace while refunds never qualify', () => {
  assert.equal(subscriptionGrantsAdFree(subscription({
    status: 'past_due',
    currentPeriodEnd: NOW.toISOString(),
    graceReason: 'billing',
    graceExpiresAt: '2030-01-04T00:00:00.000Z',
  }), NOW), true);
  assert.equal(subscriptionGrantsAdFree(subscription({
    status: 'past_due',
    graceReason: 'verification',
    graceExpiresAt: NOW.toISOString(),
  }), NOW), false);
  assert.equal(subscriptionGrantsAdFree(subscription({ status: 'refunded' }), NOW), false);
  assert.equal(subscriptionGrantsAdFree(subscription({ status: 'revoked' }), NOW), false);
});

test('duplicate detection preserves rows and counts valid concurrent subscriptions', () => {
  assert.equal(hasDuplicateQualifyingSubscriptions([
    subscription(),
    subscription({ provider: 'superwall', store: 'play_store', plan: 'monthly' }),
  ], NOW), true);
  assert.equal(hasDuplicateQualifyingSubscriptions([
    subscription(),
    subscription({ provider: 'superwall', store: 'play_store', status: 'expired' }),
  ], NOW), false);
});

test('management destination follows purchase origin', () => {
  assert.deepEqual(managementDestinationFor(subscription(), 'https://portal.creem.io/session'), {
    kind: 'creem_portal',
    url: 'https://portal.creem.io/session',
  });
  assert.deepEqual(managementDestinationFor(subscription({ provider: 'superwall', store: 'app_store' })), {
    kind: 'app_store',
    url: 'https://apps.apple.com/account/subscriptions',
  });
  assert.deepEqual(managementDestinationFor(subscription({ provider: 'superwall', store: 'play_store' })), {
    kind: 'play_store',
    url: 'https://play.google.com/store/account/subscriptions',
  });
});
