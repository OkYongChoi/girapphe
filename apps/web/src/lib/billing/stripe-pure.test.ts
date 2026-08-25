import assert from 'node:assert/strict';
import test from 'node:test';
import db from '@/lib/db';
import {
  cancelStripeSubscriptionsForAccountDeletion,
  isStripeCheckoutConfigured,
  parseStripeEvent,
  processStripeEvent,
  requestHasTrustedOrigin,
  STRIPE_PROVIDER_TIMEOUT_MS,
} from './stripe';

test('account deletion cancels only Girapphe Stripe subscriptions', async (context) => {
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const previous = new Map([
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY],
    ['STRIPE_PRICE_AD_FREE_MONTHLY', process.env.STRIPE_PRICE_AD_FREE_MONTHLY],
    ['STRIPE_PRICE_AD_FREE_ANNUAL', process.env.STRIPE_PRICE_AD_FREE_ANNUAL],
  ]);
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
    restoreEnvironment(previous);
  });
  process.env.DATABASE_URL = 'postgresql://test.invalid/girapphe';
  process.env.STRIPE_SECRET_KEY = 'sk_test_account_deletion';
  process.env.STRIPE_PRICE_AD_FREE_MONTHLY = 'price_girapphe_monthly';
  process.env.STRIPE_PRICE_AD_FREE_ANNUAL = 'price_girapphe_annual';
  db.query = (async () => ({ rows: [{ stripe_customer_id: 'cus_delete' }] })) as typeof db.query;

  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/subscriptions?')) {
      return Response.json({
        data: [
          { id: 'sub_girapphe', status: 'active', items: { data: [{ price: { id: 'price_girapphe_monthly' } }] } },
          { id: 'sub_other', status: 'active', items: { data: [{ price: { id: 'price_other' } }] } },
          { id: 'sub_old', status: 'canceled', items: { data: [{ price: { id: 'price_girapphe_annual' } }] } },
        ],
      });
    }
    return Response.json({ id: 'sub_girapphe', status: 'canceled' });
  }) as typeof fetch;

  assert.equal(await cancelStripeSubscriptionsForAccountDeletion('user_delete'), 1);
  assert.equal(requests.filter(({ method }) => method === 'DELETE').length, 1);
  assert.match(requests.find(({ method }) => method === 'DELETE')?.url ?? '', /subscriptions\/sub_girapphe$/);
});

const STRIPE_CONFIGURATION_KEYS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_AD_FREE_MONTHLY',
  'STRIPE_PRICE_AD_FREE_ANNUAL',
] as const;

function restoreEnvironment(
  snapshot: ReadonlyMap<string, string | undefined>,
) {
  for (const [name, value] of snapshot) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

test('parses a Stripe event and converts its Unix timestamp from seconds', () => {
  const object = { id: 'sub_123', status: 'active' };
  const event = parseStripeEvent({
    id: 'evt_123',
    type: 'customer.subscription.updated',
    created: 1_700_000_000,
    data: { object },
  });

  assert.ok(event);
  assert.equal(event.id, 'evt_123');
  assert.equal(event.type, 'customer.subscription.updated');
  assert.equal(event.createdAt.toISOString(), '2023-11-14T22:13:20.000Z');
  assert.strictEqual(event.data.object, object);
});

test('rejects malformed Stripe event envelopes and timestamps', () => {
  const valid = {
    id: 'evt_123',
    type: 'customer.subscription.updated',
    created: 1_700_000_000,
    data: { object: { id: 'sub_123' } },
  };
  const malformed: unknown[] = [
    null,
    [],
    { ...valid, id: '' },
    { ...valid, id: 123 },
    { ...valid, type: '' },
    { ...valid, type: null },
    { ...valid, created: '1700000000' },
    { ...valid, created: Number.NaN },
    { ...valid, created: Number.POSITIVE_INFINITY },
    { ...valid, created: Number.MAX_VALUE },
    { ...valid, data: null },
    { ...valid, data: [] },
    { ...valid, data: {} },
    { ...valid, data: { object: null } },
    { ...valid, data: { object: [] } },
  ];

  for (const payload of malformed) {
    assert.equal(parseStripeEvent(payload), null);
  }
});

test('requires the complete Stripe checkout configuration group', (context) => {
  const snapshot = new Map(
    STRIPE_CONFIGURATION_KEYS.map((name) => [name, process.env[name]]),
  );
  context.after(() => restoreEnvironment(snapshot));

  for (const name of STRIPE_CONFIGURATION_KEYS) process.env[name] = `test_${name}`;
  assert.equal(isStripeCheckoutConfigured(), true);

  process.env.STRIPE_PRICE_AD_FREE_ANNUAL = process.env.STRIPE_PRICE_AD_FREE_MONTHLY;
  assert.equal(isStripeCheckoutConfigured(), false, 'monthly and annual prices must differ');

  for (const missingName of STRIPE_CONFIGURATION_KEYS) {
    for (const name of STRIPE_CONFIGURATION_KEYS) process.env[name] = `test_${name}`;
    delete process.env[missingName];
    assert.equal(
      isStripeCheckoutConfigured(),
      false,
      `${missingName} must be required`,
    );
  }
});

test('trusts only the exact configured web origin', (context) => {
  const previousBaseUrl = process.env.APP_BASE_URL;
  context.after(() => {
    if (previousBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previousBaseUrl;
  });
  process.env.APP_BASE_URL = 'https://app.example.com/subscription';

  assert.equal(requestHasTrustedOrigin(new Request('https://worker.example.com/api/billing', {
    headers: { Origin: 'https://app.example.com' },
  })), true);
  assert.equal(requestHasTrustedOrigin(new Request('https://worker.example.com/api/billing', {
    headers: { Origin: 'https://app.example.com:444' },
  })), false);
  assert.equal(requestHasTrustedOrigin(new Request('https://worker.example.com/api/billing', {
    headers: { Origin: 'http://app.example.com' },
  })), false);
  assert.equal(requestHasTrustedOrigin(new Request('https://worker.example.com/api/billing', {
    headers: { Origin: 'not a URL' },
  })), false);
  assert.equal(requestHasTrustedOrigin(new Request('https://worker.example.com/api/billing')), false);
});

test('aborts a stalled Stripe provider reconciliation at the application deadline', async (context) => {
  const previousSecret = process.env.STRIPE_SECRET_KEY;
  const originalFetch = globalThis.fetch;
  context.after(() => {
    if (previousSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousSecret;
    globalThis.fetch = originalFetch;
  });
  process.env.STRIPE_SECRET_KEY = 'sk_test_timeout';

  const providerSignals: AbortSignal[] = [];
  globalThis.fetch = ((_input, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    assert.ok(signal, 'Stripe requests must carry an AbortSignal');
    providerSignals.push(signal);
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  })) as typeof fetch;

  const event = parseStripeEvent({
    id: 'evt_timeout',
    type: 'customer.subscription.updated',
    created: 1_700_000_000,
    data: { object: { id: 'sub_timeout' } },
  });
  assert.ok(event);

  assert.equal(STRIPE_PROVIDER_TIMEOUT_MS, 10_000);
  await assert.rejects(processStripeEvent(event, 20), /Stripe request timed out/);
  assert.equal(providerSignals[0]?.aborted, true);
});
