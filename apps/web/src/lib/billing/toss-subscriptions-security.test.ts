import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import db from '@/lib/db';
import {
  cleanupTossBillingSessions,
  prepareTossBilling,
} from './toss-subscriptions';
import { TossBillingError } from './toss';

const tossEnvironment: Record<string, string> = {
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
