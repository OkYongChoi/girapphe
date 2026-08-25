import {
  AD_FREE_ENTITLEMENT,
  consumeTrialFromWebhook,
  expireRevenueCatSubscriptions,
  moveVerifiedRevenueCatSubscription,
  reconcileRevenueCatSubscription,
  type BillingPlan,
  type SubscriptionWrite,
} from '@/lib/billing/database';

type JsonObject = Record<string, unknown>;

export const REVENUECAT_REQUEST_TIMEOUT_MS = 10_000;

export async function deleteRevenueCatCustomer(
  userId: string,
  requestTimeoutMs = REVENUECAT_REQUEST_TIMEOUT_MS,
): Promise<boolean> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!apiKey) return false;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('RevenueCat customer deletion timed out.')),
    requestTimeoutMs,
  );
  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    if (response.status === 404) return true;
    if (!response.ok) {
      throw new Error(`RevenueCat customer deletion failed with status ${response.status}.`);
    }
    return true;
  } finally {
    clearTimeout(timeoutId);
  }
}

export type RevenueCatEvent = {
  id: string;
  type: string;
  payload: JsonObject;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function millisToDate(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateValue(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(...dates: Array<Date | null>) {
  return dates.reduce<Date | null>((latest, candidate) => {
    if (!candidate) return latest;
    return !latest || candidate.getTime() > latest.getTime() ? candidate : latest;
  }, null);
}

function clerkUserId(event: JsonObject) {
  const candidates = [
    stringValue(event.app_user_id),
    stringValue(event.original_app_user_id),
    ...stringArray(event.aliases),
    ...stringArray(event.transferred_to),
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate?.startsWith('user_'))) ?? null;
}

function normalizeStore(value: unknown) {
  const store = stringValue(value)?.toUpperCase();
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'app_store';
  if (store === 'PLAY_STORE') return 'play_store';
  return store?.toLowerCase() ?? null;
}

export function planFromRevenueCatProductId(productId: string | null): BillingPlan {
  if (!productId) return 'unknown';
  const monthlyIds = new Set(
    (process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const annualIds = new Set(
    (process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (monthlyIds.has(productId) && !annualIds.has(productId)) return 'monthly';
  if (annualIds.has(productId) && !monthlyIds.has(productId)) return 'annual';
  return 'unknown';
}

function eventEntitlements(event: JsonObject) {
  const entitlements = stringArray(event.entitlement_ids);
  const legacyEntitlement = stringValue(event.entitlement_id);
  if (legacyEntitlement) entitlements.push(legacyEntitlement);
  return new Set(entitlements);
}

export function canonicalRevenueCatSubscriptionId(
  store: 'app_store' | 'play_store',
  productId: string,
  storeTransactionId: string,
) {
  return [store, productId, storeTransactionId]
    .map((value) => `${value.length}:${value}`)
    .join('|');
}

export function parseRevenueCatEvent(payload: unknown): RevenueCatEvent | null {
  if (!isObject(payload) || !isObject(payload.event)) return null;
  const id = stringValue(payload.event.id);
  const type = stringValue(payload.event.type);
  if (!id || !type) return null;
  return { id, type, payload: payload.event };
}

export function isRevenueCatEventInScope(event: RevenueCatEvent, expectedAppIds: string) {
  const appIds = new Set(expectedAppIds.split(',').map((value) => value.trim()).filter(Boolean));
  if (!appIds.has(stringValue(event.payload.app_id) ?? '')) return false;
  const environment = stringValue(event.payload.environment)?.toUpperCase();
  if (process.env.APP_ENV !== 'prod') return true;
  // TRANSFER does not always include environment. Its authoritative Customer
  // Info reconciliation below still requires a non-sandbox App/Play purchase.
  if (event.type === 'TRANSFER') return !environment || environment === 'PRODUCTION';
  return environment === 'PRODUCTION';
}

type RevenueCatSnapshot = {
  reconciledAt: Date;
  active: boolean;
  store: 'app_store' | 'play_store' | null;
  plan: BillingPlan;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  providerSubscriptionId: string | null;
  productionStorePurchase: boolean;
  productId: string | null;
};

async function fetchRevenueCatSnapshot(
  userId: string,
  requestTimeoutMs = REVENUECAT_REQUEST_TIMEOUT_MS,
): Promise<RevenueCatSnapshot> {
  const apiKey = process.env.REVENUECAT_SECRET_API_KEY?.trim();
  if (!apiKey) throw new Error('REVENUECAT_SECRET_API_KEY is not configured.');
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('RevenueCat Customer Info request timed out.')),
    requestTimeoutMs,
  );
  let response: Response;
  let payload: unknown;

  try {
    response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    payload = await response.json().catch(() => null);
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok || !isObject(payload) || !isObject(payload.subscriber)) {
    throw new Error(`RevenueCat Customer Info request failed with status ${response.status}.`);
  }

  const reconciledAt = dateValue(payload.request_date) ?? new Date();
  const entitlements = isObject(payload.subscriber.entitlements)
    ? payload.subscriber.entitlements
    : {};
  const entitlement = isObject(entitlements[AD_FREE_ENTITLEMENT])
    ? entitlements[AD_FREE_ENTITLEMENT]
    : null;
  const productId = entitlement ? stringValue(entitlement.product_identifier) : null;
  const subscriptions = isObject(payload.subscriber.subscriptions)
    ? payload.subscriber.subscriptions
    : {};
  const subscription = productId && isObject(subscriptions[productId])
    ? subscriptions[productId]
    : null;
  const store = subscription ? normalizeStore(subscription.store) : null;
  const plan = planFromRevenueCatProductId(productId);
  const expiresAt = latestDate(
    entitlement ? dateValue(entitlement.expires_date) : null,
    subscription ? dateValue(subscription.expires_date) : null,
    subscription ? dateValue(subscription.grace_period_expires_date) : null,
  );
  const currentPeriodStart = subscription
    ? dateValue(subscription.purchase_date) ?? dateValue(subscription.original_purchase_date)
    : null;
  const isTrial = stringValue(subscription?.period_type)?.toUpperCase() === 'TRIAL';
  const productionStorePurchase = subscription?.is_sandbox === false;
  const environmentAllowed = process.env.APP_ENV !== 'prod' || productionStorePurchase;
  const eligibleStorePurchase = environmentAllowed
    && (store === 'app_store' || store === 'play_store');
  const active = Boolean(
    eligibleStorePurchase
      && plan !== 'unknown'
      && expiresAt
      && expiresAt.getTime() > Date.now()
      && !dateValue(subscription?.refunded_at),
  );
  const storeTransactionId = subscription?.store_transaction_id;
  const rawProviderSubscriptionId = typeof storeTransactionId === 'string'
    ? stringValue(storeTransactionId)
    : typeof storeTransactionId === 'number' && Number.isFinite(storeTransactionId)
      ? String(storeTransactionId)
      : null;
  const providerSubscriptionId = rawProviderSubscriptionId
    && productId
    && (store === 'app_store' || store === 'play_store')
    ? canonicalRevenueCatSubscriptionId(store, productId, rawProviderSubscriptionId)
    : null;

  return {
    reconciledAt,
    active,
    store: store === 'app_store' || store === 'play_store' ? store : null,
    plan,
    currentPeriodStart,
    currentPeriodEnd: expiresAt,
    trialEnd: isTrial ? expiresAt : null,
    cancelAtPeriodEnd: Boolean(dateValue(subscription?.unsubscribe_detected_at)),
    providerSubscriptionId,
    productionStorePurchase,
    productId,
  };
}

async function reconcileRevenueCatUser(
  userId: string,
  eventAt: Date,
) {
  const snapshot = await fetchRevenueCatSnapshot(userId);
  const providerEventAt = snapshot.reconciledAt.getTime() > eventAt.getTime()
    ? snapshot.reconciledAt
    : eventAt;

  if (!snapshot.active || !snapshot.store || snapshot.plan === 'unknown') {
    await expireRevenueCatSubscriptions(userId, providerEventAt);
    return { active: false };
  }

  // All RevenueCat paths use Customer Info's exact store/product/transaction
  // tuple so ordinary webhooks and TRANSFER converge on the same database row.
  const reconciledSubscriptionId = snapshot.providerSubscriptionId;
  if (!reconciledSubscriptionId) return { active: false };

  // The exact production store transaction is upserted together with expiry of
  // older rows for this destination. A matching source row can move tenants,
  // but only after this authoritative production snapshot has identified it.
  await reconcileRevenueCatSubscription({
    providerSubscriptionId: reconciledSubscriptionId,
    userId,
    store: snapshot.store,
    plan: snapshot.plan,
    status: snapshot.trialEnd ? 'trialing' : 'active',
    entitlement: AD_FREE_ENTITLEMENT,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    trialEnd: snapshot.trialEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    providerEventAt,
  });
  if (snapshot.trialEnd) await consumeTrialFromWebhook(userId);
  return { active: true };
}

type VerifiedRevenueCatTransfer = Omit<SubscriptionWrite, 'provider'>;

export async function verifyRevenueCatTransferDestination(
  userId: string,
  eventAt: Date,
  requestTimeoutMs = REVENUECAT_REQUEST_TIMEOUT_MS,
): Promise<VerifiedRevenueCatTransfer | null> {
  const snapshot = await fetchRevenueCatSnapshot(userId, requestTimeoutMs);
  if (
    !snapshot.active
    || !snapshot.productionStorePurchase
    || !snapshot.store
    || snapshot.plan === 'unknown'
    || !snapshot.providerSubscriptionId
  ) {
    return null;
  }

  const providerEventAt = snapshot.reconciledAt.getTime() > eventAt.getTime()
    ? snapshot.reconciledAt
    : eventAt;
  return {
    providerSubscriptionId: snapshot.providerSubscriptionId,
    userId,
    store: snapshot.store,
    plan: snapshot.plan,
    status: snapshot.trialEnd ? 'trialing' : 'active',
    entitlement: AD_FREE_ENTITLEMENT,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    trialEnd: snapshot.trialEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    providerEventAt,
  };
}

type RevenueCatTransferVerifier = (
  userId: string,
  eventAt: Date,
) => Promise<VerifiedRevenueCatTransfer | null>;

type RevenueCatTransferMover = (
  subscription: VerifiedRevenueCatTransfer,
  allowedPreviousUserIds: string[],
) => Promise<boolean>;

export async function processRevenueCatTransfer(
  event: RevenueCatEvent,
  providerEventAt: Date,
  verifyDestination: RevenueCatTransferVerifier = verifyRevenueCatTransferDestination,
  moveSubscription: RevenueCatTransferMover = moveVerifiedRevenueCatSubscription,
) {
  const destinations = [...new Set(
    stringArray(event.payload.transferred_to)
      .filter((candidate) => candidate.startsWith('user_')),
  )];
  const sources = [...new Set(
    stringArray(event.payload.transferred_from)
      .filter((candidate) => candidate.startsWith('user_')),
  )];

  if (destinations.length !== 1) return;
  const destination = destinations[0];

  // Customer Info must first prove that the destination owns an active,
  // non-sandbox, allowlisted store transaction. The webhook's source aliases
  // never authorize broad tenant updates; the exact verified transaction row
  // is the only row the atomic upsert may move.
  const subscription = await verifyDestination(destination, providerEventAt);
  if (!subscription) return;
  const moved = await moveSubscription(subscription, sources);
  if (moved && subscription.trialEnd) await consumeTrialFromWebhook(destination);
}

export async function processRevenueCatEvent(event: RevenueCatEvent) {
  const providerEventAt = millisToDate(event.payload.event_timestamp_ms);
  if (!providerEventAt) throw new Error('RevenueCat event timestamp is missing.');

  if (event.type === 'TRANSFER') {
    await processRevenueCatTransfer(event, providerEventAt);
    return;
  }

  const store = normalizeStore(event.payload.store);
  if (store !== 'app_store' && store !== 'play_store') return;

  if (!eventEntitlements(event.payload).has(AD_FREE_ENTITLEMENT)) return;
  const userId = clerkUserId(event.payload);
  if (!userId) throw new Error('RevenueCat event is not linked to a Clerk user id.');

  const productId = stringValue(event.payload.product_id);
  const plan = planFromRevenueCatProductId(productId);
  if (plan === 'unknown') return;
  await reconcileRevenueCatUser(userId, providerEventAt);
}
