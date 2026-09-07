import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalEntitlementIsActive,
  ENTITLEMENT_CONFIRMATION_BACKOFF_MS,
  ENTITLEMENT_CONFIRMATION_TIMEOUT_MS,
} from './confirmation';

test('checkout confirmation is bounded to one minute with backoff', () => {
  assert.equal(ENTITLEMENT_CONFIRMATION_TIMEOUT_MS, 60_000);
  assert.deepEqual([...ENTITLEMENT_CONFIRMATION_BACKOFF_MS], [
    1_000, 2_000, 3_000, 5_000, 8_000, 10_000, 15_000,
  ]);
  assert.ok(ENTITLEMENT_CONFIRMATION_BACKOFF_MS.every((delay, index, values) => (
    index === 0 || delay >= values[index - 1]
  )));
});

test('checkout return metadata cannot activate Plus without canonical entitlement', () => {
  assert.equal(canonicalEntitlementIsActive({ success: true }), false);
  assert.equal(canonicalEntitlementIsActive({ checkout: 'returned' }), false);
  assert.equal(canonicalEntitlementIsActive({ entitlement: 'ad_free' }), false);
  assert.equal(canonicalEntitlementIsActive({ isAdFree: 'true' }), false);
  assert.equal(canonicalEntitlementIsActive({ isAdFree: false }), false);
  assert.equal(canonicalEntitlementIsActive({ isAdFree: true }), true);
});
