CREATE TABLE IF NOT EXISTS billing_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  toss_customer_key TEXT UNIQUE,
  trial_consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS toss_prepare_rate_limits (
  user_id TEXT PRIMARY KEY,
  window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toss_prepare_rate_limits_updated_at
ON toss_prepare_rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'toss', 'revenuecat')),
  provider_subscription_id TEXT NOT NULL,
  store TEXT CHECK (store IS NULL OR store IN ('web', 'app_store', 'play_store', 'stripe', 'promotional')),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  entitlement TEXT NOT NULL DEFAULT 'ad_free' CHECK (entitlement = 'ad_free'),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  provider_event_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT billing_subscriptions_provider_reference_key UNIQUE(provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_entitlement
ON billing_subscriptions(user_id, entitlement, status);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_period_end
ON billing_subscriptions(current_period_end);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'revenuecat', 'toss')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_pending
ON billing_webhook_events(created_at) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS toss_billing_agreements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  billing_key_ciphertext TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  next_charge_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  processing_started_at TIMESTAMP WITH TIME ZONE,
  processing_token TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  billing_key_cleanup_required BOOLEAN NOT NULL DEFAULT FALSE,
  billing_key_cleanup_attempts INTEGER NOT NULL DEFAULT 0 CHECK (billing_key_cleanup_attempts >= 0),
  billing_key_cleanup_last_error TEXT,
  billing_key_deleted_at TIMESTAMP WITH TIME ZONE,
  last_payment_key TEXT,
  last_order_id TEXT,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toss_billing_agreements_due
ON toss_billing_agreements(next_charge_at)
WHERE next_charge_at IS NOT NULL AND cancel_at_period_end = FALSE;

CREATE INDEX IF NOT EXISTS idx_toss_billing_agreements_key_cleanup
ON toss_billing_agreements(updated_at)
WHERE billing_key_cleanup_required = TRUE;

CREATE TABLE IF NOT EXISTS toss_billing_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'consumed', 'failed', 'abandoned')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processing_started_at TIMESTAMP WITH TIME ZONE,
  consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toss_billing_sessions_user_status
ON toss_billing_sessions(user_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_toss_billing_sessions_cleanup
ON toss_billing_sessions(status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_billing_sessions_one_pending
ON toss_billing_sessions(user_id)
WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS toss_billing_charges (
  order_id TEXT PRIMARY KEY,
  agreement_id TEXT NOT NULL REFERENCES toss_billing_agreements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  cycle_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  amount_krw INTEGER NOT NULL CHECK (amount_krw > 0),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'applied', 'canceled', 'abandoned')),
  payment_key TEXT UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT toss_billing_charges_agreement_cycle_key UNIQUE(agreement_id, cycle_key),
  CONSTRAINT toss_billing_charges_period_check CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_toss_billing_charges_reconciliation
ON toss_billing_charges(status, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_toss_billing_charges_one_unresolved
ON toss_billing_charges(agreement_id)
WHERE status IN ('pending', 'paid');
