import {
  AD_FREE_ENTITLEMENT,
  claimStripePortalRateSlot,
  claimWebhookEvent,
  claimTrial,
  consumeTrialFromWebhook,
  findUserIdByStripeCustomer,
  hasBlockingSubscription,
  getStripeCustomerId,
  releaseTrialClaim,
  releaseWebhookEvent,
  saveStripeCustomer,
  upsertSubscription,
  type BillingPlan,
} from '@/lib/billing/database';

export const STRIPE_API_VERSION = '2026-02-25.clover';
export const STRIPE_PROVIDER_TIMEOUT_MS = 10_000;

type JsonObject = Record<string, unknown>;

type StripeEvent = {
  id: string;
  type: string;
  createdAt: Date;
  data: { object: JsonObject };
};

export class BillingConfigurationError extends Error {}
export class ExistingSubscriptionError extends Error {}
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

function priceForPlan(plan: Exclude<BillingPlan, 'unknown'>) {
  const monthly = requiredSecret('STRIPE_PRICE_AD_FREE_MONTHLY');
  const annual = requiredSecret('STRIPE_PRICE_AD_FREE_ANNUAL');
  if (monthly === annual) {
    throw new BillingConfigurationError('Stripe monthly and annual price IDs must be distinct.');
  }
  return plan === 'monthly' ? monthly : annual;
}

export function isStripeCheckoutConfigured() {
  const monthly = process.env.STRIPE_PRICE_AD_FREE_MONTHLY?.trim();
  const annual = process.env.STRIPE_PRICE_AD_FREE_ANNUAL?.trim();
  return Boolean(
    process.env.DATABASE_URL
      && process.env.STRIPE_SECRET_KEY
      && process.env.STRIPE_WEBHOOK_SECRET
      && monthly
      && annual
      && monthly !== annual,
  );
}

function planForPrice(priceId: string | null): BillingPlan {
  if (process.env.STRIPE_PRICE_AD_FREE_MONTHLY === process.env.STRIPE_PRICE_AD_FREE_ANNUAL) {
    return 'unknown';
  }
  if (priceId && priceId === process.env.STRIPE_PRICE_AD_FREE_MONTHLY) return 'monthly';
  if (priceId && priceId === process.env.STRIPE_PRICE_AD_FREE_ANNUAL) return 'annual';
  return 'unknown';
}

async function readStripeResponse<T extends JsonObject>(response: Response): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isObject(payload)) {
    const stripeMessage = isObject(payload) && isObject(payload.error)
      ? stringValue(payload.error.message)
      : null;
    const message = stripeMessage ?? `Stripe request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return payload as T;
}

async function stripeFetch<T extends JsonObject>(
  url: string,
  init: RequestInit,
  requestTimeoutMs = STRIPE_PROVIDER_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Stripe request timed out.')),
    requestTimeoutMs,
  );
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await readStripeResponse<T>(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Stripe request timed out.', { cause: error });
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
  });
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

async function ensureStripeCustomer(userId: string, email: string) {
  const existing = await getStripeCustomerId(userId);
  if (existing) return existing;

  const body = new URLSearchParams();
  if (email) body.set('email', email);
  body.set('metadata[user_id]', userId);
  const customer = await stripeRequest<JsonObject>(
    'customers',
    body,
    `girapphe-customer:${userId}`,
  );
  const createdId = stringValue(customer.id);
  if (!createdId) throw new Error('Stripe did not return a customer id.');

  // A Toss-created billing customer row may already exist with a NULL Stripe id.
  // COALESCE in saveStripeCustomer fills that row without replacing an existing mapping.
  return saveStripeCustomer(userId, createdId);
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

async function findOpenCheckoutUrl(customerId: string, userId: string) {
  const sessions = await stripeGet<JsonObject>('checkout/sessions', new URLSearchParams({
    customer: customerId,
    status: 'open',
    limit: '10',
  }));
  if (!Array.isArray(sessions.data)) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const candidate of sessions.data) {
    if (!isObject(candidate)) continue;
    const metadata = metadataOf(candidate.metadata);
    const expiresAt = numberValue(candidate.expires_at);
    if (
      candidate.mode === 'subscription'
      && metadata.user_id === userId
      && metadata.entitlement === AD_FREE_ENTITLEMENT
      && (!expiresAt || expiresAt > nowSeconds)
    ) {
      const url = stringValue(candidate.url);
      if (url) return url;
    }
  }
  return null;
}

async function hasBlockingStripeSubscription(customerId: string) {
  requiredSecret('STRIPE_PRICE_AD_FREE_MONTHLY');
  requiredSecret('STRIPE_PRICE_AD_FREE_ANNUAL');
  const subscriptions = await stripeGet<JsonObject>('subscriptions', new URLSearchParams({
    customer: customerId,
    status: 'all',
    limit: '100',
  }));
  if (!Array.isArray(subscriptions.data)) return false;
  const blockingStatuses = new Set([
    'incomplete',
    'trialing',
    'active',
    'past_due',
    'unpaid',
    'paused',
  ]);
  return subscriptions.data.some((candidate) => (
    isObject(candidate)
      && blockingStatuses.has(stringValue(candidate.status) ?? '')
      && planForPrice(subscriptionPriceId(candidate)) !== 'unknown'
  ));
}

export async function createStripeCheckout(input: {
  userId: string;
  email: string;
  plan: Exclude<BillingPlan, 'unknown'>;
  requestUrl: string;
}) {
  const priceId = priceForPlan(input.plan);
  const operationId = `checkout-create:${input.userId}`;
  const operationClaim = await claimWebhookEvent('stripe', operationId, 'checkout.session.create');
  if (operationClaim !== 'claimed') throw new Error('A checkout session is already being created.');
  try {
    if (await hasBlockingSubscription(input.userId)) {
      throw new ExistingSubscriptionError('An ad-free subscription already needs management.');
    }
    const customerId = await ensureStripeCustomer(input.userId, input.email);
    // One account may only have one pending ad-free Checkout, even if the user
    // switches plan buttons while the first hosted session is still open.
    const openCheckoutUrl = await findOpenCheckoutUrl(customerId, input.userId);
    if (openCheckoutUrl) return openCheckoutUrl;
    if (await hasBlockingStripeSubscription(customerId)) {
      throw new ExistingSubscriptionError('An existing Stripe subscription must be managed first.');
    }

    const claimedAt = await claimTrial(input.userId);
    const claimedAtIso = claimedAt?.toISOString() ?? null;
    const baseUrl = checkoutBaseUrl(input.requestUrl);
    const body = new URLSearchParams({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: input.userId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${baseUrl}/subscription?checkout=returned`,
      cancel_url: `${baseUrl}/subscription?checkout=cancelled`,
      payment_method_collection: 'always',
      'metadata[user_id]': input.userId,
      'metadata[plan]': input.plan,
      'metadata[entitlement]': AD_FREE_ENTITLEMENT,
      'subscription_data[metadata][user_id]': input.userId,
      'subscription_data[metadata][plan]': input.plan,
      'subscription_data[metadata][entitlement]': AD_FREE_ENTITLEMENT,
    });
    if (claimedAtIso) {
      body.set('subscription_data[trial_period_days]', '14');
      body.set('metadata[trial_claimed_at]', claimedAtIso);
    }

    const idempotencyWindow = claimedAtIso ?? Math.floor(Date.now() / 600_000).toString();
    try {
      const session = await stripeRequest<JsonObject>(
        'checkout/sessions',
        body,
        `girapphe-checkout:${input.userId}:${input.plan}:${idempotencyWindow}`,
      );
      const url = stringValue(session.url);
      if (!url) throw new Error('Stripe did not return a Checkout URL.');
      return url;
    } catch (error) {
      if (claimedAtIso) await releaseTrialClaim(input.userId, claimedAtIso);
      throw error;
    }
  } finally {
    await releaseWebhookEvent('stripe', operationId).catch(() => undefined);
  }
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

function normalizeStripeStatus(value: unknown) {
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
    ? status
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
  await upsertSubscription({
    provider: 'stripe',
    providerSubscriptionId,
    userId,
    store: 'web',
    plan,
    status: normalizeStripeStatus(object.status),
    entitlement: AD_FREE_ENTITLEMENT,
    currentPeriodStart: subscriptionPeriod(object, 'current_period_start'),
    currentPeriodEnd: subscriptionPeriod(object, 'current_period_end'),
    trialEnd: timestampToDate(object.trial_end),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
    providerEventAt,
  });
  if (normalizeStripeStatus(object.status) === 'trialing') {
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
