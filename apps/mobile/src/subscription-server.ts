import type { BillingEntitlementResponse } from '@stem-brain/shared';

export type MobileBillingState = BillingEntitlementResponse & {
  acquisitionEnabled: {
    web: boolean;
    mobile: boolean;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type MobileBillingSession = {
  userId: string;
  getToken: () => Promise<string | null>;
};
export type SuperwallPurchaseOperationOutcome =
  | 'aborted_before_purchase'
  | 'cancelled'
  | 'failed'
  | 'canonically_confirmed'
  | 'pending'
  | 'unconfirmed'
  | 'indeterminate';
export const MOBILE_BILLING_REQUEST_TIMEOUT_MS = 8_000;
// One reconciliation request plus polling and a final bounded entitlement read
// stays within the approximately 60-second confirmation window.
export const MOBILE_ENTITLEMENT_CONFIRMATION_POLL_MS = 44_000;
const EXPECTED_BILLING_SUBJECT_HEADER = 'X-Girapphe-Expected-Billing-Subject';
const BILLING_SUBJECT_HEADER = 'X-Girapphe-Billing-Subject';

export function isCurrentSubscriptionSession(input: {
  isSignedIn: boolean;
  currentUserId: string | null | undefined;
  sessionUserId: string | null;
}): boolean {
  return Boolean(
    input.isSignedIn
      && input.currentUserId
      && input.sessionUserId === input.currentUserId,
  );
}

export function shouldReleaseSuperwallPurchaseOperation(
  outcome: SuperwallPurchaseOperationOutcome,
): boolean {
  return outcome === 'aborted_before_purchase'
    || outcome === 'cancelled'
    || outcome === 'canonically_confirmed';
}

async function fetchWithTimeout(
  fetcher: FetchLike,
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error('billing_request_timeout'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      fetcher(input, { ...init, signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parseMobileBillingState(value: unknown): MobileBillingState | null {
  if (!isObject(value) || !isObject(value.acquisitionEnabled)) return null;
  if (
    typeof value.isAdFree !== 'boolean'
    || typeof value.acquisitionBlocked !== 'boolean'
    || typeof value.duplicateDetected !== 'boolean'
    || !Array.isArray(value.subscriptions)
    || typeof value.acquisitionEnabled.web !== 'boolean'
    || typeof value.acquisitionEnabled.mobile !== 'boolean'
  ) return null;
  return value as MobileBillingState;
}

async function authorizationHeader(getToken: () => Promise<string | null>) {
  const token = await getToken();
  if (!token) throw new Error('authentication_required');
  return { Authorization: `Bearer ${token}` };
}

export async function captureMobileBillingSession(input: {
  userId: string;
  getToken: () => Promise<string | null>;
}): Promise<MobileBillingSession> {
  if (!input.userId || input.userId.trim() !== input.userId) {
    throw new Error('invalid_billing_subject');
  }
  // Clerk's getToken() follows the currently active session. Freeze the token
  // once so an account switch cannot move claim/reconcile/release requests to
  // a different Clerk actor in the middle of one billing operation.
  const token = await input.getToken();
  if (!token) throw new Error('authentication_required');
  return {
    userId: input.userId,
    getToken: async () => token,
  };
}

function assertExpectedBillingSubject(response: Response, expectedUserId: string): void {
  if (response.headers.get(BILLING_SUBJECT_HEADER) !== expectedUserId) {
    throw new Error('billing_subject_changed');
  }
}

function billingHeaders(
  authorization: { Authorization: string },
  expectedUserId: string,
): Record<string, string> {
  return {
    Accept: 'application/json',
    ...authorization,
    [EXPECTED_BILLING_SUBJECT_HEADER]: expectedUserId,
  };
}

export async function readMobileBillingState(input: {
  baseUrl: string;
  expectedUserId: string;
  getToken: () => Promise<string | null>;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): Promise<MobileBillingState> {
  const headers = await authorizationHeader(input.getToken);
  const response = await fetchWithTimeout(input.fetcher ?? fetch, `${input.baseUrl}/api/billing/entitlement`, {
    headers: billingHeaders(headers, input.expectedUserId),
  }, input.timeoutMs ?? MOBILE_BILLING_REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error('entitlement_unavailable');
  assertExpectedBillingSubject(response, input.expectedUserId);
  const state = parseMobileBillingState(await response.json());
  if (!state) throw new Error('invalid_entitlement_response');
  return state;
}

export async function requestSuperwallReconciliation(input: {
  baseUrl: string;
  expectedUserId: string;
  getToken: () => Promise<string | null>;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): Promise<void> {
  const headers = await authorizationHeader(input.getToken);
  const response = await fetchWithTimeout(input.fetcher ?? fetch, `${input.baseUrl}/api/billing/superwall/reconcile`, {
    method: 'POST',
    headers: billingHeaders(headers, input.expectedUserId),
  }, input.timeoutMs ?? MOBILE_BILLING_REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error('reconciliation_unavailable');
  assertExpectedBillingSubject(response, input.expectedUserId);
}

export async function registerSuperwallIdentity(input: {
  baseUrl: string;
  expectedUserId: string;
  getToken: () => Promise<string | null>;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): Promise<void> {
  const headers = await authorizationHeader(input.getToken);
  const response = await fetchWithTimeout(input.fetcher ?? fetch, `${input.baseUrl}/api/billing/superwall/identity`, {
    method: 'POST',
    headers: billingHeaders(headers, input.expectedUserId),
  }, input.timeoutMs ?? MOBILE_BILLING_REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error('identity_registration_unavailable');
  assertExpectedBillingSubject(response, input.expectedUserId);
}

export async function claimSuperwallPurchaseOperation(input: {
  baseUrl: string;
  expectedUserId: string;
  getToken: () => Promise<string | null>;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): Promise<string> {
  const headers = await authorizationHeader(input.getToken);
  const response = await fetchWithTimeout(input.fetcher ?? fetch, `${input.baseUrl}/api/billing/superwall/purchase-operation`, {
    method: 'POST',
    headers: billingHeaders(headers, input.expectedUserId),
  }, input.timeoutMs ?? MOBILE_BILLING_REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error('purchase_operation_unavailable');
  assertExpectedBillingSubject(response, input.expectedUserId);
  const payload = await response.json() as unknown;
  if (
    !isObject(payload)
    || typeof payload.ownerToken !== 'string'
    || payload.ownerToken.length < 1
    || payload.ownerToken.length > 512
    || /[\r\n]/.test(payload.ownerToken)
  ) {
    throw new Error('invalid_purchase_operation_response');
  }
  return payload.ownerToken;
}

export async function releaseSuperwallPurchaseOperation(input: {
  baseUrl: string;
  expectedUserId: string;
  getToken: () => Promise<string | null>;
  ownerToken: string;
  fetcher?: FetchLike;
  timeoutMs?: number;
}): Promise<void> {
  if (!input.ownerToken || input.ownerToken.length > 512 || /[\r\n]/.test(input.ownerToken)) {
    throw new Error('invalid_purchase_operation_token');
  }
  const headers = await authorizationHeader(input.getToken);
  const response = await fetchWithTimeout(input.fetcher ?? fetch, `${input.baseUrl}/api/billing/superwall/purchase-operation`, {
    method: 'DELETE',
    headers: {
      ...billingHeaders(headers, input.expectedUserId),
      'X-Girapphe-Billing-Operation-Token': input.ownerToken,
    },
  }, input.timeoutMs ?? MOBILE_BILLING_REQUEST_TIMEOUT_MS);
  if (!response.ok) throw new Error('purchase_operation_release_failed');
  assertExpectedBillingSubject(response, input.expectedUserId);
}

export async function waitForCanonicalEntitlement(input: {
  read: () => Promise<MobileBillingState>;
  maxDurationMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<MobileBillingState> {
  const maxDurationMs = input.maxDurationMs ?? 60_000;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const deadline = now() + maxDurationMs;
  let delayMs = 1_000;
  let latest = await input.read();
  while (!latest.isAdFree && now() < deadline) {
    await sleep(Math.min(delayMs, Math.max(0, deadline - now())));
    if (now() >= deadline) break;
    latest = await input.read();
    delayMs = Math.min(Math.ceil(delayMs * 1.7), 8_000);
  }
  return latest;
}
