import 'server-only';

import {
  AD_FREE_ENTITLEMENT,
  allocateBillingReconciliationGeneration,
  claimAccountBillingOperation,
  claimAccountBillingOperationDuringAccountDeletion,
  completeWebhookEvent,
  commitWebhookCheckoutLink,
  commitWebhookSubscriptionReconciliation,
  createCheckoutAttempt,
  currentBillingEnvironment,
  findUserIdByProviderCustomer,
  getCheckoutAttempt,
  getProviderCustomerId,
  getProviderCustomerIds,
  getProviderSubscription,
  getProviderSubscriptionIdsForUser,
  getUnresolvedCheckoutAttempt,
  grantFixedSubscriptionGrace,
  hasOpenAcquisitionBlock,
  isAccountDeletionMarked,
  providerCustomerBelongsToUser,
  releaseAccountBillingOperation,
  requireBillingEntitlementState,
  saveCreemProviderAccountDuringAccountDeletion,
  saveProviderAccount,
  updateCheckoutAttempt,
  updateCheckoutAttemptDuringAccountDeletion,
  upsertCreemSubscriptionDuringAccountDeletion,
  type BillingEnvironment,
  type BillingStatus,
  type SubscriptionWrite,
  type WebhookEventLease,
} from '@/lib/billing/database';
import { readBoundedResponseJson } from '@/lib/billing/bounded-json';
import { billingLog } from '@/lib/billing/logging';

type JsonObject = Record<string, unknown>;

export const CREEM_PROVIDER_TIMEOUT_MS = 10_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1_048_576;
const CHECKOUT_LIFETIME_MINUTES = 60;

export class BillingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingConfigurationError';
  }
}

export class ExistingSubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExistingSubscriptionError';
  }
}

export class PendingCheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PendingCheckoutError';
  }
}

export class CreemProviderRequestError extends Error {
  constructor(
    message: string,
    readonly outcome: 'definite_rejection' | 'indeterminate' | 'unavailable' | 'inconsistent',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CreemProviderRequestError';
  }
}

export type CreemEvent = {
  id: string;
  type: string;
  createdAt: Date;
  object: JsonObject;
};

type CreemConfiguration = {
  apiKey: string;
  webhookSecret: string;
  productId: string;
  environment: BillingEnvironment;
  apiBaseUrl: string;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dateValue(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function providerTimestampValue(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1_000_000_000_000 ? value * 1_000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return dateValue(value);
}

function latestDate(...values: Array<Date | null>): Date {
  return values.reduce<Date>((latest, candidate) => (
    candidate && candidate.getTime() > latest.getTime() ? candidate : latest
  ), new Date(0));
}

function nestedId(value: unknown): string | null {
  return stringValue(value) ?? (isObject(value) ? stringValue(value.id) : null);
}

function metadataOf(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => (
      typeof entry[1] === 'string'
    )),
  );
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new BillingConfigurationError(`${name} is not configured.`);
  return value;
}

export function configuredCreemEnvironment(): BillingEnvironment {
  const value = requiredEnvironment('CREEM_ENVIRONMENT');
  if (value !== 'test' && value !== 'production') {
    throw new BillingConfigurationError('CREEM_ENVIRONMENT must be test or production.');
  }
  const expected = currentBillingEnvironment();
  if (value !== expected) {
    throw new BillingConfigurationError(
      `CREEM_ENVIRONMENT=${value} cannot run in the ${expected} Girapphe environment.`,
    );
  }
  return value;
}

function creemConfiguration(): CreemConfiguration {
  const environment = configuredCreemEnvironment();
  return {
    apiKey: requiredEnvironment('CREEM_API_KEY'),
    webhookSecret: requiredEnvironment('CREEM_WEBHOOK_SECRET'),
    productId: requiredEnvironment('CREEM_ANNUAL_PRODUCT_ID'),
    environment,
    apiBaseUrl: environment === 'production'
      ? 'https://api.creem.io/v1'
      : 'https://test-api.creem.io/v1',
  };
}

export function getCreemWebhookConfiguration(): {
  secret: string;
  environment: BillingEnvironment;
} {
  const configuration = creemConfiguration();
  return {
    secret: configuration.webhookSecret,
    environment: configuration.environment,
  };
}

export function isCreemLifecycleConfigured(): boolean {
  try {
    if (!process.env.DATABASE_URL || !process.env.APP_BASE_URL) return false;
    creemConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function isCreemAcquisitionEnabled(): boolean {
  return process.env.WEB_BILLING_ACQUISITION_ENABLED === 'true'
    && isCreemLifecycleConfigured();
}

function checkoutBaseUrl(requestUrl: string): string {
  const configured = process.env.APP_BASE_URL?.trim();
  try {
    const url = new URL(configured || requestUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('invalid');
    }
    return url.origin;
  } catch {
    throw new BillingConfigurationError('APP_BASE_URL must be an absolute http(s) URL.');
  }
}

async function readCreemResponse(
  response: Response,
  method: 'GET' | 'POST',
): Promise<JsonObject> {
  const result = await readBoundedResponseJson(response, MAX_PROVIDER_RESPONSE_BYTES);
  const payload = result.ok ? result.value : null;
  if (!response.ok || !isObject(payload)) {
    const message = isObject(payload)
      ? stringValue(payload.message) ?? stringValue(payload.error)
      : null;
    // A successful-but-unreadable response and transient provider failures are
    // uncertain for both reads and writes. Treating a failed authoritative GET
    // as a definite answer could incorrectly revoke an otherwise valid grant.
    const uncertain = response.ok
      || response.status === 408
      || response.status === 429
      || response.status >= 500;
    throw new CreemProviderRequestError(
      message ?? `Creem request failed with status ${response.status}.`,
      uncertain
        ? method === 'POST' ? 'indeterminate' : 'unavailable'
        : 'definite_rejection',
    );
  }
  return payload;
}

async function creemRequest(
  configuration: CreemConfiguration,
  method: 'GET' | 'POST',
  path: string,
  body?: JsonObject,
  requestTimeoutMs = CREEM_PROVIDER_TIMEOUT_MS,
): Promise<JsonObject> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Creem request timed out.')),
    requestTimeoutMs,
  );
  try {
    const response = await fetch(`${configuration.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': configuration.apiKey,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: controller.signal,
    });
    return await readCreemResponse(response, method);
  } catch (error) {
    if (error instanceof CreemProviderRequestError) throw error;
    throw new CreemProviderRequestError(
      controller.signal.aborted ? 'Creem request timed out.' : 'Creem request outcome is indeterminate.',
      method === 'POST' ? 'indeterminate' : 'unavailable',
      { cause: error },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function assertCreemAnnualProduct(product: unknown, expectedProductId: string): void {
  if (!isObject(product)) throw new BillingConfigurationError('Creem product response is invalid.');
  const id = stringValue(product.id);
  const price = numberValue(product.price);
  const currency = stringValue(product.currency)?.toUpperCase();
  const billingType = stringValue(product.billing_type)?.toLowerCase();
  const billingPeriod = stringValue(product.billing_period)?.toLowerCase();
  const taxMode = stringValue(product.tax_mode)?.toLowerCase();
  const status = stringValue(product.status)?.toLowerCase();
  if (
    id !== expectedProductId
    || price !== 1_000
    || currency !== 'USD'
    || billingType !== 'recurring'
    || billingPeriod !== 'every-year'
    || taxMode !== 'inclusive'
    || status !== 'active'
  ) {
    throw new BillingConfigurationError(
      'CREEM_ANNUAL_PRODUCT_ID must be an active USD 10.00 tax-inclusive annual recurring product.',
    );
  }
}

async function verifyConfiguredAnnualProduct(configuration: CreemConfiguration): Promise<void> {
  const product = await creemRequest(
    configuration,
    'GET',
    `/products/${encodeURIComponent(configuration.productId)}`,
  );
  assertCreemAnnualProduct(product, configuration.productId);
}

function verifiedHostedUrl(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    if (url.hostname !== 'creem.io' && !url.hostname.endsWith('.creem.io')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function checkoutStatus(value: unknown) {
  const status = stringValue(value)?.toLowerCase();
  return status && ['pending', 'processing', 'completed', 'expired'].includes(status)
    ? status as 'pending' | 'processing' | 'completed' | 'expired'
    : null;
}

function checkoutIdentity(checkout: JsonObject) {
  return {
    id: stringValue(checkout.id),
    requestId: stringValue(checkout.request_id),
    url: verifiedHostedUrl(checkout.checkout_url),
    status: checkoutStatus(checkout.status),
    customerId: nestedId(checkout.customer),
    subscriptionId: nestedId(checkout.subscription),
    productId: nestedId(checkout.product) ?? stringValue(checkout.product_id),
  };
}

export function verifiedCreemCheckoutCompletion(input: {
  checkout: unknown;
  attempt: {
    id: string;
    userId: string;
    provider: 'creem' | 'superwall';
    environment: BillingEnvironment;
    plan: 'monthly' | 'annual';
    productId: string;
    providerCustomerId: string | null;
    providerCheckoutId: string | null;
  };
  environment: BillingEnvironment;
  productId: string;
}): {
  checkoutId: string;
  customerId: string;
  subscriptionId: string;
} {
  if (!isObject(input.checkout)) {
    throw new CreemProviderRequestError('Creem checkout completion is malformed.', 'inconsistent');
  }
  const identity = checkoutIdentity(input.checkout);
  const metadata = metadataOf(input.checkout.metadata);
  const order = isObject(input.checkout.order) ? input.checkout.order : null;
  const subscription = isObject(input.checkout.subscription) ? input.checkout.subscription : null;
  const product = isObject(input.checkout.product) ? input.checkout.product : null;
  const orderMode = order?.mode;
  const subscriptionMode = subscription?.mode;
  if (
    input.checkout.object !== 'checkout'
    || identity.status !== 'completed'
    || !creemModeMatchesEnvironment(input.checkout.mode, input.environment)
    || !identity.id
    || identity.id !== (input.attempt.providerCheckoutId ?? identity.id)
    || identity.requestId !== input.attempt.id
    || !identity.customerId
    || identity.customerId !== (input.attempt.providerCustomerId ?? identity.customerId)
    || !identity.subscriptionId
    || identity.productId !== input.productId
    || input.checkout.units !== 1
    || input.attempt.provider !== 'creem'
    || input.attempt.environment !== input.environment
    || input.attempt.plan !== 'annual'
    || input.attempt.productId !== input.productId
    || metadata.checkoutAttemptId !== input.attempt.id
    || metadata.clerkUserId !== input.attempt.userId
    || metadata.entitlement !== AD_FREE_ENTITLEMENT
    || metadata.plan !== 'annual'
    || !order
    || !stringValue(order.id)
    || nestedId(order.customer) !== identity.customerId
    || nestedId(order.product) !== input.productId
    || numberValue(order.amount) !== 1_000
    || stringValue(order.currency)?.toUpperCase() !== 'USD'
    || stringValue(order.status)?.toLowerCase() !== 'paid'
    || stringValue(order.type)?.toLowerCase() !== 'recurring'
    || (orderMode !== undefined && !creemModeMatchesEnvironment(orderMode, input.environment))
    || !subscription
    || subscription.object !== 'subscription'
    || stringValue(subscription.id) !== identity.subscriptionId
    || nestedId(subscription.customer) !== identity.customerId
    || productIdOfSubscription(subscription) !== input.productId
    || (subscriptionMode !== undefined
      && !creemModeMatchesEnvironment(subscriptionMode, input.environment))
    || !product
  ) {
    throw new CreemProviderRequestError(
      'Creem checkout completion does not match the server-owned annual purchase.',
      'inconsistent',
    );
  }
  assertCreemAnnualProduct(product, input.productId);
  statusOfSubscription(subscription);
  return {
    checkoutId: identity.id,
    customerId: identity.customerId,
    subscriptionId: identity.subscriptionId,
  };
}

export function creemCheckoutDisposition(
  checkout: JsonObject,
  expected: { attemptId: string; checkoutId: string; productId: string },
): {
  kind: 'open' | 'completed' | 'expired';
  checkoutUrl: string | null;
  customerId: string | null;
  subscriptionId: string | null;
} {
  const identity = checkoutIdentity(checkout);
  if (
    identity.id !== expected.checkoutId
    || identity.requestId !== expected.attemptId
    || identity.productId !== expected.productId
    || !identity.status
  ) {
    throw new CreemProviderRequestError(
      'Creem checkout reconciliation returned mismatched identifiers.',
      'indeterminate',
    );
  }
  if (identity.status === 'expired') {
    return {
      kind: 'expired',
      checkoutUrl: null,
      customerId: identity.customerId,
      subscriptionId: identity.subscriptionId,
    };
  }
  if (identity.status === 'completed') {
    return {
      kind: 'completed',
      checkoutUrl: null,
      customerId: identity.customerId,
      subscriptionId: identity.subscriptionId,
    };
  }
  if (!identity.url) {
    throw new CreemProviderRequestError(
      'Creem open checkout reconciliation did not return a trusted URL.',
      'indeterminate',
    );
  }
  return {
    kind: 'open',
    checkoutUrl: identity.url,
    customerId: identity.customerId,
    subscriptionId: identity.subscriptionId,
  };
}

function checkoutRequestBody(input: {
  attemptId: string;
  userId: string;
  email: string;
  customerId: string | null;
  productId: string;
  requestUrl: string;
}): JsonObject {
  const customer = input.customerId
    ? { id: input.customerId }
    : { email: input.email };
  return {
    product_id: input.productId,
    request_id: input.attemptId,
    units: 1,
    customer,
    success_url: `${checkoutBaseUrl(input.requestUrl)}/subscription?checkout=returned`,
    metadata: {
      clerkUserId: input.userId,
      checkoutAttemptId: input.attemptId,
      entitlement: AD_FREE_ENTITLEMENT,
      plan: 'annual',
    },
  };
}

function hasNonAttemptBlock(state: Awaited<ReturnType<typeof requireBillingEntitlementState>>) {
  return state.isAdFree
    || state.duplicateDetected
    || state.subscriptions.some((subscription) => (
      subscription.status === 'incomplete'
      || subscription.status === 'past_due'
      || subscription.status === 'paused'
    ));
}

export async function createCreemCheckout(input: {
  userId: string;
  email: string;
  plan: 'annual';
  requestUrl: string;
}): Promise<string> {
  if (input.plan !== 'annual') {
    throw new BillingConfigurationError('Creem web checkout only supports the annual plan.');
  }
  if (!isCreemAcquisitionEnabled()) {
    throw new BillingConfigurationError('Creem web acquisition is disabled or incomplete.');
  }
  const configuration = creemConfiguration();
  const lease = await claimAccountBillingOperation(input.userId, 'creem', 'checkout');
  if (!lease) throw new PendingCheckoutError('Another billing operation is in progress.');

  try {
    const [state, explicitBlock, initialUnresolved] = await Promise.all([
      requireBillingEntitlementState(input.userId),
      hasOpenAcquisitionBlock(input.userId),
      getUnresolvedCheckoutAttempt(input.userId),
    ]);
    if (hasNonAttemptBlock(state) || explicitBlock) {
      throw new ExistingSubscriptionError('An existing subscription needs management.');
    }
    if (
      initialUnresolved
      && (
        initialUnresolved.provider !== 'creem'
        || initialUnresolved.environment !== configuration.environment
        || initialUnresolved.plan !== 'annual'
        || initialUnresolved.productId !== configuration.productId
      )
    ) {
      throw new PendingCheckoutError('Another purchase attempt is still being confirmed.');
    }
    let unresolved = initialUnresolved;
    if (unresolved?.providerCheckoutId) {
      let checkout: JsonObject;
      try {
        checkout = await retrieveCreemCheckout(configuration, unresolved.providerCheckoutId);
      } catch (error) {
        if (
          error instanceof CreemProviderRequestError
          && (error.outcome === 'unavailable' || error.outcome === 'indeterminate')
        ) {
          throw new PendingCheckoutError('The existing checkout is still being confirmed.');
        }
        throw error;
      }
      const disposition = creemCheckoutDisposition(checkout, {
        attemptId: unresolved.id,
        checkoutId: unresolved.providerCheckoutId,
        productId: configuration.productId,
      });
      if (disposition.customerId) {
        await saveProviderAccount({
          userId: input.userId,
          provider: 'creem',
          environment: configuration.environment,
          providerCustomerId: disposition.customerId,
        });
      }
      if (disposition.kind === 'expired') {
        await updateCheckoutAttempt({
          id: unresolved.id,
          userId: input.userId,
          status: 'expired',
          providerCustomerId: disposition.customerId,
          providerCheckoutId: unresolved.providerCheckoutId,
        });
        unresolved = null;
      } else if (disposition.kind === 'completed') {
        await updateCheckoutAttempt({
          id: unresolved.id,
          userId: input.userId,
          status: 'indeterminate',
          providerCustomerId: disposition.customerId,
          providerCheckoutId: unresolved.providerCheckoutId,
        });
        throw new PendingCheckoutError('The completed payment is still being confirmed.');
      } else {
        await updateCheckoutAttempt({
          id: unresolved.id,
          userId: input.userId,
          status: 'open',
          providerCustomerId: disposition.customerId,
          providerCheckoutId: unresolved.providerCheckoutId,
          checkoutUrl: disposition.checkoutUrl,
        });
        return disposition.checkoutUrl!;
      }
    } else if (unresolved) {
      // Any unresolved local row without a provider id represents an uncertain
      // possibly-created checkout. Only the operator recovery command may mark
      // it abandoned after Creem dashboard/log evidence proves absence.
      throw new PendingCheckoutError('The existing checkout cannot yet be reconciled.');
    }

    await verifyConfiguredAnnualProduct(configuration);
    const attempt = await createCheckoutAttempt({
      userId: input.userId,
      provider: 'creem',
      environment: configuration.environment,
      plan: 'annual',
      productId: configuration.productId,
      lifetimeMinutes: CHECKOUT_LIFETIME_MINUTES,
    });
    const providerCustomerId = await getProviderCustomerId(
      input.userId,
      'creem',
      configuration.environment,
    );

    try {
      const checkout = await creemRequest(
        configuration,
        'POST',
        '/checkouts',
        checkoutRequestBody({
          attemptId: attempt.id,
          userId: input.userId,
          email: input.email,
          customerId: providerCustomerId,
          productId: configuration.productId,
          requestUrl: input.requestUrl,
        }),
      );
      const identity = checkoutIdentity(checkout);
      if (!identity.id || identity.requestId !== attempt.id || !identity.status) {
        throw new CreemProviderRequestError(
          'Creem checkout response is missing stable identifiers.',
          'indeterminate',
        );
      }
      if (identity.customerId) {
        await saveProviderAccount({
          userId: input.userId,
          provider: 'creem',
          environment: configuration.environment,
          providerCustomerId: identity.customerId,
        });
      }
      if (identity.status === 'expired') {
        await updateCheckoutAttempt({
          id: attempt.id,
          userId: input.userId,
          status: 'expired',
          providerCustomerId: identity.customerId,
          providerCheckoutId: identity.id,
        });
        throw new CreemProviderRequestError('Creem returned an expired checkout.', 'definite_rejection');
      }
      const url = identity.url;
      if (!url && identity.status !== 'completed') {
        throw new CreemProviderRequestError('Creem did not return a hosted checkout URL.', 'indeterminate');
      }
      await updateCheckoutAttempt({
        id: attempt.id,
        userId: input.userId,
        status: identity.status === 'completed' ? 'indeterminate' : 'open',
        providerCustomerId: identity.customerId,
        providerCheckoutId: identity.id,
        checkoutUrl: url,
      });
      return url ?? `${checkoutBaseUrl(input.requestUrl)}/subscription?checkout=returned`;
    } catch (error) {
      const outcome = error instanceof CreemProviderRequestError
        ? error.outcome
        : 'indeterminate';
      await updateCheckoutAttempt({
        id: attempt.id,
        userId: input.userId,
        status: outcome === 'indeterminate' ? 'indeterminate' : 'failed',
        lastErrorCode: outcome,
      }).catch(() => undefined);
      throw error;
    }
  } finally {
    await releaseAccountBillingOperation(lease).catch(() => undefined);
  }
}

export async function createCreemCustomerPortal(input: {
  userId: string;
  providerCustomerId: string;
}): Promise<string> {
  const configuration = creemConfiguration();
  const owned = await providerCustomerBelongsToUser({
    userId: input.userId,
    provider: 'creem',
    environment: configuration.environment,
    providerCustomerId: input.providerCustomerId,
  });
  if (!owned) throw new Error('The selected Creem customer is not linked to this account.');
  const response = await creemRequest(configuration, 'POST', '/customers/billing', {
    customer_id: input.providerCustomerId,
  });
  const portalUrl = verifiedHostedUrl(response.customer_portal_link);
  if (!portalUrl) throw new Error('Creem did not return a trusted customer portal URL.');
  return portalUrl;
}

export function parseCreemEvent(payload: unknown): CreemEvent | null {
  if (!isObject(payload) || !isObject(payload.object)) return null;
  const id = stringValue(payload.id);
  const type = stringValue(payload.eventType);
  const createdAtMs = numberValue(payload.created_at);
  if (!id || !type || createdAtMs === null || !Number.isSafeInteger(createdAtMs)) return null;
  const createdAt = new Date(createdAtMs);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { id, type, createdAt, object: payload.object };
}

function eventMode(event: CreemEvent): BillingEnvironment | null {
  const mode = stringValue(event.object.mode)?.toLowerCase();
  if (mode === 'prod' || mode === 'production') return 'production';
  if (mode === 'test' || mode === 'sandbox' || mode === 'local') return 'test';
  const nested = isObject(event.object.subscription) ? event.object.subscription : null;
  const nestedMode = stringValue(nested?.mode)?.toLowerCase();
  if (nestedMode === 'prod' || nestedMode === 'production') return 'production';
  if (nestedMode === 'test' || nestedMode === 'sandbox' || nestedMode === 'local') return 'test';
  return null;
}

export function isCreemEventInScope(
  event: CreemEvent,
  environment: BillingEnvironment,
): boolean {
  return eventMode(event) === environment;
}

export function subscriptionIdFromCreemEvent(event: CreemEvent): string | null {
  if (event.type.startsWith('subscription.')) return stringValue(event.object.id);
  return nestedId(event.object.subscription)
    ?? (isObject(event.object.transaction) ? nestedId(event.object.transaction.subscription) : null);
}

/**
 * Creem lifecycle webhooks contain a complete subscription resource. A GET
 * immediately following the event can lag that resource, so compare the two
 * provider resource clocks and use the newest fully validated snapshot.
 */
export function selectCreemLifecycleSubscription(input: {
  event: CreemEvent;
  authoritativeSubscription: JsonObject;
  expectedSubscriptionId: string;
  expectedProductId: string;
  environment: BillingEnvironment;
}): JsonObject {
  statusOfSubscription(input.authoritativeSubscription);
  if (
    !input.event.type.startsWith('subscription.')
    || input.event.type === 'subscription.paid'
  ) return input.authoritativeSubscription;

  const eventSubscription = input.event.object;
  const expectedCustomerId = nestedId(input.authoritativeSubscription.customer);
  if (
    eventSubscription.object !== 'subscription'
    || stringValue(eventSubscription.id) !== input.expectedSubscriptionId
    || stringValue(input.authoritativeSubscription.id) !== input.expectedSubscriptionId
    || productIdOfSubscription(eventSubscription) !== input.expectedProductId
    || productIdOfSubscription(input.authoritativeSubscription) !== input.expectedProductId
    || !expectedCustomerId
    || nestedId(eventSubscription.customer) !== expectedCustomerId
    || !creemModeMatchesEnvironment(eventSubscription.mode, input.environment)
    || !creemModeMatchesEnvironment(input.authoritativeSubscription.mode, input.environment)
  ) {
    throw new CreemProviderRequestError(
      'Creem lifecycle event does not match the authoritative subscription.',
      'inconsistent',
    );
  }
  const eventStatus = stringValue(eventSubscription.status)?.toLowerCase();
  const expectedEventStatus: Partial<Record<string, string>> = {
    'subscription.active': 'active',
    'subscription.canceled': 'canceled',
    'subscription.scheduled_cancel': 'scheduled_cancel',
    'subscription.paused': 'paused',
  };
  statusOfSubscription(eventSubscription);
  if (expectedEventStatus[input.event.type] && eventStatus !== expectedEventStatus[input.event.type]) {
    throw new CreemProviderRequestError(
      'Creem lifecycle event type and subscription status do not agree.',
      'inconsistent',
    );
  }
  const eventUpdatedAt = dateValue(eventSubscription.updated_at);
  const authoritativeUpdatedAt = dateValue(input.authoritativeSubscription.updated_at);
  if (!eventUpdatedAt || !authoritativeUpdatedAt) {
    throw new CreemProviderRequestError(
      'Creem lifecycle resources are missing their provider update clock.',
      'inconsistent',
    );
  }
  return eventUpdatedAt.getTime() >= authoritativeUpdatedAt.getTime()
    ? eventSubscription
    : input.authoritativeSubscription;
}

async function retrieveCreemSubscription(
  configuration: CreemConfiguration,
  subscriptionId: string,
): Promise<JsonObject> {
  return creemRequest(
    configuration,
    'GET',
    `/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
  );
}

async function retrieveCreemTransaction(
  configuration: CreemConfiguration,
  transactionId: string,
): Promise<JsonObject> {
  return creemRequest(
    configuration,
    'GET',
    `/transactions?transaction_id=${encodeURIComponent(transactionId)}`,
  );
}

function productIdOfSubscription(subscription: JsonObject): string | null {
  return nestedId(subscription.product)
    ?? (Array.isArray(subscription.items)
      ? subscription.items.map((item) => isObject(item) ? nestedId(item.product) : null).find(Boolean) ?? null
      : null);
}

function statusOfSubscription(subscription: JsonObject): BillingStatus {
  const status = stringValue(subscription.status)?.toLowerCase();
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trialing';
  if (status === 'scheduled_cancel') return 'canceled';
  if (status === 'canceled') return 'canceled';
  if (status === 'unpaid' || status === 'past_due') return 'past_due';
  if (status === 'paused') return 'paused';
  if (status === 'expired') return 'expired';
  throw new CreemProviderRequestError(
    'Creem returned a subscription with an unknown lifecycle status.',
    'inconsistent',
  );
}

export function creemStatusForEvent(input: {
  subscription: JsonObject;
  eventType: string;
  previouslyPaid: boolean;
  paymentVerified?: boolean;
  periodAdvanced?: boolean;
  failureEventMayOverride?: boolean;
}): BillingStatus {
  const providerStatus = statusOfSubscription(input.subscription);
  if (providerStatus === 'trialing') {
    // Billing V1 has no web trial. A misconfigured provider trial must not
    // silently become a Girapphe grant.
    return 'incomplete';
  }
  if (providerStatus === 'active') {
    if (input.paymentVerified) return 'active';
    if (!input.previouslyPaid) return 'incomplete';
    // A provider read can expose the next nominal period before Girapphe has
    // proof that its renewal was paid. Never advance paid access from an
    // `active` read alone; the `subscription.paid` event is the proof boundary.
    if (input.periodAdvanced) return 'past_due';
    if (
      input.failureEventMayOverride !== false
      && ['subscription.expired', 'subscription.past_due', 'subscription.unpaid'].includes(input.eventType)
    ) {
      // Creem documents that failure/expired-period events can race with an
      // `active` subscription read while retries continue. Keep a prior payer
      // in the fixed billing-grace path unless the authoritative period itself
      // advanced; never treat an unchanged period as a confirmed renewal.
      return 'past_due';
    }
    return 'active';
  }
  if (
    providerStatus === 'canceled'
    && stringValue(input.subscription.status)?.toLowerCase() === 'scheduled_cancel'
    && !input.previouslyPaid
    && !input.paymentVerified
  ) {
    return 'incomplete';
  }
  return providerStatus;
}

/**
 * A signed event envelope and the resource read it triggers have independent
 * clocks. Unverified event deltas may update lifecycle only when either clock
 * strictly advances. Verified adverse evidence always applies; a paid event
 * may also recover a newer paid period or complete an unverified initial row.
 */
export function creemEventMayUpdateLifecycle(input: {
  existingProviderEventAt: Date | null;
  existingProviderResourceUpdatedAt: Date | null;
  existingStatus: BillingStatus | null;
  existingCancelAtPeriodEnd: boolean;
  eventCreatedAt: Date;
  providerUpdatedAt: Date | null;
  eventEnvelopeMayDriveLifecycle: boolean;
  hasAuthoritativeAdverseProof: boolean;
  hasPaidPeriodProof: boolean;
  paidPeriodStrictlyAdvancesStoredBoundary: boolean;
}): boolean {
  if (!input.existingProviderEventAt || !input.existingStatus) return true;
  if (input.hasAuthoritativeAdverseProof) return true;
  const terminalRevocation = input.existingStatus === 'refunded'
    || input.existingStatus === 'revoked'
    || input.existingStatus === 'expired'
    || (input.existingStatus === 'canceled' && !input.existingCancelAtPeriodEnd);
  if (terminalRevocation) return input.paidPeriodStrictlyAdvancesStoredBoundary;
  if (
    input.eventEnvelopeMayDriveLifecycle
    && input.eventCreatedAt.getTime() > input.existingProviderEventAt.getTime()
  ) return true;
  if (
    input.providerUpdatedAt
    && (
      !input.existingProviderResourceUpdatedAt
      || input.providerUpdatedAt.getTime() > input.existingProviderResourceUpdatedAt.getTime()
    )
  ) return true;
  if (input.paidPeriodStrictlyAdvancesStoredBoundary) return true;
  return input.hasPaidPeriodProof
    && (input.existingStatus === 'incomplete' || input.existingStatus === 'trialing');
}

export function creemVerifiedPeriod(input: {
  hasExistingSubscription: boolean;
  existingPeriodVerified?: boolean;
  paidPeriod?: { start: Date; end: Date } | null;
  reportedStart: Date | null;
  reportedEnd: Date | null;
  existingStart: Date | null;
  existingEnd: Date | null;
}): { start: Date | null; end: Date | null } {
  // Creem's subscription resource is authoritative for lifecycle state, but a
  // non-payment event is not proof that a newly reported renewal period was
  // successfully charged. Once a row exists, only a signed paid event matched
  // to its authoritative transaction may move the paid-period boundary.
  if (input.paidPeriod) {
    if (
      input.existingPeriodVerified
      && input.existingEnd
      && input.paidPeriod.end.getTime() <= input.existingEnd.getTime()
    ) {
      return { start: input.existingStart, end: input.existingEnd };
    }
    return input.paidPeriod;
  }
  if (input.hasExistingSubscription) {
    return { start: input.existingStart, end: input.existingEnd };
  }
  return {
    start: input.reportedStart ?? input.existingStart,
    end: input.reportedEnd ?? input.existingEnd,
  };
}

export function verifiedCreemPaidPeriod(input: {
  eventSubscription: JsonObject;
  transaction: JsonObject;
  expectedSubscriptionId: string;
  expectedProductId: string;
  environment: BillingEnvironment;
}): { start: Date; end: Date } {
  const transactionId = stringValue(input.eventSubscription.last_transaction_id);
  const eventStart = dateValue(input.eventSubscription.current_period_start_date);
  const eventEnd = dateValue(input.eventSubscription.current_period_end_date);
  const transactionStart = providerTimestampValue(input.transaction.period_start);
  const transactionEnd = providerTimestampValue(input.transaction.period_end);
  const expectedMode = input.environment === 'production' ? 'prod' : 'test';
  const transactionMode = stringValue(input.transaction.mode)?.toLowerCase();
  const modeMatches = transactionMode === expectedMode
    || (input.environment === 'production' && transactionMode === 'production')
    || (input.environment === 'test' && ['sandbox', 'local'].includes(transactionMode ?? ''));
  if (
    stringValue(input.eventSubscription.id) !== input.expectedSubscriptionId
    || productIdOfSubscription(input.eventSubscription) !== input.expectedProductId
    || !transactionId
    || stringValue(input.transaction.id) !== transactionId
    || stringValue(input.transaction.status)?.toLowerCase() !== 'paid'
    || stringValue(input.transaction.type)?.toLowerCase() !== 'invoice'
    || nestedId(input.transaction.subscription) !== input.expectedSubscriptionId
    || nestedId(input.transaction.customer) !== nestedId(input.eventSubscription.customer)
    || numberValue(input.transaction.amount) !== 1_000
    || numberValue(input.transaction.amount_paid) !== 1_000
    || stringValue(input.transaction.currency)?.toUpperCase() !== 'USD'
    || (numberValue(input.transaction.refunded_amount) ?? 0) !== 0
    || !modeMatches
    || !eventStart
    || !eventEnd
    || !transactionStart
    || !transactionEnd
    || eventStart.getTime() !== transactionStart.getTime()
    || eventEnd.getTime() !== transactionEnd.getTime()
    || eventEnd.getTime() <= eventStart.getTime()
  ) {
    throw new CreemProviderRequestError(
      'Creem paid event does not match an authoritative paid annual transaction.',
      'inconsistent',
    );
  }
  return { start: eventStart, end: eventEnd };
}

export function creemTransactionIsFullRefund(transaction: JsonObject): boolean {
  const status = stringValue(transaction.status)?.toLowerCase();
  const amountPaid = numberValue(transaction.amount_paid);
  const refundedAmount = numberValue(transaction.refunded_amount);
  return status === 'refunded'
    && amountPaid !== null
    && amountPaid > 0
    && refundedAmount !== null
    && refundedAmount >= amountPaid;
}

export function fullCreemRefundRevokesCurrentAccess(
  transaction: JsonObject,
  subscription: JsonObject,
): boolean {
  return creemRefundAccessDecision(transaction, subscription) === 'revoke';
}

export function creemRefundAccessDecision(
  transaction: JsonObject,
  subscription: JsonObject,
): 'revoke' | 'retain' | 'indeterminate' {
  if (!creemTransactionIsFullRefund(transaction)) return 'retain';
  const currentStatus = stringValue(subscription.status)?.toLowerCase();
  if (currentStatus === 'canceled' || currentStatus === 'expired') return 'revoke';

  const transactionStart = providerTimestampValue(transaction.period_start);
  const transactionEnd = providerTimestampValue(transaction.period_end);
  const currentStart = dateValue(subscription.current_period_start_date);
  const currentEnd = dateValue(subscription.current_period_end_date);

  // A renewal ending at or before the current period began is historical and
  // cannot revoke the later paid period.
  if (transactionEnd && currentStart && transactionEnd.getTime() <= currentStart.getTime()) {
    return 'retain';
  }
  // A full refund whose provider period is the current period does revoke it,
  // even if the subscription read model has not reached its terminal status yet.
  if (
    (transactionEnd && currentEnd && transactionEnd.getTime() >= currentEnd.getTime())
    || (
      transactionStart
      && currentStart
      && transactionStart.getTime() >= currentStart.getTime()
      && (!currentEnd || transactionStart.getTime() < currentEnd.getTime())
    )
  ) {
    return 'revoke';
  }
  return 'indeterminate';
}

export function creemAdverseTransactionAccessDecision(input: {
  kind: 'refund' | 'dispute';
  transaction: JsonObject;
  verifiedPeriodStart: Date | null;
  verifiedPeriodEnd: Date | null;
}): 'revoke' | 'retain' | 'indeterminate' {
  if (input.kind === 'refund' && !creemTransactionIsFullRefund(input.transaction)) {
    return 'retain';
  }
  if (
    input.kind === 'dispute'
    && !['chargeback', 'chargedback'].includes(
      stringValue(input.transaction.status)?.toLowerCase() ?? '',
    )
  ) {
    return 'indeterminate';
  }
  const transactionStart = providerTimestampValue(input.transaction.period_start);
  const transactionEnd = providerTimestampValue(input.transaction.period_end);
  if (!transactionStart || !transactionEnd || transactionEnd.getTime() <= transactionStart.getTime()) {
    return 'indeterminate';
  }
  if (!input.verifiedPeriodEnd) {
    // No canonical paid access exists to preserve. Recording the adverse state
    // is safe and prevents a delayed activation event from granting it later.
    return 'revoke';
  }
  if (
    input.verifiedPeriodStart
    && transactionEnd.getTime() <= input.verifiedPeriodStart.getTime()
  ) {
    return 'retain';
  }
  const verifiedStartMs = input.verifiedPeriodStart?.getTime() ?? Number.NEGATIVE_INFINITY;
  const verifiedEndMs = input.verifiedPeriodEnd.getTime();
  if (
    transactionStart.getTime() < verifiedEndMs
    && transactionEnd.getTime() > verifiedStartMs
  ) {
    return 'revoke';
  }
  return 'indeterminate';
}

async function resolveCreemUser(
  subscription: JsonObject,
  configuration: CreemConfiguration,
): Promise<{ userId: string; customerId: string }> {
  const customerId = nestedId(subscription.customer);
  if (!customerId) throw new Error('Creem subscription customer id is missing.');
  const metadata = metadataOf(subscription.metadata);
  const mappedUserId = await findUserIdByProviderCustomer(
    'creem',
    configuration.environment,
    customerId,
  );
  const metadataUserId = stringValue(metadata.clerkUserId);
  if (mappedUserId && metadataUserId && mappedUserId !== metadataUserId) {
    throw new Error('Creem customer and subscription metadata identify different users.');
  }

  // Provider metadata is not an ownership proof by itself. For the first
  // association it must resolve to a checkout attempt created by Girapphe;
  // subsequent events use the immutable provider-account mapping.
  let attemptedUserId: string | null = null;
  if (!mappedUserId) {
    const attemptId = stringValue(metadata.checkoutAttemptId);
    const attempt = attemptId ? await getCheckoutAttempt(attemptId) : null;
    if (
      !attempt
      || attempt.provider !== 'creem'
      || attempt.environment !== configuration.environment
      || attempt.productId !== configuration.productId
      || attempt.plan !== 'annual'
      || !metadataUserId
      || attempt.userId !== metadataUserId
      || (attempt.providerCustomerId && attempt.providerCustomerId !== customerId)
    ) {
      throw new Error('Creem subscription is not linked to a server-owned checkout attempt.');
    }
    attemptedUserId = attempt.userId;
  }

  const userId = mappedUserId ?? attemptedUserId;
  if (!userId?.startsWith('user_')) {
    throw new Error('Creem subscription is not linked to a Clerk user id.');
  }
  return { userId, customerId };
}

async function normalizedCreemSubscription(input: {
  configuration: CreemConfiguration;
  event: CreemEvent;
  subscription: JsonObject;
  forcedStatus?: 'refunded' | 'revoked';
  paidPeriod?: { start: Date; end: Date } | null;
}): Promise<SubscriptionWrite | null> {
  const providerSubscriptionId = stringValue(input.subscription.id);
  if (!providerSubscriptionId) throw new Error('Creem subscription id is missing.');
  const productId = productIdOfSubscription(input.subscription);
  if (productId !== input.configuration.productId) return null;
  // A malformed/novel provider status is not authoritative negative evidence.
  // Validate it even when the event clock is stale so the webhook remains retryable.
  statusOfSubscription(input.subscription);
  const { userId, customerId } = await resolveCreemUser(
    input.subscription,
    input.configuration,
  );
  const existing = await getProviderSubscription(
    'creem',
    input.configuration.environment,
    providerSubscriptionId,
  );
  const existingPeriodVerified = existing?.paidPeriodVerified === true;
  const previouslyPaid = Boolean(existingPeriodVerified && existing && (
    existing.status === 'active'
    || existing.status === 'past_due'
    || (existing.status === 'canceled' && existing.cancelAtPeriodEnd)
  ));
  const providerUpdatedAt = dateValue(input.subscription.updated_at);
  const periodStart = dateValue(input.subscription.current_period_start_date);
  const periodEnd = dateValue(input.subscription.current_period_end_date);
  const reconciledAt = new Date();
  const periodProofApplies = Boolean(input.paidPeriod && (
    !existingPeriodVerified
    || !existing?.currentPeriodEnd
    || input.paidPeriod.end.getTime() > existing.currentPeriodEnd.getTime()
  ));
  const paidPeriod = periodProofApplies ? input.paidPeriod ?? null : null;
  const isPaidEvent = input.event.type === 'subscription.paid';
  const paidPeriodStrictlyAdvancesStoredBoundary = Boolean(
    isPaidEvent
    && input.paidPeriod
    && (
      !existing?.currentPeriodEnd
      || input.paidPeriod.end.getTime() > existing.currentPeriodEnd.getTime()
    ),
  );
  const mayUpdateLifecycle = creemEventMayUpdateLifecycle({
    existingProviderEventAt: existing?.providerEventAt ?? null,
    existingProviderResourceUpdatedAt: existing?.providerResourceUpdatedAt ?? null,
    existingStatus: existing?.status ?? null,
    existingCancelAtPeriodEnd: existing?.cancelAtPeriodEnd ?? false,
    eventCreatedAt: input.event.createdAt,
    providerUpdatedAt,
    eventEnvelopeMayDriveLifecycle: ![
      'subscription.paid',
      'refund.created',
      'dispute.created',
    ].includes(input.event.type),
    hasAuthoritativeAdverseProof: Boolean(input.forcedStatus),
    hasPaidPeriodProof: isPaidEvent && periodProofApplies,
    paidPeriodStrictlyAdvancesStoredBoundary,
  });
  const periodAdvanced = Boolean(
    periodEnd
    && existing?.currentPeriodEnd
    && periodEnd.getTime() > existing.currentPeriodEnd.getTime(),
  );
  let status: BillingStatus = mayUpdateLifecycle
    ? input.forcedStatus ?? creemStatusForEvent({
      subscription: input.subscription,
      eventType: input.event.type,
      previouslyPaid,
      paymentVerified: isPaidEvent && Boolean(paidPeriod),
      periodAdvanced,
    })
    : existing!.status;
  const providerEventAt = latestDate(
    input.event.createdAt,
    existing?.providerEventAt ?? null,
  );
  const providerResourceUpdatedAt = latestDate(
    providerUpdatedAt,
    existing?.providerResourceUpdatedAt ?? null,
  );
  const providerScheduledCancellation = stringValue(input.subscription.status)?.toLowerCase() === 'scheduled_cancel';
  const scheduledCancellation = mayUpdateLifecycle
    ? providerScheduledCancellation
    : existing?.cancelAtPeriodEnd ?? false;
  const verifiedPeriod = creemVerifiedPeriod({
    hasExistingSubscription: Boolean(existing),
    existingPeriodVerified,
    paidPeriod,
    reportedStart: periodStart,
    reportedEnd: periodEnd,
    existingStart: existing?.currentPeriodStart ?? null,
    existingEnd: existing?.currentPeriodEnd ?? null,
  });
  const accessThrough = verifiedPeriod.end;
  const hasPaidEvidence = existingPeriodVerified || periodProofApplies;
  if (mayUpdateLifecycle && status === 'active' && !accessThrough) {
    throw new CreemProviderRequestError(
      'Creem active subscription is missing a paid access-through timestamp.',
      'indeterminate',
    );
  }
  if (mayUpdateLifecycle && status === 'active' && accessThrough && accessThrough.getTime() <= reconciledAt.getTime()) {
    status = hasPaidEvidence ? 'past_due' : 'incomplete';
  }
  if (mayUpdateLifecycle && status === 'canceled' && scheduledCancellation && !accessThrough) {
    throw new CreemProviderRequestError(
      'Creem scheduled cancellation is missing an access-through timestamp.',
      'indeterminate',
    );
  }
  if (
    mayUpdateLifecycle
    && status === 'canceled'
    && scheduledCancellation
    && accessThrough
    && accessThrough.getTime() <= reconciledAt.getTime()
  ) {
    status = 'expired';
  }
  let graceReason = existing?.graceReason ?? null;
  let graceExpiresAt = existing?.graceExpiresAt ?? null;
  if (mayUpdateLifecycle && (
    status === 'active'
    || status === 'trialing'
    || status === 'expired'
    || status === 'refunded'
    || status === 'revoked'
    || status === 'canceled'
  )) {
    graceReason = null;
    graceExpiresAt = null;
  } else if (mayUpdateLifecycle && status === 'past_due') {
    const hasPaidPeriod = hasPaidEvidence && accessThrough;
    if (hasPaidPeriod && (graceReason !== 'billing' || !graceExpiresAt)) {
      graceReason = 'billing';
      graceExpiresAt = new Date(accessThrough.getTime() + 72 * 60 * 60 * 1_000);
    }
    if (!hasPaidPeriod) status = 'incomplete';
  }

  return {
    provider: 'creem',
    environment: input.configuration.environment,
    providerCustomerId: customerId,
    providerSubscriptionId,
    providerEventId: input.event.id,
    userId,
    store: 'web',
    productId,
    plan: 'annual',
    status,
    entitlement: AD_FREE_ENTITLEMENT,
    currentPeriodStart: verifiedPeriod.start,
    currentPeriodEnd: verifiedPeriod.end,
    paidPeriodVerified: hasPaidEvidence,
    trialEnd: null,
    cancelAtPeriodEnd: scheduledCancellation,
    autoRenew: mayUpdateLifecycle
      ? scheduledCancellation
        ? false
        : status === 'active' || status === 'past_due'
          ? true
          : ['canceled', 'expired', 'refunded', 'revoked'].includes(status)
            ? false
            : null
      : existing?.autoRenew ?? null,
    providerEventAt,
    providerResourceUpdatedAt,
    lastReconciledAt: reconciledAt,
    graceReason,
    graceExpiresAt,
  };
}

async function processCheckoutCompleted(
  configuration: CreemConfiguration,
  event: CreemEvent,
  lease: WebhookEventLease,
): Promise<boolean> {
  const identity = checkoutIdentity(event.object);
  const metadata = metadataOf(event.object.metadata);
  const attemptId = stringValue(metadata.checkoutAttemptId) ?? identity.requestId;
  if (!identity.id || !attemptId) {
    throw new Error('Creem checkout completion is missing stable identifiers.');
  }
  const attempt = await getCheckoutAttempt(attemptId);
  if (
    !attempt
  ) {
    throw new Error('Creem checkout completion does not match a server-owned attempt.');
  }
  const completion = verifiedCreemCheckoutCompletion({
    checkout: event.object,
    attempt,
    environment: configuration.environment,
    productId: configuration.productId,
  });
  if (await isAccountDeletionMarked(attempt.userId)) {
    const reconciliationLease = await claimAccountBillingOperationDuringAccountDeletion(
      attempt.userId,
      'creem',
      'reconciliation',
    );
    if (!reconciliationLease) {
      throw new CreemProviderRequestError(
        'Another billing operation is reconciling this deleted account.',
        'unavailable',
      );
    }
    try {
      const reconciliationGeneration = await allocateBillingReconciliationGeneration();
      const current = await retrieveCreemSubscription(configuration, completion.subscriptionId);
      assertCreemDeletionSubscriptionIdentity({
        subscription: current,
        subscriptionId: completion.subscriptionId,
        customerId: completion.customerId,
        productId: configuration.productId,
        environment: configuration.environment,
      });
      const stopped = creemSubscriptionRenewalIsStopped(current)
        ? current
        : await cancelCreemSubscription(configuration, completion.subscriptionId);
      if (!creemSubscriptionRenewalIsStopped(stopped)) {
        throw new CreemProviderRequestError(
          'Creem did not confirm that renewal is stopped for the deleted account.',
          'indeterminate',
        );
      }
      await saveCreemProviderAccountDuringAccountDeletion({
        userId: attempt.userId,
        environment: configuration.environment,
        providerCustomerId: completion.customerId,
        reconciledAt: new Date(),
      });
      await updateCheckoutAttemptDuringAccountDeletion({
        id: attempt.id,
        userId: attempt.userId,
        status: 'indeterminate',
        providerCustomerId: completion.customerId,
        providerCheckoutId: completion.checkoutId,
        providerEventAt: event.createdAt,
      });
      const normalized = await normalizedCreemSubscription({
        configuration,
        event,
        subscription: stopped,
      });
      if (!normalized) {
        throw new CreemProviderRequestError(
          'Deleted-account checkout subscription is outside the configured product.',
          'inconsistent',
        );
      }
      await upsertCreemSubscriptionDuringAccountDeletion(
        normalized,
        reconciliationGeneration,
      );
      await completeWebhookEvent(lease);
      billingLog('info', {
        action: 'deleted_account_checkout_stopped',
        provider: 'creem',
        store: normalized.store,
        userId: normalized.userId,
        eventId: event.id,
        eventType: event.type,
        providerSubscriptionId: normalized.providerSubscriptionId,
        productId: normalized.productId,
        plan: normalized.plan,
        normalizedStatus: normalized.status,
        providerEventAt: normalized.providerEventAt,
        reconciledAt: normalized.lastReconciledAt,
      });
      return true;
    } finally {
      await releaseAccountBillingOperation(reconciliationLease).catch(() => undefined);
    }
  }
  await commitWebhookCheckoutLink({
    lease,
    userId: attempt.userId,
    checkoutAttemptId: attempt.id,
    providerCheckoutId: completion.checkoutId,
    providerCustomerId: completion.customerId,
    providerEventAt: event.createdAt,
  });
  return true;
}

async function authoritativeAdverseStatus(
  configuration: CreemConfiguration,
  event: CreemEvent,
  subscription: JsonObject,
  kind: 'refund' | 'dispute',
): Promise<{
  status: 'refunded' | 'revoked';
  paidPeriod: { start: Date; end: Date };
} | null> {
  const transaction = isObject(event.object.transaction) ? event.object.transaction : event.object;
  const transactionId = stringValue(transaction.id);
  if (!transactionId) throw new Error(`Creem ${kind} event is missing a transaction id.`);
  const current = await retrieveCreemTransaction(configuration, transactionId);
  const subscriptionId = stringValue(subscription.id);
  const customerId = nestedId(subscription.customer);
  const transactionCustomerId = nestedId(current.customer);
  const transactionMode = stringValue(current.mode)?.toLowerCase();
  const modeMatches = configuration.environment === 'production'
    ? transactionMode === 'prod' || transactionMode === 'production'
    : ['test', 'sandbox', 'local'].includes(transactionMode ?? '');
  if (
    !subscriptionId
    || productIdOfSubscription(subscription) !== configuration.productId
    || stringValue(current.id) !== transactionId
    || nestedId(current.subscription) !== subscriptionId
    || (transactionCustomerId && transactionCustomerId !== customerId)
    || stringValue(current.type)?.toLowerCase() !== 'invoice'
    || numberValue(current.amount) !== 1_000
    || stringValue(current.currency)?.toUpperCase() !== 'USD'
    || !modeMatches
  ) {
    throw new CreemProviderRequestError(
      `Creem ${kind} transaction does not match the configured subscription.`,
      'inconsistent',
    );
  }
  const existing = await getProviderSubscription(
    'creem',
    configuration.environment,
    subscriptionId,
  );
  // An adverse transaction for an older renewal must not revoke a later paid
  // period. Compare to Girapphe's verified paid boundary, never a nominal
  // provider period that may already have advanced without payment.
  const decision = creemAdverseTransactionAccessDecision({
    kind,
    transaction: current,
    verifiedPeriodStart: existing?.paidPeriodVerified
      ? existing.currentPeriodStart
      : null,
    verifiedPeriodEnd: existing?.paidPeriodVerified
      ? existing.currentPeriodEnd
      : null,
  });
  if (decision === 'indeterminate') {
    throw new CreemProviderRequestError(
      `Creem ${kind} could not be matched safely to the verified paid period.`,
      'indeterminate',
    );
  }
  if (decision !== 'revoke') return null;
  const start = providerTimestampValue(current.period_start);
  const end = providerTimestampValue(current.period_end);
  if (!start || !end || end.getTime() <= start.getTime()) {
    throw new CreemProviderRequestError(
      `Creem ${kind} transaction is missing a valid paid period.`,
      'inconsistent',
    );
  }
  return {
    status: kind === 'refund' ? 'refunded' : 'revoked',
    paidPeriod: { start, end },
  };
}

async function claimCreemReconciliationLease(userId: string) {
  if (await isAccountDeletionMarked(userId)) {
    return claimAccountBillingOperationDuringAccountDeletion(
      userId,
      'creem',
      'reconciliation',
    );
  }
  const activeLease = await claimAccountBillingOperation(
    userId,
    'creem',
    'reconciliation',
  );
  if (activeLease) return activeLease;
  // Deletion can commit between the first marker read and the active-account
  // claim. Retry only through the marker-asserted lifecycle path; if another
  // operation owns the lease, both paths simply remain busy.
  return await isAccountDeletionMarked(userId)
    ? claimAccountBillingOperationDuringAccountDeletion(
      userId,
      'creem',
      'reconciliation',
    )
    : null;
}

export async function processCreemEvent(
  event: CreemEvent,
  lease: WebhookEventLease,
): Promise<{ handled: boolean; subscriptionId: string | null }> {
  const configuration = creemConfiguration();
  if (lease.provider !== 'creem' || lease.environment !== configuration.environment) {
    throw new Error('Creem webhook lease environment mismatch.');
  }
  if (event.type === 'checkout.completed') {
    return {
      handled: await processCheckoutCompleted(configuration, event, lease),
      subscriptionId: subscriptionIdFromCreemEvent(event),
    };
  }

  const subscriptionId = subscriptionIdFromCreemEvent(event);
  if (!subscriptionId) return { handled: false, subscriptionId: null };
  // Resolve the account without mutating state, then serialize the entire
  // authoritative refetch -> existing-row read -> normalize -> commit path.
  // This prevents a later-started Worker with a stale provider response from
  // winning merely because it allocated a newer local generation.
  const preliminarySubscription = await retrieveCreemSubscription(configuration, subscriptionId);
  if (productIdOfSubscription(preliminarySubscription) !== configuration.productId) {
    return { handled: false, subscriptionId };
  }
  statusOfSubscription(preliminarySubscription);
  const preliminaryOwner = await resolveCreemUser(preliminarySubscription, configuration);
  const reconciliationLease = await claimCreemReconciliationLease(preliminaryOwner.userId);
  if (!reconciliationLease) {
    throw new CreemProviderRequestError(
      'Another billing operation is reconciling this account.',
      'unavailable',
    );
  }

  try {
    const reconciliationGeneration = await allocateBillingReconciliationGeneration();
    const subscription = await retrieveCreemSubscription(configuration, subscriptionId);
    const lockedOwner = await resolveCreemUser(subscription, configuration);
    if (
      lockedOwner.userId !== preliminaryOwner.userId
      || lockedOwner.customerId !== preliminaryOwner.customerId
    ) {
      throw new CreemProviderRequestError(
        'Creem subscription ownership changed during reconciliation.',
        'inconsistent',
      );
    }
    const lifecycleSubscription = selectCreemLifecycleSubscription({
      event,
      authoritativeSubscription: subscription,
      expectedSubscriptionId: subscriptionId,
      expectedProductId: configuration.productId,
      environment: configuration.environment,
    });
    let paidPeriod: { start: Date; end: Date } | null = null;
    if (event.type === 'subscription.paid') {
      const transactionId = stringValue(event.object.last_transaction_id);
      if (!transactionId) {
        throw new CreemProviderRequestError(
          'Creem paid event is missing its paid transaction id.',
          'indeterminate',
        );
      }
      const transaction = await retrieveCreemTransaction(configuration, transactionId);
      paidPeriod = verifiedCreemPaidPeriod({
        eventSubscription: event.object,
        transaction,
        expectedSubscriptionId: subscriptionId,
        expectedProductId: configuration.productId,
        environment: configuration.environment,
      });
    }
    let forcedStatus: 'refunded' | 'revoked' | undefined;
    if (event.type === 'refund.created') {
      const adverse = await authoritativeAdverseStatus(
        configuration,
        event,
        subscription,
        'refund',
      );
      forcedStatus = adverse?.status;
      paidPeriod = adverse?.paidPeriod ?? paidPeriod;
    } else if (event.type === 'dispute.created') {
      const adverse = await authoritativeAdverseStatus(
        configuration,
        event,
        subscription,
        'dispute',
      );
      forcedStatus = adverse?.status;
      paidPeriod = adverse?.paidPeriod ?? paidPeriod;
    }
    let normalized = await normalizedCreemSubscription({
      configuration,
      event,
      subscription: lifecycleSubscription,
      forcedStatus,
      paidPeriod,
    });
    if (!normalized) return { handled: false, subscriptionId };

    if (await isAccountDeletionMarked(normalized.userId)) {
      if (!creemSubscriptionRenewalIsStopped(subscription)) {
        const canceled = await cancelCreemSubscription(configuration, subscriptionId);
        normalized = await normalizedCreemSubscription({
          configuration,
          event: { ...event, createdAt: new Date() },
          subscription: canceled,
          paidPeriod,
        });
        if (!normalized) return { handled: false, subscriptionId };
      }
      await upsertCreemSubscriptionDuringAccountDeletion(normalized, reconciliationGeneration);
      await completeWebhookEvent(lease);
      billingLog('info', {
        action: 'deleted_account_subscription_stopped',
        provider: 'creem',
        store: normalized.store,
        userId: normalized.userId,
        eventId: event.id,
        eventType: event.type,
        providerSubscriptionId: normalized.providerSubscriptionId,
        productId: normalized.productId,
        plan: normalized.plan,
        normalizedStatus: normalized.status,
        providerEventAt: normalized.providerEventAt,
        reconciledAt: normalized.lastReconciledAt,
      });
      return { handled: true, subscriptionId };
    }

    await commitWebhookSubscriptionReconciliation(normalized, lease, reconciliationGeneration);
    billingLog('info', {
      action: 'subscription_reconciled',
      provider: 'creem',
      store: normalized.store,
      userId: normalized.userId,
      eventId: event.id,
      eventType: event.type,
      providerSubscriptionId: normalized.providerSubscriptionId,
      productId: normalized.productId,
      plan: normalized.plan,
      normalizedStatus: normalized.status,
      providerEventAt: normalized.providerEventAt,
      reconciledAt: normalized.lastReconciledAt,
    });
    return { handled: true, subscriptionId };
  } finally {
    await releaseAccountBillingOperation(reconciliationLease).catch(() => undefined);
  }
}

async function cancelCreemSubscription(
  configuration: CreemConfiguration,
  subscriptionId: string,
): Promise<JsonObject> {
  const response = await creemRequest(
    configuration,
    'POST',
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    { mode: 'scheduled', onExecute: 'cancel' },
  );
  if (creemSubscriptionRenewalIsStopped(response)) return response;

  // A 2xx response alone is not proof that renewal stopped. Confirm against
  // the authoritative resource before allowing account deletion to continue.
  const current = await retrieveCreemSubscription(configuration, subscriptionId);
  if (!creemSubscriptionRenewalIsStopped(current)) {
    throw new CreemProviderRequestError(
      'Creem did not confirm that subscription renewal is stopped.',
      'indeterminate',
    );
  }
  return current;
}

export function creemSubscriptionRenewalIsStopped(subscription: JsonObject): boolean {
  const status = stringValue(subscription.status)?.toLowerCase();
  if (status && ['scheduled_cancel', 'canceled', 'expired'].includes(status)) return true;
  return subscription.cancel_at_period_end === true
    || subscription.cancel_at_period === true;
}

export async function handleCreemReconciliationOutage(
  subscriptionId: string | null,
): Promise<boolean> {
  if (!subscriptionId) return false;
  const configuration = creemConfiguration();
  return grantFixedSubscriptionGrace({
    provider: 'creem',
    environment: configuration.environment,
    providerSubscriptionId: subscriptionId,
    reason: 'verification',
    hours: 24,
  });
}

async function retrieveCreemCheckout(
  configuration: CreemConfiguration,
  checkoutId: string,
): Promise<JsonObject> {
  return creemRequest(
    configuration,
    'GET',
    `/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`,
  );
}

async function retrieveCreemCustomerSubscriptions(
  configuration: CreemConfiguration,
  customerId: string,
): Promise<JsonObject[]> {
  const subscriptions: JsonObject[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const response = await creemRequest(
      configuration,
      'GET',
      `/customers/${encodeURIComponent(customerId)}/subscriptions?page_number=${page}&page_size=100`,
    );
    const parsed = parseCreemCustomerSubscriptionsPage({
      response,
      customerId,
      environment: configuration.environment,
      page,
    });
    subscriptions.push(...parsed.items);
    if (page >= parsed.totalPages) return subscriptions;
  }
  throw new CreemProviderRequestError(
    'Creem customer subscriptions exceeded the reconciliation page limit.',
    'indeterminate',
  );
}

function creemModeMatchesEnvironment(value: unknown, environment: BillingEnvironment): boolean {
  const mode = stringValue(value)?.toLowerCase();
  return environment === 'production'
    ? mode === 'prod' || mode === 'production'
    : mode === 'test' || mode === 'sandbox' || mode === 'local';
}

export function parseCreemCustomerSubscriptionsPage(input: {
  response: JsonObject;
  customerId: string;
  environment: BillingEnvironment;
  page: number;
}): { items: JsonObject[]; totalPages: number } {
  const pagination = isObject(input.response.pagination) ? input.response.pagination : null;
  const totalPages = numberValue(pagination?.total_pages);
  const currentPage = numberValue(pagination?.current_page);
  if (
    !Array.isArray(input.response.items)
    || !input.response.items.every(isObject)
    || totalPages === null
    || !Number.isSafeInteger(totalPages)
    || totalPages < 0
    || currentPage === null
    || !Number.isSafeInteger(currentPage)
    || currentPage !== input.page
    || (totalPages === 0 && input.response.items.length > 0)
    || (totalPages > 0 && input.page > totalPages)
  ) {
    throw new CreemProviderRequestError(
      'Creem customer subscription pagination is invalid.',
      'inconsistent',
    );
  }
  for (const item of input.response.items) {
    if (
      item.object !== 'subscription'
      || !stringValue(item.id)
      || nestedId(item.customer) !== input.customerId
      || !creemModeMatchesEnvironment(item.mode, input.environment)
    ) {
      throw new CreemProviderRequestError(
        'Creem customer subscription list contains an invalid or foreign item.',
        'inconsistent',
      );
    }
    statusOfSubscription(item);
  }
  return { items: input.response.items, totalPages };
}

export function assertCreemDeletionSubscriptionIdentity(input: {
  subscription: JsonObject;
  subscriptionId: string;
  customerId: string;
  productId: string;
  environment: BillingEnvironment;
}): void {
  if (
    input.subscription.object !== 'subscription'
    || stringValue(input.subscription.id) !== input.subscriptionId
    || nestedId(input.subscription.customer) !== input.customerId
    || productIdOfSubscription(input.subscription) !== input.productId
    || !creemModeMatchesEnvironment(input.subscription.mode, input.environment)
  ) {
    throw new CreemProviderRequestError(
      'Creem subscription is not the owned annual subscription selected for deletion.',
      'inconsistent',
    );
  }
  statusOfSubscription(input.subscription);
}

export async function cancelCreemRenewalForAccountDeletion(userId: string): Promise<number> {
  const reconciliationLease = await claimAccountBillingOperationDuringAccountDeletion(
    userId,
    'creem',
    'reconciliation',
  );
  if (!reconciliationLease) {
    throw new CreemProviderRequestError(
      'Another billing operation is reconciling this deleted account.',
      'unavailable',
    );
  }
  try {
    return await cancelCreemRenewalForAccountDeletionUnderLease(userId);
  } finally {
    await releaseAccountBillingOperation(reconciliationLease).catch(() => undefined);
  }
}

async function cancelCreemRenewalForAccountDeletionUnderLease(userId: string): Promise<number> {
  const configuration = creemConfiguration();
  const subscriptionIds = new Set(await getProviderSubscriptionIdsForUser(
    userId,
    'creem',
    configuration.environment,
  ));
  const providerCustomerIds = new Set(await getProviderCustomerIds(
    userId,
    'creem',
    configuration.environment,
  ));
  for (const providerCustomerId of providerCustomerIds) {
    const remoteSubscriptions = await retrieveCreemCustomerSubscriptions(
      configuration,
      providerCustomerId,
    );
    for (const subscription of remoteSubscriptions) {
      if (productIdOfSubscription(subscription) !== configuration.productId) continue;
      const subscriptionId = stringValue(subscription.id);
      if (subscriptionId) subscriptionIds.add(subscriptionId);
    }
  }
  const unresolved = await getUnresolvedCheckoutAttempt(userId);
  if (unresolved?.provider === 'creem') {
    if (!unresolved.providerCheckoutId) {
      throw new PendingCheckoutError('An indeterminate Creem checkout must be reconciled first.');
    }
    const checkout = await retrieveCreemCheckout(configuration, unresolved.providerCheckoutId);
    const disposition = creemCheckoutDisposition(checkout, {
      attemptId: unresolved.id,
      checkoutId: unresolved.providerCheckoutId,
      productId: configuration.productId,
    });
    if (disposition.kind === 'expired') {
      await updateCheckoutAttemptDuringAccountDeletion({
        id: unresolved.id,
        userId,
        status: 'expired',
      });
    } else if (
      disposition.kind === 'completed'
      && disposition.subscriptionId
      && disposition.customerId
    ) {
      await saveCreemProviderAccountDuringAccountDeletion({
        userId,
        environment: configuration.environment,
        providerCustomerId: disposition.customerId,
        reconciledAt: new Date(),
      });
      providerCustomerIds.add(disposition.customerId);
      subscriptionIds.add(disposition.subscriptionId);
      await updateCheckoutAttemptDuringAccountDeletion({
        id: unresolved.id,
        userId,
        status: 'indeterminate',
        providerCustomerId: disposition.customerId,
        providerCheckoutId: unresolved.providerCheckoutId,
      });
    } else {
      throw new PendingCheckoutError('A Creem checkout is still pending.');
    }
  }

  let canceledCount = 0;
  for (const subscriptionId of subscriptionIds) {
    const reconciliationGeneration = await allocateBillingReconciliationGeneration();
    const current = await retrieveCreemSubscription(configuration, subscriptionId);
    const currentCustomerId = nestedId(current.customer);
    if (!currentCustomerId) {
      throw new CreemProviderRequestError(
        'Creem subscription is missing its owner before account deletion.',
        'inconsistent',
      );
    }
    assertCreemDeletionSubscriptionIdentity({
      subscription: current,
      subscriptionId,
      customerId: currentCustomerId,
      productId: configuration.productId,
      environment: configuration.environment,
    });
    const owned = providerCustomerIds.has(currentCustomerId)
      && await providerCustomerBelongsToUser({
        userId,
        provider: 'creem',
        environment: configuration.environment,
        providerCustomerId: currentCustomerId,
      });
    if (!owned) {
      throw new CreemProviderRequestError(
        'Creem subscription owner was not verified before account deletion.',
        'inconsistent',
      );
    }
    const event: CreemEvent = {
      id: `account-deletion:${subscriptionId}`,
      type: 'subscription.scheduled_cancel',
      createdAt: new Date(),
      object: current,
    };
    const canceled = creemSubscriptionRenewalIsStopped(current)
      ? current
      : await cancelCreemSubscription(configuration, subscriptionId);
    if (!creemSubscriptionRenewalIsStopped(canceled)) {
      throw new CreemProviderRequestError(
        'Creem did not confirm that renewal is stopped for account deletion.',
        'indeterminate',
      );
    }
    if (canceled !== current) canceledCount += 1;
    const normalized = await normalizedCreemSubscription({ configuration, event, subscription: canceled });
    if (normalized) {
      await upsertCreemSubscriptionDuringAccountDeletion(normalized, reconciliationGeneration);
    }
  }
  return canceledCount;
}
