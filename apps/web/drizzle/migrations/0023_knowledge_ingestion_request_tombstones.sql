CREATE TABLE IF NOT EXISTS "knowledge_ingestion_request_tombstones" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_ingestion_request_tombstones_user_provider_request_pk"
		PRIMARY KEY("user_id", "provider", "request_id"),
	CONSTRAINT "knowledge_ingestion_request_tombstones_provider_check"
		CHECK ("provider" IN ('chatgpt', 'claude', 'gemini', 'other'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_knowledge_ingestion_batches_user_provider_scope_request"
	ON "knowledge_ingestion_batches" ("user_id", "provider", "scope", "request_id");
--> statement-breakpoint
ALTER TABLE "knowledge_ingestion_batches"
	DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_user_provider_request_key",
	DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_user_id_provider_request_id_key";
