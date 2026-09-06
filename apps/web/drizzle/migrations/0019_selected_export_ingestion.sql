ALTER TABLE "knowledge_ingestion_batches"
  DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_scope_check";--> statement-breakpoint

ALTER TABLE "knowledge_ingestion_batches"
  ADD CONSTRAINT "knowledge_ingestion_batches_scope_check"
  CHECK ("scope" IN ('current_conversation', 'selected_export')) NOT VALID;--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  ADD COLUMN IF NOT EXISTS "observed_at" TIMESTAMP WITH TIME ZONE;
