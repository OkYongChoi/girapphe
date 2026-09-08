import 'server-only';

import {
  AD_FREE_ENTITLEMENT_ID,
  aggregateAdFreeEntitlement,
  hasDuplicateQualifyingSubscriptions,
  type BillingEntitlementResponse,
  type BillingEnvironment,
  type BillingGraceReason,
  type BillingPlan,
  type BillingProvider,
  type BillingStatus,
  type BillingStore,
  type CanonicalSubscription,
} from '@stem-brain/shared';
import pool from '@/lib/db';
import {
  deriveAccountAdvisoryLockKey,
  deriveAccountBillingOperationScopeKey,
  deriveDeletedAccountScopeKey,
  type AccountBillingOperationProvider,
} from '@/lib/account-lifecycle';

export const AD_FREE_ENTITLEMENT = AD_FREE_ENTITLEMENT_ID;
export type {
  BillingEnvironment,
  BillingGraceReason,
  BillingPlan,
  BillingProvider,
  BillingStatus,
  BillingStore,
};

export type SubscriptionWrite = {
  provider: BillingProvider;
  environment: BillingEnvironment;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  /** Stable provider resource id is providerSubscriptionId; these are correlation aliases. */
  providerRootTransactionId?: string | null;
  providerStoreSubscriptionId?: string | null;
  providerEventId: string | null;
  userId: string;
  store: BillingStore;
  productId: string | null;
  plan: BillingPlan;
  status: BillingStatus;
  entitlement: typeof AD_FREE_ENTITLEMENT;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  /** True only when provider transaction evidence established this paid period. */
  paidPeriodVerified?: boolean;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean | null;
  providerEventAt: Date;
  /** Provider resource clock, kept separate from the webhook envelope clock. */
  providerResourceUpdatedAt?: Date | null;
  lastReconciledAt: Date;
  graceReason: BillingGraceReason | null;
  graceExpiresAt: Date | null;
};

export type SubscriptionOverview = CanonicalSubscription & {
  environment: BillingEnvironment;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
};

export type BillingCheckoutAttempt = {
  id: string;
  userId: string;
  provider: 'creem' | 'superwall';
  environment: BillingEnvironment;
  plan: BillingPlan;
  productId: string;
  status: 'creating' | 'open' | 'indeterminate' | 'completed' | 'expired' | 'abandoned' | 'failed';
  providerCustomerId: string | null;
  providerCheckoutId: string | null;
  checkoutUrl: string | null;
  expiresAt: Date;
  providerEventAt: Date | null;
  lastErrorCode: string | null;
};

type CheckoutAttemptUpdateInput = {
  id: string;
  userId: string;
  status: BillingCheckoutAttempt['status'];
  providerCustomerId?: string | null;
  providerCheckoutId?: string | null;
  checkoutUrl?: string | null;
  providerEventAt?: Date | null;
  lastErrorCode?: string | null;
};

type BillingCheckoutAttemptRow = {
  id: string;
  user_id: string;
  provider: 'creem' | 'superwall';
  environment: BillingEnvironment;
  plan: BillingPlan;
  product_id: string;
  status: BillingCheckoutAttempt['status'];
  provider_customer_id: string | null;
  provider_checkout_id: string | null;
  checkout_url: string | null;
  expires_at: Date | string;
  provider_event_at: Date | string | null;
  last_error_code: string | null;
};

type SubscriptionRow = {
  provider: BillingProvider;
  environment: BillingEnvironment;
  provider_customer_id: string | null;
  provider_subscription_id: string;
  store: BillingStore;
  product_id: string | null;
  plan: BillingPlan;
  status: BillingStatus;
  entitlement: typeof AD_FREE_ENTITLEMENT;
  current_period_end: Date | string | null;
  trial_end: Date | string | null;
  cancel_at_period_end: boolean;
  auto_renew: boolean | null;
  grace_reason: BillingGraceReason | null;
  grace_expires_at: Date | string | null;
};

type WebhookClaim = 'processed' | 'busy' | WebhookEventLease;

export type WebhookEventLease = {
  provider: BillingProvider;
  environment: BillingEnvironment;
  eventId: string;
  eventType: string;
  ownerToken: string;
};

export type AccountBillingOperationLease = {
  scopeKey: string;
  provider: AccountBillingOperationProvider;
  operation: 'checkout' | 'mobile_purchase' | 'prepare' | 'activation' | 'renewal' | 'reconciliation';
  ownerToken: string;
};

export type AuthoritativeSubscriptionSnapshotInput = {
  userId: string;
  provider: BillingProvider;
  environment: BillingEnvironment;
  subscriptions: readonly SubscriptionWrite[];
  snapshotEventAt: Date;
  reconciledAt: Date;
  providerEventId?: string | null;
  reconciliationGeneration?: string | null;
};

type BillingQuery = { text: string; params: unknown[] };

export type BillingRequestRateLimitAction = 'customer_portal' | 'superwall_reconcile';

export type BillingRequestRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(value: unknown): string | null {
  return asDate(value)?.toISOString() ?? null;
}

function checkoutAttemptFromRow(row: BillingCheckoutAttemptRow): BillingCheckoutAttempt {
  const expiresAt = asDate(row.expires_at);
  if (!expiresAt) throw new Error('Billing checkout attempt has an invalid expiry.');
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    environment: row.environment,
    plan: row.plan,
    productId: row.product_id,
    status: row.status,
    providerCustomerId: row.provider_customer_id,
    providerCheckoutId: row.provider_checkout_id,
    checkoutUrl: row.checkout_url,
    expiresAt,
    providerEventAt: asDate(row.provider_event_at),
    lastErrorCode: row.last_error_code,
  };
}

function subscriptionFromRow(row: SubscriptionRow): SubscriptionOverview {
  return {
    provider: row.provider,
    environment: row.environment,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    store: row.store,
    productId: row.product_id,
    plan: row.plan,
    status: row.status,
    entitlement: row.entitlement,
    currentPeriodEnd: iso(row.current_period_end) ?? iso(row.trial_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    autoRenew: row.auto_renew,
    graceReason: row.grace_reason,
    graceExpiresAt: iso(row.grace_expires_at),
  };
}

function databaseAvailable() {
  return Boolean(process.env.DATABASE_URL);
}

/** Allocated before a provider read to totally order concurrent Worker snapshots. */
export async function allocateBillingReconciliationGeneration(): Promise<string> {
  const result = await pool.query<{ generation: string }>(
    `SELECT nextval('billing_reconciliation_generation_seq')::text AS generation`,
  );
  const generation = result.rows[0]?.generation;
  if (!generation || !/^\d+$/.test(generation)) {
    throw new Error('Unable to allocate a billing reconciliation generation.');
  }
  return generation;
}

export function currentBillingEnvironment(): BillingEnvironment {
  return process.env.APP_ENV === 'prod' ? 'production' : 'test';
}

async function querySubscriptions(
  userId: string,
  environment: BillingEnvironment = currentBillingEnvironment(),
): Promise<SubscriptionOverview[]> {
  const result = await pool.query<SubscriptionRow>(
    `SELECT provider, environment, provider_customer_id, provider_subscription_id,
            store, product_id, plan, status, entitlement, current_period_end,
            trial_end, cancel_at_period_end, auto_renew, grace_reason, grace_expires_at
     FROM billing_subscriptions
     WHERE user_id = $1
       AND environment = $2
       AND entitlement = $3
     ORDER BY
       CASE status
         WHEN 'active' THEN 0 WHEN 'trialing' THEN 1 WHEN 'past_due' THEN 2
         WHEN 'canceled' THEN 3 ELSE 4
       END,
       COALESCE(grace_expires_at, current_period_end, trial_end) DESC NULLS LAST,
       created_at ASC`,
    [userId, environment, AD_FREE_ENTITLEMENT],
  );
  return result.rows.map(subscriptionFromRow);
}

export async function hasOpenAcquisitionBlock(userId: string): Promise<boolean> {
  const result = await pool.query<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing_acquisition_blocks
       WHERE user_id = $1 AND resolved_at IS NULL
     ) AS blocked`,
    [userId],
  );
  return result.rows[0]?.blocked === true;
}

export async function consumeBillingRequestRateLimit(input: {
  userId: string;
  action: BillingRequestRateLimitAction;
  limit: number;
  windowSeconds: number;
}): Promise<BillingRequestRateLimitResult> {
  if (!Number.isInteger(input.limit) || input.limit < 1) {
    throw new Error('Billing request rate limit must be a positive integer.');
  }
  if (!Number.isInteger(input.windowSeconds) || input.windowSeconds < 1) {
    throw new Error('Billing request rate-limit window must be a positive integer.');
  }
  const [result] = await pool.accountTransaction<{
    allowed: boolean;
    retry_after_seconds: number | string;
  }>(input.userId, [{
    text: `WITH rate_slot AS (
             INSERT INTO billing_request_rate_limits (
               user_id, action, window_started_at, request_count, updated_at
             ) VALUES ($1, $2, NOW(), 1, NOW())
             ON CONFLICT (user_id, action) DO UPDATE SET
               window_started_at = CASE
                 WHEN billing_request_rate_limits.window_started_at
                        <= NOW() - ($3::integer * INTERVAL '1 second')
                 THEN NOW() ELSE billing_request_rate_limits.window_started_at
               END,
               request_count = CASE
                 WHEN billing_request_rate_limits.window_started_at
                        <= NOW() - ($3::integer * INTERVAL '1 second')
                 THEN 1 ELSE billing_request_rate_limits.request_count + 1
               END,
               updated_at = NOW()
             WHERE billing_request_rate_limits.window_started_at
                     <= NOW() - ($3::integer * INTERVAL '1 second')
                OR billing_request_rate_limits.request_count < $4
             RETURNING window_started_at
           )
           SELECT TRUE AS allowed, 0 AS retry_after_seconds
           FROM rate_slot
           UNION ALL
           SELECT FALSE AS allowed,
             GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
               window_started_at + ($3::integer * INTERVAL '1 second') - NOW()
             )))::integer) AS retry_after_seconds
           FROM billing_request_rate_limits
           WHERE user_id = $1 AND action = $2
             AND NOT EXISTS (SELECT 1 FROM rate_slot)
           LIMIT 1`,
    params: [input.userId, input.action, input.windowSeconds, input.limit],
  }]);
  const row = result?.rows[0];
  if (!row) throw new Error('Unable to apply the billing request rate limit.');
  return {
    allowed: row.allowed === true,
    retryAfterSeconds: row.allowed === true
      ? 0
      : Math.max(1, Number(row.retry_after_seconds) || input.windowSeconds),
  };
}

async function queryUnresolvedAttempt(userId: string): Promise<boolean> {
  const result = await pool.query<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing_checkout_attempts
       WHERE user_id = $1
         AND status IN ('creating', 'open', 'indeterminate')
     ) AS blocked`,
    [userId],
  );
  return result.rows[0]?.blocked === true;
}

export async function requireBillingEntitlementState(
  userId: string,
): Promise<BillingEntitlementResponse> {
  if (!databaseAvailable()) throw new Error('Billing database is unavailable.');
  const [subscriptions, explicitBlock, unresolvedAttempt] = await Promise.all([
    querySubscriptions(userId),
    hasOpenAcquisitionBlock(userId),
    queryUnresolvedAttempt(userId),
  ]);
  const isAdFree = aggregateAdFreeEntitlement(subscriptions);
  const duplicateDetected = hasDuplicateQualifyingSubscriptions(subscriptions);
  const hasProviderBlocker = subscriptions.some((subscription) => (
    subscription.status === 'incomplete'
    || subscription.status === 'paused'
    || subscription.status === 'past_due'
  ));
  return {
    isAdFree,
    acquisitionBlocked: isAdFree || duplicateDetected || hasProviderBlocker
      || explicitBlock || unresolvedAttempt,
    duplicateDetected,
    subscriptions,
  };
}

export async function hasAdFreeEntitlement(userId: string | null): Promise<boolean> {
  if (!userId || !databaseAvailable()) return false;
  try {
    return (await requireBillingEntitlementState(userId)).isAdFree;
  } catch (error) {
    console.error('Unable to read ad-free entitlement:', error);
    return false;
  }
}

/** Purchase gates must propagate database failures instead of treating them as free access. */
export async function requireAdFreeEntitlementStatus(userId: string): Promise<boolean> {
  return (await requireBillingEntitlementState(userId)).isAdFree;
}

export async function hasBlockingSubscription(userId: string): Promise<boolean> {
  return (await requireBillingEntitlementState(userId)).acquisitionBlocked;
}

export async function getSubscriptionOverview(userId: string): Promise<SubscriptionOverview | null> {
  if (!databaseAvailable()) return null;
  try {
    return (await querySubscriptions(userId))[0] ?? null;
  } catch (error) {
    console.error('Unable to read subscription overview:', error);
    return null;
  }
}

export async function getSubscriptionOverviews(userId: string): Promise<SubscriptionOverview[]> {
  if (!databaseAvailable()) return [];
  return querySubscriptions(userId);
}

export async function getProviderSubscription(
  provider: BillingProvider,
  environment: BillingEnvironment,
  providerSubscriptionId: string,
): Promise<SubscriptionWrite | null> {
  const result = await pool.query<{
    user_id: string;
    provider_customer_id: string | null;
    provider_root_transaction_id: string | null;
    provider_store_subscription_id: string | null;
    provider_event_id: string | null;
    store: BillingStore;
    product_id: string | null;
    plan: BillingPlan;
    status: BillingStatus;
    entitlement: typeof AD_FREE_ENTITLEMENT;
    current_period_start: Date | string | null;
    current_period_end: Date | string | null;
    paid_period_verified: boolean;
    trial_end: Date | string | null;
    cancel_at_period_end: boolean;
    auto_renew: boolean | null;
    provider_event_at: Date | string | null;
    provider_resource_updated_at: Date | string | null;
    last_reconciled_at: Date | string | null;
    grace_reason: BillingGraceReason | null;
    grace_expires_at: Date | string | null;
  }>(
    `SELECT user_id, provider_customer_id, provider_root_transaction_id,
            provider_store_subscription_id, provider_event_id, store, product_id,
            plan, status, entitlement, current_period_start, current_period_end,
            paid_period_verified, trial_end, cancel_at_period_end, auto_renew,
            provider_event_at, provider_resource_updated_at, last_reconciled_at,
            grace_reason, grace_expires_at
     FROM billing_subscriptions
     WHERE provider = $1 AND environment = $2 AND provider_subscription_id = $3
     LIMIT 1`,
    [provider, environment, providerSubscriptionId],
  );
  const row = result.rows[0];
  const lastReconciledAt = asDate(row?.last_reconciled_at);
  if (!row || !lastReconciledAt) return null;
  const providerEventAt = asDate(row.provider_event_at) ?? lastReconciledAt;
  return {
    provider,
    environment,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId,
    providerRootTransactionId: row.provider_root_transaction_id,
    providerStoreSubscriptionId: row.provider_store_subscription_id,
    providerEventId: row.provider_event_id,
    userId: row.user_id,
    store: row.store,
    productId: row.product_id,
    plan: row.plan,
    status: row.status,
    entitlement: row.entitlement,
    currentPeriodStart: asDate(row.current_period_start),
    currentPeriodEnd: asDate(row.current_period_end),
    paidPeriodVerified: row.paid_period_verified,
    trialEnd: asDate(row.trial_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    autoRenew: row.auto_renew,
    providerEventAt,
    providerResourceUpdatedAt: asDate(row.provider_resource_updated_at),
    lastReconciledAt,
    graceReason: row.grace_reason,
    graceExpiresAt: asDate(row.grace_expires_at),
  };
}

/** Resolve provider webhooks by a stable resource id or a retained store correlation alias. */
export async function getProviderSubscriptionByCorrelation(
  provider: BillingProvider,
  environment: BillingEnvironment,
  providerIdentifier: string,
): Promise<SubscriptionWrite | null> {
  const result = await pool.query<{
    user_id: string;
    provider_customer_id: string | null;
    provider_subscription_id: string;
    provider_root_transaction_id: string | null;
    provider_store_subscription_id: string | null;
    provider_event_id: string | null;
    store: BillingStore;
    product_id: string | null;
    plan: BillingPlan;
    status: BillingStatus;
    entitlement: typeof AD_FREE_ENTITLEMENT;
    current_period_start: Date | string | null;
    current_period_end: Date | string | null;
    paid_period_verified: boolean;
    trial_end: Date | string | null;
    cancel_at_period_end: boolean;
    auto_renew: boolean | null;
    provider_event_at: Date | string | null;
    provider_resource_updated_at: Date | string | null;
    last_reconciled_at: Date | string | null;
    grace_reason: BillingGraceReason | null;
    grace_expires_at: Date | string | null;
  }>(
    `SELECT user_id, provider_customer_id, provider_subscription_id,
            provider_root_transaction_id, provider_store_subscription_id,
            provider_event_id, store, product_id, plan, status, entitlement,
            current_period_start, current_period_end, paid_period_verified, trial_end,
            cancel_at_period_end, auto_renew, provider_event_at,
            provider_resource_updated_at, last_reconciled_at, grace_reason,
            grace_expires_at
     FROM billing_subscriptions
     WHERE provider = $1 AND environment = $2
       AND ($3 = provider_subscription_id
         OR $3 = provider_root_transaction_id
         OR $3 = provider_store_subscription_id)
     ORDER BY CASE WHEN provider_subscription_id = $3 THEN 0
                   WHEN provider_root_transaction_id = $3 THEN 1 ELSE 2 END
     LIMIT 2`,
    [provider, environment, providerIdentifier],
  );
  if (result.rows.length > 1) {
    throw new Error('Provider subscription correlation is ambiguous.');
  }
  const row = result.rows[0];
  const lastReconciledAt = asDate(row?.last_reconciled_at);
  if (!row || !lastReconciledAt) return null;
  const providerEventAt = asDate(row.provider_event_at) ?? lastReconciledAt;
  return {
    provider,
    environment,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    providerRootTransactionId: row.provider_root_transaction_id,
    providerStoreSubscriptionId: row.provider_store_subscription_id,
    providerEventId: row.provider_event_id,
    userId: row.user_id,
    store: row.store,
    productId: row.product_id,
    plan: row.plan,
    status: row.status,
    entitlement: row.entitlement,
    currentPeriodStart: asDate(row.current_period_start),
    currentPeriodEnd: asDate(row.current_period_end),
    paidPeriodVerified: row.paid_period_verified,
    trialEnd: asDate(row.trial_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    autoRenew: row.auto_renew,
    providerEventAt,
    providerResourceUpdatedAt: asDate(row.provider_resource_updated_at),
    lastReconciledAt,
    graceReason: row.grace_reason,
    graceExpiresAt: asDate(row.grace_expires_at),
  };
}

function subscriptionUpsertQuery(
  subscription: SubscriptionWrite,
  reconciliationGeneration: string | null = null,
) {
  const id = [
    subscription.provider,
    subscription.environment,
    subscription.providerSubscriptionId,
  ].join(':');
  return {
    text: `INSERT INTO billing_subscriptions (
       id, user_id, provider, environment, provider_customer_id,
       provider_subscription_id, provider_event_id, store, product_id, plan,
       status, entitlement, current_period_start, current_period_end,
       paid_period_verified, trial_end,
       cancel_at_period_end, auto_renew, provider_event_at,
       provider_resource_updated_at, last_reconciled_at,
       grace_reason, grace_expires_at, reconciliation_generation,
       provider_root_transaction_id, provider_store_subscription_id,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
       COALESCE($15::boolean, FALSE), $16, $17, $18, $19, $20, $21, $22,
       $23, $24::bigint, $25, $26, NOW(), NOW()
     )
     ON CONFLICT (provider, environment, provider_subscription_id) DO UPDATE SET
       -- A stable provider subscription can never be reassigned by an event.
       -- A conflicting owner deliberately violates NOT NULL so the surrounding
       -- transaction rolls back instead of silently accepting a forged alias.
       user_id = CASE
         WHEN billing_subscriptions.user_id = EXCLUDED.user_id
          AND (
            billing_subscriptions.provider_root_transaction_id IS NULL
            OR EXCLUDED.provider_root_transaction_id IS NULL
            OR billing_subscriptions.provider_root_transaction_id
              = EXCLUDED.provider_root_transaction_id
          )
           THEN billing_subscriptions.user_id
         ELSE NULL
       END,
       provider_customer_id = COALESCE(EXCLUDED.provider_customer_id, billing_subscriptions.provider_customer_id),
       provider_event_id = COALESCE(EXCLUDED.provider_event_id, billing_subscriptions.provider_event_id),
       store = EXCLUDED.store,
       product_id = COALESCE(EXCLUDED.product_id, billing_subscriptions.product_id),
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       entitlement = EXCLUDED.entitlement,
       current_period_start = COALESCE(EXCLUDED.current_period_start, billing_subscriptions.current_period_start),
       current_period_end = EXCLUDED.current_period_end,
       paid_period_verified = COALESCE($15::boolean, billing_subscriptions.paid_period_verified),
       trial_end = EXCLUDED.trial_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       auto_renew = EXCLUDED.auto_renew,
       provider_event_at = EXCLUDED.provider_event_at,
       provider_resource_updated_at = COALESCE(
         EXCLUDED.provider_resource_updated_at,
         billing_subscriptions.provider_resource_updated_at
       ),
       last_reconciled_at = EXCLUDED.last_reconciled_at,
       grace_reason = EXCLUDED.grace_reason,
       grace_expires_at = EXCLUDED.grace_expires_at,
       reconciliation_generation = EXCLUDED.reconciliation_generation,
       provider_root_transaction_id = COALESCE(
         billing_subscriptions.provider_root_transaction_id,
         EXCLUDED.provider_root_transaction_id
       ),
       provider_store_subscription_id = COALESCE(
         EXCLUDED.provider_store_subscription_id,
         billing_subscriptions.provider_store_subscription_id
       ),
       updated_at = NOW()
     WHERE billing_subscriptions.user_id <> EXCLUDED.user_id
        OR (
          billing_subscriptions.provider_root_transaction_id IS NOT NULL
          AND EXCLUDED.provider_root_transaction_id IS NOT NULL
          AND billing_subscriptions.provider_root_transaction_id
            <> EXCLUDED.provider_root_transaction_id
        )
        OR (
          EXCLUDED.reconciliation_generation IS NOT NULL
          AND (
            billing_subscriptions.reconciliation_generation IS NULL
            OR EXCLUDED.reconciliation_generation > billing_subscriptions.reconciliation_generation
            OR (
              EXCLUDED.reconciliation_generation = billing_subscriptions.reconciliation_generation
              AND EXCLUDED.provider_event_id IS NOT DISTINCT FROM billing_subscriptions.provider_event_id
            )
          )
        )
        OR (
          EXCLUDED.reconciliation_generation IS NULL
          AND billing_subscriptions.reconciliation_generation IS NULL
          AND (
            billing_subscriptions.provider_event_at IS NULL
            OR EXCLUDED.provider_event_at > billing_subscriptions.provider_event_at
            OR (
              EXCLUDED.provider_event_at = billing_subscriptions.provider_event_at
              AND EXCLUDED.provider_event_id IS NOT DISTINCT FROM billing_subscriptions.provider_event_id
            )
          )
        )`,
    params: [
      id,
      subscription.userId,
      subscription.provider,
      subscription.environment,
      subscription.providerCustomerId,
      subscription.providerSubscriptionId,
      subscription.providerEventId,
      subscription.store,
      subscription.productId,
      subscription.plan,
      subscription.status,
      subscription.entitlement,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.paidPeriodVerified ?? null,
      subscription.trialEnd,
      subscription.cancelAtPeriodEnd,
      subscription.autoRenew,
      subscription.providerEventAt,
      subscription.providerResourceUpdatedAt ?? null,
      subscription.lastReconciledAt,
      subscription.graceReason,
      subscription.graceExpiresAt,
      reconciliationGeneration,
      subscription.providerRootTransactionId ?? null,
      subscription.providerStoreSubscriptionId ?? null,
    ],
  };
}

function providerAccountMappingUpsertQuery(input: {
  userId: string;
  provider: BillingProvider;
  environment: BillingEnvironment;
  providerCustomerId: string;
  reconciledAt: Date | null;
}) {
  const id = [
    input.provider,
    input.environment,
    input.providerCustomerId,
  ].join(':');
  return {
    text: `INSERT INTO billing_provider_accounts (
       id, user_id, provider, environment, provider_customer_id,
       last_reconciled_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (provider, environment, provider_customer_id) DO UPDATE SET
       -- Provider aliases are append-only. Never transfer an alias to another
       -- Clerk owner; fail the whole transaction on an ownership conflict.
       user_id = CASE
         WHEN billing_provider_accounts.user_id = EXCLUDED.user_id
           THEN billing_provider_accounts.user_id
         ELSE NULL
       END,
       last_reconciled_at = CASE
         WHEN billing_provider_accounts.last_reconciled_at IS NULL
           OR EXCLUDED.last_reconciled_at >= billing_provider_accounts.last_reconciled_at
           THEN EXCLUDED.last_reconciled_at
         ELSE billing_provider_accounts.last_reconciled_at
       END,
       updated_at = NOW()
     RETURNING provider_customer_id`,
    params: [
      id,
      input.userId,
      input.provider,
      input.environment,
      input.providerCustomerId,
      input.reconciledAt,
    ],
  };
}

function providerAccountUpsertQuery(subscription: SubscriptionWrite) {
  if (!subscription.providerCustomerId) return null;
  return providerAccountMappingUpsertQuery({
    userId: subscription.userId,
    provider: subscription.provider,
    environment: subscription.environment,
    providerCustomerId: subscription.providerCustomerId,
    reconciledAt: subscription.lastReconciledAt,
  });
}

function duplicateBlockRefreshQuery(
  userId: string,
  environment: BillingEnvironment,
) {
  return {
    text: `WITH qualifying AS (
       SELECT COUNT(*)::integer AS total
       FROM billing_subscriptions
       WHERE user_id = $1
         AND environment = $2
         AND entitlement = $3
         AND (
           (status IN ('active', 'trialing') AND COALESCE(current_period_end, trial_end) > NOW())
           OR (status = 'canceled' AND cancel_at_period_end = TRUE AND current_period_end > NOW())
           OR (
             grace_expires_at > NOW()
             AND (
               status IN ('active', 'past_due')
               OR (status = 'canceled' AND cancel_at_period_end = TRUE)
             )
           )
         )
     )
     INSERT INTO billing_acquisition_blocks (
       user_id, reason, first_detected_at, updated_at, resolved_at
     )
     SELECT $1, 'duplicate_subscription', NOW(), NOW(), NULL
     FROM qualifying WHERE total > 1
     ON CONFLICT (user_id, reason) DO UPDATE SET
       updated_at = NOW(), resolved_at = NULL`,
    params: [userId, environment, AD_FREE_ENTITLEMENT],
  };
}

function resolveMobilePurchasePendingQuery(userId: string): BillingQuery {
  return {
    text: `WITH resolved AS (
             UPDATE billing_acquisition_blocks
             SET resolved_at = NOW(), updated_at = NOW()
             WHERE user_id = $1
               AND reason = 'mobile_purchase_pending'
               AND resolved_at IS NULL
             RETURNING operation_owner_token
           )
           DELETE FROM billing_account_operations
           WHERE scope_key = $2
             AND provider = 'superwall'
             AND operation = 'mobile_purchase'
             AND owner_token IN (
               SELECT operation_owner_token FROM resolved
               WHERE operation_owner_token IS NOT NULL
             )`,
    params: [userId, deriveAccountBillingOperationScopeKey(userId)],
  };
}

function deletionMarkerAssertionQuery(userId: string): BillingQuery {
  return {
    // COUNT is exactly 0 or 1 because scope_key is primary. Division by zero
    // aborts the surrounding transaction when deletion has not begun.
    text: `SELECT 1 / COUNT(*)::integer AS deletion_marker_assertion
           FROM mcp_deleted_account_markers
           WHERE scope_key = $1`,
    params: [deriveDeletedAccountScopeKey(userId)],
  };
}

function checkoutCompletionQuery(subscription: SubscriptionWrite) {
  if (
    (subscription.provider !== 'creem' && subscription.provider !== 'superwall')
    || (subscription.status !== 'active' && subscription.status !== 'trialing')
  ) return null;
  return {
    text: `UPDATE billing_checkout_attempts
           SET status = 'completed',
               provider_customer_id = COALESCE($4, provider_customer_id),
               provider_event_at = $5,
               checkout_url = NULL,
               last_error_code = NULL,
               updated_at = NOW()
           WHERE user_id = $1
             AND provider = $2
             AND environment = $3
             AND status IN ('creating', 'open', 'indeterminate')`,
    params: [
      subscription.userId,
      subscription.provider,
      subscription.environment,
      subscription.providerCustomerId,
      subscription.providerEventAt,
    ],
  };
}

function subscriptionReconciliationQueries(
  subscriptions: readonly SubscriptionWrite[],
  reconciliationGeneration: string | null = null,
): BillingQuery[] {
  const queries: BillingQuery[] = [];
  for (const subscription of subscriptions) {
    queries.push(subscriptionUpsertQuery(subscription, reconciliationGeneration));
    const providerAccount = providerAccountUpsertQuery(subscription);
    const checkoutCompletion = checkoutCompletionQuery(subscription);
    if (providerAccount) queries.push(providerAccount);
    if (checkoutCompletion) queries.push(checkoutCompletion);
  }
  return queries;
}

function assertSnapshotInput(input: AuthoritativeSubscriptionSnapshotInput): void {
  if (Number.isNaN(input.snapshotEventAt.getTime()) || Number.isNaN(input.reconciledAt.getTime())) {
    throw new Error('Authoritative subscription snapshot timestamps must be valid.');
  }
  const ids = new Set<string>();
  for (const subscription of input.subscriptions) {
    if (
      subscription.userId !== input.userId
      || subscription.provider !== input.provider
      || subscription.environment !== input.environment
    ) {
      throw new Error('Authoritative subscription snapshot scope does not match a supplied row.');
    }
    if (ids.has(subscription.providerSubscriptionId)) {
      throw new Error('Authoritative subscription snapshot contains a duplicate subscription id.');
    }
    ids.add(subscription.providerSubscriptionId);
  }
}

function expireSubscriptionsAbsentFromSnapshotQuery(
  input: AuthoritativeSubscriptionSnapshotInput,
): BillingQuery {
  return {
    text: `UPDATE billing_subscriptions
           SET status = 'expired', cancel_at_period_end = FALSE, auto_renew = FALSE,
               provider_event_id = COALESCE($7, provider_event_id),
               provider_event_at = $5,
               last_reconciled_at = CASE
                 WHEN last_reconciled_at IS NULL OR $6 >= last_reconciled_at THEN $6
                 ELSE last_reconciled_at
               END,
               reconciliation_generation = COALESCE($9::bigint, reconciliation_generation),
               grace_reason = NULL, grace_expires_at = NULL, updated_at = NOW()
           WHERE user_id = $1
             AND provider = $2
             AND environment = $3
             AND entitlement = $8
             AND NOT (provider_subscription_id = ANY($4::text[]))
             AND status NOT IN ('expired', 'refunded', 'revoked')
             AND (
               (
                 $9::bigint IS NOT NULL
                 AND (
                   reconciliation_generation IS NULL
                   OR $9::bigint > reconciliation_generation
                 )
               )
               OR (
                 $9::bigint IS NULL
                 AND reconciliation_generation IS NULL
                 AND (provider_event_at IS NULL OR $5 >= provider_event_at)
               )
             )`,
    params: [
      input.userId,
      input.provider,
      input.environment,
      input.subscriptions.map((subscription) => subscription.providerSubscriptionId),
      input.snapshotEventAt,
      input.reconciledAt,
      input.providerEventId ?? null,
      AD_FREE_ENTITLEMENT,
      input.reconciliationGeneration ?? null,
    ],
  };
}

function webhookLeaseCompletionQuery(lease: WebhookEventLease): BillingQuery {
  return {
    // The division assertion aborts the transaction if the processing lease was
    // lost. State and event completion therefore cannot commit independently.
    text: `WITH completed AS (
             UPDATE billing_webhook_events
             SET processed_at = NOW(), processing_owner_token = NULL,
                 processing_started_at = NULL, last_error_code = NULL,
                 updated_at = NOW()
             WHERE provider = $1 AND environment = $2 AND event_id = $3
               AND processing_owner_token = $4 AND processed_at IS NULL
             RETURNING event_id
           )
           SELECT MIN(event_id) AS event_id,
                  1 / COUNT(*)::integer AS lease_assertion
           FROM completed`,
    params: [lease.provider, lease.environment, lease.eventId, lease.ownerToken],
  };
}

export async function upsertSubscription(subscription: SubscriptionWrite): Promise<void> {
  const queries = subscriptionReconciliationQueries([subscription]);
  queries.push(duplicateBlockRefreshQuery(subscription.userId, subscription.environment));
  await pool.accountTransaction(subscription.userId, queries);
}

/**
 * Transitional RevenueCat ownership transfer. Customer Info must have already
 * verified the exact destination transaction; webhook aliases only constrain
 * which previous Clerk owners may be replaced.
 */
export async function moveVerifiedRevenueCatSubscription(
  subscription: SubscriptionWrite,
  allowedPreviousUserIds: string[],
): Promise<boolean> {
  if (subscription.provider !== 'revenuecat') {
    throw new Error('Only a RevenueCat subscription can use the legacy transfer bridge.');
  }
  const id = [
    subscription.provider,
    subscription.environment,
    subscription.providerSubscriptionId,
  ].join(':');
  const moveQuery: BillingQuery = {
    text: `INSERT INTO billing_subscriptions (
       id, user_id, provider, environment, provider_customer_id,
       provider_subscription_id, provider_event_id, store, product_id, plan,
       status, entitlement, current_period_start, current_period_end, trial_end,
       cancel_at_period_end, auto_renew, provider_event_at, last_reconciled_at,
       grace_reason, grace_expires_at, created_at, updated_at
     ) VALUES (
       $1, $2, 'revenuecat', $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW()
     )
     ON CONFLICT (provider, environment, provider_subscription_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       provider_customer_id = EXCLUDED.provider_customer_id,
       provider_event_id = EXCLUDED.provider_event_id,
       store = EXCLUDED.store,
       product_id = EXCLUDED.product_id,
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       entitlement = EXCLUDED.entitlement,
       current_period_start = COALESCE(EXCLUDED.current_period_start, billing_subscriptions.current_period_start),
       current_period_end = EXCLUDED.current_period_end,
       trial_end = EXCLUDED.trial_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       auto_renew = EXCLUDED.auto_renew,
       provider_event_at = EXCLUDED.provider_event_at,
       last_reconciled_at = EXCLUDED.last_reconciled_at,
       grace_reason = NULL,
       grace_expires_at = NULL,
       updated_at = NOW()
     WHERE (
         billing_subscriptions.provider_event_at IS NULL
         OR EXCLUDED.provider_event_at >= billing_subscriptions.provider_event_at
       )
       AND (
         billing_subscriptions.user_id = EXCLUDED.user_id
         OR billing_subscriptions.user_id = ANY($21::text[])
       )
     RETURNING provider_subscription_id`,
    params: [
      id,
      subscription.userId,
      subscription.environment,
      subscription.providerCustomerId,
      subscription.providerSubscriptionId,
      subscription.providerEventId,
      subscription.store,
      subscription.productId,
      subscription.plan,
      subscription.status,
      subscription.entitlement,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.trialEnd,
      subscription.cancelAtPeriodEnd,
      subscription.autoRenew,
      subscription.providerEventAt,
      subscription.lastReconciledAt,
      subscription.graceReason,
      subscription.graceExpiresAt,
      allowedPreviousUserIds,
    ],
  };
  const [moved] = await pool.accountTransaction<{ provider_subscription_id: string }>(
    subscription.userId,
    [
      moveQuery,
      duplicateBlockRefreshQuery(subscription.userId, subscription.environment),
    ],
  );
  return Boolean(moved?.rows[0]);
}

/**
 * Writes Creem cancellation state after the permanent deletion marker exists.
 * This is the only subscription write that intentionally bypasses the active
 * account guard, and it can only reduce future billing/access.
 */
export async function upsertCreemSubscriptionDuringAccountDeletion(
  subscription: SubscriptionWrite,
  reconciliationGeneration: string | null = null,
): Promise<void> {
  const isStoppedRenewal = subscription.autoRenew === false
    && subscription.cancelAtPeriodEnd
    && (subscription.status === 'incomplete' || subscription.status === 'canceled');
  const isTerminal = subscription.autoRenew !== true
    && (
      ['expired', 'refunded', 'revoked'].includes(subscription.status)
      || (subscription.status === 'canceled' && !subscription.cancelAtPeriodEnd)
    );
  if (
    subscription.provider !== 'creem'
    || subscription.store !== 'web'
    || (!isStoppedRenewal && !isTerminal)
  ) {
    throw new Error('Account deletion may only persist non-renewing or terminal Creem state.');
  }
  await pool.transaction([
    deletionMarkerAssertionQuery(subscription.userId),
    ...subscriptionReconciliationQueries([subscription], reconciliationGeneration),
    duplicateBlockRefreshQuery(subscription.userId, subscription.environment),
  ]);
}

/** Transitional equivalent for an already-existing Stripe subscription. */
export async function upsertLegacyStripeSubscriptionDuringAccountDeletion(
  subscription: SubscriptionWrite,
): Promise<void> {
  const isTerminal = ['canceled', 'expired', 'refunded', 'revoked'].includes(subscription.status)
    && subscription.autoRenew !== true;
  if (subscription.provider !== 'stripe' || subscription.store !== 'web' || !isTerminal) {
    throw new Error('Account deletion may only persist terminal legacy Stripe state.');
  }
  await pool.transaction([
    deletionMarkerAssertionQuery(subscription.userId),
    ...subscriptionReconciliationQueries([subscription]),
    duplicateBlockRefreshQuery(subscription.userId, subscription.environment),
  ]);
}

export async function expireLegacyRevenueCatDuringAccountDeletion(
  userId: string,
  providerEventAt: Date,
): Promise<void> {
  await pool.transaction([
    deletionMarkerAssertionQuery(userId),
    {
      text: `UPDATE billing_subscriptions
             SET status = 'expired', cancel_at_period_end = FALSE,
                 auto_renew = FALSE, provider_event_at = $3,
                 last_reconciled_at = NOW(), grace_reason = NULL,
                 grace_expires_at = NULL, updated_at = NOW()
             WHERE user_id = $1 AND provider = 'revenuecat'
               AND environment = $2
               AND (provider_event_at IS NULL OR $3 >= provider_event_at)`,
      params: [userId, currentBillingEnvironment(), providerEventAt],
    },
    duplicateBlockRefreshQuery(userId, currentBillingEnvironment()),
  ]);
}

function superwallSnapshotConfirmsPurchase(
  input: AuthoritativeSubscriptionSnapshotInput,
): boolean {
  const observedAt = input.reconciledAt.getTime();
  return input.provider === 'superwall' && input.subscriptions.some((subscription) => {
    const accessThrough = subscription.graceExpiresAt
      ?? subscription.currentPeriodEnd
      ?? subscription.trialEnd;
    if (!accessThrough || accessThrough.getTime() <= observedAt) return false;
    return subscription.status === 'active'
      || subscription.status === 'trialing'
      || (subscription.status === 'canceled' && subscription.cancelAtPeriodEnd)
      || (subscription.status === 'past_due' && subscription.graceExpiresAt !== null);
  });
}

export async function reconcileAuthoritativeSubscriptions(
  input: AuthoritativeSubscriptionSnapshotInput,
): Promise<void> {
  assertSnapshotInput(input);
  const resolvedMobilePurchase = superwallSnapshotConfirmsPurchase(input)
    ? [resolveMobilePurchasePendingQuery(input.userId)]
    : [];
  await pool.accountTransaction(input.userId, [
    ...subscriptionReconciliationQueries(
      input.subscriptions,
      input.reconciliationGeneration ?? null,
    ),
    expireSubscriptionsAbsentFromSnapshotQuery(input),
    duplicateBlockRefreshQuery(input.userId, input.environment),
    ...resolvedMobilePurchase,
  ]);
}

export async function commitWebhookSubscriptionReconciliation(
  subscription: SubscriptionWrite,
  lease: WebhookEventLease,
  reconciliationGeneration: string | null = null,
): Promise<void> {
  if (subscription.provider !== lease.provider || subscription.environment !== lease.environment) {
    throw new Error('Webhook lease does not match the reconciled subscription.');
  }
  const queries = subscriptionReconciliationQueries([subscription], reconciliationGeneration);
  queries.push(
    duplicateBlockRefreshQuery(subscription.userId, subscription.environment),
    webhookLeaseCompletionQuery(lease),
  );
  await pool.accountTransaction(subscription.userId, queries);
}

export async function commitWebhookSubscriptionSnapshot(
  input: AuthoritativeSubscriptionSnapshotInput & { lease: WebhookEventLease },
): Promise<void> {
  assertSnapshotInput(input);
  if (input.provider !== input.lease.provider || input.environment !== input.lease.environment) {
    throw new Error('Webhook lease does not match the authoritative subscription snapshot.');
  }
  await pool.accountTransaction(input.userId, [
    ...subscriptionReconciliationQueries(
      input.subscriptions,
      input.reconciliationGeneration ?? null,
    ),
    expireSubscriptionsAbsentFromSnapshotQuery(input),
    duplicateBlockRefreshQuery(input.userId, input.environment),
    ...(superwallSnapshotConfirmsPurchase(input)
      ? [resolveMobilePurchasePendingQuery(input.userId)]
      : []),
    webhookLeaseCompletionQuery(input.lease),
  ]);
}

/**
 * Retains store lifecycle metadata after Girapphe account deletion. The
 * permanent marker is asserted in the same transaction, so these rows can be
 * reconciled without reopening the deleted product account.
 */
export async function commitDeletedAccountSuperwallSnapshot(
  input: AuthoritativeSubscriptionSnapshotInput & { lease: WebhookEventLease },
): Promise<void> {
  assertSnapshotInput(input);
  if (
    input.provider !== 'superwall'
    || input.lease.provider !== 'superwall'
    || input.environment !== input.lease.environment
  ) {
    throw new Error('Deleted-account reconciliation requires a matching Superwall lease.');
  }
  await pool.transaction([
    deletionMarkerAssertionQuery(input.userId),
    ...subscriptionReconciliationQueries(
      input.subscriptions,
      input.reconciliationGeneration ?? null,
    ),
    expireSubscriptionsAbsentFromSnapshotQuery(input),
    webhookLeaseCompletionQuery(input.lease),
  ]);
}

export async function grantFixedSubscriptionGrace(input: {
  provider: BillingProvider;
  environment: BillingEnvironment;
  providerSubscriptionId: string;
  reason: BillingGraceReason;
  hours: 24 | 72;
}): Promise<boolean> {
  const existing = await getProviderSubscription(
    input.provider,
    input.environment,
    input.providerSubscriptionId,
  );
  if (!existing) return false;
  const [result] = await pool.accountTransaction<{ provider_subscription_id: string }>(
    existing.userId,
    [{
      text: `UPDATE billing_subscriptions
             SET grace_reason = $4,
                 grace_expires_at = current_period_end + ($5::text || ' hours')::interval,
                 updated_at = NOW()
             WHERE provider = $1
               AND environment = $2
               AND provider_subscription_id = $3
               AND user_id = $7
               AND entitlement = $6
               AND (
                 ($4 = 'billing' AND status = 'past_due')
                 OR (
                   $4 = 'verification'
                   AND status IN ('active', 'past_due')
                   AND auto_renew = TRUE
                   AND cancel_at_period_end = FALSE
                 )
               )
               AND current_period_end IS NOT NULL
               AND (
                 grace_expires_at IS NULL
                 OR ($4 = 'billing' AND grace_reason = 'verification')
               )
             RETURNING provider_subscription_id`,
      params: [
        input.provider,
        input.environment,
        input.providerSubscriptionId,
        input.reason,
        input.hours,
        AD_FREE_ENTITLEMENT,
        existing.userId,
      ],
    }],
  );
  return result?.rows.length === 1;
}

export async function saveProviderAccount(input: {
  userId: string;
  provider: BillingProvider;
  environment: BillingEnvironment;
  providerCustomerId: string;
  reconciledAt?: Date | null;
}): Promise<string> {
  const query = providerAccountMappingUpsertQuery({
    ...input,
    reconciledAt: input.reconciledAt ?? null,
  });
  const [result] = await pool.accountTransaction<{ provider_customer_id: string }>(
    input.userId,
    [query],
  );
  const saved = result?.rows[0]?.provider_customer_id;
  if (!saved) throw new Error('Provider customer mapping was not saved.');
  return saved;
}

/**
 * A server-owned Creem checkout may settle after account deletion has fenced
 * the user. Preserve the exact customer alias for cancellation/reconciliation,
 * but only behind that permanent marker and never transfer an existing alias.
 */
export async function saveCreemProviderAccountDuringAccountDeletion(input: {
  userId: string;
  environment: BillingEnvironment;
  providerCustomerId: string;
  reconciledAt?: Date | null;
}): Promise<string> {
  const query = providerAccountMappingUpsertQuery({
    userId: input.userId,
    provider: 'creem',
    environment: input.environment,
    providerCustomerId: input.providerCustomerId,
    reconciledAt: input.reconciledAt ?? null,
  });
  const [, result] = await pool.transaction<{ provider_customer_id?: string }>([
    deletionMarkerAssertionQuery(input.userId),
    query,
  ]);
  const saved = result?.rows[0]?.provider_customer_id;
  if (!saved) throw new Error('Deleted-account Creem customer mapping was not saved.');
  return saved;
}

export async function getProviderCustomerId(
  userId: string,
  provider: BillingProvider,
  environment: BillingEnvironment = currentBillingEnvironment(),
): Promise<string | null> {
  const result = await pool.query<{ provider_customer_id: string }>(
    `SELECT provider_customer_id FROM billing_provider_accounts
     WHERE user_id = $1 AND provider = $2 AND environment = $3
     ORDER BY last_reconciled_at DESC NULLS LAST, created_at DESC, provider_customer_id ASC
     LIMIT 1`,
    [userId, provider, environment],
  );
  return result.rows[0]?.provider_customer_id ?? null;
}

export async function getProviderCustomerIds(
  userId: string,
  provider: BillingProvider,
  environment: BillingEnvironment = currentBillingEnvironment(),
): Promise<string[]> {
  const result = await pool.query<{ provider_customer_id: string }>(
    `SELECT provider_customer_id FROM billing_provider_accounts
     WHERE user_id = $1 AND provider = $2 AND environment = $3
     ORDER BY last_reconciled_at DESC NULLS LAST, created_at DESC, provider_customer_id ASC`,
    [userId, provider, environment],
  );
  return result.rows.map((row) => row.provider_customer_id);
}

export async function providerCustomerBelongsToUser(input: {
  userId: string;
  provider: BillingProvider;
  environment: BillingEnvironment;
  providerCustomerId: string;
}): Promise<boolean> {
  const result = await pool.query<{ owned: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM billing_provider_accounts
       WHERE user_id = $1 AND provider = $2 AND environment = $3
         AND provider_customer_id = $4
     ) AS owned`,
    [input.userId, input.provider, input.environment, input.providerCustomerId],
  );
  return result.rows[0]?.owned === true;
}

export async function resolveBillingAcquisitionBlockForOperator(
  userId: string,
  reason: 'duplicate_subscription' | 'manual_review' | 'mobile_purchase_pending',
): Promise<boolean> {
  const [result] = await pool.accountTransaction<{ user_id: string }>(userId, [{
    text: `UPDATE billing_acquisition_blocks
           SET resolved_at = NOW(), updated_at = NOW()
           WHERE user_id = $1 AND reason = $2 AND resolved_at IS NULL
           RETURNING user_id`,
    params: [userId, reason],
  }]);
  return Boolean(result?.rows[0]);
}

export async function getProviderSubscriptionIdsForUser(
  userId: string,
  provider: BillingProvider,
  environment: BillingEnvironment = currentBillingEnvironment(),
): Promise<string[]> {
  const result = await pool.query<{ provider_subscription_id: string }>(
    `SELECT provider_subscription_id
     FROM billing_subscriptions
     WHERE user_id = $1 AND provider = $2 AND environment = $3
     ORDER BY created_at ASC`,
    [userId, provider, environment],
  );
  return result.rows.map((row) => row.provider_subscription_id);
}

export async function findUserIdByProviderCustomer(
  provider: BillingProvider,
  environment: BillingEnvironment,
  providerCustomerId: string,
): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM billing_provider_accounts
     WHERE provider = $1 AND environment = $2 AND provider_customer_id = $3 LIMIT 1`,
    [provider, environment, providerCustomerId],
  );
  return result.rows[0]?.user_id ?? null;
}

// Transitional Stripe lifecycle bridge. These helpers intentionally expose no
// checkout creation; they keep existing webhook, portal, and deletion paths
// compatible with the pre-Billing-V1 customer table until the provider
// dashboard has proved that no legacy subscriber remains.
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  if (!databaseAvailable()) return null;
  const result = await pool.query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM billing_customers WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return result.rows[0]?.stripe_customer_id
    ?? await getProviderCustomerId(userId, 'stripe');
}

export async function getStripeSubscriptionIds(userId: string): Promise<Set<string>> {
  return new Set(await getProviderSubscriptionIdsForUser(userId, 'stripe'));
}

export async function claimStripePortalRateSlot(userId: string): Promise<boolean> {
  const result = await pool.query<{ user_id: string }>(
    `UPDATE billing_customers
     SET stripe_portal_window_started_at = CASE
           WHEN stripe_portal_request_count = 0
             OR stripe_portal_window_started_at <= NOW() - INTERVAL '10 minutes'
           THEN NOW() ELSE stripe_portal_window_started_at
         END,
         stripe_portal_request_count = CASE
           WHEN stripe_portal_request_count = 0
             OR stripe_portal_window_started_at <= NOW() - INTERVAL '10 minutes'
           THEN 1 ELSE stripe_portal_request_count + 1
         END,
         updated_at = NOW()
     WHERE user_id = $1
       AND stripe_customer_id IS NOT NULL
       AND (
         stripe_portal_window_started_at <= NOW() - INTERVAL '10 minutes'
         OR stripe_portal_request_count < 10
       )
     RETURNING user_id`,
    [userId],
  );
  return result.rows.length === 1;
}

export async function saveStripeCustomer(
  userId: string,
  stripeCustomerId: string,
): Promise<string> {
  const result = await pool.query<{ stripe_customer_id: string }>(
    `INSERT INTO billing_customers (user_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = COALESCE(billing_customers.stripe_customer_id, EXCLUDED.stripe_customer_id),
       updated_at = NOW()
     RETURNING stripe_customer_id`,
    [userId, stripeCustomerId],
  );
  const saved = result.rows[0]?.stripe_customer_id;
  if (!saved) throw new Error('Stripe customer mapping was not saved.');
  if (!await isAccountDeletionMarked(userId)) {
    await saveProviderAccount({
      userId,
      provider: 'stripe',
      environment: currentBillingEnvironment(),
      providerCustomerId: saved,
      reconciledAt: new Date(),
    });
  }
  return saved;
}

export async function findUserIdByStripeCustomer(
  stripeCustomerId: string,
): Promise<string | null> {
  const legacy = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM billing_customers WHERE stripe_customer_id = $1 LIMIT 1',
    [stripeCustomerId],
  );
  return legacy.rows[0]?.user_id
    ?? await findUserIdByProviderCustomer(
      'stripe',
      currentBillingEnvironment(),
      stripeCustomerId,
    );
}

export async function claimTrial(userId: string): Promise<Date | null> {
  const result = await pool.query<{ trial_consumed_at: Date | string }>(
    `UPDATE billing_customers
     SET trial_consumed_at = date_trunc('milliseconds', NOW()), updated_at = NOW()
     WHERE user_id = $1 AND trial_consumed_at IS NULL
     RETURNING trial_consumed_at`,
    [userId],
  );
  return asDate(result.rows[0]?.trial_consumed_at);
}

export async function releaseTrialClaim(userId: string, claimedAt: string): Promise<void> {
  await pool.query(
    `UPDATE billing_customers
     SET trial_consumed_at = NULL, updated_at = NOW()
     WHERE user_id = $1 AND trial_consumed_at = $2::timestamptz
       AND NOT EXISTS (SELECT 1 FROM billing_subscriptions WHERE user_id = $1)`,
    [userId, claimedAt],
  );
}

export async function consumeTrialFromWebhook(
  userId: string,
  claimedAt?: string | null,
): Promise<void> {
  await pool.query(
    `INSERT INTO billing_customers (user_id, trial_consumed_at)
     VALUES ($1, COALESCE($2::timestamptz, date_trunc('milliseconds', NOW())))
     ON CONFLICT (user_id) DO UPDATE SET
       trial_consumed_at = COALESCE(billing_customers.trial_consumed_at, EXCLUDED.trial_consumed_at),
       updated_at = NOW()`,
    [userId, claimedAt ?? null],
  );
}

export async function createCheckoutAttempt(input: {
  userId: string;
  provider: 'creem' | 'superwall';
  environment: BillingEnvironment;
  plan: BillingPlan;
  productId: string;
  lifetimeMinutes: number;
}): Promise<BillingCheckoutAttempt> {
  const id = crypto.randomUUID();
  const [result] = await pool.accountTransaction<BillingCheckoutAttemptRow>(input.userId, [
    {
      text: `INSERT INTO billing_checkout_attempts (
               id, user_id, provider, environment, plan, product_id, status,
               expires_at, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, 'creating',
               NOW() + ($7::text || ' minutes')::interval, NOW(), NOW()
             )
             RETURNING id, user_id, provider, environment, plan, product_id,
                       status, provider_customer_id, provider_checkout_id,
                       checkout_url, expires_at, provider_event_at, last_error_code`,
      params: [
        id,
        input.userId,
        input.provider,
        input.environment,
        input.plan,
        input.productId,
        input.lifetimeMinutes,
      ],
    },
  ]);
  // Provider uncertainty is never resolved by Girapphe's local clock. An old
  // attempt remains blocked until provider reconciliation or operator review.
  const row = result?.rows[0];
  if (!row) throw new Error('Billing checkout attempt was not created.');
  return checkoutAttemptFromRow(row);
}

export async function getUnresolvedCheckoutAttempt(
  userId: string,
): Promise<BillingCheckoutAttempt | null> {
  const result = await pool.query<BillingCheckoutAttemptRow>(
    `SELECT id, user_id, provider, environment, plan, product_id, status,
            provider_customer_id, provider_checkout_id, checkout_url, expires_at,
            provider_event_at, last_error_code
     FROM billing_checkout_attempts
     WHERE user_id = $1
       AND status IN ('creating', 'open', 'indeterminate')
     ORDER BY created_at ASC LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? checkoutAttemptFromRow(result.rows[0]) : null;
}

export async function getCheckoutAttempt(
  id: string,
  userId?: string,
): Promise<BillingCheckoutAttempt | null> {
  const result = await pool.query<BillingCheckoutAttemptRow>(
    `SELECT id, user_id, provider, environment, plan, product_id, status,
            provider_customer_id, provider_checkout_id, checkout_url, expires_at,
            provider_event_at, last_error_code
     FROM billing_checkout_attempts
     WHERE id = $1 AND ($2::text IS NULL OR user_id = $2)
     LIMIT 1`,
    [id, userId ?? null],
  );
  return result.rows[0] ? checkoutAttemptFromRow(result.rows[0]) : null;
}

function checkoutAttemptUpdateQuery(input: CheckoutAttemptUpdateInput): BillingQuery {
  return {
    text: `UPDATE billing_checkout_attempts
     SET status = $3,
         provider_customer_id = COALESCE($4, provider_customer_id),
         provider_checkout_id = COALESCE($5, provider_checkout_id),
         checkout_url = $6,
         provider_event_at = COALESCE($7, provider_event_at),
         last_error_code = $8,
         updated_at = NOW()
     WHERE id = $1 AND user_id = $2
       -- A late checkout HTTP response must never overwrite a webhook-confirmed
       -- completion. Only provider/operator reconciliation may reopen a terminal
       -- attempt.
       AND status IN ('creating', 'open', 'indeterminate')`,
    params: [
      input.id,
      input.userId,
      input.status,
      input.providerCustomerId ?? null,
      input.providerCheckoutId ?? null,
      input.checkoutUrl ?? null,
      input.providerEventAt ?? null,
      input.lastErrorCode ?? null,
    ],
  };
}

export async function updateCheckoutAttempt(input: CheckoutAttemptUpdateInput): Promise<void> {
  await pool.accountTransaction(input.userId, [checkoutAttemptUpdateQuery(input)]);
}

export async function updateCheckoutAttemptDuringAccountDeletion(
  input: CheckoutAttemptUpdateInput,
): Promise<void> {
  if (input.status !== 'expired' && input.status !== 'indeterminate') {
    throw new Error('Account deletion checkout updates must be expired or indeterminate.');
  }
  if (input.checkoutUrl) {
    throw new Error('Account deletion checkout updates cannot expose a checkout URL.');
  }
  await pool.transaction([
    deletionMarkerAssertionQuery(input.userId),
    checkoutAttemptUpdateQuery({ ...input, checkoutUrl: null }),
  ]);
}

export async function abandonAcquisitionAttemptsForDeletion(userId: string): Promise<void> {
  await pool.transaction([
    deletionMarkerAssertionQuery(userId),
    {
      text: `UPDATE billing_checkout_attempts
     SET status = 'abandoned', checkout_url = NULL,
         last_error_code = 'account_deletion', updated_at = NOW()
     WHERE user_id = $1
       AND status IN ('creating', 'open', 'indeterminate')`,
      params: [userId],
    },
  ]);
}

export async function isAccountDeletionMarked(userId: string): Promise<boolean> {
  const marker = await pool.query<{ deleted: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM mcp_deleted_account_markers WHERE scope_key = $1
     ) AS deleted`,
    [deriveDeletedAccountScopeKey(userId)],
  );
  return marker.rows[0]?.deleted === true;
}

export async function claimAccountBillingOperation(
  userId: string,
  provider: AccountBillingOperationProvider,
  operation: AccountBillingOperationLease['operation'],
): Promise<AccountBillingOperationLease | null> {
  const scopeKey = deriveAccountBillingOperationScopeKey(userId);
  const ownerToken = crypto.randomUUID();
  try {
    const [claimed] = await pool.accountTransaction<{ scope_key: string }>(userId, [{
      text: `INSERT INTO billing_account_operations (
               scope_key, provider, operation, owner_token, expires_at, created_at, updated_at
             )
             SELECT $1, $2, $3, $4, NOW() + INTERVAL '10 minutes', NOW(), NOW()
             WHERE $3 IN ('renewal', 'reconciliation')
                OR NOT EXISTS (
                  SELECT 1 FROM billing_acquisition_blocks
                  WHERE user_id = $5 AND resolved_at IS NULL
                )
             ON CONFLICT (scope_key) DO UPDATE SET
               provider = EXCLUDED.provider,
               operation = EXCLUDED.operation,
               owner_token = EXCLUDED.owner_token,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()
             WHERE billing_account_operations.expires_at <= NOW()
             RETURNING scope_key`,
      params: [scopeKey, provider, operation, ownerToken, userId],
    }]);
    return claimed?.rows[0]
      ? { scopeKey, provider, operation, ownerToken }
      : null;
  } catch (error) {
    if (await isAccountDeletionMarked(userId).catch(() => false)) return null;
    throw error;
  }
}

/**
 * Claims only Creem lifecycle reconciliation after the permanent deletion
 * marker exists. The shared advisory lock closes the marker/lease race; the
 * marker assertion prevents this path from bypassing the active-account guard.
 */
export async function claimAccountBillingOperationDuringAccountDeletion(
  userId: string,
  provider: 'creem',
  operation: 'renewal' | 'reconciliation',
): Promise<AccountBillingOperationLease | null> {
  if (provider !== 'creem' || !['renewal', 'reconciliation'].includes(operation)) {
    throw new Error('Deleted-account billing leases are restricted to Creem lifecycle reconciliation.');
  }
  const scopeKey = deriveAccountBillingOperationScopeKey(userId);
  const ownerToken = crypto.randomUUID();
  const results = await pool.transaction<{ scope_key?: string }>([
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [deriveAccountAdvisoryLockKey(userId)],
    },
    deletionMarkerAssertionQuery(userId),
    {
      text: `INSERT INTO billing_account_operations (
               scope_key, provider, operation, owner_token, expires_at, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes', NOW(), NOW())
             ON CONFLICT (scope_key) DO UPDATE SET
               provider = EXCLUDED.provider,
               operation = EXCLUDED.operation,
               owner_token = EXCLUDED.owner_token,
               expires_at = EXCLUDED.expires_at,
               updated_at = NOW()
             WHERE billing_account_operations.expires_at <= NOW()
             RETURNING scope_key`,
      params: [scopeKey, provider, operation, ownerToken],
    },
  ]);
  return results[2]?.rows[0]
    ? { scopeKey, provider, operation, ownerToken }
    : null;
}

export async function releaseAccountBillingOperation(
  lease: AccountBillingOperationLease,
): Promise<void> {
  await pool.query(
    `DELETE FROM billing_account_operations
     WHERE scope_key = $1 AND owner_token = $2`,
    [lease.scopeKey, lease.ownerToken],
  );
}

export function isBillingOperationOwnerToken(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Releases only the authenticated user's exact Superwall mobile-purchase lease. */
export async function releaseMobilePurchaseOperationForUser(
  userId: string,
  ownerToken: string,
): Promise<boolean> {
  if (!isBillingOperationOwnerToken(ownerToken)) return false;
  const [released, resolved] = await pool.accountTransaction<{ scope_key?: string; user_id?: string }>(userId, [{
    text: `DELETE FROM billing_account_operations
           WHERE scope_key = $1
             AND provider = 'superwall'
             AND operation = 'mobile_purchase'
             AND owner_token = $2
           RETURNING scope_key`,
    params: [deriveAccountBillingOperationScopeKey(userId), ownerToken],
  }, {
    text: `UPDATE billing_acquisition_blocks
           SET resolved_at = NOW(), updated_at = NOW()
           WHERE user_id = $1
             AND reason = 'mobile_purchase_pending'
             AND operation_owner_token = $2
             AND resolved_at IS NULL
           RETURNING user_id`,
    params: [userId, ownerToken],
  }]);
  return Boolean(released?.rows[0] || resolved?.rows[0]);
}

/** Converts the short execution lease into a durable provider-uncertainty block. */
export async function persistMobilePurchasePendingBlock(
  userId: string,
  lease: AccountBillingOperationLease,
): Promise<boolean> {
  if (
    lease.provider !== 'superwall'
    || lease.operation !== 'mobile_purchase'
    || lease.scopeKey !== deriveAccountBillingOperationScopeKey(userId)
    || !isBillingOperationOwnerToken(lease.ownerToken)
  ) return false;
  const [persisted] = await pool.accountTransaction<{ user_id: string }>(userId, [{
    text: `INSERT INTO billing_acquisition_blocks (
             user_id, reason, operation_owner_token,
             first_detected_at, updated_at, resolved_at
           )
           SELECT $1, 'mobile_purchase_pending', $2, NOW(), NOW(), NULL
           FROM billing_account_operations
           WHERE scope_key = $3
             AND provider = 'superwall'
             AND operation = 'mobile_purchase'
             AND owner_token = $2
           ON CONFLICT (user_id, reason) DO UPDATE SET
             operation_owner_token = EXCLUDED.operation_owner_token,
             first_detected_at = CASE
               WHEN billing_acquisition_blocks.resolved_at IS NULL
               THEN billing_acquisition_blocks.first_detected_at
               ELSE NOW()
             END,
             updated_at = NOW(),
             resolved_at = NULL
           WHERE billing_acquisition_blocks.resolved_at IS NOT NULL
              OR billing_acquisition_blocks.operation_owner_token = EXCLUDED.operation_owner_token
           RETURNING user_id`,
    params: [userId, lease.ownerToken, lease.scopeKey],
  }]);
  return Boolean(persisted?.rows[0]);
}

export async function claimWebhookEvent(input: {
  provider: BillingProvider;
  environment: BillingEnvironment;
  eventId: string;
  eventType: string;
  providerEventAt: Date | null;
}): Promise<WebhookClaim> {
  const ownerToken = crypto.randomUUID();
  const claimed = await pool.query<{ event_id: string }>(
    `INSERT INTO billing_webhook_events (
       provider, environment, event_id, event_type, provider_event_at,
       processing_owner_token, processing_started_at, attempt_count,
       processed_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1, NULL, NOW(), NOW())
     ON CONFLICT (provider, environment, event_id) DO UPDATE SET
       event_type = EXCLUDED.event_type,
       provider_event_at = COALESCE(EXCLUDED.provider_event_at, billing_webhook_events.provider_event_at),
       processing_owner_token = EXCLUDED.processing_owner_token,
       processing_started_at = NOW(),
       attempt_count = billing_webhook_events.attempt_count + 1,
       last_error_code = NULL,
       updated_at = NOW()
     WHERE billing_webhook_events.processed_at IS NULL
       AND (
         billing_webhook_events.processing_started_at IS NULL
         OR billing_webhook_events.processing_started_at < NOW() - INTERVAL '10 minutes'
       )
     RETURNING event_id`,
    [
      input.provider,
      input.environment,
      input.eventId,
      input.eventType,
      input.providerEventAt,
      ownerToken,
    ],
  );
  if (claimed.rows[0]) {
    return { ...input, ownerToken };
  }

  const existing = await pool.query<{ processed_at: Date | string | null }>(
    `SELECT processed_at FROM billing_webhook_events
     WHERE provider = $1 AND environment = $2 AND event_id = $3`,
    [input.provider, input.environment, input.eventId],
  );
  return existing.rows[0]?.processed_at ? 'processed' : 'busy';
}

export async function commitWebhookCheckoutLink(input: {
  lease: WebhookEventLease;
  userId: string;
  checkoutAttemptId: string;
  providerCheckoutId: string;
  providerCustomerId: string;
  providerEventAt: Date;
}): Promise<void> {
  if (input.lease.provider !== 'creem') {
    throw new Error('Only Creem checkout events can link hosted checkout state.');
  }
  const accountId = [
    input.lease.provider,
    input.lease.environment,
    input.providerCustomerId,
  ].join(':');
  await pool.accountTransaction(input.userId, [
    {
      text: `INSERT INTO billing_provider_accounts (
               id, user_id, provider, environment, provider_customer_id,
               last_reconciled_at, created_at, updated_at
             ) VALUES ($1, $2, 'creem', $3, $4, $5, NOW(), NOW())
             ON CONFLICT (provider, environment, provider_customer_id) DO UPDATE SET
               user_id = CASE
                 WHEN billing_provider_accounts.user_id = EXCLUDED.user_id
                   THEN billing_provider_accounts.user_id
                 ELSE NULL
               END,
               last_reconciled_at = CASE
                 WHEN billing_provider_accounts.last_reconciled_at IS NULL
                   OR EXCLUDED.last_reconciled_at >= billing_provider_accounts.last_reconciled_at
                   THEN EXCLUDED.last_reconciled_at
                 ELSE billing_provider_accounts.last_reconciled_at
               END,
               updated_at = NOW()`,
      params: [
        accountId,
        input.userId,
        input.lease.environment,
        input.providerCustomerId,
        input.providerEventAt,
      ],
    },
    {
      text: `UPDATE billing_checkout_attempts
             SET status = 'indeterminate', provider_customer_id = $4,
                 provider_checkout_id = $5, checkout_url = NULL,
                 provider_event_at = $6, last_error_code = NULL, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
               AND provider = 'creem' AND environment = $3
               AND status IN ('creating', 'open', 'indeterminate')`,
      params: [
        input.checkoutAttemptId,
        input.userId,
        input.lease.environment,
        input.providerCustomerId,
        input.providerCheckoutId,
        input.providerEventAt,
      ],
    },
    webhookLeaseCompletionQuery(input.lease),
  ]);
}

export async function completeWebhookEvent(lease: WebhookEventLease): Promise<void> {
  const result = await pool.query<{ event_id: string }>(
    `UPDATE billing_webhook_events
     SET processed_at = NOW(), processing_owner_token = NULL,
         processing_started_at = NULL, last_error_code = NULL, updated_at = NOW()
     WHERE provider = $1 AND environment = $2 AND event_id = $3
       AND processing_owner_token = $4 AND processed_at IS NULL
     RETURNING event_id`,
    [lease.provider, lease.environment, lease.eventId, lease.ownerToken],
  );
  if (!result.rows[0]) throw new Error('Webhook processing lease was lost before completion.');
}

export async function recordWebhookFailure(
  lease: WebhookEventLease,
  errorCode: string,
): Promise<void> {
  await pool.query(
    `UPDATE billing_webhook_events
     SET processing_owner_token = NULL, processing_started_at = NULL,
         last_error_code = $5, updated_at = NOW()
     WHERE provider = $1 AND environment = $2 AND event_id = $3
       AND processing_owner_token = $4 AND processed_at IS NULL`,
    [lease.provider, lease.environment, lease.eventId, lease.ownerToken, errorCode],
  );
}
