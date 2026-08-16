import 'server-only';

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { GRAPH_EDGES, GRAPH_NODES } from '@stem-brain/graph-engine';
import pool from '@/lib/db';

export const MCP_DRAFT_CREATE_SCOPE = 'knowledge:drafts:create' as const;
export const MCP_REQUESTS_PER_TOKEN_PER_MINUTE = 60;
export const MCP_REQUESTS_PER_USER_PER_MINUTE = 300;
export const MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;
export const MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE = 64;
export const MCP_ACTIVE_TOKEN_LIMIT = 10;
export const MCP_TOKEN_CREATION_LIMIT_PER_DAY = 20;
export const MCP_TOTAL_TOKEN_RECORD_LIMIT = 500;
export const MCP_DRAFTS_PER_TOKEN_PER_HOUR = 250;
export const MCP_DRAFTS_PER_USER_PER_HOUR = 500;
export const MAX_PENDING_KNOWLEDGE_DRAFTS_PER_USER = 500;
export const MAX_KNOWLEDGE_DRAFTS_PER_USER = 100_000;
export const MAX_KNOWLEDGE_BATCHES_PER_USER = 20_000;
export const MAX_KNOWLEDGE_ITEMS_PER_USER = 50_000;
export const KNOWLEDGE_PROVIDERS = ['chatgpt', 'claude', 'gemini', 'other'] as const;
export const KNOWLEDGE_RELATION_TYPES = [
  'prerequisite',
  'related',
  'generalizes',
  'derived_from',
  'equivalent_to',
] as const;

export type KnowledgeProvider = (typeof KNOWLEDGE_PROVIDERS)[number];
export type KnowledgeRelationType = (typeof KNOWLEDGE_RELATION_TYPES)[number];
export type KnowledgeTargetKind = 'public' | 'private' | 'draft';

export type ProposedKnowledgeRelation = {
  targetKind: KnowledgeTargetKind;
  targetId: string;
  type: KnowledgeRelationType;
  direction?: 'outgoing' | 'incoming';
  weight?: number;
};

export type CreateKnowledgeDraftCardInput = {
  clientCardId?: string;
  title: string;
  summary?: string;
  explanation?: string;
  topic?: string;
  tags?: string[];
  relations?: ProposedKnowledgeRelation[];
};

export type CreateKnowledgeDraftBatchInput = {
  provider: KnowledgeProvider;
  requestId: string;
  conversationRef?: string;
  cards: CreateKnowledgeDraftCardInput[];
};

export type CreateKnowledgeDraftBatchResult = {
  batchId: string;
  created: boolean;
  draftCount: number;
  reviewPath: string;
};

export type KnowledgeDraftBatch = {
  id: string;
  source_type: 'conversation';
  provider: KnowledgeProvider;
  scope: 'current_conversation';
  conversation_ref: string | null;
  status: 'pending' | 'partial' | 'approved' | 'discarded';
  draft_count: number;
  pending_count: number;
  approved_count: number;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
};

export type KnowledgeCardDraft = {
  id: string;
  batch_id: string;
  client_card_id: string;
  title: string;
  summary: string;
  explanation: string;
  topic: string;
  tags: string[];
  relations: ProposedKnowledgeRelation[];
  status: 'pending' | 'approved' | 'rejected';
  version: number;
  knowledge_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PrivateKnowledgeNode = {
  id: string;
  graph_node_id: string;
  knowledge_item_id: string;
  label: string;
  summary: string;
  explanation: string;
  topic: string;
  tags: string[];
  origin: 'manual' | 'conversation';
  created_at: string;
};

export type PrivateKnowledgeEdge = {
  id: string;
  source: string;
  target: string;
  type: KnowledgeRelationType;
  weight: number;
  origin: 'manual' | 'conversation';
  created_at: string;
};

export type PrivateKnowledgeGraph = {
  nodes: PrivateKnowledgeNode[];
  edges: PrivateKnowledgeEdge[];
};

export type KnowledgeLinkTarget = {
  id: string;
  label: string;
  scope: 'public' | 'private';
  topic: string;
};

export type McpAccessToken = {
  id: string;
  label: string;
  scopes: string[];
  last_four: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
};

export type AuthenticatedMcpToken = {
  userId: string;
  tokenId: string;
  scopes: string[];
};

export type MemoryKnowledgeItem = {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  purge_at: string | null;
};

type DraftPayload = {
  id: string;
  client_card_id: string;
  title: string;
  summary: string;
  explanation: string;
  topic: string;
  tags: string[];
  relations: ProposedKnowledgeRelation[];
};

type MemoryBatchRecord = KnowledgeDraftBatch & {
  user_id: string;
  request_id: string;
  mcp_token_id: string | null;
};
type MemoryTokenRecord = McpAccessToken & { user_id: string; token_hash: string };
type MemoryRateRecord = { windowStartedAt: number; requestCount: number };

const memoryKnowledgeItems = new Map<string, MemoryKnowledgeItem[]>();
const memoryCreateRequests = new Map<string, Set<string>>();
const memoryBatches = new Map<string, MemoryBatchRecord>();
const memoryDrafts = new Map<string, KnowledgeCardDraft[]>();
const memoryNodes = new Map<string, PrivateKnowledgeNode[]>();
const memoryEdges = new Map<string, PrivateKnowledgeEdge[]>();
const memoryTrashedNodes = new Map<string, PrivateKnowledgeNode[]>();
const memoryTrashedEdges = new Map<string, PrivateKnowledgeEdge[]>();
const memoryTokens = new Map<string, MemoryTokenRecord>();
const memoryMcpRequestRates = new Map<string, MemoryRateRecord>();
const memoryMcpCredentialRateKeys = new Set<string>();

export class McpRequestRateLimitError extends Error {
  constructor() {
    super('MCP request rate limit exceeded.');
    this.name = 'McpRequestRateLimitError';
  }
}

let ingestionSchemaPromise: Promise<void> | null = null;
let transactionSql: ReturnType<typeof neon> | null = null;

function getTransactionSql() {
  if (!transactionSql) transactionSql = neon(process.env.DATABASE_URL!);
  return transactionSql;
}

export function normalizeKnowledgeTopic(input: string): string {
  const normalized = input
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s/]+/gu, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return Array.from(normalized).slice(0, 48).join('') || 'general';
}

export function sanitizeKnowledgeTitle(input: string): string {
  return Array.from(input.normalize('NFKC').trim()).slice(0, 120).join('');
}

export function sanitizeKnowledgeContent(input: string, maxLength = 6000): string {
  return Array.from(input.normalize('NFKC').trim()).slice(0, maxLength).join('');
}

function sanitizeIdentifier(input: string, maxLength: number): string {
  return Array.from(input.normalize('NFKC').trim()).slice(0, maxLength).join('');
}

function isProvider(input: string): input is KnowledgeProvider {
  return (KNOWLEDGE_PROVIDERS as readonly string[]).includes(input);
}

export function isKnowledgeRelationType(input: string): input is KnowledgeRelationType {
  return (KNOWLEDGE_RELATION_TYPES as readonly string[]).includes(input);
}

export function sanitizeKnowledgeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => normalizeKnowledgeTopic(tag))
    .filter((tag) => tag !== 'general')))
    .slice(0, 12);
}

export function parseEndpointIdentifier(value: string): { kind: 'public' | 'private' | 'personal' | 'draft'; id: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('public:')) return { kind: 'public', id: trimmed.slice(7) };
  if (trimmed.startsWith('graph_')) return { kind: 'public', id: trimmed.slice(6) };
  if (trimmed.startsWith('private:')) return { kind: 'private', id: trimmed.slice(8) };
  if (trimmed.startsWith('personal:')) return { kind: 'personal', id: trimmed.slice(9) };
  if (trimmed.startsWith('draft:')) return { kind: 'draft', id: trimmed.slice(6) };
  return null;
}

export function sanitizeProposedRelations(input: unknown): ProposedKnowledgeRelation[] {
  if (!Array.isArray(input)) return [];
  const result: ProposedKnowledgeRelation[] = [];
  for (const value of input.slice(0, 12)) {
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    const rawTargetId = String(record.targetId ?? record.target_id ?? '').trim();
    const parsedTarget = parseEndpointIdentifier(rawTargetId);
    const targetKindRaw = String(record.targetKind ?? record.target_kind ?? parsedTarget?.kind ?? '');
    const targetKind = targetKindRaw === 'personal' ? 'private' : targetKindRaw;
    const targetId = sanitizeIdentifier(parsedTarget?.id ?? rawTargetId, 160);
    const type = String(record.type ?? '');
    const direction = record.direction === 'incoming' ? 'incoming' : 'outgoing';
    const numericWeight = Number(record.weight ?? 1);
    if (!['public', 'private', 'draft'].includes(targetKind) || !targetId || !isKnowledgeRelationType(type)
      || !Number.isFinite(numericWeight) || numericWeight <= 0 || numericWeight > 1) continue;
    result.push({
      targetKind: targetKind as KnowledgeTargetKind,
      targetId,
      type,
      direction,
      weight: numericWeight,
    });
  }
  return result;
}

function sanitizeDraftCards(cards: CreateKnowledgeDraftCardInput[]): DraftPayload[] {
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > 50) {
    throw new Error('A draft batch must contain between 1 and 50 cards.');
  }
  const seenClientIds = new Set<string>();
  return cards.map((card, index) => {
    const title = sanitizeKnowledgeTitle(String(card.title ?? ''));
    if (!title) throw new Error(`Card ${index + 1} needs a title.`);
    const clientCardId = sanitizeIdentifier(String(card.clientCardId ?? `card-${index + 1}`), 160);
    if (!clientCardId || seenClientIds.has(clientCardId)) throw new Error('clientCardId values must be non-empty and unique within a batch.');
    seenClientIds.add(clientCardId);
    return {
      id: randomUUID(),
      client_card_id: clientCardId,
      title,
      summary: sanitizeKnowledgeContent(String(card.summary ?? ''), 500),
      explanation: sanitizeKnowledgeContent(String(card.explanation ?? ''), 6000),
      topic: normalizeKnowledgeTopic(String(card.topic ?? '')),
      tags: sanitizeKnowledgeTags(card.tags),
      relations: sanitizeProposedRelations(card.relations),
    };
  });
}

export async function ensureKnowledgeIngestionSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  // Production requests must use the checked-in migration. The isolated PR
  // preview database deliberately keeps its existing authenticated bootstrap
  // behavior because preview deployments do not apply unmerged migrations.
  // MCP bearer authentication itself never calls this function, so invalid
  // token traffic cannot amplify DDL round trips on a cold Worker isolate.
  if (process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'preview') return;
  if (!ingestionSchemaPromise) {
    ingestionSchemaPromise = (async () => {
      await pool.query(`ALTER TABLE user_knowledge_items
        ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_ingestion_batches (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'conversation',
          provider TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'current_conversation', request_id TEXT NOT NULL,
          conversation_ref TEXT, mcp_token_id TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(), committed_at TIMESTAMPTZ, discarded_at TIMESTAMPTZ,
          UNIQUE(user_id, provider, request_id),
          CHECK (source_type = 'conversation'), CHECK (provider IN ('chatgpt', 'claude', 'gemini', 'other')),
          CHECK (scope = 'current_conversation'), CHECK (status IN ('pending', 'partial', 'approved', 'discarded'))
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_card_drafts (
          id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES knowledge_ingestion_batches(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL, client_card_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
          explanation TEXT NOT NULL DEFAULT '', topic TEXT NOT NULL DEFAULT 'general', tags JSONB NOT NULL DEFAULT '[]'::jsonb,
          proposed_relations JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'pending', version INTEGER NOT NULL DEFAULT 1,
          knowledge_item_id TEXT REFERENCES user_knowledge_items(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(), approved_at TIMESTAMPTZ, UNIQUE(batch_id, client_card_id),
          CHECK (status IN ('pending', 'approved', 'rejected')), CHECK (version >= 1)
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_graph_nodes (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, knowledge_item_id TEXT NOT NULL REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
          label TEXT NOT NULL, topic TEXT NOT NULL DEFAULT 'general', origin TEXT NOT NULL DEFAULT 'manual',
          source_batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ, purge_at TIMESTAMPTZ,
          UNIQUE(user_id, knowledge_item_id), CHECK (origin IN ('manual', 'conversation'))
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_graph_edges (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
          source_private_node_id TEXT REFERENCES user_graph_nodes(id) ON DELETE CASCADE,
          source_public_node_id TEXT REFERENCES graph_nodes(id) ON DELETE CASCADE,
          target_private_node_id TEXT REFERENCES user_graph_nodes(id) ON DELETE CASCADE,
          target_public_node_id TEXT REFERENCES graph_nodes(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'related', weight REAL NOT NULL DEFAULT 1, origin TEXT NOT NULL DEFAULT 'manual',
          source_batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ, purge_at TIMESTAMPTZ,
          CHECK (num_nonnulls(source_private_node_id, source_public_node_id) = 1),
          CHECK (num_nonnulls(target_private_node_id, target_public_node_id) = 1),
          CHECK ((source_private_node_id IS NULL OR source_private_node_id IS DISTINCT FROM target_private_node_id)
            AND (source_public_node_id IS NULL OR source_public_node_id IS DISTINCT FROM target_public_node_id)),
          CHECK (type IN ('prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to')),
          CHECK (origin IN ('manual', 'conversation')), CHECK (weight > 0 AND weight <= 1)
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_card_sources (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, knowledge_item_id TEXT NOT NULL REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
          batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
          draft_id TEXT REFERENCES knowledge_card_drafts(id) ON DELETE SET NULL,
          source_type TEXT NOT NULL DEFAULT 'conversation', provider TEXT NOT NULL, conversation_ref TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(knowledge_item_id, draft_id)
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_access_tokens (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, last_four TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT 'MCP client', scopes JSONB NOT NULL DEFAULT '["knowledge:drafts:create"]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(), last_used_at TIMESTAMPTZ, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_request_rate_limits (
          scope_key TEXT PRIMARY KEY, window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          request_count INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CHECK (request_count >= 0)
        );
      `);
      await pool.query(`ALTER TABLE knowledge_ingestion_batches
        ADD COLUMN IF NOT EXISTS mcp_token_id TEXT`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_ingestion_batches_user_created
        ON knowledge_ingestion_batches(user_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_ingestion_batches_token_created
        ON knowledge_ingestion_batches(mcp_token_id, created_at DESC) WHERE mcp_token_id IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_user_status
        ON knowledge_card_drafts(user_id, status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_user_created
        ON knowledge_card_drafts(user_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_batch
        ON knowledge_card_drafts(batch_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_graph_nodes_user_active
        ON user_graph_nodes(user_id, created_at DESC) WHERE deleted_at IS NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_graph_nodes_purge_at
        ON user_graph_nodes(purge_at) WHERE purge_at IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_graph_edges_user_active
        ON user_graph_edges(user_id, created_at DESC) WHERE deleted_at IS NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_graph_edges_source_private
        ON user_graph_edges(source_private_node_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_graph_edges_target_private
        ON user_graph_edges(target_private_node_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_graph_edges_purge_at
        ON user_graph_edges(purge_at) WHERE purge_at IS NOT NULL`);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_graph_edges_unique_active ON user_graph_edges (
          user_id, COALESCE(source_private_node_id, 'public:' || source_public_node_id),
          COALESCE(target_private_node_id, 'public:' || target_public_node_id), type
        ) WHERE deleted_at IS NULL
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_graph_edges_unique_symmetric_active ON user_graph_edges (
          user_id,
          LEAST(COALESCE('private:' || source_private_node_id, 'public:' || source_public_node_id),
            COALESCE('private:' || target_private_node_id, 'public:' || target_public_node_id)),
          GREATEST(COALESCE('private:' || source_private_node_id, 'public:' || source_public_node_id),
            COALESCE('private:' || target_private_node_id, 'public:' || target_public_node_id)),
          type
        ) WHERE deleted_at IS NULL AND type IN ('related', 'equivalent_to')
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_sources_user_item
        ON knowledge_card_sources(user_id, knowledge_item_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_user
        ON mcp_access_tokens(user_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mcp_access_tokens_active_hash
        ON mcp_access_tokens(token_hash) WHERE revoked_at IS NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_mcp_request_rate_limits_stale_credentials
        ON mcp_request_rate_limits(updated_at, scope_key)
        WHERE scope_key LIKE 'credential:%'`);
    })().catch((error) => {
      ingestionSchemaPromise = null;
      throw error;
    });
  }
  return ingestionSchemaPromise;
}

function mapDraftRow(row: Record<string, unknown>): KnowledgeCardDraft {
  return {
    id: String(row.id),
    batch_id: String(row.batch_id),
    client_card_id: String(row.client_card_id),
    title: String(row.title),
    summary: String(row.summary ?? ''),
    explanation: String(row.explanation ?? ''),
    topic: String(row.topic ?? 'general'),
    tags: sanitizeKnowledgeTags(row.tags),
    relations: sanitizeProposedRelations(row.proposed_relations ?? row.relations),
    status: row.status as KnowledgeCardDraft['status'],
    version: Number(row.version ?? 1),
    knowledge_item_id: row.knowledge_item_id ? String(row.knowledge_item_id) : null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapBatchRow(row: Record<string, unknown>): KnowledgeDraftBatch {
  return {
    id: String(row.id),
    source_type: 'conversation',
    provider: row.provider as KnowledgeProvider,
    scope: 'current_conversation',
    conversation_ref: row.conversation_ref ? String(row.conversation_ref) : null,
    status: row.status as KnowledgeDraftBatch['status'],
    draft_count: Number(row.draft_count ?? 0),
    pending_count: Number(row.pending_count ?? 0),
    approved_count: Number(row.approved_count ?? 0),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
    committed_at: row.committed_at ? new Date(String(row.committed_at)).toISOString() : null,
  };
}

export async function createKnowledgeDraftBatchForUser(
  userId: string,
  input: CreateKnowledgeDraftBatchInput,
  sourceTokenId: string | null = null
): Promise<CreateKnowledgeDraftBatchResult> {
  if (!userId || userId.startsWith('guest_')) throw new Error('A signed-in user is required.');
  const provider = String(input.provider ?? '').toLowerCase();
  if (!isProvider(provider)) throw new Error('Unsupported conversation provider.');
  const requestId = sanitizeIdentifier(String(input.requestId ?? ''), 160);
  if (!requestId) throw new Error('requestId is required for idempotency.');
  const conversationRef = sanitizeIdentifier(String(input.conversationRef ?? ''), 240) || null;
  const cards = sanitizeDraftCards(input.cards);

  if (!process.env.DATABASE_URL) {
    const existing = Array.from(memoryBatches.values()).find(
      (batch) => batch.user_id === userId && batch.provider === provider && batch.request_id === requestId
    );
    if (existing) {
      return {
        batchId: existing.id,
        created: false,
        draftCount: memoryDrafts.get(existing.id)?.length ?? 0,
        reviewPath: `/knowledge-inbox/${encodeURIComponent(existing.id)}`,
      };
    }
    const nowMs = Date.now();
    const userBatches = Array.from(memoryBatches.values()).filter((batch) => batch.user_id === userId);
    const userDrafts = userBatches.flatMap((batch) => memoryDrafts.get(batch.id) ?? []);
    const recentUserDrafts = userDrafts.filter((draft) => nowMs - new Date(draft.created_at).getTime() < 3_600_000).length;
    const recentTokenDrafts = sourceTokenId
      ? userBatches
          .filter((batch) => batch.mcp_token_id === sourceTokenId)
          .flatMap((batch) => memoryDrafts.get(batch.id) ?? [])
          .filter((draft) => nowMs - new Date(draft.created_at).getTime() < 3_600_000).length
      : 0;
    const pendingDrafts = userDrafts.filter((draft) => draft.status === 'pending').length;
    const knowledgeItemCount = (memoryKnowledgeItems.get(userId) ?? []).length;
    const sourceToken = sourceTokenId ? memoryTokens.get(sourceTokenId) : null;
    if (sourceTokenId && (!sourceToken || sourceToken.user_id !== userId || sourceToken.revoked_at
      || new Date(sourceToken.expires_at).getTime() <= nowMs)) {
      throw new Error('The MCP token is no longer active.');
    }
    if (userBatches.length >= MAX_KNOWLEDGE_BATCHES_PER_USER
      || userDrafts.length + cards.length > MAX_KNOWLEDGE_DRAFTS_PER_USER
      || pendingDrafts + cards.length > MAX_PENDING_KNOWLEDGE_DRAFTS_PER_USER
      || knowledgeItemCount + cards.length > MAX_KNOWLEDGE_ITEMS_PER_USER
      || recentUserDrafts + cards.length > MCP_DRAFTS_PER_USER_PER_HOUR
      || (sourceTokenId && recentTokenDrafts + cards.length > MCP_DRAFTS_PER_TOKEN_PER_HOUR)) {
      throw new Error('Knowledge ingestion quota exceeded.');
    }
    const now = new Date().toISOString();
    const batchId = randomUUID();
    const drafts = cards.map<KnowledgeCardDraft>((card) => ({
      id: card.id,
      batch_id: batchId,
      client_card_id: card.client_card_id,
      title: card.title,
      summary: card.summary,
      explanation: card.explanation,
      topic: card.topic,
      tags: card.tags,
      relations: card.relations,
      status: 'pending',
      version: 1,
      knowledge_item_id: null,
      created_at: now,
      updated_at: now,
    }));
    memoryBatches.set(batchId, {
      id: batchId,
      user_id: userId,
      request_id: requestId,
      mcp_token_id: sourceTokenId,
      source_type: 'conversation',
      provider,
      scope: 'current_conversation',
      conversation_ref: conversationRef,
      status: 'pending',
      draft_count: drafts.length,
      pending_count: drafts.length,
      approved_count: 0,
      created_at: now,
      updated_at: now,
      committed_at: null,
    });
    memoryDrafts.set(batchId, drafts);
    return { batchId, created: true, draftCount: drafts.length, reviewPath: `/knowledge-inbox/${encodeURIComponent(batchId)}` };
  }

  await ensureKnowledgeIngestionSchema();
  const batchId = randomUUID();
  const sql = getTransactionSql();
  const resultSets = await sql.transaction((tx) => [
    tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-ingestion:${userId}`]),
    tx.query(
    `
    WITH inserted_batch AS (
      INSERT INTO knowledge_ingestion_batches
        (id, user_id, source_type, provider, scope, request_id, conversation_ref, mcp_token_id)
      SELECT $1, $2, 'conversation', $3, 'current_conversation', $4, $5, $6
      WHERE ($6::text IS NULL OR EXISTS (
          SELECT 1 FROM mcp_access_tokens t
          WHERE t.id = $6 AND t.user_id = $2 AND t.revoked_at IS NULL AND t.expires_at > NOW()
        ))
        AND (SELECT COUNT(*) FROM knowledge_ingestion_batches b WHERE b.user_id = $2) < $8
        AND (SELECT COUNT(*) FROM knowledge_card_drafts d WHERE d.user_id = $2)
          + jsonb_array_length($7::jsonb) <= $9
        AND (SELECT COUNT(*) FROM knowledge_card_drafts d WHERE d.user_id = $2 AND d.status = 'pending')
          + jsonb_array_length($7::jsonb) <= $10
        AND (SELECT COUNT(*) FROM user_knowledge_items i WHERE i.user_id = $2)
          + jsonb_array_length($7::jsonb) <= $11
        AND (SELECT COUNT(*) FROM knowledge_card_drafts d
             WHERE d.user_id = $2 AND d.created_at > NOW() - INTERVAL '1 hour')
          + jsonb_array_length($7::jsonb) <= $12
        AND ($6::text IS NULL OR (
          SELECT COUNT(*) FROM knowledge_card_drafts d
          JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
          WHERE d.user_id = $2 AND b.mcp_token_id = $6
            AND d.created_at > NOW() - INTERVAL '1 hour'
        ) + jsonb_array_length($7::jsonb) <= $13)
      ON CONFLICT (user_id, provider, request_id) DO NOTHING
      RETURNING id
    ), resolved_batch AS (
      SELECT id, TRUE AS created FROM inserted_batch
      UNION ALL
      SELECT b.id, FALSE AS created
      FROM knowledge_ingestion_batches b
      WHERE b.user_id = $2 AND b.provider = $3 AND b.request_id = $4
        AND NOT EXISTS (SELECT 1 FROM inserted_batch)
      LIMIT 1
    ), inserted_drafts AS (
      INSERT INTO knowledge_card_drafts
        (id, batch_id, user_id, client_card_id, title, summary, explanation, topic, tags, proposed_relations)
      SELECT d.id, rb.id, $2, d.client_card_id, d.title, d.summary, d.explanation, d.topic, d.tags, d.relations
      FROM resolved_batch rb
      CROSS JOIN jsonb_to_recordset($7::jsonb) AS d(
        id text, client_card_id text, title text, summary text, explanation text, topic text, tags jsonb, relations jsonb
      )
      WHERE rb.created
      RETURNING id
    )
    SELECT rb.id, rb.created,
      CASE WHEN rb.created THEN (SELECT COUNT(*)::int FROM inserted_drafts)
           ELSE (SELECT COUNT(*)::int FROM knowledge_card_drafts d WHERE d.batch_id = rb.id)
      END AS draft_count
    FROM resolved_batch rb;
    `,
      [
        batchId,
        userId,
        provider,
        requestId,
        conversationRef,
        sourceTokenId,
        JSON.stringify(cards),
        MAX_KNOWLEDGE_BATCHES_PER_USER,
        MAX_KNOWLEDGE_DRAFTS_PER_USER,
        MAX_PENDING_KNOWLEDGE_DRAFTS_PER_USER,
        MAX_KNOWLEDGE_ITEMS_PER_USER,
        MCP_DRAFTS_PER_USER_PER_HOUR,
        MCP_DRAFTS_PER_TOKEN_PER_HOUR,
      ]
    ),
  ]);
  const rows = resultSets[1] as Array<{ id: string; created: boolean; draft_count: number }>;
  const row = rows[0];
  if (!row) throw new Error('Unable to create the draft batch because its token or ingestion quota is unavailable.');
  return {
    batchId: row.id,
    created: Boolean(row.created),
    draftCount: Number(row.draft_count),
    reviewPath: `/knowledge-inbox/${encodeURIComponent(row.id)}`,
  };
}

export async function getKnowledgeDraftBatchesForUser(userId: string, includeCompleted = false): Promise<KnowledgeDraftBatch[]> {
  if (!process.env.DATABASE_URL) {
    return Array.from(memoryBatches.values())
      .filter((batch) => batch.user_id === userId && (includeCompleted || batch.status === 'pending' || batch.status === 'partial'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  await ensureKnowledgeIngestionSchema();
  const result = await pool.query<Record<string, unknown>>(
    `
    SELECT b.id, b.source_type, b.provider, b.scope, b.conversation_ref, b.status,
      COUNT(d.id)::int AS draft_count,
      COUNT(d.id) FILTER (WHERE d.status = 'pending')::int AS pending_count,
      COUNT(d.id) FILTER (WHERE d.status = 'approved')::int AS approved_count,
      b.created_at::text, b.updated_at::text, b.committed_at::text
    FROM knowledge_ingestion_batches b
    LEFT JOIN knowledge_card_drafts d ON d.batch_id = b.id AND d.user_id = b.user_id
    WHERE b.user_id = $1 AND ($2::boolean OR b.status IN ('pending', 'partial'))
    GROUP BY b.id
    ORDER BY b.created_at DESC
    LIMIT 100;
    `,
    [userId, includeCompleted]
  );
  return result.rows.map(mapBatchRow);
}

export async function getKnowledgeDraftBatchForUser(
  userId: string,
  batchId: string
): Promise<{ batch: KnowledgeDraftBatch; drafts: KnowledgeCardDraft[] } | null> {
  const batches = await getKnowledgeDraftBatchesForUser(userId, true);
  const batch = batches.find((candidate) => candidate.id === batchId);
  if (!batch) return null;
  if (!process.env.DATABASE_URL) return { batch, drafts: memoryDrafts.get(batchId) ?? [] };
  const result = await pool.query<Record<string, unknown>>(
    `SELECT id, batch_id, client_card_id, title, summary, explanation, topic, tags,
      proposed_relations, status, version, knowledge_item_id, created_at::text, updated_at::text
     FROM knowledge_card_drafts WHERE batch_id = $1 AND user_id = $2 ORDER BY created_at, id`,
    [batchId, userId]
  );
  return { batch, drafts: result.rows.map(mapDraftRow) };
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function extractBearerToken(rawTokenOrAuthorization: string | null): string | null {
  const value = rawTokenOrAuthorization?.trim();
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return (match?.[1] ?? value).trim() || null;
}

function consumeMemoryMcpRequestRate(scopeKey: string, limit: number, now: number): boolean {
  if (scopeKey.startsWith('credential:')) memoryMcpCredentialRateKeys.add(scopeKey);
  const current = memoryMcpRequestRates.get(scopeKey);
  if (!current || now - current.windowStartedAt >= 60_000) {
    memoryMcpRequestRates.set(scopeKey, { windowStartedAt: now, requestCount: 1 });
    return true;
  }
  if (current.requestCount >= limit) return false;
  current.requestCount += 1;
  return true;
}

function cleanupExpiredMemoryMcpCredentialRates(currentScopeKey: string, now: number): number {
  // Inspect a rotating, bounded slice so cleanup cost stays constant even if a
  // development or test process has seen many OAuth clients. Re-adding live
  // keys moves them to the back and lets later calls make forward progress.
  const keysToInspect: string[] = [];
  for (const key of memoryMcpCredentialRateKeys) {
    keysToInspect.push(key);
    if (keysToInspect.length >= MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE) break;
  }

  let deleted = 0;
  for (const key of keysToInspect) {
    memoryMcpCredentialRateKeys.delete(key);
    const record = memoryMcpRequestRates.get(key);
    if (!record) continue;
    if (key !== currentScopeKey
      && now - record.windowStartedAt >= MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS) {
      memoryMcpRequestRates.delete(key);
      deleted += 1;
      continue;
    }
    memoryMcpCredentialRateKeys.add(key);
  }
  return deleted;
}

export function getMemoryMcpCredentialRateLimitRecordCountForTesting(): number {
  return memoryMcpCredentialRateKeys.size;
}

/**
 * Applies the same request ceilings used by Girapphe personal access tokens to
 * a validated Clerk OAuth user/client pair. The returned identifier is a
 * one-way fingerprint, so neither the OAuth access token nor the Clerk client
 * ID is persisted in MCP protocol state or rate-limit keys.
 */
export async function rateLimitMcpOAuthPrincipal(userId: string, clientId: string): Promise<string> {
  // CIMD clients may use an HTTPS metadata URL as the OAuth client ID. Keep a
  // hard bound, but allow realistic URL-shaped IDs before hashing them.
  if (!userId || userId.startsWith('guest_') || !clientId || clientId.length > 4096) {
    throw new Error('A valid Clerk OAuth principal is required.');
  }

  const credentialId = `oauth_${hashToken(`${userId}\0${clientId}`)}`;
  if (!process.env.DATABASE_URL) {
    const now = Date.now();
    cleanupExpiredMemoryMcpCredentialRates(`credential:${credentialId}`, now);
    const credentialAllowed = consumeMemoryMcpRequestRate(
      `credential:${credentialId}`,
      MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
      now
    );
    const userAllowed = consumeMemoryMcpRequestRate(
      `user:${userId}`,
      MCP_REQUESTS_PER_USER_PER_MINUTE,
      now
    );
    if (!credentialAllowed || !userAllowed) throw new McpRequestRateLimitError();
    return credentialId;
  }

  await ensureKnowledgeIngestionSchema();
  const result = await pool.query<{ rate_allowed: boolean }>(
    `WITH stale_credentials AS MATERIALIZED (
       SELECT scope_key
       FROM mcp_request_rate_limits
       WHERE scope_key LIKE 'credential:%'
         AND scope_key <> 'credential:' || $1
         AND updated_at <= NOW() - ($5::double precision * INTERVAL '1 millisecond')
       ORDER BY updated_at, scope_key
       LIMIT $6::integer
       FOR UPDATE SKIP LOCKED
     ), cleaned_credentials AS (
       DELETE FROM mcp_request_rate_limits rate
       USING stale_credentials stale
       WHERE rate.scope_key = stale.scope_key
       RETURNING rate.scope_key
     ), credential_rate AS (
       INSERT INTO mcp_request_rate_limits (scope_key, window_started_at, request_count, updated_at)
       VALUES ('credential:' || $1, NOW(), 1, NOW())
       ON CONFLICT (scope_key) DO UPDATE SET
         window_started_at = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
           ELSE mcp_request_rate_limits.window_started_at END,
         request_count = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
           ELSE mcp_request_rate_limits.request_count + 1 END,
         updated_at = NOW()
       WHERE mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute'
          OR mcp_request_rate_limits.request_count < $3
       RETURNING scope_key
     ), user_rate AS (
       INSERT INTO mcp_request_rate_limits (scope_key, window_started_at, request_count, updated_at)
       VALUES ('user:' || $2, NOW(), 1, NOW())
       ON CONFLICT (scope_key) DO UPDATE SET
         window_started_at = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
           ELSE mcp_request_rate_limits.window_started_at END,
         request_count = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
           ELSE mcp_request_rate_limits.request_count + 1 END,
         updated_at = NOW()
       WHERE mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute'
          OR mcp_request_rate_limits.request_count < $4
       RETURNING scope_key
     )
     SELECT (EXISTS (SELECT 1 FROM credential_rate)
       AND EXISTS (SELECT 1 FROM user_rate)) AS rate_allowed`,
    [
      credentialId,
      userId,
      MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
      MCP_REQUESTS_PER_USER_PER_MINUTE,
      MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS,
      MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE,
    ]
  );
  if (!result.rows[0]?.rate_allowed) throw new McpRequestRateLimitError();
  return credentialId;
}

export async function authenticateMcpAccessToken(
  rawTokenOrAuthorization: string | null,
  requiredScope: typeof MCP_DRAFT_CREATE_SCOPE = MCP_DRAFT_CREATE_SCOPE
): Promise<AuthenticatedMcpToken | null> {
  if (requiredScope !== MCP_DRAFT_CREATE_SCOPE) return null;
  const rawToken = extractBearerToken(rawTokenOrAuthorization);
  if (!rawToken || rawToken.length > 256) return null;
  const tokenHash = hashToken(rawToken);

  if (!process.env.DATABASE_URL) {
    const token = Array.from(memoryTokens.values()).find((candidate) => candidate.token_hash === tokenHash);
    if (!token || token.revoked_at || new Date(token.expires_at).getTime() <= Date.now() || token.user_id.startsWith('guest_')) return null;
    const left = Buffer.from(token.token_hash, 'hex');
    const right = Buffer.from(tokenHash, 'hex');
    if (left.length !== right.length || !timingSafeEqual(left, right) || !token.scopes.includes(requiredScope)) return null;
    const now = Date.now();
    const tokenAllowed = consumeMemoryMcpRequestRate(`token:${token.id}`, MCP_REQUESTS_PER_TOKEN_PER_MINUTE, now);
    const userAllowed = consumeMemoryMcpRequestRate(`user:${token.user_id}`, MCP_REQUESTS_PER_USER_PER_MINUTE, now);
    if (!tokenAllowed || !userAllowed) throw new McpRequestRateLimitError();
    token.last_used_at = new Date(now).toISOString();
    return { userId: token.user_id, tokenId: token.id, scopes: token.scopes };
  }

  const result = await pool.query<{
    id: string;
    user_id: string;
    token_hash: string;
    scopes: unknown;
    rate_allowed: boolean;
  }>(
    `WITH authenticated AS MATERIALIZED (
       UPDATE mcp_access_tokens
       SET last_used_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
         AND user_id NOT LIKE 'guest\\_%' ESCAPE '\\'
         AND scopes @> $2::jsonb
       RETURNING id, user_id, token_hash, scopes
     ), token_rate AS (
       INSERT INTO mcp_request_rate_limits (scope_key, window_started_at, request_count, updated_at)
       SELECT 'token:' || id, NOW(), 1, NOW() FROM authenticated
       ON CONFLICT (scope_key) DO UPDATE SET
         window_started_at = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
           ELSE mcp_request_rate_limits.window_started_at END,
         request_count = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
           ELSE mcp_request_rate_limits.request_count + 1 END,
         updated_at = NOW()
       WHERE mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute'
          OR mcp_request_rate_limits.request_count < $3
       RETURNING scope_key
     ), user_rate AS (
       INSERT INTO mcp_request_rate_limits (scope_key, window_started_at, request_count, updated_at)
       SELECT 'user:' || user_id, NOW(), 1, NOW() FROM authenticated
       ON CONFLICT (scope_key) DO UPDATE SET
         window_started_at = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
           ELSE mcp_request_rate_limits.window_started_at END,
         request_count = CASE
           WHEN mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
           ELSE mcp_request_rate_limits.request_count + 1 END,
         updated_at = NOW()
       WHERE mcp_request_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute'
          OR mcp_request_rate_limits.request_count < $4
       RETURNING scope_key
     )
     SELECT a.id, a.user_id, a.token_hash, a.scopes,
       (EXISTS (SELECT 1 FROM token_rate) AND EXISTS (SELECT 1 FROM user_rate)) AS rate_allowed
     FROM authenticated a`,
    [
      tokenHash,
      JSON.stringify([requiredScope]),
      MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
      MCP_REQUESTS_PER_USER_PER_MINUTE,
    ]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (!row.rate_allowed) throw new McpRequestRateLimitError();
  const left = Buffer.from(row.token_hash, 'hex');
  const right = Buffer.from(tokenHash, 'hex');
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const scopes = Array.isArray(row.scopes) ? row.scopes.filter((scope): scope is string => typeof scope === 'string') : [];
  return { userId: row.user_id, tokenId: row.id, scopes };
}

export const verifyMcpAccessToken = authenticateMcpAccessToken;

export async function createMcpAccessTokenForUser(userId: string, labelInput: string): Promise<{ token: string; record: McpAccessToken }> {
  if (!userId || userId.startsWith('guest_')) throw new Error('A signed-in user is required.');
  const rawToken = `girapphe_mcp_${randomBytes(32).toString('base64url')}`;
  const now = new Date();
  const record: McpAccessToken = {
    id: randomUUID(),
    label: sanitizeKnowledgeTitle(labelInput || 'MCP client') || 'MCP client',
    scopes: [MCP_DRAFT_CREATE_SCOPE],
    last_four: rawToken.slice(-4),
    created_at: now.toISOString(),
    last_used_at: null,
    expires_at: new Date(now.getTime() + 90 * 86_400_000).toISOString(),
    revoked_at: null,
  };
  const tokenHash = hashToken(rawToken);
  if (!process.env.DATABASE_URL) {
    const userTokens = Array.from(memoryTokens.values()).filter((token) => token.user_id === userId);
    const activeTokens = userTokens.filter((token) => !token.revoked_at && new Date(token.expires_at).getTime() > now.getTime());
    const createdInLastDay = userTokens.filter((token) => now.getTime() - new Date(token.created_at).getTime() < 86_400_000);
    if (activeTokens.length >= MCP_ACTIVE_TOKEN_LIMIT
      || createdInLastDay.length >= MCP_TOKEN_CREATION_LIMIT_PER_DAY
      || userTokens.length >= MCP_TOTAL_TOKEN_RECORD_LIMIT) {
      throw new Error('MCP token quota exceeded. Revoke an active token or try again later.');
    }
    memoryTokens.set(record.id, { ...record, user_id: userId, token_hash: tokenHash });
    return { token: rawToken, record };
  }
  await ensureKnowledgeIngestionSchema();
  const sql = getTransactionSql();
  const resultSets = await sql.transaction((tx) => [
    tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mcp-token:${userId}`]),
    tx.query(
      `INSERT INTO mcp_access_tokens (id, user_id, token_hash, last_four, label, scopes, expires_at)
     SELECT $1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz
     WHERE (SELECT COUNT(*) FROM mcp_access_tokens t
            WHERE t.user_id = $2 AND t.revoked_at IS NULL AND t.expires_at > NOW()) < $8
       AND (SELECT COUNT(*) FROM mcp_access_tokens t
            WHERE t.user_id = $2 AND t.created_at > NOW() - INTERVAL '1 day') < $9
       AND (SELECT COUNT(*) FROM mcp_access_tokens t WHERE t.user_id = $2) < $10
     RETURNING id`,
      [
        record.id,
        userId,
        tokenHash,
        record.last_four,
        record.label,
        JSON.stringify(record.scopes),
        record.expires_at,
        MCP_ACTIVE_TOKEN_LIMIT,
        MCP_TOKEN_CREATION_LIMIT_PER_DAY,
        MCP_TOTAL_TOKEN_RECORD_LIMIT,
      ]
    ),
  ]);
  const insertedRows = resultSets[1] as Array<{ id: string }>;
  if (!insertedRows[0]) throw new Error('MCP token quota exceeded. Revoke an active token or try again later.');
  return { token: rawToken, record };
}

export async function getMcpAccessTokensForUser(userId: string): Promise<McpAccessToken[]> {
  if (!process.env.DATABASE_URL) {
    return Array.from(memoryTokens.values())
      .filter((token) => token.user_id === userId)
      .map((token) => ({
        id: token.id,
        label: token.label,
        scopes: token.scopes,
        last_four: token.last_four,
        created_at: token.created_at,
        last_used_at: token.last_used_at,
        expires_at: token.expires_at,
        revoked_at: token.revoked_at,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  await ensureKnowledgeIngestionSchema();
  const result = await pool.query<Record<string, unknown>>(
    `SELECT id, label, scopes, last_four, created_at::text, last_used_at::text, expires_at::text, revoked_at::text
     FROM mcp_access_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    scopes: Array.isArray(row.scopes) ? row.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
    last_four: String(row.last_four),
    created_at: new Date(String(row.created_at)).toISOString(),
    last_used_at: row.last_used_at ? new Date(String(row.last_used_at)).toISOString() : null,
    expires_at: new Date(String(row.expires_at)).toISOString(),
    revoked_at: row.revoked_at ? new Date(String(row.revoked_at)).toISOString() : null,
  }));
}

export async function revokeMcpAccessTokenForUser(userId: string, tokenId: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    const token = memoryTokens.get(tokenId);
    if (token?.user_id === userId) token.revoked_at = new Date().toISOString();
    return;
  }
  await ensureKnowledgeIngestionSchema();
  await pool.query('UPDATE mcp_access_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL', [tokenId, userId]);
}

export function getMemoryKnowledgeItemsForUser(userId: string): MemoryKnowledgeItem[] {
  return memoryKnowledgeItems.get(userId) ?? [];
}

export function hasMemoryCreateRequest(userId: string, requestId: string): boolean {
  if (!requestId) return false;
  const seen = memoryCreateRequests.get(userId) ?? new Set<string>();
  if (seen.has(requestId)) return true;
  seen.add(requestId);
  memoryCreateRequests.set(userId, seen);
  return false;
}

export function createMemoryKnowledgeItemForUser(
  userId: string,
  input: { id?: string; graphNodeId?: string; title: string; summary?: string; content: string; topic: string; tags?: string[]; origin?: 'manual' | 'conversation' },
  options: { syncGraph?: boolean } = {}
): MemoryKnowledgeItem {
  const now = new Date().toISOString();
  const item: MemoryKnowledgeItem = {
    id: input.id ?? randomUUID(),
    user_id: userId,
    title: sanitizeKnowledgeTitle(input.title),
    summary: sanitizeKnowledgeContent(input.summary ?? '', 500),
    content: sanitizeKnowledgeContent(input.content),
    topic: normalizeKnowledgeTopic(input.topic),
    tags: sanitizeKnowledgeTags(input.tags),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    purge_at: null,
  };
  memoryKnowledgeItems.set(userId, [item, ...(memoryKnowledgeItems.get(userId) ?? [])]);
  if (options.syncGraph !== false) {
    ensureMemoryPrivateNode(userId, item, input.origin ?? 'manual', input.graphNodeId);
  }
  return item;
}

export function updateMemoryKnowledgeItemForUser(
  userId: string,
  itemId: string,
  input: { title: string; summary?: string; content: string; topic: string; tags?: string[] },
  options: { syncGraph?: boolean } = {}
): void {
  const now = new Date().toISOString();
  const items = (memoryKnowledgeItems.get(userId) ?? []).map((item) => item.id === itemId && !item.deleted_at
    ? { ...item, title: input.title, summary: input.summary ?? item.summary, content: input.content, topic: input.topic, tags: input.tags ? sanitizeKnowledgeTags(input.tags) : item.tags, updated_at: now }
    : item);
  memoryKnowledgeItems.set(userId, items);
  if (options.syncGraph === false) return;
  const nodes = (memoryNodes.get(userId) ?? []).map((node) => node.knowledge_item_id === itemId
    ? { ...node, label: input.title, summary: input.summary ?? node.summary, explanation: input.content, topic: input.topic, tags: input.tags ? sanitizeKnowledgeTags(input.tags) : node.tags }
    : node);
  memoryNodes.set(userId, nodes);
}

export function softDeleteMemoryKnowledgeItemForUser(
  userId: string,
  itemId: string,
  retentionDays: number,
  options: { syncGraph?: boolean } = {}
): void {
  const now = new Date().toISOString();
  const purgeAt = new Date(Date.now() + retentionDays * 86_400_000).toISOString();
  memoryKnowledgeItems.set(userId, (memoryKnowledgeItems.get(userId) ?? []).map((item) => item.id === itemId
    ? { ...item, deleted_at: now, purge_at: purgeAt, updated_at: now }
    : item));
  if (options.syncGraph === false) return;
  const deletedNodes = (memoryNodes.get(userId) ?? []).filter((node) => node.knowledge_item_id === itemId);
  memoryTrashedNodes.set(userId, [...deletedNodes, ...(memoryTrashedNodes.get(userId) ?? []).filter((node) => node.knowledge_item_id !== itemId)]);
  memoryNodes.set(userId, (memoryNodes.get(userId) ?? []).filter((node) => node.knowledge_item_id !== itemId));
  const deletedEdges: PrivateKnowledgeEdge[] = [];
  memoryEdges.set(userId, (memoryEdges.get(userId) ?? []).filter((edge) => {
    const shouldDelete = edge.source === `personal:${itemId}` || edge.target === `personal:${itemId}`;
    if (shouldDelete) deletedEdges.push(edge);
    return !shouldDelete;
  }));
  memoryTrashedEdges.set(userId, [...deletedEdges, ...(memoryTrashedEdges.get(userId) ?? []).filter((edge) => !deletedEdges.some((deleted) => deleted.id === edge.id))]);
}

export function restoreMemoryKnowledgeItemForUser(
  userId: string,
  itemId: string,
  options: { syncGraph?: boolean } = {}
): void {
  const now = new Date().toISOString();
  let restored: MemoryKnowledgeItem | null = null;
  memoryKnowledgeItems.set(userId, (memoryKnowledgeItems.get(userId) ?? []).map((item) => {
    if (item.id !== itemId || !item.deleted_at || (item.purge_at && new Date(item.purge_at).getTime() <= Date.now())) return item;
    restored = { ...item, deleted_at: null, purge_at: null, updated_at: now };
    return restored;
  }));
  if (restored && options.syncGraph !== false) {
    const trashedNode = (memoryTrashedNodes.get(userId) ?? []).find((node) => node.knowledge_item_id === itemId);
    if (trashedNode) {
      memoryNodes.set(userId, [trashedNode, ...(memoryNodes.get(userId) ?? []).filter((node) => node.graph_node_id !== trashedNode.graph_node_id)]);
      memoryTrashedNodes.set(userId, (memoryTrashedNodes.get(userId) ?? []).filter((node) => node.graph_node_id !== trashedNode.graph_node_id));
    } else {
      ensureMemoryPrivateNode(userId, restored, 'manual');
    }
    const activeItemIds = new Set((memoryKnowledgeItems.get(userId) ?? []).filter((item) => !item.deleted_at).map((item) => item.id));
    const restorable = (memoryTrashedEdges.get(userId) ?? []).filter((edge) => {
      const endpoints = [edge.source, edge.target].filter((endpoint) => endpoint.startsWith('personal:')).map((endpoint) => endpoint.slice(9));
      return endpoints.includes(itemId) && endpoints.every((endpointItemId) => activeItemIds.has(endpointItemId));
    });
    memoryEdges.set(userId, [...(memoryEdges.get(userId) ?? []), ...restorable.filter((edge) => !(memoryEdges.get(userId) ?? []).some((active) => active.id === edge.id))]);
    memoryTrashedEdges.set(userId, (memoryTrashedEdges.get(userId) ?? []).filter((edge) => !restorable.some((restoredEdge) => restoredEdge.id === edge.id)));
  }
}

export function purgeMemoryKnowledgeItemsForUser(userId: string): void {
  const now = Date.now();
  memoryKnowledgeItems.set(userId, (memoryKnowledgeItems.get(userId) ?? []).filter(
    (item) => !item.purge_at || new Date(item.purge_at).getTime() > now
  ));
}

function ensureMemoryPrivateNode(
  userId: string,
  item: MemoryKnowledgeItem,
  origin: 'manual' | 'conversation',
  preferredNodeId?: string
): PrivateKnowledgeNode {
  const nodes = memoryNodes.get(userId) ?? [];
  const existing = nodes.find((node) => node.knowledge_item_id === item.id);
  if (existing) return existing;
  const node: PrivateKnowledgeNode = {
    id: `personal:${item.id}`,
    graph_node_id: preferredNodeId ?? randomUUID(),
    knowledge_item_id: item.id,
    label: item.title,
    summary: item.summary,
    explanation: item.content,
    topic: item.topic,
    tags: item.tags,
    origin,
    created_at: item.created_at,
  };
  memoryNodes.set(userId, [node, ...nodes]);
  return node;
}

function parsePresentationPrivateNodeId(value: string, userId: string): PrivateKnowledgeNode | null {
  if (!value.startsWith('personal:')) return null;
  const itemId = value.slice('personal:'.length);
  return (memoryNodes.get(userId) ?? []).find((node) => node.knowledge_item_id === itemId) ?? null;
}

type ResolvedEndpoint = {
  privateNodeId: string | null;
  publicNodeId: string | null;
  knowledgeItemId: string | null;
  key: string;
};

function normalizeSymmetricEndpoints(
  source: ResolvedEndpoint,
  target: ResolvedEndpoint,
  type: KnowledgeRelationType
): [ResolvedEndpoint, ResolvedEndpoint] {
  if ((type === 'related' || type === 'equivalent_to') && source.key.localeCompare(target.key) > 0) return [target, source];
  return [source, target];
}

async function resolveEndpointForUser(
  userId: string,
  identifier: string,
  options: { allowPublic: boolean; createPersonalNode: boolean }
): Promise<ResolvedEndpoint | null> {
  const parsed = parseEndpointIdentifier(identifier);
  if (!parsed || parsed.kind === 'draft') return null;

  if (!process.env.DATABASE_URL) {
    if (parsed.kind === 'public') {
      if (!options.allowPublic || !GRAPH_NODES.some((node) => node.id === parsed.id)) return null;
      return { privateNodeId: null, publicNodeId: parsed.id, knowledgeItemId: null, key: `public:${parsed.id}` };
    }
    let node: PrivateKnowledgeNode | undefined;
    if (parsed.kind === 'personal') {
      const item = (memoryKnowledgeItems.get(userId) ?? []).find((candidate) => candidate.id === parsed.id && !candidate.deleted_at);
      if (!item) return null;
      node = (memoryNodes.get(userId) ?? []).find((candidate) => candidate.knowledge_item_id === item.id);
      if (!node && options.createPersonalNode) node = ensureMemoryPrivateNode(userId, item, 'manual');
    } else {
      node = (memoryNodes.get(userId) ?? []).find((candidate) => candidate.graph_node_id === parsed.id);
    }
    return node ? { privateNodeId: node.graph_node_id, publicNodeId: null, knowledgeItemId: node.knowledge_item_id, key: `private:${node.graph_node_id}` } : null;
  }

  await ensureKnowledgeIngestionSchema();
  if (parsed.kind === 'public') {
    if (!options.allowPublic) return null;
    const result = await pool.query<{ id: string }>('SELECT id FROM graph_nodes WHERE id = $1 LIMIT 1', [parsed.id]);
    return result.rows[0] ? { privateNodeId: null, publicNodeId: parsed.id, knowledgeItemId: null, key: `public:${parsed.id}` } : null;
  }

  if (parsed.kind === 'personal') {
    if (options.createPersonalNode) {
      const nodeId = randomUUID();
      const result = await pool.query<{ id: string; knowledge_item_id: string }>(
        `INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
         SELECT $3, i.user_id, i.id, i.title, i.topic, 'manual'
         FROM user_knowledge_items i
         WHERE i.id = $1 AND i.user_id = $2 AND i.deleted_at IS NULL
         ON CONFLICT (user_id, knowledge_item_id) DO UPDATE SET
           label = EXCLUDED.label, topic = EXCLUDED.topic, updated_at = NOW(), deleted_at = NULL, purge_at = NULL
         RETURNING id, knowledge_item_id`,
        [parsed.id, userId, nodeId]
      );
      const row = result.rows[0];
      return row ? { privateNodeId: row.id, publicNodeId: null, knowledgeItemId: row.knowledge_item_id, key: `private:${row.id}` } : null;
    }
    const result = await pool.query<{ id: string; knowledge_item_id: string }>(
      `SELECT n.id, n.knowledge_item_id FROM user_graph_nodes n
       JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
       WHERE n.user_id = $1 AND n.knowledge_item_id = $2 AND n.deleted_at IS NULL AND i.deleted_at IS NULL LIMIT 1`,
      [userId, parsed.id]
    );
    const row = result.rows[0];
    return row ? { privateNodeId: row.id, publicNodeId: null, knowledgeItemId: row.knowledge_item_id, key: `private:${row.id}` } : null;
  }

  const result = await pool.query<{ id: string; knowledge_item_id: string }>(
    `SELECT n.id, n.knowledge_item_id FROM user_graph_nodes n
     JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
     WHERE n.id = $1 AND n.user_id = $2 AND n.deleted_at IS NULL AND i.deleted_at IS NULL LIMIT 1`,
    [parsed.id, userId]
  );
  const row = result.rows[0];
  return row ? { privateNodeId: row.id, publicNodeId: null, knowledgeItemId: row.knowledge_item_id, key: `private:${row.id}` } : null;
}

async function insertResolvedEdgeForUser(
  userId: string,
  rawSource: ResolvedEndpoint,
  rawTarget: ResolvedEndpoint,
  type: KnowledgeRelationType,
  weight: number,
  origin: 'manual' | 'conversation',
  sourceBatchId: string | null = null
): Promise<boolean> {
  const [source, target] = normalizeSymmetricEndpoints(rawSource, rawTarget, type);
  if (source.key === target.key) return false;

  if (!process.env.DATABASE_URL) {
    if (type === 'prerequisite' && memoryPrerequisitePathExists(userId, target.key, source.key)) return false;
    const edges = memoryEdges.get(userId) ?? [];
    if (edges.some((edge) => edge.type === type && presentationEndpointToKey(edge.source, userId) === source.key && presentationEndpointToKey(edge.target, userId) === target.key)) return false;
    const toPresentation = (endpoint: ResolvedEndpoint) => endpoint.privateNodeId
      ? `personal:${endpoint.knowledgeItemId}`
      : `graph_${endpoint.publicNodeId}`;
    edges.push({
      id: randomUUID(), source: toPresentation(source), target: toPresentation(target), type,
      weight, origin, created_at: new Date().toISOString(),
    });
    memoryEdges.set(userId, edges);
    return true;
  }

  const result = await pool.query<{ id: string }>(
    `
    WITH graph_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtext($14))
    )
    INSERT INTO user_graph_edges (
      id, user_id, source_private_node_id, source_public_node_id,
      target_private_node_id, target_public_node_id, type, weight, origin, source_batch_id
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10 FROM graph_lock
    WHERE
      ($3::text IS NULL OR EXISTS (SELECT 1 FROM user_graph_nodes n WHERE n.id = $3 AND n.user_id = $2 AND n.deleted_at IS NULL))
      AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = $4))
      AND ($5::text IS NULL OR EXISTS (SELECT 1 FROM user_graph_nodes n WHERE n.id = $5 AND n.user_id = $2 AND n.deleted_at IS NULL))
      AND ($6::text IS NULL OR EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = $6))
      AND ($11::text <> 'prerequisite' OR NOT EXISTS (
        WITH RECURSIVE all_edges(source_key, target_key) AS (
          SELECT 'public:' || e.source, 'public:' || e.target FROM graph_edges e WHERE e.type = 'prerequisite'
          UNION ALL
          SELECT COALESCE('private:' || e.source_private_node_id, 'public:' || e.source_public_node_id),
                 COALESCE('private:' || e.target_private_node_id, 'public:' || e.target_public_node_id)
          FROM user_graph_edges e WHERE e.user_id = $2 AND e.type = 'prerequisite' AND e.deleted_at IS NULL
        ), reach(node_key) AS (
          SELECT $12::text
          UNION
          SELECT e.target_key FROM all_edges e JOIN reach r ON e.source_key = r.node_key
        )
        SELECT 1 FROM reach WHERE node_key = $13
      ))
    ON CONFLICT DO NOTHING
    RETURNING id`,
    [
      randomUUID(), userId, source.privateNodeId, source.publicNodeId, target.privateNodeId, target.publicNodeId,
      type, Math.max(0.05, Math.min(1, weight)), origin, sourceBatchId, type, target.key, source.key,
      `knowledge-graph:${userId}`,
    ]
  );
  return result.rows.length > 0;
}

function presentationEndpointToKey(endpoint: string, userId: string): string | null {
  if (endpoint.startsWith('graph_')) return `public:${endpoint.slice(6)}`;
  const node = parsePresentationPrivateNodeId(endpoint, userId);
  return node ? `private:${node.graph_node_id}` : null;
}

function memoryPrerequisitePathExists(userId: string, fromKey: string, targetKey: string): boolean {
  const adjacency = new Map<string, string[]>();
  const add = (source: string, target: string) => adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
  for (const edge of GRAPH_EDGES) if (edge.type === 'prerequisite') add(`public:${edge.source}`, `public:${edge.target}`);
  for (const edge of memoryEdges.get(userId) ?? []) {
    if (edge.type !== 'prerequisite') continue;
    const source = presentationEndpointToKey(edge.source, userId);
    const target = presentationEndpointToKey(edge.target, userId);
    if (source && target) add(source, target);
  }
  const queue = [fromKey];
  const visited = new Set<string>();
  while (queue.length) {
    const key = queue.shift()!;
    if (key === targetKey) return true;
    if (visited.has(key)) continue;
    visited.add(key);
    queue.push(...(adjacency.get(key) ?? []));
  }
  return false;
}

export async function createPrivateKnowledgeEdgeForUser(
  userId: string,
  sourceIdentifier: string,
  targetIdentifier: string,
  relationType: KnowledgeRelationType,
  direction: 'outgoing' | 'incoming' = 'outgoing'
): Promise<{ created: boolean; reason?: 'invalid' | 'cycle_or_duplicate' }> {
  if (!isKnowledgeRelationType(relationType)) return { created: false, reason: 'invalid' };
  const source = await resolveEndpointForUser(userId, sourceIdentifier, { allowPublic: false, createPersonalNode: true });
  const target = await resolveEndpointForUser(userId, targetIdentifier, { allowPublic: true, createPersonalNode: true });
  if (!source?.privateNodeId || !target) return { created: false, reason: 'invalid' };
  const created = await insertResolvedEdgeForUser(
    userId,
    direction === 'incoming' ? target : source,
    direction === 'incoming' ? source : target,
    relationType,
    1,
    'manual'
  );
  return created ? { created: true } : { created: false, reason: 'cycle_or_duplicate' };
}

export async function deletePrivateKnowledgeEdgeForUser(userId: string, edgeId: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    memoryEdges.set(userId, (memoryEdges.get(userId) ?? []).filter((edge) => edge.id !== edgeId));
    return;
  }
  await ensureKnowledgeIngestionSchema();
  await pool.query('DELETE FROM user_graph_edges WHERE id = $1 AND user_id = $2', [edgeId, userId]);
}

export async function getPrivateKnowledgeGraphForUser(userId: string): Promise<PrivateKnowledgeGraph> {
  if (!process.env.DATABASE_URL) return { nodes: memoryNodes.get(userId) ?? [], edges: memoryEdges.get(userId) ?? [] };
  await ensureKnowledgeIngestionSchema();
  const [nodeResult, edgeResult] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `SELECT n.id AS graph_node_id, n.knowledge_item_id, n.label, i.summary, i.content AS explanation,
        n.topic, i.tags, n.origin, n.created_at::text
       FROM user_graph_nodes n JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
       WHERE n.user_id = $1 AND n.deleted_at IS NULL AND i.deleted_at IS NULL ORDER BY n.created_at DESC`,
      [userId]
    ),
    pool.query<Record<string, unknown>>(
      `SELECT e.id, e.source_private_node_id, e.source_public_node_id, e.target_private_node_id, e.target_public_node_id,
        sn.knowledge_item_id AS source_item_id, tn.knowledge_item_id AS target_item_id,
        e.type, e.weight, e.origin, e.created_at::text
       FROM user_graph_edges e
       LEFT JOIN user_graph_nodes sn ON sn.id = e.source_private_node_id AND sn.user_id = e.user_id AND sn.deleted_at IS NULL
       LEFT JOIN user_graph_nodes tn ON tn.id = e.target_private_node_id AND tn.user_id = e.user_id AND tn.deleted_at IS NULL
       WHERE e.user_id = $1 AND e.deleted_at IS NULL
         AND (e.source_private_node_id IS NULL OR sn.id IS NOT NULL)
         AND (e.target_private_node_id IS NULL OR tn.id IS NOT NULL)
       ORDER BY e.created_at`,
      [userId]
    ),
  ]);
  const nodes = nodeResult.rows.map<PrivateKnowledgeNode>((row) => ({
    id: `personal:${String(row.knowledge_item_id)}`,
    graph_node_id: String(row.graph_node_id),
    knowledge_item_id: String(row.knowledge_item_id),
    label: String(row.label),
    summary: String(row.summary ?? ''),
    explanation: String(row.explanation ?? ''),
    topic: String(row.topic),
    tags: sanitizeKnowledgeTags(row.tags),
    origin: row.origin as PrivateKnowledgeNode['origin'],
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
  const edges = edgeResult.rows.map<PrivateKnowledgeEdge>((row) => ({
    id: String(row.id),
    source: row.source_private_node_id ? `personal:${String(row.source_item_id)}` : `graph_${String(row.source_public_node_id)}`,
    target: row.target_private_node_id ? `personal:${String(row.target_item_id)}` : `graph_${String(row.target_public_node_id)}`,
    type: row.type as KnowledgeRelationType,
    weight: Number(row.weight),
    origin: row.origin as PrivateKnowledgeEdge['origin'],
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
  return { nodes, edges };
}

export async function getKnowledgeLinkTargetsForUser(userId: string, queryInput = ''): Promise<KnowledgeLinkTarget[]> {
  const query = sanitizeKnowledgeContent(queryInput, 80).toLocaleLowerCase();
  if (!process.env.DATABASE_URL) {
    const privateTargets = (memoryNodes.get(userId) ?? []).map<KnowledgeLinkTarget>((node) => ({
      id: node.id, label: node.label, scope: 'private', topic: node.topic,
    }));
    const publicTargets = GRAPH_NODES.map<KnowledgeLinkTarget>((node) => ({
      id: `graph_${node.id}`, label: node.label, scope: 'public', topic: node.domain,
    }));
    return [...privateTargets, ...publicTargets]
      .filter((target) => !query || target.id.toLocaleLowerCase().includes(query) || target.label.toLocaleLowerCase().includes(query) || target.topic.toLocaleLowerCase().includes(query))
      .slice(0, 2000);
  }
  await ensureKnowledgeIngestionSchema();
  const result = await pool.query<Record<string, unknown>>(
    `SELECT id, label, scope, topic FROM (
       SELECT 'personal:' || n.knowledge_item_id AS id, n.label, 'private'::text AS scope,
         n.topic, i.tags::text AS tags_text
       FROM user_graph_nodes n JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
       WHERE n.user_id = $1 AND n.deleted_at IS NULL AND i.deleted_at IS NULL
       UNION ALL
       SELECT 'graph_' || g.id AS id, g.label, 'public'::text AS scope, g.domain AS topic, ''::text AS tags_text
       FROM graph_nodes g
     ) targets
     WHERE $2 = '' OR lower(id) LIKE '%' || $2 || '%' OR lower(label) LIKE '%' || $2 || '%'
       OR lower(topic) LIKE '%' || $2 || '%' OR lower(tags_text) LIKE '%' || $2 || '%'
     ORDER BY CASE WHEN scope = 'private' THEN 0 ELSE 1 END, label
     LIMIT 2000`,
    [userId, query]
  );
  return result.rows.map((row) => ({ id: String(row.id), label: String(row.label), scope: row.scope as 'public' | 'private', topic: String(row.topic) }));
}

export async function updateKnowledgeDraftForUser(
  userId: string,
  draftId: string,
  input: {
    title: string;
    summary: string;
    explanation: string;
    topic: string;
    tags: string[];
    relations: ProposedKnowledgeRelation[];
    expectedVersion: number;
  }
): Promise<boolean> {
  const title = sanitizeKnowledgeTitle(input.title);
  if (!title) return false;
  const payload = {
    title,
    summary: sanitizeKnowledgeContent(input.summary, 500),
    explanation: sanitizeKnowledgeContent(input.explanation, 6000),
    topic: normalizeKnowledgeTopic(input.topic),
    tags: sanitizeKnowledgeTags(input.tags),
    relations: sanitizeProposedRelations(input.relations),
  };
  if (!process.env.DATABASE_URL) {
    for (const [batchId, drafts] of memoryDrafts.entries()) {
      const index = drafts.findIndex((draft) => draft.id === draftId && draft.status === 'pending');
      if (index < 0 || memoryBatches.get(batchId)?.user_id !== userId) continue;
      if (!Number.isInteger(input.expectedVersion) || input.expectedVersion <= 0 || drafts[index].version !== input.expectedVersion) return false;
      drafts[index] = { ...drafts[index], ...payload, version: drafts[index].version + 1, updated_at: new Date().toISOString() };
      return true;
    }
    return false;
  }
  await ensureKnowledgeIngestionSchema();
  const result = await pool.query<{ id: string }>(
    `UPDATE knowledge_card_drafts SET title = $3, summary = $4, explanation = $5, topic = $6,
       tags = $7::jsonb, proposed_relations = $8::jsonb, version = version + 1, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
       AND version = $9
     RETURNING id`,
    [draftId, userId, payload.title, payload.summary, payload.explanation, payload.topic,
      JSON.stringify(payload.tags), JSON.stringify(payload.relations), input.expectedVersion]
  );
  return result.rows.length > 0;
}

async function resolveDraftRelationTarget(
  userId: string,
  relation: ProposedKnowledgeRelation,
  allDrafts: KnowledgeCardDraft[],
  plannedNodes: Map<string, ResolvedEndpoint>
): Promise<ResolvedEndpoint | null> {
  if (relation.targetKind === 'public') {
    return resolveEndpointForUser(userId, `public:${relation.targetId.replace(/^graph_/, '')}`, { allowPublic: true, createPersonalNode: false });
  }
  if (relation.targetKind === 'private') {
    const asNode = await resolveEndpointForUser(userId, `private:${relation.targetId.replace(/^private:/, '')}`, { allowPublic: false, createPersonalNode: false });
    if (asNode) return asNode;
    return resolveEndpointForUser(userId, `personal:${relation.targetId.replace(/^personal:/, '')}`, { allowPublic: false, createPersonalNode: false });
  }
  const targetId = relation.targetId.replace(/^draft:/, '');
  const draft = allDrafts.find((candidate) => candidate.id === targetId || candidate.client_card_id === targetId);
  if (!draft) return null;
  const planned = plannedNodes.get(draft.id);
  if (planned) return planned;
  if (!draft.knowledge_item_id || draft.status !== 'approved') return null;
  return resolveEndpointForUser(userId, `personal:${draft.knowledge_item_id}`, { allowPublic: false, createPersonalNode: false });
}

export async function approveKnowledgeDraftsForUser(
  userId: string,
  batchId: string,
  selectedDraftIds: string[] | null,
  expectedVersions: Record<string, number>
): Promise<{ approved: number; skippedEdges: number }> {
  const loaded = await getKnowledgeDraftBatchForUser(userId, batchId);
  if (!loaded || loaded.batch.status === 'discarded') return { approved: 0, skippedEdges: 0 };
  const selectedSet = selectedDraftIds ? new Set(selectedDraftIds) : null;
  if (selectedSet) {
    const draftByReference = new Map<string, KnowledgeCardDraft>();
    for (const draft of loaded.drafts) {
      draftByReference.set(draft.id, draft);
      draftByReference.set(draft.client_card_id, draft);
    }

    // A relationship owned by an approved draft cannot be recreated after its
    // source leaves the pending queue. Require a dependency-closed selection
    // on the server as well as in the UI. This rejects incomplete direct calls
    // without silently approving a card the user did not select.
    for (const draftId of selectedSet) {
      const draft = draftByReference.get(draftId);
      if (!draft || draft.status !== 'pending') continue;
      for (const relation of draft.relations) {
        if (relation.targetKind !== 'draft') continue;
        const reference = relation.targetId.replace(/^draft:/, '');
        const dependency = draftByReference.get(reference);
        if (dependency?.status === 'pending' && !selectedSet.has(dependency.id)) {
          return { approved: 0, skippedEdges: 0 };
        }
      }
    }
  }
  const drafts = loaded.drafts.filter((draft) => draft.status === 'pending' && (!selectedSet || selectedSet.has(draft.id)));
  if (drafts.length === 0) return { approved: 0, skippedEdges: 0 };
  if (selectedSet && drafts.length !== selectedSet.size) return { approved: 0, skippedEdges: 0 };
  if (drafts.some((draft) => !Number.isInteger(expectedVersions[draft.id]) || expectedVersions[draft.id] !== draft.version)) {
    return { approved: 0, skippedEdges: 0 };
  }

  const planned = drafts.map((draft) => ({
    draft,
    expectedVersion: expectedVersions[draft.id],
    itemId: randomUUID(),
    nodeId: randomUUID(),
  }));
  const plannedNodes: Map<string, ResolvedEndpoint> = new Map(planned.map(({ draft, itemId, nodeId }) => [draft.id, {
    privateNodeId: nodeId,
    publicNodeId: null,
    knowledgeItemId: itemId,
    key: `private:${nodeId}`,
  } satisfies ResolvedEndpoint]));

  const candidates: Array<{ source: ResolvedEndpoint; target: ResolvedEndpoint; relation: ProposedKnowledgeRelation }> = [];
  let invalidRelations = 0;
  for (const plan of planned) {
    const current = plannedNodes.get(plan.draft.id)!;
    for (const relation of plan.draft.relations) {
      const other = await resolveDraftRelationTarget(userId, relation, loaded.drafts, plannedNodes);
      if (!other) {
        invalidRelations += 1;
        continue;
      }
      const source = relation.direction === 'incoming' ? other : current;
      const target = relation.direction === 'incoming' ? current : other;
      const [normalizedSource, normalizedTarget] = normalizeSymmetricEndpoints(source, target, relation.type);
      candidates.push({ source: normalizedSource, target: normalizedTarget, relation });
    }
  }

  if (!process.env.DATABASE_URL) {
    let approved = 0;
    let insertedEdges = 0;
    for (const plan of planned) {
      const item = createMemoryKnowledgeItemForUser(userId, {
        id: plan.itemId,
        graphNodeId: plan.nodeId,
        title: plan.draft.title,
        summary: plan.draft.summary,
        content: plan.draft.explanation || plan.draft.summary,
        topic: plan.draft.topic,
        tags: plan.draft.tags,
        origin: 'conversation',
      });
      const node = ensureMemoryPrivateNode(userId, item, 'conversation');
      const plannedEndpoint = plannedNodes.get(plan.draft.id)!;
      plannedEndpoint.privateNodeId = node.graph_node_id;
      plannedEndpoint.key = `private:${node.graph_node_id}`;
      const stored = memoryDrafts.get(batchId) ?? [];
      const index = stored.findIndex((draft) => draft.id === plan.draft.id && draft.status === 'pending');
      if (index >= 0) {
        stored[index] = { ...stored[index], status: 'approved', knowledge_item_id: item.id, updated_at: new Date().toISOString() };
        approved += 1;
      }
    }
    for (const candidate of candidates) {
      if (await insertResolvedEdgeForUser(userId, candidate.source, candidate.target, candidate.relation.type, candidate.relation.weight ?? 1, 'conversation', batchId)) insertedEdges += 1;
    }
    const batch = memoryBatches.get(batchId)!;
    const batchDrafts = memoryDrafts.get(batchId) ?? [];
    batch.pending_count = batchDrafts.filter((draft) => draft.status === 'pending').length;
    batch.approved_count = batchDrafts.filter((draft) => draft.status === 'approved').length;
    batch.status = batch.pending_count === 0 ? 'approved' : batch.approved_count > 0 ? 'partial' : 'pending';
    batch.updated_at = new Date().toISOString();
    batch.committed_at = batch.status === 'approved' ? batch.updated_at : null;
    return { approved, skippedEdges: invalidRelations + candidates.length - insertedEdges };
  }

  await ensureKnowledgeIngestionSchema();
  const sql = getTransactionSql();
  const edgeInsertSql = `
    INSERT INTO user_graph_edges (
      id, user_id, source_private_node_id, source_public_node_id,
      target_private_node_id, target_public_node_id, type, weight, origin, source_batch_id
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'conversation', $9
    WHERE
      ($3::text IS NULL OR EXISTS (SELECT 1 FROM user_graph_nodes n WHERE n.id = $3 AND n.user_id = $2 AND n.deleted_at IS NULL))
      AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = $4))
      AND ($5::text IS NULL OR EXISTS (SELECT 1 FROM user_graph_nodes n WHERE n.id = $5 AND n.user_id = $2 AND n.deleted_at IS NULL))
      AND ($6::text IS NULL OR EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = $6))
      AND ($7::text <> 'prerequisite' OR NOT EXISTS (
        WITH RECURSIVE all_edges(source_key, target_key) AS (
          SELECT 'public:' || e.source, 'public:' || e.target FROM graph_edges e WHERE e.type = 'prerequisite'
          UNION ALL
          SELECT COALESCE('private:' || e.source_private_node_id, 'public:' || e.source_public_node_id),
                 COALESCE('private:' || e.target_private_node_id, 'public:' || e.target_public_node_id)
          FROM user_graph_edges e WHERE e.user_id = $2 AND e.type = 'prerequisite' AND e.deleted_at IS NULL
        ), reach(node_key) AS (
          SELECT $10::text
          UNION
          SELECT e.target_key FROM all_edges e JOIN reach r ON e.source_key = r.node_key
        )
        SELECT 1 FROM reach WHERE node_key = $11
      ))
    ON CONFLICT DO NOTHING RETURNING id`;

  const resultSets = await sql.transaction((tx) => {
    const queries = [tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-graph:${userId}`])];
    queries.push(tx.query(
      `SELECT 1 / CASE WHEN (
         SELECT COUNT(*) FROM jsonb_to_recordset($1::jsonb) AS expected(id text, version int)
         JOIN knowledge_card_drafts d ON d.id = expected.id AND d.version = expected.version
           AND d.batch_id = $2 AND d.user_id = $3 AND d.status = 'pending'
       ) = $4 THEN 1 ELSE 0 END AS version_guard`,
      [JSON.stringify(planned.map((plan) => ({ id: plan.draft.id, version: plan.expectedVersion }))), batchId, userId, planned.length]
    ));
    for (const plan of planned) {
      queries.push(tx.query(
        `INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags)
         SELECT $1, $2, d.title, d.summary, CASE WHEN d.explanation <> '' THEN d.explanation ELSE d.summary END, d.topic, d.tags
         FROM knowledge_card_drafts d JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
         WHERE d.id = $3 AND d.batch_id = $4 AND d.user_id = $2 AND d.status = 'pending'
           AND d.version = $5 AND b.status <> 'discarded'
         ON CONFLICT DO NOTHING RETURNING id`,
        [plan.itemId, userId, plan.draft.id, batchId, plan.expectedVersion]
      ));
      queries.push(tx.query(
        `INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin, source_batch_id)
         SELECT $1, i.user_id, i.id, i.title, i.topic, 'conversation', $4
         FROM user_knowledge_items i WHERE i.id = $2 AND i.user_id = $3
         ON CONFLICT (user_id, knowledge_item_id) DO UPDATE SET label = EXCLUDED.label, topic = EXCLUDED.topic,
           updated_at = NOW(), deleted_at = NULL, purge_at = NULL
         RETURNING id`,
        [plan.nodeId, plan.itemId, userId, batchId]
      ));
      queries.push(tx.query(
        `INSERT INTO knowledge_card_sources
          (id, user_id, knowledge_item_id, batch_id, draft_id, source_type, provider, conversation_ref)
         SELECT $1, $2, $3, b.id, d.id, 'conversation', b.provider, b.conversation_ref
         FROM knowledge_card_drafts d JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
         WHERE d.id = $4 AND d.batch_id = $5 AND d.user_id = $2
           AND EXISTS (SELECT 1 FROM user_knowledge_items i WHERE i.id = $3 AND i.user_id = $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [randomUUID(), userId, plan.itemId, plan.draft.id, batchId]
      ));
    }
    for (const candidate of candidates) {
      queries.push(tx.query(edgeInsertSql, [
        randomUUID(), userId, candidate.source.privateNodeId, candidate.source.publicNodeId,
        candidate.target.privateNodeId, candidate.target.publicNodeId, candidate.relation.type,
        Math.max(0.05, Math.min(1, candidate.relation.weight ?? 1)), batchId, candidate.target.key, candidate.source.key,
      ]));
    }
    for (const plan of planned) {
      queries.push(tx.query(
        `UPDATE knowledge_card_drafts SET status = 'approved', knowledge_item_id = $1, approved_at = NOW(), updated_at = NOW()
         WHERE id = $2 AND batch_id = $3 AND user_id = $4 AND status = 'pending' AND version = $5
           AND EXISTS (SELECT 1 FROM user_knowledge_items i WHERE i.id = $1 AND i.user_id = $4)
         RETURNING id`,
        [plan.itemId, plan.draft.id, batchId, userId, plan.expectedVersion]
      ));
    }
    queries.push(tx.query(
      `UPDATE knowledge_ingestion_batches b SET
         status = CASE
           WHEN NOT EXISTS (SELECT 1 FROM knowledge_card_drafts d WHERE d.batch_id = b.id AND d.status = 'pending') THEN 'approved'
           WHEN EXISTS (SELECT 1 FROM knowledge_card_drafts d WHERE d.batch_id = b.id AND d.status = 'approved') THEN 'partial'
           ELSE 'pending' END,
         committed_at = CASE WHEN NOT EXISTS (SELECT 1 FROM knowledge_card_drafts d WHERE d.batch_id = b.id AND d.status = 'pending') THEN NOW() ELSE committed_at END,
         updated_at = NOW()
       WHERE b.id = $1 AND b.user_id = $2 RETURNING id`,
      [batchId, userId]
    ));
    return queries;
  }, { isolationLevel: 'Serializable' });

  const edgeStart = 2 + planned.length * 3;
  const edgeResults = resultSets.slice(edgeStart, edgeStart + candidates.length);
  const updateStart = edgeStart + candidates.length;
  const updateResults = resultSets.slice(updateStart, updateStart + planned.length);
  const resultRowCount = (rows: unknown) => Array.isArray(rows) ? rows.length : 0;
  const insertedEdges = edgeResults.reduce((sum, rows) => sum + resultRowCount(rows), 0);
  const approved = updateResults.reduce((sum, rows) => sum + resultRowCount(rows), 0);
  return { approved, skippedEdges: invalidRelations + candidates.length - insertedEdges };
}

export async function discardKnowledgeDraftBatchForUser(userId: string, batchId: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    const batch = memoryBatches.get(batchId);
    if (!batch || batch.user_id !== userId) return;
    batch.status = 'discarded';
    batch.updated_at = new Date().toISOString();
    for (const draft of memoryDrafts.get(batchId) ?? []) if (draft.status === 'pending') draft.status = 'rejected';
    batch.pending_count = 0;
    return;
  }
  await ensureKnowledgeIngestionSchema();
  await pool.query(
    `WITH discarded AS (
       UPDATE knowledge_ingestion_batches SET status = 'discarded', discarded_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'partial') RETURNING id
     )
     UPDATE knowledge_card_drafts SET status = 'rejected', updated_at = NOW()
     WHERE batch_id IN (SELECT id FROM discarded) AND user_id = $2 AND status = 'pending'`,
    [batchId, userId]
  );
}
