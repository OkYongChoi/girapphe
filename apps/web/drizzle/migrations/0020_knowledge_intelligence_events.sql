CREATE TABLE IF NOT EXISTS "knowledge_product_events" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "event_name" text NOT NULL,
  "event_version" integer NOT NULL DEFAULT 1,
  "subject_id" text NOT NULL,
  "signal_type" text,
  "outcome" text,
  "selection_count" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_product_events_name_check" CHECK (
    "event_name" IN (
      'conversation_import_started', 'conversation_import_parsed',
      'conversation_import_confirmed', 'conversation_import_candidates_ready',
      'conversation_import_first_value_viewed', 'knowledge_candidate_resolved',
      'knowledge_signal_viewed', 'knowledge_signal_evidence_opened',
      'knowledge_signal_dismissed', 'knowledge_context_created'
    )
  ),
  CONSTRAINT "knowledge_product_events_version_check" CHECK ("event_version" = 1),
  CONSTRAINT "knowledge_product_events_subject_check" CHECK ("subject_id" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "knowledge_product_events_signal_type_check" CHECK (
    "signal_type" IS NULL OR "signal_type" IN (
      'thought_change', 'contradiction', 'connection', 'rediscovery', 'topic_emergence'
    )
  ),
  CONSTRAINT "knowledge_product_events_outcome_check" CHECK (
    "outcome" IS NULL OR "outcome" IN (
      'approved', 'merged', 'updated', 'ignored', 'cancelled',
      'unhelpful', 'incorrect', 'scope_changed'
    )
  ),
  CONSTRAINT "knowledge_product_events_selection_count_check" CHECK (
    "selection_count" IS NULL OR "selection_count" BETWEEN 0 AND 100000
  ),
  CONSTRAINT "knowledge_product_events_shape_check" CHECK (
    (("event_name" IN ('knowledge_signal_viewed', 'knowledge_signal_evidence_opened', 'knowledge_signal_dismissed')) = ("signal_type" IS NOT NULL))
    AND (("event_name" = 'knowledge_signal_dismissed') = COALESCE("outcome" IN ('unhelpful', 'incorrect', 'scope_changed'), false))
    AND (("event_name" = 'knowledge_candidate_resolved') = COALESCE("outcome" IN ('approved', 'merged', 'updated', 'ignored', 'cancelled'), false))
  )
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_product_events_user_created"
  ON "knowledge_product_events" ("user_id", "created_at" DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_product_events_user_dismissed"
  ON "knowledge_product_events" ("user_id", "subject_id")
  WHERE "event_name" = 'knowledge_signal_dismissed';
