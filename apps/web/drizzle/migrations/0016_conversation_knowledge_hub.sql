ALTER TABLE "user_knowledge_items"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "dedupe_key" text,
  ADD COLUMN IF NOT EXISTS "observed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "valid_from" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "valid_to" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "review_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "knowledge_ingestion_batches"
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "discussed_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  ADD COLUMN IF NOT EXISTS "dedupe_key" text,
  ADD COLUMN IF NOT EXISTS "resolution_action" text,
  ADD COLUMN IF NOT EXISTS "target_knowledge_item_id" text REFERENCES "user_knowledge_items"("id") ON DELETE cascade,
  ADD COLUMN IF NOT EXISTS "resolved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "proposed_evidence" jsonb;--> statement-breakpoint

ALTER TABLE "knowledge_card_sources"
  ADD COLUMN IF NOT EXISTS "source_url" text,
  ADD COLUMN IF NOT EXISTS "source_locator" jsonb,
  ADD COLUMN IF NOT EXISTS "discussed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "relation_origin" text,
  ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "user_graph_edges"
  ADD COLUMN IF NOT EXISTS "relation_origin" text,
  ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "knowledge_card_sources"
  ALTER COLUMN "relation_origin" SET DEFAULT 'extracted_from_source';--> statement-breakpoint

ALTER TABLE "user_graph_edges"
  ALTER COLUMN "relation_origin" SET DEFAULT 'explicit_user';--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_knowledge_items_id_user_id"
  ON "user_knowledge_items" ("id", "user_id");--> statement-breakpoint

ALTER TABLE "user_knowledge_items"
  DROP CONSTRAINT IF EXISTS "user_knowledge_items_version_check",
  DROP CONSTRAINT IF EXISTS "user_knowledge_items_dedupe_key_check",
  DROP CONSTRAINT IF EXISTS "user_knowledge_items_valid_range_check",
  DROP CONSTRAINT IF EXISTS "user_knowledge_items_bundle_shape_check";--> statement-breakpoint

ALTER TABLE "user_knowledge_items"
  ADD CONSTRAINT "user_knowledge_items_version_check" CHECK ("version" >= 1) NOT VALID,
  ADD CONSTRAINT "user_knowledge_items_dedupe_key_check"
    CHECK ("dedupe_key" IS NULL OR char_length("dedupe_key") BETWEEN 1 AND 128) NOT VALID,
  ADD CONSTRAINT "user_knowledge_items_valid_range_check"
    CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" >= "valid_from") NOT VALID,
  ADD CONSTRAINT "user_knowledge_items_bundle_shape_check" CHECK (COALESCE(
    ("knowledge_type" IS NULL AND "central_question" IS NULL
      AND "structured_content" IS NULL AND "bundle_schema_version" IS NULL)
    OR (
      "knowledge_type" IN (
        'concept', 'procedure', 'comparison', 'mechanism', 'structure',
        'claim_evidence', 'question', 'decision', 'event'
      )
      AND "central_question" IS NOT NULL AND btrim("central_question") <> ''
      AND jsonb_typeof("structured_content") = 'object'
      AND "structured_content" ->> 'type' = "knowledge_type"
      AND "bundle_schema_version" = 1
    ),
    FALSE
  )) NOT VALID;--> statement-breakpoint

ALTER TABLE "knowledge_ingestion_batches"
  DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_source_url_check",
  DROP CONSTRAINT IF EXISTS "knowledge_ingestion_batches_conversation_ref_check";--> statement-breakpoint

ALTER TABLE "knowledge_ingestion_batches"
  ADD CONSTRAINT "knowledge_ingestion_batches_source_url_check"
    CHECK ("source_url" IS NULL OR (
      char_length("source_url") BETWEEN 1 AND 2048
      AND "source_url" ~ '^https://[^/?#[:space:]]+'
      AND "source_url" !~ '^https://[^/?#]*@'
      AND position('?' in "source_url") = 0
      AND position('#' in "source_url") = 0
    )) NOT VALID,
  ADD CONSTRAINT "knowledge_ingestion_batches_conversation_ref_check"
    CHECK ("conversation_ref" IS NULL OR (
      char_length("conversation_ref") BETWEEN 1 AND 240
      AND "conversation_ref" !~* '^[a-z][a-z0-9+.-]*://'
    )) NOT VALID;--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_target_owner_fk";--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  ADD CONSTRAINT "knowledge_card_drafts_target_owner_fk"
    FOREIGN KEY ("target_knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE CASCADE NOT VALID;--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_dedupe_key_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_resolution_action_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_resolution_target_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_proposed_evidence_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_bundle_shape_check";--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  ADD CONSTRAINT "knowledge_card_drafts_dedupe_key_check"
    CHECK ("dedupe_key" IS NULL OR char_length("dedupe_key") BETWEEN 1 AND 128) NOT VALID,
  ADD CONSTRAINT "knowledge_card_drafts_resolution_action_check"
    CHECK ("resolution_action" IS NULL OR "resolution_action" IN ('create', 'merge', 'update', 'ignore')) NOT VALID,
  ADD CONSTRAINT "knowledge_card_drafts_resolution_target_check" CHECK (
    "resolution_action" IS NULL
    OR (
      "resolved_at" IS NOT NULL
      AND (
        ("resolution_action" IN ('create', 'ignore') AND "target_knowledge_item_id" IS NULL)
        OR ("resolution_action" IN ('merge', 'update') AND "target_knowledge_item_id" IS NOT NULL)
      )
    )
  ) NOT VALID,
  ADD CONSTRAINT "knowledge_card_drafts_proposed_evidence_check" CHECK (
    "proposed_evidence" IS NULL
    OR (
      jsonb_typeof("proposed_evidence") = 'array'
      AND jsonb_array_length("proposed_evidence") <= 32
      AND octet_length("proposed_evidence"::text) <= 32768
      AND "proposed_evidence"::text
        !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
      AND "proposed_evidence"::text
        !~* '"(sourceRef|source_ref)"[[:space:]]*:[[:space:]]*"([^" ]*[?#]|https://[^"/?#]*@)'
    )
  ) NOT VALID,
  ADD CONSTRAINT "knowledge_card_drafts_bundle_shape_check" CHECK (COALESCE(
    ("knowledge_type" IS NULL AND "central_question" IS NULL
      AND "structured_content" IS NULL AND "bundle_schema_version" IS NULL)
    OR (
      "knowledge_type" IN (
        'concept', 'procedure', 'comparison', 'mechanism', 'structure',
        'claim_evidence', 'question', 'decision', 'event'
      )
      AND "central_question" IS NOT NULL AND btrim("central_question") <> ''
      AND jsonb_typeof("structured_content") = 'object'
      AND "structured_content" ->> 'type' = "knowledge_type"
      AND "bundle_schema_version" = 1
    ),
    FALSE
  )) NOT VALID;--> statement-breakpoint

ALTER TABLE "knowledge_card_sources"
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_item_owner_fk",
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_source_url_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_conversation_ref_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_locator_check",
  DROP CONSTRAINT IF EXISTS "knowledge_card_sources_relation_origin_check";--> statement-breakpoint

ALTER TABLE "knowledge_card_sources"
  ADD CONSTRAINT "knowledge_card_sources_item_owner_fk"
    FOREIGN KEY ("knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE cascade NOT VALID,
  ADD CONSTRAINT "knowledge_card_sources_source_url_check"
    CHECK ("source_url" IS NULL OR (
      char_length("source_url") BETWEEN 1 AND 2048
      AND "source_url" ~ '^https://[^/?#[:space:]]+'
      AND "source_url" !~ '^https://[^/?#]*@'
      AND position('?' in "source_url") = 0
      AND position('#' in "source_url") = 0
    )) NOT VALID,
  ADD CONSTRAINT "knowledge_card_sources_conversation_ref_check"
    CHECK ("conversation_ref" IS NULL OR (
      char_length("conversation_ref") BETWEEN 1 AND 240
      AND "conversation_ref" !~* '^[a-z][a-z0-9+.-]*://'
    )) NOT VALID,
  ADD CONSTRAINT "knowledge_card_sources_locator_check"
    CHECK ("source_locator" IS NULL OR jsonb_typeof("source_locator") = 'object') NOT VALID,
  ADD CONSTRAINT "knowledge_card_sources_relation_origin_check"
    CHECK ("relation_origin" IN ('explicit_user', 'extracted_from_source', 'model_inferred')) NOT VALID;--> statement-breakpoint

ALTER TABLE "user_graph_edges"
  DROP CONSTRAINT IF EXISTS "user_graph_edges_type_check",
  DROP CONSTRAINT IF EXISTS "user_graph_edges_relation_origin_check";--> statement-breakpoint

ALTER TABLE "user_graph_edges"
  ADD CONSTRAINT "user_graph_edges_type_check" CHECK (
    "type" IN (
      'prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to',
      'supersedes', 'answers', 'supports', 'contradicts'
    )
  ) NOT VALID,
  ADD CONSTRAINT "user_graph_edges_relation_origin_check"
    CHECK ("relation_origin" IN ('explicit_user', 'extracted_from_source', 'model_inferred')) NOT VALID;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_knowledge_card_sources_id_user_item"
  ON "knowledge_card_sources" ("id", "user_id", "knowledge_item_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_item_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "change_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_item_revisions_item_owner_fk"
    FOREIGN KEY ("knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE cascade,
  CONSTRAINT "knowledge_item_revisions_item_version_key" UNIQUE ("knowledge_item_id", "version"),
  CONSTRAINT "knowledge_item_revisions_version_check" CHECK ("version" >= 1),
  CONSTRAINT "knowledge_item_revisions_snapshot_check" CHECK (jsonb_typeof("snapshot") = 'object')
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mcp_deleted_account_markers" (
  "scope_key" text PRIMARY KEY NOT NULL,
  "deleted_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "mcp_deleted_account_markers_scope_key_check"
    CHECK ("scope_key" ~ '^[0-9a-f]{64}$')
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_item_activity" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL,
  "activity_type" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_item_activity_item_owner_fk"
    FOREIGN KEY ("knowledge_item_id", "user_id")
    REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE cascade,
  CONSTRAINT "knowledge_item_activity_type_check" CHECK (
    "activity_type" IN (
      'confirmed', 'connected', 'verified', 'reused',
      'revised', 'superseded', 'archived', 'restored'
    )
  ),
  CONSTRAINT "knowledge_item_activity_metadata_check" CHECK (jsonb_typeof("metadata") = 'object')
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_item_supersessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "superseded_item_id" text NOT NULL,
  "replacement_item_id" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_item_supersessions_old_owner_fk"
    FOREIGN KEY ("superseded_item_id", "user_id")
    REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE cascade,
  CONSTRAINT "knowledge_item_supersessions_new_owner_fk"
    FOREIGN KEY ("replacement_item_id", "user_id")
    REFERENCES "user_knowledge_items"("id", "user_id") ON DELETE cascade,
  CONSTRAINT "knowledge_item_supersessions_old_key"
    UNIQUE ("user_id", "superseded_item_id"),
  CONSTRAINT "knowledge_item_supersessions_distinct_check"
    CHECK ("superseded_item_id" <> "replacement_item_id")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_evidence_spans" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL,
  "source_id" text NOT NULL,
  "selector_type" text NOT NULL,
  "selector" jsonb NOT NULL,
  "polarity" text NOT NULL DEFAULT 'supports',
  "quality" text NOT NULL DEFAULT 'unknown',
  "relation_origin" text NOT NULL DEFAULT 'extracted_from_source',
  "confirmed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_evidence_spans_source_owner_item_fk"
    FOREIGN KEY ("source_id", "user_id", "knowledge_item_id")
    REFERENCES "knowledge_card_sources"("id", "user_id", "knowledge_item_id") ON DELETE cascade,
  CONSTRAINT "knowledge_evidence_spans_selector_type_check"
    CHECK ("selector_type" IN ('message', 'text_position', 'line_range', 'external_ref')),
  CONSTRAINT "knowledge_evidence_spans_selector_check" CHECK (
    jsonb_typeof("selector") = 'object'
    AND octet_length("selector"::text) <= 4096
    AND "selector"::text
      !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
    AND (
      "selector_type" <> 'external_ref'
      OR (
        "selector" ? 'source_ref'
        AND jsonb_typeof("selector" -> 'source_ref') = 'string'
        AND char_length("selector" ->> 'source_ref') BETWEEN 1 AND 2048
        AND position('?' in ("selector" ->> 'source_ref')) = 0
        AND position('#' in ("selector" ->> 'source_ref')) = 0
        AND (
          ("selector" ->> 'source_ref') !~* '^[a-z][a-z0-9+.-]*://'
          OR (
            ("selector" ->> 'source_ref') ~ '^https://[^/?#[:space:]]+'
            AND ("selector" ->> 'source_ref') !~ '^https://[^/?#]*@'
          )
        )
      )
    )
  ),
  CONSTRAINT "knowledge_evidence_spans_polarity_check"
    CHECK ("polarity" IN ('supports', 'contradicts')),
  CONSTRAINT "knowledge_evidence_spans_quality_check"
    CHECK ("quality" IN ('unknown', 'low', 'medium', 'high')),
  CONSTRAINT "knowledge_evidence_spans_relation_origin_check"
    CHECK ("relation_origin" IN ('explicit_user', 'extracted_from_source', 'model_inferred'))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_user_dedupe"
  ON "user_knowledge_items" ("user_id", "dedupe_key")
  WHERE "deleted_at" IS NULL AND "dedupe_key" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_user_review"
  ON "user_knowledge_items" ("user_id", "review_at")
  WHERE "deleted_at" IS NULL AND "archived_at" IS NULL AND "review_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_items_user_observed"
  ON "user_knowledge_items" ("user_id", "observed_at")
  WHERE "deleted_at" IS NULL AND "observed_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_user_dedupe"
  ON "knowledge_card_drafts" ("user_id", "dedupe_key")
  WHERE "status" = 'pending' AND "dedupe_key" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_target_item"
  ON "knowledge_card_drafts" ("user_id", "target_knowledge_item_id")
  WHERE "target_knowledge_item_id" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_card_sources_user_discussed"
  ON "knowledge_card_sources" ("user_id", "discussed_at")
  WHERE "discussed_at" IS NOT NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_revisions_user_item"
  ON "knowledge_item_revisions" ("user_id", "knowledge_item_id", "version");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_activity_user_item_created"
  ON "knowledge_item_activity" ("user_id", "knowledge_item_id", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_activity_user_type_created"
  ON "knowledge_item_activity" ("user_id", "activity_type", "created_at");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_supersessions_user_old"
  ON "knowledge_item_supersessions" ("user_id", "superseded_item_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_supersessions_user_new"
  ON "knowledge_item_supersessions" ("user_id", "replacement_item_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_evidence_spans_user_item"
  ON "knowledge_evidence_spans" ("user_id", "knowledge_item_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_evidence_spans_user_source"
  ON "knowledge_evidence_spans" ("user_id", "source_id");
