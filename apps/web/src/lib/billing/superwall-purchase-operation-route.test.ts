import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const route = readFileSync(
  new URL('../../app/api/billing/superwall/purchase-operation/route.ts', import.meta.url),
  'utf8',
);

function assertOrdered(source: string, labels: string[]) {
  let previous = -1;
  for (const label of labels) {
    const position = source.indexOf(label, previous + 1);
    assert.ok(position > previous, `${label} must follow the previous guard`);
    previous = position;
  }
}

test('mobile purchase lease POST is trusted, authenticated, empty, and acquisition-gated', () => {
  const handler = route.slice(route.indexOf('export async function POST'), route.indexOf('export async function DELETE'));
  assertOrdered(handler, [
    'isTrustedBillingMutationRequest(request)',
    "error: 'invalid_origin'",
    'getCurrentUser()',
    "error: 'authentication_required'",
    'requestHasExpectedBillingSubject(request, user.id)',
    "error: 'billing_subject_changed'",
    'requestBodyIsEmpty(request)',
    "error: 'request_body_not_allowed'",
    'isSuperwallAcquisitionEnabled()',
    "error: 'acquisition_disabled'",
    "claimAccountBillingOperation(user.id, 'superwall', 'mobile_purchase')",
    'requireBillingEntitlementState(user.id)',
    'canonical.acquisitionBlocked',
    "error: 'subscription_or_purchase_exists'",
    'persistMobilePurchasePendingBlock(user.id, lease)',
  ]);
  assert.match(handler, /NextResponse\.json\(\s*\{ ownerToken: lease\.ownerToken \}/);
  assert.doesNotMatch(handler, /(?:entitlement|purchaseId|transactionId|productId)\s*:/i);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
});

test('mobile purchase lease DELETE accepts no body or query and releases only its header token', () => {
  const handler = route.slice(route.indexOf('export async function DELETE'));
  assertOrdered(handler, [
    'isTrustedBillingMutationRequest(request)',
    "error: 'invalid_origin'",
    'getCurrentUser()',
    "error: 'authentication_required'",
    'requestHasExpectedBillingSubject(request, user.id)',
    "error: 'billing_subject_changed'",
    'new URL(request.url).search.length > 0',
    'requestBodyIsEmpty(request)',
    "request.headers.get('X-Girapphe-Billing-Operation-Token')",
    'isBillingOperationOwnerToken(ownerToken)',
    'releaseMobilePurchaseOperationForUser(user.id, ownerToken)',
  ]);
  assert.doesNotMatch(handler, /request\.json\(\)|searchParams\.get/);
  assert.match(handler, /new NextResponse\(null, \{[\s\S]*status: 204/);
  assert.match(handler, /'X-Girapphe-Billing-Subject': user\.id/);
});

test('mobile purchase lease route never changes entitlement or invokes a purchase provider API', () => {
  assert.doesNotMatch(route, /(?:upsertSubscription|reconcile|purchaseProduct|SuperwallProvider)/);
  assert.match(route, /requestBodyIsEmpty\(request\)/);
  assert.match(route, /requireBillingEntitlementState\(user\.id\)/);
  assert.match(route, /persistMobilePurchasePendingBlock\(user\.id, lease\)/);
});
