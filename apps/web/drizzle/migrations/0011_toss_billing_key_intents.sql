CREATE TABLE IF NOT EXISTS "toss_billing_key_intents" (
  "id" text PRIMARY KEY NOT NULL,
  "agreement_id" text NOT NULL,
  "user_id" text NOT NULL,
  "customer_key" text NOT NULL,
  "plan" text NOT NULL,
  "provider_idempotency_key" text UNIQUE,
  "auth_key_ciphertext" text,
  "billing_key_ciphertext" text,
  "billing_key_fingerprint" text,
  "status" text NOT NULL DEFAULT 'issuing',
  "issue_attempt_count" integer NOT NULL DEFAULT 0,
  "cleanup_attempt_count" integer NOT NULL DEFAULT 0,
  "processing_started_at" timestamp with time zone,
  "processing_token" text,
  "last_error_code" text,
  "cleaned_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "toss_billing_key_intents_id_agreement_user_key"
    UNIQUE ("id", "agreement_id", "user_id"),
  CONSTRAINT "toss_billing_key_intents_plan_check"
    CHECK ("plan" IN ('monthly', 'annual')),
  CONSTRAINT "toss_billing_key_intents_status_check"
    CHECK ("status" IN ('issuing', 'cleanup_pending', 'live', 'cleaned', 'manual_review')),
  CONSTRAINT "toss_billing_key_intents_issue_attempts_check"
    CHECK ("issue_attempt_count" >= 0),
  CONSTRAINT "toss_billing_key_intents_cleanup_attempts_check"
    CHECK ("cleanup_attempt_count" >= 0),
  CONSTRAINT "toss_billing_key_intents_material_check"
    CHECK (
      ("status" = 'issuing'
        AND "provider_idempotency_key" IS NOT NULL
        AND "auth_key_ciphertext" IS NOT NULL
        AND "billing_key_ciphertext" IS NULL
        AND "billing_key_fingerprint" IS NULL)
      OR ("status" IN ('cleanup_pending', 'live')
        AND "auth_key_ciphertext" IS NULL
        AND "billing_key_ciphertext" IS NOT NULL
        AND ("billing_key_fingerprint" IS NOT NULL
          OR ("status" = 'live' AND "provider_idempotency_key" IS NULL)))
      OR ("status" = 'cleaned'
        AND "auth_key_ciphertext" IS NULL
        AND "billing_key_ciphertext" IS NULL)
      OR ("status" = 'manual_review'
        AND "provider_idempotency_key" IS NOT NULL
        AND "auth_key_ciphertext" IS NULL
        AND "billing_key_ciphertext" IS NULL
        AND "billing_key_fingerprint" IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS "idx_toss_billing_key_intents_recovery"
  ON "toss_billing_key_intents" ("status", "updated_at")
  WHERE "status" IN ('issuing', 'cleanup_pending');

CREATE INDEX IF NOT EXISTS "idx_toss_billing_key_intents_agreement"
  ON "toss_billing_key_intents" ("agreement_id", "status");

ALTER TABLE "toss_billing_agreements"
  ADD COLUMN IF NOT EXISTS "billing_key_intent_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'toss_billing_agreements_intent_owner_fk'
  ) THEN
    ALTER TABLE "toss_billing_agreements"
      ADD CONSTRAINT "toss_billing_agreements_intent_owner_fk"
      FOREIGN KEY ("billing_key_intent_id", "id", "user_id")
      REFERENCES "toss_billing_key_intents"("id", "agreement_id", "user_id")
      ON DELETE RESTRICT;
  END IF;
END $$;

INSERT INTO "toss_billing_key_intents" (
  "id", "agreement_id", "user_id", "customer_key", "plan",
  "billing_key_ciphertext", "status", "created_at", "updated_at"
)
SELECT
  'toss_legacy_' || md5(a."id" || ':' || a."billing_key_ciphertext"),
  a."id", a."user_id", c."toss_customer_key", a."plan",
  a."billing_key_ciphertext", 'live', a."created_at", now()
FROM "toss_billing_agreements" a
JOIN "billing_customers" c ON c."user_id" = a."user_id"
WHERE a."billing_key_intent_id" IS NULL
  AND c."toss_customer_key" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "toss_billing_agreements" a
SET "billing_key_intent_id" = i."id", "updated_at" = now()
FROM "toss_billing_key_intents" i
WHERE a."billing_key_intent_id" IS NULL
  AND i."id" = 'toss_legacy_' || md5(a."id" || ':' || a."billing_key_ciphertext")
  AND i."agreement_id" = a."id"
  AND i."user_id" = a."user_id"
  AND i."billing_key_ciphertext" = a."billing_key_ciphertext"
  AND i."status" = 'live';
