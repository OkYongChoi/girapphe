import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import db from '@/lib/db';
import {
  activateTossBilling,
  processTossBillingKeyIntents,
} from './toss-subscriptions';
import {
  encryptTossBillingKey,
  sha256Fingerprint,
} from './toss';

const tossEnvironment: Record<string, string> = {
  TOSS_BILLING_ENABLED: 'true',
  TOSS_BILLING_TEST_OVERRIDE: 'true',
  NEXT_PUBLIC_TOSS_CLIENT_KEY: 'test_ck_lifecycle',
  TOSS_SECRET_KEY: 'test_sk_lifecycle',
  TOSS_BILLING_ENCRYPTION_KEY: Buffer.alloc(32, 11).toString('base64'),
  TOSS_BILLING_CRON_TOKEN: 'lifecycle-test-cron-token-00000000000',
  TOSS_MONTHLY_AMOUNT_KRW: '1400',
  TOSS_ANNUAL_AMOUNT_KRW: '14000',
};

const exclusiveProviderKeys = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_AD_FREE_MONTHLY',
  'STRIPE_PRICE_AD_FREE_ANNUAL',
  'REVENUECAT_WEBHOOK_AUTHORIZATION',
  'REVENUECAT_WEBHOOK_SIGNING_SECRET',
  'REVENUECAT_APP_IDS',
  'REVENUECAT_SECRET_API_KEY',
  'REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS',
  'REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS',
] as const;

function configureTossEnvironment(context: TestContext) {
  const previous = new Map<string, string | undefined>();
  for (const name of [...Object.keys(tossEnvironment), ...exclusiveProviderKeys]) {
    previous.set(name, process.env[name]);
  }
  for (const [name, value] of Object.entries(tossEnvironment)) process.env[name] = value;
  for (const name of exclusiveProviderKeys) delete process.env[name];
  context.after(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test('scheduled recovery retries a lost issue response with the durable idempotency key', async (context) => {
  configureTossEnvironment(context);
  const encryptedAuthKey = await encryptTossBillingKey('auth_key_lost_response');
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const providerIdempotencyKey = 'girapphe_issue_durable_recovery_key';
  const providerAttempts: string[] = [];
  const persistedStatuses: string[] = [];
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  const issuingIntent = {
    id: 'toss_intent_recovery',
    agreement_id: 'toss_agreement_recovery',
    user_id: 'user_recovery',
    customer_key: 'girapphe_recovery_customer',
    plan: 'monthly',
    provider_idempotency_key: providerIdempotencyKey,
    auth_key_ciphertext: encryptedAuthKey,
    billing_key_ciphertext: null,
    billing_key_fingerprint: null,
    status: 'issuing',
    processing_token: 'worker-token',
  };

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('duplicate_candidates') || text.includes('referenced_candidates')) {
      return { rows: [] };
    }
    if (text.includes('WITH expired AS')) return { rows: [] };
    if (text.includes("WHERE status = 'issuing'") && text.includes('FOR UPDATE SKIP LOCKED')) {
      assert.match(text, /created_at >= NOW\(\) - INTERVAL '14 days'/);
      return { rows: [issuingIntent] };
    }
    if (text.includes("status = 'cleanup_pending'") && text.includes('issue_attempt_count')) {
      persistedStatuses.push('cleanup_pending');
      return { rows: [{
        ...issuingIntent,
        auth_key_ciphertext: null,
        billing_key_ciphertext: params?.[1],
        billing_key_fingerprint: params?.[2],
        status: 'cleanup_pending',
        processing_token: null,
      }] };
    }
    if (text.includes("i.status = 'cleanup_pending'")
      && text.includes("i.updated_at < NOW() - INTERVAL '5 minutes'")) {
      return { rows: [] };
    }
    if (text.includes('issue_attempt_count = issue_attempt_count + 1')) return { rows: [] };
    throw new Error(`Unexpected recovery query: ${text}`);
  }) as typeof db.query;

  globalThis.fetch = (async (request, init) => {
    assert.equal(String(request).endsWith('/v1/billing/authorizations/issue'), true);
    assert.equal(init?.method, 'POST');
    providerAttempts.push(new Headers(init?.headers).get('Idempotency-Key') ?? '');
    if (providerAttempts.length === 1) throw new TypeError('simulated response loss');
    return Response.json({
      billingKey: 'billing_key_recovered',
      customerKey: issuingIntent.customer_key,
    });
  }) as typeof fetch;

  const first = await processTossBillingKeyIntents();
  const second = await processTossBillingKeyIntents();

  assert.deepEqual(providerAttempts, [providerIdempotencyKey, providerIdempotencyKey]);
  assert.equal(first.failed, 1);
  assert.equal(first.recovered, 0);
  assert.equal(second.failed, 0);
  assert.equal(second.recovered, 1);
  assert.deepEqual(persistedStatuses, ['cleanup_pending']);
});

test('orphan DELETE failure remains pending and is retried to durable cleaned state', async (context) => {
  configureTossEnvironment(context);
  const encryptedBillingKey = await encryptTossBillingKey('billing_key_cleanup_retry');
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const cleanupQueries: string[] = [];
  const providerMethods: string[] = [];
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  const cleanupIntent = {
    id: 'toss_intent_cleanup_retry',
    agreement_id: 'toss_agreement_cleanup_retry',
    user_id: 'user_cleanup_retry',
    customer_key: 'girapphe_cleanup_customer',
    plan: 'monthly',
    provider_idempotency_key: 'girapphe_issue_cleanup_retry',
    auth_key_ciphertext: null,
    billing_key_ciphertext: encryptedBillingKey,
    billing_key_fingerprint: await sha256Fingerprint('billing_key_cleanup_retry'),
    status: 'cleanup_pending',
    processing_token: 'cleanup-worker-token',
  };

  db.query = (async (text: string) => {
    if (text.includes('duplicate_candidates') || text.includes('referenced_candidates')) {
      return { rows: [] };
    }
    if (text.includes('WITH expired AS')) return { rows: [] };
    if (text.includes("WHERE status = 'issuing'") && text.includes('FOR UPDATE SKIP LOCKED')) {
      return { rows: [] };
    }
    if (text.includes("i.status = 'cleanup_pending'")
      && text.includes("i.updated_at < NOW() - INTERVAL '5 minutes'")) {
      cleanupQueries.push(text);
      return { rows: [cleanupIntent] };
    }
    if (text.includes('SELECT i.billing_key_ciphertext')) {
      cleanupQueries.push(text);
      return { rows: [{ billing_key_ciphertext: encryptedBillingKey }] };
    }
    if (text.includes("status = 'cleaned'") && text.includes('cleaned_at = NOW()')) {
      cleanupQueries.push(text);
      return { rows: [{ id: cleanupIntent.id }] };
    }
    if (text.includes('cleanup_attempt_count = cleanup_attempt_count + 1')) {
      cleanupQueries.push(text);
      return { rows: [] };
    }
    throw new Error(`Unexpected cleanup query: ${text}`);
  }) as typeof db.query;

  globalThis.fetch = (async (_request, init) => {
    providerMethods.push(init?.method ?? 'GET');
    return providerMethods.length === 1
      ? Response.json({ code: 'TEMPORARY_PROVIDER_ERROR' }, { status: 503 })
      : Response.json({ code: 'NOT_FOUND_BILLING_KEY' }, { status: 404 });
  }) as typeof fetch;

  const first = await processTossBillingKeyIntents();
  const second = await processTossBillingKeyIntents();

  assert.deepEqual(providerMethods, ['DELETE', 'DELETE']);
  assert.equal(first.failed, 1);
  assert.equal(first.cleaned, 0);
  assert.equal(second.failed, 0);
  assert.equal(second.cleaned, 1);
  assert.equal(cleanupQueries.some((query) => (
    query.includes('current.billing_key_fingerprint = i.billing_key_fingerprint')
      && query.includes('current.billing_key_fingerprint IS NULL')
  )), true, 'cleanup must quarantine a live equal or unknown fingerprint');
  assert.equal(cleanupQueries.some((query) => (
    query.includes('SELECT i.billing_key_ciphertext')
      && query.includes('i.processing_token = $2')
      && query.includes('NOT EXISTS')
  )), true, 'cleanup must recheck ownership after claiming and before DELETE');
});

test('stale reclaim atomically retires a duplicate key without provider DELETE', async (context) => {
  configureTossEnvironment(context);
  const rawBillingKey = 'billing_key_stale_same_value';
  const oldCiphertext = await encryptTossBillingKey(rawBillingKey);
  const oldFingerprint = await sha256Fingerprint(rawBillingKey);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const customerKey = 'girapphe_12345678-1234-1234-1234-123456789012';
  const providerMethods: string[] = [];
  let agreementReads = 0;
  let intent: Record<string, unknown> | null = null;
  let reclaimSql = '';
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: customerKey, trial_consumed_at: null }] };
    }
    if (text.includes('SELECT status, plan, current_period_start::text')) {
      agreementReads += 1;
      if (agreementReads <= 2) {
        return { rows: [{
          status: 'past_due', plan: 'monthly',
          current_period_start: '2020-01-01T00:00:00.000Z',
          current_period_end: '2020-02-01T00:00:00.000Z',
          cancel_at_period_end: false,
        }] };
      }
      return { rows: [{
        status: 'trialing', plan: 'monthly',
        current_period_start: '2030-01-01T00:00:00.000Z',
        current_period_end: '2099-01-01T00:00:00.000Z',
        cancel_at_period_end: false,
      }] };
    }
    if (text.includes('SELECT a.billing_key_ciphertext, a.billing_key_intent_id')) {
      return { rows: [{
        billing_key_ciphertext: oldCiphertext,
        billing_key_intent_id: 'toss_intent_old',
        billing_key_fingerprint: oldFingerprint,
        customer_key: customerKey,
        plan: 'monthly',
      }] };
    }
    if (text.includes('UPDATE toss_billing_key_intents SET')
      && text.includes('billing_key_fingerprint = COALESCE')) return { rows: [] };
    if (text.includes('SELECT EXISTS (') && text.includes('FROM billing_subscriptions')) {
      return { rows: [{ blocked: false }] };
    }
    if (text.includes('INSERT INTO toss_billing_key_intents')) {
      intent = {
        id: params?.[0], agreement_id: params?.[1], user_id: params?.[2],
        customer_key: params?.[3], plan: params?.[4],
        provider_idempotency_key: params?.[6], auth_key_ciphertext: params?.[7],
        billing_key_ciphertext: null, billing_key_fingerprint: null,
        status: 'issuing', processing_token: null,
      };
      return { rows: [intent] };
    }
    if (text.includes("status = 'cleanup_pending'") && text.includes('issue_attempt_count')) {
      intent = {
        ...intent, auth_key_ciphertext: null,
        billing_key_ciphertext: params?.[1], billing_key_fingerprint: params?.[2],
        status: 'cleanup_pending',
      };
      return { rows: [intent] };
    }
    if (text.includes('INSERT INTO toss_billing_agreements')) {
      return { rows: [{ claimed: false, cross_provider_blocked: false }] };
    }
    if (text.includes('retired_intent AS')) {
      reclaimSql = text;
      return { rows: [{ id: 'toss_agreement', previous_intent_id: 'toss_intent_old' }] };
    }
    if (text.includes('FROM toss_billing_charges')) return { rows: [] };
    if (text.includes('WITH fenced AS')) {
      return { rows: [{ status: 'trialing', trial_claimed: true }] };
    }
    if (text.includes('INSERT INTO billing_subscriptions')) return { rows: [] };
    throw new Error(`Unexpected stale reclaim query: ${text}`);
  }) as typeof db.query;

  globalThis.fetch = (async (request, init) => {
    const method = init?.method ?? 'GET';
    providerMethods.push(method);
    if (String(request).endsWith('/v1/billing/authorizations/issue') && method === 'POST') {
      return Response.json({ billingKey: rawBillingKey, customerKey });
    }
    throw new Error(`Unexpected provider call: ${method}`);
  }) as typeof fetch;

  const activation = await activateTossBilling({
    userId: 'user_stale_reclaim',
    authKey: 'auth_stale_reclaim',
    customerKey,
    plan: 'monthly',
    checkoutTokenHash: 'checkout_stale_reclaim',
  });

  assert.equal(activation.status, 'trialing');
  assert.deepEqual(providerMethods, ['POST']);
  assert.match(reclaimSql, /activated_intent AS/);
  assert.match(reclaimSql, /retired_intent AS/);
  assert.match(reclaimSql, /WHEN old\.billing_key_fingerprint = \$9 THEN 'cleaned'/);
  assert.match(reclaimSql, /ELSE 'cleanup_pending'/);
  assert.match(reclaimSql, /old\.id <> activated_intent\.id/);
  assert.match(reclaimSql, /sibling\.agreement_id = candidate\.agreement_id/);
  assert.match(reclaimSql, /sibling\.billing_key_fingerprint = candidate\.billing_key_fingerprint/);
  assert.match(reclaimSql, /sibling\.status = 'cleaned'/);
});
