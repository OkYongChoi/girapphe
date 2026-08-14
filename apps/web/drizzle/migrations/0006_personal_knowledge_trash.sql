ALTER TABLE "user_knowledge_items"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "purge_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_active_created"
  ON "user_knowledge_items" ("user_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_purge_at"
  ON "user_knowledge_items" ("purge_at")
  WHERE "purge_at" IS NOT NULL;
