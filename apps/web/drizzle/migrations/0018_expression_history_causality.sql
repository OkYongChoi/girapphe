ALTER TABLE "user_knowledge_items"
  DROP CONSTRAINT IF EXISTS "user_knowledge_items_bundle_shape_check";--> statement-breakpoint

ALTER TABLE "user_knowledge_items"
  ADD CONSTRAINT "user_knowledge_items_bundle_shape_check" CHECK (COALESCE(
    ("knowledge_type" IS NULL AND "central_question" IS NULL AND "structured_content" IS NULL AND "bundle_schema_version" IS NULL)
    OR (
      "knowledge_type" IN (
        'concept', 'procedure', 'comparison', 'mechanism', 'structure', 'claim_evidence',
        'question', 'decision', 'event', 'expression'
      )
      AND "central_question" IS NOT NULL AND btrim("central_question") <> ''
      AND jsonb_typeof("structured_content") = 'object'
      AND "structured_content" ->> 'type' = "knowledge_type"
      AND "bundle_schema_version" = 1
    ),
    FALSE
  )) NOT VALID;--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  DROP CONSTRAINT IF EXISTS "knowledge_card_drafts_bundle_shape_check";--> statement-breakpoint

ALTER TABLE "knowledge_card_drafts"
  ADD CONSTRAINT "knowledge_card_drafts_bundle_shape_check" CHECK (COALESCE(
    ("knowledge_type" IS NULL AND "central_question" IS NULL AND "structured_content" IS NULL AND "bundle_schema_version" IS NULL)
    OR (
      "knowledge_type" IN (
        'concept', 'procedure', 'comparison', 'mechanism', 'structure', 'claim_evidence',
        'question', 'decision', 'event', 'expression'
      )
      AND "central_question" IS NOT NULL AND btrim("central_question") <> ''
      AND jsonb_typeof("structured_content") = 'object'
      AND "structured_content" ->> 'type' = "knowledge_type"
      AND "bundle_schema_version" = 1
    ),
    FALSE
  )) NOT VALID;--> statement-breakpoint

ALTER TABLE "user_graph_edges"
  DROP CONSTRAINT IF EXISTS "user_graph_edges_type_check";--> statement-breakpoint

ALTER TABLE "user_graph_edges"
  ADD CONSTRAINT "user_graph_edges_type_check" CHECK (
    "type" IN (
      'prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to',
      'supersedes', 'answers', 'supports', 'contradicts',
      'causes', 'contributes_to', 'enables', 'inhibits'
    )
  ) NOT VALID;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_graph_edges_id_user"
  ON "user_graph_edges" ("id", "user_id");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "idx_knowledge_evidence_spans_id_user"
  ON "knowledge_evidence_spans" ("id", "user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_relation_evidence" (
  "edge_id" text NOT NULL,
  "evidence_span_id" text NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "knowledge_relation_evidence_pk" PRIMARY KEY ("edge_id", "evidence_span_id"),
  CONSTRAINT "knowledge_relation_evidence_edge_owner_fk"
    FOREIGN KEY ("edge_id", "user_id")
    REFERENCES "user_graph_edges"("id", "user_id") ON DELETE cascade,
  CONSTRAINT "knowledge_relation_evidence_span_owner_fk"
    FOREIGN KEY ("evidence_span_id", "user_id")
    REFERENCES "knowledge_evidence_spans"("id", "user_id") ON DELETE cascade
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_relation_evidence_user_edge"
  ON "knowledge_relation_evidence" ("user_id", "edge_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_knowledge_relation_evidence_user_span"
  ON "knowledge_relation_evidence" ("user_id", "evidence_span_id");
