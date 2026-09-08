import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import test from 'node:test';

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function assertOrdered(haystack: string, labels: string[]) {
  let previous = -1;
  for (const label of labels) {
    const position = haystack.indexOf(label, previous + 1);
    assert.ok(position > previous, `${label} must follow the previous checkout guard`);
    previous = position;
  }
}

test('web checkout rejects untrusted and unauthenticated requests before parsing or provider calls', () => {
  const route = source('../../app/api/billing/checkout/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));

  assertOrdered(handler, [
    'requestHasTrustedOrigin(request)',
    "error: 'invalid_origin'",
    'getCurrentUserProfile()',
    "error: 'authentication_required'",
    'readAnnualPlan(request)',
    'createCreemCheckout({',
  ]);
  assert.match(handler, /invalid_origin' \}, \{ status: 403 \}/);
  assert.match(handler, /authentication_required' \}, \{ status: 401 \}/);
});

test('legacy monthly web requests are rejected by the route before checkout creation', () => {
  const route = source('../../app/api/billing/checkout/route.ts');
  const planFailure = route.slice(
    route.indexOf('if (!planBody.ok)'),
    route.indexOf('try {', route.indexOf('if (!planBody.ok)')),
  );

  assert.match(planFailure, /planBody\.reason === 'monthly' \? 'annual_only' : 'invalid_plan'/);
  assert.doesNotMatch(planFailure, /createCreemCheckout/);
});

test('Creem portal applies the same origin and authentication guards', () => {
  const route = source('../../app/api/billing/portal/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));

  assertOrdered(handler, [
    'requestHasTrustedOrigin(request)',
    "error: 'invalid_origin'",
    'getCurrentUser()',
    "error: 'authentication_required'",
    'consumeBillingRequestRateLimit({',
    "action: 'customer_portal'",
    'createCreemCustomerPortal({',
  ]);
  assert.match(handler, /status: 429[\s\S]*'Retry-After'/);
  assert.match(handler, /providerCustomerId: subscription\.providerCustomerId/);
});

test('Superwall reconciliation is database-rate-limited before provider work', () => {
  const route = source('../../app/api/billing/superwall/reconcile/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));
  assertOrdered(handler, [
    'getCurrentUser()',
    'requestHasExpectedBillingSubject(request, user.id)',
    'requestBodyIsEmpty(request)',
    'consumeBillingRequestRateLimit({',
    "action: 'superwall_reconcile'",
    'reconcileSuperwallForUser(user.id)',
    'publicBillingEntitlementResponse(state)',
  ]);
  assert.match(handler, /status: 429[\s\S]*'Retry-After'/);
});

test('Superwall identity and reconciliation reject any request body bytes', () => {
  for (const relativePath of [
    '../../app/api/billing/superwall/identity/route.ts',
    '../../app/api/billing/superwall/reconcile/route.ts',
  ]) {
    const route = source(relativePath);
    assert.match(route, /requestHasExpectedBillingSubject\(request, user\.id\)/);
    assert.match(route, /requestBodyIsEmpty\(request\)/);
    assert.doesNotMatch(route, /request\.headers\.has\('content-length'\)/);
  }
});

test('mobile billing responses bind the authenticated Clerk subject end to end', () => {
  const entitlement = source('../../app/api/billing/entitlement/route.ts');
  const identity = source('../../app/api/billing/superwall/identity/route.ts');
  const reconciliation = source('../../app/api/billing/superwall/reconcile/route.ts');
  const operation = source('../../app/api/billing/superwall/purchase-operation/route.ts');

  assert.match(entitlement, /EXPECTED_BILLING_SUBJECT_HEADER/);
  assert.match(entitlement, /expectedSubject !== user\.id/);
  for (const route of [identity, reconciliation, operation]) {
    assert.match(route, /requestHasExpectedBillingSubject\(request, user\.id\)/);
    assert.match(route, /billing_subject_changed/);
  }
  for (const route of [entitlement, identity, reconciliation, operation]) {
    assert.match(route, /'X-Girapphe-Billing-Subject': user\.id/);
  }
});

test('Superwall authoritative snapshots are ordered by request start, not response arrival', () => {
  const implementation = source('./superwall.ts');
  const snapshot = implementation.slice(
    implementation.indexOf('async function authoritativeSuperwallSnapshot'),
    implementation.indexOf('export function parseSuperwallAliases'),
  );
  assertOrdered(snapshot, [
    'allocateBillingReconciliationGeneration()',
    'const snapshotEventAt = new Date()',
    'await retrieveSuperwallSubscriptions',
    'const reconciledAt = new Date()',
  ]);
});

test('legacy acquisition stays absent while lifecycle-only rollback bridges remain', () => {
  const repositoryRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
  const removedPaths = [
    'apps/web/src/app/api/billing/toss/prepare/route.ts',
    'apps/web/src/app/api/billing/toss/callback/route.ts',
    'apps/web/src/components/toss-billing-button.tsx',
  ];

  for (const relativePath of removedPaths) {
    assert.equal(existsSync(resolve(repositoryRoot, relativePath)), false, relativePath);
  }

  const retainedLifecyclePaths = [
    '.github/workflows/toss-subscription-billing.yml',
    'apps/web/src/app/api/webhooks/stripe/route.ts',
    'apps/web/src/app/api/webhooks/revenuecat/route.ts',
    'apps/web/src/app/api/billing/toss/cancel/route.ts',
    'apps/web/src/app/api/internal/toss-subscription-charge/route.ts',
  ];
  for (const relativePath of retainedLifecyclePaths) {
    assert.equal(existsSync(resolve(repositoryRoot, relativePath)), true, relativePath);
  }

  const webPackage = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'apps/web/package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const directPackages = {
    ...webPackage.dependencies,
    ...webPackage.devDependencies,
  };
  assert.equal('stripe' in directPackages, false);
  assert.equal('@stripe/stripe-js' in directPackages, false);
});

test('provider outages can grant only fixed existing-row technical grace for billing issues', () => {
  const creem = source('../../app/api/webhooks/creem/route.ts');
  assert.match(creem, /error\.outcome === 'unavailable'/);
  assert.match(creem, /'subscription\.paid', 'subscription\.past_due', 'subscription\.unpaid'/);
  assert.match(creem, /handleCreemReconciliationOutage\(subscriptionId\)/);

  const superwall = source('../../app/api/webhooks/superwall/route.ts');
  assert.match(superwall, /error\.outcome === 'unavailable'/);
  assert.match(superwall, /'initial_purchase', 'renewal', 'uncancellation', 'billing_issue'/);
  assert.match(superwall, /handleSuperwallSubscriptionOutage\(event\)/);

  const database = source('./database.ts');
  assert.match(source('./creem.ts'), /reason: 'verification'[\s\S]*hours: 24/);
  assert.match(source('./superwall.ts'), /reason: 'verification'[\s\S]*hours: 24/);
  assert.match(database, /status IN \('active', 'past_due'\)/);
  assert.match(database, /grace_expires_at IS NULL/);
});
