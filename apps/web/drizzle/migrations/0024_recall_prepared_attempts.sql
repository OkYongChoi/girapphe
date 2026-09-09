CREATE TABLE IF NOT EXISTS "recall_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL,
  "item_version" integer NOT NULL,
  "schedule_version" integer NOT NULL,
  "recall_enrolled_at" timestamp with time zone NOT NULL,
  "milestone" text NOT NULL,
  "exercise_type" text NOT NULL,
  "lifecycle_state" text NOT NULL DEFAULT 'prepared',
  "confidence" text,
  "self_assessed_outcome" text,
  "hint_used" boolean,
  "response_duration_bucket" text,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "confidence_selected_at" timestamp with time zone,
  "revealed_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "invalidated_at" timestamp with time zone,
  "invalidation_reason" text,
  "resulting_due_at" timestamp with time zone,
  "retention_expires_at" timestamp with time zone NOT NULL DEFAULT (now() + INTERVAL '365 days'),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "recall_attempts_id_check"
    CHECK ("id" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "recall_attempts_item_owner_fk"
    FOREIGN KEY ("knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items" ("id", "user_id")
    ON DELETE cascade,
  CONSTRAINT "recall_attempts_item_version_check"
    CHECK ("item_version" >= 1),
  CONSTRAINT "recall_attempts_schedule_version_check"
    CHECK ("schedule_version" >= 1),
  CONSTRAINT "recall_attempts_milestone_check"
    CHECK ("milestone" IN ('d1', 'd7')),
  CONSTRAINT "recall_attempts_exercise_type_check"
    CHECK ("exercise_type" IN ('concept', 'procedure', 'comparison')),
  CONSTRAINT "recall_attempts_lifecycle_state_check"
    CHECK ("lifecycle_state" IN (
      'prepared', 'confidence_selected', 'revealed', 'completed', 'invalidated'
    )),
  CONSTRAINT "recall_attempts_confidence_check"
    CHECK ("confidence" IS NULL OR "confidence" IN ('low', 'medium', 'high')),
  CONSTRAINT "recall_attempts_outcome_check"
    CHECK ("self_assessed_outcome" IS NULL OR "self_assessed_outcome" IN (
      'remembered', 'partial', 'missed'
    )),
  CONSTRAINT "recall_attempts_duration_check"
    CHECK ("response_duration_bucket" IS NULL OR "response_duration_bucket" IN (
      'under_30s', '30_to_89s', '90_to_179s', '3_to_5m', 'over_5m'
    )),
  CONSTRAINT "recall_attempts_invalidation_reason_check"
    CHECK ("invalidation_reason" IS NULL OR "invalidation_reason" IN (
      'stale_context', 'item_removed'
    )),
  CONSTRAINT "recall_attempts_retention_check"
    CHECK (
      "retention_expires_at" > "started_at"
      AND "retention_expires_at" <= "started_at" + INTERVAL '365 days'
    ),
  CONSTRAINT "recall_attempts_timestamp_order_check"
    CHECK (
      ("confidence_selected_at" IS NULL OR "confidence_selected_at" >= "started_at")
      AND ("revealed_at" IS NULL OR "revealed_at" >= "confidence_selected_at")
      AND ("completed_at" IS NULL OR "completed_at" >= "revealed_at")
      AND ("invalidated_at" IS NULL OR "invalidated_at" >= "started_at")
      AND "updated_at" >= "started_at"
    ),
  CONSTRAINT "recall_attempts_lifecycle_shape_check"
    CHECK (COALESCE(
      (
        "lifecycle_state" = 'prepared'
        AND "confidence" IS NULL
        AND "confidence_selected_at" IS NULL
        AND "revealed_at" IS NULL
        AND "completed_at" IS NULL
        AND "invalidated_at" IS NULL
        AND "invalidation_reason" IS NULL
        AND "self_assessed_outcome" IS NULL
        AND "hint_used" IS NULL
        AND "response_duration_bucket" IS NULL
        AND "resulting_due_at" IS NULL
      )
      OR (
        "lifecycle_state" = 'confidence_selected'
        AND "confidence" IS NOT NULL
        AND "confidence_selected_at" IS NOT NULL
        AND "revealed_at" IS NULL
        AND "completed_at" IS NULL
        AND "invalidated_at" IS NULL
        AND "invalidation_reason" IS NULL
        AND "self_assessed_outcome" IS NULL
        AND "hint_used" IS NULL
        AND "response_duration_bucket" IS NULL
        AND "resulting_due_at" IS NULL
      )
      OR (
        "lifecycle_state" = 'revealed'
        AND "confidence" IS NOT NULL
        AND "confidence_selected_at" IS NOT NULL
        AND "revealed_at" IS NOT NULL
        AND "completed_at" IS NULL
        AND "invalidated_at" IS NULL
        AND "invalidation_reason" IS NULL
        AND "self_assessed_outcome" IS NULL
        AND "hint_used" IS NULL
        AND "response_duration_bucket" IS NULL
        AND "resulting_due_at" IS NULL
      )
      OR (
        "lifecycle_state" = 'completed'
        AND "confidence" IS NOT NULL
        AND "confidence_selected_at" IS NOT NULL
        AND "revealed_at" IS NOT NULL
        AND "completed_at" IS NOT NULL
        AND "invalidated_at" IS NULL
        AND "invalidation_reason" IS NULL
        AND "self_assessed_outcome" IS NOT NULL
        AND "hint_used" IS NOT NULL
        AND "response_duration_bucket" IS NOT NULL
        AND "resulting_due_at" IS NOT NULL
      )
      OR (
        "lifecycle_state" = 'invalidated'
        AND "completed_at" IS NULL
        AND "invalidated_at" IS NOT NULL
        AND "invalidation_reason" IS NOT NULL
        AND "self_assessed_outcome" IS NULL
        AND "hint_used" IS NULL
        AND "response_duration_bucket" IS NULL
        AND "resulting_due_at" IS NULL
        AND (
          (
            "confidence" IS NULL
            AND "confidence_selected_at" IS NULL
            AND "revealed_at" IS NULL
          )
          OR (
            "confidence" IS NOT NULL
            AND "confidence_selected_at" IS NOT NULL
          )
        )
      ),
      FALSE
    ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_recall_attempts_one_active_milestone"
ON "recall_attempts" ("user_id", "knowledge_item_id", "item_version", "milestone")
WHERE "lifecycle_state" IN ('prepared', 'confidence_selected', 'revealed');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recall_attempts_user_item_started"
ON "recall_attempts" ("user_id", "knowledge_item_id", "started_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_recall_attempts_retention"
ON "recall_attempts" ("retention_expires_at");
