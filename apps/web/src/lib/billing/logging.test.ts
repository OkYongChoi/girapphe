import assert from 'node:assert/strict';
import test from 'node:test';
import { billingLog } from './logging';

test('billing logs expose reconciliation identifiers without accepting payloads or secrets', (context) => {
  const originalInfo = console.info;
  const lines: string[] = [];
  context.after(() => { console.info = originalInfo; });
  console.info = (line) => { lines.push(String(line)); };

  billingLog('info', {
    action: 'subscription_reconciled',
    provider: 'creem',
    store: 'web',
    userId: 'user_123',
    eventId: 'evt_123',
    eventType: 'subscription.paid',
    providerSubscriptionId: 'sub_123',
    productId: 'prod_123',
    plan: 'annual',
    normalizedStatus: 'active',
    providerEventAt: new Date('2030-01-01T00:00:00.000Z'),
    reconciledAt: new Date('2030-01-01T00:00:01.000Z'),
  });

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    kind: 'billing',
    action: 'subscription_reconciled',
    provider: 'creem',
    store: 'web',
    userId: 'user_123',
    eventId: 'evt_123',
    eventType: 'subscription.paid',
    providerSubscriptionId: 'sub_123',
    productId: 'prod_123',
    plan: 'annual',
    normalizedStatus: 'active',
    providerEventAt: '2030-01-01T00:00:00.000Z',
    reconciledAt: '2030-01-01T00:00:01.000Z',
    errorCode: null,
  });
  assert.doesNotMatch(lines[0], /secret|payload|card/i);
});
