import assert from 'node:assert/strict';
import test from 'node:test';
import db from '@/lib/db';
import {
  cancelStripeSubscriptionsForAccountDeletion,
  createStripeCheckout,
  isStripeCheckoutConfigured,
  parseStripeEvent,
  processStripeEvent,
  requestHasTrustedOrigin,
  StripeProviderRequestError,
  STRIPE_PROVIDER_TIMEOUT_MS,
} from './stripe';

test('Stripe Checkout releases a successful lease but retains an indeterminate mutation lease', async (context) => {
  const originalQuery = db.query;
  const originalAccountTransaction = db.accountTransaction;
  const originalFetch = globalThis.fetch;
  const previous = new Map([
    ['DATABASE_URL', process.env.DATABASE_URL],
    ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY],
    ['STRIPE_PRICE_AD_FREE_MONTHLY', process.env.STRIPE_PRICE_AD_FREE_MONTHLY],
    ['STRIPE_PRICE_AD_FREE_ANNUAL', process.env.STRIPE_PRICE_AD_FREE_ANNUAL],
    ['APP_BASE_URL', process.env.APP_BASE_URL],
  ]);
  context.after(() => {
    db.query = originalQuery;
    db.accountTransaction = originalAccountTransaction;
    globalThis.fetch = originalFetch;
    restoreEnvironment(previous);
  });
  process.env.DATABASE_URL = 'postgresql://test.invalid/girapphe';
  process.env.STRIPE_SECRET_KEY = 'sk_test_checkout_lease';
  process.env.STRIPE_PRICE_AD_FREE_MONTHLY = 'price_monthly';
  process.env.STRIPE_PRICE_AD_FREE_ANNUAL = 'price_annual';
  process.env.APP_BASE_URL = 'https://app.example.com';

  const databaseCalls: Array<{ text: string; params?: unknown[] }> = [];
  db.accountTransaction = (async (_userId, queries) => [{
    rows: [{ event_id: queries[0]?.params?.[1] }],
  }]) as typeof db.accountTransaction;
  db.query = (async (text: string, params?: unknown[]) => {
    databaseCalls.push({ text, params });
    if (text.includes('AS blocked')) return { rows: [{ blocked: false }] };
    if (text.includes('SELECT stripe_customer_id')) {
      return { rows: [{ stripe_customer_id: 'cus_checkout_lease' }] };
    }
    if (text.includes('SET trial_consumed_at = date_trunc')) {
      return { rows: [{ trial_consumed_at: new Date('2030-01-01T00:00:00.000Z') }] };
    }
    return { rows: [] };
  }) as typeof db.query;

  let checkoutCreates = 0;
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (init?.method === 'GET' && url.includes('/checkout/sessions?')) {
      return Response.json({ data: [] });
    }
    if (init?.method === 'GET' && url.includes('/subscriptions?')) {
      return Response.json({ data: [] });
    }
    if (init?.method === 'POST' && url.endsWith('/checkout/sessions')) {
      checkoutCreates += 1;
      if (checkoutCreates === 1) {
        return Response.json({ url: 'https://checkout.stripe.test/session-success' });
      }
      throw new TypeError('simulated lost Checkout response');
    }
    throw new Error(`Unexpected Stripe request: ${init?.method ?? 'GET'} ${url}`);
  }) as typeof fetch;

  assert.equal(await createStripeCheckout({
    userId: 'user_checkout_success',
    email: 'success@example.com',
    plan: 'monthly',
    requestUrl: 'https://app.example.com/subscription',
  }), 'https://checkout.stripe.test/session-success');
  const releasesAfterSuccess = databaseCalls.filter(({ text }) => (
    text.includes('DELETE FROM billing_webhook_events')
  )).length;
  assert.equal(releasesAfterSuccess, 1);

  await assert.rejects(
    createStripeCheckout({
      userId: 'user_checkout_indeterminate',
      email: 'lost@example.com',
      plan: 'monthly',
      requestUrl: 'https://app.example.com/subscription',
    }),
    (error: unknown) => error instanceof StripeProviderRequestError
      && error.outcome === 'indeterminate',
  );
  assert.equal(databaseCalls.filter(({ text }) => (
    text.includes('DELETE FROM billing_webhook_events')
  )).length, releasesAfterSuccess);
  assert.equal(databaseCalls.some(({ text, params }) => (
    text.includes('SET trial_consumed_at = NULL')
    && params?.[0] === 'user_checkout_indeterminate'
  )), false);
});

test('account deletion cancels current and retired Girapphe Stripe subscriptions', async (context) => {
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
  db.query = (async (text: string) => {
    if (text.includes('SELECT stripe_customer_id')) {
      return { rows: [{ stripe_customer_id: 'cus_delete' }] };
    }
    if (text.includes('FROM billing_subscriptions')) {
      return { rows: [{ provider_subscription_id: 'sub_retired' }] };
    }
    return { rows: [] };
  }) as typeof db.query;

  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('/checkout/sessions?')) {
      const cursor = new URL(url).searchParams.get('starting_after');
      if (!cursor) {
        return Response.json({
          data: [
            {
              id: 'cs_owned_first', mode: 'subscription',
              metadata: { user_id: 'user_delete', entitlement: 'ad_free' },
            },
            {
              id: 'cs_other_user', mode: 'subscription',
              metadata: { user_id: 'user_other', entitlement: 'ad_free' },
            },
            { id: 'cs_page_cursor', mode: 'payment', metadata: {} },
          ],
          has_more: true,
        });
      }
      assert.equal(cursor, 'cs_page_cursor');
      return Response.json({
        data: [{
          id: 'cs_owned_second', mode: 'subscription',
          metadata: { user_id: 'user_delete', entitlement: 'ad_free' },
        }],
        has_more: false,
      });
    }
    if (url.includes('/checkout/sessions/') && url.endsWith('/expire')) {
      return Response.json({ id: url.split('/').at(-2), status: 'expired' });
    }
    if (url.includes('/subscriptions?')) {
      return Response.json({
        data: [
          { id: 'sub_girapphe', status: 'active', items: { data: [{ price: { id: 'price_girapphe_monthly' } }] } },
          { id: 'sub_retired', status: 'past_due', items: { data: [{ price: { id: 'price_retired' } }] } },
          {
            id: 'sub_metadata',
            status: 'trialing',
            metadata: { user_id: 'user_delete', entitlement: 'ad_free' },
            items: { data: [{ price: { id: 'price_rotated' } }] },
          },
          { id: 'sub_other', status: 'active', items: { data: [{ price: { id: 'price_other' } }] } },
          { id: 'sub_old', status: 'canceled', items: { data: [{ price: { id: 'price_girapphe_annual' } }] } },
        ],
      });
    }
    return Response.json({ id: 'sub_girapphe', status: 'canceled' });
  }) as typeof fetch;

  assert.equal(await cancelStripeSubscriptionsForAccountDeletion('user_delete'), 3);
  const expiredUrls = requests
    .filter(({ method, url }) => method === 'POST' && url.endsWith('/expire'))
    .map(({ url }) => url);
  assert.equal(expiredUrls.length, 2);
  assert.ok(expiredUrls.some((url) => /checkout\/sessions\/cs_owned_first\/expire$/.test(url)));
  assert.ok(expiredUrls.some((url) => /checkout\/sessions\/cs_owned_second\/expire$/.test(url)));
  assert.ok(expiredUrls.every((url) => !url.includes('cs_other_user')));
  const deletedUrls = requests.filter(({ method }) => method === 'DELETE').map(({ url }) => url);
  assert.equal(deletedUrls.length, 3);
  assert.ok(deletedUrls.some((url) => /subscriptions\/sub_girapphe$/.test(url)));
  assert.ok(deletedUrls.some((url) => /subscriptions\/sub_retired$/.test(url)));
  assert.ok(deletedUrls.some((url) => /subscriptions\/sub_metadata$/.test(url)));
  assert.ok(deletedUrls.every((url) => !/subscriptions\/sub_other$/.test(url)));
  const lastExpiry = Math.max(...requests
    .map((request, index) => request.method === 'POST' && request.url.endsWith('/expire') ? index : -1));
  const subscriptionList = requests.findIndex(({ url }) => url.includes('/subscriptions?'));
  assert.ok(lastExpiry >= 0 && lastExpiry < subscriptionList);
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

test('a late active Stripe subscription for a deleted account is canceled and stored as canceled', async (context) => {
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
  process.env.STRIPE_SECRET_KEY = 'sk_test_deleted_webhook';
  process.env.STRIPE_PRICE_AD_FREE_MONTHLY = 'price_deleted_monthly';
  process.env.STRIPE_PRICE_AD_FREE_ANNUAL = 'price_deleted_annual';

  const writes: Array<{ text: string; params?: unknown[] }> = [];
  db.query = (async (text: string, params?: unknown[]) => {
    writes.push({ text, params });
    if (text.includes('WHERE stripe_customer_id = $1')) {
      return { rows: [{ user_id: 'user_deleted_webhook' }] };
    }
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ stripe_customer_id: 'cus_deleted_webhook' }] };
    }
    if (text.includes('FROM mcp_deleted_account_markers')) {
      return { rows: [{ deleted: true }] };
    }
    return { rows: [] };
  }) as typeof db.query;

  const providerMethods: string[] = [];
  const subscription = {
    id: 'sub_deleted_webhook',
    customer: 'cus_deleted_webhook',
    status: 'active',
    metadata: { user_id: 'user_deleted_webhook', entitlement: 'ad_free' },
    items: { data: [{ price: { id: 'price_deleted_monthly' } }] },
    current_period_start: 1_900_000_000,
    current_period_end: 1_902_678_400,
  };
  globalThis.fetch = (async (_input, init) => {
    providerMethods.push(init?.method ?? 'GET');
    if (init?.method === 'DELETE') {
      return Response.json({ ...subscription, status: 'canceled' });
    }
    return Response.json(subscription);
  }) as typeof fetch;

  const event = parseStripeEvent({
    id: 'evt_deleted_webhook',
    type: 'customer.subscription.updated',
    created: 1_900_000_001,
    data: { object: { id: subscription.id } },
  });
  assert.ok(event);
  await processStripeEvent(event);

  assert.deepEqual(providerMethods, ['GET', 'DELETE']);
  const upsert = writes.find(({ text }) => text.includes('INSERT INTO billing_subscriptions'));
  assert.ok(upsert);
  assert.equal(upsert.params?.[1], 'user_deleted_webhook');
  assert.equal(upsert.params?.[6], 'canceled');
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
