import 'server-only';

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { GRAPH_EDGES, GRAPH_NODES } from '@stem-brain/graph-engine';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import pool from '@/lib/db';
import {
  deriveMcpAccountAdvisoryLockKey,
  deriveMcpDeletedAccountScopeKey,
} from '@/lib/mcp-account-lifecycle';
import { canRunRuntimeSchemaBootstrap } from '@/lib/schema-bootstrap';
import { parseKnowledgeBundleFields, projectKnowledgeBundle } from '@/lib/knowledge-bundle-runtime';
import {
  normalizeKnowledgeEvidenceSourceReference,
  normalizeKnowledgeOpaqueReference,
  normalizeKnowledgeSourceUrl,
} from '@/lib/knowledge-source-url';

export const MCP_DRAFT_CREATE_SCOPE = 'knowledge:drafts:create' as const;
export const MCP_CONTEXT_READ_SCOPE = 'knowledge:context:read' as const;
export const MCP_ACCESS_SCOPES = [MCP_DRAFT_CREATE_SCOPE, MCP_CONTEXT_READ_SCOPE] as const;
export type McpAccessScope = (typeof MCP_ACCESS_SCOPES)[number];
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
export const MAX_KNOWLEDGE_REUSE_ITEMS = 100;
const ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL = `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
  SELECT scope_key, deleted_at
  FROM mcp_deleted_account_markers
  WHERE scope_key = $1`;
export const KNOWLEDGE_PROVIDERS = ['chatgpt', 'claude', 'gemini', 'other'] as const;
export const KNOWLEDGE_RELATION_TYPES = [
  'prerequisite',
  'related',
  'generalizes',
  'derived_from',
  'equivalent_to',
  'supersedes',
  'answers',
  'supports',
  'contradicts',
] as const;

export type KnowledgeProvider = (typeof KNOWLEDGE_PROVIDERS)[number];
export type KnowledgeRelationType = (typeof KNOWLEDGE_RELATION_TYPES)[number];
export type KnowledgeTargetKind = 'public' | 'private' | 'draft';
export type KnowledgeRelationOrigin = 'explicit_user' | 'extracted_from_source' | 'model_inferred';
export type KnowledgeDraftResolutionAction = 'create' | 'merge' | 'update' | 'ignore';
export type KnowledgeItemActivityType = 'confirmed' | 'connected' | 'verified' | 'reused' | 'revised' | 'superseded' | 'archived' | 'restored';

export type KnowledgeEvidenceSelector = {
  selectorType: 'message' | 'text_position' | 'line_range' | 'external_ref';
  sourceRef?: string;
  messageRef?: string;
  start?: number;
  end?: number;
  lineStart?: number;
  lineEnd?: number;
  polarity: 'supports' | 'contradicts';
  quality: 'unknown' | 'low' | 'medium' | 'high';
  relationOrigin: KnowledgeRelationOrigin;
};

export type ProposedKnowledgeRelation = {
  targetKind: KnowledgeTargetKind;
  targetId: string;
  type: KnowledgeRelationType;
  direction?: 'outgoing' | 'incoming';
  weight?: number;
  relationOrigin?: KnowledgeRelationOrigin;
};

export type CreateKnowledgeDraftCardInput = {
  clientCardId?: string;
  title: string;
  summary?: string;
  explanation?: string;
  topic?: string;
  tags?: string[];
  relations?: ProposedKnowledgeRelation[];
  knowledgeType?: KnowledgeBundleType;
  centralQuestion?: string;
  structuredContent?: KnowledgeBundleContent;
  bundleSchemaVersion?: 1;
  proposedEvidence?: KnowledgeEvidenceSelector[];
};

export type CreateKnowledgeDraftBatchInput = {
  provider: KnowledgeProvider;
  requestId: string;
  conversationRef?: string;
  sourceUrl?: string;
  discussedAt?: string;
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
  source_url: string | null;
  discussed_at: string | null;
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
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  dedupe_key: string;
  proposed_evidence: KnowledgeEvidenceSelector[];
  resolution_action: KnowledgeDraftResolutionAction | null;
  target_knowledge_item_id: string | null;
  resolved_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  version: number;
  knowledge_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeDuplicateSuggestion = {
  id: string;
  title: string;
  summary: string;
  topic: string;
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  version: number;
  match: 'exact' | 'similar';
  score: number;
};

export type KnowledgeResolutionTarget = {
  id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  version: number;
};

export type KnowledgeDraftResolutionContext = {
  draft: KnowledgeCardDraft;
  target: KnowledgeResolutionTarget | null;
  duplicateSuggestions: KnowledgeDuplicateSuggestion[];
};

export type ReviewedKnowledgePayload = {
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  knowledgeType: KnowledgeBundleType | null;
  centralQuestion: string | null;
  structuredContent: KnowledgeBundleContent | null;
  bundleSchemaVersion: number | null;
  observedAt?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  reviewAt?: string | null;
  evidenceSelectors?: KnowledgeEvidenceSelector[];
};

export type ResolveKnowledgeDraftInput = {
  batchId: string;
  draftId: string;
  expectedDraftVersion: number;
  action: KnowledgeDraftResolutionAction;
  targetKnowledgeItemId?: string;
  expectedTargetVersion?: number;
  reviewed?: ReviewedKnowledgePayload;
};

export type ResolveKnowledgeDraftResult = {
  resolved: boolean;
  action: KnowledgeDraftResolutionAction;
  knowledgeItemId: string | null;
  version: number | null;
  stale?: boolean;
};

export type KnowledgeItemUpdateResult =
  | { updated: true; version: number }
  | { updated: false; version: null; stale: true }
  | { updated: false; version: null; notFound: true };

export type PrivateKnowledgeNode = {
  id: string;
  graph_node_id: string;
  knowledge_item_id: string;
  label: string;
  summary: string;
  explanation: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  version: number;
  dedupe_key: string;
  observed_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  last_verified_at: string | null;
  review_at: string | null;
  archived_at: string | null;
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
  relation_origin: KnowledgeRelationOrigin;
  confirmed_at: string | null;
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
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  version: number;
  dedupe_key: string;
  observed_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  last_verified_at: string | null;
  review_at: string | null;
  archived_at: string | null;
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
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  dedupe_key: string;
  proposed_evidence: KnowledgeEvidenceSelector[];
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
const memoryItemRevisions = new Map<string, Map<string, MemoryKnowledgeItem[]>>();
const memoryItemActivity = new Map<string, Array<{ id: string; knowledge_item_id: string; activity_type: KnowledgeItemActivityType; metadata: Record<string, unknown>; created_at: string }>>();
const memoryItemSupersessions = new Map<string, Array<{ id: string; superseded_item_id: string; superseding_item_id: string; reason: string; created_at: string }>>();
const memoryEvidenceSelectors = new Map<string, Array<{ id: string; knowledge_item_id: string; source_id: string; selector: KnowledgeEvidenceSelector; created_at: string }>>();
const memoryKnowledgeSources = new Map<string, Array<{
  id: string;
  knowledge_item_id: string;
  source_type: string;
  provider: string;
  conversation_ref: string | null;
  source_url: string | null;
  source_locator: Record<string, unknown> | null;
  discussed_at: string | null;
  relation_origin: KnowledgeRelationOrigin;
  confirmed_at: string;
  created_at: string;
}>>();

export function getMemoryPrivateKnowledgeEdgesForTesting(userId: string): PrivateKnowledgeEdge[] {
  return (memoryEdges.get(userId) ?? []).map((edge) => ({ ...edge }));
}

function cloneMemoryItem(item: MemoryKnowledgeItem): MemoryKnowledgeItem {
  return JSON.parse(JSON.stringify(item)) as MemoryKnowledgeItem;
}

function recordMemoryRevision(userId: string, item: MemoryKnowledgeItem) {
  const byItem = memoryItemRevisions.get(userId) ?? new Map<string, MemoryKnowledgeItem[]>();
  const revisions = byItem.get(item.id) ?? [];
  if (!revisions.some((revision) => revision.version === item.version)) revisions.push(cloneMemoryItem(item));
  revisions.sort((left, right) => left.version - right.version);
  byItem.set(item.id, revisions);
  memoryItemRevisions.set(userId, byItem);
}

function recordMemoryActivity(
  userId: string,
  knowledgeItemId: string,
  activityType: KnowledgeItemActivityType,
  metadata: Record<string, unknown> = {},
) {
  const entries = memoryItemActivity.get(userId) ?? [];
  entries.push({ id: randomUUID(), knowledge_item_id: knowledgeItemId, activity_type: activityType, metadata, created_at: new Date().toISOString() });
  memoryItemActivity.set(userId, entries);
}

export function getMemoryKnowledgeRevisionsForUser(userId: string, itemIds?: Set<string>) {
  return Array.from(memoryItemRevisions.get(userId)?.entries() ?? [])
    .filter(([itemId]) => !itemIds || itemIds.has(itemId))
    .flatMap(([knowledge_item_id, revisions]) => revisions.map((snapshot) => ({
      id: `${knowledge_item_id}:${snapshot.version}`,
      knowledge_item_id,
      version: snapshot.version,
      snapshot,
      change_reason: snapshot.version === 1 ? 'confirmed' : 'revised',
      created_at: snapshot.updated_at,
    })));
}

export function getMemoryKnowledgeActivityForUser(userId: string, itemIds?: Set<string>) {
  return (memoryItemActivity.get(userId) ?? []).filter((entry) => !itemIds || itemIds.has(entry.knowledge_item_id));
}

export function getMemoryKnowledgeSupersessionsForUser(userId: string, itemIds?: Set<string>) {
  return (memoryItemSupersessions.get(userId) ?? []).filter((entry) => !itemIds
    || itemIds.has(entry.superseded_item_id) || itemIds.has(entry.superseding_item_id));
}

export function getMemoryKnowledgeEvidenceForUser(userId: string, itemIds?: Set<string>) {
  return (memoryEvidenceSelectors.get(userId) ?? []).filter((entry) => !itemIds || itemIds.has(entry.knowledge_item_id));
}

export function getMemoryKnowledgeSourcesForUser(userId: string, itemIds?: Set<string>) {
  return (memoryKnowledgeSources.get(userId) ?? []).filter((entry) => !itemIds || itemIds.has(entry.knowledge_item_id));
}

export class McpRequestRateLimitError extends Error {
  constructor() {
    super('MCP request rate limit exceeded.');
    this.name = 'McpRequestRateLimitError';
  }
}

export class McpDeletedAccountError extends Error {
  constructor() {
    super('MCP account is unavailable.');
    this.name = 'McpDeletedAccountError';
  }
}

let ingestionSchemaPromise: Promise<void> | null = null;
let transactionSql: ReturnType<typeof neon> | null = null;

export function setKnowledgeTransactionSqlForTesting(value: ReturnType<typeof neon> | null): void {
  transactionSql = value;
}

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

function dedupeText(input: string): string {
  return input.normalize('NFKC').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildKnowledgeDedupeKey(input: {
  title: string;
  topic: string;
  knowledgeType?: KnowledgeBundleType | null;
  centralQuestion?: string | null;
}): string {
  const canonical = [
    input.knowledgeType ?? 'unclassified',
    normalizeKnowledgeTopic(input.topic),
    dedupeText(input.centralQuestion || input.title),
  ].join('\u0000');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function sanitizeSourceUrl(value: unknown): string | null {
  return normalizeKnowledgeSourceUrl(value);
}

function sanitizeOpaqueReference(value: unknown, maxLength = 240): string | null {
  return normalizeKnowledgeOpaqueReference(value, maxLength);
}

function sanitizeEvidenceSourceReference(value: unknown): string | null {
  return normalizeKnowledgeEvidenceSourceReference(value);
}

function sanitizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function sanitizeKnowledgeEvidenceSelectors(input: unknown): KnowledgeEvidenceSelector[] {
  if (!Array.isArray(input)) return [];
  const forbiddenKeys = new Set(['transcript', 'history', 'messages', 'excerpt', 'quote', 'text', 'content', 'raw', 'raw_text', 'raw_content']);
  const allowedKeys = new Set([
    'selectorType', 'selector_type', 'sourceRef', 'source_ref', 'messageRef', 'message_ref',
    'start', 'end', 'lineStart', 'line_start', 'lineEnd', 'line_end',
    'polarity', 'quality', 'relationOrigin', 'relation_origin',
  ]);
  const result: KnowledgeEvidenceSelector[] = [];
  for (const candidate of input.slice(0, 24)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const value = candidate as Record<string, unknown>;
    const keys = Object.keys(value);
    if (keys.some((key) => forbiddenKeys.has(key.toLocaleLowerCase()) || !allowedKeys.has(key))) continue;
    const selectorType = String(value.selectorType ?? value.selector_type ?? '');
    const sourceRefInput = value.sourceRef ?? value.source_ref;
    const messageRefInput = value.messageRef ?? value.message_ref;
    const sourceRef = sanitizeEvidenceSourceReference(sourceRefInput) ?? undefined;
    const messageRef = sanitizeOpaqueReference(messageRefInput) ?? undefined;
    if (sourceRefInput !== undefined && sourceRefInput !== null && String(sourceRefInput).trim() && !sourceRef) continue;
    if (messageRefInput !== undefined && messageRefInput !== null && String(messageRefInput).trim() && !messageRef) continue;
    const start = Number(value.start);
    const end = Number(value.end);
    const lineStart = Number(value.lineStart ?? value.line_start);
    const lineEnd = Number(value.lineEnd ?? value.line_end);
    const polarity = String(value.polarity ?? 'supports');
    const quality = String(value.quality ?? 'unknown');
    const relationOrigin = String(value.relationOrigin ?? value.relation_origin ?? 'model_inferred');
    if (!['message', 'text_position', 'line_range', 'external_ref'].includes(selectorType)
      || !['supports', 'contradicts'].includes(polarity)
      || !['unknown', 'low', 'medium', 'high'].includes(quality)
      || !['explicit_user', 'extracted_from_source', 'model_inferred'].includes(relationOrigin)) continue;
    const selector: KnowledgeEvidenceSelector = {
      selectorType: selectorType as KnowledgeEvidenceSelector['selectorType'],
      polarity: polarity as KnowledgeEvidenceSelector['polarity'],
      quality: quality as KnowledgeEvidenceSelector['quality'],
      relationOrigin: relationOrigin as KnowledgeRelationOrigin,
      ...(sourceRef ? { sourceRef } : {}),
      ...(messageRef ? { messageRef } : {}),
    };
    if (selectorType === 'message' && !messageRef) continue;
    if (selectorType === 'external_ref' && !sourceRef) continue;
    if (selectorType === 'text_position') {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > 10_000_000) continue;
      selector.start = start;
      selector.end = end;
    }
    if (selectorType === 'line_range') {
      if (!Number.isSafeInteger(lineStart) || !Number.isSafeInteger(lineEnd) || lineStart < 1 || lineEnd < lineStart || lineEnd > 1_000_000) continue;
      selector.lineStart = lineStart;
      selector.lineEnd = lineEnd;
    }
    result.push(selector);
  }
  return result;
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
    const originValue = String(record.relationOrigin ?? record.relation_origin ?? 'model_inferred');
    const relationOrigin: KnowledgeRelationOrigin = originValue === 'explicit_user' || originValue === 'extracted_from_source'
      ? originValue
      : 'model_inferred';
    const numericWeight = Number(record.weight ?? 1);
    if (!['public', 'private', 'draft'].includes(targetKind) || !targetId || !isKnowledgeRelationType(type)
      || !Number.isFinite(numericWeight) || numericWeight <= 0 || numericWeight > 1) continue;
    result.push({
      targetKind: targetKind as KnowledgeTargetKind,
      targetId,
      type,
      direction,
      weight: numericWeight,
      relationOrigin,
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
    const bundle = card.knowledgeType || card.centralQuestion || card.structuredContent || card.bundleSchemaVersion
      ? parseKnowledgeBundleFields({
          knowledge_type: card.knowledgeType,
          central_question: card.centralQuestion,
          structured_content: card.structuredContent,
          bundle_schema_version: card.bundleSchemaVersion,
        })
      : null;
    if ((card.knowledgeType || card.centralQuestion || card.structuredContent || card.bundleSchemaVersion) && !bundle) {
      throw new Error(`Card ${index + 1} has an invalid structured knowledge bundle.`);
    }
    const preferredSummary = sanitizeKnowledgeContent(String(card.summary ?? ''), 500);
    const projected = bundle
      ? projectKnowledgeBundle(bundle, preferredSummary)
      : { summary: preferredSummary, content: sanitizeKnowledgeContent(String(card.explanation ?? ''), 6000) };
    return {
      id: randomUUID(),
      client_card_id: clientCardId,
      title,
      summary: sanitizeKnowledgeContent(projected.summary, 500),
      explanation: sanitizeKnowledgeContent(projected.content || String(card.explanation ?? ''), 6000),
      topic: normalizeKnowledgeTopic(String(card.topic ?? '')),
      tags: sanitizeKnowledgeTags(card.tags),
      relations: sanitizeProposedRelations(card.relations),
      knowledge_type: bundle?.knowledge_type ?? null,
      central_question: bundle?.central_question ?? null,
      structured_content: bundle?.structured_content ?? null,
      bundle_schema_version: bundle?.bundle_schema_version ?? null,
      dedupe_key: buildKnowledgeDedupeKey({
        title,
        topic: String(card.topic ?? ''),
        knowledgeType: bundle?.knowledge_type,
        centralQuestion: bundle?.central_question,
      }),
      proposed_evidence: sanitizeKnowledgeEvidenceSelectors(card.proposedEvidence),
    };
  });
}

export async function ensureKnowledgeIngestionSchema(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  // Deployed requests use checked-in schema updates applied by CI.
  // MCP bearer authentication itself never calls this function, so invalid
  // token traffic cannot amplify DDL round trips on a cold Worker isolate.
  if (!canRunRuntimeSchemaBootstrap()) return;
  if (!ingestionSchemaPromise) {
    ingestionSchemaPromise = (async () => {
      await pool.query(`ALTER TABLE user_knowledge_items
        ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS knowledge_type TEXT,
        ADD COLUMN IF NOT EXISTS central_question TEXT,
        ADD COLUMN IF NOT EXISTS structured_content JSONB,
        ADD COLUMN IF NOT EXISTS bundle_schema_version INTEGER,
        ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
        ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS review_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_knowledge_items_id_user_id
        ON user_knowledge_items(id, user_id)`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_ingestion_batches (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'conversation',
          provider TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'current_conversation', request_id TEXT NOT NULL,
          conversation_ref TEXT, source_url TEXT, discussed_at TIMESTAMPTZ, mcp_token_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(),
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
          proposed_relations JSONB NOT NULL DEFAULT '[]'::jsonb, knowledge_type TEXT, central_question TEXT,
          structured_content JSONB, bundle_schema_version INTEGER, dedupe_key TEXT, resolution_action TEXT,
          target_knowledge_item_id TEXT REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
          resolved_at TIMESTAMPTZ, proposed_evidence JSONB,
          status TEXT NOT NULL DEFAULT 'pending', version INTEGER NOT NULL DEFAULT 1,
          knowledge_item_id TEXT REFERENCES user_knowledge_items(id) ON DELETE SET NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(), approved_at TIMESTAMPTZ, UNIQUE(batch_id, client_card_id),
          CONSTRAINT knowledge_card_drafts_target_owner_fk
            FOREIGN KEY (target_knowledge_item_id, user_id)
            REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
          CHECK (status IN ('pending', 'approved', 'rejected')), CHECK (version >= 1),
          CONSTRAINT knowledge_card_drafts_dedupe_key_check
            CHECK (dedupe_key IS NULL OR char_length(dedupe_key) BETWEEN 1 AND 128),
          CONSTRAINT knowledge_card_drafts_resolution_action_check
            CHECK (resolution_action IS NULL OR resolution_action IN ('create', 'merge', 'update', 'ignore')),
          CONSTRAINT knowledge_card_drafts_resolution_target_check CHECK (
            resolution_action IS NULL OR (
              resolved_at IS NOT NULL AND (
                (resolution_action IN ('create', 'ignore') AND target_knowledge_item_id IS NULL)
                OR (resolution_action IN ('merge', 'update') AND target_knowledge_item_id IS NOT NULL)
              )
            )
          ),
          CONSTRAINT knowledge_card_drafts_proposed_evidence_check CHECK (
            proposed_evidence IS NULL OR (
              jsonb_typeof(proposed_evidence) = 'array'
              AND jsonb_array_length(proposed_evidence) <= 32
              AND octet_length(proposed_evidence::text) <= 32768
              AND proposed_evidence::text
                !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
            )
          )
        );
      `);
      await pool.query(`ALTER TABLE knowledge_card_drafts
        ADD COLUMN IF NOT EXISTS knowledge_type TEXT,
        ADD COLUMN IF NOT EXISTS central_question TEXT,
        ADD COLUMN IF NOT EXISTS structured_content JSONB,
        ADD COLUMN IF NOT EXISTS bundle_schema_version INTEGER,
        ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
        ADD COLUMN IF NOT EXISTS resolution_action TEXT,
        ADD COLUMN IF NOT EXISTS target_knowledge_item_id TEXT REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS proposed_evidence JSONB`);
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
          relation_origin TEXT DEFAULT 'explicit_user', confirmed_at TIMESTAMPTZ,
          source_batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(), deleted_at TIMESTAMPTZ, purge_at TIMESTAMPTZ,
          CHECK (num_nonnulls(source_private_node_id, source_public_node_id) = 1),
          CHECK (num_nonnulls(target_private_node_id, target_public_node_id) = 1),
          CHECK ((source_private_node_id IS NULL OR source_private_node_id IS DISTINCT FROM target_private_node_id)
            AND (source_public_node_id IS NULL OR source_public_node_id IS DISTINCT FROM target_public_node_id)),
          CONSTRAINT user_graph_edges_type_check CHECK (
            type IN (
              'prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to',
              'supersedes', 'answers', 'supports', 'contradicts'
            )
          ),
          CHECK (origin IN ('manual', 'conversation')),
          CONSTRAINT user_graph_edges_relation_origin_check
            CHECK (relation_origin IN ('explicit_user', 'extracted_from_source', 'model_inferred')),
          CHECK (weight > 0 AND weight <= 1)
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_card_sources (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, knowledge_item_id TEXT NOT NULL REFERENCES user_knowledge_items(id) ON DELETE CASCADE,
          batch_id TEXT REFERENCES knowledge_ingestion_batches(id) ON DELETE SET NULL,
          draft_id TEXT REFERENCES knowledge_card_drafts(id) ON DELETE SET NULL,
          source_type TEXT NOT NULL DEFAULT 'conversation', provider TEXT NOT NULL, conversation_ref TEXT,
          source_url TEXT, source_locator JSONB, discussed_at TIMESTAMPTZ,
          relation_origin TEXT DEFAULT 'extracted_from_source', confirmed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(knowledge_item_id, draft_id),
          CONSTRAINT knowledge_card_sources_item_owner_fk
            FOREIGN KEY (knowledge_item_id, user_id) REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
          CONSTRAINT knowledge_card_sources_source_url_check
            CHECK (source_url IS NULL OR char_length(source_url) BETWEEN 1 AND 4096),
          CONSTRAINT knowledge_card_sources_locator_check
            CHECK (source_locator IS NULL OR jsonb_typeof(source_locator) = 'object'),
          CONSTRAINT knowledge_card_sources_relation_origin_check
            CHECK (relation_origin IN ('explicit_user', 'extracted_from_source', 'model_inferred'))
        );
      `);
      await pool.query(`ALTER TABLE knowledge_ingestion_batches
        ADD COLUMN IF NOT EXISTS mcp_token_id TEXT,
        ADD COLUMN IF NOT EXISTS source_url TEXT,
        ADD COLUMN IF NOT EXISTS discussed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE user_graph_edges
        ADD COLUMN IF NOT EXISTS relation_origin TEXT,
        ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE knowledge_card_sources
        ADD COLUMN IF NOT EXISTS source_url TEXT,
        ADD COLUMN IF NOT EXISTS source_locator JSONB,
        ADD COLUMN IF NOT EXISTS discussed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS relation_origin TEXT,
        ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
      await pool.query(`ALTER TABLE user_graph_edges
        ALTER COLUMN relation_origin SET DEFAULT 'explicit_user'`);
      await pool.query(`ALTER TABLE knowledge_card_sources
        ALTER COLUMN relation_origin SET DEFAULT 'extracted_from_source'`);
      await pool.query(`ALTER TABLE user_knowledge_items
        DROP CONSTRAINT IF EXISTS user_knowledge_items_version_check,
        DROP CONSTRAINT IF EXISTS user_knowledge_items_dedupe_key_check,
        DROP CONSTRAINT IF EXISTS user_knowledge_items_valid_range_check,
        DROP CONSTRAINT IF EXISTS user_knowledge_items_bundle_shape_check`);
      await pool.query(`ALTER TABLE user_knowledge_items
        ADD CONSTRAINT user_knowledge_items_version_check CHECK (version >= 1) NOT VALID,
        ADD CONSTRAINT user_knowledge_items_dedupe_key_check
          CHECK (dedupe_key IS NULL OR char_length(dedupe_key) BETWEEN 1 AND 128) NOT VALID,
        ADD CONSTRAINT user_knowledge_items_valid_range_check
          CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from) NOT VALID,
        ADD CONSTRAINT user_knowledge_items_bundle_shape_check CHECK (COALESCE(
          (knowledge_type IS NULL AND central_question IS NULL
            AND structured_content IS NULL AND bundle_schema_version IS NULL)
          OR (
            knowledge_type IN (
              'concept', 'procedure', 'comparison', 'mechanism', 'structure',
              'claim_evidence', 'question', 'decision', 'event'
            )
            AND central_question IS NOT NULL AND btrim(central_question) <> ''
            AND jsonb_typeof(structured_content) = 'object'
            AND structured_content ->> 'type' = knowledge_type
            AND bundle_schema_version = 1
          ),
          FALSE
        )) NOT VALID`);
      await pool.query(`ALTER TABLE knowledge_ingestion_batches
        DROP CONSTRAINT IF EXISTS knowledge_ingestion_batches_source_url_check,
        DROP CONSTRAINT IF EXISTS knowledge_ingestion_batches_conversation_ref_check`);
      await pool.query(`ALTER TABLE knowledge_ingestion_batches
        ADD CONSTRAINT knowledge_ingestion_batches_source_url_check
          CHECK (source_url IS NULL OR (
            char_length(source_url) BETWEEN 1 AND 2048
            AND source_url ~ '^https://[^/?#[:space:]]+'
            AND source_url !~ '^https://[^/?#]*@'
            AND position('?' in source_url) = 0
            AND position('#' in source_url) = 0
          )) NOT VALID,
        ADD CONSTRAINT knowledge_ingestion_batches_conversation_ref_check
          CHECK (conversation_ref IS NULL OR (
            char_length(conversation_ref) BETWEEN 1 AND 240
            AND conversation_ref !~* '^[a-z][a-z0-9+.-]*://'
          )) NOT VALID`);
      await pool.query(`ALTER TABLE knowledge_card_drafts
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_target_knowledge_item_id_fkey,
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_target_owner_fk`);
      await pool.query(`ALTER TABLE knowledge_card_drafts
        ADD CONSTRAINT knowledge_card_drafts_target_knowledge_item_id_fkey
          FOREIGN KEY (target_knowledge_item_id)
          REFERENCES user_knowledge_items(id) ON DELETE CASCADE NOT VALID,
        ADD CONSTRAINT knowledge_card_drafts_target_owner_fk
          FOREIGN KEY (target_knowledge_item_id, user_id)
          REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE NOT VALID`);
      await pool.query(`ALTER TABLE knowledge_card_drafts
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_dedupe_key_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_resolution_action_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_resolution_target_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_proposed_evidence_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_drafts_bundle_shape_check`);
      await pool.query(`ALTER TABLE knowledge_card_drafts
        ADD CONSTRAINT knowledge_card_drafts_dedupe_key_check
          CHECK (dedupe_key IS NULL OR char_length(dedupe_key) BETWEEN 1 AND 128) NOT VALID,
        ADD CONSTRAINT knowledge_card_drafts_resolution_action_check
          CHECK (resolution_action IS NULL OR resolution_action IN ('create', 'merge', 'update', 'ignore')) NOT VALID,
        ADD CONSTRAINT knowledge_card_drafts_resolution_target_check CHECK (
          resolution_action IS NULL OR (
            resolved_at IS NOT NULL AND (
              (resolution_action IN ('create', 'ignore') AND target_knowledge_item_id IS NULL)
              OR (resolution_action IN ('merge', 'update') AND target_knowledge_item_id IS NOT NULL)
            )
          )
        ) NOT VALID,
        ADD CONSTRAINT knowledge_card_drafts_proposed_evidence_check CHECK (
          proposed_evidence IS NULL OR (
            jsonb_typeof(proposed_evidence) = 'array'
            AND jsonb_array_length(proposed_evidence) <= 32
            AND octet_length(proposed_evidence::text) <= 32768
            AND proposed_evidence::text
              !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
            AND proposed_evidence::text
              !~* '"(sourceRef|source_ref)"[[:space:]]*:[[:space:]]*"([^" ]*[?#]|https://[^"/?#]*@)'
          )
        ) NOT VALID,
        ADD CONSTRAINT knowledge_card_drafts_bundle_shape_check CHECK (COALESCE(
          (knowledge_type IS NULL AND central_question IS NULL
            AND structured_content IS NULL AND bundle_schema_version IS NULL)
          OR (
            knowledge_type IN (
              'concept', 'procedure', 'comparison', 'mechanism', 'structure',
              'claim_evidence', 'question', 'decision', 'event'
            )
            AND central_question IS NOT NULL AND btrim(central_question) <> ''
            AND jsonb_typeof(structured_content) = 'object'
            AND structured_content ->> 'type' = knowledge_type
            AND bundle_schema_version = 1
          ),
          FALSE
        )) NOT VALID`);
      await pool.query(`ALTER TABLE user_graph_edges
        DROP CONSTRAINT IF EXISTS user_graph_edges_type_check,
        DROP CONSTRAINT IF EXISTS user_graph_edges_relation_origin_check`);
      await pool.query(`ALTER TABLE user_graph_edges
        ADD CONSTRAINT user_graph_edges_type_check CHECK (
          type IN (
            'prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to',
            'supersedes', 'answers', 'supports', 'contradicts'
          )
        ) NOT VALID,
        ADD CONSTRAINT user_graph_edges_relation_origin_check
          CHECK (relation_origin IN ('explicit_user', 'extracted_from_source', 'model_inferred')) NOT VALID`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_card_sources_id_user_item
        ON knowledge_card_sources(id, user_id, knowledge_item_id)`);
      await pool.query(`ALTER TABLE knowledge_card_sources
        DROP CONSTRAINT IF EXISTS knowledge_card_sources_item_owner_fk,
        DROP CONSTRAINT IF EXISTS knowledge_card_sources_source_url_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_sources_conversation_ref_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_sources_locator_check,
        DROP CONSTRAINT IF EXISTS knowledge_card_sources_relation_origin_check`);
      await pool.query(`ALTER TABLE knowledge_card_sources
        ADD CONSTRAINT knowledge_card_sources_item_owner_fk
          FOREIGN KEY (knowledge_item_id, user_id)
          REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE NOT VALID,
        ADD CONSTRAINT knowledge_card_sources_source_url_check
          CHECK (source_url IS NULL OR (
            char_length(source_url) BETWEEN 1 AND 2048
            AND source_url ~ '^https://[^/?#[:space:]]+'
            AND source_url !~ '^https://[^/?#]*@'
            AND position('?' in source_url) = 0
            AND position('#' in source_url) = 0
          )) NOT VALID,
        ADD CONSTRAINT knowledge_card_sources_conversation_ref_check
          CHECK (conversation_ref IS NULL OR (
            char_length(conversation_ref) BETWEEN 1 AND 240
            AND conversation_ref !~* '^[a-z][a-z0-9+.-]*://'
          )) NOT VALID,
        ADD CONSTRAINT knowledge_card_sources_locator_check
          CHECK (source_locator IS NULL OR jsonb_typeof(source_locator) = 'object') NOT VALID,
        ADD CONSTRAINT knowledge_card_sources_relation_origin_check
          CHECK (relation_origin IN ('explicit_user', 'extracted_from_source', 'model_inferred')) NOT VALID`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_item_revisions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, knowledge_item_id TEXT NOT NULL,
          version INTEGER NOT NULL, snapshot JSONB NOT NULL, change_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT knowledge_item_revisions_item_owner_fk
            FOREIGN KEY (knowledge_item_id, user_id)
            REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
          CONSTRAINT knowledge_item_revisions_item_version_key UNIQUE(knowledge_item_id, version),
          CONSTRAINT knowledge_item_revisions_version_check CHECK (version >= 1),
          CONSTRAINT knowledge_item_revisions_snapshot_check CHECK (jsonb_typeof(snapshot) = 'object')
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_item_activity (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, knowledge_item_id TEXT NOT NULL,
          activity_type TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT knowledge_item_activity_item_owner_fk
            FOREIGN KEY (knowledge_item_id, user_id)
            REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
          CONSTRAINT knowledge_item_activity_type_check CHECK (
            activity_type IN (
              'confirmed', 'connected', 'verified', 'reused',
              'revised', 'superseded', 'archived', 'restored'
            )
          ),
          CONSTRAINT knowledge_item_activity_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_item_supersessions (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, superseded_item_id TEXT NOT NULL,
          replacement_item_id TEXT NOT NULL, reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT knowledge_item_supersessions_old_owner_fk
            FOREIGN KEY (superseded_item_id, user_id)
            REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
          CONSTRAINT knowledge_item_supersessions_new_owner_fk
            FOREIGN KEY (replacement_item_id, user_id)
            REFERENCES user_knowledge_items(id, user_id) ON DELETE CASCADE,
          CONSTRAINT knowledge_item_supersessions_old_key
            UNIQUE(user_id, superseded_item_id),
          CONSTRAINT knowledge_item_supersessions_distinct_check
            CHECK (superseded_item_id <> replacement_item_id)
        );
      `);
      await pool.query(`ALTER TABLE knowledge_item_supersessions
        DROP CONSTRAINT IF EXISTS knowledge_item_supersessions_pair_key,
        DROP CONSTRAINT IF EXISTS knowledge_item_supersessions_old_key`);
      await pool.query(`ALTER TABLE knowledge_item_supersessions
        ADD CONSTRAINT knowledge_item_supersessions_old_key
          UNIQUE(user_id, superseded_item_id)`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS knowledge_evidence_spans (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, knowledge_item_id TEXT NOT NULL,
          source_id TEXT NOT NULL, selector_type TEXT NOT NULL, selector JSONB NOT NULL,
          polarity TEXT NOT NULL DEFAULT 'supports', quality TEXT NOT NULL DEFAULT 'unknown',
          relation_origin TEXT NOT NULL DEFAULT 'extracted_from_source', confirmed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT knowledge_evidence_spans_source_owner_item_fk
            FOREIGN KEY (source_id, user_id, knowledge_item_id)
            REFERENCES knowledge_card_sources(id, user_id, knowledge_item_id) ON DELETE CASCADE,
          CONSTRAINT knowledge_evidence_spans_selector_type_check
            CHECK (selector_type IN ('message', 'text_position', 'line_range', 'external_ref')),
          CONSTRAINT knowledge_evidence_spans_selector_check CHECK (
            jsonb_typeof(selector) = 'object'
            AND octet_length(selector::text) <= 4096
            AND selector::text
              !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
            AND (
              selector_type <> 'external_ref'
              OR (
                selector ? 'source_ref'
                AND jsonb_typeof(selector -> 'source_ref') = 'string'
                AND char_length(selector ->> 'source_ref') BETWEEN 1 AND 2048
                AND position('?' in (selector ->> 'source_ref')) = 0
                AND position('#' in (selector ->> 'source_ref')) = 0
                AND (
                  (selector ->> 'source_ref') !~* '^[a-z][a-z0-9+.-]*://'
                  OR (
                    (selector ->> 'source_ref') ~ '^https://[^/?#[:space:]]+'
                    AND (selector ->> 'source_ref') !~ '^https://[^/?#]*@'
                  )
                )
              )
            )
          ),
          CONSTRAINT knowledge_evidence_spans_polarity_check
            CHECK (polarity IN ('supports', 'contradicts')),
          CONSTRAINT knowledge_evidence_spans_quality_check
            CHECK (quality IN ('unknown', 'low', 'medium', 'high')),
          CONSTRAINT knowledge_evidence_spans_relation_origin_check
            CHECK (relation_origin IN ('explicit_user', 'extracted_from_source', 'model_inferred'))
        );
      `);
      await pool.query(`ALTER TABLE knowledge_evidence_spans
        DROP CONSTRAINT IF EXISTS knowledge_evidence_spans_selector_check`);
      await pool.query(`ALTER TABLE knowledge_evidence_spans
        ADD CONSTRAINT knowledge_evidence_spans_selector_check CHECK (
          jsonb_typeof(selector) = 'object'
          AND octet_length(selector::text) <= 4096
          AND selector::text
            !~* '"(excerpt|transcript|raw_text|raw_transcript|content|text|exact|quote|prefix|suffix)"[[:space:]]*:'
          AND (
            selector_type <> 'external_ref'
            OR (
              selector ? 'source_ref'
              AND jsonb_typeof(selector -> 'source_ref') = 'string'
              AND char_length(selector ->> 'source_ref') BETWEEN 1 AND 2048
              AND position('?' in (selector ->> 'source_ref')) = 0
              AND position('#' in (selector ->> 'source_ref')) = 0
              AND (
                (selector ->> 'source_ref') !~* '^[a-z][a-z0-9+.-]*://'
                OR (
                  (selector ->> 'source_ref') ~ '^https://[^/?#[:space:]]+'
                  AND (selector ->> 'source_ref') !~ '^https://[^/?#]*@'
                )
              )
            )
          )
        ) NOT VALID`);
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
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_deleted_account_markers (
          scope_key TEXT PRIMARY KEY,
          deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT mcp_deleted_account_markers_scope_key_check
            CHECK (scope_key ~ '^[0-9a-f]{64}$')
        );
      `);
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_user_dedupe
        ON knowledge_card_drafts(user_id, dedupe_key)
        WHERE status = 'pending' AND dedupe_key IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_drafts_target_item
        ON knowledge_card_drafts(user_id, target_knowledge_item_id)
        WHERE target_knowledge_item_id IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user_dedupe
        ON user_knowledge_items(user_id, dedupe_key)
        WHERE deleted_at IS NULL AND dedupe_key IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user_review
        ON user_knowledge_items(user_id, review_at)
        WHERE deleted_at IS NULL AND archived_at IS NULL AND review_at IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user_observed
        ON user_knowledge_items(user_id, observed_at)
        WHERE deleted_at IS NULL AND observed_at IS NOT NULL`);
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_card_sources_user_discussed
        ON knowledge_card_sources(user_id, discussed_at) WHERE discussed_at IS NOT NULL`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_item_revisions_user_item
        ON knowledge_item_revisions(user_id, knowledge_item_id, version)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_item_activity_user_item_created
        ON knowledge_item_activity(user_id, knowledge_item_id, created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_item_activity_user_type_created
        ON knowledge_item_activity(user_id, activity_type, created_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_item_supersessions_user_old
        ON knowledge_item_supersessions(user_id, superseded_item_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_item_supersessions_user_new
        ON knowledge_item_supersessions(user_id, replacement_item_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_spans_user_item
        ON knowledge_evidence_spans(user_id, knowledge_item_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_spans_user_source
        ON knowledge_evidence_spans(user_id, source_id)`);
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
  const bundle = parseKnowledgeBundleFields({
    knowledge_type: row.knowledge_type,
    central_question: row.central_question,
    structured_content: row.structured_content,
    bundle_schema_version: row.bundle_schema_version,
  });
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
    knowledge_type: bundle?.knowledge_type ?? null,
    central_question: bundle?.central_question ?? null,
    structured_content: bundle?.structured_content ?? null,
    bundle_schema_version: bundle?.bundle_schema_version ?? null,
    dedupe_key: typeof row.dedupe_key === 'string' && row.dedupe_key
      ? row.dedupe_key
      : buildKnowledgeDedupeKey({
          title: String(row.title),
          topic: String(row.topic ?? 'general'),
          knowledgeType: bundle?.knowledge_type,
          centralQuestion: bundle?.central_question,
        }),
    proposed_evidence: sanitizeKnowledgeEvidenceSelectors(row.proposed_evidence),
    resolution_action: row.resolution_action as KnowledgeDraftResolutionAction | null ?? null,
    target_knowledge_item_id: row.target_knowledge_item_id ? String(row.target_knowledge_item_id) : null,
    resolved_at: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
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
    conversation_ref: normalizeKnowledgeOpaqueReference(row.conversation_ref),
    source_url: normalizeKnowledgeSourceUrl(row.source_url),
    discussed_at: row.discussed_at ? new Date(String(row.discussed_at)).toISOString() : null,
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
  const conversationRef = sanitizeOpaqueReference(input.conversationRef);
  const sourceUrl = sanitizeSourceUrl(input.sourceUrl);
  const discussedAt = sanitizeTimestamp(input.discussedAt);
  if (input.conversationRef && !conversationRef) throw new Error('conversationRef must be a bounded opaque reference.');
  if (input.sourceUrl && !sourceUrl) throw new Error('sourceUrl must be a bounded HTTPS URL.');
  if (input.discussedAt && !discussedAt) throw new Error('discussedAt must be an ISO timestamp.');
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
      knowledge_type: card.knowledge_type,
      central_question: card.central_question,
      structured_content: card.structured_content,
      bundle_schema_version: card.bundle_schema_version,
      dedupe_key: card.dedupe_key,
      proposed_evidence: card.proposed_evidence,
      resolution_action: null,
      target_knowledge_item_id: null,
      resolved_at: null,
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
      source_url: sourceUrl,
      discussed_at: discussedAt,
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
  const deletedAccountScopeKey = deriveMcpDeletedAccountScopeKey(userId);
  const sql = getTransactionSql();
  const resultSets = await sql.transaction((tx) => [
    tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
    tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-ingestion:${userId}`]),
    tx.query(
    `
    WITH inserted_batch AS (
      INSERT INTO knowledge_ingestion_batches
        (id, user_id, source_type, provider, scope, request_id, conversation_ref, source_url, discussed_at, mcp_token_id)
      SELECT $1, $2, 'conversation', $3, 'current_conversation', $4, $5, $14, $15, $6
      WHERE NOT EXISTS (
          SELECT 1 FROM mcp_deleted_account_markers marker WHERE marker.scope_key = $16
        )
        AND ($6::text IS NULL OR EXISTS (
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
        (id, batch_id, user_id, client_card_id, title, summary, explanation, topic, tags, proposed_relations,
         knowledge_type, central_question, structured_content, bundle_schema_version, dedupe_key, proposed_evidence)
      SELECT d.id, rb.id, $2, d.client_card_id, d.title, d.summary, d.explanation, d.topic, d.tags, d.relations,
        d.knowledge_type, d.central_question, d.structured_content, d.bundle_schema_version, d.dedupe_key, d.proposed_evidence
      FROM resolved_batch rb
      CROSS JOIN jsonb_to_recordset($7::jsonb) AS d(
        id text, client_card_id text, title text, summary text, explanation text, topic text, tags jsonb, relations jsonb,
        knowledge_type text, central_question text, structured_content jsonb, bundle_schema_version int,
        dedupe_key text, proposed_evidence jsonb
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
        sourceUrl,
        discussedAt,
        deletedAccountScopeKey,
      ]
    ),
  ], { isolationLevel: 'ReadCommitted' });
  const rows = resultSets[2] as Array<{ id: string; created: boolean; draft_count: number }>;
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
    SELECT b.id, b.source_type, b.provider, b.scope, b.conversation_ref, b.source_url, b.discussed_at, b.status,
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
  if (!process.env.DATABASE_URL) {
    const batch = memoryBatches.get(batchId);
    if (!batch || batch.user_id !== userId) return null;
    return { batch: mapBatchRow(batch), drafts: memoryDrafts.get(batchId) ?? [] };
  }

  await ensureKnowledgeIngestionSchema();
  const batchResult = await pool.query<Record<string, unknown>>(
    `SELECT b.id, b.source_type, b.provider, b.scope, b.conversation_ref, b.source_url, b.discussed_at, b.status,
      COUNT(d.id)::int AS draft_count,
      COUNT(d.id) FILTER (WHERE d.status = 'pending')::int AS pending_count,
      COUNT(d.id) FILTER (WHERE d.status = 'approved')::int AS approved_count,
      b.created_at::text, b.updated_at::text, b.committed_at::text
     FROM knowledge_ingestion_batches b
     LEFT JOIN knowledge_card_drafts d ON d.batch_id = b.id AND d.user_id = b.user_id
     WHERE b.id = $1 AND b.user_id = $2
     GROUP BY b.id
     LIMIT 1`,
    [batchId, userId]
  );
  const batchRow = batchResult.rows[0];
  if (!batchRow) return null;

  const draftResult = await pool.query<Record<string, unknown>>(
    `SELECT id, batch_id, client_card_id, title, summary, explanation, topic, tags,
      proposed_relations, knowledge_type, central_question, structured_content, bundle_schema_version,
      dedupe_key, proposed_evidence, resolution_action, target_knowledge_item_id, resolved_at::text,
      status, version, knowledge_item_id, created_at::text, updated_at::text
     FROM knowledge_card_drafts WHERE batch_id = $1 AND user_id = $2 ORDER BY created_at, id`,
    [batchId, userId]
  );
  return { batch: mapBatchRow(batchRow), drafts: draftResult.rows.map(mapDraftRow) };
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
  const deletedAccountScopeKey = deriveMcpDeletedAccountScopeKey(userId);
  const resultSets = await pool.transaction<{ account_active: boolean; rate_allowed: boolean }>([
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [deriveMcpAccountAdvisoryLockKey(userId)],
    },
    {
      text: `WITH account_state AS MATERIALIZED (
       SELECT NOT EXISTS (
         SELECT 1 FROM mcp_deleted_account_markers marker WHERE marker.scope_key = $7
       ) AS account_active
     ), stale_credentials AS MATERIALIZED (
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
       SELECT 'credential:' || $1, NOW(), 1, NOW()
       FROM account_state WHERE account_active
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
       SELECT 'user:' || $2, NOW(), 1, NOW()
       FROM account_state WHERE account_active
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
     SELECT account_active,
       (EXISTS (SELECT 1 FROM credential_rate)
        AND EXISTS (SELECT 1 FROM user_rate)) AS rate_allowed
     FROM account_state`,
      params: [
        credentialId,
        userId,
        MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
        MCP_REQUESTS_PER_USER_PER_MINUTE,
        MCP_CREDENTIAL_RATE_LIMIT_RETENTION_MS,
        MCP_CREDENTIAL_RATE_LIMIT_CLEANUP_BATCH_SIZE,
        deletedAccountScopeKey,
      ],
    },
  ], { isolationLevel: 'ReadCommitted' });
  const result = resultSets[1]?.rows[0];
  if (!result) throw new Error('Unable to apply the MCP request rate limit.');
  if (!result.account_active) throw new McpDeletedAccountError();
  if (!result.rate_allowed) throw new McpRequestRateLimitError();
  return credentialId;
}

export async function authenticateMcpAccessToken(
  rawTokenOrAuthorization: string | null,
  requiredScope: McpAccessScope = MCP_DRAFT_CREATE_SCOPE
): Promise<AuthenticatedMcpToken | null> {
  if (!MCP_ACCESS_SCOPES.includes(requiredScope)) return null;
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

  await ensureKnowledgeIngestionSchema();
  const preflight = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM mcp_access_tokens WHERE token_hash = $1 LIMIT 1`,
    [tokenHash],
  );
  const preflightUserId = preflight.rows[0]?.user_id;
  if (!preflightUserId) return null;
  const resultSets = await pool.transaction<{
    id: string;
    user_id: string;
    token_hash: string;
    scopes: unknown;
    rate_allowed: boolean;
  }>([
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [deriveMcpAccountAdvisoryLockKey(preflightUserId)],
    },
    {
      text: `WITH account_state AS MATERIALIZED (
       SELECT NOT EXISTS (
         SELECT 1 FROM mcp_deleted_account_markers marker WHERE marker.scope_key = $6
       ) AS account_active
     ), authenticated AS MATERIALIZED (
       UPDATE mcp_access_tokens
       SET last_used_at = NOW()
       FROM account_state
       WHERE token_hash = $1 AND user_id = $5
         AND account_state.account_active
         AND revoked_at IS NULL AND expires_at > NOW()
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
      params: [
        tokenHash,
        JSON.stringify([requiredScope]),
        MCP_REQUESTS_PER_TOKEN_PER_MINUTE,
        MCP_REQUESTS_PER_USER_PER_MINUTE,
        preflightUserId,
        deriveMcpDeletedAccountScopeKey(preflightUserId),
      ],
    },
  ], { isolationLevel: 'ReadCommitted' });
  const row = resultSets[1]?.rows[0];
  if (!row) return null;
  if (!row.rate_allowed) throw new McpRequestRateLimitError();
  const left = Buffer.from(row.token_hash, 'hex');
  const right = Buffer.from(tokenHash, 'hex');
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  const scopes = Array.isArray(row.scopes) ? row.scopes.filter((scope): scope is string => typeof scope === 'string') : [];
  return { userId: row.user_id, tokenId: row.id, scopes };
}

export const verifyMcpAccessToken = authenticateMcpAccessToken;

export async function createMcpAccessTokenForUser(
  userId: string,
  labelInput: string,
  requestedScopes: readonly string[] = [MCP_DRAFT_CREATE_SCOPE],
): Promise<{ token: string; record: McpAccessToken }> {
  if (!userId || userId.startsWith('guest_')) throw new Error('A signed-in user is required.');
  const scopes = Array.from(new Set(requestedScopes));
  if (scopes.length === 0 || scopes.some((scope) => !MCP_ACCESS_SCOPES.includes(scope as McpAccessScope))) {
    throw new Error('Select at least one supported MCP scope.');
  }
  const rawToken = `girapphe_mcp_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')}`;
  const now = new Date();
  const record: McpAccessToken = {
    id: randomUUID(),
    label: sanitizeKnowledgeTitle(labelInput || 'MCP client') || 'MCP client',
    scopes,
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
  const deletedAccountScopeKey = deriveMcpDeletedAccountScopeKey(userId);
  const sql = getTransactionSql();
  const resultSets = await sql.transaction((tx) => [
    tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
    tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mcp-token:${userId}`]),
    tx.query(
      `WITH account_state AS MATERIALIZED (
       SELECT NOT EXISTS (
         SELECT 1 FROM mcp_deleted_account_markers marker WHERE marker.scope_key = $11
       ) AS account_active
     ), inserted_token AS (
       INSERT INTO mcp_access_tokens (id, user_id, token_hash, last_four, label, scopes, expires_at)
       SELECT $1, $2, $3, $4, $5, $6::jsonb, $7::timestamptz
       FROM account_state
       WHERE account_active
         AND (SELECT COUNT(*) FROM mcp_access_tokens t
            WHERE t.user_id = $2 AND t.revoked_at IS NULL AND t.expires_at > NOW()) < $8
         AND (SELECT COUNT(*) FROM mcp_access_tokens t
            WHERE t.user_id = $2 AND t.created_at > NOW() - INTERVAL '1 day') < $9
         AND (SELECT COUNT(*) FROM mcp_access_tokens t WHERE t.user_id = $2) < $10
       RETURNING id
     )
     SELECT account_active,
       EXISTS (SELECT 1 FROM inserted_token) AS inserted
     FROM account_state`,
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
        deletedAccountScopeKey,
      ]
    ),
  ], { isolationLevel: 'ReadCommitted' });
  const tokenCreation = (resultSets[2] as Array<{ account_active: boolean; inserted: boolean }>)[0];
  if (!tokenCreation) throw new Error('Unable to create the MCP token.');
  if (!tokenCreation.account_active) throw new McpDeletedAccountError();
  if (!tokenCreation.inserted) throw new Error('MCP token quota exceeded. Revoke an active token or try again later.');
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
  input: { id?: string; graphNodeId?: string; title: string; summary?: string; content: string; topic: string; tags?: string[]; origin?: 'manual' | 'conversation'; knowledgeType?: KnowledgeBundleType | null; centralQuestion?: string | null; structuredContent?: KnowledgeBundleContent | null; bundleSchemaVersion?: number | null; observedAt?: string | null; validFrom?: string | null; validTo?: string | null; reviewAt?: string | null },
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
    knowledge_type: input.knowledgeType ?? null,
    central_question: input.centralQuestion ?? null,
    structured_content: input.structuredContent ?? null,
    bundle_schema_version: input.bundleSchemaVersion ?? null,
    version: 1,
    dedupe_key: buildKnowledgeDedupeKey({
      title: input.title,
      topic: input.topic,
      knowledgeType: input.knowledgeType,
      centralQuestion: input.centralQuestion,
    }),
    observed_at: sanitizeTimestamp(input.observedAt),
    valid_from: sanitizeTimestamp(input.validFrom),
    valid_to: sanitizeTimestamp(input.validTo),
    last_verified_at: null,
    review_at: sanitizeTimestamp(input.reviewAt),
    archived_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    purge_at: null,
  };
  memoryKnowledgeItems.set(userId, [item, ...(memoryKnowledgeItems.get(userId) ?? [])]);
  recordMemoryRevision(userId, item);
  recordMemoryActivity(userId, item.id, 'confirmed', { origin: input.origin ?? 'manual' });
  if (options.syncGraph !== false) {
    ensureMemoryPrivateNode(userId, item, input.origin ?? 'manual', input.graphNodeId);
  }
  return item;
}

export function updateMemoryKnowledgeItemForUser(
  userId: string,
  itemId: string,
  input: { title: string; summary?: string; content: string; topic: string; tags?: string[]; knowledgeType?: KnowledgeBundleType | null; centralQuestion?: string | null; structuredContent?: KnowledgeBundleContent | null; bundleSchemaVersion?: number | null; observedAt?: string | null; validFrom?: string | null; validTo?: string | null; reviewAt?: string | null },
  options: { syncGraph?: boolean; activityMetadata?: Record<string, unknown>; expectedVersion?: number } = {}
): KnowledgeItemUpdateResult {
  const now = new Date().toISOString();
  const previous = (memoryKnowledgeItems.get(userId) ?? []).find((item) => item.id === itemId
    && !item.deleted_at && !item.archived_at);
  if (!previous) return { updated: false, version: null, notFound: true };
  if (options.expectedVersion !== undefined && previous.version !== options.expectedVersion) {
    return { updated: false, version: null, stale: true };
  }
  recordMemoryRevision(userId, previous);
  const items = (memoryKnowledgeItems.get(userId) ?? []).map((item) => item.id === itemId && !item.deleted_at
    ? { ...item, title: input.title, summary: input.summary ?? item.summary, content: input.content, topic: input.topic, tags: input.tags ? sanitizeKnowledgeTags(input.tags) : item.tags,
      knowledge_type: input.knowledgeType === undefined ? item.knowledge_type : input.knowledgeType,
      central_question: input.centralQuestion === undefined ? item.central_question : input.centralQuestion,
      structured_content: input.structuredContent === undefined ? item.structured_content : input.structuredContent,
      bundle_schema_version: input.bundleSchemaVersion === undefined ? item.bundle_schema_version : input.bundleSchemaVersion,
      version: item.version + 1,
      dedupe_key: buildKnowledgeDedupeKey({
        title: input.title,
        topic: input.topic,
        knowledgeType: input.knowledgeType === undefined ? item.knowledge_type : input.knowledgeType,
        centralQuestion: input.centralQuestion === undefined ? item.central_question : input.centralQuestion,
      }),
      observed_at: input.observedAt === undefined ? item.observed_at : sanitizeTimestamp(input.observedAt),
      valid_from: input.validFrom === undefined ? item.valid_from : sanitizeTimestamp(input.validFrom),
      valid_to: input.validTo === undefined ? item.valid_to : sanitizeTimestamp(input.validTo),
      review_at: input.reviewAt === undefined ? item.review_at : sanitizeTimestamp(input.reviewAt),
      last_verified_at: null,
      updated_at: now }
    : item);
  memoryKnowledgeItems.set(userId, items);
  const updatedItem = items.find((item) => item.id === itemId && !item.deleted_at);
  if (updatedItem) {
    recordMemoryRevision(userId, updatedItem);
    recordMemoryActivity(userId, itemId, 'revised', options.activityMetadata);
  }
  if (options.syncGraph === false) return { updated: true, version: updatedItem!.version };
  const nodes = (memoryNodes.get(userId) ?? []).map((node) => node.knowledge_item_id === itemId
    ? { ...node, label: input.title, summary: input.summary ?? node.summary, explanation: input.content, topic: input.topic, tags: input.tags ? sanitizeKnowledgeTags(input.tags) : node.tags,
      knowledge_type: input.knowledgeType === undefined ? node.knowledge_type : input.knowledgeType,
      central_question: input.centralQuestion === undefined ? node.central_question : input.centralQuestion,
      structured_content: input.structuredContent === undefined ? node.structured_content : input.structuredContent,
      bundle_schema_version: input.bundleSchemaVersion === undefined ? node.bundle_schema_version : input.bundleSchemaVersion,
      version: node.version + 1,
      dedupe_key: buildKnowledgeDedupeKey({
        title: input.title,
        topic: input.topic,
        knowledgeType: input.knowledgeType === undefined ? node.knowledge_type : input.knowledgeType,
        centralQuestion: input.centralQuestion === undefined ? node.central_question : input.centralQuestion,
      }),
      observed_at: input.observedAt === undefined ? node.observed_at : sanitizeTimestamp(input.observedAt),
      valid_from: input.validFrom === undefined ? node.valid_from : sanitizeTimestamp(input.validFrom),
      valid_to: input.validTo === undefined ? node.valid_to : sanitizeTimestamp(input.validTo),
      review_at: input.reviewAt === undefined ? node.review_at : sanitizeTimestamp(input.reviewAt),
      last_verified_at: null }
    : node);
  memoryNodes.set(userId, nodes);
  return { updated: true, version: updatedItem!.version };
}

export function softDeleteMemoryKnowledgeItemForUser(
  userId: string,
  itemId: string,
  retentionDays: number,
  options: { syncGraph?: boolean } = {}
): void {
  const now = new Date().toISOString();
  const purgeAt = new Date(Date.now() + retentionDays * 86_400_000).toISOString();
  const existed = (memoryKnowledgeItems.get(userId) ?? []).some((item) => item.id === itemId && !item.deleted_at);
  memoryKnowledgeItems.set(userId, (memoryKnowledgeItems.get(userId) ?? []).map((item) => item.id === itemId
    ? { ...item, deleted_at: now, purge_at: purgeAt, updated_at: now }
    : item));
  if (existed) recordMemoryActivity(userId, itemId, 'revised', {
    lifecycle: 'trash',
    state: 'deleted',
    purge_at: purgeAt,
  });
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
  options: { syncGraph?: boolean; retentionDays?: number } = {}
): void {
  const now = new Date().toISOString();
  const items = memoryKnowledgeItems.get(userId) ?? [];
  const index = items.findIndex((item) => item.id === itemId && item.deleted_at
    && (!item.purge_at || new Date(item.purge_at).getTime() > Date.now()));
  if (index < 0) return;
  const previous = items[index];
  const retentionPurgeAt = options.retentionDays === undefined
    ? null
    : new Date(new Date(previous.created_at).getTime() + options.retentionDays * 86_400_000).toISOString();
  if (retentionPurgeAt && new Date(retentionPurgeAt).getTime() <= Date.now()) return;
  recordMemoryRevision(userId, previous);
  const restored: MemoryKnowledgeItem = {
    ...previous,
    version: previous.version + 1,
    deleted_at: null,
    purge_at: retentionPurgeAt,
    updated_at: now,
  };
  items[index] = restored;
  memoryKnowledgeItems.set(userId, items);
  if (options.syncGraph !== false) {
    const trashedNode = (memoryTrashedNodes.get(userId) ?? []).find((node) => node.knowledge_item_id === itemId);
    if (trashedNode) {
      const restoredNode = { ...trashedNode, version: restored.version };
      memoryNodes.set(userId, [restoredNode, ...(memoryNodes.get(userId) ?? []).filter((node) => node.graph_node_id !== trashedNode.graph_node_id)]);
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
  recordMemoryRevision(userId, restored);
  recordMemoryActivity(userId, itemId, 'revised', {
    lifecycle: 'trash',
    state: 'restored',
  });
}

export function purgeMemoryKnowledgeItemsForUser(userId: string): void {
  const now = Date.now();
  const items = memoryKnowledgeItems.get(userId) ?? [];
  const purgedIds = new Set(items
    .filter((item) => item.purge_at && new Date(item.purge_at).getTime() <= now)
    .map((item) => item.id));
  if (purgedIds.size === 0) return;
  memoryKnowledgeItems.set(userId, items.filter((item) => !purgedIds.has(item.id)));
  const revisions = memoryItemRevisions.get(userId);
  if (revisions) {
    for (const itemId of purgedIds) revisions.delete(itemId);
  }
  memoryItemActivity.set(userId, (memoryItemActivity.get(userId) ?? [])
    .filter((entry) => !purgedIds.has(entry.knowledge_item_id)));
  memoryItemSupersessions.set(userId, (memoryItemSupersessions.get(userId) ?? [])
    .filter((entry) => !purgedIds.has(entry.superseded_item_id)
      && !purgedIds.has(entry.superseding_item_id)));
  memoryEvidenceSelectors.set(userId, (memoryEvidenceSelectors.get(userId) ?? [])
    .filter((entry) => !purgedIds.has(entry.knowledge_item_id)));
  memoryKnowledgeSources.set(userId, (memoryKnowledgeSources.get(userId) ?? [])
    .filter((entry) => !purgedIds.has(entry.knowledge_item_id)));
  memoryNodes.set(userId, (memoryNodes.get(userId) ?? [])
    .filter((node) => !purgedIds.has(node.knowledge_item_id)));
  memoryTrashedNodes.set(userId, (memoryTrashedNodes.get(userId) ?? [])
    .filter((node) => !purgedIds.has(node.knowledge_item_id)));
  const hasPurgedEndpoint = (edge: PrivateKnowledgeEdge) => [edge.source, edge.target]
    .some((endpoint) => endpoint.startsWith('personal:') && purgedIds.has(endpoint.slice(9)));
  memoryEdges.set(userId, (memoryEdges.get(userId) ?? []).filter((edge) => !hasPurgedEndpoint(edge)));
  memoryTrashedEdges.set(userId, (memoryTrashedEdges.get(userId) ?? [])
    .filter((edge) => !hasPurgedEndpoint(edge)));
  for (const [batchId, drafts] of memoryDrafts.entries()) {
    if (memoryBatches.get(batchId)?.user_id !== userId) continue;
    memoryDrafts.set(batchId, drafts.map((draft) => ({
      ...draft,
      knowledge_item_id: draft.knowledge_item_id && purgedIds.has(draft.knowledge_item_id)
        ? null
        : draft.knowledge_item_id,
      target_knowledge_item_id: draft.target_knowledge_item_id
        && purgedIds.has(draft.target_knowledge_item_id)
        ? null
        : draft.target_knowledge_item_id,
    })));
  }
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
    knowledge_type: item.knowledge_type,
    central_question: item.central_question,
    structured_content: item.structured_content,
    bundle_schema_version: item.bundle_schema_version,
    version: item.version,
    dedupe_key: item.dedupe_key,
    observed_at: item.observed_at,
    valid_from: item.valid_from,
    valid_to: item.valid_to,
    last_verified_at: item.last_verified_at,
    review_at: item.review_at,
    archived_at: item.archived_at,
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
      const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
        .map((entry) => entry.superseded_item_id));
      const item = (memoryKnowledgeItems.get(userId) ?? []).find((candidate) => candidate.id === parsed.id
        && !candidate.deleted_at && !candidate.archived_at && !supersededIds.has(candidate.id));
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
      const [result] = await pool.accountTransaction<{ id: string; knowledge_item_id: string }>(userId, [{
        text: `INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
         SELECT $3, i.user_id, i.id, i.title, i.topic, 'manual'
         FROM user_knowledge_items i
         WHERE i.id = $1 AND i.user_id = $2
           AND i.deleted_at IS NULL AND i.archived_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM knowledge_item_supersessions s
             WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
           )
         ON CONFLICT (user_id, knowledge_item_id) DO UPDATE SET
           label = EXCLUDED.label, topic = EXCLUDED.topic, updated_at = NOW(), deleted_at = NULL, purge_at = NULL
         RETURNING id, knowledge_item_id`,
        params: [parsed.id, userId, nodeId],
      }]);
      const row = result.rows[0];
      return row ? { privateNodeId: row.id, publicNodeId: null, knowledgeItemId: row.knowledge_item_id, key: `private:${row.id}` } : null;
    }
    const result = await pool.query<{ id: string; knowledge_item_id: string }>(
      `SELECT n.id, n.knowledge_item_id FROM user_graph_nodes n
       JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
       WHERE n.user_id = $1 AND n.knowledge_item_id = $2 AND n.deleted_at IS NULL
         AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
       LIMIT 1`,
      [userId, parsed.id]
    );
    const row = result.rows[0];
    return row ? { privateNodeId: row.id, publicNodeId: null, knowledgeItemId: row.knowledge_item_id, key: `private:${row.id}` } : null;
  }

  const result = await pool.query<{ id: string; knowledge_item_id: string }>(
    `SELECT n.id, n.knowledge_item_id FROM user_graph_nodes n
     JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
     WHERE n.id = $1 AND n.user_id = $2 AND n.deleted_at IS NULL
       AND i.deleted_at IS NULL AND i.archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM knowledge_item_supersessions s
         WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
       )
     LIMIT 1`,
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
  sourceBatchId: string | null = null,
  relationOrigin: KnowledgeRelationOrigin = origin === 'manual' ? 'explicit_user' : 'extracted_from_source',
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
      weight, origin,
      relation_origin: relationOrigin,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    memoryEdges.set(userId, edges);
    return true;
  }

  const [result] = await pool.accountTransaction<{ id: string }>(userId, [{
    text: `
    WITH graph_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(hashtext($14))
    )
    INSERT INTO user_graph_edges (
      id, user_id, source_private_node_id, source_public_node_id,
      target_private_node_id, target_public_node_id, type, weight, origin, source_batch_id,
      relation_origin, confirmed_at
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $15, NOW() FROM graph_lock
    WHERE
      ($3::text IS NULL OR EXISTS (
        SELECT 1 FROM user_graph_nodes n
        JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
        WHERE n.id = $3 AND n.user_id = $2 AND n.deleted_at IS NULL
          AND i.deleted_at IS NULL AND i.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM knowledge_item_supersessions s
            WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
          )
      ))
      AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = $4))
      AND ($5::text IS NULL OR EXISTS (
        SELECT 1 FROM user_graph_nodes n
        JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
        WHERE n.id = $5 AND n.user_id = $2 AND n.deleted_at IS NULL
          AND i.deleted_at IS NULL AND i.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM knowledge_item_supersessions s
            WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
          )
      ))
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
    params: [
      randomUUID(), userId, source.privateNodeId, source.publicNodeId, target.privateNodeId, target.publicNodeId,
      type, Math.max(0.05, Math.min(1, weight)), origin, sourceBatchId, type, target.key, source.key,
      `knowledge-graph:${userId}`, relationOrigin,
    ],
  }]);
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
  if (!process.env.DATABASE_URL) {
    const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
      .map((entry) => entry.superseded_item_id));
    const activeItemIds = new Set((memoryKnowledgeItems.get(userId) ?? [])
      .filter((item) => !item.deleted_at && !item.archived_at && !supersededIds.has(item.id))
      .map((item) => item.id));
    const nodes = (memoryNodes.get(userId) ?? [])
      .filter((node) => activeItemIds.has(node.knowledge_item_id));
    const edges = (memoryEdges.get(userId) ?? []).filter((edge) => {
      const privateEndpoints = [edge.source, edge.target]
        .filter((endpoint) => endpoint.startsWith('personal:'))
        .map((endpoint) => endpoint.slice('personal:'.length));
      return privateEndpoints.every((itemId) => activeItemIds.has(itemId));
    });
    return { nodes, edges };
  }
  await ensureKnowledgeIngestionSchema();
  const [nodeResult, edgeResult] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `SELECT n.id AS graph_node_id, n.knowledge_item_id, n.label, i.summary, i.content AS explanation,
        n.topic, i.tags, i.knowledge_type, i.central_question, i.structured_content, i.bundle_schema_version,
        i.version, i.dedupe_key, i.observed_at, i.valid_from, i.valid_to, i.last_verified_at,
        i.review_at, i.archived_at, n.origin, n.created_at::text
       FROM user_graph_nodes n JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
       WHERE n.user_id = $1 AND n.deleted_at IS NULL
         AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
       ORDER BY n.created_at DESC`,
      [userId]
    ),
    pool.query<Record<string, unknown>>(
      `SELECT e.id, e.source_private_node_id, e.source_public_node_id, e.target_private_node_id, e.target_public_node_id,
        sn.knowledge_item_id AS source_item_id, tn.knowledge_item_id AS target_item_id,
        e.type, e.weight, e.origin, e.relation_origin, e.confirmed_at::text, e.created_at::text
       FROM user_graph_edges e
       LEFT JOIN user_graph_nodes sn ON sn.id = e.source_private_node_id AND sn.user_id = e.user_id AND sn.deleted_at IS NULL
       LEFT JOIN user_graph_nodes tn ON tn.id = e.target_private_node_id AND tn.user_id = e.user_id AND tn.deleted_at IS NULL
       LEFT JOIN user_knowledge_items si ON si.id = sn.knowledge_item_id AND si.user_id = sn.user_id
         AND si.deleted_at IS NULL AND si.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions source_supersession
           WHERE source_supersession.user_id = si.user_id
             AND source_supersession.superseded_item_id = si.id
         )
       LEFT JOIN user_knowledge_items ti ON ti.id = tn.knowledge_item_id AND ti.user_id = tn.user_id
         AND ti.deleted_at IS NULL AND ti.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions target_supersession
           WHERE target_supersession.user_id = ti.user_id
             AND target_supersession.superseded_item_id = ti.id
         )
       WHERE e.user_id = $1 AND e.deleted_at IS NULL
         AND (e.source_private_node_id IS NULL OR si.id IS NOT NULL)
         AND (e.target_private_node_id IS NULL OR ti.id IS NOT NULL)
       ORDER BY e.created_at`,
      [userId]
    ),
  ]);
  const nodes = nodeResult.rows.map<PrivateKnowledgeNode>((row) => {
    const bundle = parseKnowledgeBundleFields({
      knowledge_type: row.knowledge_type,
      central_question: row.central_question,
      structured_content: row.structured_content,
      bundle_schema_version: row.bundle_schema_version,
    });
    return {
      id: `personal:${String(row.knowledge_item_id)}`,
      graph_node_id: String(row.graph_node_id),
      knowledge_item_id: String(row.knowledge_item_id),
      label: String(row.label),
      summary: String(row.summary ?? ''),
      explanation: String(row.explanation ?? ''),
      topic: String(row.topic),
      tags: sanitizeKnowledgeTags(row.tags),
      knowledge_type: bundle?.knowledge_type ?? null,
      central_question: bundle?.central_question ?? null,
      structured_content: bundle?.structured_content ?? null,
      bundle_schema_version: bundle?.bundle_schema_version ?? null,
      version: Number(row.version ?? 1),
      dedupe_key: String(row.dedupe_key ?? buildKnowledgeDedupeKey({
        title: String(row.label),
        topic: String(row.topic),
        knowledgeType: bundle?.knowledge_type,
        centralQuestion: bundle?.central_question,
      })),
      observed_at: row.observed_at ? new Date(String(row.observed_at)).toISOString() : null,
      valid_from: row.valid_from ? new Date(String(row.valid_from)).toISOString() : null,
      valid_to: row.valid_to ? new Date(String(row.valid_to)).toISOString() : null,
      last_verified_at: row.last_verified_at ? new Date(String(row.last_verified_at)).toISOString() : null,
      review_at: row.review_at ? new Date(String(row.review_at)).toISOString() : null,
      archived_at: row.archived_at ? new Date(String(row.archived_at)).toISOString() : null,
      origin: row.origin as PrivateKnowledgeNode['origin'],
      created_at: new Date(String(row.created_at)).toISOString(),
    };
  });
  const edges = edgeResult.rows.map<PrivateKnowledgeEdge>((row) => ({
    id: String(row.id),
    source: row.source_private_node_id ? `personal:${String(row.source_item_id)}` : `graph_${String(row.source_public_node_id)}`,
    target: row.target_private_node_id ? `personal:${String(row.target_item_id)}` : `graph_${String(row.target_public_node_id)}`,
    type: row.type as KnowledgeRelationType,
    weight: Number(row.weight),
    origin: row.origin as PrivateKnowledgeEdge['origin'],
    relation_origin: (row.relation_origin ?? (row.origin === 'manual' ? 'explicit_user' : 'extracted_from_source')) as KnowledgeRelationOrigin,
    confirmed_at: row.confirmed_at ? new Date(String(row.confirmed_at)).toISOString() : null,
    created_at: new Date(String(row.created_at)).toISOString(),
  }));
  return { nodes, edges };
}

export async function getKnowledgeLinkTargetsForUser(userId: string, queryInput = ''): Promise<KnowledgeLinkTarget[]> {
  const query = sanitizeKnowledgeContent(queryInput, 80).toLocaleLowerCase();
  if (!process.env.DATABASE_URL) {
    const graph = await getPrivateKnowledgeGraphForUser(userId);
    const privateTargets = graph.nodes.map<KnowledgeLinkTarget>((node) => ({
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
       WHERE n.user_id = $1 AND n.deleted_at IS NULL
         AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
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

function dedupeTokens(...values: Array<string | null | undefined>): Set<string> {
  const tokens = values.flatMap((value) => dedupeText(value ?? '').split(' ')).filter(Boolean).slice(0, 64);
  return new Set(tokens);
}

function tokenSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function mapResolutionTarget(row: Record<string, unknown>): KnowledgeResolutionTarget {
  const bundle = parseKnowledgeBundleFields({
    knowledge_type: row.knowledge_type,
    central_question: row.central_question,
    structured_content: row.structured_content,
    bundle_schema_version: row.bundle_schema_version,
  });
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary ?? ''),
    content: String(row.content ?? ''),
    topic: String(row.topic ?? 'general'),
    tags: sanitizeKnowledgeTags(row.tags),
    knowledge_type: bundle?.knowledge_type ?? null,
    central_question: bundle?.central_question ?? null,
    structured_content: bundle?.structured_content ?? null,
    bundle_schema_version: bundle?.bundle_schema_version ?? null,
    version: Number(row.version ?? 1),
  };
}

type DuplicateCandidate = {
  target: KnowledgeResolutionTarget;
  dedupeKey: string;
};

function rankKnowledgeDuplicateCandidates(
  draftOrInput: KnowledgeCardDraft | {
    title: string;
    topic: string;
    knowledge_type: KnowledgeBundleType | null;
    central_question: string | null;
    dedupe_key?: string;
  },
  candidates: DuplicateCandidate[],
  limit: number,
): KnowledgeDuplicateSuggestion[] {
  const dedupeKey = draftOrInput.dedupe_key || buildKnowledgeDedupeKey({
    title: draftOrInput.title,
    topic: draftOrInput.topic,
    knowledgeType: draftOrInput.knowledge_type,
    centralQuestion: draftOrInput.central_question,
  });
  const normalizedTopic = normalizeKnowledgeTopic(draftOrInput.topic);
  const inputTokens = dedupeTokens(draftOrInput.title, draftOrInput.central_question);
  return candidates.map<KnowledgeDuplicateSuggestion>(({ target, dedupeKey: candidateDedupeKey }) => {
    const exact = candidateDedupeKey === dedupeKey;
    const similarity = tokenSimilarity(inputTokens, dedupeTokens(target.title, target.central_question));
    const score = exact ? 1 : Math.min(0.99,
      similarity * 0.8
      + (target.topic === normalizedTopic ? 0.1 : 0)
      + (target.knowledge_type === draftOrInput.knowledge_type ? 0.1 : 0));
    return {
      id: target.id,
      title: target.title,
      summary: target.summary,
      topic: target.topic,
      knowledge_type: target.knowledge_type,
      central_question: target.central_question,
      version: target.version,
      match: exact ? 'exact' : 'similar',
      score: Number(score.toFixed(4)),
    };
  }).filter((candidate) => candidate.match === 'exact' || candidate.score >= 0.35)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}

async function getKnowledgeDraftForUserById(userId: string, draftId: string): Promise<KnowledgeCardDraft | null> {
  if (!process.env.DATABASE_URL) {
    for (const [batchId, drafts] of memoryDrafts.entries()) {
      if (memoryBatches.get(batchId)?.user_id !== userId) continue;
      const draft = drafts.find((candidate) => candidate.id === draftId);
      if (draft) return draft;
    }
    return null;
  }
  await ensureKnowledgeIngestionSchema();
  const result = await pool.query<Record<string, unknown>>(
    `SELECT d.id, d.batch_id, d.client_card_id, d.title, d.summary, d.explanation, d.topic, d.tags,
       d.proposed_relations, d.knowledge_type, d.central_question, d.structured_content, d.bundle_schema_version,
       d.dedupe_key, d.proposed_evidence, d.resolution_action, d.target_knowledge_item_id, d.resolved_at,
       d.status, d.version, d.knowledge_item_id, d.created_at, d.updated_at
     FROM knowledge_card_drafts d
     JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
     WHERE d.id = $1 AND d.user_id = $2
     LIMIT 1`,
    [draftId, userId],
  );
  return result.rows[0] ? mapDraftRow(result.rows[0]) : null;
}

export async function getKnowledgeDuplicateSuggestionsForUser(
  userId: string,
  draftOrInput: KnowledgeCardDraft | { title: string; topic: string; knowledge_type: KnowledgeBundleType | null; central_question: string | null; dedupe_key?: string },
  limitInput = 5,
): Promise<KnowledgeDuplicateSuggestion[]> {
  const limit = Math.max(1, Math.min(10, Math.trunc(limitInput)));
  const dedupeKey = draftOrInput.dedupe_key || buildKnowledgeDedupeKey({
    title: draftOrInput.title,
    topic: draftOrInput.topic,
    knowledgeType: draftOrInput.knowledge_type,
    centralQuestion: draftOrInput.central_question,
  });
  const normalizedTopic = normalizeKnowledgeTopic(draftOrInput.topic);
  let candidates: KnowledgeResolutionTarget[];
  let candidateDedupeKeys = new Map<string, string>();

  if (!process.env.DATABASE_URL) {
    const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? []).map((entry) => entry.superseded_item_id));
    candidates = getMemoryKnowledgeItemsForUser(userId)
      .filter((item) => !item.deleted_at && !item.archived_at && !supersededIds.has(item.id))
      .filter((item) => item.dedupe_key === dedupeKey
        || (item.topic === normalizedTopic && item.knowledge_type === draftOrInput.knowledge_type))
      .sort((left, right) => Number(right.dedupe_key === dedupeKey) - Number(left.dedupe_key === dedupeKey)
        || right.updated_at.localeCompare(left.updated_at)
        || left.id.localeCompare(right.id))
      .slice(0, 200)
      .map((item) => mapResolutionTarget(item as unknown as Record<string, unknown>));
    candidateDedupeKeys = new Map(getMemoryKnowledgeItemsForUser(userId).map((item) => [item.id, item.dedupe_key]));
  } else {
    await ensureKnowledgeIngestionSchema();
    const result = await pool.query<Record<string, unknown>>(
      `SELECT i.id, i.title, i.summary, i.content, i.topic, i.tags, i.knowledge_type,
         i.central_question, i.structured_content, i.bundle_schema_version, i.version, i.dedupe_key
       FROM user_knowledge_items i
       WHERE i.user_id = $1 AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
         AND (i.dedupe_key = $2 OR (i.topic = $3 AND i.knowledge_type IS NOT DISTINCT FROM $4))
       ORDER BY (i.dedupe_key = $2) DESC, i.updated_at DESC, i.id
       LIMIT 200`,
      [userId, dedupeKey, normalizedTopic, draftOrInput.knowledge_type],
    );
    candidates = result.rows.map(mapResolutionTarget);
    candidateDedupeKeys = new Map(result.rows.map((row) => [String(row.id), String(row.dedupe_key ?? '')]));
  }

  return rankKnowledgeDuplicateCandidates(
    draftOrInput,
    candidates.map((target) => ({ target, dedupeKey: candidateDedupeKeys.get(target.id) ?? '' })),
    limit,
  );
}

export async function getKnowledgeDuplicateSuggestionsForDraftsForUser(
  userId: string,
  draftsInput: KnowledgeCardDraft[],
  limitInput = 5,
): Promise<Record<string, KnowledgeDuplicateSuggestion[]>> {
  const limit = Math.max(1, Math.min(10, Math.trunc(limitInput)));
  const seen = new Set<string>();
  const drafts = draftsInput
    .filter((draft) => draft.status === 'pending' && !seen.has(draft.id) && seen.add(draft.id))
    .slice(0, 50);
  if (!userId || drafts.length === 0) return {};

  if (!process.env.DATABASE_URL) {
    return Object.fromEntries(await Promise.all(drafts.map(async (draft) => [
      draft.id,
      await getKnowledgeDuplicateSuggestionsForUser(userId, draft, limit),
    ] as const)));
  }

  await ensureKnowledgeIngestionSchema();
  const criteria = drafts.map((draft, ordinal) => ({
    ordinal,
    draft_id: draft.id,
    dedupe_key: draft.dedupe_key || buildKnowledgeDedupeKey({
      title: draft.title,
      topic: draft.topic,
      knowledgeType: draft.knowledge_type,
      centralQuestion: draft.central_question,
    }),
    topic: normalizeKnowledgeTopic(draft.topic),
    knowledge_type: draft.knowledge_type,
  }));
  const result = await pool.query<Record<string, unknown>>(
    `WITH criteria AS (
       SELECT * FROM jsonb_to_recordset($2::jsonb) AS c(
         ordinal integer,
         draft_id text,
         dedupe_key text,
         topic text,
         knowledge_type text
       )
     )
     SELECT c.ordinal, c.draft_id,
       candidate.id, candidate.title, candidate.summary, candidate.content,
       candidate.topic, candidate.tags, candidate.knowledge_type,
       candidate.central_question, candidate.structured_content,
       candidate.bundle_schema_version, candidate.version, candidate.dedupe_key
     FROM criteria c
     CROSS JOIN LATERAL (
       SELECT i.id, i.title, i.summary, i.content, i.topic, i.tags,
         i.knowledge_type, i.central_question, i.structured_content,
         i.bundle_schema_version, i.version, i.dedupe_key, i.updated_at
       FROM user_knowledge_items i
       WHERE i.user_id = $1 AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
         AND (
           i.dedupe_key = c.dedupe_key
           OR (i.topic = c.topic AND i.knowledge_type IS NOT DISTINCT FROM c.knowledge_type)
         )
       ORDER BY (i.dedupe_key = c.dedupe_key) DESC, i.updated_at DESC, i.id
       LIMIT 200
     ) candidate
     ORDER BY c.ordinal, (candidate.dedupe_key = c.dedupe_key) DESC,
       candidate.updated_at DESC, candidate.id`,
    [userId, JSON.stringify(criteria)],
  );
  const candidatesByDraft = new Map<string, DuplicateCandidate[]>();
  for (const row of result.rows) {
    const draftId = String(row.draft_id);
    const entries = candidatesByDraft.get(draftId) ?? [];
    entries.push({
      target: mapResolutionTarget(row),
      dedupeKey: String(row.dedupe_key ?? ''),
    });
    candidatesByDraft.set(draftId, entries);
  }
  return Object.fromEntries(drafts.map((draft) => [
    draft.id,
    rankKnowledgeDuplicateCandidates(draft, candidatesByDraft.get(draft.id) ?? [], limit),
  ]));
}

export async function getKnowledgeDraftResolutionContextForUser(
  userId: string,
  draftId: string,
  targetItemId?: string,
): Promise<KnowledgeDraftResolutionContext | null> {
  const draft = await getKnowledgeDraftForUserById(userId, draftId);
  if (!draft) return null;
  const duplicateSuggestions = await getKnowledgeDuplicateSuggestionsForUser(userId, draft);
  let target: KnowledgeResolutionTarget | null = null;
  if (targetItemId) {
    if (!process.env.DATABASE_URL) {
      const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
        .map((entry) => entry.superseded_item_id));
      const item = getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === targetItemId
        && !candidate.deleted_at && !candidate.archived_at && !supersededIds.has(candidate.id));
      target = item ? mapResolutionTarget(item as unknown as Record<string, unknown>) : null;
    } else {
      const result = await pool.query<Record<string, unknown>>(
        `SELECT id, title, summary, content, topic, tags, knowledge_type, central_question,
           structured_content, bundle_schema_version, version
         FROM user_knowledge_items
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND archived_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM knowledge_item_supersessions s
             WHERE s.user_id = user_knowledge_items.user_id
               AND s.superseded_item_id = user_knowledge_items.id
           )
         LIMIT 1`,
        [targetItemId, userId],
      );
      target = result.rows[0] ? mapResolutionTarget(result.rows[0]) : null;
    }
  }
  return { draft, target, duplicateSuggestions };
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
    knowledgeType?: KnowledgeBundleType | null;
    centralQuestion?: string | null;
    structuredContent?: KnowledgeBundleContent | null;
    bundleSchemaVersion?: number | null;
    proposedEvidence?: KnowledgeEvidenceSelector[];
  }
): Promise<boolean> {
  const title = sanitizeKnowledgeTitle(input.title);
  if (!title) return false;
  const hasBundleInput = Boolean(input.knowledgeType || input.centralQuestion || input.structuredContent || input.bundleSchemaVersion);
  const bundle = hasBundleInput ? parseKnowledgeBundleFields({
    knowledge_type: input.knowledgeType,
    central_question: input.centralQuestion,
    structured_content: input.structuredContent,
    bundle_schema_version: input.bundleSchemaVersion,
  }) : null;
  if (hasBundleInput && !bundle) return false;
  const requestedSummary = sanitizeKnowledgeContent(input.summary, 500);
  const projection = bundle ? projectKnowledgeBundle(bundle, requestedSummary) : null;
  const payload = {
    title,
    summary: sanitizeKnowledgeContent(projection?.summary ?? requestedSummary, 500),
    explanation: sanitizeKnowledgeContent(projection?.content ?? input.explanation, 6000),
    topic: normalizeKnowledgeTopic(input.topic),
    tags: sanitizeKnowledgeTags(input.tags),
    relations: sanitizeProposedRelations(input.relations),
    knowledge_type: bundle?.knowledge_type ?? null,
    central_question: bundle?.central_question ?? null,
    structured_content: bundle?.structured_content ?? null,
    bundle_schema_version: bundle?.bundle_schema_version ?? null,
    dedupe_key: buildKnowledgeDedupeKey({
      title,
      topic: input.topic,
      knowledgeType: bundle?.knowledge_type,
      centralQuestion: bundle?.central_question,
    }),
    proposed_evidence: sanitizeKnowledgeEvidenceSelectors(input.proposedEvidence),
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
       tags = $7::jsonb, proposed_relations = $8::jsonb, knowledge_type = $10,
       central_question = $11, structured_content = $12::jsonb, bundle_schema_version = $13,
       dedupe_key = $14, proposed_evidence = $15::jsonb,
       version = version + 1, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
       AND version = $9
     RETURNING id`,
    [draftId, userId, payload.title, payload.summary, payload.explanation, payload.topic,
      JSON.stringify(payload.tags), JSON.stringify(payload.relations), input.expectedVersion,
      payload.knowledge_type, payload.central_question,
      payload.structured_content ? JSON.stringify(payload.structured_content) : null,
      payload.bundle_schema_version, payload.dedupe_key, JSON.stringify(payload.proposed_evidence)]
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
  if (!process.env.DATABASE_URL
    && (memoryKnowledgeItems.get(userId) ?? []).length + drafts.length > MAX_KNOWLEDGE_ITEMS_PER_USER) {
    return { approved: 0, skippedEdges: 0 };
  }

  const planned = drafts.map((draft) => ({
    draft,
    expectedVersion: expectedVersions[draft.id],
    itemId: randomUUID(),
    nodeId: randomUUID(),
    sourceId: randomUUID(),
    revisionId: randomUUID(),
    activityId: randomUUID(),
    evidenceIds: draft.proposed_evidence.map(() => randomUUID()),
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
    const batch = memoryBatches.get(batchId)!;
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
        knowledgeType: plan.draft.knowledge_type,
        centralQuestion: plan.draft.central_question,
        structuredContent: plan.draft.structured_content,
        bundleSchemaVersion: plan.draft.bundle_schema_version,
      });
      const node = ensureMemoryPrivateNode(userId, item, 'conversation');
      const plannedEndpoint = plannedNodes.get(plan.draft.id)!;
      plannedEndpoint.privateNodeId = node.graph_node_id;
      plannedEndpoint.key = `private:${node.graph_node_id}`;
      recordMemoryConversationSource(userId, item.id, batch, plan.draft, plan.draft.proposed_evidence);
      const stored = memoryDrafts.get(batchId) ?? [];
      const index = stored.findIndex((draft) => draft.id === plan.draft.id && draft.status === 'pending');
      if (index >= 0) {
        stored[index] = {
          ...stored[index],
          status: 'approved',
          knowledge_item_id: item.id,
          resolution_action: 'create',
          target_knowledge_item_id: null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        approved += 1;
      }
    }
    for (const candidate of candidates) {
      if (await insertResolvedEdgeForUser(
        userId,
        candidate.source,
        candidate.target,
        candidate.relation.type,
        candidate.relation.weight ?? 1,
        'conversation',
        batchId,
        candidate.relation.relationOrigin ?? 'model_inferred',
      )) insertedEdges += 1;
    }
    refreshMemoryBatchResolutionState(batchId);
    return { approved, skippedEdges: invalidRelations + candidates.length - insertedEdges };
  }

  await ensureKnowledgeIngestionSchema();
  const sql = getTransactionSql();
  const edgeInsertSql = `
    INSERT INTO user_graph_edges (
      id, user_id, source_private_node_id, source_public_node_id,
      target_private_node_id, target_public_node_id, type, weight, origin, source_batch_id,
      relation_origin, confirmed_at
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'conversation', $9, $12, NOW()
    WHERE
      ($3::text IS NULL OR EXISTS (
        SELECT 1 FROM user_graph_nodes n
        JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
        WHERE n.id = $3 AND n.user_id = $2 AND n.deleted_at IS NULL
          AND i.deleted_at IS NULL AND i.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM knowledge_item_supersessions s
            WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
          )
      ))
      AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = $4))
      AND ($5::text IS NULL OR EXISTS (
        SELECT 1 FROM user_graph_nodes n
        JOIN user_knowledge_items i ON i.id = n.knowledge_item_id AND i.user_id = n.user_id
        WHERE n.id = $5 AND n.user_id = $2 AND n.deleted_at IS NULL
          AND i.deleted_at IS NULL AND i.archived_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM knowledge_item_supersessions s
            WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
          )
      ))
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

  const resultOffsets = { edgeStart: 0, updateStart: 0 };
  const resultSets = await sql.transaction((tx) => {
    const queries = [
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
      tx.query(ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL, [deriveMcpDeletedAccountScopeKey(userId)]),
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-graph:${userId}`]),
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-items:${userId}`]),
      tx.query(
        `SELECT 1 / CASE WHEN (
           SELECT COUNT(*) FROM user_knowledge_items WHERE user_id = $1
         ) + $2 <= $3 THEN 1 ELSE 0 END AS item_quota_guard`,
        [userId, planned.length, MAX_KNOWLEDGE_ITEMS_PER_USER],
      ),
    ];
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
        `INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags,
           knowledge_type, central_question, structured_content, bundle_schema_version,
           version, dedupe_key)
         SELECT $1, $2, d.title, d.summary, CASE WHEN d.explanation <> '' THEN d.explanation ELSE d.summary END, d.topic, d.tags,
           d.knowledge_type, d.central_question, d.structured_content, d.bundle_schema_version,
           1, d.dedupe_key
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
          (id, user_id, knowledge_item_id, batch_id, draft_id, source_type, provider,
           conversation_ref, source_url, source_locator, discussed_at, relation_origin, confirmed_at)
         SELECT $1, $2, $3, b.id, d.id, 'conversation', b.provider, b.conversation_ref,
           b.source_url, $6::jsonb, b.discussed_at, 'extracted_from_source', NOW()
         FROM knowledge_card_drafts d JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
         WHERE d.id = $4 AND d.batch_id = $5 AND d.user_id = $2
           AND EXISTS (SELECT 1 FROM user_knowledge_items i WHERE i.id = $3 AND i.user_id = $2)
         ON CONFLICT DO NOTHING RETURNING id`,
        [
          plan.sourceId,
          userId,
          plan.itemId,
          plan.draft.id,
          batchId,
          JSON.stringify({
            batch_id: batchId,
            draft_id: plan.draft.id,
            client_card_id: plan.draft.client_card_id,
          }),
        ]
      ));
      queries.push(tx.query(
        `INSERT INTO knowledge_item_revisions
          (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), 'confirmed'
         FROM user_knowledge_items i WHERE i.id = $2 AND i.user_id = $3
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [plan.revisionId, plan.itemId, userId]
      ));
      queries.push(tx.query(
        `INSERT INTO knowledge_item_activity
          (id, user_id, knowledge_item_id, activity_type, metadata)
         VALUES ($1, $2, $3, 'confirmed', $4::jsonb)
         RETURNING id`,
        [
          plan.activityId,
          userId,
          plan.itemId,
          JSON.stringify({ resolution_action: 'create', batch_id: batchId, draft_id: plan.draft.id }),
        ]
      ));
      for (const [evidenceIndex, selector] of plan.draft.proposed_evidence.entries()) {
        queries.push(tx.query(
          `INSERT INTO knowledge_evidence_spans (
             id, user_id, knowledge_item_id, source_id, selector_type, selector,
             polarity, quality, relation_origin, confirmed_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW())
           RETURNING id`,
          [
            plan.evidenceIds[evidenceIndex],
            userId,
            plan.itemId,
            plan.sourceId,
            selector.selectorType,
            JSON.stringify(evidenceSelectorDocument(selector)),
            selector.polarity,
            selector.quality,
            selector.relationOrigin,
          ],
        ));
      }
    }
    resultOffsets.edgeStart = queries.length;
    for (const candidate of candidates) {
      queries.push(tx.query(edgeInsertSql, [
        randomUUID(), userId, candidate.source.privateNodeId, candidate.source.publicNodeId,
        candidate.target.privateNodeId, candidate.target.publicNodeId, candidate.relation.type,
        Math.max(0.05, Math.min(1, candidate.relation.weight ?? 1)), batchId, candidate.target.key, candidate.source.key,
        candidate.relation.relationOrigin ?? 'model_inferred',
      ]));
    }
    resultOffsets.updateStart = queries.length;
    for (const plan of planned) {
      queries.push(tx.query(
        `UPDATE knowledge_card_drafts SET status = 'approved', knowledge_item_id = $1,
           resolution_action = 'create', target_knowledge_item_id = NULL,
           resolved_at = NOW(), approved_at = NOW(), updated_at = NOW()
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
  }, { isolationLevel: 'ReadCommitted' });

  const edgeResults = resultSets.slice(resultOffsets.edgeStart, resultOffsets.edgeStart + candidates.length);
  const updateResults = resultSets.slice(resultOffsets.updateStart, resultOffsets.updateStart + planned.length);
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

type SanitizedReviewedKnowledgePayload = {
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  dedupe_key: string;
  observed_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  review_at: string | null;
  evidence_selectors: KnowledgeEvidenceSelector[];
};

function strictOptionalTimestamp(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  const sanitized = sanitizeTimestamp(value);
  if (!sanitized) throw new Error(`${fieldName} must be an ISO-8601 timestamp.`);
  return sanitized;
}

function sanitizeReviewedKnowledgePayload(input: ReviewedKnowledgePayload): SanitizedReviewedKnowledgePayload {
  const title = sanitizeKnowledgeTitle(input.title);
  if (!title) throw new Error('A reviewed knowledge item needs a title.');
  const hasBundleFields = Boolean(
    input.knowledgeType
    || input.centralQuestion
    || input.structuredContent
    || input.bundleSchemaVersion,
  );
  const bundle = hasBundleFields ? parseKnowledgeBundleFields({
    knowledge_type: input.knowledgeType,
    central_question: input.centralQuestion,
    structured_content: input.structuredContent,
    bundle_schema_version: input.bundleSchemaVersion,
  }) : null;
  if (hasBundleFields && !bundle) throw new Error('The reviewed structured knowledge bundle is invalid.');

  const rawSelectors = input.evidenceSelectors ?? [];
  const evidenceSelectors = sanitizeKnowledgeEvidenceSelectors(rawSelectors);
  if (evidenceSelectors.length !== rawSelectors.length) {
    throw new Error('One or more evidence selectors are invalid or contain source text.');
  }
  const topic = normalizeKnowledgeTopic(input.topic);
  const observedAt = strictOptionalTimestamp(input.observedAt, 'observedAt');
  const validFrom = strictOptionalTimestamp(input.validFrom, 'validFrom');
  const validTo = strictOptionalTimestamp(input.validTo, 'validTo');
  const reviewAt = strictOptionalTimestamp(input.reviewAt, 'reviewAt');
  if (validFrom && validTo && new Date(validTo).getTime() < new Date(validFrom).getTime()) {
    throw new Error('validTo must not be earlier than validFrom.');
  }
  return {
    title,
    summary: sanitizeKnowledgeContent(input.summary, 500),
    content: sanitizeKnowledgeContent(input.content, 6000),
    topic,
    tags: sanitizeKnowledgeTags(input.tags),
    knowledge_type: bundle?.knowledge_type ?? null,
    central_question: bundle?.central_question ?? null,
    structured_content: bundle?.structured_content ?? null,
    bundle_schema_version: bundle?.bundle_schema_version ?? null,
    dedupe_key: buildKnowledgeDedupeKey({
      title,
      topic,
      knowledgeType: bundle?.knowledge_type,
      centralQuestion: bundle?.central_question,
    }),
    observed_at: observedAt,
    valid_from: validFrom,
    valid_to: validTo,
    review_at: reviewAt,
    evidence_selectors: evidenceSelectors,
  };
}

function reviewedPayloadFromDraft(draft: KnowledgeCardDraft): SanitizedReviewedKnowledgePayload {
  return sanitizeReviewedKnowledgePayload({
    title: draft.title,
    summary: draft.summary,
    content: draft.explanation || draft.summary,
    topic: draft.topic,
    tags: draft.tags,
    knowledgeType: draft.knowledge_type,
    centralQuestion: draft.central_question,
    structuredContent: draft.structured_content,
    bundleSchemaVersion: draft.bundle_schema_version,
    evidenceSelectors: draft.proposed_evidence,
  });
}

function evidenceSelectorDocument(selector: KnowledgeEvidenceSelector): Record<string, unknown> {
  return {
    ...(selector.sourceRef ? { source_ref: selector.sourceRef } : {}),
    ...(selector.messageRef ? { message_ref: selector.messageRef } : {}),
    ...(selector.start !== undefined ? { start: selector.start } : {}),
    ...(selector.end !== undefined ? { end: selector.end } : {}),
    ...(selector.lineStart !== undefined ? { line_start: selector.lineStart } : {}),
    ...(selector.lineEnd !== undefined ? { line_end: selector.lineEnd } : {}),
  };
}

function evidenceSelectorFingerprint(selector: KnowledgeEvidenceSelector): string {
  return JSON.stringify([
    selector.selectorType,
    selector.sourceRef ?? null,
    selector.messageRef ?? null,
    selector.start ?? null,
    selector.end ?? null,
    selector.lineStart ?? null,
    selector.lineEnd ?? null,
    selector.polarity,
    selector.quality,
    selector.relationOrigin,
  ]);
}

function evidenceSelectorsAreExactSubset(
  selected: KnowledgeEvidenceSelector[],
  proposed: KnowledgeEvidenceSelector[],
): boolean {
  const remaining = new Map<string, number>();
  for (const selector of proposed) {
    const fingerprint = evidenceSelectorFingerprint(selector);
    remaining.set(fingerprint, (remaining.get(fingerprint) ?? 0) + 1);
  }
  for (const selector of selected) {
    const fingerprint = evidenceSelectorFingerprint(selector);
    const count = remaining.get(fingerprint) ?? 0;
    if (count < 1) return false;
    remaining.set(fingerprint, count - 1);
  }
  return true;
}

function refreshMemoryBatchResolutionState(batchId: string) {
  const batch = memoryBatches.get(batchId);
  if (!batch) return;
  const drafts = memoryDrafts.get(batchId) ?? [];
  batch.pending_count = drafts.filter((draft) => draft.status === 'pending').length;
  batch.approved_count = drafts.filter((draft) => draft.status === 'approved').length;
  batch.status = batch.pending_count > 0
    ? batch.approved_count > 0 ? 'partial' : 'pending'
    : batch.approved_count > 0 ? 'approved' : 'discarded';
  batch.updated_at = new Date().toISOString();
  batch.committed_at = batch.status === 'approved' ? batch.updated_at : null;
}

function recordMemoryConversationSource(
  userId: string,
  itemId: string,
  batch: MemoryBatchRecord,
  draft: KnowledgeCardDraft,
  selectors: KnowledgeEvidenceSelector[],
) {
  const sources = memoryKnowledgeSources.get(userId) ?? [];
  const existing = sources.find((source) => source.knowledge_item_id === itemId
    && source.source_locator?.draft_id === draft.id);
  const source = existing ?? {
    id: randomUUID(),
    knowledge_item_id: itemId,
    source_type: 'conversation',
    provider: batch.provider,
    conversation_ref: batch.conversation_ref,
    source_url: batch.source_url,
    source_locator: {
      batch_id: batch.id,
      draft_id: draft.id,
      client_card_id: draft.client_card_id,
    },
    discussed_at: batch.discussed_at,
    relation_origin: 'extracted_from_source' as const,
    confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  if (!existing) {
    sources.push(source);
    memoryKnowledgeSources.set(userId, sources);
  }
  const evidence = memoryEvidenceSelectors.get(userId) ?? [];
  for (const selector of selectors) {
    evidence.push({
      id: randomUUID(),
      knowledge_item_id: itemId,
      source_id: source.id,
      selector,
      created_at: new Date().toISOString(),
    });
  }
  memoryEvidenceSelectors.set(userId, evidence);
}

const UPDATE_BATCH_AFTER_RESOLUTION_SQL = `
  UPDATE knowledge_ingestion_batches b SET
    status = CASE
      WHEN EXISTS (
        SELECT 1 FROM knowledge_card_drafts d
        WHERE d.batch_id = b.id AND d.status = 'pending'
      ) THEN CASE WHEN EXISTS (
        SELECT 1 FROM knowledge_card_drafts d
        WHERE d.batch_id = b.id AND d.status = 'approved'
      ) THEN 'partial' ELSE 'pending' END
      WHEN EXISTS (
        SELECT 1 FROM knowledge_card_drafts d
        WHERE d.batch_id = b.id AND d.status = 'approved'
      ) THEN 'approved'
      ELSE 'discarded'
    END,
    committed_at = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM knowledge_card_drafts d
        WHERE d.batch_id = b.id AND d.status = 'pending'
      ) AND EXISTS (
        SELECT 1 FROM knowledge_card_drafts d
        WHERE d.batch_id = b.id AND d.status = 'approved'
      ) THEN COALESCE(b.committed_at, NOW())
      ELSE b.committed_at
    END,
    discarded_at = CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM knowledge_card_drafts d
        WHERE d.batch_id = b.id AND d.status IN ('pending', 'approved')
      ) THEN COALESCE(b.discarded_at, NOW())
      ELSE b.discarded_at
    END,
    updated_at = NOW()
  WHERE b.id = $1 AND b.user_id = $2
  RETURNING id`;

function isOptimisticGuardError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: unknown; message?: unknown };
  return value.code === '22012'
    || value.code === '40001'
    || value.code === '40P01'
    || String(value.message ?? '').toLocaleLowerCase().includes('division by zero');
}

export async function resolveKnowledgeDraftForUser(
  userId: string,
  input: ResolveKnowledgeDraftInput,
): Promise<ResolveKnowledgeDraftResult> {
  const context = await getKnowledgeDraftResolutionContextForUser(
    userId,
    input.draftId,
    input.targetKnowledgeItemId,
  );
  const draft = context?.draft;
  if (!draft || draft.batch_id !== input.batchId || draft.status !== 'pending'
    || !Number.isInteger(input.expectedDraftVersion)
    || draft.version !== input.expectedDraftVersion) {
    return { resolved: false, action: input.action, knowledgeItemId: null, version: null, stale: true };
  }
  if (!['create', 'merge', 'update', 'ignore'].includes(input.action)) {
    throw new Error('Unsupported draft resolution action.');
  }

  if (input.action === 'ignore') {
    if (!process.env.DATABASE_URL) {
      const batch = memoryBatches.get(input.batchId);
      const drafts = memoryDrafts.get(input.batchId) ?? [];
      const index = drafts.findIndex((candidate) => candidate.id === draft.id);
      if (!batch || batch.user_id !== userId || index < 0
        || drafts[index].status !== 'pending'
        || drafts[index].version !== input.expectedDraftVersion) {
        return { resolved: false, action: 'ignore', knowledgeItemId: null, version: null, stale: true };
      }
      drafts[index] = {
        ...drafts[index],
        status: 'rejected',
        resolution_action: 'ignore',
        target_knowledge_item_id: null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      refreshMemoryBatchResolutionState(input.batchId);
      return { resolved: true, action: 'ignore', knowledgeItemId: null, version: null };
    }

    await ensureKnowledgeIngestionSchema();
    try {
      const sql = getTransactionSql();
      await sql.transaction((tx) => [
        tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-draft:${userId}:${input.batchId}`]),
        tx.query(
          `SELECT 1 / CASE WHEN EXISTS (
             SELECT 1 FROM knowledge_card_drafts d
             JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
             WHERE d.id = $1 AND d.batch_id = $2 AND d.user_id = $3
               AND d.status = 'pending' AND d.version = $4 AND b.status <> 'discarded'
           ) THEN 1 ELSE 0 END AS version_guard`,
          [input.draftId, input.batchId, userId, input.expectedDraftVersion],
        ),
        tx.query(
          `UPDATE knowledge_card_drafts SET status = 'rejected', resolution_action = 'ignore',
             target_knowledge_item_id = NULL, resolved_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND batch_id = $2 AND user_id = $3
             AND status = 'pending' AND version = $4
           RETURNING id`,
          [input.draftId, input.batchId, userId, input.expectedDraftVersion],
        ),
        tx.query(UPDATE_BATCH_AFTER_RESOLUTION_SQL, [input.batchId, userId]),
      ], { isolationLevel: 'Serializable' });
      return { resolved: true, action: 'ignore', knowledgeItemId: null, version: null };
    } catch (error) {
      if (isOptimisticGuardError(error)) {
        return { resolved: false, action: 'ignore', knowledgeItemId: null, version: null, stale: true };
      }
      throw error;
    }
  }

  const target = context?.target;
  if (input.action !== 'create') {
    if (!input.reviewed) throw new Error('Merge and update require a final reviewed payload.');
    if (!input.targetKnowledgeItemId || !target
      || !Number.isInteger(input.expectedTargetVersion)
      || target.version !== input.expectedTargetVersion) {
      return { resolved: false, action: input.action, knowledgeItemId: null, version: null, stale: true };
    }
  }
  const payload = input.reviewed
    ? sanitizeReviewedKnowledgePayload(input.reviewed)
    : reviewedPayloadFromDraft(draft);
  if (input.reviewed
    && !evidenceSelectorsAreExactSubset(payload.evidence_selectors, draft.proposed_evidence)) {
    throw new Error('Reviewed evidence selectors must be an exact subset of the persisted draft evidence.');
  }
  const itemId = input.action === 'create' ? randomUUID() : input.targetKnowledgeItemId!;
  const nextVersion = input.action === 'create' ? 1 : input.expectedTargetVersion! + 1;
  const selectors = input.reviewed ? payload.evidence_selectors : draft.proposed_evidence;

  if (!process.env.DATABASE_URL) {
    if (input.action === 'create'
      && (memoryKnowledgeItems.get(userId) ?? []).length >= MAX_KNOWLEDGE_ITEMS_PER_USER) {
      throw new Error('Knowledge item quota exceeded.');
    }
    const batch = memoryBatches.get(input.batchId);
    const drafts = memoryDrafts.get(input.batchId) ?? [];
    const index = drafts.findIndex((candidate) => candidate.id === draft.id);
    if (!batch || batch.user_id !== userId || index < 0
      || drafts[index].status !== 'pending'
      || drafts[index].version !== input.expectedDraftVersion) {
      return { resolved: false, action: input.action, knowledgeItemId: null, version: null, stale: true };
    }
    let item: MemoryKnowledgeItem | undefined;
    if (input.action === 'create') {
      item = createMemoryKnowledgeItemForUser(userId, {
        id: itemId,
        title: payload.title,
        summary: payload.summary,
        content: payload.content,
        topic: payload.topic,
        tags: payload.tags,
        origin: 'conversation',
        knowledgeType: payload.knowledge_type,
        centralQuestion: payload.central_question,
        structuredContent: payload.structured_content,
        bundleSchemaVersion: payload.bundle_schema_version,
        observedAt: payload.observed_at,
        validFrom: payload.valid_from,
        validTo: payload.valid_to,
        reviewAt: payload.review_at,
      });
    } else {
      const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
        .map((entry) => entry.superseded_item_id));
      const current = getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === itemId
        && !candidate.deleted_at && !candidate.archived_at && !supersededIds.has(candidate.id));
      if (!current || current.version !== input.expectedTargetVersion) {
        return { resolved: false, action: input.action, knowledgeItemId: null, version: null, stale: true };
      }
      updateMemoryKnowledgeItemForUser(userId, itemId, {
        title: payload.title,
        summary: payload.summary,
        content: payload.content,
        topic: payload.topic,
        tags: payload.tags,
        knowledgeType: payload.knowledge_type,
        centralQuestion: payload.central_question,
        structuredContent: payload.structured_content,
        bundleSchemaVersion: payload.bundle_schema_version,
        observedAt: payload.observed_at,
        validFrom: payload.valid_from,
        validTo: payload.valid_to,
        reviewAt: payload.review_at,
      }, { activityMetadata: { resolution_action: input.action, batch_id: input.batchId, draft_id: draft.id } });
      item = getMemoryKnowledgeItemsForUser(userId).find((candidate) => candidate.id === itemId);
    }
    if (!item) return { resolved: false, action: input.action, knowledgeItemId: null, version: null };
    recordMemoryConversationSource(userId, item.id, batch, draft, selectors);
    drafts[index] = {
      ...drafts[index],
      status: 'approved',
      knowledge_item_id: item.id,
      resolution_action: input.action,
      target_knowledge_item_id: input.action === 'create' ? null : item.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    refreshMemoryBatchResolutionState(input.batchId);
    return { resolved: true, action: input.action, knowledgeItemId: item.id, version: item.version };
  }

  await ensureKnowledgeIngestionSchema();
  const sourceId = randomUUID();
  const nodeId = randomUUID();
  const activityId = randomUUID();
  const activityMetadata = JSON.stringify({
    resolution_action: input.action,
    batch_id: input.batchId,
    draft_id: input.draftId,
  });
  const sourceLocator = JSON.stringify({
    batch_id: input.batchId,
    draft_id: input.draftId,
    client_card_id: draft.client_card_id,
  });
  try {
    const sql = getTransactionSql();
    await sql.transaction((tx) => {
      const queries = [
        tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
        tx.query(ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL, [deriveMcpDeletedAccountScopeKey(userId)]),
        tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-draft:${userId}:${input.batchId}`]),
        tx.query(
          `SELECT 1 / CASE WHEN EXISTS (
             SELECT 1 FROM knowledge_card_drafts d
             JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
             WHERE d.id = $1 AND d.batch_id = $2 AND d.user_id = $3
               AND d.status = 'pending' AND d.version = $4 AND b.status <> 'discarded'
           ) THEN 1 ELSE 0 END AS draft_version_guard`,
          [input.draftId, input.batchId, userId, input.expectedDraftVersion],
        ),
      ];
      if (input.action !== 'create') {
        queries.push(tx.query(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          [`knowledge-item:${userId}:${itemId}`],
        ));
      } else {
        queries.push(
          tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-items:${userId}`]),
          tx.query(
            `SELECT 1 / CASE WHEN (
               SELECT COUNT(*) FROM user_knowledge_items WHERE user_id = $1
             ) < $2 THEN 1 ELSE 0 END AS item_quota_guard`,
            [userId, MAX_KNOWLEDGE_ITEMS_PER_USER],
          ),
        );
      }
      if (input.action === 'create') {
        queries.push(tx.query(
          `INSERT INTO user_knowledge_items (
             id, user_id, title, summary, content, topic, tags,
             knowledge_type, central_question, structured_content, bundle_schema_version,
             version, dedupe_key, observed_at, valid_from, valid_to, review_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7::jsonb,
             $8, $9, $10::jsonb, $11, 1, $12, $13, $14, $15, $16
           )
           RETURNING id`,
          [
            itemId, userId, payload.title, payload.summary, payload.content, payload.topic,
            JSON.stringify(payload.tags), payload.knowledge_type, payload.central_question,
            payload.structured_content ? JSON.stringify(payload.structured_content) : null,
            payload.bundle_schema_version, payload.dedupe_key, payload.observed_at,
            payload.valid_from, payload.valid_to, payload.review_at,
          ],
        ));
      } else {
        queries.push(tx.query(
          `SELECT 1 / CASE WHEN EXISTS (
             SELECT 1 FROM user_knowledge_items i
             WHERE i.id = $1 AND i.user_id = $2 AND i.version = $3
               AND i.deleted_at IS NULL AND i.archived_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM knowledge_item_supersessions s
                 WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
               )
           ) THEN 1 ELSE 0 END AS target_version_guard`,
          [itemId, userId, input.expectedTargetVersion],
        ));
        queries.push(tx.query(
          `INSERT INTO knowledge_item_revisions
             (id, user_id, knowledge_item_id, version, snapshot, change_reason)
           SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), $4
           FROM user_knowledge_items i
           WHERE i.id = $2 AND i.user_id = $3 AND i.version = $5
           ON CONFLICT (knowledge_item_id, version) DO NOTHING
           RETURNING id`,
          [randomUUID(), itemId, userId, `before_${input.action}`, input.expectedTargetVersion],
        ));
        queries.push(tx.query(
          `UPDATE user_knowledge_items SET
             title = $3, summary = $4, content = $5, topic = $6, tags = $7::jsonb,
             knowledge_type = $8, central_question = $9, structured_content = $10::jsonb,
             bundle_schema_version = $11, dedupe_key = $12, observed_at = $13,
             valid_from = $14, valid_to = $15, review_at = $16,
             last_verified_at = NULL, version = version + 1, updated_at = NOW()
           WHERE id = $1 AND user_id = $2 AND version = $17
             AND deleted_at IS NULL AND archived_at IS NULL
           RETURNING id`,
          [
            itemId, userId, payload.title, payload.summary, payload.content, payload.topic,
            JSON.stringify(payload.tags), payload.knowledge_type, payload.central_question,
            payload.structured_content ? JSON.stringify(payload.structured_content) : null,
            payload.bundle_schema_version, payload.dedupe_key, payload.observed_at,
            payload.valid_from, payload.valid_to, payload.review_at, input.expectedTargetVersion,
          ],
        ));
      }
      queries.push(
        tx.query(
          `INSERT INTO knowledge_item_revisions
             (id, user_id, knowledge_item_id, version, snapshot, change_reason)
           SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), $4
           FROM user_knowledge_items i
           WHERE i.id = $2 AND i.user_id = $3
           ON CONFLICT (knowledge_item_id, version) DO NOTHING
           RETURNING id`,
          [randomUUID(), itemId, userId, input.action === 'create' ? 'confirmed' : input.action],
        ),
        tx.query(
          `INSERT INTO user_graph_nodes
             (id, user_id, knowledge_item_id, label, topic, origin, source_batch_id)
           SELECT $1, i.user_id, i.id, i.title, i.topic, 'conversation', $4
           FROM user_knowledge_items i
           WHERE i.id = $2 AND i.user_id = $3
           ON CONFLICT (user_id, knowledge_item_id) DO UPDATE SET
             label = EXCLUDED.label, topic = EXCLUDED.topic, updated_at = NOW(),
             deleted_at = NULL, purge_at = NULL
           RETURNING id`,
          [nodeId, itemId, userId, input.batchId],
        ),
        tx.query(
          `INSERT INTO knowledge_card_sources (
             id, user_id, knowledge_item_id, batch_id, draft_id, source_type,
             provider, conversation_ref, source_url, source_locator, discussed_at,
             relation_origin, confirmed_at
           )
           SELECT $1, $2, $3, b.id, d.id, 'conversation', b.provider,
             b.conversation_ref, b.source_url, $6::jsonb, b.discussed_at,
             'extracted_from_source', NOW()
           FROM knowledge_card_drafts d
           JOIN knowledge_ingestion_batches b ON b.id = d.batch_id AND b.user_id = d.user_id
           WHERE d.id = $4 AND d.batch_id = $5 AND d.user_id = $2
           ON CONFLICT (knowledge_item_id, draft_id) DO NOTHING
           RETURNING id`,
          [sourceId, userId, itemId, input.draftId, input.batchId, sourceLocator],
        ),
      );
      for (const selector of selectors) {
        queries.push(tx.query(
          `INSERT INTO knowledge_evidence_spans (
             id, user_id, knowledge_item_id, source_id, selector_type, selector,
             polarity, quality, relation_origin, confirmed_at
           ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW())
           RETURNING id`,
          [
            randomUUID(), userId, itemId, sourceId, selector.selectorType,
            JSON.stringify(evidenceSelectorDocument(selector)), selector.polarity,
            selector.quality, selector.relationOrigin,
          ],
        ));
      }
      queries.push(
        tx.query(
           `UPDATE knowledge_card_drafts SET
             status = 'approved', knowledge_item_id = $1, resolution_action = $2,
             target_knowledge_item_id = CASE WHEN $2 = 'create' THEN NULL ELSE $1 END,
             resolved_at = NOW(), approved_at = NOW(), updated_at = NOW()
           WHERE id = $3 AND batch_id = $4 AND user_id = $5
             AND status = 'pending' AND version = $6
           RETURNING id`,
          [itemId, input.action, input.draftId, input.batchId, userId, input.expectedDraftVersion],
        ),
        tx.query(
          `INSERT INTO knowledge_item_activity
             (id, user_id, knowledge_item_id, activity_type, metadata)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING id`,
          [activityId, userId, itemId, input.action === 'create' ? 'confirmed' : 'revised', activityMetadata],
        ),
        tx.query(UPDATE_BATCH_AFTER_RESOLUTION_SQL, [input.batchId, userId]),
      );
      return queries;
    }, { isolationLevel: 'ReadCommitted' });
    return { resolved: true, action: input.action, knowledgeItemId: itemId, version: nextVersion };
  } catch (error) {
    if (isOptimisticGuardError(error)) {
      return { resolved: false, action: input.action, knowledgeItemId: null, version: null, stale: true };
    }
    throw error;
  }
}

export async function verifyKnowledgeItemForUser(
  userId: string,
  itemId: string,
  expectedVersion: number,
  reviewAt?: string | null,
): Promise<{ verified: boolean; version: number | null; stale?: boolean }> {
  const normalizedReviewAt = reviewAt === undefined
    ? undefined
    : strictOptionalTimestamp(reviewAt, 'reviewAt');
  const verifiedAt = new Date().toISOString();
  if (!process.env.DATABASE_URL) {
    const items = memoryKnowledgeItems.get(userId) ?? [];
    const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
      .map((entry) => entry.superseded_item_id));
    const index = items.findIndex((item) => item.id === itemId
      && !item.deleted_at && !item.archived_at && !supersededIds.has(item.id));
    if (index < 0 || items[index].version !== expectedVersion) {
      return { verified: false, version: null, stale: true };
    }
    recordMemoryRevision(userId, items[index]);
    items[index] = {
      ...items[index],
      version: items[index].version + 1,
      last_verified_at: verifiedAt,
      review_at: normalizedReviewAt === undefined ? items[index].review_at : normalizedReviewAt,
      updated_at: verifiedAt,
    };
    recordMemoryRevision(userId, items[index]);
    recordMemoryActivity(userId, itemId, 'verified', {
      ...(normalizedReviewAt === undefined ? {} : { review_at: normalizedReviewAt }),
    });
    memoryNodes.set(userId, (memoryNodes.get(userId) ?? []).map((node) => node.knowledge_item_id === itemId
      ? {
          ...node,
          version: node.version + 1,
          last_verified_at: verifiedAt,
          review_at: normalizedReviewAt === undefined ? node.review_at : normalizedReviewAt,
        }
      : node));
    return { verified: true, version: items[index].version };
  }

  await ensureKnowledgeIngestionSchema();
  try {
    const sql = getTransactionSql();
    await sql.transaction((tx) => [
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
      tx.query(ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL, [deriveMcpDeletedAccountScopeKey(userId)]),
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-item:${userId}:${itemId}`]),
      tx.query(
        `SELECT 1 / CASE WHEN EXISTS (
           SELECT 1 FROM user_knowledge_items i
           WHERE i.id = $1 AND i.user_id = $2 AND i.version = $3
             AND i.deleted_at IS NULL AND i.archived_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM knowledge_item_supersessions s
               WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
             )
         ) THEN 1 ELSE 0 END AS version_guard`,
        [itemId, userId, expectedVersion],
      ),
      tx.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), 'before_verify'
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3 AND i.version = $4
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [randomUUID(), itemId, userId, expectedVersion],
      ),
      tx.query(
        `UPDATE user_knowledge_items SET
           last_verified_at = NOW(),
           review_at = CASE WHEN $4::boolean THEN $3::timestamptz ELSE review_at END,
           version = version + 1, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND version = $5
           AND deleted_at IS NULL AND archived_at IS NULL
         RETURNING id`,
        [itemId, userId, normalizedReviewAt ?? null, normalizedReviewAt !== undefined, expectedVersion],
      ),
      tx.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), 'verified'
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3 AND i.version = $4
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [randomUUID(), itemId, userId, expectedVersion + 1],
      ),
      tx.query(
        `INSERT INTO knowledge_item_activity
           (id, user_id, knowledge_item_id, activity_type, metadata)
         VALUES ($1, $2, $3, 'verified', $4::jsonb)
         RETURNING id`,
        [
          randomUUID(), userId, itemId,
          JSON.stringify(normalizedReviewAt === undefined ? {} : { review_at: normalizedReviewAt }),
        ],
      ),
    ], { isolationLevel: 'ReadCommitted' });
    return { verified: true, version: expectedVersion + 1 };
  } catch (error) {
    if (isOptimisticGuardError(error)) return { verified: false, version: null, stale: true };
    throw error;
  }
}

export type KnowledgeArchiveResult = {
  archived: boolean;
  version: number | null;
  stale?: boolean;
};

async function setKnowledgeArchivedStateForUser(
  userId: string,
  itemId: string,
  expectedVersion: number,
  archive: boolean,
): Promise<KnowledgeArchiveResult> {
  const changedAt = new Date().toISOString();
  const activityType: KnowledgeItemActivityType = archive ? 'archived' : 'restored';
  if (!process.env.DATABASE_URL) {
    const items = memoryKnowledgeItems.get(userId) ?? [];
    const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
      .map((entry) => entry.superseded_item_id));
    const index = items.findIndex((item) => item.id === itemId
      && !item.deleted_at
      && !supersededIds.has(item.id)
      && (archive ? !item.archived_at : Boolean(item.archived_at)));
    if (index < 0 || items[index].version !== expectedVersion) {
      return { archived: false, version: null, stale: true };
    }
    recordMemoryRevision(userId, items[index]);
    items[index] = {
      ...items[index],
      version: items[index].version + 1,
      archived_at: archive ? changedAt : null,
      last_verified_at: null,
      updated_at: changedAt,
    };
    recordMemoryRevision(userId, items[index]);
    recordMemoryActivity(userId, itemId, activityType, { lifecycle: 'archive' });
    memoryNodes.set(userId, (memoryNodes.get(userId) ?? []).map((node) => node.knowledge_item_id === itemId
      ? {
          ...node,
          version: node.version + 1,
          archived_at: archive ? changedAt : null,
          last_verified_at: null,
        }
      : node));
    return { archived: archive, version: items[index].version };
  }

  await ensureKnowledgeIngestionSchema();
  try {
    const sql = getTransactionSql();
    await sql.transaction((tx) => [
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
      tx.query(ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL, [deriveMcpDeletedAccountScopeKey(userId)]),
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-item:${userId}:${itemId}`]),
      tx.query(
        `SELECT 1 / CASE WHEN EXISTS (
           SELECT 1 FROM user_knowledge_items i
           WHERE i.id = $1 AND i.user_id = $2 AND i.version = $3
             AND i.deleted_at IS NULL
             AND (($4::boolean AND i.archived_at IS NULL)
               OR (NOT $4::boolean AND i.archived_at IS NOT NULL))
             AND NOT EXISTS (
               SELECT 1 FROM knowledge_item_supersessions s
               WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
             )
         ) THEN 1 ELSE 0 END AS archive_guard`,
        [itemId, userId, expectedVersion, archive],
      ),
      tx.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), $5
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3 AND i.version = $4
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [randomUUID(), itemId, userId, expectedVersion, archive ? 'before_archive' : 'before_unarchive'],
      ),
      tx.query(
        `UPDATE user_knowledge_items SET
           archived_at = CASE WHEN $4::boolean THEN NOW() ELSE NULL END,
           last_verified_at = NULL, version = version + 1, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND version = $3
           AND deleted_at IS NULL
         RETURNING id`,
        [itemId, userId, expectedVersion, archive],
      ),
      tx.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), $5
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3 AND i.version = $4
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [randomUUID(), itemId, userId, expectedVersion + 1, archive ? 'archived' : 'unarchived'],
      ),
      tx.query(
        `INSERT INTO knowledge_item_activity
           (id, user_id, knowledge_item_id, activity_type, metadata)
         VALUES ($1, $2, $3, $4, '{"lifecycle":"archive"}'::jsonb)
         RETURNING id`,
        [randomUUID(), userId, itemId, activityType],
      ),
    ], { isolationLevel: 'ReadCommitted' });
    return { archived: archive, version: expectedVersion + 1 };
  } catch (error) {
    if (isOptimisticGuardError(error)) return { archived: false, version: null, stale: true };
    throw error;
  }
}

export async function archiveKnowledgeItemForUser(
  userId: string,
  itemId: string,
  expectedVersion: number,
): Promise<KnowledgeArchiveResult> {
  return setKnowledgeArchivedStateForUser(userId, itemId, expectedVersion, true);
}

export async function restoreArchivedKnowledgeItemForUser(
  userId: string,
  itemId: string,
  expectedVersion: number,
): Promise<KnowledgeArchiveResult> {
  return setKnowledgeArchivedStateForUser(userId, itemId, expectedVersion, false);
}

export async function supersedeKnowledgeItemForUser(
  userId: string,
  supersededItemId: string,
  supersedingItemId: string,
  expectedVersion: number,
  reasonInput: string,
): Promise<{ superseded: boolean; stale?: boolean }> {
  if (!supersededItemId || !supersedingItemId || supersededItemId === supersedingItemId) {
    return { superseded: false };
  }
  const reason = sanitizeKnowledgeContent(reasonInput, 500);
  const supersessionEdge = {
    sourceItemId: supersedingItemId,
    targetItemId: supersededItemId,
  };
  if (!process.env.DATABASE_URL) {
    const items = getMemoryKnowledgeItemsForUser(userId);
    const alreadySuperseded = new Set((memoryItemSupersessions.get(userId) ?? [])
      .map((entry) => entry.superseded_item_id));
    const superseded = items.find((item) => item.id === supersededItemId && !item.deleted_at && !item.archived_at);
    const replacement = items.find((item) => item.id === supersedingItemId
      && !item.deleted_at && !item.archived_at && !alreadySuperseded.has(item.id));
    if (!superseded || !replacement || superseded.version !== expectedVersion) {
      return { superseded: false, stale: true };
    }
    const supersessions = memoryItemSupersessions.get(userId) ?? [];
    if (alreadySuperseded.has(supersededItemId)) {
      return { superseded: false };
    }
    const source = await resolveEndpointForUser(userId, `personal:${supersessionEdge.sourceItemId}`, {
      allowPublic: false,
      createPersonalNode: true,
    });
    const target = await resolveEndpointForUser(userId, `personal:${supersessionEdge.targetItemId}`, {
      allowPublic: false,
      createPersonalNode: true,
    });
    if (!source || !target) return { superseded: false };
    const supersededAt = new Date().toISOString();
    recordMemoryRevision(userId, superseded);
    superseded.version += 1;
    superseded.updated_at = supersededAt;
    recordMemoryRevision(userId, superseded);
    memoryNodes.set(userId, (memoryNodes.get(userId) ?? []).map((node) => node.knowledge_item_id === supersededItemId
      ? { ...node, version: node.version + 1 }
      : node));
    supersessions.push({
      id: randomUUID(),
      superseded_item_id: supersededItemId,
      superseding_item_id: supersedingItemId,
      reason,
      created_at: supersededAt,
    });
    memoryItemSupersessions.set(userId, supersessions);
    await insertResolvedEdgeForUser(
      userId,
      source,
      target,
      'supersedes',
      1,
      'manual',
      null,
      'explicit_user',
    );
    recordMemoryActivity(userId, supersededItemId, 'superseded', {
      replacement_item_id: supersedingItemId,
      ...(reason ? { reason } : {}),
    });
    recordMemoryActivity(userId, supersedingItemId, 'connected', {
      superseded_item_id: supersededItemId,
    });
    return { superseded: true };
  }

  await ensureKnowledgeIngestionSchema();
  const supersessionId = randomUUID();
  try {
    const sql = getTransactionSql();
    await sql.transaction((tx) => {
      const [firstItemId, secondItemId] = [supersededItemId, supersedingItemId].sort();
      return [
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [deriveMcpAccountAdvisoryLockKey(userId)]),
      tx.query(ACTIVE_ACCOUNT_MARKER_ASSERTION_SQL, [deriveMcpDeletedAccountScopeKey(userId)]),
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-item:${userId}:${firstItemId}`]),
      tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`knowledge-item:${userId}:${secondItemId}`]),
      tx.query(
        `SELECT 1 / CASE WHEN
           $1::text <> $2::text
           AND EXISTS (
             SELECT 1 FROM user_knowledge_items i
             WHERE i.id = $1 AND i.user_id = $3 AND i.version = $4
               AND i.deleted_at IS NULL AND i.archived_at IS NULL
           )
           AND EXISTS (
             SELECT 1 FROM user_knowledge_items i
             WHERE i.id = $2 AND i.user_id = $3
               AND i.deleted_at IS NULL AND i.archived_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM knowledge_item_supersessions replacement_state
                 WHERE replacement_state.user_id = i.user_id
                   AND replacement_state.superseded_item_id = i.id
               )
           )
           AND NOT EXISTS (
             SELECT 1 FROM knowledge_item_supersessions s
             WHERE s.user_id = $3 AND s.superseded_item_id = $1
           )
         THEN 1 ELSE 0 END AS version_guard`,
        [supersededItemId, supersedingItemId, userId, expectedVersion],
      ),
      tx.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), 'before_supersede'
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3 AND i.version = $4
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [randomUUID(), supersededItemId, userId, expectedVersion],
      ),
      tx.query(
        `UPDATE user_knowledge_items
         SET version = version + 1, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND version = $3
           AND deleted_at IS NULL AND archived_at IS NULL
         RETURNING id`,
        [supersededItemId, userId, expectedVersion],
      ),
      tx.query(
        `INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $1, i.user_id, i.id, i.version, to_jsonb(i), 'superseded'
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3 AND i.version = $4
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
         RETURNING id`,
        [randomUUID(), supersededItemId, userId, expectedVersion + 1],
      ),
      tx.query(
        `INSERT INTO user_graph_nodes
           (id, user_id, knowledge_item_id, label, topic, origin)
         SELECT $1, i.user_id, i.id, i.title, i.topic, 'manual'
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3
         ON CONFLICT (user_id, knowledge_item_id) DO UPDATE SET
           label = EXCLUDED.label, topic = EXCLUDED.topic, updated_at = NOW(),
           deleted_at = NULL, purge_at = NULL
         RETURNING id`,
        [randomUUID(), supersededItemId, userId],
      ),
      tx.query(
        `INSERT INTO user_graph_nodes
           (id, user_id, knowledge_item_id, label, topic, origin)
         SELECT $1, i.user_id, i.id, i.title, i.topic, 'manual'
         FROM user_knowledge_items i
         WHERE i.id = $2 AND i.user_id = $3
         ON CONFLICT (user_id, knowledge_item_id) DO UPDATE SET
           label = EXCLUDED.label, topic = EXCLUDED.topic, updated_at = NOW(),
           deleted_at = NULL, purge_at = NULL
         RETURNING id`,
        [randomUUID(), supersedingItemId, userId],
      ),
      tx.query(
        `INSERT INTO knowledge_item_supersessions
           (id, user_id, superseded_item_id, replacement_item_id, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [supersessionId, userId, supersededItemId, supersedingItemId, reason || null],
      ),
      tx.query(
        `INSERT INTO user_graph_edges (
           id, user_id, source_private_node_id, target_private_node_id,
           type, weight, origin, relation_origin, confirmed_at
         )
         SELECT $1, $2, source_node.id, target_node.id,
           'supersedes', 1, 'manual', 'explicit_user', NOW()
         FROM user_graph_nodes source_node
         JOIN user_graph_nodes target_node ON target_node.user_id = source_node.user_id
         WHERE source_node.user_id = $2
           AND source_node.knowledge_item_id = $3
           AND target_node.knowledge_item_id = $4
           AND source_node.deleted_at IS NULL AND target_node.deleted_at IS NULL
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [randomUUID(), userId, supersessionEdge.sourceItemId, supersessionEdge.targetItemId],
      ),
      tx.query(
        `INSERT INTO knowledge_item_activity
           (id, user_id, knowledge_item_id, activity_type, metadata)
         VALUES ($1, $2, $3, 'superseded', $4::jsonb)
         RETURNING id`,
        [
          randomUUID(), userId, supersededItemId,
          JSON.stringify({ replacement_item_id: supersedingItemId, ...(reason ? { reason } : {}) }),
        ],
      ),
      tx.query(
        `INSERT INTO knowledge_item_activity
           (id, user_id, knowledge_item_id, activity_type, metadata)
         VALUES ($1, $2, $3, 'connected', $4::jsonb)
         RETURNING id`,
        [randomUUID(), userId, supersedingItemId, JSON.stringify({ superseded_item_id: supersededItemId })],
      ),
    ];
    }, { isolationLevel: 'ReadCommitted' });
    return { superseded: true };
  } catch (error) {
    if (isOptimisticGuardError(error)) return { superseded: false, stale: true };
    throw error;
  }
}

export type KnowledgeReuseMetadata = {
  topic?: string;
  format?: 'json' | 'markdown' | 'yaml';
  count?: number;
  selectionType?: 'items' | 'recent_topic';
};

export async function recordKnowledgeReuseForUser(
  userId: string,
  itemIdsInput: string[],
  metadata: KnowledgeReuseMetadata = {},
): Promise<number> {
  const itemIds = Array.from(new Set(itemIdsInput
    .map((itemId) => sanitizeIdentifier(itemId, 160))
    .filter(Boolean)))
    .slice(0, MAX_KNOWLEDGE_REUSE_ITEMS);
  if (!userId || itemIds.length === 0) return 0;
  const safeMetadata = {
    ...(metadata.topic ? { topic: normalizeKnowledgeTopic(metadata.topic) } : {}),
    ...(metadata.format && ['json', 'markdown', 'yaml'].includes(metadata.format)
      ? { format: metadata.format }
      : {}),
    ...(metadata.selectionType === 'items' || metadata.selectionType === 'recent_topic'
      ? { selection_type: metadata.selectionType }
      : {}),
    count: Math.max(0, Math.min(itemIds.length, Math.trunc(metadata.count ?? itemIds.length))),
  };
  if (!process.env.DATABASE_URL) {
    const supersededIds = new Set((memoryItemSupersessions.get(userId) ?? [])
      .map((entry) => entry.superseded_item_id));
    const ownedActiveIds = new Set(getMemoryKnowledgeItemsForUser(userId)
      .filter((item) => itemIds.includes(item.id) && !item.deleted_at
        && !item.archived_at && !supersededIds.has(item.id))
      .map((item) => item.id));
    for (const itemId of itemIds) {
      if (ownedActiveIds.has(itemId)) recordMemoryActivity(userId, itemId, 'reused', safeMetadata);
    }
    return ownedActiveIds.size;
  }

  await ensureKnowledgeIngestionSchema();
  const resultSets = await pool.transaction<{ id: string }>([
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [deriveMcpAccountAdvisoryLockKey(userId)],
    },
    {
      text: `INSERT INTO knowledge_item_activity
       (id, user_id, knowledge_item_id, activity_type, metadata)
     SELECT md5(random()::text || clock_timestamp()::text || i.id), i.user_id, i.id,
       'reused', $3::jsonb
     FROM user_knowledge_items i
     JOIN unnest($2::text[]) requested(id) ON requested.id = i.id
     WHERE i.user_id = $1 AND i.deleted_at IS NULL AND i.archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM mcp_deleted_account_markers marker WHERE marker.scope_key = $4
       )
       AND NOT EXISTS (
         SELECT 1 FROM knowledge_item_supersessions s
         WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
       )
     RETURNING id`,
      params: [
        userId,
        itemIds,
        JSON.stringify(safeMetadata),
        deriveMcpDeletedAccountScopeKey(userId),
      ],
    },
  ], { isolationLevel: 'ReadCommitted' });
  return resultSets[1]?.rows.length ?? 0;
}
