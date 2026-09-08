import type {
  BillingEntitlementResponse,
  CanonicalSubscription,
} from '@stem-brain/shared';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Authorization, Cookie',
    },
  });
}

export function authenticationRequiredEntitlementResponse(): Response {
  return json({ error: 'authentication_required' }, 401);
}

function publicSubscription(subscription: CanonicalSubscription): CanonicalSubscription {
  return {
    provider: subscription.provider,
    store: subscription.store,
    plan: subscription.plan,
    status: subscription.status,
    entitlement: subscription.entitlement,
    productId: subscription.productId,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    autoRenew: subscription.autoRenew,
    graceExpiresAt: subscription.graceExpiresAt,
    graceReason: subscription.graceReason,
  };
}

/** Strip internal environment, provider-customer, and subscription identifiers. */
export function publicBillingEntitlementResponse(
  state: BillingEntitlementResponse,
): BillingEntitlementResponse {
  const result: BillingEntitlementResponse = {
    isAdFree: state.isAdFree,
    acquisitionBlocked: state.acquisitionBlocked,
    duplicateDetected: state.duplicateDetected,
    subscriptions: state.subscriptions.map(publicSubscription),
  };
  if (state.acquisitionEnabled) result.acquisitionEnabled = { ...state.acquisitionEnabled };
  return result;
}

export async function readEntitlementResponse(
  readEntitlement: () => Promise<boolean | BillingEntitlementResponse>,
): Promise<Response> {
  try {
    const entitlement = await readEntitlement();
    return json(typeof entitlement === 'boolean'
      ? { isAdFree: entitlement }
      : publicBillingEntitlementResponse(entitlement));
  } catch (error) {
    console.error('Unable to read billing entitlement:', error);
    return json({ error: 'entitlement_unavailable' }, 503);
  }
}
