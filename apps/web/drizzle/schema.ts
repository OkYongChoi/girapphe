import {
  boolean,
  check,
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

export const knowledgeCards = pgTable("knowledge_cards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  explanation: text("explanation"),
  wikiUrl: text("wiki_url"),
  domain: text("domain"),
  level: text("level"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_knowledge_cards_domain").on(t.domain),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  purgeAt: timestamp("purge_at", { withTimezone: true }),
}, (t) => [
  index("idx_user_knowledge_items_user").on(t.userId),
  index("idx_user_knowledge_items_active_created").on(t.userId, t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  index("idx_user_knowledge_items_purge_at").on(t.purgeAt).where(sql`${t.purgeAt} IS NOT NULL`),
]);

export const knowledgeIngestionBatches = pgTable("knowledge_ingestion_batches", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceType: text("source_type").notNull().default("conversation"),
  provider: text("provider").notNull(),
  scope: text("scope").notNull().default("current_conversation"),
  requestId: text("request_id").notNull(),
  conversationRef: text("conversation_ref"),
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
  check("knowledge_card_drafts_status_check", sql`${t.status} IN ('pending', 'approved', 'rejected')`),
  check("knowledge_card_drafts_version_check", sql`${t.version} >= 1`),
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
  check("user_graph_edges_type_check", sql`${t.type} IN ('prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to')`),
  check("user_graph_edges_origin_check", sql`${t.origin} IN ('manual', 'conversation')`),
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  unique("knowledge_card_sources_item_draft_key").on(t.knowledgeItemId, t.draftId),
  index("idx_knowledge_card_sources_user_item").on(t.userId, t.knowledgeItemId),
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

export const billingCustomers = pgTable("billing_customers", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").unique(),
  tossCustomerKey: text("toss_customer_key").unique(),
  trialConsumedAt: timestamp("trial_consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export const tossBillingAgreements = pgTable("toss_billing_agreements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  billingKeyCiphertext: text("billing_key_ciphertext").notNull(),
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
