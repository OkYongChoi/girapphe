import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assertCreemAnnualProduct,
  assertCreemDeletionSubscriptionIdentity,
  CreemProviderRequestError,
  creemAdverseTransactionAccessDecision,
  creemCheckoutDisposition,
  creemEventMayUpdateLifecycle,
  creemRefundAccessDecision,
  creemStatusForEvent,
  creemSubscriptionRenewalIsStopped,
  creemTransactionIsFullRefund,
  creemVerifiedPeriod,
  fullCreemRefundRevokesCurrentAccess,
  isCreemAcquisitionEnabled,
  isCreemEventInScope,
  isCreemLifecycleConfigured,
  parseCreemEvent,
  parseCreemCustomerSubscriptionsPage,
  selectCreemLifecycleSubscription,
  verifiedCreemCheckoutCompletion,
  verifiedCreemPaidPeriod,
} from './creem';
import { requestHasTrustedOrigin } from './request-security';

const CREEM_ENV_KEYS = [
  'APP_BASE_URL',
  'DATABASE_URL',
  'CREEM_API_KEY',
  'CREEM_WEBHOOK_SECRET',
  'CREEM_ANNUAL_PRODUCT_ID',
  'CREEM_ENVIRONMENT',
  'WEB_BILLING_ACQUISITION_ENABLED',
] as const;

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function assertOrdered(haystack: string, labels: string[]) {
  let previous = -1;
  for (const label of labels) {
    const position = haystack.indexOf(label, previous + 1);
    assert.ok(position > previous, `${label} must follow the previous billing operation`);
    previous = position;
  }
}

function withCreemEnvironment(
  values: Partial<Record<(typeof CREEM_ENV_KEYS)[number], string>>,
  assertion: () => void,
) {
  const previous = Object.fromEntries(CREEM_ENV_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of CREEM_ENV_KEYS) delete process.env[key];
    Object.assign(process.env, values);
    assertion();
  } finally {
    for (const key of CREEM_ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('accepts only the configured annual USD 10 tax-inclusive Creem product', () => {
  const valid = {
    id: 'prod_plus_annual',
    price: 1_000,
    currency: 'USD',
    billing_type: 'recurring',
    billing_period: 'every-year',
    tax_mode: 'inclusive',
    status: 'active',
  };
  assert.doesNotThrow(() => assertCreemAnnualProduct(valid, 'prod_plus_annual'));
  for (const invalid of [
    { ...valid, price: 100 },
    { ...valid, billing_period: 'every-month' },
    { ...valid, tax_mode: 'exclusive' },
    { ...valid, status: 'archived' },
  ]) {
    assert.throws(() => assertCreemAnnualProduct(invalid, 'prod_plus_annual'));
  }
});

test('parses documented Creem events and keeps test and production separate', () => {
  const event = parseCreemEvent({
    id: 'evt_one',
    eventType: 'subscription.paid',
    created_at: Date.parse('2030-01-01T00:00:00.000Z'),
    object: { id: 'sub_one', mode: 'test' },
  });
  assert.ok(event);
  assert.equal(isCreemEventInScope(event, 'test'), true);
  assert.equal(isCreemEventInScope(event, 'production'), false);
  assert.equal(parseCreemEvent({ eventType: 'subscription.paid', object: {} }), null);
});

test('full refund only revokes a subscription whose authoritative state is terminal', () => {
  const fullRefund = { status: 'refunded', amount_paid: 1_000, refunded_amount: 1_000 };
  const partialRefund = { status: 'refunded', amount_paid: 1_000, refunded_amount: 250 };
  assert.equal(creemTransactionIsFullRefund(fullRefund), true);
  assert.equal(creemTransactionIsFullRefund(partialRefund), false);
  assert.equal(fullCreemRefundRevokesCurrentAccess(fullRefund, { status: 'active' }), false);
  assert.equal(fullCreemRefundRevokesCurrentAccess(fullRefund, { status: 'scheduled_cancel' }), false);
  assert.equal(fullCreemRefundRevokesCurrentAccess(fullRefund, { status: 'canceled' }), true);
  assert.equal(fullCreemRefundRevokesCurrentAccess(fullRefund, { status: 'expired' }), true);
  assert.equal(fullCreemRefundRevokesCurrentAccess(partialRefund, { status: 'canceled' }), false);
});

test('current-period full refund revokes while an older renewal refund retains access', () => {
  const fullRefund = {
    status: 'refunded', amount_paid: 1_000, refunded_amount: 1_000,
    period_start: Date.parse('2030-01-01T00:00:00.000Z'),
    period_end: Date.parse('2031-01-01T00:00:00.000Z'),
  };
  const current = {
    status: 'active',
    current_period_start_date: '2030-01-01T00:00:00.000Z',
    current_period_end_date: '2031-01-01T00:00:00.000Z',
  };
  assert.equal(creemRefundAccessDecision(fullRefund, current), 'revoke');
  assert.equal(creemRefundAccessDecision({
    ...fullRefund,
    period_start: Date.parse('2029-01-01T00:00:00.000Z'),
    period_end: Date.parse('2030-01-01T00:00:00.000Z'),
  }, current), 'retain');
  assert.equal(creemRefundAccessDecision({
    status: 'refunded', amount_paid: 1_000, refunded_amount: 1_000,
  }, current), 'indeterminate');
});

test('refunds and disputes revoke only the matching verified paid period', () => {
  const currentStart = new Date('2030-01-01T00:00:00.000Z');
  const currentEnd = new Date('2031-01-01T00:00:00.000Z');
  const transaction = {
    status: 'chargeback',
    amount_paid: 1_000,
    refunded_amount: 1_000,
    period_start: Date.parse('2030-01-01T00:00:00.000Z'),
    period_end: Date.parse('2031-01-01T00:00:00.000Z'),
  };
  assert.equal(creemAdverseTransactionAccessDecision({
    kind: 'dispute', transaction,
    verifiedPeriodStart: currentStart, verifiedPeriodEnd: currentEnd,
  }), 'revoke');
  assert.equal(creemAdverseTransactionAccessDecision({
    kind: 'dispute',
    transaction: {
      ...transaction,
      period_start: Date.parse('2029-01-01T00:00:00.000Z'),
      period_end: Date.parse('2030-01-01T00:00:00.000Z'),
    },
    verifiedPeriodStart: currentStart, verifiedPeriodEnd: currentEnd,
  }), 'retain');
  assert.equal(creemAdverseTransactionAccessDecision({
    kind: 'refund',
    transaction: { ...transaction, status: 'refunded', refunded_amount: 250 },
    verifiedPeriodStart: currentStart, verifiedPeriodEnd: currentEnd,
  }), 'retain');
  assert.equal(creemAdverseTransactionAccessDecision({
    kind: 'dispute', transaction: { ...transaction, status: 'pending' },
    verifiedPeriodStart: currentStart, verifiedPeriodEnd: currentEnd,
  }), 'indeterminate');
});

test('Creem activation requires paid and expired retry state uses fixed grace path', () => {
  const active = { status: 'active' };
  assert.equal(creemStatusForEvent({
    subscription: active, eventType: 'subscription.active',
    previouslyPaid: false,
  }), 'incomplete');
  assert.equal(creemStatusForEvent({
    subscription: active, eventType: 'subscription.paid',
    previouslyPaid: false, paymentVerified: true,
  }), 'active');
  assert.equal(creemStatusForEvent({
    subscription: active, eventType: 'subscription.expired',
    previouslyPaid: true,
  }), 'past_due');
  assert.equal(creemStatusForEvent({
    subscription: active, eventType: 'subscription.past_due',
    previouslyPaid: true, periodAdvanced: true,
  }), 'past_due');
  assert.equal(creemStatusForEvent({
    subscription: active, eventType: 'subscription.active',
    previouslyPaid: true, periodAdvanced: true,
  }), 'past_due');
  assert.equal(creemStatusForEvent({
    subscription: { status: 'scheduled_cancel' }, eventType: 'subscription.scheduled_cancel',
    previouslyPaid: false,
  }), 'incomplete');
  assert.equal(creemStatusForEvent({
    subscription: { status: 'scheduled_cancel' }, eventType: 'subscription.scheduled_cancel',
    previouslyPaid: true,
  }), 'canceled');
  assert.equal(creemStatusForEvent({
    subscription: { status: 'scheduled_cancel' }, eventType: 'subscription.paid',
    previouslyPaid: false, paymentVerified: true,
  }), 'canceled');
  assert.equal(creemStatusForEvent({
    subscription: { status: 'trialing' }, eventType: 'subscription.trialing',
    previouslyPaid: false,
  }), 'incomplete');
  assert.throws(() => creemStatusForEvent({
    subscription: {}, eventType: 'subscription.updated', previouslyPaid: true,
  }), /unknown lifecycle status/);
  assert.throws(() => creemStatusForEvent({
    subscription: { status: 'future_status' }, eventType: 'subscription.updated', previouslyPaid: true,
  }), /unknown lifecycle status/);
});

test('Creem event and resource clocks cannot roll a newer lifecycle backward', () => {
  const storedAt = new Date('2030-02-01T00:00:00.000Z');
  const staleAt = new Date('2030-01-01T00:00:00.000Z');
  const newerAt = new Date('2030-03-01T00:00:00.000Z');
  const base = {
    existingProviderEventAt: storedAt,
    existingProviderResourceUpdatedAt: staleAt,
    existingStatus: 'past_due' as const,
    existingCancelAtPeriodEnd: false,
    eventCreatedAt: staleAt,
    providerUpdatedAt: staleAt,
    eventEnvelopeMayDriveLifecycle: true,
    hasAuthoritativeAdverseProof: false,
    hasPaidPeriodProof: false,
    paidPeriodStrictlyAdvancesStoredBoundary: false,
  };

  assert.equal(creemEventMayUpdateLifecycle(base), false);
  assert.equal(creemEventMayUpdateLifecycle({ ...base, eventCreatedAt: storedAt }), false);
  assert.equal(creemEventMayUpdateLifecycle({ ...base, providerUpdatedAt: newerAt }), true);
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    hasPaidPeriodProof: true,
  }), false, 'same-period delayed paid proof preserves the newer failure state');
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    hasPaidPeriodProof: true,
    paidPeriodStrictlyAdvancesStoredBoundary: true,
  }), true, 'a delayed paid transaction may prove a genuinely newer paid period');
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    hasAuthoritativeAdverseProof: true,
  }), true, 'a verified current-period refund or dispute is authoritative');
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    existingStatus: 'incomplete',
    hasPaidPeriodProof: true,
  }), true, 'delayed payment evidence may replace an unverified nominal period');
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    eventCreatedAt: new Date('2030-01-15T00:00:00.000Z'),
    providerUpdatedAt: new Date('2030-01-20T00:00:00.000Z'),
    existingProviderResourceUpdatedAt: new Date('2030-01-01T00:00:00.000Z'),
  }), true, 'the resource clock advances independently of a newer envelope clock');
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    eventCreatedAt: newerAt,
    eventEnvelopeMayDriveLifecycle: false,
  }), false, 'a historical refund envelope cannot authorize a stale lifecycle snapshot');
});

test('a fresher signed Creem lifecycle snapshot wins over a lagging GET', () => {
  const fetched = {
    id: 'sub_one',
    object: 'subscription',
    product: { id: 'prod_plus_annual' },
    customer: { id: 'cust_one' },
    mode: 'test',
    status: 'active',
    updated_at: '2030-01-01T00:00:00.000Z',
  };
  for (const [eventType, status] of [
    ['subscription.canceled', 'canceled'],
    ['subscription.scheduled_cancel', 'scheduled_cancel'],
    ['subscription.paused', 'paused'],
  ] as const) {
    const eventSubscription = {
      ...fetched,
      status,
      updated_at: '2030-01-02T00:00:00.000Z',
    };
    assert.equal(selectCreemLifecycleSubscription({
      event: {
        id: `evt_${status}`,
        type: eventType,
        createdAt: new Date('2030-01-02T00:00:01.000Z'),
        object: eventSubscription,
      },
      authoritativeSubscription: fetched,
      expectedSubscriptionId: 'sub_one',
      expectedProductId: 'prod_plus_annual',
      environment: 'test',
    }), eventSubscription);
  }
});

test('Creem lifecycle selection rejects stale or mismatched event resources', () => {
  const fetched = {
    id: 'sub_one', object: 'subscription', product: 'prod_plus_annual',
    customer: 'cust_one', mode: 'test', status: 'canceled',
    updated_at: '2030-01-03T00:00:00.000Z',
  };
  const event = {
    id: 'evt_active', type: 'subscription.active',
    createdAt: new Date('2030-01-02T00:00:01.000Z'),
    object: { ...fetched, status: 'active', updated_at: '2030-01-02T00:00:00.000Z' },
  };
  assert.equal(selectCreemLifecycleSubscription({
    event,
    authoritativeSubscription: fetched,
    expectedSubscriptionId: 'sub_one',
    expectedProductId: 'prod_plus_annual',
    environment: 'test',
  }), fetched);
  assert.throws(() => selectCreemLifecycleSubscription({
    event: { ...event, object: { ...event.object, customer: 'cust_other' } },
    authoritativeSubscription: fetched,
    expectedSubscriptionId: 'sub_one',
    expectedProductId: 'prod_plus_annual',
    environment: 'test',
  }), CreemProviderRequestError);
});

test('terminal Creem revocations reopen only for a strictly newer paid period', () => {
  const base = {
    existingProviderEventAt: new Date('2030-01-01T00:00:00.000Z'),
    existingProviderResourceUpdatedAt: new Date('2030-01-01T00:00:00.000Z'),
    existingStatus: 'refunded' as const,
    existingCancelAtPeriodEnd: false,
    eventCreatedAt: new Date('2030-02-01T00:00:00.000Z'),
    providerUpdatedAt: new Date('2030-02-01T00:00:00.000Z'),
    eventEnvelopeMayDriveLifecycle: true,
    hasAuthoritativeAdverseProof: false,
    hasPaidPeriodProof: false,
    paidPeriodStrictlyAdvancesStoredBoundary: false,
  };
  assert.equal(creemEventMayUpdateLifecycle(base), false);
  assert.equal(creemEventMayUpdateLifecycle({ ...base, existingStatus: 'canceled' }), false);
  assert.equal(creemEventMayUpdateLifecycle({
    ...base,
    hasPaidPeriodProof: true,
    paidPeriodStrictlyAdvancesStoredBoundary: true,
  }), true);
});

test('only a paid event advances the canonical Creem paid-period boundary', () => {
  const oldStart = new Date('2030-01-01T00:00:00.000Z');
  const oldEnd = new Date('2031-01-01T00:00:00.000Z');
  const reportedStart = new Date('2031-01-01T00:00:00.000Z');
  const reportedEnd = new Date('2032-01-01T00:00:00.000Z');

  assert.deepEqual(creemVerifiedPeriod({
    hasExistingSubscription: false,
    reportedStart,
    reportedEnd,
    existingStart: null,
    existingEnd: null,
  }), { start: reportedStart, end: reportedEnd });
  assert.deepEqual(creemVerifiedPeriod({
    hasExistingSubscription: true,
    reportedStart,
    reportedEnd,
    existingStart: oldStart,
    existingEnd: oldEnd,
  }), { start: oldStart, end: oldEnd });
  assert.deepEqual(creemVerifiedPeriod({
    hasExistingSubscription: true,
    paidPeriod: { start: reportedStart, end: reportedEnd },
    reportedStart,
    reportedEnd,
    existingStart: oldStart,
    existingEnd: oldEnd,
  }), { start: reportedStart, end: reportedEnd });
  assert.deepEqual(creemVerifiedPeriod({
    hasExistingSubscription: true,
    paidPeriod: { start: oldStart, end: oldEnd },
    reportedStart,
    reportedEnd,
    existingStart: reportedStart,
    existingEnd: reportedEnd,
  }), { start: oldStart, end: oldEnd });
  assert.deepEqual(creemVerifiedPeriod({
    hasExistingSubscription: true,
    existingPeriodVerified: true,
    paidPeriod: { start: oldStart, end: oldEnd },
    reportedStart,
    reportedEnd,
    existingStart: reportedStart,
    existingEnd: reportedEnd,
  }), { start: reportedStart, end: reportedEnd });
});

test('a signed paid event advances access only through its matching authoritative transaction', () => {
  const eventSubscription = {
    id: 'sub_one',
    product: { id: 'prod_plus_annual' },
    customer: { id: 'cust_one' },
    last_transaction_id: 'tran_one',
    current_period_start_date: '2030-01-01T00:00:00.000Z',
    current_period_end_date: '2031-01-01T00:00:00.000Z',
  };
  const transaction = {
    id: 'tran_one',
    mode: 'test',
    type: 'invoice',
    status: 'paid',
    amount: 1_000,
    amount_paid: 1_000,
    refunded_amount: 0,
    currency: 'USD',
    subscription: 'sub_one',
    customer: 'cust_one',
    period_start: Date.parse('2030-01-01T00:00:00.000Z'),
    period_end: Date.parse('2031-01-01T00:00:00.000Z'),
  };
  assert.deepEqual(verifiedCreemPaidPeriod({
    eventSubscription,
    transaction,
    expectedSubscriptionId: 'sub_one',
    expectedProductId: 'prod_plus_annual',
    environment: 'test',
  }), {
    start: new Date('2030-01-01T00:00:00.000Z'),
    end: new Date('2031-01-01T00:00:00.000Z'),
  });
  for (const invalid of [
    { ...transaction, status: 'refunded' },
    { ...transaction, id: 'tran_later' },
    { ...transaction, subscription: 'sub_other' },
    { ...transaction, period_end: Date.parse('2032-01-01T00:00:00.000Z') },
    { ...transaction, amount_paid: 999 },
  ]) {
    assert.throws(() => verifiedCreemPaidPeriod({
      eventSubscription,
      transaction: invalid,
      expectedSubscriptionId: 'sub_one',
      expectedProductId: 'prod_plus_annual',
      environment: 'test',
    }), /authoritative paid annual transaction/);
  }
});

test('an unresolved Creem checkout is reused only after authoritative identity and status checks', () => {
  const expected = {
    attemptId: 'attempt_one',
    checkoutId: 'chk_one',
    productId: 'prod_plus_annual',
  };
  const checkout = {
    id: 'chk_one',
    request_id: 'attempt_one',
    product: { id: 'prod_plus_annual' },
    status: 'pending',
    checkout_url: 'https://checkout.creem.io/chk_one',
    customer: { id: 'cust_one' },
  };
  assert.deepEqual(creemCheckoutDisposition(checkout, expected), {
    kind: 'open',
    checkoutUrl: 'https://checkout.creem.io/chk_one',
    customerId: 'cust_one',
    subscriptionId: null,
  });
  assert.equal(creemCheckoutDisposition({ ...checkout, status: 'expired' }, expected).kind, 'expired');
  assert.equal(creemCheckoutDisposition({
    ...checkout,
    status: 'completed',
    subscription: { id: 'sub_one' },
  }, expected).kind, 'completed');
  assert.throws(
    () => creemCheckoutDisposition({ ...checkout, request_id: 'other_attempt' }, expected),
    /mismatched identifiers/,
  );
  assert.throws(
    () => creemCheckoutDisposition({ ...checkout, checkout_url: 'https://attacker.example' }, expected),
    /trusted URL/,
  );
});

test('checkout completion verifies the exact paid annual order and server-owned attempt', () => {
  const checkout = {
    id: 'chk_one',
    object: 'checkout',
    request_id: 'attempt_one',
    mode: 'test',
    status: 'completed',
    units: 1,
    metadata: {
      checkoutAttemptId: 'attempt_one',
      clerkUserId: 'user_owner',
      entitlement: 'ad_free',
      plan: 'annual',
    },
    customer: { id: 'cust_one' },
    product: {
      id: 'prod_plus_annual',
      price: 1_000,
      currency: 'USD',
      billing_type: 'recurring',
      billing_period: 'every-year',
      tax_mode: 'inclusive',
      status: 'active',
    },
    order: {
      id: 'ord_one',
      mode: 'test',
      customer: 'cust_one',
      product: 'prod_plus_annual',
      amount: 1_000,
      currency: 'USD',
      status: 'paid',
      type: 'recurring',
    },
    subscription: {
      id: 'sub_one',
      object: 'subscription',
      mode: 'test',
      customer: 'cust_one',
      product: 'prod_plus_annual',
      status: 'active',
    },
  };
  const input = {
    checkout,
    attempt: {
      id: 'attempt_one',
      userId: 'user_owner',
      provider: 'creem' as const,
      environment: 'test' as const,
      plan: 'annual' as const,
      productId: 'prod_plus_annual',
      providerCustomerId: null,
      providerCheckoutId: null,
    },
    environment: 'test' as const,
    productId: 'prod_plus_annual',
  };
  assert.deepEqual(verifiedCreemCheckoutCompletion(input), {
    checkoutId: 'chk_one',
    customerId: 'cust_one',
    subscriptionId: 'sub_one',
  });
  for (const invalidCheckout of [
    { ...checkout, status: 'processing' },
    { ...checkout, units: 2 },
    { ...checkout, metadata: { ...checkout.metadata, clerkUserId: 'user_other' } },
    { ...checkout, order: { ...checkout.order, status: 'pending' } },
    { ...checkout, order: { ...checkout.order, amount: 999 } },
    { ...checkout, subscription: { ...checkout.subscription, customer: 'cust_other' } },
  ]) {
    assert.throws(() => verifiedCreemCheckoutCompletion({
      ...input,
      checkout: invalidCheckout,
    }), CreemProviderRequestError);
  }
});

test('account deletion accepts only authoritative non-renewing Creem states', () => {
  assert.equal(creemSubscriptionRenewalIsStopped({ status: 'scheduled_cancel' }), true);
  assert.equal(creemSubscriptionRenewalIsStopped({ status: 'canceled' }), true);
  assert.equal(creemSubscriptionRenewalIsStopped({ cancel_at_period_end: true }), true);
  assert.equal(creemSubscriptionRenewalIsStopped({ status: 'active' }), false);
});

test('account deletion rejects malformed pages and foreign subscriptions before cancellation', () => {
  const subscription = {
    id: 'sub_one',
    object: 'subscription',
    mode: 'test',
    status: 'active',
    customer: { id: 'cust_owner' },
    product: { id: 'prod_plus_annual' },
  };
  assert.deepEqual(parseCreemCustomerSubscriptionsPage({
    response: {
      items: [subscription],
      pagination: { total_pages: 1, current_page: 1 },
    },
    customerId: 'cust_owner',
    environment: 'test',
    page: 1,
  }), { items: [subscription], totalPages: 1 });
  for (const response of [
    { items: [subscription] },
    { items: [subscription, 'malformed'], pagination: { total_pages: 1, current_page: 1 } },
    { items: [{ ...subscription, customer: { id: 'cust_other' } }], pagination: { total_pages: 1, current_page: 1 } },
    { items: [subscription], pagination: { total_pages: 2, current_page: 2 } },
  ]) {
    assert.throws(() => parseCreemCustomerSubscriptionsPage({
      response,
      customerId: 'cust_owner',
      environment: 'test',
      page: 1,
    }), CreemProviderRequestError);
  }
  assert.doesNotThrow(() => assertCreemDeletionSubscriptionIdentity({
    subscription,
    subscriptionId: 'sub_one',
    customerId: 'cust_owner',
    productId: 'prod_plus_annual',
    environment: 'test',
  }));
  assert.throws(() => assertCreemDeletionSubscriptionIdentity({
    subscription: { ...subscription, customer: { id: 'cust_other' } },
    subscriptionId: 'sub_one',
    customerId: 'cust_owner',
    productId: 'prod_plus_annual',
    environment: 'test',
  }), /owned annual subscription/);

  const implementation = source('./creem.ts');
  const deletion = implementation.slice(
    implementation.indexOf('export async function cancelCreemRenewalForAccountDeletion'),
  );
  assertOrdered(deletion, [
    "claimAccountBillingOperationDuringAccountDeletion(\n    userId,\n    'creem',\n    'reconciliation'",
    'retrieveCreemSubscription(configuration, subscriptionId)',
    'assertCreemDeletionSubscriptionIdentity({',
    'providerCustomerBelongsToUser({',
    'cancelCreemSubscription(configuration, subscriptionId)',
  ]);
});

test('Creem lifecycle remains available while new acquisition is independently disabled', () => {
  withCreemEnvironment({
    APP_BASE_URL: 'https://preview.girapphe.test',
    DATABASE_URL: 'postgres://billing.test/database',
    CREEM_API_KEY: 'creem_test_key',
    CREEM_WEBHOOK_SECRET: 'creem_test_webhook',
    CREEM_ANNUAL_PRODUCT_ID: 'creem_plus_annual',
    CREEM_ENVIRONMENT: 'test',
    WEB_BILLING_ACQUISITION_ENABLED: 'false',
  }, () => {
    assert.equal(isCreemLifecycleConfigured(), true);
    assert.equal(isCreemAcquisitionEnabled(), false);
    process.env.WEB_BILLING_ACQUISITION_ENABLED = 'true';
    assert.equal(isCreemAcquisitionEnabled(), true);
  });
});

test('Creem write routes require the exact configured application origin', () => {
  withCreemEnvironment({ APP_BASE_URL: 'https://www.girapphe.com' }, () => {
    const request = (origin?: string) => new Request(
      'https://www.girapphe.com/api/billing/checkout',
      { method: 'POST', headers: origin ? { Origin: origin } : {} },
    );
    assert.equal(requestHasTrustedOrigin(request()), false);
    assert.equal(requestHasTrustedOrigin(request('https://attacker.example')), false);
    assert.equal(requestHasTrustedOrigin(request('https://www.girapphe.com')), true);
  });
});

test('checkout and account deletion share the billing-operation fence', () => {
  const checkout = source('./creem.ts');
  const deletion = source('../account-deletion.ts');
  const checkoutHandler = checkout.slice(checkout.indexOf('export async function createCreemCheckout'));

  assertOrdered(checkoutHandler, [
    "claimAccountBillingOperation(input.userId, 'creem', 'checkout')",
    'requireBillingEntitlementState(input.userId)',
    "'POST',\n        '/checkouts'",
    'releaseAccountBillingOperation(lease)',
  ]);
  assert.match(deletion, /buildAccountDeletionFenceQueries\(userId\)/);
  assert.match(deletion, /A billing operation is still in progress/);
  assert.match(
    checkoutHandler,
    /else if \(unresolved\) \{[\s\S]*Only the operator recovery command[\s\S]*throw new PendingCheckoutError[\s\S]*await verifyConfiguredAnnualProduct/,
  );
});

test('Creem serializes authoritative reconciliation before normalization and commit', () => {
  const implementation = source('./creem.ts');
  const reconciliation = implementation.slice(
    implementation.indexOf('export async function processCreemEvent'),
    implementation.indexOf('async function cancelCreemSubscription'),
  );
  assertOrdered(reconciliation, [
    'preliminarySubscription = await retrieveCreemSubscription',
    'claimCreemReconciliationLease(preliminaryOwner.userId)',
    'const subscription = await retrieveCreemSubscription',
    'selectCreemLifecycleSubscription({',
    'normalizedCreemSubscription({',
    'commitWebhookSubscriptionReconciliation(normalized, lease, reconciliationGeneration)',
    'releaseAccountBillingOperation(reconciliationLease)',
  ]);
});

test('a late completed checkout for a deleted account stops renewal before acknowledging the webhook', () => {
  const implementation = source('./creem.ts');
  const completion = implementation.slice(
    implementation.indexOf('async function processCheckoutCompleted'),
    implementation.indexOf('async function authoritativeAdverseStatus'),
  );
  assertOrdered(completion, [
    'verifiedCreemCheckoutCompletion({',
    'isAccountDeletionMarked(attempt.userId)',
    'claimAccountBillingOperationDuringAccountDeletion(',
    'retrieveCreemSubscription(configuration, completion.subscriptionId)',
    'assertCreemDeletionSubscriptionIdentity({',
    'cancelCreemSubscription(configuration, completion.subscriptionId)',
    'saveCreemProviderAccountDuringAccountDeletion({',
    'upsertCreemSubscriptionDuringAccountDeletion(',
    'completeWebhookEvent(lease)',
    'releaseAccountBillingOperation(reconciliationLease)',
  ]);
});
