import {
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`uuid_generate_v4()`),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id").notNull().references(() => knowledgeCards.id, { onDelete: "cascade" }),
  status: text("status"),
  confidence: integer("confidence").default(0),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.cardId] }),
  index("idx_user_card_states_user_id").on(t.userId),
  index("idx_user_card_states_status").on(t.status),
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
  userId: uuid("user_id").notNull(),
  nodeId: text("node_id").notNull().references(() => graphNodes.id, { onDelete: "cascade" }),
  knowledgeState: real("knowledge_state").notNull().default(0),
  confidence: real("confidence").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  firstKnownAt: timestamp("first_known_at", { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.nodeId] }),
  index("idx_user_knowledge_states_user").on(t.userId),
  index("idx_user_knowledge_states_node").on(t.nodeId),
]);

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  authProvider: text("auth_provider"),
  providerUserId: text("provider_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("idx_auth_users_provider_identity").on(t.authProvider, t.providerUserId),
]);

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_auth_sessions_user_id").on(t.userId),
]);

export const userKnowledgeItems = pgTable("user_knowledge_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  topic: text("topic").notNull().default("general"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  index("idx_user_knowledge_items_user").on(t.userId),
]);
