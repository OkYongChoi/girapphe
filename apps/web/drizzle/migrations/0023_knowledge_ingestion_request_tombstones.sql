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
CREATE OR REPLACE FUNCTION public.derive_account_lifecycle_scope_key(account_user_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
	SELECT pg_catalog.encode(
		pg_catalog.sha256(
			pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
			|| pg_catalog.decode('00', 'hex')
			|| pg_catalog.convert_to(account_user_id, 'UTF8')
		),
		'hex'
	)
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_ingestion_request_tombstones_account_scope"
	ON "knowledge_ingestion_request_tombstones" (
		public.derive_account_lifecycle_scope_key("user_id")
	);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.purge_deleted_account_ingestion_tombstones()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock(
		pg_catalog.hashtext('mcp-account-lifecycle:' || NEW.scope_key)
	);
	DELETE FROM public.knowledge_ingestion_request_tombstones AS tombstone
	WHERE public.derive_account_lifecycle_scope_key(tombstone.user_id) = NEW.scope_key;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER mcp_deleted_account_markers_purge_ingestion_tombstones
	BEFORE INSERT ON public.mcp_deleted_account_markers
	FOR EACH ROW
	EXECUTE FUNCTION public.purge_deleted_account_ingestion_tombstones();
--> statement-breakpoint
DELETE FROM public.knowledge_ingestion_request_tombstones AS tombstone
USING public.mcp_deleted_account_markers AS marker
WHERE public.derive_account_lifecycle_scope_key(tombstone.user_id) = marker.scope_key;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_knowledge_ingestion_batches_user_provider_scope_request"
	ON "knowledge_ingestion_batches" ("user_id", "provider", "scope", "request_id");
--> statement-breakpoint
ALTER TABLE "knowledge_ingestion_batches"
	DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_user_provider_request_key",
	DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_user_id_provider_request_id_key";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.lock_selected_export_batch_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
	batch_user_id text;
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.scope <> 'selected_export' THEN
			RETURN OLD;
		END IF;
		batch_user_id := OLD.user_id;
	ELSE
		IF NEW.scope <> 'selected_export' THEN
			RETURN NEW;
		END IF;
		batch_user_id := NEW.user_id;
	END IF;

	PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
		'mcp-account-lifecycle:' || pg_catalog.encode(
			pg_catalog.sha256(
				pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
				|| pg_catalog.decode('00', 'hex')
				|| pg_catalog.convert_to(batch_user_id, 'UTF8')
			),
			'hex'
		)
	));

	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER knowledge_ingestion_batches_00_lock_selected_export_owner
	BEFORE INSERT OR DELETE ON public.knowledge_ingestion_batches
	FOR EACH ROW
	EXECUTE FUNCTION public.lock_selected_export_batch_owner();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.guard_deleted_selected_export_batch_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
	session_tombstone_id text := NULL;
BEGIN
	IF NEW.scope <> 'selected_export' THEN
		RETURN NEW;
	END IF;

	IF pg_catalog.lower(NEW.request_id) ~ ':session:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
		session_tombstone_id := 'selected-export-session:v1:'
			|| pg_catalog.substring(
				pg_catalog.lower(NEW.request_id),
				':session:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
			);
	ELSIF NEW.provider = 'chatgpt'
		AND pg_catalog.lower(NEW.request_id) ~ '^chatgpt-export:[0-9a-f]{48}$'
		AND pg_catalog.lower(NEW.id) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
		session_tombstone_id := 'selected-export-session:v1:' || pg_catalog.lower(NEW.id);
	END IF;

	PERFORM 1
	FROM public.mcp_deleted_account_markers AS marker
	WHERE marker.scope_key = pg_catalog.encode(
		pg_catalog.sha256(
			pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
			|| pg_catalog.decode('00', 'hex')
			|| pg_catalog.convert_to(NEW.user_id, 'UTF8')
		),
		'hex'
	)
	FOR KEY SHARE;
	IF FOUND THEN
		RETURN NULL;
	END IF;

	PERFORM 1
	FROM public.knowledge_ingestion_request_tombstones AS tombstone
	WHERE tombstone.user_id = NEW.user_id
		AND tombstone.provider = NEW.provider
		AND (
			tombstone.request_id = NEW.request_id
			OR (
				session_tombstone_id IS NOT NULL
				AND tombstone.request_id = session_tombstone_id
			)
		)
	FOR KEY SHARE;
	IF FOUND THEN
		RETURN NULL;
	END IF;

	IF (
		SELECT COUNT(*)
		FROM public.knowledge_ingestion_request_tombstones AS tombstone
		WHERE tombstone.user_id = NEW.user_id
	) + (2 * (
		SELECT COUNT(*)
		FROM public.knowledge_ingestion_batches AS batch
		WHERE batch.user_id = NEW.user_id
			AND batch.scope = 'selected_export'
	)) + 2 > 40000 THEN
		RETURN NULL;
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER knowledge_ingestion_batches_guard_selected_export_insert
	BEFORE INSERT ON public.knowledge_ingestion_batches
	FOR EACH ROW
	EXECUTE FUNCTION public.guard_deleted_selected_export_batch_insert();
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
	INSERT INTO public.knowledge_ingestion_request_tombstones
		(user_id, provider, request_id)
	SELECT batch.user_id, batch.provider, candidate.request_id
	FROM deleted_knowledge_ingestion_batches AS batch
	CROSS JOIN LATERAL (
		VALUES
			(batch.request_id),
			(CASE
				WHEN pg_catalog.lower(batch.request_id) ~ ':session:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
					THEN 'selected-export-session:v1:' || pg_catalog.substring(
						pg_catalog.lower(batch.request_id),
						':session:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$'
					)
				WHEN batch.provider = 'chatgpt'
					AND pg_catalog.lower(batch.request_id) ~ '^chatgpt-export:[0-9a-f]{48}$'
					AND pg_catalog.lower(batch.id) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
					THEN 'selected-export-session:v1:' || pg_catalog.lower(batch.id)
				ELSE NULL
			END)
	) AS candidate(request_id)
	WHERE batch.scope = 'selected_export'
		AND candidate.request_id IS NOT NULL
		AND NOT EXISTS (
			SELECT 1
			FROM public.mcp_deleted_account_markers AS marker
			WHERE marker.scope_key = pg_catalog.encode(
				pg_catalog.sha256(
					pg_catalog.convert_to('girapphe:mcp-account-lifecycle:v1', 'UTF8')
					|| pg_catalog.decode('00', 'hex')
					|| pg_catalog.convert_to(batch.user_id, 'UTF8')
				),
				'hex'
			)
		)
	ON CONFLICT (user_id, provider, request_id) DO NOTHING;

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
