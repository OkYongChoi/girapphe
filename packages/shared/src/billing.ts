export const AD_FREE_ENTITLEMENT_ID = 'ad_free' as const;

export const BILLING_PROVIDERS = [
  'creem',
  'superwall',
  'stripe',
  'revenuecat',
  'toss',
] as const;

export const BILLING_STORES = [
  'web',
  'app_store',
  'play_store',
  'promotional',
] as const;

export const BILLING_PLANS = ['monthly', 'annual'] as const;
export const BILLING_ENVIRONMENTS = ['test', 'production'] as const;

export const BILLING_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'paused',
  'canceled',
  'expired',
  'refunded',
  'revoked',
] as const;

export const BILLING_GRACE_REASONS = ['billing', 'verification'] as const;

export type BillingProvider = (typeof BILLING_PROVIDERS)[number];
export type BillingStore = (typeof BILLING_STORES)[number];
export type BillingPlan = (typeof BILLING_PLANS)[number];
export type BillingEnvironment = (typeof BILLING_ENVIRONMENTS)[number];
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export type BillingGraceReason = (typeof BILLING_GRACE_REASONS)[number];

export type CanonicalSubscription = {
  provider: BillingProvider;
  store: BillingStore;
  plan: BillingPlan;
  status: BillingStatus;
  entitlement: typeof AD_FREE_ENTITLEMENT_ID;
  productId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean | null;
  graceExpiresAt: string | null;
  graceReason: BillingGraceReason | null;
};

export type BillingManagementKind = 'creem_portal' | 'app_store' | 'play_store' | 'support';

export type BillingManagementDestination = {
  kind: BillingManagementKind;
  url: string | null;
};

export type BillingEntitlementResponse = {
  isAdFree: boolean;
  acquisitionBlocked: boolean;
  duplicateDetected: boolean;
  subscriptions: CanonicalSubscription[];
  acquisitionEnabled?: {
    web: boolean;
    mobile: boolean;
  };
};

const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

function instantMs(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Pure canonical rule used by web and mobile adapters. Provider callbacks never
 * call this with an unverified payload; only normalized server records qualify.
 */
export function subscriptionGrantsAdFree(
  subscription: CanonicalSubscription,
  now: Date = new Date(),
): boolean {
  if (subscription.entitlement !== AD_FREE_ENTITLEMENT_ID) return false;

  const nowMs = now.getTime();
  const periodEndMs = instantMs(subscription.currentPeriodEnd);
  const graceEndMs = instantMs(subscription.graceExpiresAt);
  const graceIsValid = graceEndMs !== null && graceEndMs > nowMs;

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return (periodEndMs !== null && periodEndMs > nowMs)
      || (subscription.status === 'active' && graceIsValid);
  }
  if (subscription.status === 'canceled' && subscription.cancelAtPeriodEnd) {
    return (periodEndMs !== null && periodEndMs > nowMs) || graceIsValid;
  }
  if (subscription.status === 'past_due') {
    return graceIsValid;
  }
  return false;
}

export function aggregateAdFreeEntitlement(
  subscriptions: readonly CanonicalSubscription[],
  now: Date = new Date(),
): boolean {
  return subscriptions.some((subscription) => subscriptionGrantsAdFree(subscription, now));
}

export function hasDuplicateQualifyingSubscriptions(
  subscriptions: readonly CanonicalSubscription[],
  now: Date = new Date(),
): boolean {
  return subscriptions.filter((subscription) => subscriptionGrantsAdFree(subscription, now)).length > 1;
}

export function managementDestinationFor(
  subscription: Pick<CanonicalSubscription, 'provider' | 'store'>,
  creemPortalUrl: string | null = null,
): BillingManagementDestination {
  if (subscription.provider === 'creem' && subscription.store === 'web') {
    return { kind: 'creem_portal', url: creemPortalUrl };
  }
  if (subscription.store === 'app_store') {
    return { kind: 'app_store', url: APP_STORE_SUBSCRIPTIONS_URL };
  }
  if (subscription.store === 'play_store') {
    return { kind: 'play_store', url: PLAY_STORE_SUBSCRIPTIONS_URL };
  }
  return { kind: 'support', url: null };
}
