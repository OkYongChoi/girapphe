CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "provider" text NOT NULL
    CONSTRAINT "billing_subscriptions_provider_check"
    CHECK ("provider" IN ('stripe', 'toss', 'revenuecat')),
  "provider_subscription_id" text NOT NULL,
  "store" text
    CONSTRAINT "billing_subscriptions_store_check"
    CHECK ("store" IS NULL OR "store" IN ('web', 'app_store', 'play_store', 'stripe', 'promotional')),
  "plan" text NOT NULL CHECK ("plan" IN ('monthly', 'annual')),
  "status" text NOT NULL
    CONSTRAINT "billing_subscriptions_status_check"
    CHECK ("status" IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  "entitlement" text NOT NULL DEFAULT 'ad_free' CHECK ("entitlement" = 'ad_free'),
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "trial_end" timestamp with time zone,
  "cancel_at_period_end" boolean NOT NULL DEFAULT false,
  "provider_event_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_subscriptions_provider_reference_key"
    UNIQUE ("provider", "provider_subscription_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
  "provider" text NOT NULL
    CONSTRAINT "billing_webhook_events_provider_check"
    CHECK ("provider" IN ('stripe', 'revenuecat', 'toss')),
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("provider", "event_id")
);--> statement-breakpoint

ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "environment" text NOT NULL DEFAULT 'production';--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "provider_customer_id" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "provider_event_id" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "provider_resource_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "provider_root_transaction_id" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "provider_store_subscription_id" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "product_id" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "auto_renew" boolean;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "paid_period_verified" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "last_reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "grace_reason" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "grace_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "billing_reconciliation_generation_seq";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD COLUMN IF NOT EXISTS "reconciliation_generation" bigint;--> statement-breakpoint

UPDATE "billing_subscriptions"
SET "store" = CASE
  WHEN "store" = 'stripe' OR "provider" IN ('stripe', 'toss') THEN 'web'
  WHEN "store" IN ('app_store', 'play_store', 'promotional') THEN "store"
  ELSE 'promotional'
END,
"last_reconciled_at" = COALESCE("last_reconciled_at", "provider_event_at", "updated_at")
WHERE "store" IS NULL
   OR "store" = 'stripe'
   OR "last_reconciled_at" IS NULL;--> statement-breakpoint

ALTER TABLE "billing_subscriptions"
  ALTER COLUMN "store" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  DROP CONSTRAINT IF EXISTS "billing_subscriptions_provider_check";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  DROP CONSTRAINT IF EXISTS "billing_subscriptions_environment_check";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  DROP CONSTRAINT IF EXISTS "billing_subscriptions_store_check";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  DROP CONSTRAINT IF EXISTS "billing_subscriptions_status_check";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  DROP CONSTRAINT IF EXISTS "billing_subscriptions_grace_check";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  DROP CONSTRAINT IF EXISTS "billing_subscriptions_provider_environment_reference_key";--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_provider_environment_reference_key"
    UNIQUE ("provider", "environment", "provider_subscription_id");--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_provider_check"
    CHECK ("provider" IN ('creem', 'superwall', 'stripe', 'revenuecat', 'toss'));--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_environment_check"
    CHECK ("environment" IN ('test', 'production'));--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_store_check"
    CHECK ("store" IN ('web', 'app_store', 'play_store', 'promotional'));--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_status_check"
    CHECK ("status" IN (
      'incomplete', 'trialing', 'active', 'past_due', 'paused',
      'canceled', 'expired', 'refunded', 'revoked'
    ));--> statement-breakpoint
ALTER TABLE "billing_subscriptions"
  ADD CONSTRAINT "billing_subscriptions_grace_check" CHECK (
    ("grace_reason" IS NULL AND "grace_expires_at" IS NULL)
    OR ("grace_reason" IN ('billing', 'verification') AND "grace_expires_at" IS NOT NULL)
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_billing_subscriptions_provider_customer"
  ON "billing_subscriptions" ("provider", "environment", "provider_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_billing_subscriptions_provider_root_transaction"
  ON "billing_subscriptions" ("provider", "environment", "provider_root_transaction_id")
  WHERE "provider_root_transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_subscriptions_provider_store_subscription"
  ON "billing_subscriptions" ("provider", "environment", "provider_store_subscription_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_provider_accounts" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "environment" text NOT NULL,
  "provider_customer_id" text NOT NULL,
  "last_reconciled_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_provider_accounts_provider_customer_key"
    UNIQUE ("provider", "environment", "provider_customer_id"),
  CONSTRAINT "billing_provider_accounts_provider_check"
    CHECK ("provider" IN ('creem', 'superwall', 'stripe', 'revenuecat', 'toss')),
  CONSTRAINT "billing_provider_accounts_environment_check"
    CHECK ("environment" IN ('test', 'production'))
);--> statement-breakpoint
ALTER TABLE "billing_provider_accounts"
  DROP CONSTRAINT IF EXISTS "billing_provider_accounts_user_provider_environment_key";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_provider_accounts_user_provider_environment"
  ON "billing_provider_accounts" ("user_id", "provider", "environment");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_checkout_attempts" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL,
  "provider" text NOT NULL,
  "environment" text NOT NULL,
  "plan" text NOT NULL,
  "product_id" text NOT NULL,
  "status" text NOT NULL,
  "provider_customer_id" text,
  "provider_checkout_id" text,
  "checkout_url" text,
  "expires_at" timestamp with time zone NOT NULL,
  "provider_event_at" timestamp with time zone,
  "last_error_code" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_checkout_attempts_provider_check"
    CHECK ("provider" IN ('creem', 'superwall')),
  CONSTRAINT "billing_checkout_attempts_environment_check"
    CHECK ("environment" IN ('test', 'production')),
  CONSTRAINT "billing_checkout_attempts_plan_check"
    CHECK ("plan" IN ('monthly', 'annual')),
  CONSTRAINT "billing_checkout_attempts_status_check"
    CHECK ("status" IN (
      'creating', 'open', 'indeterminate', 'completed', 'expired', 'abandoned', 'failed'
    ))
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_billing_checkout_attempts_provider_checkout"
  ON "billing_checkout_attempts" ("provider", "environment", "provider_checkout_id")
  WHERE "provider_checkout_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_billing_checkout_attempts_one_unresolved"
  ON "billing_checkout_attempts" ("user_id")
  WHERE "status" IN ('creating', 'open', 'indeterminate');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_checkout_attempts_expiry"
  ON "billing_checkout_attempts" ("status", "expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_acquisition_blocks" (
  "user_id" text NOT NULL,
  "reason" text NOT NULL,
  "operation_owner_token" text,
  "first_detected_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  CONSTRAINT "billing_acquisition_blocks_pkey" PRIMARY KEY ("user_id", "reason"),
  CONSTRAINT "billing_acquisition_blocks_reason_check"
    CHECK ("reason" IN ('duplicate_subscription', 'manual_review', 'mobile_purchase_pending')),
  CONSTRAINT "billing_acquisition_blocks_owner_check"
    CHECK (
      ("reason" = 'mobile_purchase_pending' AND "operation_owner_token" IS NOT NULL)
      OR ("reason" <> 'mobile_purchase_pending' AND "operation_owner_token" IS NULL)
    )
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_acquisition_blocks_open"
  ON "billing_acquisition_blocks" ("updated_at") WHERE "resolved_at" IS NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_request_rate_limits" (
  "user_id" text NOT NULL,
  "action" text NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "request_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_request_rate_limits_pkey" PRIMARY KEY ("user_id", "action"),
  CONSTRAINT "billing_request_rate_limits_action_check"
    CHECK ("action" IN ('customer_portal', 'superwall_reconcile')),
  CONSTRAINT "billing_request_rate_limits_count_check" CHECK ("request_count" >= 0)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_request_rate_limits_stale"
  ON "billing_request_rate_limits" ("updated_at");--> statement-breakpoint

ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "environment" text NOT NULL DEFAULT 'production';--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "provider_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "processing_owner_token" text;--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "last_error_code" text;--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  DROP CONSTRAINT IF EXISTS "billing_webhook_events_provider_check";--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  DROP CONSTRAINT IF EXISTS "billing_webhook_events_environment_check";--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  DROP CONSTRAINT IF EXISTS "billing_webhook_events_attempt_count_check";--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  DROP CONSTRAINT IF EXISTS "billing_webhook_events_provider_environment_event_key";--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_provider_environment_event_key"
    UNIQUE ("provider", "environment", "event_id");--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_provider_check"
    CHECK ("provider" IN ('creem', 'superwall', 'stripe', 'revenuecat', 'toss'));--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_environment_check"
    CHECK ("environment" IN ('test', 'production'));--> statement-breakpoint
ALTER TABLE "billing_webhook_events"
  ADD CONSTRAINT "billing_webhook_events_attempt_count_check"
    CHECK ("attempt_count" >= 0);--> statement-breakpoint
DROP INDEX IF EXISTS "idx_billing_webhook_events_pending";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_webhook_events_pending"
  ON "billing_webhook_events" ("updated_at")
  WHERE "processed_at" IS NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "billing_account_operations" (
  "scope_key" text PRIMARY KEY,
  "provider" text NOT NULL,
  "operation" text NOT NULL,
  "owner_token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_account_operations_scope_check"
    CHECK ("scope_key" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "billing_account_operations_provider_check"
    CHECK ("provider" IN ('creem', 'superwall', 'stripe', 'toss')),
  CONSTRAINT "billing_account_operations_operation_check"
    CHECK ("operation" IN ('checkout', 'mobile_purchase', 'prepare', 'activation', 'renewal', 'reconciliation'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_billing_account_operations_expiry"
  ON "billing_account_operations" ("expires_at");
