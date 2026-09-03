CREATE TABLE IF NOT EXISTS "user_private_card_states" (
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL,
  "status" text NOT NULL,
  "knowledge_state" text NOT NULL,
  "progress_state" text NOT NULL,
  "due_at" timestamp with time zone,
  "last_seen" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_private_card_states_user_id_knowledge_item_id_pk"
    PRIMARY KEY ("user_id", "knowledge_item_id"),
  CONSTRAINT "user_private_card_states_item_owner_fk"
    FOREIGN KEY ("knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items" ("id", "user_id")
    ON DELETE cascade,
  CONSTRAINT "user_private_card_states_status_check"
    CHECK ("status" IN ('known', 'saved')),
  CONSTRAINT "user_private_card_states_knowledge_state_check"
    CHECK ("knowledge_state" IN ('unknown', 'known')),
  CONSTRAINT "user_private_card_states_progress_state_check"
    CHECK ("progress_state" IN ('learning', 'review')),
  CONSTRAINT "user_private_card_states_consistency_check"
    CHECK (
      ("status" = 'known' AND "knowledge_state" = 'known' AND "progress_state" = 'review')
      OR
      ("status" = 'saved' AND "knowledge_state" = 'unknown' AND "progress_state" = 'learning')
    )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_private_card_states_user_status"
ON "user_private_card_states" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_private_card_states_user_due"
ON "user_private_card_states" ("user_id", "due_at");
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
ADD COLUMN IF NOT EXISTS "recall_enrolled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
ADD COLUMN IF NOT EXISTS "recall_item_version" integer;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
ADD COLUMN IF NOT EXISTS "recall_schedule_state" text;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
ADD COLUMN IF NOT EXISTS "recall_d1_finalized_incomplete" boolean;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
ADD COLUMN IF NOT EXISTS "recall_d7_outcome" text;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
ADD COLUMN IF NOT EXISTS "recall_schedule_version" integer;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
  ALTER COLUMN "status" DROP NOT NULL,
  ALTER COLUMN "knowledge_state" DROP NOT NULL,
  ALTER COLUMN "progress_state" DROP NOT NULL,
  ALTER COLUMN "last_seen" DROP NOT NULL,
  ALTER COLUMN "last_seen" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
  DROP CONSTRAINT IF EXISTS "user_private_card_states_status_check",
  DROP CONSTRAINT IF EXISTS "user_private_card_states_knowledge_state_check",
  DROP CONSTRAINT IF EXISTS "user_private_card_states_progress_state_check",
  DROP CONSTRAINT IF EXISTS "user_private_card_states_consistency_check",
  DROP CONSTRAINT IF EXISTS "user_private_card_states_recall_schedule_check";
--> statement-breakpoint
ALTER TABLE "user_private_card_states"
  ADD CONSTRAINT "user_private_card_states_status_check"
    CHECK ("status" IS NULL OR "status" IN ('known', 'saved')),
  ADD CONSTRAINT "user_private_card_states_knowledge_state_check"
    CHECK ("knowledge_state" IS NULL OR "knowledge_state" IN ('unknown', 'known')),
  ADD CONSTRAINT "user_private_card_states_progress_state_check"
    CHECK ("progress_state" IS NULL OR "progress_state" IN ('learning', 'review')),
  ADD CONSTRAINT "user_private_card_states_consistency_check"
    CHECK (COALESCE(
      (
        "status" IS NULL
        AND "knowledge_state" IS NULL
        AND "progress_state" IS NULL
        AND "last_seen" IS NULL
        AND "recall_enrolled_at" IS NOT NULL
      )
      OR (
        "status" = 'known'
        AND "knowledge_state" = 'known'
        AND "progress_state" = 'review'
        AND "last_seen" IS NOT NULL
      )
      OR (
        "status" = 'saved'
        AND "knowledge_state" = 'unknown'
        AND "progress_state" = 'learning'
        AND "last_seen" IS NOT NULL
      ),
      FALSE
    )),
  ADD CONSTRAINT "user_private_card_states_recall_schedule_check"
    CHECK (COALESCE(
      (
        "recall_enrolled_at" IS NULL
        AND "recall_item_version" IS NULL
        AND "recall_schedule_state" IS NULL
        AND "recall_d1_finalized_incomplete" IS NULL
        AND "recall_d7_outcome" IS NULL
        AND "recall_schedule_version" IS NULL
      )
      OR (
        "recall_enrolled_at" IS NOT NULL
        AND "recall_item_version" >= 1
        AND "recall_schedule_version" >= 1
        AND "recall_d1_finalized_incomplete" IS NOT NULL
        AND "recall_schedule_state" IN (
          'd1_pending', 'd1_retry', 'd7_pending', 'ordinary_practice'
        )
        AND "due_at" IS NOT NULL
        AND (
          (
            "recall_schedule_state" = 'd1_pending'
            AND "recall_d1_finalized_incomplete" = FALSE
            AND "recall_d7_outcome" IS NULL
            AND "due_at" >= "recall_enrolled_at" + INTERVAL '24 hours'
            AND "due_at" < "recall_enrolled_at" + INTERVAL '48 hours'
          )
          OR (
            "recall_schedule_state" = 'd1_retry'
            AND "recall_d1_finalized_incomplete" = FALSE
            AND "recall_d7_outcome" IS NULL
            AND "due_at" >= "recall_enrolled_at" + INTERVAL '24 hours'
            AND "due_at" < "recall_enrolled_at" + INTERVAL '168 hours'
          )
          OR (
            "recall_schedule_state" = 'd7_pending'
            AND "recall_d7_outcome" IS NULL
            AND "due_at" >= "recall_enrolled_at" + INTERVAL '168 hours'
            AND "due_at" < "recall_enrolled_at" + INTERVAL '192 hours'
          )
          OR (
            "recall_schedule_state" = 'ordinary_practice'
            AND "recall_d7_outcome" IN ('remembered', 'partial', 'missed', 'unassessed')
            AND "due_at" >= "recall_enrolled_at" + INTERVAL '192 hours'
          )
        )
      ),
      FALSE
    ));
--> statement-breakpoint
ALTER TABLE "knowledge_card_sources"
ADD COLUMN IF NOT EXISTS "supported_item_version" integer;
--> statement-breakpoint
ALTER TABLE "knowledge_card_sources"
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_supported_item_version_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_supported_revision_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_card_sources"
  ADD CONSTRAINT "knowledge_card_sources_supported_item_version_check"
    CHECK ("supported_item_version" IS NULL OR "supported_item_version" >= 1),
  ADD CONSTRAINT "knowledge_card_sources_supported_revision_fk"
    FOREIGN KEY ("knowledge_item_id", "supported_item_version")
    REFERENCES "knowledge_item_revisions" ("knowledge_item_id", "version");
