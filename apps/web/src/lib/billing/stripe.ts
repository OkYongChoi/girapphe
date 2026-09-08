import {
  AD_FREE_ENTITLEMENT,
  claimStripePortalRateSlot,
  consumeTrialFromWebhook,
  findUserIdByStripeCustomer,
  getStripeCustomerId,
  getStripeSubscriptionIds,
  isAccountDeletionMarked,
  releaseTrialClaim,
  saveStripeCustomer,
  upsertSubscription,
  upsertLegacyStripeSubscriptionDuringAccountDeletion,
  type BillingPlan,
  type BillingStatus,
} from '@/lib/billing/database';

export const STRIPE_API_VERSION = '2026-02-25.clover';
export const STRIPE_PROVIDER_TIMEOUT_MS = 10_000;

type JsonObject = Record<string, unknown>;
type LegacyStripePlan = BillingPlan | 'unknown';

type StripeEvent = {
  id: string;
  type: string;
  createdAt: Date;
  data: { object: JsonObject };
};

export class BillingConfigurationError extends Error {}
export class ExistingSubscriptionError extends Error {}
export class StripeProviderRequestError extends Error {
  constructor(
    message: string,
    readonly outcome: 'definite_rejection' | 'indeterminate',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'StripeProviderRequestError';
  }
}
export class StripePortalRateLimitError extends Error {
  readonly retryAfterSeconds = 600;

  constructor() {
    super('Too many Stripe Customer Portal sessions. Try again later.');
    this.name = 'StripePortalRateLimitError';
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestampToDate(value: unknown): Date | null {
  const seconds = numberValue(value);
  if (seconds === null) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function metadataOf(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function requiredSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new BillingConfigurationError(`${name} is not configured.`);
  return value;
}

export function isStripeCheckoutConfigured() {
  // Billing V1 never permits new Stripe acquisition. Provider credentials are
  // lifecycle-only until the final legacy subscription is gone.
  return false;
}

export function isStripeLifecycleConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.STRIPE_SECRET_KEY);
}

function planForPrice(priceId: string | null): LegacyStripePlan {
  if (process.env.STRIPE_PRICE_AD_FREE_MONTHLY === process.env.STRIPE_PRICE_AD_FREE_ANNUAL) {
    return 'unknown';
  }
  if (priceId && priceId === process.env.STRIPE_PRICE_AD_FREE_MONTHLY) return 'monthly';
  if (priceId && priceId === process.env.STRIPE_PRICE_AD_FREE_ANNUAL) return 'annual';
  return 'unknown';
}

async function readStripeResponse<T extends JsonObject>(
  response: Response,
  providerMutation: boolean,
): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload)) {
    const stripeMessage = isObject(payload) && isObject(payload.error)
      ? stringValue(payload.error.message)
      : null;
    const message = stripeMessage ?? `Stripe request failed with status ${response.status}.`;
    const outcome = providerMutation && (response.ok || response.status >= 500)
      ? 'indeterminate'
      : 'definite_rejection';
    throw new StripeProviderRequestError(message, outcome);
  }
  return payload as T;
}

async function stripeFetch<T extends JsonObject>(
  url: string,
  init: RequestInit,
  requestTimeoutMs = STRIPE_PROVIDER_TIMEOUT_MS,
  providerMutation = false,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Stripe request timed out.')),
    requestTimeoutMs,
  );
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await readStripeResponse<T>(response, providerMutation);
  } catch (error) {
    if (controller.signal.aborted) {
      if (providerMutation) {
        throw new StripeProviderRequestError(
          'Stripe request timed out.',
          'indeterminate',
          { cause: error },
        );
      }
      throw new Error('Stripe request timed out.', { cause: error });
    }
    if (providerMutation && !(error instanceof StripeProviderRequestError)) {
      throw new StripeProviderRequestError(
        'Stripe request outcome is indeterminate.',
        'indeterminate',
        { cause: error },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function stripeRequest<T extends JsonObject>(
  path: string,
  body: URLSearchParams,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requiredSecret('STRIPE_SECRET_KEY')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return stripeFetch<T>(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store',
  }, STRIPE_PROVIDER_TIMEOUT_MS, true);
}

async function stripeDelete<T extends JsonObject>(path: string): Promise<T> {
  return stripeFetch<T>(`https://api.stripe.com/v1/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${requiredSecret('STRIPE_SECRET_KEY')}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
  }, STRIPE_PROVIDER_TIMEOUT_MS, true);
}

async function stripeGet<T extends JsonObject>(
  path: string,
  query = new URLSearchParams(),
  requestTimeoutMs = STRIPE_PROVIDER_TIMEOUT_MS,
): Promise<T> {
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return stripeFetch<T>(
    `https://api.stripe.com/v1/${path}${suffix}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${requiredSecret('STRIPE_SECRET_KEY')}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
      cache: 'no-store',
    },
    requestTimeoutMs,
  );
}

function checkoutBaseUrl(requestUrl: string) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    const parsed = new URL(configured);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BillingConfigurationError('APP_BASE_URL must be an http(s) URL.');
    }
    return parsed.origin;
  }
  return new URL(requestUrl).origin;
}

export function requestHasTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === checkoutBaseUrl(request.url);
  } catch {
    return false;
  }
}

export async function createStripeCheckout(input: {
  userId: string;
  email: string;
  plan: BillingPlan;
  requestUrl: string;
}): Promise<never> {
  void input;
  throw new BillingConfigurationError(
    'New Stripe checkout is disabled. Girapphe web acquisition uses Creem.',
  );
}
export async function createStripePortal(input: { userId: string; requestUrl: string }) {
  const customerId = await getStripeCustomerId(input.userId);
  if (!customerId) throw new Error('No Stripe customer is linked to this account.');
  const returnUrl = `${checkoutBaseUrl(input.requestUrl)}/subscription`;
  requiredSecret('STRIPE_SECRET_KEY');
  if (!await claimStripePortalRateSlot(input.userId)) {
    throw new StripePortalRateLimitError();
  }
  const body = new URLSearchParams({
    customer: customerId,
    return_url: returnUrl,
  });
  const session = await stripeRequest<JsonObject>('billing_portal/sessions', body);
  const url = stringValue(session.url);
  if (!url) throw new Error('Stripe did not return a Customer Portal URL.');
  return url;
}

async function expireOwnedOpenStripeCheckoutSessions(customerId: string, userId: string) {
  let startingAfter: string | null = null;
  let expired = 0;

  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({
      customer: customerId,
      status: 'open',
      limit: '100',
    });
    if (startingAfter) query.set('starting_after', startingAfter);
    const sessions = await stripeGet<JsonObject>('checkout/sessions', query);
    if (!Array.isArray(sessions.data)) {
      throw new Error('Stripe did not return a Checkout Session list.');
    }
    const data = sessions.data.filter(isObject);

    for (const candidate of data) {
      const id = stringValue(candidate.id);
      const metadata = metadataOf(candidate.metadata);
      if (
        id
        && candidate.mode === 'subscription'
        && metadata.user_id === userId
        && metadata.entitlement === AD_FREE_ENTITLEMENT
      ) {
        await stripeRequest<JsonObject>(
          `checkout/sessions/${encodeURIComponent(id)}/expire`,
          new URLSearchParams(),
        );
        expired += 1;
      }
    }

    if (sessions.has_more !== true) return expired;
    const nextCursor = stringValue(data.at(-1)?.id);
    if (!nextCursor || nextCursor === startingAfter) {
      throw new Error('Stripe Checkout pagination did not advance.');
    }
    startingAfter = nextCursor;
  }

  throw new Error('Stripe Checkout pagination exceeded the cleanup limit.');
}

export async function cancelStripeSubscriptionsForAccountDeletion(userId: string) {
  const customerId = await getStripeCustomerId(userId);
  if (!customerId) return 0;

  await expireOwnedOpenStripeCheckoutSessions(customerId, userId);
  const monthlyPriceId = requiredSecret('STRIPE_PRICE_AD_FREE_MONTHLY');
  const annualPriceId = requiredSecret('STRIPE_PRICE_AD_FREE_ANNUAL');
  const appPriceIds = new Set([monthlyPriceId, annualPriceId]);
  const storedSubscriptionIds = await getStripeSubscriptionIds(userId);
  const subscriptions = await stripeGet<JsonObject>('subscriptions', new URLSearchParams({
    customer: customerId,
    status: 'all',
    limit: '100',
  }));
  if (!Array.isArray(subscriptions.data)) {
    throw new Error('Stripe did not return a subscription list.');
  }

  const cancellable = subscriptions.data.filter((candidate): candidate is JsonObject => {
    if (!isObject(candidate)) return false;
    const id = stringValue(candidate.id);
    const status = stringValue(candidate.status);
    const metadata = metadataOf(candidate.metadata);
    const isOwnedGirappheSubscription = Boolean(
      id
      && (
        storedSubscriptionIds.has(id)
        || (
          metadata.user_id === userId
          && metadata.entitlement === AD_FREE_ENTITLEMENT
        )
        || appPriceIds.has(subscriptionPriceId(candidate) ?? '')
      )
    );
    return Boolean(
      id
      && status
      && !['canceled', 'incomplete_expired'].includes(status)
      && isOwnedGirappheSubscription,
    );
  });

  for (const subscription of cancellable) {
    await stripeDelete(`subscriptions/${encodeURIComponent(stringValue(subscription.id)!)}`);
  }
  return cancellable.length;
}

export function parseStripeEvent(payload: unknown): StripeEvent | null {
  if (!isObject(payload)) return null;
  const id = stringValue(payload.id);
  const type = stringValue(payload.type);
  const createdAt = timestampToDate(payload.created);
  if (!id || !type || !createdAt || !isObject(payload.data) || !isObject(payload.data.object)) return null;
  return { id, type, createdAt, data: { object: payload.data.object } };
}

async function resolveStripeUserId(object: JsonObject) {
  const metadata = metadataOf(object.metadata);
  const metadataUserId = stringValue(metadata.user_id);
  const customerId = stringValue(object.customer);
  const mappedUserId = customerId ? await findUserIdByStripeCustomer(customerId) : null;
  if (mappedUserId && metadataUserId && mappedUserId !== metadataUserId) {
    throw new Error('Stripe customer and subscription metadata identify different users.');
  }
  const userId = mappedUserId ?? metadataUserId;
  if (!userId?.startsWith('user_')) return null;
  if (customerId) {
    const savedCustomerId = await saveStripeCustomer(userId, customerId);
    if (savedCustomerId !== customerId) {
      throw new Error('Stripe customer is already mapped to a different customer id.');
    }
  }
  return userId;
}

function subscriptionPriceId(object: JsonObject) {
  if (!isObject(object.items) || !Array.isArray(object.items.data)) return null;
  const firstItem = object.items.data.find(isObject);
  return firstItem && isObject(firstItem.price) ? stringValue(firstItem.price.id) : null;
}

function subscriptionPeriod(object: JsonObject, field: 'current_period_start' | 'current_period_end') {
  const direct = timestampToDate(object[field]);
  if (direct) return direct;
  if (!isObject(object.items) || !Array.isArray(object.items.data)) return null;
  const firstItem = object.items.data.find(isObject);
  return firstItem ? timestampToDate(firstItem[field]) : null;
}

function normalizeStripeStatus(value: unknown): BillingStatus {
  const status = stringValue(value);
  if (status === 'unpaid') return 'past_due';
  if (status === 'incomplete_expired') return 'expired';
  return status && [
    'trialing',
    'active',
    'past_due',
    'canceled',
    'paused',
    'incomplete',
  ].includes(status)
    ? status as BillingStatus
    : 'incomplete';
}

async function processCheckoutSession(type: string, object: JsonObject) {
  const metadata = metadataOf(object.metadata);
  const userId = stringValue(object.client_reference_id) ?? stringValue(metadata.user_id);
  const customerId = stringValue(object.customer);
  if (!userId?.startsWith('user_')) return;

  if (type === 'checkout.session.completed') {
    if (customerId) {
      const savedCustomerId = await saveStripeCustomer(userId, customerId);
      if (savedCustomerId !== customerId) throw new Error('Checkout customer mapping does not match.');
    }
    await consumeTrialFromWebhook(userId, stringValue(metadata.trial_claimed_at));
    // This event only links the Customer. Entitlement is granted from a verified
    // customer.subscription.* event after Stripe has created subscription state.
    return;
  }

  if (type === 'checkout.session.expired') {
    const claimedAt = stringValue(metadata.trial_claimed_at);
    if (claimedAt) await releaseTrialClaim(userId, claimedAt);
  }
}

async function processSubscription(object: JsonObject, providerEventAt: Date) {
  const providerSubscriptionId = stringValue(object.id);
  if (!providerSubscriptionId) throw new Error('Stripe subscription id is missing.');
  requiredSecret('STRIPE_PRICE_AD_FREE_MONTHLY');
  requiredSecret('STRIPE_PRICE_AD_FREE_ANNUAL');
  const priceId = subscriptionPriceId(object);
  const plan = planForPrice(priceId);
  if (plan === 'unknown') return;

  const userId = await resolveStripeUserId(object);
  if (!userId) throw new Error('Unable to map Stripe subscription to a Clerk user.');
  let reconciledObject = object;
  let effectiveProviderEventAt = providerEventAt;
  const incomingStatus = normalizeStripeStatus(object.status);
  const deletingAccount = await isAccountDeletionMarked(userId);
  if (
    !['canceled', 'expired'].includes(incomingStatus)
    && deletingAccount
  ) {
    reconciledObject = await stripeDelete<JsonObject>(
      `subscriptions/${encodeURIComponent(providerSubscriptionId)}`,
    );
    effectiveProviderEventAt = new Date();
  }
  const reconciledStatus = normalizeStripeStatus(reconciledObject.status);
  const subscription = {
    provider: 'stripe',
    environment: process.env.APP_ENV === 'prod' ? 'production' : 'test',
    providerCustomerId: stringValue(reconciledObject.customer),
    providerSubscriptionId,
    providerEventId: null,
    userId,
    store: 'web',
    productId: priceId,
    plan,
    status: reconciledStatus,
    entitlement: AD_FREE_ENTITLEMENT,
    currentPeriodStart: subscriptionPeriod(reconciledObject, 'current_period_start'),
    currentPeriodEnd: subscriptionPeriod(reconciledObject, 'current_period_end'),
    trialEnd: timestampToDate(reconciledObject.trial_end),
    cancelAtPeriodEnd: reconciledObject.cancel_at_period_end === true,
    autoRenew: reconciledStatus === 'canceled'
      ? false
      : reconciledObject.cancel_at_period_end === true
        ? false
        : true,
    providerEventAt: effectiveProviderEventAt,
    lastReconciledAt: new Date(),
    graceReason: null,
    graceExpiresAt: null,
  } as const;
  if (deletingAccount) {
    await upsertLegacyStripeSubscriptionDuringAccountDeletion(subscription);
  } else {
    await upsertSubscription(subscription);
  }
  if (reconciledStatus === 'trialing') {
    await consumeTrialFromWebhook(userId);
  }
}

export async function processStripeEvent(
  event: StripeEvent,
  requestTimeoutMs = STRIPE_PROVIDER_TIMEOUT_MS,
) {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
    await processCheckoutSession(event.type, event.data.object);
    return;
  }
  if (event.type.startsWith('customer.subscription.')) {
    const subscriptionId = stringValue(event.data.object.id);
    if (!subscriptionId) throw new Error('Stripe subscription id is missing.');
    const latestSubscription = await stripeGet<JsonObject>(
      `subscriptions/${encodeURIComponent(subscriptionId)}`,
      new URLSearchParams(),
      requestTimeoutMs,
    );
    await processSubscription(latestSubscription, event.createdAt);
  }
}
