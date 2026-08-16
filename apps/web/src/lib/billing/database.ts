import pool from '@/lib/db';

export const AD_FREE_ENTITLEMENT = 'ad_free' as const;

export type BillingProvider = 'stripe' | 'revenuecat' | 'toss';
export type BillingPlan = 'monthly' | 'annual' | 'unknown';

export type SubscriptionWrite = {
  provider: Exclude<BillingProvider, 'toss'>;
  providerSubscriptionId: string;
  userId: string;
  store: string | null;
  plan: BillingPlan;
  status: string;
  entitlement: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  providerEventAt: Date;
};

export type SubscriptionOverview = {
  provider: BillingProvider;
  store: string | null;
  plan: BillingPlan;
  status: string;
  entitlement: string;
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

type WebhookClaim = 'claimed' | 'processed' | 'busy';

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function databaseAvailable() {
  return Boolean(process.env.DATABASE_URL);
}

export async function hasAdFreeEntitlement(userId: string | null): Promise<boolean> {
  if (!userId || !databaseAvailable()) return false;

  try {
    const result = await pool.query<{ entitled: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM billing_subscriptions
         WHERE user_id = $1
           AND entitlement = $2
           AND status IN ('trialing', 'active')
           AND COALESCE(current_period_end, trial_end) > NOW()
       ) AS entitled`,
      [userId, AD_FREE_ENTITLEMENT],
    );
    return result.rows[0]?.entitled === true;
  } catch (error) {
    console.error('Unable to read ad-free entitlement:', error);
    return false;
  }
}

export async function hasBlockingSubscription(userId: string): Promise<boolean> {
  if (!databaseAvailable()) return false;
  const result = await pool.query<{ blocked: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM billing_subscriptions
       WHERE user_id = $1
         AND entitlement = $2
         AND (
           status IN ('incomplete', 'past_due', 'paused')
           OR (
             status IN ('trialing', 'active')
             AND COALESCE(current_period_end, trial_end) > NOW()
           )
         )
     ) AS blocked`,
    [userId, AD_FREE_ENTITLEMENT],
  );
  return result.rows[0]?.blocked === true;
}

export async function getSubscriptionOverview(userId: string): Promise<SubscriptionOverview | null> {
  if (!databaseAvailable()) return null;

  try {
    const result = await pool.query<{
      provider: BillingProvider;
      store: string | null;
      plan: BillingPlan;
      status: string;
      entitlement: string;
      current_period_end: Date | string | null;
      trial_end: Date | string | null;
      cancel_at_period_end: boolean;
    }>(
      `SELECT provider, store, plan, status, entitlement, current_period_end, trial_end, cancel_at_period_end
       FROM billing_subscriptions
       WHERE user_id = $1
         AND entitlement = $2
       ORDER BY
         CASE status WHEN 'trialing' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
         current_period_end DESC NULLS FIRST,
         updated_at DESC
       LIMIT 1`,
      [userId, AD_FREE_ENTITLEMENT],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      provider: row.provider,
      store: row.store,
      plan: row.plan,
      status: row.status,
      entitlement: row.entitlement,
      currentPeriodEnd: asDate(row.current_period_end),
      trialEnd: asDate(row.trial_end),
      cancelAtPeriodEnd: row.cancel_at_period_end,
    };
  } catch (error) {
    console.error('Unable to read subscription overview:', error);
    return null;
  }
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  if (!databaseAvailable()) return null;
  const result = await pool.query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM billing_customers WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return result.rows[0]?.stripe_customer_id ?? null;
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

export async function isStripeTrialAvailable(userId: string): Promise<boolean> {
  if (!databaseAvailable()) return false;
  const result = await pool.query<{ available: boolean }>(
    `SELECT COALESCE(
       (SELECT trial_consumed_at IS NULL FROM billing_customers WHERE user_id = $1),
       TRUE
     ) AS available`,
    [userId],
  );
  return result.rows[0]?.available === true;
}

export async function saveStripeCustomer(userId: string, stripeCustomerId: string): Promise<string> {
  const result = await pool.query<{ stripe_customer_id: string }>(
    `INSERT INTO billing_customers (user_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE
       SET stripe_customer_id = COALESCE(billing_customers.stripe_customer_id, EXCLUDED.stripe_customer_id),
           updated_at = NOW()
     RETURNING stripe_customer_id`,
    [userId, stripeCustomerId],
  );
  const saved = result.rows[0]?.stripe_customer_id;
  if (!saved) throw new Error('Stripe customer mapping was not saved.');
  return saved;
}

export async function findUserIdByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM billing_customers WHERE stripe_customer_id = $1 LIMIT 1',
    [stripeCustomerId],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function claimTrial(userId: string): Promise<Date | null> {
  const result = await pool.query<{ trial_consumed_at: Date | string }>(
    `UPDATE billing_customers
     SET trial_consumed_at = date_trunc('milliseconds', NOW()),
         updated_at = NOW()
     WHERE user_id = $1
       AND trial_consumed_at IS NULL
     RETURNING trial_consumed_at`,
    [userId],
  );
  return asDate(result.rows[0]?.trial_consumed_at);
}

export async function releaseTrialClaim(userId: string, claimedAt: string): Promise<void> {
  await pool.query(
    `UPDATE billing_customers
     SET trial_consumed_at = NULL,
         updated_at = NOW()
     WHERE user_id = $1
       AND trial_consumed_at = $2::timestamptz
       AND NOT EXISTS (
         SELECT 1
         FROM billing_subscriptions
         WHERE user_id = $1
       )`,
    [userId, claimedAt],
  );
}

export async function consumeTrialFromWebhook(userId: string, claimedAt?: string | null): Promise<void> {
  await pool.query(
    `INSERT INTO billing_customers (user_id, trial_consumed_at)
     VALUES ($1, COALESCE($2::timestamptz, date_trunc('milliseconds', NOW())))
     ON CONFLICT (user_id) DO UPDATE SET
       trial_consumed_at = COALESCE(
         billing_customers.trial_consumed_at,
         EXCLUDED.trial_consumed_at
       ),
       updated_at = NOW()`,
    [userId, claimedAt ?? null],
  );
}

export async function upsertSubscription(subscription: SubscriptionWrite): Promise<void> {
  const id = `${subscription.provider}:${subscription.providerSubscriptionId}`;
  await pool.query(
    `INSERT INTO billing_subscriptions (
       id,
       user_id,
       provider,
       provider_subscription_id,
       store,
       plan,
       status,
       entitlement,
       current_period_start,
       current_period_end,
       trial_end,
       cancel_at_period_end,
       provider_event_at,
       created_at,
       updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
     ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       store = COALESCE(EXCLUDED.store, billing_subscriptions.store),
       plan = CASE WHEN EXCLUDED.plan = 'unknown' THEN billing_subscriptions.plan ELSE EXCLUDED.plan END,
       status = EXCLUDED.status,
       entitlement = EXCLUDED.entitlement,
       current_period_start = COALESCE(EXCLUDED.current_period_start, billing_subscriptions.current_period_start),
       current_period_end = COALESCE(EXCLUDED.current_period_end, billing_subscriptions.current_period_end),
       trial_end = COALESCE(EXCLUDED.trial_end, billing_subscriptions.trial_end),
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       provider_event_at = EXCLUDED.provider_event_at,
       updated_at = NOW()
     WHERE billing_subscriptions.provider_event_at IS NULL
        OR EXCLUDED.provider_event_at >= billing_subscriptions.provider_event_at`,
    [
      id,
      subscription.userId,
      subscription.provider,
      subscription.providerSubscriptionId,
      subscription.store,
      subscription.plan,
      subscription.status,
      subscription.entitlement,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.trialEnd,
      subscription.cancelAtPeriodEnd,
      subscription.providerEventAt,
    ],
  );
}

export async function reconcileRevenueCatSubscription(
  subscription: Omit<SubscriptionWrite, 'provider'>,
): Promise<void> {
  const id = `revenuecat:${subscription.providerSubscriptionId}`;
  await pool.query(
    `WITH upserted AS (
       INSERT INTO billing_subscriptions (
         id,
         user_id,
         provider,
         provider_subscription_id,
         store,
         plan,
         status,
         entitlement,
         current_period_start,
         current_period_end,
         trial_end,
         cancel_at_period_end,
         provider_event_at,
         created_at,
         updated_at
       ) VALUES ($1, $2, 'revenuecat', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         store = EXCLUDED.store,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         entitlement = EXCLUDED.entitlement,
         current_period_start = COALESCE(EXCLUDED.current_period_start, billing_subscriptions.current_period_start),
         current_period_end = EXCLUDED.current_period_end,
         trial_end = EXCLUDED.trial_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         provider_event_at = EXCLUDED.provider_event_at,
         updated_at = NOW()
       WHERE billing_subscriptions.provider_event_at IS NULL
          OR EXCLUDED.provider_event_at >= billing_subscriptions.provider_event_at
       RETURNING provider_subscription_id
     )
     UPDATE billing_subscriptions
     SET status = 'expired',
         cancel_at_period_end = FALSE,
         provider_event_at = $12,
         updated_at = NOW()
     WHERE provider = 'revenuecat'
       AND user_id = $2
       AND provider_subscription_id <> $3
       AND (provider_event_at IS NULL OR provider_event_at <= $12)
       AND EXISTS (SELECT 1 FROM upserted)`,
    [
      id,
      subscription.userId,
      subscription.providerSubscriptionId,
      subscription.store,
      subscription.plan,
      subscription.status,
      subscription.entitlement,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.trialEnd,
      subscription.cancelAtPeriodEnd,
      subscription.providerEventAt,
    ],
  );
}

export async function moveVerifiedRevenueCatSubscription(
  subscription: Omit<SubscriptionWrite, 'provider'>,
  allowedPreviousUserIds: string[],
): Promise<boolean> {
  const id = `revenuecat:${subscription.providerSubscriptionId}`;
  const moved = await pool.query<{ provider_subscription_id: string }>(
    `INSERT INTO billing_subscriptions (
       id,
       user_id,
       provider,
       provider_subscription_id,
       store,
       plan,
       status,
       entitlement,
       current_period_start,
       current_period_end,
       trial_end,
       cancel_at_period_end,
       provider_event_at,
       created_at,
       updated_at
     ) VALUES ($1, $2, 'revenuecat', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     ON CONFLICT (provider, provider_subscription_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       store = EXCLUDED.store,
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       entitlement = EXCLUDED.entitlement,
       current_period_start = COALESCE(EXCLUDED.current_period_start, billing_subscriptions.current_period_start),
       current_period_end = EXCLUDED.current_period_end,
       trial_end = EXCLUDED.trial_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       provider_event_at = EXCLUDED.provider_event_at,
       updated_at = NOW()
     WHERE (
         billing_subscriptions.provider_event_at IS NULL
         OR EXCLUDED.provider_event_at >= billing_subscriptions.provider_event_at
       )
       AND (
         billing_subscriptions.user_id = EXCLUDED.user_id
         OR billing_subscriptions.user_id = ANY($13::text[])
       )
     RETURNING provider_subscription_id`,
    [
      id,
      subscription.userId,
      subscription.providerSubscriptionId,
      subscription.store,
      subscription.plan,
      subscription.status,
      subscription.entitlement,
      subscription.currentPeriodStart,
      subscription.currentPeriodEnd,
      subscription.trialEnd,
      subscription.cancelAtPeriodEnd,
      subscription.providerEventAt,
      allowedPreviousUserIds,
    ],
  );
  return moved.rows.length > 0;
}

export async function expireRevenueCatSubscriptions(
  userId: string,
  providerEventAt: Date,
  exceptProviderSubscriptionId: string | null = null,
): Promise<void> {
  await pool.query(
    `UPDATE billing_subscriptions
     SET status = 'expired',
         cancel_at_period_end = FALSE,
         provider_event_at = $2,
         updated_at = NOW()
     WHERE provider = 'revenuecat'
       AND user_id = $1
       AND ($3::text IS NULL OR provider_subscription_id <> $3)
       AND (provider_event_at IS NULL OR provider_event_at <= $2)`,
    [userId, providerEventAt, exceptProviderSubscriptionId],
  );
}

export async function claimWebhookEvent(
  provider: BillingProvider,
  eventId: string,
  eventType: string,
): Promise<WebhookClaim> {
  const claimed = await pool.query<{ event_id: string }>(
    `INSERT INTO billing_webhook_events (provider, event_id, event_type, processed_at, created_at)
     VALUES ($1, $2, $3, NULL, NOW())
     ON CONFLICT (provider, event_id) DO UPDATE SET
       event_type = EXCLUDED.event_type,
       created_at = NOW()
     WHERE billing_webhook_events.processed_at IS NULL
       AND billing_webhook_events.created_at < NOW() - INTERVAL '10 minutes'
     RETURNING event_id`,
    [provider, eventId, eventType],
  );
  if (claimed.rows.length > 0) return 'claimed';

  const existing = await pool.query<{ processed_at: Date | string | null }>(
    `SELECT processed_at
     FROM billing_webhook_events
     WHERE provider = $1 AND event_id = $2`,
    [provider, eventId],
  );
  return existing.rows[0]?.processed_at ? 'processed' : 'busy';
}

export async function markWebhookEventProcessed(provider: BillingProvider, eventId: string): Promise<void> {
  await pool.query(
    `UPDATE billing_webhook_events
     SET processed_at = NOW()
     WHERE provider = $1 AND event_id = $2`,
    [provider, eventId],
  );
}

export async function releaseWebhookEvent(provider: BillingProvider, eventId: string): Promise<void> {
  await pool.query(
    `DELETE FROM billing_webhook_events
     WHERE provider = $1 AND event_id = $2 AND processed_at IS NULL`,
    [provider, eventId],
  );
}
