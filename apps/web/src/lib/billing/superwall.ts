import 'server-only';

import {
  AD_FREE_ENTITLEMENT,
  allocateBillingReconciliationGeneration,
  commitDeletedAccountSuperwallSnapshot,
  commitWebhookSubscriptionSnapshot,
  currentBillingEnvironment,
  findUserIdByProviderCustomer,
  getProviderSubscriptionIdsForUser,
  getProviderSubscriptionByCorrelation,
  grantFixedSubscriptionGrace,
  isAccountDeletionMarked,
  reconcileAuthoritativeSubscriptions,
  requireBillingEntitlementState,
  saveProviderAccount,
  type BillingEnvironment,
  type BillingPlan,
  type BillingStatus,
  type BillingStore,
  type SubscriptionWrite,
  type WebhookEventLease,
} from '@/lib/billing/database';
import { readBoundedResponseJson } from '@/lib/billing/bounded-json';
import { billingLog } from '@/lib/billing/logging';

type JsonObject = Record<string, unknown>;

const SUPERWALL_API_BASE_URL = 'https://api.superwall.com';
const MAX_PROVIDER_RESPONSE_BYTES = 1_048_576;
// One page contains up to 100 records. Five pages is already far beyond the
// expected Apple/Google subscription history for one Girapphe account while
// keeping one authenticated request from amplifying into 50 provider calls.
const MAX_SUBSCRIPTION_PAGES = 5;
const SUPERWALL_PROVIDER_TIMEOUT_MS = 10_000;

const SUPERWALL_EVENTS = new Set([
  'initial_purchase',
  'renewal',
  'cancellation',
  'uncancellation',
  'expiration',
  'billing_issue',
  'product_change',
  'subscription_paused',
  'non_renewing_purchase',
] as const);

type SuperwallStoreName = 'APP_STORE' | 'PLAY_STORE';
type SuperwallEventType =
  | 'initial_purchase'
  | 'renewal'
  | 'cancellation'
  | 'uncancellation'
  | 'expiration'
  | 'billing_issue'
  | 'product_change'
  | 'subscription_paused'
  | 'non_renewing_purchase';

type SuperwallPlatformConfiguration = {
  applicationId: number;
  bundleId: string;
  storeName: SuperwallStoreName;
  store: Extract<BillingStore, 'app_store' | 'play_store'>;
  monthlyProductId: string;
  annualProductId: string;
};

type SuperwallConfiguration = {
  organizationApiKey: string;
  webhookSecret: string;
  projectId: number;
  environment: BillingEnvironment;
  platforms: readonly [SuperwallPlatformConfiguration, SuperwallPlatformConfiguration];
};

export type SuperwallEvent = {
  id: string;
  type: SuperwallEventType;
  projectId: number;
  applicationId: number;
  createdAt: Date;
  providerEventAt: Date;
  originalAppUserId: string | null;
  providerRootTransactionId: string;
  transactionId: string;
  storeName: SuperwallStoreName;
  environment: BillingEnvironment;
  bundleId: string;
  productId: string;
  newProductId: string | null;
  price: number;
};

export class SuperwallConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuperwallConfigurationError';
  }
}

export class SuperwallProviderRequestError extends Error {
  constructor(
    message: string,
    readonly outcome: 'definite_rejection' | 'unavailable' | 'inconsistent',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SuperwallProviderRequestError';
  }
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function timestampValue(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = Math.abs(value) < 1_000_000_000_000 ? value * 1_000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return timestampValue(numeric);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(...values: Array<Date | null>): Date | null {
  return values.reduce<Date | null>((latest, candidate) => (
    candidate && (!latest || candidate.getTime() > latest.getTime()) ? candidate : latest
  ), null);
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new SuperwallConfigurationError(`${name} is not configured.`);
  return value;
}

function requiredPositiveInteger(name: string): number {
  const raw = requiredEnvironment(name);
  if (!/^\d+$/.test(raw)) {
    throw new SuperwallConfigurationError(`${name} must be a positive integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new SuperwallConfigurationError(`${name} must be a positive integer.`);
  }
  return value;
}

export function configuredSuperwallEnvironment(): BillingEnvironment {
  const value = requiredEnvironment('SUPERWALL_ENVIRONMENT');
  if (value !== 'test' && value !== 'production') {
    throw new SuperwallConfigurationError('SUPERWALL_ENVIRONMENT must be test or production.');
  }
  const expected = currentBillingEnvironment();
  if (value !== expected) {
    throw new SuperwallConfigurationError(
      `SUPERWALL_ENVIRONMENT=${value} cannot run in the ${expected} Girapphe environment.`,
    );
  }
  return value;
}

function platformConfiguration(input: {
  prefix: 'IOS' | 'ANDROID';
  storeName: SuperwallStoreName;
  store: SuperwallPlatformConfiguration['store'];
  bundleVariable: 'SUPERWALL_IOS_BUNDLE_ID' | 'SUPERWALL_ANDROID_PACKAGE_ID';
}): SuperwallPlatformConfiguration {
  const monthlyProductId = requiredEnvironment(`SUPERWALL_${input.prefix}_MONTHLY_PRODUCT_ID`);
  const annualProductId = requiredEnvironment(`SUPERWALL_${input.prefix}_ANNUAL_PRODUCT_ID`);
  if (monthlyProductId === annualProductId) {
    throw new SuperwallConfigurationError(
      `SUPERWALL_${input.prefix}_MONTHLY_PRODUCT_ID and annual product id must differ.`,
    );
  }
  return {
    applicationId: requiredPositiveInteger(`SUPERWALL_${input.prefix}_APPLICATION_ID`),
    bundleId: requiredEnvironment(input.bundleVariable),
    storeName: input.storeName,
    store: input.store,
    monthlyProductId,
    annualProductId,
  };
}

function superwallConfiguration(): SuperwallConfiguration {
  const environment = configuredSuperwallEnvironment();
  return {
    organizationApiKey: requiredEnvironment('SUPERWALL_ORGANIZATION_API_KEY'),
    webhookSecret: requiredEnvironment('SUPERWALL_WEBHOOK_SECRET'),
    projectId: requiredPositiveInteger('SUPERWALL_PROJECT_ID'),
    environment,
    platforms: [
      platformConfiguration({
        prefix: 'IOS',
        storeName: 'APP_STORE',
        store: 'app_store',
        bundleVariable: 'SUPERWALL_IOS_BUNDLE_ID',
      }),
      platformConfiguration({
        prefix: 'ANDROID',
        storeName: 'PLAY_STORE',
        store: 'play_store',
        bundleVariable: 'SUPERWALL_ANDROID_PACKAGE_ID',
      }),
    ],
  };
}

export function getSuperwallWebhookConfiguration(): {
  secret: string;
  environment: BillingEnvironment;
} {
  const configuration = superwallConfiguration();
  return { secret: configuration.webhookSecret, environment: configuration.environment };
}

export function isSuperwallLifecycleConfigured(): boolean {
  try {
    if (!process.env.DATABASE_URL) return false;
    superwallConfiguration();
    return true;
  } catch {
    return false;
  }
}

export function isSuperwallAcquisitionEnabled(): boolean {
  return process.env.MOBILE_BILLING_ACQUISITION_ENABLED === 'true'
    && isSuperwallLifecycleConfigured();
}

export function isTrustedBillingMutationRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return /^Bearer\s+\S+$/i.test(request.headers.get('authorization') ?? '');
  try {
    const configured = process.env.APP_BASE_URL?.trim();
    const expected = configured ? new URL(configured).origin : new URL(request.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

function eventEnvironment(value: unknown): BillingEnvironment | null {
  if (value === 'PRODUCTION') return 'production';
  if (value === 'SANDBOX') return 'test';
  return null;
}

function snapshotEnvironment(value: unknown): BillingEnvironment | null {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === 'production') return 'production';
  if (normalized === 'sandbox' || normalized === 'test') return 'test';
  return null;
}

export function parseSuperwallEvent(payload: unknown): SuperwallEvent | null {
  if (!isObject(payload) || !isObject(payload.data)) return null;
  const data = payload.data;
  const type = stringValue(payload.type);
  const dataName = stringValue(data.name);
  const storeName = stringValue(data.store);
  const environment = eventEnvironment(data.environment);
  const createdAt = timestampValue(payload.timestamp);
  const providerEventAt = timestampValue(data.ts);
  const projectId = numberValue(payload.projectId);
  const applicationId = numberValue(payload.applicationId);
  const price = numberValue(data.price);
  if (
    !type
    || !SUPERWALL_EVENTS.has(type as SuperwallEventType)
    || dataName !== type
    || (storeName !== 'APP_STORE' && storeName !== 'PLAY_STORE')
    || !environment
    || !createdAt
    || !providerEventAt
    || projectId === null
    || applicationId === null
    || !Number.isSafeInteger(projectId)
    || !Number.isSafeInteger(applicationId)
    || price === null
  ) return null;

  const id = stringValue(data.id);
  const providerRootTransactionId = stringValue(data.originalTransactionId);
  const transactionId = stringValue(data.transactionId);
  const bundleId = stringValue(data.bundleId);
  const productId = stringValue(data.productId);
  if (!id || !providerRootTransactionId || !transactionId || !bundleId || !productId) return null;

  return {
    id,
    type: type as SuperwallEventType,
    projectId,
    applicationId,
    createdAt,
    providerEventAt,
    originalAppUserId: stringValue(data.originalAppUserId),
    providerRootTransactionId,
    transactionId,
    storeName,
    environment,
    bundleId,
    productId,
    newProductId: stringValue(data.newProductId),
    price,
  };
}

function platformForEvent(
  configuration: SuperwallConfiguration,
  event: SuperwallEvent,
): SuperwallPlatformConfiguration | null {
  return configuration.platforms.find((candidate) => (
    candidate.applicationId === event.applicationId
    && candidate.storeName === event.storeName
    && candidate.bundleId === event.bundleId
  )) ?? null;
}

function platformHasProduct(
  platform: SuperwallPlatformConfiguration,
  productId: string | null,
): boolean {
  return Boolean(productId) && (
    productId === platform.monthlyProductId || productId === platform.annualProductId
  );
}

export function isSuperwallEventInScope(event: SuperwallEvent): boolean {
  const configuration = superwallConfiguration();
  if (event.projectId !== configuration.projectId || event.environment !== configuration.environment) {
    return false;
  }
  const platform = platformForEvent(configuration, event);
  return Boolean(platform && (
    platformHasProduct(platform, event.productId)
    || platformHasProduct(platform, event.newProductId)
  ));
}

export async function readSuperwallResponse(
  response: Response,
  options?: { notFoundAsEmpty?: boolean },
): Promise<JsonObject> {
  const result = await readBoundedResponseJson(response, MAX_PROVIDER_RESPONSE_BYTES);
  const payload = result.ok ? result.value : null;
  if (
    options?.notFoundAsEmpty
    && response.status === 404
    && isObject(payload)
    && payload._tag === '@superwall/api-schema/v2/errors/RcResourceMissing'
    && Boolean(stringValue(payload.message))
    && (payload.object === undefined || payload.object === 'error')
    && (payload.type === undefined || payload.type === 'resource_missing')
    && (payload.retryable === undefined || payload.retryable === false)
  ) {
    return { object: 'list', url: '/resource-missing', items: [], next_page: null };
  }
  if (!response.ok || !isObject(payload)) {
    const message = isObject(payload)
      ? stringValue(payload.message) ?? stringValue(payload.error)
      : null;
    const indeterminate = response.ok
      || response.status === 408
      || response.status === 429
      || response.status >= 500;
    throw new SuperwallProviderRequestError(
      message ?? `Superwall request failed with status ${response.status}.`,
      indeterminate ? 'unavailable' : 'definite_rejection',
    );
  }
  return payload;
}

async function superwallGet(
  configuration: SuperwallConfiguration,
  url: URL,
  options?: { notFoundAsEmpty?: boolean },
): Promise<JsonObject> {
  if (url.protocol !== 'https:' || url.origin !== SUPERWALL_API_BASE_URL) {
    throw new SuperwallProviderRequestError('Superwall pagination returned an untrusted URL.', 'inconsistent');
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Superwall request timed out.')),
    SUPERWALL_PROVIDER_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${configuration.organizationApiKey}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    return await readSuperwallResponse(response, options);
  } catch (error) {
    if (error instanceof SuperwallProviderRequestError) throw error;
    throw new SuperwallProviderRequestError(
      controller.signal.aborted
        ? 'Superwall request timed out.'
        : 'Superwall request outcome is indeterminate.',
      'unavailable',
      { cause: error },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function nextPageUrl(value: unknown): URL | null {
  const raw = stringValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw, SUPERWALL_API_BASE_URL);
    return url.protocol === 'https:'
      && url.origin === SUPERWALL_API_BASE_URL
      && !url.username
      && !url.password
      && !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
}

function isExpectedSubscriptionNextPage(nextPage: URL, expectedUrl: URL): boolean {
  const allowedParameters = new Set(['limit', 'starting_after']);
  const parameterNames = [...nextPage.searchParams.keys()];
  return nextPage.pathname === expectedUrl.pathname
    && parameterNames.every((name) => allowedParameters.has(name))
    && nextPage.searchParams.getAll('starting_after').length === 1
    && Boolean(nextPage.searchParams.get('starting_after'))
    && nextPage.searchParams.getAll('limit').length <= 1
    && (
      !nextPage.searchParams.has('limit')
      || nextPage.searchParams.get('limit') === '100'
    );
}

export function parseSuperwallSubscriptionPage(
  response: JsonObject,
  expectedUrl?: URL,
): { items: JsonObject[]; nextPage: URL | null } {
  if (
    response.object !== 'list'
    || !stringValue(response.url)
    || !Array.isArray(response.items)
    || !response.items.every(isObject)
    || !Object.prototype.hasOwnProperty.call(response, 'next_page')
    || !(response.next_page === null || typeof response.next_page === 'string')
  ) {
    throw new SuperwallProviderRequestError('Superwall subscription response is invalid.', 'inconsistent');
  }
  if (expectedUrl && response.url !== '/resource-missing') {
    const responseUrl = nextPageUrl(response.url);
    if (!responseUrl || responseUrl.pathname !== expectedUrl.pathname) {
      throw new SuperwallProviderRequestError(
        'Superwall subscription response URL does not match the requested customer.',
        'inconsistent',
      );
    }
  }
  const rawNext = stringValue(response.next_page);
  const nextPage = nextPageUrl(rawNext);
  if (rawNext && !nextPage) {
    throw new SuperwallProviderRequestError('Superwall pagination URL is invalid.', 'inconsistent');
  }
  if (nextPage && expectedUrl && !isExpectedSubscriptionNextPage(nextPage, expectedUrl)) {
    throw new SuperwallProviderRequestError(
      'Superwall pagination URL escaped the requested customer subscription scope.',
      'inconsistent',
    );
  }
  return { items: response.items, nextPage };
}

async function retrieveSuperwallSubscriptions(
  configuration: SuperwallConfiguration,
  userId: string,
): Promise<JsonObject[]> {
  if (!userId.startsWith('user_')) throw new Error('A Clerk user id is required for reconciliation.');
  const subscriptions: JsonObject[] = [];
  let nextUrl: URL | null = new URL(
    `/revenuecat/projects/${configuration.projectId}/customers/${encodeURIComponent(userId)}/subscriptions?limit=100`,
    SUPERWALL_API_BASE_URL,
  );
  const seen = new Set<string>();
  for (let page = 0; nextUrl && page < MAX_SUBSCRIPTION_PAGES; page += 1) {
    if (seen.has(nextUrl.toString())) {
      throw new SuperwallProviderRequestError('Superwall pagination loop was detected.', 'inconsistent');
    }
    seen.add(nextUrl.toString());
    const response = await superwallGet(configuration, nextUrl, { notFoundAsEmpty: page === 0 });
    const pageResult = parseSuperwallSubscriptionPage(response, nextUrl);
    subscriptions.push(...pageResult.items);
    nextUrl = pageResult.nextPage;
  }
  if (nextUrl) {
    throw new SuperwallProviderRequestError(
      'Superwall subscriptions exceeded the reconciliation page limit.',
      'inconsistent',
    );
  }
  return subscriptions;
}

function itemPlatform(
  configuration: SuperwallConfiguration,
  item: JsonObject,
): SuperwallPlatformConfiguration | null {
  const store = stringValue(item.store)?.toLowerCase();
  if (store !== 'app_store' && store !== 'play_store') return null;
  return configuration.platforms.find((candidate) => candidate.store === store) ?? null;
}

function planForProduct(
  platform: SuperwallPlatformConfiguration,
  productId: string,
): BillingPlan | null {
  if (productId === platform.monthlyProductId) return 'monthly';
  if (productId === platform.annualProductId) return 'annual';
  return null;
}

function itemHasAdFree(item: JsonObject, expectedProjectId: number): boolean {
  const entitlements = isObject(item.entitlements) ? item.entitlements : null;
  if (
    !entitlements
    || entitlements.object !== 'list'
    || !stringValue(entitlements.url)
    || !Array.isArray(entitlements.items)
    || entitlements.next_page !== null
    || !entitlements.items.every((candidate) => (
      isObject(candidate)
      && candidate.object === 'entitlement'
      && stringValue(candidate.project_id) === String(expectedProjectId)
      && Boolean(stringValue(candidate.id))
      && Boolean(stringValue(candidate.lookup_key))
      && Object.prototype.hasOwnProperty.call(candidate, 'display_name')
      && (candidate.display_name === null || typeof candidate.display_name === 'string')
      && Object.prototype.hasOwnProperty.call(candidate, 'created_at')
      && (candidate.created_at === null || numberValue(candidate.created_at) !== null)
    ))
  ) {
    throw new SuperwallProviderRequestError(
      'Superwall subscription entitlements are malformed.',
      'inconsistent',
    );
  }
  return entitlements.items.some((candidate) => (
    isObject(candidate) && stringValue(candidate.lookup_key) === AD_FREE_ENTITLEMENT
  ));
}

function normalizeSuperwallSubscription(input: {
  configuration: SuperwallConfiguration;
  userId: string;
  item: JsonObject;
  snapshotEventAt: Date;
  reconciledAt: Date;
  providerEventId: string | null;
}): SubscriptionWrite | null {
  const objectType = stringValue(input.item.object);
  const itemEnvironment = snapshotEnvironment(input.item.environment);
  const storeName = stringValue(input.item.store)?.toLowerCase();
  const productId = stringValue(input.item.product_id);
  const providerSubscriptionId = stringValue(input.item.id);
  const providerStoreSubscriptionId = stringValue(input.item.store_subscription_identifier);
  const givesAccess = booleanValue(input.item.gives_access);
  const pendingPaymentValue = booleanValue(input.item.pending_payment);
  const providerStatus = stringValue(input.item.status)?.toLowerCase();
  const renewalStatus = stringValue(input.item.auto_renewal_status)?.toLowerCase();
  const customerId = stringValue(input.item.customer_id);
  const originalCustomerId = stringValue(input.item.original_customer_id);
  const ownership = stringValue(input.item.ownership)?.toLowerCase();
  const startsAtValue = numberValue(input.item.starts_at);
  const currentPeriodStartsAtValue = numberValue(input.item.current_period_starts_at);
  const hasCurrentPeriodEnd = Object.prototype.hasOwnProperty.call(input.item, 'current_period_ends_at');
  const hasEndsAt = Object.prototype.hasOwnProperty.call(input.item, 'ends_at');
  const currentPeriodEndsAtValue = input.item.current_period_ends_at === null
    ? null
    : numberValue(input.item.current_period_ends_at);
  const endsAtValue = input.item.ends_at === null ? null : numberValue(input.item.ends_at);
  if (
    objectType !== 'subscription'
    || !itemEnvironment
    || !storeName
    || !productId
    || !providerSubscriptionId
    || !providerStoreSubscriptionId
    || givesAccess === null
    || pendingPaymentValue === null
    || !providerStatus
    || !['trialing', 'active', 'expired', 'in_grace_period', 'in_billing_retry'].includes(providerStatus)
    || !renewalStatus
    || !['will_renew', 'will_not_renew'].includes(renewalStatus)
    || customerId !== input.userId
    || !originalCustomerId
    || ownership !== 'purchased'
    || startsAtValue === null
    || currentPeriodStartsAtValue === null
    || !hasCurrentPeriodEnd
    || (input.item.current_period_ends_at !== null && currentPeriodEndsAtValue === null)
    || !hasEndsAt
    || (input.item.ends_at !== null && endsAtValue === null)
    || input.item.total_revenue_in_usd !== null
    || input.item.presented_offering_id !== null
    || input.item.pending_changes !== null
    || input.item.country !== null
    || !(input.item.management_url === null || typeof input.item.management_url === 'string')
  ) {
    throw new SuperwallProviderRequestError('Superwall subscription state is incomplete or unknown.', 'inconsistent');
  }
  const startsAt = timestampValue(startsAtValue);
  const currentPeriodStart = timestampValue(currentPeriodStartsAtValue);
  const currentPeriodEnd = latestDate(
    timestampValue(currentPeriodEndsAtValue),
    timestampValue(endsAtValue),
  );
  if (
    !startsAt
    || !currentPeriodStart
    || currentPeriodStart.getTime() < startsAt.getTime()
    || (currentPeriodEnd && currentPeriodEnd.getTime() <= currentPeriodStart.getTime())
  ) {
    throw new SuperwallProviderRequestError(
      'Superwall subscription period is invalid.',
      'inconsistent',
    );
  }
  const configuredEntitlement = itemHasAdFree(input.item, input.configuration.projectId);
  const platform = itemPlatform(input.configuration, input.item);
  if (!platform || itemEnvironment !== input.configuration.environment) return null;
  const plan = planForProduct(platform, productId);
  if (!plan) return null;

  // The RC-v2 compatible resource id is stable for the subscription. Store
  // transaction/order identifiers can rotate on renewal and are correlations,
  // never the canonical row identity.
  const pendingPayment = pendingPaymentValue;

  const providerGrace = givesAccess
    && configuredEntitlement
    && providerStatus === 'in_grace_period';
  if (
    givesAccess
    && !providerGrace
    && (!currentPeriodEnd || currentPeriodEnd.getTime() <= input.reconciledAt.getTime())
  ) {
    throw new SuperwallProviderRequestError(
      'Superwall granted access without a future access-through timestamp.',
      'inconsistent',
    );
  }

  let status: BillingStatus;
  if (providerGrace) {
    status = 'past_due';
  } else if (givesAccess && configuredEntitlement) {
    if (providerStatus === 'trialing') status = 'trialing';
    else if (renewalStatus === 'will_not_renew') status = 'canceled';
    else status = 'active';
  } else if (providerStatus === 'expired') {
    status = 'expired';
  } else if (providerStatus === 'in_billing_retry' || pendingPayment) {
    status = 'past_due';
  } else {
    status = 'incomplete';
  }

  return {
    provider: 'superwall',
    environment: input.configuration.environment,
    providerCustomerId: input.userId,
    providerSubscriptionId,
    providerRootTransactionId: null,
    providerStoreSubscriptionId,
    providerEventId: input.providerEventId,
    userId: input.userId,
    store: platform.store,
    productId,
    plan,
    status,
    entitlement: AD_FREE_ENTITLEMENT,
    currentPeriodStart,
    currentPeriodEnd,
    trialEnd: providerStatus === 'trialing' ? currentPeriodEnd : null,
    cancelAtPeriodEnd: givesAccess && renewalStatus === 'will_not_renew',
    autoRenew: renewalStatus === 'will_renew'
      ? true
      : renewalStatus === 'will_not_renew'
        ? false
        : null,
    providerEventAt: input.snapshotEventAt,
    lastReconciledAt: input.reconciledAt,
    // The current provider snapshot verifies access now but does not expose a
    // separate grace expiry. Lease that verified state for at most 24 hours;
    // only another successful provider read may advance it.
    graceReason: providerGrace ? 'billing' : null,
    graceExpiresAt: providerGrace
      ? new Date(input.reconciledAt.getTime() + 24 * 60 * 60 * 1_000)
      : null,
  };
}

export function normalizeSuperwallSnapshotItem(input: {
  userId: string;
  item: JsonObject;
  snapshotEventAt: Date;
  reconciledAt: Date;
  providerEventId?: string | null;
}): SubscriptionWrite | null {
  return normalizeSuperwallSubscription({
    configuration: superwallConfiguration(),
    userId: input.userId,
    item: input.item,
    snapshotEventAt: input.snapshotEventAt,
    reconciledAt: input.reconciledAt,
    providerEventId: input.providerEventId ?? null,
  });
}

export function correlateSuperwallEventSnapshot(input: {
  subscriptions: SubscriptionWrite[];
  event: SuperwallEvent;
  store: Extract<BillingStore, 'app_store' | 'play_store'>;
  existingProviderSubscriptionId?: string | null;
}): SubscriptionWrite {
  const scoped = input.subscriptions.filter((subscription) => (
    subscription.store === input.store
    && (subscription.productId === input.event.productId
      || subscription.productId === input.event.newProductId)
  ));
  const exactResource = input.existingProviderSubscriptionId
    ? scoped.filter((subscription) => (
      subscription.providerSubscriptionId === input.existingProviderSubscriptionId
    ))
    : [];
  const exactStore = scoped.filter((subscription) => (
    subscription.providerStoreSubscriptionId === input.event.transactionId
    || subscription.providerStoreSubscriptionId === input.event.providerRootTransactionId
  ));
  const candidates = exactResource.length > 0 ? exactResource : exactStore;
  if (candidates.length !== 1) {
    throw new SuperwallProviderRequestError(
      'Superwall event could not be correlated to one authoritative subscription.',
      'inconsistent',
    );
  }
  const correlated = candidates[0];
  correlated.providerRootTransactionId = input.event.providerRootTransactionId;
  return correlated;
}

async function authoritativeSuperwallSnapshot(input: {
  configuration: SuperwallConfiguration;
  userId: string;
  providerEventId: string | null;
  event?: SuperwallEvent | null;
}): Promise<{
  subscriptions: SubscriptionWrite[];
  snapshotEventAt: Date;
  reconciledAt: Date;
  reconciliationGeneration: string;
}> {
  // Order snapshots by request start, not response arrival. If an older fetch
  // stalls while a newer fetch observes a later provider state, the stalled
  // response must not receive a newer local ordering timestamp and roll it back.
  const reconciliationGeneration = await allocateBillingReconciliationGeneration();
  const snapshotEventAt = new Date();
  const items = await retrieveSuperwallSubscriptions(input.configuration, input.userId);
  const reconciledAt = new Date();
  const subscriptions = items
    .map((item) => normalizeSuperwallSubscription({
      configuration: input.configuration,
      userId: input.userId,
      item,
      snapshotEventAt,
      reconciledAt,
      providerEventId: input.providerEventId,
    }))
    .filter((subscription): subscription is SubscriptionWrite => subscription !== null);
  if (input.event) {
    const existing = await existingSuperwallSubscriptionForEvent(
      input.configuration,
      input.event,
    );
    const platform = platformForEvent(input.configuration, input.event);
    if (!platform) throw new Error('Superwall event platform is out of scope.');
    correlateSuperwallEventSnapshot({
      subscriptions,
      event: input.event,
      store: platform.store,
      existingProviderSubscriptionId: existing?.providerSubscriptionId ?? null,
    });
  }
  return { subscriptions, snapshotEventAt, reconciledAt, reconciliationGeneration };
}

export function superwallEventCorrelationIdentifiers(
  event: Pick<SuperwallEvent, 'providerRootTransactionId' | 'transactionId'>,
): string[] {
  return [...new Set([event.providerRootTransactionId, event.transactionId])];
}

async function existingSuperwallSubscriptionForEvent(
  configuration: SuperwallConfiguration,
  event: SuperwallEvent,
): Promise<SubscriptionWrite | null> {
  const matches = (await Promise.all(
    superwallEventCorrelationIdentifiers(event).map((identifier) => (
      getProviderSubscriptionByCorrelation('superwall', configuration.environment, identifier)
    )),
  )).filter((candidate): candidate is SubscriptionWrite => candidate !== null);
  const resources = new Set(matches.map((candidate) => candidate.providerSubscriptionId));
  const owners = new Set(matches.map((candidate) => candidate.userId));
  if (resources.size > 1 || owners.size > 1) {
    throw new Error('Superwall event correlations resolve to conflicting subscriptions.');
  }
  return matches[0] ?? null;
}

export function parseSuperwallAliases(response: JsonObject, requestedAlias: string): string[] {
  if (
    response.object !== 'user_aliases'
    || stringValue(response.app_user_id) !== requestedAlias
    || !Array.isArray(response.aliases)
    || !response.aliases.every((entry) => typeof entry === 'string' && entry.length > 0)
  ) {
    throw new SuperwallProviderRequestError(
      'Superwall alias response does not match the requested identity.',
      'inconsistent',
    );
  }
  return [...new Set([requestedAlias, ...response.aliases])];
}

async function retrieveAliases(
  configuration: SuperwallConfiguration,
  alias: string,
  applicationId: number,
): Promise<string[]> {
  const url = new URL(
    `/v3/users/${encodeURIComponent(alias)}/aliases?application_id=${applicationId}`,
    SUPERWALL_API_BASE_URL,
  );
  const response = await superwallGet(configuration, url);
  return parseSuperwallAliases(response, alias);
}

async function resolveSuperwallUser(
  configuration: SuperwallConfiguration,
  event: SuperwallEvent,
): Promise<string> {
  const existing = await existingSuperwallSubscriptionForEvent(configuration, event);
  let identifiers: string[] = [];
  if (event.originalAppUserId) {
    identifiers = [event.originalAppUserId];
    const directMapping = await findUserIdByProviderCustomer(
      'superwall',
      configuration.environment,
      event.originalAppUserId,
    );
    if (!directMapping) {
      identifiers = await retrieveAliases(
        configuration,
        event.originalAppUserId,
        event.applicationId,
      );
    }
  }
  const mappedUsers = new Set<string>();
  for (const identifier of identifiers) {
    const mapped = await findUserIdByProviderCustomer(
      'superwall',
      configuration.environment,
      identifier,
    );
    if (mapped) mappedUsers.add(mapped);
  }
  if (existing) mappedUsers.add(existing.userId);
  if (mappedUsers.size !== 1) {
    throw new Error('Superwall subscription identity is missing or ambiguous.');
  }
  const [userId] = [...mappedUsers];
  if (!userId?.startsWith('user_')) throw new Error('Superwall owner is not a Clerk user id.');
  if (existing && existing.userId !== userId) {
    throw new Error('Superwall subscription ownership conflicts with its existing owner.');
  }

  if (event.originalAppUserId && !await isAccountDeletionMarked(userId)) {
    await saveProviderAccount({
      userId,
      provider: 'superwall',
      environment: configuration.environment,
      providerCustomerId: event.originalAppUserId,
      reconciledAt: new Date(),
    });
  }
  return userId;
}

export async function registerSuperwallIdentity(userId: string): Promise<void> {
  const configuration = superwallConfiguration();
  if (!userId.startsWith('user_')) throw new Error('A Clerk user id is required.');
  await saveProviderAccount({
    userId,
    provider: 'superwall',
    environment: configuration.environment,
    providerCustomerId: userId,
    reconciledAt: new Date(),
  });
}

export async function reconcileSuperwallForUser(
  userId: string,
): Promise<Awaited<ReturnType<typeof requireBillingEntitlementState>>> {
  const configuration = superwallConfiguration();
  if (!userId.startsWith('user_')) throw new Error('A Clerk user id is required.');
  await saveProviderAccount({
    userId,
    provider: 'superwall',
    environment: configuration.environment,
    providerCustomerId: userId,
    reconciledAt: new Date(),
  });
  const snapshot = await authoritativeSuperwallSnapshot({
    configuration,
    userId,
    providerEventId: null,
  });
  await reconcileAuthoritativeSubscriptions({
    userId,
    provider: 'superwall',
    environment: configuration.environment,
    ...snapshot,
  });
  return requireBillingEntitlementState(userId);
}

export async function handleSuperwallSubscriptionOutage(
  event: SuperwallEvent,
): Promise<boolean> {
  const configuration = superwallConfiguration();
  const existing = await existingSuperwallSubscriptionForEvent(configuration, event);
  if (!existing) return false;
  return grantFixedSubscriptionGrace({
    provider: 'superwall',
    environment: configuration.environment,
    providerSubscriptionId: existing.providerSubscriptionId,
    reason: 'verification',
    hours: 24,
  });
}

export async function handleSuperwallUserReconciliationOutage(
  userId: string,
): Promise<number> {
  const configuration = superwallConfiguration();
  const subscriptionIds = await getProviderSubscriptionIdsForUser(
    userId,
    'superwall',
    configuration.environment,
  );
  const results = await Promise.all(subscriptionIds.map((providerSubscriptionId) => (
    grantFixedSubscriptionGrace({
      provider: 'superwall',
      environment: configuration.environment,
      providerSubscriptionId,
      reason: 'verification',
      hours: 24,
    })
  )));
  return results.filter(Boolean).length;
}

export async function processSuperwallEvent(
  event: SuperwallEvent,
  lease: WebhookEventLease,
): Promise<{ handled: boolean; userId: string | null }> {
  const configuration = superwallConfiguration();
  if (
    lease.provider !== 'superwall'
    || lease.environment !== configuration.environment
    || !isSuperwallEventInScope(event)
  ) {
    throw new Error('Superwall webhook lease or event scope does not match configuration.');
  }
  const userId = await resolveSuperwallUser(configuration, event);
  const snapshot = await authoritativeSuperwallSnapshot({
    configuration,
    userId,
    providerEventId: event.id,
    event,
  });
  if (event.type === 'non_renewing_purchase') {
    for (const subscription of snapshot.subscriptions) {
      if (subscription.providerRootTransactionId !== event.providerRootTransactionId) continue;
      subscription.status = 'incomplete';
      subscription.cancelAtPeriodEnd = false;
      subscription.autoRenew = false;
      subscription.graceReason = null;
      subscription.graceExpiresAt = null;
    }
  }
  if (await isAccountDeletionMarked(userId)) {
    await commitDeletedAccountSuperwallSnapshot({
      userId,
      provider: 'superwall',
      environment: configuration.environment,
      ...snapshot,
      lease,
    });
    billingLog('warn', {
      action: 'deleted_account_subscription_reconciled',
      provider: 'superwall',
      userId,
      eventId: event.id,
      eventType: event.type,
      providerSubscriptionId: event.providerRootTransactionId,
      productId: event.productId,
      providerEventAt: event.providerEventAt,
    });
    return { handled: true, userId };
  }

  await commitWebhookSubscriptionSnapshot({
    userId,
    provider: 'superwall',
    environment: configuration.environment,
    ...snapshot,
    lease,
  });
  const matching = snapshot.subscriptions.find((subscription) => (
    subscription.providerRootTransactionId === event.providerRootTransactionId
  ));
  billingLog('info', {
    action: 'subscription_snapshot_reconciled',
    provider: 'superwall',
    store: matching?.store ?? null,
    userId,
    eventId: event.id,
    eventType: event.type,
    providerSubscriptionId: matching?.providerSubscriptionId ?? event.providerRootTransactionId,
    productId: matching?.productId ?? event.productId,
    plan: matching?.plan ?? null,
    normalizedStatus: matching?.status ?? 'expired',
    providerEventAt: event.providerEventAt,
    reconciledAt: snapshot.reconciledAt,
  });
  return { handled: true, userId };
}
