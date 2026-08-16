import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTossBillingPeriod,
  createTossCheckoutState,
  createTossOrderId,
  decryptTossBillingKey,
  deleteTossBillingKey,
  encryptTossBillingKey,
  isTossCheckoutState,
} from './toss';

function setTestTossEnvironment() {
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = 'test_ck_example';
  process.env.TOSS_SECRET_KEY = 'test_sk_example';
  process.env.TOSS_BILLING_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.TOSS_MONTHLY_AMOUNT_KRW = '1400';
  process.env.TOSS_ANNUAL_AMOUNT_KRW = '14000';
  process.env.TOSS_BILLING_CRON_TOKEN = 'test-token-that-is-longer-than-thirty-two-characters';
}

test('keeps month-end billing periods on a valid UTC calendar day', () => {
  assert.equal(
    addTossBillingPeriod(new Date('2026-01-31T09:30:00.000Z'), 'monthly').toISOString(),
    '2026-02-28T09:30:00.000Z',
  );
  assert.equal(
    addTossBillingPeriod(new Date('2024-02-29T09:30:00.000Z'), 'annual').toISOString(),
    '2025-02-28T09:30:00.000Z',
  );
});

test('derives a stable order id per persisted billing cycle', async () => {
  const first = await createTossOrderId('agreement_1', 'renewal:2026-08-16T00:00:00.000Z');
  const retry = await createTossOrderId('agreement_1', 'renewal:2026-08-16T00:00:00.000Z');
  const nextCycle = await createTossOrderId('agreement_1', 'renewal:2026-09-16T00:00:00.000Z');
  assert.equal(first, retry);
  assert.notEqual(first, nextCycle);
  assert.match(first, /^girapphe_[a-f0-9]{40}$/);
});

test('creates a one-time checkout state with a strict wire format', () => {
  const first = createTossCheckoutState();
  const second = createTossCheckoutState();
  assert.equal(isTossCheckoutState(first), true);
  assert.equal(isTossCheckoutState(second), true);
  assert.notEqual(first, second);
  assert.equal(isTossCheckoutState(`${first}0`), false);
  assert.equal(isTossCheckoutState(first.toUpperCase()), false);
});

test('encrypts stored billing keys with authenticated AES-GCM', async () => {
  const previous = {
    client: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    secret: process.env.TOSS_SECRET_KEY,
    encryption: process.env.TOSS_BILLING_ENCRYPTION_KEY,
    monthly: process.env.TOSS_MONTHLY_AMOUNT_KRW,
    annual: process.env.TOSS_ANNUAL_AMOUNT_KRW,
    cron: process.env.TOSS_BILLING_CRON_TOKEN,
  };
  setTestTossEnvironment();

  try {
    const encrypted = await encryptTossBillingKey('billing-key-that-must-not-be-stored-in-plain-text');
    assert.match(encrypted, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(
      await decryptTossBillingKey(encrypted),
      'billing-key-that-must-not-be-stored-in-plain-text',
    );
    const [version, iv, encodedCiphertext] = encrypted.split('.');
    const tamperedBytes = Buffer.from(encodedCiphertext, 'base64url');
    tamperedBytes[0] ^= 0x80;
    const tampered = `${version}.${iv}.${tamperedBytes.toString('base64url')}`;
    await assert.rejects(decryptTossBillingKey(tampered), /could not be decrypted/);
  } finally {
    const entries: Array<[string, string | undefined]> = [
      ['NEXT_PUBLIC_TOSS_CLIENT_KEY', previous.client],
      ['TOSS_SECRET_KEY', previous.secret],
      ['TOSS_BILLING_ENCRYPTION_KEY', previous.encryption],
      ['TOSS_MONTHLY_AMOUNT_KRW', previous.monthly],
      ['TOSS_ANNUAL_AMOUNT_KRW', previous.annual],
      ['TOSS_BILLING_CRON_TOKEN', previous.cron],
    ];
    for (const [name, value] of entries) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('accepts Toss billing-key deletion with an empty successful response', async () => {
  const previousFetch = globalThis.fetch;
  const previous = {
    client: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    secret: process.env.TOSS_SECRET_KEY,
    encryption: process.env.TOSS_BILLING_ENCRYPTION_KEY,
    monthly: process.env.TOSS_MONTHLY_AMOUNT_KRW,
    annual: process.env.TOSS_ANNUAL_AMOUNT_KRW,
    cron: process.env.TOSS_BILLING_CRON_TOKEN,
  };
  setTestTossEnvironment();
  globalThis.fetch = async () => new Response(null, { status: 200 });

  try {
    await assert.doesNotReject(deleteTossBillingKey('billing-key-to-delete'));
  } finally {
    globalThis.fetch = previousFetch;
    const entries: Array<[string, string | undefined]> = [
      ['NEXT_PUBLIC_TOSS_CLIENT_KEY', previous.client],
      ['TOSS_SECRET_KEY', previous.secret],
      ['TOSS_BILLING_ENCRYPTION_KEY', previous.encryption],
      ['TOSS_MONTHLY_AMOUNT_KRW', previous.monthly],
      ['TOSS_ANNUAL_AMOUNT_KRW', previous.annual],
      ['TOSS_BILLING_CRON_TOKEN', previous.cron],
    ];
    for (const [name, value] of entries) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
