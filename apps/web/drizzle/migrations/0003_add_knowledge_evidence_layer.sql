-- Additive migration for richer self-report vs verified knowledge modeling.
-- This keeps the current known/saved flow working while preparing the schema
-- for a simpler user-facing 3-state UX and a stronger anti-overconfidence model.

ALTER TABLE "user_card_states"
  ADD COLUMN IF NOT EXISTS "self_report_label" text
  CHECK ("self_report_label" IN ('unknown', 'partial', 'explainable'));

ALTER TABLE "user_card_states"
  ADD COLUMN IF NOT EXISTS "is_bookmarked" boolean NOT NULL DEFAULT false;

UPDATE "user_card_states"
SET "self_report_label" = CASE
  WHEN "status" = 'known' THEN 'explainable'
  WHEN "status" = 'saved' THEN 'partial'
  ELSE 'unknown'
END
WHERE "self_report_label" IS NULL;

UPDATE "user_card_states"
SET "is_bookmarked" = true
WHERE "status" = 'saved' OR "progress_state" = 'learning';

CREATE INDEX IF NOT EXISTS "idx_user_card_states_self_report_label"
ON "user_card_states" ("self_report_label");

CREATE INDEX IF NOT EXISTS "idx_user_card_states_is_bookmarked"
ON "user_card_states" ("is_bookmarked");

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "self_report_level" real NOT NULL DEFAULT 0;

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "verified_level" real NOT NULL DEFAULT 0;

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "source_type" text NOT NULL DEFAULT 'system'
  CHECK ("source_type" IN ('self_report', 'quiz', 'conversation', 'ai_inferred', 'system', 'migration'));

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "evidence_count" integer NOT NULL DEFAULT 0
  CHECK ("evidence_count" >= 0);

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "stability_score" real NOT NULL DEFAULT 0
  CHECK ("stability_score" >= 0 AND "stability_score" <= 1);

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "retrieval_strength" real NOT NULL DEFAULT 0
  CHECK ("retrieval_strength" >= 0 AND "retrieval_strength" <= 1);

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "explanation_strength" real NOT NULL DEFAULT 0
  CHECK ("explanation_strength" >= 0 AND "explanation_strength" <= 1);

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "last_self_reported_at" timestamp with time zone;

ALTER TABLE "user_knowledge_states"
  ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone;

UPDATE "user_knowledge_states"
SET
  "self_report_level" = "knowledge_state",
  "verified_level" = 0,
  "source_type" = 'migration',
  "evidence_count" = CASE WHEN "knowledge_state" > 0 THEN 1 ELSE 0 END,
  "last_self_reported_at" = COALESCE("last_self_reported_at", "last_updated")
WHERE
  "self_report_level" = 0
  AND "verified_level" = 0
  AND "source_type" = 'system'
  AND "evidence_count" = 0;

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_states_source_type"
ON "user_knowledge_states" ("source_type");

CREATE TABLE IF NOT EXISTS "user_knowledge_evidence" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL,
  "node_id" text NOT NULL REFERENCES "graph_nodes"("id") ON DELETE cascade,
  "card_id" text REFERENCES "knowledge_cards"("id") ON DELETE set null,
  "source_type" text NOT NULL CHECK ("source_type" IN ('self_report', 'quiz', 'conversation', 'ai_inferred', 'system', 'migration')),
  "event_type" text NOT NULL CHECK ("event_type" IN ('rated_card', 'self_report', 'quiz_pass', 'quiz_fail', 'review', 'bookmark', 'conversation', 'ai_inferred', 'migration')),
  "score" real,
  "confidence" real CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_evidence_user"
ON "user_knowledge_evidence" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_evidence_node"
ON "user_knowledge_evidence" ("node_id");

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_evidence_source_type"
ON "user_knowledge_evidence" ("source_type");

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_evidence_event_type"
ON "user_knowledge_evidence" ("event_type");

CREATE INDEX IF NOT EXISTS "idx_user_knowledge_evidence_created_at"
ON "user_knowledge_evidence" ("created_at");
