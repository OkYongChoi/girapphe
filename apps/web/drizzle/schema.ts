import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { KnowledgeBundleContent, KnowledgeBundleType } from "@stem-brain/shared";

export const knowledgeCards = pgTable("knowledge_cards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  explanation: text("explanation"),
  wikiUrl: text("wiki_url"),
  domain: text("domain"),
  level: text("level"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_knowledge_cards_domain").on(t.domain),
  index("idx_knowledge_cards_updated_at").on(t.updatedAt),
]);

// Translation ids are constrained by the server-side static allowlist and source hash.
// They are not foreign-keyed to the intentionally smaller operational graph/card datasets.
export const knowledgeCardTranslations = pgTable("knowledge_card_translations", {
  cardId: text("card_id").notNull(),
  locale: text("locale").notNull(),
  title: text("title"),
  summary: text("summary"),
  explanation: text("explanation"),
  sourceHash: text("source_hash").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.cardId, t.locale] }),
  check("knowledge_card_translations_locale_check", sql`${t.locale} IN ('ja', 'zh-CN', 'es', 'ar', 'hi')`),
  check("knowledge_card_translations_status_check", sql`${t.status} IN ('machine', 'reviewed', 'human', 'failed')`),
  index("idx_knowledge_card_translations_locale_status").on(t.locale, t.status),
]);

export const userCardStates = pgTable("user_card_states", {
  userId: text("user_id").notNull(),
  cardId: text("card_id").notNull().references(() => knowledgeCards.id, { onDelete: "cascade" }),
  status: text("status"),
  selfReportLabel: text("self_report_label"),
  isBookmarked: boolean("is_bookmarked").notNull().default(false),
  confidence: integer("confidence").default(0),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.cardId] }),
  index("idx_user_card_states_user_id").on(t.userId),
  index("idx_user_card_states_status").on(t.status),
  index("idx_user_card_states_self_report_label").on(t.selfReportLabel),
  index("idx_user_card_states_is_bookmarked").on(t.isBookmarked),
]);

export const graphNodes = pgTable("graph_nodes", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  domain: text("domain").notNull(),
  level: integer("level").notNull().default(0),
  difficulty: integer("difficulty").notNull().default(1),
  type: text("type").notNull().default("concept"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_graph_nodes_domain").on(t.domain),
  index("idx_graph_nodes_level").on(t.level),
]);

export const graphNodeTranslations = pgTable("graph_node_translations", {
  nodeId: text("node_id").notNull(),
  locale: text("locale").notNull(),
  label: text("label"),
  domainLabel: text("domain_label"),
  typeLabel: text("type_label"),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  sourceHash: text("source_hash").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.nodeId, t.locale] }),
  check("graph_node_translations_locale_check", sql`${t.locale} IN ('ja', 'zh-CN', 'es', 'ar', 'hi')`),
  check("graph_node_translations_status_check", sql`${t.status} IN ('machine', 'reviewed', 'human', 'failed')`),
  index("idx_graph_node_translations_locale_status").on(t.locale, t.status),
]);

export const graphEdges = pgTable("graph_edges", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
  target: text("target").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  weight: real("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  unique("graph_edges_source_target_type_key").on(t.source, t.target, t.type),
  index("idx_graph_edges_source").on(t.source),
  index("idx_graph_edges_target").on(t.target),
  index("idx_graph_edges_type").on(t.type),
]);

export const userKnowledgeStates = pgTable("user_knowledge_states", {
  userId: text("user_id").notNull(),
  nodeId: text("node_id").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
  knowledgeState: real("knowledge_state").notNull().default(0),
  selfReportLevel: real("self_report_level").notNull().default(0),
  verifiedLevel: real("verified_level").notNull().default(0),
  sourceType: text("source_type").notNull().default("system"),
  confidence: real("confidence").notNull().default(0),
  evidenceCount: integer("evidence_count").notNull().default(0),
  stabilityScore: real("stability_score").notNull().default(0),
  retrievalStrength: real("retrieval_strength").notNull().default(0),
  explanationStrength: real("explanation_strength").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  lastSelfReportedAt: timestamp("last_self_reported_at", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  firstKnownAt: timestamp("first_known_at", { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.nodeId] }),
  index("idx_user_knowledge_states_user").on(t.userId),
  index("idx_user_knowledge_states_node").on(t.nodeId),
  index("idx_user_knowledge_states_source_type").on(t.sourceType),
]);

export const userQuizRateLimits = pgTable("user_quiz_rate_limits", {
  userId: text("user_id").primaryKey(),
  nextAllowedAt: timestamp("next_allowed_at", { withTimezone: true }).notNull(),
});

export const userKnowledgeEvidence = pgTable("user_knowledge_evidence", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  nodeId: text("node_id").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
  cardId: text("card_id").references(() => knowledgeCards.id, { onDelete: "set null" }),
  sourceType: text("source_type").notNull(),
  eventType: text("event_type").notNull(),
  score: real("score"),
  confidence: real("confidence"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_user_knowledge_evidence_user").on(t.userId),
  index("idx_user_knowledge_evidence_node").on(t.nodeId),
  index("idx_user_knowledge_evidence_source_type").on(t.sourceType),
  index("idx_user_knowledge_evidence_event_type").on(t.eventType),
  index("idx_user_knowledge_evidence_created_at").on(t.createdAt),
]);

export const userKnowledgeItems = pgTable("user_knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  content: text("content").notNull().default(""),
  topic: text("topic").notNull().default("general"),
  tags: jsonb("tags").notNull().default([]),
  knowledgeType: text("knowledge_type").$type<KnowledgeBundleType>(),
  centralQuestion: text("central_question"),
  structuredContent: jsonb("structured_content").$type<KnowledgeBundleContent>(),
  bundleSchemaVersion: integer("bundle_schema_version"),
  version: integer("version").notNull().default(1),
  dedupeKey: text("dedupe_key"),
  observedAt: timestamp("observed_at", { withTimezone: true }),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validTo: timestamp("valid_to", { withTimezone: true }),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  reviewAt: timestamp("review_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("idx_user_knowledge_items_id_user_id").on(t.id, t.userId),
  index("idx_user_knowledge_items_user").on(t.userId),
  index("idx_user_knowledge_items_active_created").on(t.userId, t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  index("idx_user_knowledge_items_purge_at").on(t.purgeAt).where(sql`${t.purgeAt} IS NOT NULL`),
  index("idx_user_knowledge_items_user_dedupe").on(t.userId, t.dedupeKey)
    .where(sql`${t.deletedAt} IS NULL AND ${t.dedupeKey} IS NOT NULL`),
  index("idx_user_knowledge_items_user_review").on(t.userId, t.reviewAt)
    .where(sql`${t.deletedAt} IS NULL AND ${t.archivedAt} IS NULL AND ${t.reviewAt} IS NOT NULL`),
  index("idx_user_knowledge_items_user_observed").on(t.userId, t.observedAt)
    .where(sql`${t.deletedAt} IS NULL AND ${t.observedAt} IS NOT NULL`),
  check("user_knowledge_items_version_check", sql`${t.version} >= 1`),
  check("user_knowledge_items_dedupe_key_check", sql`${t.dedupeKey} IS NULL OR char_length(${t.dedupeKey}) BETWEEN 1 AND 128`),
  check("user_knowledge_items_valid_range_check", sql`${t.validFrom} IS NULL OR ${t.validTo} IS NULL OR ${t.validTo} >= ${t.validFrom}`),
  check("user_knowledge_items_bundle_shape_check", sql`COALESCE(
    (${t.knowledgeType} IS NULL AND ${t.centralQuestion} IS NULL AND ${t.structuredContent} IS NULL AND ${t.bundleSchemaVersion} IS NULL)
    OR (
      ${t.knowledgeType} IN ('concept', 'procedure', 'comparison', 'mechanism', 'structure', 'claim_evidence', 'question', 'decision', 'event')
      AND ${t.centralQuestion} IS NOT NULL AND btrim(${t.centralQuestion}) <> ''
      AND jsonb_typeof(${t.structuredContent}) = 'object'
      AND ${t.structuredContent} ->> 'type' = ${t.knowledgeType}
      AND ${t.bundleSchemaVersion} = 1
    ),
    FALSE
  )`),
]);

export const guestKnowledgeWriteLimits = pgTable("guest_knowledge_write_limits", {
  scopeKey: text("scope_key").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_guest_knowledge_write_limits_updated").on(t.updatedAt),
]);

export const userKnowledgeCreateRequests = pgTable("user_knowledge_create_requests", {
  userId: text("user_id").notNull(),
  requestId: text("request_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.requestId] }),
  index("idx_user_knowledge_create_requests_created").on(t.createdAt),
]);

export const userPrivateCardStates = pgTable("user_private_card_states", {
  userId: text("user_id").notNull(),
  knowledgeItemId: text("knowledge_item_id").notNull(),
  status: text("status").notNull(),
  knowledgeState: text("knowledge_state").notNull(),
  progressState: text("progress_state").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.knowledgeItemId] }),
  foreignKey({
    columns: [t.knowledgeItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "user_private_card_states_item_owner_fk",
  }).onDelete("cascade"),
  index("idx_user_private_card_states_user_status").on(t.userId, t.status),
  index("idx_user_private_card_states_user_due").on(t.userId, t.dueAt),
  check("user_private_card_states_status_check", sql`${t.status} IN ('known', 'saved')`),
  check("user_private_card_states_knowledge_state_check", sql`${t.knowledgeState} IN ('unknown', 'known')`),
  check("user_private_card_states_progress_state_check", sql`${t.progressState} IN ('learning', 'review')`),
  check("user_private_card_states_consistency_check", sql`(${t.status} = 'known' AND ${t.knowledgeState} = 'known' AND ${t.progressState} = 'review') OR (${t.status} = 'saved' AND ${t.knowledgeState} = 'unknown' AND ${t.progressState} = 'learning')`),
]);

export const knowledgeIngestionBatches = pgTable("knowledge_ingestion_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceType: text("source_type").notNull().default("conversation"),
  provider: text("provider").notNull(),
  scope: text("scope").notNull().default("current_conversation"),
  requestId: text("request_id").notNull(),
  conversationRef: text("conversation_ref"),
  sourceUrl: text("source_url"),
  discussedAt: timestamp("discussed_at", { withTimezone: true }),
  mcpTokenId: text("mcp_token_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  discardedAt: timestamp("discarded_at", { withTimezone: true }),
}, (t) => [
  unique("knowledge_ingestion_batches_user_provider_request_key").on(t.userId, t.provider, t.requestId),
  index("idx_knowledge_ingestion_batches_user_created").on(t.userId, t.createdAt),
  index("idx_knowledge_ingestion_batches_token_created").on(t.mcpTokenId, t.createdAt).where(sql`${t.mcpTokenId} IS NOT NULL`),
  check("knowledge_ingestion_batches_source_type_check", sql`${t.sourceType} IN ('conversation')`),
  check("knowledge_ingestion_batches_provider_check", sql`${t.provider} IN ('chatgpt', 'claude', 'gemini', 'other')`),
  check("knowledge_ingestion_batches_scope_check", sql`${t.scope} IN ('current_conversation')`),
  check("knowledge_ingestion_batches_status_check", sql`${t.status} IN ('pending', 'partial', 'approved', 'discarded')`),
  check("knowledge_ingestion_batches_source_url_check", sql`${t.sourceUrl} IS NULL OR (
    char_length(${t.sourceUrl}) BETWEEN 1 AND 2048
    AND ${t.sourceUrl} ~ '^https://[^/?#[:space:]]+'
    AND ${t.sourceUrl} !~ '^https://[^/?#]*@'
    AND position('?' in ${t.sourceUrl}) = 0
    AND position('#' in ${t.sourceUrl}) = 0
  )`),
  check("knowledge_ingestion_batches_conversation_ref_check", sql`${t.conversationRef} IS NULL OR (
    char_length(${t.conversationRef}) BETWEEN 1 AND 240
    AND ${t.conversationRef} !~* '^[a-z][a-z0-9+.-]*://'
  )`),
]);

export const knowledgeCardDrafts = pgTable("knowledge_card_drafts", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => knowledgeIngestionBatches.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  clientCardId: text("client_card_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  explanation: text("explanation").notNull().default(""),
  topic: text("topic").notNull().default("general"),
  tags: jsonb("tags").notNull().default([]),
  proposedRelations: jsonb("proposed_relations").notNull().default([]),
  knowledgeType: text("knowledge_type").$type<KnowledgeBundleType>(),
  centralQuestion: text("central_question"),
  structuredContent: jsonb("structured_content").$type<KnowledgeBundleContent>(),
  bundleSchemaVersion: integer("bundle_schema_version"),
  dedupeKey: text("dedupe_key"),
  resolutionAction: text("resolution_action"),
  targetKnowledgeItemId: text("target_knowledge_item_id").references(() => userKnowledgeItems.id, { onDelete: "cascade" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  proposedEvidence: jsonb("proposed_evidence").$type<Array<{
    selector_type: string;
    selector: Record<string, unknown>;
    polarity?: "supports" | "contradicts";
    quality?: "unknown" | "low" | "medium" | "high";
  }>>(),
  status: text("status").notNull().default("pending"),
  version: integer("version").notNull().default(1),
  knowledgeItemId: text("knowledge_item_id").references(() => userKnowledgeItems.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
}, (t) => [
  unique("knowledge_card_drafts_batch_client_card_key").on(t.batchId, t.clientCardId),
  index("idx_knowledge_card_drafts_user_status").on(t.userId, t.status),
  index("idx_knowledge_card_drafts_user_created").on(t.userId, t.createdAt),
  index("idx_knowledge_card_drafts_batch").on(t.batchId),
  index("idx_knowledge_card_drafts_user_dedupe").on(t.userId, t.dedupeKey)
    .where(sql`${t.status} = 'pending' AND ${t.dedupeKey} IS NOT NULL`),
  index("idx_knowledge_card_drafts_target_item").on(t.userId, t.targetKnowledgeItemId)
    .where(sql`${t.targetKnowledgeItemId} IS NOT NULL`),
  foreignKey({
    columns: [t.targetKnowledgeItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "knowledge_card_drafts_target_owner_fk",
  }).onDelete("cascade"),
  check("knowledge_card_drafts_status_check", sql`${t.status} IN ('pending', 'approved', 'rejected')`),
  check("knowledge_card_drafts_version_check", sql`${t.version} >= 1`),
  check("knowledge_card_drafts_dedupe_key_check", sql`${t.dedupeKey} IS NULL OR char_length(${t.dedupeKey}) BETWEEN 1 AND 128`),
  check("knowledge_card_drafts_resolution_action_check", sql`${t.resolutionAction} IS NULL OR ${t.resolutionAction} IN ('create', 'merge', 'update', 'ignore')`),
  check("knowledge_card_drafts_resolution_target_check", sql`
    ${t.resolutionAction} IS NULL
    OR (
      ${t.resolvedAt} IS NOT NULL
      AND (
        (${t.resolutionAction} IN ('create', 'ignore') AND ${t.targetKnowledgeItemId} IS NULL)
        OR (${t.resolutionAction} IN ('merge', 'update') AND ${t.targetKnowledgeItemId} IS NOT NULL)
      )
    )
  `),
  check("knowledge_card_drafts_proposed_evidence_check", sql`
    ${t.proposedEvidence} IS NULL
    OR (
      jsonb_typeof(${t.proposedEvidence}) = 'array'
      AND jsonb_array_length(${t.proposedEvidence}) <= 32
      AND octet_length(${t.proposedEvidence}::text) <= 32768
      AND ${t.proposedEvidence}::text
        !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
      AND ${t.proposedEvidence}::text
        !~* '"(sourceRef|source_ref)"[[:space:]]*:[[:space:]]*"([^" ]*[?#]|https://[^"/?#]*@)'
    )
  `),
  check("knowledge_card_drafts_bundle_shape_check", sql`COALESCE(
    (${t.knowledgeType} IS NULL AND ${t.centralQuestion} IS NULL AND ${t.structuredContent} IS NULL AND ${t.bundleSchemaVersion} IS NULL)
    OR (
      ${t.knowledgeType} IN ('concept', 'procedure', 'comparison', 'mechanism', 'structure', 'claim_evidence', 'question', 'decision', 'event')
      AND ${t.centralQuestion} IS NOT NULL AND btrim(${t.centralQuestion}) <> ''
      AND jsonb_typeof(${t.structuredContent}) = 'object'
      AND ${t.structuredContent} ->> 'type' = ${t.knowledgeType}
      AND ${t.bundleSchemaVersion} = 1
    ),
    FALSE
  )`),
]);

export const userGraphNodes = pgTable("user_graph_nodes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  knowledgeItemId: text("knowledge_item_id").notNull().references(() => userKnowledgeItems.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  topic: text("topic").notNull().default("general"),
  origin: text("origin").notNull().default("manual"),
  sourceBatchId: text("source_batch_id").references(() => knowledgeIngestionBatches.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
}, (t) => [
  unique("user_graph_nodes_user_knowledge_item_key").on(t.userId, t.knowledgeItemId),
  index("idx_user_graph_nodes_user_active").on(t.userId, t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  index("idx_user_graph_nodes_purge_at").on(t.purgeAt).where(sql`${t.purgeAt} IS NOT NULL`),
  check("user_graph_nodes_origin_check", sql`${t.origin} IN ('manual', 'conversation')`),
]);

export const userGraphEdges = pgTable("user_graph_edges", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourcePrivateNodeId: text("source_private_node_id").references(() => userGraphNodes.id, { onDelete: "cascade" }),
  sourcePublicNodeId: text("source_public_node_id").references(() => graphNodes.id, { onDelete: "cascade" }),
  targetPrivateNodeId: text("target_private_node_id").references(() => userGraphNodes.id, { onDelete: "cascade" }),
  targetPublicNodeId: text("target_public_node_id").references(() => graphNodes.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("related"),
  weight: real("weight").notNull().default(1),
  origin: text("origin").notNull().default("manual"),
  relationOrigin: text("relation_origin").default("explicit_user"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  sourceBatchId: text("source_batch_id").references(() => knowledgeIngestionBatches.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
}, (t) => [
  index("idx_user_graph_edges_user_active").on(t.userId, t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  index("idx_user_graph_edges_source_private").on(t.sourcePrivateNodeId),
  index("idx_user_graph_edges_target_private").on(t.targetPrivateNodeId),
  index("idx_user_graph_edges_purge_at").on(t.purgeAt).where(sql`${t.purgeAt} IS NOT NULL`),
  uniqueIndex("idx_user_graph_edges_unique_active").on(
    t.userId,
    sql`COALESCE(${t.sourcePrivateNodeId}, 'public:' || ${t.sourcePublicNodeId})`,
    sql`COALESCE(${t.targetPrivateNodeId}, 'public:' || ${t.targetPublicNodeId})`,
    t.type,
  ).where(sql`${t.deletedAt} IS NULL`),
  uniqueIndex("idx_user_graph_edges_unique_symmetric_active").on(
    t.userId,
    sql`LEAST(COALESCE('private:' || ${t.sourcePrivateNodeId}, 'public:' || ${t.sourcePublicNodeId}), COALESCE('private:' || ${t.targetPrivateNodeId}, 'public:' || ${t.targetPublicNodeId}))`,
    sql`GREATEST(COALESCE('private:' || ${t.sourcePrivateNodeId}, 'public:' || ${t.sourcePublicNodeId}), COALESCE('private:' || ${t.targetPrivateNodeId}, 'public:' || ${t.targetPublicNodeId}))`,
    t.type,
  ).where(sql`${t.deletedAt} IS NULL AND ${t.type} IN ('related', 'equivalent_to')`),
  check("user_graph_edges_source_exactly_one_check", sql`num_nonnulls(${t.sourcePrivateNodeId}, ${t.sourcePublicNodeId}) = 1`),
  check("user_graph_edges_target_exactly_one_check", sql`num_nonnulls(${t.targetPrivateNodeId}, ${t.targetPublicNodeId}) = 1`),
  check("user_graph_edges_no_self_check", sql`(${t.sourcePrivateNodeId} IS NULL OR ${t.sourcePrivateNodeId} IS DISTINCT FROM ${t.targetPrivateNodeId}) AND (${t.sourcePublicNodeId} IS NULL OR ${t.sourcePublicNodeId} IS DISTINCT FROM ${t.targetPublicNodeId})`),
  check("user_graph_edges_type_check", sql`${t.type} IN ('prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to', 'supersedes', 'answers', 'supports', 'contradicts')`),
  check("user_graph_edges_origin_check", sql`${t.origin} IN ('manual', 'conversation')`),
  check("user_graph_edges_relation_origin_check", sql`${t.relationOrigin} IN ('explicit_user', 'extracted_from_source', 'model_inferred')`),
  check("user_graph_edges_weight_check", sql`${t.weight} > 0 AND ${t.weight} <= 1`),
]);

export const knowledgeCardSources = pgTable("knowledge_card_sources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  knowledgeItemId: text("knowledge_item_id").notNull().references(() => userKnowledgeItems.id, { onDelete: "cascade" }),
  batchId: text("batch_id").references(() => knowledgeIngestionBatches.id, { onDelete: "set null" }),
  draftId: text("draft_id").references(() => knowledgeCardDrafts.id, { onDelete: "set null" }),
  sourceType: text("source_type").notNull().default("conversation"),
  provider: text("provider").notNull(),
  conversationRef: text("conversation_ref"),
  sourceUrl: text("source_url"),
  sourceLocator: jsonb("source_locator").$type<Record<string, unknown>>(),
  discussedAt: timestamp("discussed_at", { withTimezone: true }),
  relationOrigin: text("relation_origin").default("extracted_from_source"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  unique("knowledge_card_sources_item_draft_key").on(t.knowledgeItemId, t.draftId),
  uniqueIndex("idx_knowledge_card_sources_id_user_item").on(t.id, t.userId, t.knowledgeItemId),
  foreignKey({
    columns: [t.knowledgeItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "knowledge_card_sources_item_owner_fk",
  }).onDelete("cascade"),
  index("idx_knowledge_card_sources_user_item").on(t.userId, t.knowledgeItemId),
  index("idx_knowledge_card_sources_user_discussed").on(t.userId, t.discussedAt)
    .where(sql`${t.discussedAt} IS NOT NULL`),
  check("knowledge_card_sources_source_url_check", sql`${t.sourceUrl} IS NULL OR (
    char_length(${t.sourceUrl}) BETWEEN 1 AND 2048
    AND ${t.sourceUrl} ~ '^https://[^/?#[:space:]]+'
    AND ${t.sourceUrl} !~ '^https://[^/?#]*@'
    AND position('?' in ${t.sourceUrl}) = 0
    AND position('#' in ${t.sourceUrl}) = 0
  )`),
  check("knowledge_card_sources_conversation_ref_check", sql`${t.conversationRef} IS NULL OR (
    char_length(${t.conversationRef}) BETWEEN 1 AND 240
    AND ${t.conversationRef} !~* '^[a-z][a-z0-9+.-]*://'
  )`),
  check("knowledge_card_sources_locator_check", sql`${t.sourceLocator} IS NULL OR jsonb_typeof(${t.sourceLocator}) = 'object'`),
  check("knowledge_card_sources_relation_origin_check", sql`${t.relationOrigin} IN ('explicit_user', 'extracted_from_source', 'model_inferred')`),
]);

export const knowledgeItemRevisions = pgTable("knowledge_item_revisions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  knowledgeItemId: text("knowledge_item_id").notNull(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.knowledgeItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "knowledge_item_revisions_item_owner_fk",
  }).onDelete("cascade"),
  unique("knowledge_item_revisions_item_version_key").on(t.knowledgeItemId, t.version),
  index("idx_knowledge_item_revisions_user_item").on(t.userId, t.knowledgeItemId, t.version),
  check("knowledge_item_revisions_version_check", sql`${t.version} >= 1`),
  check("knowledge_item_revisions_snapshot_check", sql`jsonb_typeof(${t.snapshot}) = 'object'`),
]);

export const knowledgeItemActivity = pgTable("knowledge_item_activity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  knowledgeItemId: text("knowledge_item_id").notNull(),
  activityType: text("activity_type").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.knowledgeItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "knowledge_item_activity_item_owner_fk",
  }).onDelete("cascade"),
  index("idx_knowledge_item_activity_user_item_created").on(t.userId, t.knowledgeItemId, t.createdAt),
  index("idx_knowledge_item_activity_user_type_created").on(t.userId, t.activityType, t.createdAt),
  check("knowledge_item_activity_type_check", sql`${t.activityType} IN ('confirmed', 'connected', 'verified', 'reused', 'revised', 'superseded', 'archived', 'restored')`),
  check("knowledge_item_activity_metadata_check", sql`jsonb_typeof(${t.metadata}) = 'object'`),
]);

export const knowledgeItemSupersessions = pgTable("knowledge_item_supersessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  supersededItemId: text("superseded_item_id").notNull(),
  replacementItemId: text("replacement_item_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.supersededItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "knowledge_item_supersessions_old_owner_fk",
  }).onDelete("cascade"),
  foreignKey({
    columns: [t.replacementItemId, t.userId],
    foreignColumns: [userKnowledgeItems.id, userKnowledgeItems.userId],
    name: "knowledge_item_supersessions_new_owner_fk",
  }).onDelete("cascade"),
  unique("knowledge_item_supersessions_old_key").on(t.userId, t.supersededItemId),
  index("idx_knowledge_item_supersessions_user_old").on(t.userId, t.supersededItemId),
  index("idx_knowledge_item_supersessions_user_new").on(t.userId, t.replacementItemId),
  check("knowledge_item_supersessions_distinct_check", sql`${t.supersededItemId} <> ${t.replacementItemId}`),
]);

export const knowledgeEvidenceSpans = pgTable("knowledge_evidence_spans", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  knowledgeItemId: text("knowledge_item_id").notNull(),
  sourceId: text("source_id").notNull(),
  selectorType: text("selector_type").notNull(),
  selector: jsonb("selector").$type<Record<string, unknown>>().notNull(),
  polarity: text("polarity").notNull().default("supports"),
  quality: text("quality").notNull().default("unknown"),
  relationOrigin: text("relation_origin").notNull().default("extracted_from_source"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.sourceId, t.userId, t.knowledgeItemId],
    foreignColumns: [knowledgeCardSources.id, knowledgeCardSources.userId, knowledgeCardSources.knowledgeItemId],
    name: "knowledge_evidence_spans_source_owner_item_fk",
  }).onDelete("cascade"),
  index("idx_knowledge_evidence_spans_user_item").on(t.userId, t.knowledgeItemId),
  index("idx_knowledge_evidence_spans_user_source").on(t.userId, t.sourceId),
  check("knowledge_evidence_spans_selector_type_check", sql`${t.selectorType} IN ('message', 'text_position', 'line_range', 'external_ref')`),
  check("knowledge_evidence_spans_selector_check", sql`
    jsonb_typeof(${t.selector}) = 'object'
    AND octet_length(${t.selector}::text) <= 4096
    AND ${t.selector}::text
      !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
    AND (
      ${t.selectorType} <> 'external_ref'
      OR (
        ${t.selector} ? 'source_ref'
        AND jsonb_typeof(${t.selector} -> 'source_ref') = 'string'
        AND char_length(${t.selector} ->> 'source_ref') BETWEEN 1 AND 2048
        AND position('?' in (${t.selector} ->> 'source_ref')) = 0
        AND position('#' in (${t.selector} ->> 'source_ref')) = 0
        AND (
          (${t.selector} ->> 'source_ref') !~* '^[a-z][a-z0-9+.-]*://'
          OR (
            (${t.selector} ->> 'source_ref') ~ '^https://[^/?#[:space:]]+'
            AND (${t.selector} ->> 'source_ref') !~ '^https://[^/?#]*@'
          )
        )
      )
    )
  `),
  check("knowledge_evidence_spans_polarity_check", sql`${t.polarity} IN ('supports', 'contradicts')`),
  check("knowledge_evidence_spans_quality_check", sql`${t.quality} IN ('unknown', 'low', 'medium', 'high')`),
  check("knowledge_evidence_spans_relation_origin_check", sql`${t.relationOrigin} IN ('explicit_user', 'extracted_from_source', 'model_inferred')`),
]);

export const mcpAccessTokens = pgTable("mcp_access_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  lastFour: text("last_four").notNull(),
  label: text("label").notNull().default("MCP client"),
  scopes: jsonb("scopes").notNull().default(["knowledge:drafts:create"]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [
  index("idx_mcp_access_tokens_user").on(t.userId, t.createdAt),
  index("idx_mcp_access_tokens_active_hash").on(t.tokenHash).where(sql`${t.revokedAt} IS NULL`),
]);

export const mcpRequestRateLimits = pgTable("mcp_request_rate_limits", {
  scopeKey: text("scope_key").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_mcp_request_rate_limits_stale_credentials").on(t.updatedAt, t.scopeKey)
    .where(sql`${t.scopeKey} LIKE 'credential:%'`),
  check("mcp_request_rate_limits_count_check", sql`${t.requestCount} >= 0`),
]);

export const mcpDeletedAccountMarkers = pgTable("mcp_deleted_account_markers", {
  scopeKey: text("scope_key").primaryKey(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("mcp_deleted_account_markers_scope_key_check", sql`${t.scopeKey} ~ '^[0-9a-f]{64}$'`),
]);

export const billingCustomers = pgTable("billing_customers", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  tossCustomerKey: text("toss_customer_key").unique(),
  trialConsumedAt: timestamp("trial_consumed_at", { withTimezone: true }),
  stripePortalWindowStartedAt: timestamp("stripe_portal_window_started_at", { withTimezone: true }).notNull().defaultNow(),
  stripePortalRequestCount: integer("stripe_portal_request_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check("billing_customers_stripe_portal_request_count_check", sql`${t.stripePortalRequestCount} >= 0`),
]);

export const tossPrepareRateLimits = pgTable("toss_prepare_rate_limits", {
  userId: text("user_id").primaryKey(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
  requestCount: integer("request_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_toss_prepare_rate_limits_updated_at").on(t.updatedAt),
  check("toss_prepare_rate_limits_count_check", sql`${t.requestCount} >= 0`),
]);

export const billingSubscriptions = pgTable("billing_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  providerSubscriptionId: text("provider_subscription_id").notNull(),
  store: text("store"),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  entitlement: text("entitlement").notNull().default("ad_free"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  providerEventAt: timestamp("provider_event_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("billing_subscriptions_provider_reference_key").on(t.provider, t.providerSubscriptionId),
  index("idx_billing_subscriptions_user_entitlement").on(t.userId, t.entitlement, t.status),
  index("idx_billing_subscriptions_period_end").on(t.currentPeriodEnd),
  check("billing_subscriptions_provider_check", sql`${t.provider} IN ('stripe', 'toss', 'revenuecat')`),
  check("billing_subscriptions_store_check", sql`${t.store} IS NULL OR ${t.store} IN ('web', 'app_store', 'play_store', 'stripe', 'promotional')`),
  check("billing_subscriptions_plan_check", sql`${t.plan} IN ('monthly', 'annual')`),
  check("billing_subscriptions_status_check", sql`${t.status} IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')`),
  check("billing_subscriptions_entitlement_check", sql`${t.entitlement} IN ('ad_free')`),
]);

export const billingWebhookEvents = pgTable("billing_webhook_events", {
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.provider, t.eventId] }),
  index("idx_billing_webhook_events_pending").on(t.createdAt).where(sql`${t.processedAt} IS NULL`),
  check("billing_webhook_events_provider_check", sql`${t.provider} IN ('stripe', 'revenuecat', 'toss')`),
]);

export const tossBillingKeyIntents = pgTable("toss_billing_key_intents", {
  id: text("id").primaryKey(),
  agreementId: text("agreement_id").notNull(),
  userId: text("user_id").notNull(),
  customerKey: text("customer_key").notNull(),
  plan: text("plan").notNull(),
  providerIdempotencyKey: text("provider_idempotency_key").unique(),
  authKeyCiphertext: text("auth_key_ciphertext"),
  billingKeyCiphertext: text("billing_key_ciphertext"),
  billingKeyFingerprint: text("billing_key_fingerprint"),
  status: text("status").notNull().default("issuing"),
  issueAttemptCount: integer("issue_attempt_count").notNull().default(0),
  cleanupAttemptCount: integer("cleanup_attempt_count").notNull().default(0),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
  processingToken: text("processing_token"),
  lastErrorCode: text("last_error_code"),
  cleanedAt: timestamp("cleaned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("toss_billing_key_intents_id_agreement_user_key").on(t.id, t.agreementId, t.userId),
  index("idx_toss_billing_key_intents_recovery").on(t.status, t.updatedAt)
    .where(sql`${t.status} IN ('issuing', 'cleanup_pending')`),
  index("idx_toss_billing_key_intents_agreement").on(t.agreementId, t.status),
  check("toss_billing_key_intents_plan_check", sql`${t.plan} IN ('monthly', 'annual')`),
  check("toss_billing_key_intents_status_check", sql`${t.status} IN ('issuing', 'cleanup_pending', 'live', 'cleaned', 'manual_review')`),
  check("toss_billing_key_intents_issue_attempts_check", sql`${t.issueAttemptCount} >= 0`),
  check("toss_billing_key_intents_cleanup_attempts_check", sql`${t.cleanupAttemptCount} >= 0`),
  check("toss_billing_key_intents_material_check", sql`
    (${t.status} = 'issuing'
      AND ${t.providerIdempotencyKey} IS NOT NULL
      AND ${t.authKeyCiphertext} IS NOT NULL
      AND ${t.billingKeyCiphertext} IS NULL
      AND ${t.billingKeyFingerprint} IS NULL)
    OR (${t.status} IN ('cleanup_pending', 'live')
      AND ${t.authKeyCiphertext} IS NULL
      AND ${t.billingKeyCiphertext} IS NOT NULL
      AND (${t.billingKeyFingerprint} IS NOT NULL
        OR (${t.status} = 'live' AND ${t.providerIdempotencyKey} IS NULL)))
    OR (${t.status} = 'cleaned'
      AND ${t.authKeyCiphertext} IS NULL
      AND ${t.billingKeyCiphertext} IS NULL)
    OR (${t.status} = 'manual_review'
      AND ${t.providerIdempotencyKey} IS NOT NULL
      AND ${t.authKeyCiphertext} IS NULL
      AND ${t.billingKeyCiphertext} IS NULL
      AND ${t.billingKeyFingerprint} IS NULL)
  `),
]);

export const tossBillingAgreements = pgTable("toss_billing_agreements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  billingKeyCiphertext: text("billing_key_ciphertext").notNull(),
  billingKeyIntentId: text("billing_key_intent_id"),
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  nextChargeAt: timestamp("next_charge_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
  processingToken: text("processing_token"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  billingKeyCleanupRequired: boolean("billing_key_cleanup_required").notNull().default(false),
  billingKeyCleanupAttempts: integer("billing_key_cleanup_attempts").notNull().default(0),
  billingKeyCleanupLastError: text("billing_key_cleanup_last_error"),
  billingKeyDeletedAt: timestamp("billing_key_deleted_at", { withTimezone: true }),
  lastPaymentKey: text("last_payment_key"),
  lastOrderId: text("last_order_id"),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({
    columns: [t.billingKeyIntentId, t.id, t.userId],
    foreignColumns: [
      tossBillingKeyIntents.id,
      tossBillingKeyIntents.agreementId,
      tossBillingKeyIntents.userId,
    ],
    name: "toss_billing_agreements_intent_owner_fk",
  }).onDelete("restrict"),
  index("idx_toss_billing_agreements_due").on(t.nextChargeAt).where(sql`${t.nextChargeAt} IS NOT NULL AND ${t.cancelAtPeriodEnd} = FALSE`),
  index("idx_toss_billing_agreements_key_cleanup").on(t.updatedAt).where(sql`${t.billingKeyCleanupRequired} = TRUE`),
  check("toss_billing_agreements_plan_check", sql`${t.plan} IN ('monthly', 'annual')`),
  check("toss_billing_agreements_status_check", sql`${t.status} IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled')`),
  check("toss_billing_agreements_retry_count_check", sql`${t.retryCount} >= 0`),
  check("toss_billing_agreements_cleanup_attempts_check", sql`${t.billingKeyCleanupAttempts} >= 0`),
]);

export const tossBillingSessions = pgTable("toss_billing_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull(),
  customerKey: text("customer_key").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  processingStartedAt: timestamp("processing_started_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_toss_billing_sessions_user_status").on(t.userId, t.status, t.expiresAt),
  index("idx_toss_billing_sessions_cleanup").on(t.status, t.updatedAt),
  uniqueIndex("idx_toss_billing_sessions_one_pending").on(t.userId).where(sql`${t.status} = 'pending'`),
  check("toss_billing_sessions_plan_check", sql`${t.plan} IN ('monthly', 'annual')`),
  check("toss_billing_sessions_status_check", sql`${t.status} IN ('pending', 'processing', 'consumed', 'failed', 'abandoned')`),
]);

export const tossBillingCharges = pgTable("toss_billing_charges", {
  orderId: text("order_id").primaryKey(),
  agreementId: text("agreement_id").notNull().references(() => tossBillingAgreements.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  cycleKey: text("cycle_key").notNull(),
  plan: text("plan").notNull(),
  amountKrw: integer("amount_krw").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  paymentKey: text("payment_key").unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastErrorCode: text("last_error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("toss_billing_charges_agreement_cycle_key").on(t.agreementId, t.cycleKey),
  uniqueIndex("idx_toss_billing_charges_one_unresolved").on(t.agreementId).where(sql`${t.status} IN ('pending', 'paid')`),
  index("idx_toss_billing_charges_reconciliation").on(t.status, t.updatedAt),
  check("toss_billing_charges_plan_check", sql`${t.plan} IN ('monthly', 'annual')`),
  check("toss_billing_charges_amount_check", sql`${t.amountKrw} > 0`),
  check("toss_billing_charges_status_check", sql`${t.status} IN ('pending', 'paid', 'applied', 'canceled', 'abandoned')`),
  check("toss_billing_charges_attempt_count_check", sql`${t.attemptCount} >= 0`),
  check("toss_billing_charges_period_check", sql`${t.periodEnd} > ${t.periodStart}`),
]);
