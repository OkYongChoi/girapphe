ALTER TABLE "knowledge_item_supersessions"
  ADD COLUMN IF NOT EXISTS "replacement_live_item_id" text;--> statement-breakpoint

ALTER TABLE "knowledge_item_supersessions"
  ADD COLUMN IF NOT EXISTS "replacement_live_user_id" text;--> statement-breakpoint

ALTER TABLE "knowledge_item_supersessions"
  DROP CONSTRAINT IF EXISTS "knowledge_item_supersessions_new_owner_fk";--> statement-breakpoint

ALTER TABLE "knowledge_item_supersessions"
  ADD CONSTRAINT "knowledge_item_supersessions_new_owner_fk"
  FOREIGN KEY ("replacement_live_item_id", "replacement_live_user_id")
  REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE set null;--> statement-breakpoint

ALTER TABLE "knowledge_item_supersessions"
  DROP CONSTRAINT IF EXISTS "knowledge_item_supersessions_live_replacement_check";--> statement-breakpoint

ALTER TABLE "knowledge_item_supersessions"
  ADD CONSTRAINT "knowledge_item_supersessions_live_replacement_check"
  CHECK (
    ("replacement_live_item_id" IS NULL AND "replacement_live_user_id" IS NULL)
    OR ("replacement_live_item_id" IS NOT NULL
      AND "replacement_live_user_id" IS NOT NULL
      AND "replacement_live_item_id" = "replacement_item_id"
      AND "replacement_live_user_id" = "user_id")
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_supersessions_live_replacement"
  ON "knowledge_item_supersessions" ("replacement_live_item_id", "replacement_live_user_id");
