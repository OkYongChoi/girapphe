-- Migration 0012: translation cache ids are validated against the checked-in static allowlist.
-- They intentionally do not reference the smaller operational graph/card tables.
CREATE TABLE IF NOT EXISTS "knowledge_card_translations" (
	"card_id" text NOT NULL,
	"locale" text NOT NULL,
	"title" text,
	"summary" text,
	"explanation" text,
	"source_hash" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_card_translations_card_id_locale_pk" PRIMARY KEY("card_id","locale"),
	CONSTRAINT "knowledge_card_translations_locale_check" CHECK ("locale" IN ('ja', 'zh-CN', 'es', 'ar', 'hi')),
	CONSTRAINT "knowledge_card_translations_status_check" CHECK ("status" IN ('machine', 'reviewed', 'human', 'failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "graph_node_translations" (
	"node_id" text NOT NULL,
	"locale" text NOT NULL,
	"label" text,
	"domain_label" text,
	"type_label" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_hash" text NOT NULL,
	"status" text NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graph_node_translations_node_id_locale_pk" PRIMARY KEY("node_id","locale"),
	CONSTRAINT "graph_node_translations_locale_check" CHECK ("locale" IN ('ja', 'zh-CN', 'es', 'ar', 'hi')),
	CONSTRAINT "graph_node_translations_status_check" CHECK ("status" IN ('machine', 'reviewed', 'human', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "graph_node_translations"
  ADD COLUMN IF NOT EXISTS "domain_label" text,
  ADD COLUMN IF NOT EXISTS "type_label" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_card_translations_locale_status" ON "knowledge_card_translations" USING btree ("locale","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_graph_node_translations_locale_status" ON "graph_node_translations" USING btree ("locale","status");
