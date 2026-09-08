import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureMobileBillingSession,
  claimSuperwallPurchaseOperation,
  parseMobileBillingState,
  isCurrentSubscriptionSession,
  registerSuperwallIdentity,
  readMobileBillingState,
  releaseSuperwallPurchaseOperation,
  requestSuperwallReconciliation,
  shouldReleaseSuperwallPurchaseOperation,
  waitForCanonicalEntitlement,
  type MobileBillingState,
} from './subscription-server';

const billingSubjectHeaders = (userId = 'user_owner') => ({
  'X-Girapphe-Billing-Subject': userId,
});

const inactive: MobileBillingState = {
  isAdFree: false,
  acquisitionBlocked: false,
  duplicateDetected: false,
  subscriptions: [],
  acquisitionEnabled: { web: false, mobile: true },
};

test('never renders subscription state from a previous Clerk account', () => {
  assert.equal(isCurrentSubscriptionSession({
    isSignedIn: true,
    currentUserId: 'user_second',
    sessionUserId: 'user_first',
  }), false);
  assert.equal(isCurrentSubscriptionSession({
    isSignedIn: false,
    currentUserId: null,
    sessionUserId: 'user_first',
  }), false);
  assert.equal(isCurrentSubscriptionSession({
    isSignedIn: true,
    currentUserId: 'user_first',
    sessionUserId: 'user_first',
  }), true);
});

test('fails closed when acquisition gates are missing from the server response', () => {
  assert.equal(parseMobileBillingState({
    isAdFree: false,
    acquisitionBlocked: false,
    duplicateDetected: false,
    subscriptions: [],
  }), null);
});

test('bounds post-purchase polling and never calls a purchase endpoint', async () => {
  let clock = 0;
  let reads = 0;
  const state = await waitForCanonicalEntitlement({
    read: async () => {
      reads += 1;
      return inactive;
    },
    maxDurationMs: 3_000,
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
  });

  assert.equal(state.isAdFree, false);
  assert.ok(reads >= 2);
  assert.equal(clock, 3_000);
});

test('stops as soon as canonical ad_free becomes active', async () => {
  let reads = 0;
  const state = await waitForCanonicalEntitlement({
    read: async () => {
      reads += 1;
      return reads === 1 ? inactive : { ...inactive, isAdFree: true, acquisitionBlocked: true };
    },
    sleep: async () => undefined,
  });
  assert.equal(state.isAdFree, true);
  assert.equal(reads, 2);
});

test('requests authenticated server reconciliation without a client purchase claim', async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  await requestSuperwallReconciliation({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken: async () => 'clerk-session-token',
    fetcher: async (input, init) => {
      requests.push({ input, init });
      return new Response(null, { status: 204, headers: billingSubjectHeaders() });
    },
  });

  const request = requests[0];
  assert.ok(request);
  assert.equal(request.input, 'https://preview.girapphe.test/api/billing/superwall/reconcile');
  assert.equal(request.init?.method, 'POST');
  assert.equal(request.init?.body, undefined);
  assert.deepEqual(request.init?.headers, {
    Accept: 'application/json',
    Authorization: 'Bearer clerk-session-token',
    'X-Girapphe-Expected-Billing-Subject': 'user_owner',
  });
});

test('bounds a stalled reconciliation request', async () => {
  await assert.rejects(requestSuperwallReconciliation({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken: async () => 'clerk-session-token',
    fetcher: async () => new Promise<Response>(() => undefined),
    timeoutMs: 1,
  }), /billing_request_timeout/);
});

test('registers only the authenticated Clerk identity without a client-authored user ID', async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  await registerSuperwallIdentity({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken: async () => 'clerk-session-token',
    fetcher: async (input, init) => {
      requests.push({ input, init });
      return new Response(null, { status: 204, headers: billingSubjectHeaders() });
    },
  });

  const request = requests[0];
  assert.ok(request);
  assert.equal(request.input, 'https://preview.girapphe.test/api/billing/superwall/identity');
  assert.equal(request.init?.method, 'POST');
  assert.equal(request.init?.body, undefined);
  assert.deepEqual(request.init?.headers, {
    Accept: 'application/json',
    Authorization: 'Bearer clerk-session-token',
    'X-Girapphe-Expected-Billing-Subject': 'user_owner',
  });
});

test('claims and releases an opaque server purchase lease without a purchase claim', async () => {
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  const fetcher = async (input: string, init?: RequestInit) => {
    requests.push({ input, init });
    return init?.method === 'POST'
      ? Response.json(
          { ownerToken: 'opaque-owner-token' },
          { headers: billingSubjectHeaders() },
        )
      : new Response(null, { status: 204, headers: billingSubjectHeaders() });
  };
  const getToken = async () => 'clerk-session-token';

  const ownerToken = await claimSuperwallPurchaseOperation({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken,
    fetcher,
  });
  await releaseSuperwallPurchaseOperation({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken,
    ownerToken,
    fetcher,
  });

  assert.equal(ownerToken, 'opaque-owner-token');
  assert.deepEqual(requests, [
    {
      input: 'https://preview.girapphe.test/api/billing/superwall/purchase-operation',
      init: {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer clerk-session-token',
          'X-Girapphe-Expected-Billing-Subject': 'user_owner',
        },
        signal: requests[0]?.init?.signal,
      },
    },
    {
      input: 'https://preview.girapphe.test/api/billing/superwall/purchase-operation',
      init: {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer clerk-session-token',
          'X-Girapphe-Expected-Billing-Subject': 'user_owner',
          'X-Girapphe-Billing-Operation-Token': 'opaque-owner-token',
        },
        signal: requests[1]?.init?.signal,
      },
    },
  ]);
  assert.equal(requests[0]?.init?.body, undefined);
  assert.equal(requests[1]?.init?.body, undefined);
});

test('rejects a missing or header-unsafe purchase lease token', async () => {
  await assert.rejects(claimSuperwallPurchaseOperation({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken: async () => 'clerk-session-token',
    fetcher: async () => Response.json(
      { ownerToken: '' },
      { headers: billingSubjectHeaders() },
    ),
  }), /invalid_purchase_operation_response/);
  await assert.rejects(releaseSuperwallPurchaseOperation({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_owner',
    getToken: async () => 'clerk-session-token',
    ownerToken: 'unsafe\r\ntoken',
    fetcher: async () => new Response(null, { status: 204 }),
  }), /invalid_purchase_operation_token/);
});

test('freezes the claim-time Clerk token across an account switch and verifies the server subject', async () => {
  let activeToken = 'token_user_a';
  let tokenReads = 0;
  const session = await captureMobileBillingSession({
    userId: 'user_a',
    getToken: async () => {
      tokenReads += 1;
      return activeToken;
    },
  });
  activeToken = 'token_user_b';
  const requests: RequestInit[] = [];
  const fetcher = async (_input: string, init?: RequestInit) => {
    requests.push(init ?? {});
    return Response.json(inactive, { headers: billingSubjectHeaders('user_a') });
  };

  await readMobileBillingState({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: session.userId,
    getToken: session.getToken,
    fetcher,
  });
  await readMobileBillingState({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: session.userId,
    getToken: session.getToken,
    fetcher,
  });

  assert.equal(tokenReads, 1);
  assert.equal((requests[0]?.headers as Record<string, string>).Authorization, 'Bearer token_user_a');
  assert.equal((requests[1]?.headers as Record<string, string>).Authorization, 'Bearer token_user_a');
  assert.equal(
    (requests[0]?.headers as Record<string, string>)['X-Girapphe-Expected-Billing-Subject'],
    'user_a',
  );
});

test('rejects a successful billing response authenticated as a different Clerk subject', async () => {
  await assert.rejects(readMobileBillingState({
    baseUrl: 'https://preview.girapphe.test',
    expectedUserId: 'user_a',
    getToken: async () => 'token_that_changed_to_user_b',
    fetcher: async () => Response.json(inactive, {
      headers: billingSubjectHeaders('user_b'),
    }),
  }), /billing_subject_changed/);
});

test('releases purchase leases only for definitive outcomes', () => {
  assert.equal(shouldReleaseSuperwallPurchaseOperation('aborted_before_purchase'), true);
  assert.equal(shouldReleaseSuperwallPurchaseOperation('cancelled'), true);
  assert.equal(shouldReleaseSuperwallPurchaseOperation('failed'), false);
  assert.equal(shouldReleaseSuperwallPurchaseOperation('canonically_confirmed'), true);
  assert.equal(shouldReleaseSuperwallPurchaseOperation('pending'), false);
  assert.equal(shouldReleaseSuperwallPurchaseOperation('unconfirmed'), false);
  assert.equal(shouldReleaseSuperwallPurchaseOperation('indeterminate'), false);
});
