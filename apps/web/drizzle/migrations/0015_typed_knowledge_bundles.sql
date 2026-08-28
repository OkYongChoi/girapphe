ALTER TABLE "user_knowledge_items"
  ADD COLUMN IF NOT EXISTS "knowledge_type" text,
  ADD COLUMN IF NOT EXISTS "central_question" text,
  ADD COLUMN IF NOT EXISTS "structured_content" jsonb,
  ADD COLUMN IF NOT EXISTS "bundle_schema_version" integer;--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  ADD COLUMN IF NOT EXISTS "knowledge_type" text,
  ADD COLUMN IF NOT EXISTS "central_question" text,
  ADD COLUMN IF NOT EXISTS "structured_content" jsonb,
  ADD COLUMN IF NOT EXISTS "bundle_schema_version" integer;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_user_type"
  ON "user_knowledge_items" ("user_id", "knowledge_type")
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_user_type"
  ON "knowledge_card_drafts" ("user_id", "knowledge_type")
  WHERE "status" = 'pending';
