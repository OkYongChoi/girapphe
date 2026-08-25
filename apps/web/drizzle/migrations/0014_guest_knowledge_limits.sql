CREATE TABLE IF NOT EXISTS "guest_knowledge_write_limits" (
	"scope_key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_guest_knowledge_write_limits_updated" ON "guest_knowledge_write_limits" USING btree ("updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_knowledge_create_requests" (
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_knowledge_create_requests_user_id_request_id_pk" PRIMARY KEY("user_id", "request_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_knowledge_create_requests_created" ON "user_knowledge_create_requests" USING btree ("created_at");
--> statement-breakpoint
UPDATE "user_knowledge_items"
SET "purge_at" = "created_at" + INTERVAL '90 days'
WHERE "user_id" LIKE 'guest\_%' ESCAPE '\'
  AND "purge_at" IS NULL;
