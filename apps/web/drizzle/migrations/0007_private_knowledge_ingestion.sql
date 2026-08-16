ALTER TABLE "user_knowledge_items"
  ADD COLUMN IF NOT EXISTS "summary" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tags" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "knowledge_ingestion_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_type" text DEFAULT 'conversation' NOT NULL,
  "provider" text NOT NULL,
  "scope" text DEFAULT 'current_conversation' NOT NULL,
  "request_id" text NOT NULL,
  "conversation_ref" text,
  "mcp_token_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "committed_at" timestamp with time zone,
  "discarded_at" timestamp with time zone,
  CONSTRAINT "knowledge_ingestion_batches_user_provider_request_key" UNIQUE("user_id", "provider", "request_id"),
  CONSTRAINT "knowledge_ingestion_batches_source_type_check" CHECK ("source_type" IN ('conversation')),
  CONSTRAINT "knowledge_ingestion_batches_provider_check" CHECK ("provider" IN ('chatgpt', 'claude', 'gemini', 'other')),
  CONSTRAINT "knowledge_ingestion_batches_scope_check" CHECK ("scope" IN ('current_conversation')),
  CONSTRAINT "knowledge_ingestion_batches_status_check" CHECK ("status" IN ('pending', 'partial', 'approved', 'discarded'))
);

CREATE TABLE IF NOT EXISTS "knowledge_card_drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "batch_id" text NOT NULL REFERENCES "knowledge_ingestion_batches"("id") ON DELETE cascade,
  "user_id" text NOT NULL,
  "client_card_id" text NOT NULL,
  "title" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "explanation" text DEFAULT '' NOT NULL,
  "topic" text DEFAULT 'general' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "proposed_relations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "knowledge_item_id" text REFERENCES "user_knowledge_items"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "approved_at" timestamp with time zone,
  CONSTRAINT "knowledge_card_drafts_batch_client_card_key" UNIQUE("batch_id", "client_card_id"),
  CONSTRAINT "knowledge_card_drafts_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "knowledge_card_drafts_version_check" CHECK ("version" >= 1)
);

CREATE TABLE IF NOT EXISTS "user_graph_nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL REFERENCES "user_knowledge_items"("id") ON DELETE cascade,
  "label" text NOT NULL,
  "topic" text DEFAULT 'general' NOT NULL,
  "origin" text DEFAULT 'manual' NOT NULL,
  "source_batch_id" text REFERENCES "knowledge_ingestion_batches"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "deleted_at" timestamp with time zone,
  "purge_at" timestamp with time zone,
  CONSTRAINT "user_graph_nodes_user_knowledge_item_key" UNIQUE("user_id", "knowledge_item_id"),
  CONSTRAINT "user_graph_nodes_origin_check" CHECK ("origin" IN ('manual', 'conversation'))
);

CREATE TABLE IF NOT EXISTS "user_graph_edges" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_private_node_id" text REFERENCES "user_graph_nodes"("id") ON DELETE cascade,
  "source_public_node_id" text REFERENCES "graph_nodes"("id") ON DELETE cascade,
  "target_private_node_id" text REFERENCES "user_graph_nodes"("id") ON DELETE cascade,
  "target_public_node_id" text REFERENCES "graph_nodes"("id") ON DELETE cascade,
  "type" text DEFAULT 'related' NOT NULL,
  "weight" real DEFAULT 1 NOT NULL,
  "origin" text DEFAULT 'manual' NOT NULL,
  "source_batch_id" text REFERENCES "knowledge_ingestion_batches"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now(),
  "deleted_at" timestamp with time zone,
  "purge_at" timestamp with time zone,
  CONSTRAINT "user_graph_edges_source_exactly_one_check" CHECK (num_nonnulls("source_private_node_id", "source_public_node_id") = 1),
  CONSTRAINT "user_graph_edges_target_exactly_one_check" CHECK (num_nonnulls("target_private_node_id", "target_public_node_id") = 1),
  CONSTRAINT "user_graph_edges_no_self_check" CHECK (
    ("source_private_node_id" IS NULL OR "source_private_node_id" IS DISTINCT FROM "target_private_node_id")
    AND ("source_public_node_id" IS NULL OR "source_public_node_id" IS DISTINCT FROM "target_public_node_id")
  ),
  CONSTRAINT "user_graph_edges_type_check" CHECK ("type" IN ('prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to')),
  CONSTRAINT "user_graph_edges_origin_check" CHECK ("origin" IN ('manual', 'conversation')),
  CONSTRAINT "user_graph_edges_weight_check" CHECK ("weight" > 0 AND "weight" <= 1)
);

CREATE TABLE IF NOT EXISTS "knowledge_card_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "knowledge_item_id" text NOT NULL REFERENCES "user_knowledge_items"("id") ON DELETE cascade,
  "batch_id" text REFERENCES "knowledge_ingestion_batches"("id") ON DELETE set null,
  "draft_id" text REFERENCES "knowledge_card_drafts"("id") ON DELETE set null,
  "source_type" text DEFAULT 'conversation' NOT NULL,
  "provider" text NOT NULL,
  "conversation_ref" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "knowledge_card_sources_item_draft_key" UNIQUE("knowledge_item_id", "draft_id")
);

CREATE TABLE IF NOT EXISTS "mcp_access_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "last_four" text NOT NULL,
  "label" text DEFAULT 'MCP client' NOT NULL,
  "scopes" jsonb DEFAULT '["knowledge:drafts:create"]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "mcp_request_rate_limits" (
  "scope_key" text PRIMARY KEY NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mcp_request_rate_limits_count_check" CHECK ("request_count" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_knowledge_ingestion_batches_user_created"
  ON "knowledge_ingestion_batches" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_knowledge_ingestion_batches_token_created"
  ON "knowledge_ingestion_batches" ("mcp_token_id", "created_at" DESC)
  WHERE "mcp_token_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_user_status"
  ON "knowledge_card_drafts" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_user_created"
  ON "knowledge_card_drafts" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_knowledge_card_drafts_batch"
  ON "knowledge_card_drafts" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_user_graph_nodes_user_active"
  ON "user_graph_nodes" ("user_id", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_user_graph_nodes_purge_at"
  ON "user_graph_nodes" ("purge_at") WHERE "purge_at" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_user_graph_edges_user_active"
  ON "user_graph_edges" ("user_id", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_user_graph_edges_source_private"
  ON "user_graph_edges" ("source_private_node_id");
CREATE INDEX IF NOT EXISTS "idx_user_graph_edges_target_private"
  ON "user_graph_edges" ("target_private_node_id");
CREATE INDEX IF NOT EXISTS "idx_user_graph_edges_purge_at"
  ON "user_graph_edges" ("purge_at") WHERE "purge_at" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_graph_edges_unique_active"
  ON "user_graph_edges" (
    "user_id",
    COALESCE("source_private_node_id", 'public:' || "source_public_node_id"),
    COALESCE("target_private_node_id", 'public:' || "target_public_node_id"),
    "type"
  ) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_graph_edges_unique_symmetric_active"
  ON "user_graph_edges" (
    "user_id",
    LEAST(
      COALESCE('private:' || "source_private_node_id", 'public:' || "source_public_node_id"),
      COALESCE('private:' || "target_private_node_id", 'public:' || "target_public_node_id")
    ),
    GREATEST(
      COALESCE('private:' || "source_private_node_id", 'public:' || "source_public_node_id"),
      COALESCE('private:' || "target_private_node_id", 'public:' || "target_public_node_id")
    ),
    "type"
  ) WHERE "deleted_at" IS NULL AND "type" IN ('related', 'equivalent_to');
CREATE INDEX IF NOT EXISTS "idx_knowledge_card_sources_user_item"
  ON "knowledge_card_sources" ("user_id", "knowledge_item_id");
CREATE INDEX IF NOT EXISTS "idx_mcp_access_tokens_user"
  ON "mcp_access_tokens" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_mcp_access_tokens_active_hash"
  ON "mcp_access_tokens" ("token_hash") WHERE "revoked_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_mcp_request_rate_limits_stale_credentials"
  ON "mcp_request_rate_limits" ("updated_at", "scope_key")
  WHERE "scope_key" LIKE 'credential:%';
