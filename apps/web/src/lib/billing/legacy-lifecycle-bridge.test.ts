import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createStripeCheckout,
  isStripeCheckoutConfigured,
  parseStripeEvent,
} from './stripe';
import { isRevenueCatEventInScope, parseRevenueCatEvent } from './revenuecat';

test('legacy Stripe lifecycle cannot create a new checkout', async () => {
  assert.equal(isStripeCheckoutConfigured(), false);
  await assert.rejects(
    createStripeCheckout({
      userId: 'user_legacy',
      email: 'legacy@example.com',
      plan: 'annual',
      requestUrl: 'https://www.girapphe.com/subscription',
    }),
    /New Stripe checkout is disabled/,
  );
});

test('legacy provider envelopes retain strict identity and environment parsing', () => {
  assert.equal(parseStripeEvent({
    id: 'evt_stripe_legacy',
    type: 'customer.subscription.updated',
    created: 1_700_000_000,
    data: { object: { id: 'sub_legacy' } },
  })?.data.object.id, 'sub_legacy');
  assert.equal(parseStripeEvent({ id: 'evt_bad', type: 'x', data: {} }), null);

  const revenueCat = parseRevenueCatEvent({
    event: {
      id: 'evt_rc_legacy',
      type: 'RENEWAL',
      app_id: 'app_expected',
      environment: 'PRODUCTION',
    },
  });
  assert.ok(revenueCat);
  const previousAppEnv = process.env.APP_ENV;
  process.env.APP_ENV = 'prod';
  try {
    assert.equal(isRevenueCatEventInScope(revenueCat, 'app_expected'), true);
    assert.equal(isRevenueCatEventInScope(revenueCat, 'app_other'), false);
  } finally {
    if (previousAppEnv === undefined) Reflect.deleteProperty(process.env, 'APP_ENV');
    else process.env.APP_ENV = previousAppEnv;
  }
});

test('new web acquisition stays Creem-only while legacy lifecycle routes remain', () => {
  const checkout = readFileSync(
    new URL('../../app/api/billing/checkout/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(checkout, /createCreemCheckout/);
  assert.doesNotMatch(checkout, /Stripe|Toss|RevenueCat/);

  for (const path of [
    '../../app/api/webhooks/stripe/route.ts',
    '../../app/api/webhooks/revenuecat/route.ts',
    '../../app/api/billing/toss/cancel/route.ts',
    '../../app/api/internal/toss-subscription-charge/route.ts',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), true, path);
  }
  for (const path of [
    '../../app/api/billing/toss/prepare/route.ts',
    '../../app/api/billing/toss/callback/route.ts',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  }
});

test('legacy webhook ledgers complete only after local reconciliation', () => {
  for (const path of [
    '../../app/api/webhooks/stripe/route.ts',
    '../../app/api/webhooks/revenuecat/route.ts',
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const reconcile = source.indexOf(path.includes('stripe')
      ? 'await processStripeEvent(event)'
      : 'await processRevenueCatEvent(event)');
    const complete = source.indexOf('await completeWebhookEvent(claim)');
    assert.ok(reconcile >= 0 && complete > reconcile, path);
    assert.match(source, /recordWebhookFailure\(claim/);
  }
});

test('TOSS_BILLING_ENABLED is lifecycle-only and cannot restore Toss acquisition', () => {
  const source = readFileSync(new URL('./toss.ts', import.meta.url), 'utf8');
  assert.match(source, /This exact gate enables only retained lifecycle\/recovery operations/);
  assert.doesNotMatch(source, /TOSS_BILLING_RUNTIME_APPROVED|TOSS_BILLING_TEST_OVERRIDE/);
  assert.doesNotMatch(source, /EXCLUSIVE_PROVIDER_SERVER_KEYS|TOSS_PROVIDER_CONFLICT/);
  assert.doesNotMatch(
    readFileSync(new URL('../../app/subscription/page.tsx', import.meta.url), 'utf8'),
    /prepareTossBilling|TossBillingButton/,
  );
});
