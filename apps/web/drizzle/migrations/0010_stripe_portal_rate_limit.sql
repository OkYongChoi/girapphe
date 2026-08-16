ALTER TABLE "billing_customers"
  ADD COLUMN IF NOT EXISTS "stripe_portal_window_started_at"
    timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "stripe_portal_request_count"
    integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  ALTER TABLE "billing_customers"
    ADD CONSTRAINT "billing_customers_stripe_portal_request_count_check"
    CHECK ("stripe_portal_request_count" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
