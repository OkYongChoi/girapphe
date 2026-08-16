import assert from 'node:assert/strict';
import test from 'node:test';
import { purchaseAfterServerEntitlementCheck } from './subscription-purchase-guard';

test('skips a store purchase when the server already grants ad-free access', async () => {
  let purchaseCalls = 0;
  const result = await purchaseAfterServerEntitlementCheck(
    async () => true,
    async () => {
      purchaseCalls += 1;
      return 'purchased';
    },
  );

  assert.deepEqual(result, { alreadyEntitled: true });
  assert.equal(purchaseCalls, 0);
});

test('checks the server immediately before starting an eligible store purchase', async () => {
  const calls: string[] = [];
  const result = await purchaseAfterServerEntitlementCheck(
    async () => {
      calls.push('server');
      return false;
    },
    async () => {
      calls.push('store');
      return 'purchased';
    },
  );

  assert.deepEqual(calls, ['server', 'store']);
  assert.deepEqual(result, { alreadyEntitled: false, purchaseResult: 'purchased' });
});

test('fails closed when the server entitlement cannot be verified', async () => {
  let purchaseCalls = 0;
  await assert.rejects(
    purchaseAfterServerEntitlementCheck(
      async () => {
        throw new Error('unavailable');
      },
      async () => {
        purchaseCalls += 1;
        return 'purchased';
      },
    ),
    /unavailable/,
  );
  assert.equal(purchaseCalls, 0);
});
