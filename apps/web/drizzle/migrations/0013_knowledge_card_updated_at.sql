ALTER TABLE "knowledge_cards"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone,
  ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
UPDATE "knowledge_cards"
SET "updated_at" = COALESCE("updated_at", "created_at", now())
WHERE "updated_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "knowledge_cards"
  ALTER COLUMN "updated_at" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_cards_updated_at"
  ON "knowledge_cards" USING btree ("updated_at" DESC);
