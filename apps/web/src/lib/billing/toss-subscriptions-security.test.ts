import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import db from '@/lib/db';
import {
  activateTossBilling,
  cleanupTossBillingSessions,
  prepareTossBilling,
  processTossBillingKeyIntents,
} from './toss-subscriptions';
import { encryptTossBillingKey, TossBillingError } from './toss';

const tossEnvironment: Record<string, string> = {
  TOSS_BILLING_ENABLED: 'true',
  TOSS_BILLING_TEST_OVERRIDE: 'true',
  NEXT_PUBLIC_TOSS_CLIENT_KEY: 'test_ck_security',
  TOSS_SECRET_KEY: 'test_sk_security',
  TOSS_BILLING_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  TOSS_BILLING_CRON_TOKEN: 'security-test-cron-token-000000000000',
  TOSS_MONTHLY_AMOUNT_KRW: '1400',
  TOSS_ANNUAL_AMOUNT_KRW: '14000',
};

function configureTossEnvironment(context: TestContext) {
  const previous = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(tossEnvironment)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }
  context.after(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test('Toss prepare rejects the bounded eleventh request before session mutation', async (context) => {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const calls: string[] = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string) => {
    calls.push(text);
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: 'girapphe_customer', trial_consumed_at: null }] };
    }
    if (text.includes('INSERT INTO toss_prepare_rate_limits')) return { rows: [] };
    throw new Error(`Unexpected query after rate rejection: ${text}`);
  }) as typeof db.query;

  await assert.rejects(
    prepareTossBilling('user_rate_limited', 'monthly'),
    (error: unknown) => error instanceof TossBillingError
      && error.code === 'TOSS_PREPARE_RATE_LIMITED',
  );

  assert.equal(calls.length, 2);
  assert.match(calls[1], /ON CONFLICT \(user_id\) DO UPDATE/);
  assert.match(calls[1], /request_count < 10/);
  assert.match(calls[1], /INTERVAL '10 minutes'/);
  assert.match(calls[1], /RETURNING user_id/);
  assert.match(calls[1], /INSERT INTO toss_billing_sessions/);
  assert.match(calls[1], /ON CONFLICT \(user_id\) WHERE status = 'pending' DO UPDATE SET/);
  assert.equal(calls.some((query) => query.includes('DELETE FROM toss_billing_sessions')), false);
});

test('Toss prepare atomically consumes one rate slot and replaces the pending session', async (context) => {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: 'girapphe_customer', trial_consumed_at: null }] };
    }
    if (text.includes('INSERT INTO toss_prepare_rate_limits')) {
      return { rows: [{ token_hash: 'created' }] };
    }
    throw new Error(`Unexpected query: ${text}`);
  }) as typeof db.query;

  const prepared = await prepareTossBilling('user_allowed', 'monthly');

  assert.equal(prepared.customerKey, 'girapphe_customer');
  assert.equal(prepared.amount, 1400);
  assert.equal(prepared.trialEligible, true);
  assert.equal(typeof prepared.checkoutState, 'string');
  assert.deepEqual(
    calls.map(({ text }) => {
      if (text.includes('INSERT INTO billing_customers')) return 'customer';
      if (text.includes('INSERT INTO toss_prepare_rate_limits')
        && text.includes('INSERT INTO toss_billing_sessions')) return 'rate+session';
      return 'unexpected';
    }),
    ['customer', 'rate+session'],
  );
  assert.match(calls[1].text, /token_hash = EXCLUDED\.token_hash/);
  assert.deepEqual(calls[1].params?.slice(0, 1), ['user_allowed']);
});

test('Toss session cleanup is batch-bounded and fences live processing sessions', async (context) => {
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  context.after(() => { db.query = originalQuery; });
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    return { rows: [{ token_hash: 'one' }, { token_hash: 'two' }] };
  }) as typeof db.query;

  const deleted = await cleanupTossBillingSessions(null, 50_000);

  assert.equal(deleted, 2);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.deepEqual(call.params, [null, 1_000]);
  assert.match(call.text, /status IN \('consumed', 'failed', 'abandoned'\)/);
  assert.match(call.text, /status = 'pending'/);
  assert.match(call.text, /LIMIT \$2/);
  assert.match(call.text, /FOR UPDATE SKIP LOCKED/);
  assert.match(call.text, /status = 'processing'[\s\S]*processing_started_at < NOW\(\) - INTERVAL '24 hours'/);
  assert.doesNotMatch(call.text, /status = 'processing'\s*\)/);
});

test('Toss key recovery quarantines issuance before provider idempotency can expire', async (context) => {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let providerCalled = false;
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string) => {
    calls.push(text);
    if (text.includes('WITH duplicate_candidates AS')) return { rows: [] };
    if (text.includes('WITH referenced_candidates AS')) return { rows: [] };
    if (text.includes('WITH expired AS')) return { rows: [{ id: 'expired-intent' }] };
    if (text.includes("WHERE status = 'issuing'") && text.includes('processing_token = $2')) {
      return { rows: [] };
    }
    if (text.includes("WHERE i.status = 'cleanup_pending'") && text.includes('processing_token = $2')) {
      return { rows: [] };
    }
    throw new Error(`Unexpected key-intent recovery query: ${text}`);
  }) as typeof db.query;
  globalThis.fetch = (async () => {
    providerCalled = true;
    throw new Error('expired issuance must not reach Toss');
  }) as typeof fetch;

  const result = await processTossBillingKeyIntents(5);

  assert.equal(result.quarantined, 1);
  assert.equal(result.recovered, 0);
  assert.equal(result.cleaned, 0);
  assert.equal(providerCalled, false);
  const quarantine = calls.find((text) => text.includes('WITH expired AS'));
  assert.ok(quarantine);
  assert.match(quarantine, /created_at < NOW\(\) - INTERVAL '14 days'/);
  assert.match(quarantine, /processing_started_at < NOW\(\) - INTERVAL '10 minutes'/);
  assert.match(quarantine, /status = 'manual_review'/);
  assert.match(quarantine, /auth_key_ciphertext = NULL/);
  assert.match(quarantine, /TOSS_BILLING_KEY_IDEMPOTENCY_EXPIRED/);
});

test('Toss key recovery repeats an uncertain issuance with its stored idempotency key', async (context) => {
  configureTossEnvironment(context);
  const encryptedAuthKey = await encryptTossBillingKey('auth_recovery_test');
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const databaseEvents: string[] = [];
  const providerCalls: Array<{ method: string; idempotencyKey: string | null }> = [];
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('WITH duplicate_candidates AS')) return { rows: [] };
    if (text.includes('WITH referenced_candidates AS')) return { rows: [] };
    if (text.includes('WITH expired AS')) return { rows: [] };
    if (text.includes("WHERE status = 'issuing'") && text.includes('processing_token = $2')) {
      databaseEvents.push('claim-issuing');
      assert.match(text, /created_at >= NOW\(\) - INTERVAL '14 days'/);
      return { rows: [{
        id: 'intent-recovery', agreement_id: 'agreement-recovery', user_id: 'user-recovery',
        customer_key: activationCustomerKey, plan: 'monthly',
        provider_idempotency_key: 'stored-idempotency-key',
        auth_key_ciphertext: encryptedAuthKey, billing_key_ciphertext: null,
        billing_key_fingerprint: null, status: 'issuing', processing_token: params?.[1],
      }] };
    }
    if (text.includes("status = 'cleanup_pending'") && text.includes('issue_attempt_count')) {
      databaseEvents.push('persist-key');
      return { rows: [{
        id: 'intent-recovery', agreement_id: 'agreement-recovery', user_id: 'user-recovery',
        customer_key: activationCustomerKey, plan: 'monthly',
        provider_idempotency_key: 'stored-idempotency-key', auth_key_ciphertext: null,
        billing_key_ciphertext: params?.[1], billing_key_fingerprint: params?.[2],
        status: 'cleanup_pending', processing_token: null,
      }] };
    }
    if (text.includes("WHERE i.status = 'cleanup_pending'") && text.includes('processing_token = $2')) {
      return { rows: [] };
    }
    throw new Error(`Unexpected issuing recovery query: ${text}`);
  }) as typeof db.query;
  globalThis.fetch = (async (request, init) => {
    const headers = new Headers(init?.headers);
    providerCalls.push({
      method: init?.method ?? 'GET',
      idempotencyKey: headers.get('Idempotency-Key'),
    });
    assert.equal(String(request), 'https://api.tosspayments.com/v1/billing/authorizations/issue');
    return Response.json({
      billingKey: 'billing_key_recovered',
      customerKey: activationCustomerKey,
    });
  }) as typeof fetch;

  const result = await processTossBillingKeyIntents(5);

  assert.equal(result.recovered, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(databaseEvents, ['claim-issuing', 'persist-key']);
  assert.deepEqual(providerCalls, [{ method: 'POST', idempotencyKey: 'stored-idempotency-key' }]);
});

test('Toss orphan cleanup rechecks references and retries a failed provider deletion', async (context) => {
  configureTossEnvironment(context);
  const encryptedBillingKey = await encryptTossBillingKey('billing_key_cleanup_retry');
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const providerMethods: string[] = [];
  const databaseEvents: string[] = [];
  let providerAttempt = 0;
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('WITH duplicate_candidates AS')) return { rows: [] };
    if (text.includes('WITH referenced_candidates AS')) return { rows: [] };
    if (text.includes('WITH expired AS')) return { rows: [] };
    if (text.includes("WHERE status = 'issuing'") && text.includes('processing_token = $2')) {
      return { rows: [] };
    }
    if (text.includes("WHERE i.status = 'cleanup_pending'") && text.includes('processing_token = $2')) {
      databaseEvents.push('claim-cleanup');
      return { rows: [{
        id: 'intent-cleanup', agreement_id: 'agreement-cleanup', user_id: 'user-cleanup',
        customer_key: activationCustomerKey, plan: 'monthly',
        provider_idempotency_key: 'cleanup-idempotency-key', auth_key_ciphertext: null,
        billing_key_ciphertext: encryptedBillingKey, billing_key_fingerprint: 'fingerprint-cleanup',
        status: 'cleanup_pending', processing_token: params?.[1],
      }] };
    }
    if (text.includes('SELECT i.billing_key_ciphertext')) {
      databaseEvents.push('fresh-reference-check');
      assert.match(text, /NOT EXISTS \([\s\S]*a\.billing_key_intent_id = i\.id/);
      assert.match(text, /current\.billing_key_fingerprint = i\.billing_key_fingerprint/);
      return { rows: [{ billing_key_ciphertext: encryptedBillingKey }] };
    }
    if (text.includes('cleanup_attempt_count = cleanup_attempt_count + 1')
      && text.includes('last_error_code = $3')) {
      databaseEvents.push('record-delete-failure');
      return { rows: [] };
    }
    if (text.includes("status = 'cleaned'") && text.includes('RETURNING i.id')) {
      databaseEvents.push('commit-cleaned');
      return { rows: [{ id: 'intent-cleanup' }] };
    }
    throw new Error(`Unexpected cleanup recovery query: ${text}`);
  }) as typeof db.query;

  globalThis.fetch = (async (_request, init) => {
    providerMethods.push(init?.method ?? 'GET');
    providerAttempt += 1;
    if (providerAttempt === 1) {
      return Response.json({ code: 'PROVIDER_TEMPORARY_ERROR' }, { status: 500 });
    }
    return Response.json({ code: 'NOT_FOUND_BILLING_KEY' }, { status: 404 });
  }) as typeof fetch;

  const failed = await processTossBillingKeyIntents(5);
  const retried = await processTossBillingKeyIntents(5);

  assert.equal(failed.failed, 1);
  assert.equal(failed.cleaned, 0);
  assert.equal(retried.failed, 0);
  assert.equal(retried.cleaned, 1);
  assert.deepEqual(providerMethods, ['DELETE', 'DELETE']);
  assert.deepEqual(databaseEvents, [
    'claim-cleanup', 'fresh-reference-check', 'record-delete-failure',
    'claim-cleanup', 'fresh-reference-check', 'commit-cleaned',
  ]);
});

const activationCustomerKey = 'girapphe_12345678-1234-1234-1234-123456789012';

function mockTossActivationPrelude(
  context: TestContext,
  claim: (text: string) => Promise<{ rows: unknown[] }>,
  preflightBlocked = false,
) {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const providerCalls: Array<{ method: string; url: string }> = [];
  const databaseCalls: string[] = [];
  const events: string[] = [];
  let intent: Record<string, unknown> | null = null;
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    databaseCalls.push(text);
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: activationCustomerKey, trial_consumed_at: null }] };
    }
    if (text.includes('SELECT status, plan, current_period_start::text')) return { rows: [] };
    if (text.includes('SELECT a.billing_key_ciphertext, a.billing_key_intent_id')) return { rows: [] };
    if (text.includes('SELECT EXISTS (') && text.includes('FROM billing_subscriptions')) {
      return { rows: [{ blocked: preflightBlocked }] };
    }
    if (text.includes('INSERT INTO toss_billing_key_intents')) {
      events.push('db:issuing');
      intent = {
        id: params?.[0],
        agreement_id: params?.[1],
        user_id: params?.[2],
        customer_key: params?.[3],
        plan: params?.[4],
        provider_idempotency_key: params?.[6],
        auth_key_ciphertext: params?.[7],
        billing_key_ciphertext: null,
        billing_key_fingerprint: null,
        status: 'issuing',
        processing_token: null,
      };
      return { rows: [intent] };
    }
    if (text.includes("status = 'cleanup_pending'") && text.includes('issue_attempt_count')) {
      events.push('db:cleanup_pending');
      intent = {
        ...intent,
        auth_key_ciphertext: null,
        billing_key_ciphertext: params?.[1],
        billing_key_fingerprint: params?.[2],
        status: 'cleanup_pending',
      };
      return { rows: [intent] };
    }
    if (text.includes('INSERT INTO toss_billing_agreements')) return claim(text);
    throw new Error(`Unexpected activation query: ${text}`);
  }) as typeof db.query;

  globalThis.fetch = (async (input, init) => {
    const method = init?.method ?? 'GET';
    const url = String(input);
    providerCalls.push({ method, url });
    if (url.endsWith('/v1/billing/authorizations/issue') && method === 'POST') {
      events.push('provider:issue');
      return Response.json({
        billingKey: 'billing_key_security_test',
        customerKey: activationCustomerKey,
      });
    }
    throw new Error(`Unexpected provider call: ${method} ${url}`);
  }) as typeof fetch;

  return { providerCalls, databaseCalls, events };
}

function activateSecurityTestUser() {
  return activateTossBilling({
    userId: 'user_activation_security_test',
    authKey: 'auth_activation_security_test',
    customerKey: activationCustomerKey,
    plan: 'monthly',
    checkoutTokenHash: 'checkout_token_hash_security_test',
  });
}

test('Toss activation atomically rejects a raced provider subscription and retains durable cleanup state', async (context) => {
  const { providerCalls, databaseCalls, events } = mockTossActivationPrelude(
    context,
    async (text) => {
      events.push('db:claim');
      assert.match(text, /FROM billing_subscriptions/);
      assert.match(text, /provider <> 'toss'/);
      assert.match(text, /status IN \('incomplete', 'past_due', 'paused', 'trialing', 'active'\)/);
      assert.match(text, /sibling\.agreement_id = candidate\.agreement_id/);
      assert.match(text, /sibling\.billing_key_fingerprint = candidate\.billing_key_fingerprint/);
      assert.match(text, /sibling\.status = 'cleaned'/);
      assert.match(text, /sibling\.processing_started_at >= NOW\(\) - INTERVAL '10 minutes'/);
      return { rows: [{ claimed: false, cross_provider_blocked: true }] };
    },
  );

  await assert.rejects(
    activateSecurityTestUser(),
    (error: unknown) => error instanceof TossBillingError
      && error.code === 'TOSS_SUBSCRIPTION_CONFLICT',
  );

  assert.equal(databaseCalls.some((text) => text.includes('UPDATE toss_billing_agreements a SET')), false);
  assert.deepEqual(providerCalls.map(({ method }) => method), ['POST']);
  assert.deepEqual(events, ['db:issuing', 'provider:issue', 'db:cleanup_pending', 'db:claim']);
  assert.equal(providerCalls.some(({ url, method }) => (
    method === 'POST' && url.includes('/v1/billing/billing_key_security_test')
  )), false, 'a conflicting subscription must never be charged');
});

test('Toss activation rejects an existing provider subscription before issuing a key', async (context) => {
  const { providerCalls, databaseCalls } = mockTossActivationPrelude(
    context,
    async () => { throw new Error('the atomic claim must not run'); },
    true,
  );

  await assert.rejects(
    activateSecurityTestUser(),
    (error: unknown) => error instanceof TossBillingError
      && error.code === 'TOSS_SUBSCRIPTION_CONFLICT',
  );
  assert.equal(databaseCalls.some((text) => text.includes('INSERT INTO toss_billing_agreements')), false);
  assert.deepEqual(providerCalls, []);
});

test('Toss activation durably records an issued key before an agreement write failure', async (context) => {
  const { providerCalls, events } = mockTossActivationPrelude(
    context,
    async () => {
      events.push('db:claim');
      throw new Error('simulated agreement persistence failure');
    },
  );

  await assert.rejects(activateSecurityTestUser(), /simulated agreement persistence failure/);
  assert.deepEqual(providerCalls.map(({ method }) => method), ['POST']);
  assert.deepEqual(events, ['db:issuing', 'provider:issue', 'db:cleanup_pending', 'db:claim']);
  assert.equal(providerCalls.some(({ url, method }) => (
    method === 'POST' && url.includes('/v1/billing/billing_key_security_test')
  )), false, 'a cleanup-pending key must never be charged');
});

test('Toss activation persistence failure logs neither the key nor provider URL', async (context) => {
  const originalConsoleError = console.error;
  const errors: unknown[][] = [];
  context.after(() => { console.error = originalConsoleError; });
  console.error = (...values: unknown[]) => { errors.push(values); };
  const { providerCalls } = mockTossActivationPrelude(
    context,
    async () => { throw new Error('simulated agreement persistence failure'); },
    false,
  );

  await assert.rejects(activateSecurityTestUser(), /simulated agreement persistence failure/);
  assert.deepEqual(providerCalls.map(({ method }) => method), ['POST']);
  assert.equal(providerCalls.some(({ url, method }) => (
    method === 'POST' && url.includes('/v1/billing/billing_key_security_test')
  )), false);
  assert.equal(JSON.stringify(errors).includes('billing_key_security_test'), false);
  assert.equal(JSON.stringify(errors).includes('api.tosspayments.com'), false);
});

test('Toss activation preserves the legitimate trial path when no other provider blocks it', async (context) => {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const providerCalls: Array<{ method: string; url: string }> = [];
  let agreementReads = 0;
  let intent: Record<string, unknown> | null = null;
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: activationCustomerKey, trial_consumed_at: null }] };
    }
    if (text.includes('SELECT status, plan, current_period_start::text')) {
      agreementReads += 1;
      return agreementReads === 1
        ? { rows: [] }
        : {
            rows: [{
              status: 'trialing',
              plan: 'monthly',
              current_period_start: '2030-01-01T00:00:00.000Z',
              current_period_end: '2099-01-01T00:00:00.000Z',
              cancel_at_period_end: false,
            }],
          };
    }
    if (text.includes('SELECT EXISTS (') && text.includes('FROM billing_subscriptions')) {
      return { rows: [{ blocked: false }] };
    }
    if (text.includes('SELECT a.billing_key_ciphertext, a.billing_key_intent_id')) return { rows: [] };
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
      assert.match(text, /cross_provider_blocking/);
      assert.match(text, /activated_intent AS/);
      assert.match(text, /status = 'live'/);
      return { rows: [{ claimed: true, cross_provider_blocked: false }] };
    }
    if (text.includes('FROM toss_billing_charges')) return { rows: [] };
    if (text.includes('WITH fenced AS')) {
      return { rows: [{ status: 'trialing', trial_claimed: true }] };
    }
    if (text.includes('INSERT INTO billing_subscriptions')) return { rows: [] };
    throw new Error(`Unexpected legitimate activation query: ${text}`);
  }) as typeof db.query;
  globalThis.fetch = (async (input, init) => {
    const method = init?.method ?? 'GET';
    const url = String(input);
    providerCalls.push({ method, url });
    if (url.endsWith('/v1/billing/authorizations/issue') && method === 'POST') {
      return Response.json({
        billingKey: 'billing_key_legitimate_test',
        customerKey: activationCustomerKey,
      });
    }
    throw new Error(`Unexpected legitimate provider call: ${method} ${url}`);
  }) as typeof fetch;

  const activation = await activateSecurityTestUser();
  assert.equal(activation.status, 'trialing');
  assert.deepEqual(providerCalls.map(({ method }) => method), ['POST']);
  assert.equal(providerCalls.some(({ url }) => url.includes('billing_key_legitimate_test')), false);
});

test('a same-authKey concurrent callback reuses the live intent and never deletes its key', async (context) => {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  const providerMethods: string[] = [];
  let agreementReads = 0;
  let intent: Record<string, unknown> | null = null;
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: activationCustomerKey, trial_consumed_at: null }] };
    }
    if (text.includes('SELECT status, plan, current_period_start::text')) {
      agreementReads += 1;
      return agreementReads === 1
        ? { rows: [] }
        : { rows: [{
            status: 'active', plan: 'monthly',
            current_period_start: '2030-01-01T00:00:00.000Z',
            current_period_end: '2099-01-01T00:00:00.000Z',
            cancel_at_period_end: false,
          }] };
    }
    if (text.includes('SELECT a.billing_key_ciphertext, a.billing_key_intent_id')) return { rows: [] };
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
    if (text.includes('INSERT INTO billing_subscriptions')) return { rows: [] };
    if (text.includes('UPDATE toss_billing_key_intents i SET')
      && text.includes('a.billing_key_intent_id = i.id')) return { rows: [] };
    throw new Error(`Unexpected concurrent activation query: ${text}`);
  }) as typeof db.query;

  globalThis.fetch = (async (request, init) => {
    const method = init?.method ?? 'GET';
    providerMethods.push(method);
    if (String(request).endsWith('/v1/billing/authorizations/issue') && method === 'POST') {
      return Response.json({
        billingKey: 'billing_key_same_auth',
        customerKey: activationCustomerKey,
      });
    }
    throw new Error(`Unexpected provider call: ${method}`);
  }) as typeof fetch;

  const activation = await activateSecurityTestUser();
  assert.equal(activation.status, 'active');
  assert.deepEqual(providerMethods, ['POST']);
});

test('a stale Toss agreement swaps intents atomically and retires the prior key by fingerprint', async (context) => {
  configureTossEnvironment(context);
  const originalQuery = db.query;
  const originalFetch = globalThis.fetch;
  let intent: Record<string, unknown> | null = null;
  let reclaimSql = '';
  context.after(() => {
    db.query = originalQuery;
    globalThis.fetch = originalFetch;
  });

  db.query = (async (text: string, params?: unknown[]) => {
    if (text.includes('INSERT INTO billing_customers')) {
      return { rows: [{ toss_customer_key: activationCustomerKey, trial_consumed_at: null }] };
    }
    if (text.includes('SELECT status, plan, current_period_start::text')) return { rows: [] };
    if (text.includes('SELECT a.billing_key_ciphertext, a.billing_key_intent_id')) return { rows: [] };
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
    if (text.includes('UPDATE toss_billing_agreements a SET') && text.includes('retired_intent AS')) {
      reclaimSql = text;
      return { rows: [{ id: 'stale-agreement', previous_intent_id: 'old-intent' }] };
    }
    if (text.includes('FROM toss_billing_charges')) {
      throw new Error('stop-after-stale-reclaim');
    }
    throw new Error(`Unexpected stale reclaim query: ${text}`);
  }) as typeof db.query;
  globalThis.fetch = (async () => Response.json({
    billingKey: 'billing_key_stale_reclaim',
    customerKey: activationCustomerKey,
  })) as typeof fetch;

  await assert.rejects(activateSecurityTestUser(), /stop-after-stale-reclaim/);

  assert.match(reclaimSql, /billing_key_intent_id = \$8/);
  assert.match(reclaimSql, /activated_intent AS/);
  assert.match(reclaimSql, /retired_intent AS/);
  assert.match(reclaimSql, /WHEN old\.billing_key_fingerprint = \$9 THEN 'cleaned'/);
  assert.match(reclaimSql, /ELSE 'cleanup_pending'/);
  assert.match(reclaimSql, /WHEN old\.billing_key_fingerprint = \$9 THEN NULL/);
  assert.match(reclaimSql, /old\.id <> activated_intent\.id/);
  assert.match(reclaimSql, /sibling\.agreement_id = candidate\.agreement_id/);
  assert.match(reclaimSql, /sibling\.status = 'cleaned'/);
});
