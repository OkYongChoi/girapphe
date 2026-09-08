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
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_product_events_user_subject"
	ON "knowledge_product_events" ("user_id", "subject_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.delete_knowledge_import_batch_product_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
	DELETE FROM public.knowledge_product_events AS event
	USING deleted_knowledge_ingestion_batches AS batch
	WHERE event.user_id = batch.user_id
		AND event.subject_id = pg_catalog.encode(
			pg_catalog.sha256(
				pg_catalog.convert_to(batch.user_id, 'UTF8')
				|| pg_catalog.decode('00', 'hex')
				|| pg_catalog.convert_to(batch.id, 'UTF8')
			),
			'hex'
		);
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER knowledge_ingestion_batches_delete_product_events
	AFTER DELETE ON public.knowledge_ingestion_batches
	REFERENCING OLD TABLE AS deleted_knowledge_ingestion_batches
	FOR EACH STATEMENT
	EXECUTE FUNCTION public.delete_knowledge_import_batch_product_events();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_knowledge_import_batch_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
	requires_live_batch boolean := FALSE;
	requires_selected_export_batch boolean := FALSE;
BEGIN
	IF NEW.event_name = 'knowledge_candidate_resolved' THEN
		requires_live_batch := TRUE;
	ELSIF NEW.event_name IN (
		'conversation_import_confirmed',
		'conversation_import_candidates_ready',
		'conversation_import_first_value_viewed'
	) OR (
		TG_OP = 'UPDATE'
		AND NEW.event_name IN ('conversation_import_started', 'conversation_import_parsed')
	) THEN
		requires_live_batch := TRUE;
		requires_selected_export_batch := TRUE;
	END IF;

	IF NOT requires_live_batch THEN
		RETURN NEW;
	END IF;

	PERFORM 1
	FROM public.knowledge_ingestion_batches AS batch
	WHERE batch.user_id = NEW.user_id
		AND (
			NOT requires_selected_export_batch
			OR (batch.provider = 'chatgpt' AND batch.scope = 'selected_export')
		)
		AND NEW.subject_id = pg_catalog.encode(
			pg_catalog.sha256(
				pg_catalog.convert_to(batch.user_id, 'UTF8')
				|| pg_catalog.decode('00', 'hex')
				|| pg_catalog.convert_to(batch.id, 'UTF8')
			),
			'hex'
		)
	FOR KEY SHARE;
	IF FOUND THEN
		RETURN NEW;
	END IF;

	IF TG_OP = 'UPDATE' THEN
		DELETE FROM public.knowledge_product_events AS event
		WHERE event.id = NEW.id;
	END IF;
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER knowledge_product_events_guard_import_batch_insert
	BEFORE INSERT ON public.knowledge_product_events
	FOR EACH ROW
	EXECUTE FUNCTION public.guard_knowledge_import_batch_event();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER knowledge_product_events_cleanup_import_batch_update
	AFTER UPDATE OF subject_id ON public.knowledge_product_events
	FOR EACH ROW
	EXECUTE FUNCTION public.guard_knowledge_import_batch_event();
