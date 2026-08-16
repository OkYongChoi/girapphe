import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import db from '@/lib/db';
import { createStripePortal, StripePortalRateLimitError } from './stripe';

const PORTAL_ENVIRONMENT_KEYS = [
  'APP_BASE_URL',
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
] as const;

function configurePortalTestEnvironment(context: TestContext) {
  const snapshot = new Map(
    PORTAL_ENVIRONMENT_KEYS.map((name) => [name, process.env[name]]),
  );
  context.after(() => {
    for (const [name, value] of snapshot) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.APP_BASE_URL = 'https://app.example.com';
  process.env.DATABASE_URL = 'postgresql://portal-test.invalid/database';
  process.env.STRIPE_SECRET_KEY = 'sk_test_portal';
}

test('Stripe portal denial consumes no provider request', async (context) => {
  configurePortalTestEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('SELECT stripe_customer_id')) {
      return { rows: [{ stripe_customer_id: 'cus_portal_test' }] };
    }
    if (text.includes('UPDATE billing_customers')) {
      assert.match(text, /INTERVAL '10 minutes'/);
      assert.match(text, /stripe_portal_request_count < 10/);
      assert.deepEqual(params, ['user_rate_limited']);
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }) as typeof db.query;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return Response.json({ url: 'https://billing.stripe.test/session' });
  }) as typeof fetch;

  await assert.rejects(
    createStripePortal({
      userId: 'user_rate_limited',
      requestUrl: 'https://app.example.com/api/billing/portal',
    }),
    (error: unknown) => {
      assert.ok(error instanceof StripePortalRateLimitError);
      assert.equal(error.retryAfterSeconds, 600);
      return true;
    },
  );
  assert.equal(fetchCalls, 0);
});

test('an allowed Stripe portal request reaches the provider after the atomic rate slot', async (context) => {
  configurePortalTestEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const events: string[] = [];
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('SELECT stripe_customer_id')) {
      events.push('customer');
      return { rows: [{ stripe_customer_id: 'cus_portal_test' }] };
    }
    if (text.includes('UPDATE billing_customers')) {
      events.push('rate-slot');
      assert.match(text, /INTERVAL '10 minutes'/);
      assert.match(text, /stripe_portal_request_count < 10/);
      assert.deepEqual(params, ['user_allowed']);
      return { rows: [{ user_id: 'user_allowed' }] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }) as typeof db.query;
  globalThis.fetch = (async (input) => {
    events.push('provider');
    assert.equal(input, 'https://api.stripe.com/v1/billing_portal/sessions');
    return Response.json({ url: 'https://billing.stripe.test/session' });
  }) as typeof fetch;

  const portalUrl = await createStripePortal({
    userId: 'user_allowed',
    requestUrl: 'https://app.example.com/api/billing/portal',
  });

  assert.equal(portalUrl, 'https://billing.stripe.test/session');
  assert.deepEqual(events, ['customer', 'rate-slot', 'provider']);
});
