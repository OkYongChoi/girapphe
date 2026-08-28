'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import pool from '@/lib/db';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import { requireCurrentActor } from '@/lib/auth';
import {
  GUEST_KNOWLEDGE_ITEM_LIMIT,
  GUEST_KNOWLEDGE_RETENTION_DAYS,
  GUEST_KNOWLEDGE_WRITES_PER_HOUR,
  getGuestKnowledgeRateScope,
  normalizeKnowledgeRequestId,
} from '@/lib/guest-knowledge-admission';
import { PERSONAL_CARD_RETENTION_DAYS } from '@/lib/personal-knowledge';
import { canRunRuntimeSchemaBootstrap } from '@/lib/schema-bootstrap';
import {
  archiveKnowledgeItemForUser,
  buildKnowledgeDedupeKey,
  createMemoryKnowledgeItemForUser,
  createPrivateKnowledgeEdgeForUser,
  ensureKnowledgeIngestionSchema,
  getKnowledgeDraftResolutionContextForUser,
  getMemoryKnowledgeItemsForUser,
  getMemoryKnowledgeSupersessionsForUser,
  hasMemoryCreateRequest,
  normalizeKnowledgeTopic,
  purgeMemoryKnowledgeItemsForUser,
  resolveKnowledgeDraftForUser,
  restoreMemoryKnowledgeItemForUser,
  restoreArchivedKnowledgeItemForUser,
  sanitizeKnowledgeEvidenceSelectors,
  sanitizeKnowledgeContent,
  sanitizeKnowledgeTags,
  sanitizeKnowledgeTitle,
  softDeleteMemoryKnowledgeItemForUser,
  supersedeKnowledgeItemForUser,
  updateMemoryKnowledgeItemForUser,
  verifyKnowledgeItemForUser,
  type KnowledgeDraftResolutionContext,
  type KnowledgeEvidenceSelector,
  type KnowledgeItemUpdateResult,
  type ResolveKnowledgeDraftResult,
  type ReviewedKnowledgePayload,
  MAX_KNOWLEDGE_ITEMS_PER_USER,
} from '@/lib/knowledge-ingestion';
import { parseKnowledgeBundleFields, projectKnowledgeBundle, type KnowledgeBundleFields } from '@/lib/knowledge-bundle-runtime';
import { KNOWLEDGE_ITEM_UPDATE_QUERY } from '@/lib/knowledge-item-update-query';
import {
  readKnowledgeResolutionTimestampField,
  readOptionalTimestampPatchField,
} from '@/lib/local-datetime';
import { getTopicKnowledgeHubForUser, type TopicKnowledgeHub } from '@/lib/topic-knowledge-hub';

export type UserKnowledgeItem = {
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
  last_verified_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  purge_at: string | null;
  source_provider?: string | null;
  source_batch_id?: string | null;
};

export type UserKnowledgeOverview = {
  count: number;
  graphNotes: Array<Pick<UserKnowledgeItem, 'id' | 'title' | 'topic'>>;
};

let schemaReady = false;
const memoryGuestWriteWindows = new Map<string, { startedAt: number; count: number }>();

function readStringField(formData: FormData, name: string, maxLength: number, required = false): string {
  const value = formData.get(name);
  if (value === null) {
    if (required) throw new Error(`Missing ${name}.`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`Invalid ${name}.`);
  const normalized = value.normalize('NFKC').trim();
  if ((required && !normalized) || Array.from(normalized).length > maxLength) {
    throw new Error(`Invalid ${name}.`);
  }
  return normalized;
}

function readIdentifierField(formData: FormData, name: string, required = true): string {
  const value = readStringField(formData, name, 240, required);
  if (value && !/^[A-Za-z0-9._:-]+$/.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
}

function readPositiveIntegerField(formData: FormData, name: string): number {
  const value = readStringField(formData, name, 12, true);
  if (!/^\d+$/.test(value)) throw new Error(`Invalid ${name}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`Invalid ${name}.`);
  return parsed;
}

function readEvidenceSelectors(formData: FormData): KnowledgeEvidenceSelector[] {
  const value = formData.get('evidence_selectors_json');
  if (value === null || value === '') return [];
  if (typeof value !== 'string' || value.length > 64_000) throw new Error('Invalid evidence selectors.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid evidence selectors.');
  }
  if (!Array.isArray(parsed) || parsed.length > 24) throw new Error('Invalid evidence selectors.');
  const selectors = sanitizeKnowledgeEvidenceSelectors(parsed);
  if (selectors.length !== parsed.length) throw new Error('Invalid evidence selectors.');
  return selectors;
}

function readReviewedKnowledgePayload(
  formData: FormData,
  action: 'create' | 'merge' | 'update',
): ReviewedKnowledgePayload {
  const title = sanitizeKnowledgeTitle(readStringField(formData, 'title', 120, true));
  const requestedSummary = sanitizeKnowledgeContent(readStringField(formData, 'summary', 500), 500);
  const requestedContent = sanitizeKnowledgeContent(readStringField(formData, 'content', 6000));
  const topic = normalizeKnowledgeTopic(readStringField(formData, 'topic', 120));
  const rawTags = readStringField(formData, 'tags', 2000)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (rawTags.length > 12 || rawTags.some((tag) => Array.from(tag).length > 48)) {
    throw new Error('Invalid tags.');
  }

  const knowledgeType = readStringField(formData, 'knowledge_type', 64);
  const bundle = readBundleFormData(formData);
  if (knowledgeType && !bundle) throw new Error('Invalid knowledge bundle.');
  if (!knowledgeType && (
    readStringField(formData, 'central_question', 500)
    || readStringField(formData, 'structured_content', 60_000)
    || readStringField(formData, 'bundle_schema_version', 12)
  )) {
    throw new Error('A knowledge type is required for structured content.');
  }
  const projection = bundle ? projectKnowledgeBundle(bundle, requestedSummary) : null;
  const readLifecycleField = (name: 'observed_at' | 'valid_from' | 'valid_to' | 'review_at') => (
    readKnowledgeResolutionTimestampField(formData, name, action)
  );
  const observedAt = readLifecycleField('observed_at');
  const validFrom = readLifecycleField('valid_from');
  const validTo = readLifecycleField('valid_to');
  if (validFrom && validTo && new Date(validTo).getTime() < new Date(validFrom).getTime()) {
    throw new Error('valid_to must not be earlier than valid_from.');
  }

  return {
    title,
    summary: sanitizeKnowledgeContent(projection?.summary ?? requestedSummary, 500),
    content: sanitizeKnowledgeContent(projection?.content ?? requestedContent),
    topic,
    tags: sanitizeKnowledgeTags(rawTags),
    knowledgeType: bundle?.knowledge_type ?? null,
    centralQuestion: bundle?.central_question ?? null,
    structuredContent: bundle?.structured_content ?? null,
    bundleSchemaVersion: bundle?.bundle_schema_version ?? null,
    observedAt,
    validFrom,
    validTo,
    reviewAt: readLifecycleField('review_at'),
    evidenceSelectors: readEvidenceSelectors(formData),
  };
}

function revalidateResolvedKnowledge(batchId?: string, topic?: string) {
  revalidatePath('/knowledge-inbox');
  if (batchId) revalidatePath(`/knowledge-inbox/${encodeURIComponent(batchId)}`);
  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
  revalidatePath('/topics');
  revalidatePath('/topics/[topic]', 'page');
  if (topic) revalidatePath(`/topics/${encodeURIComponent(topic)}`);
}

function readBundleFormData(formData: FormData): KnowledgeBundleFields | null {
  const knowledgeType = String(formData.get('knowledge_type') ?? '').trim();
  if (!knowledgeType) return null;
  let structuredContent: unknown;
  try {
    structuredContent = JSON.parse(String(formData.get('structured_content') ?? '{}'));
  } catch {
    return null;
  }
  return parseKnowledgeBundleFields({
    knowledge_type: knowledgeType,
    central_question: String(formData.get('central_question') ?? ''),
    structured_content: structuredContent,
    bundle_schema_version: Number(formData.get('bundle_schema_version') ?? 1),
  });
}

async function getGuestRateScope(userId: string) {
  const requestHeaders = await headers();
  return getGuestKnowledgeRateScope(userId, requestHeaders.get('cf-connecting-ip'));
}

function claimMemoryGuestWrite(scopeKey: string) {
  const now = Date.now();
  const existing = memoryGuestWriteWindows.get(scopeKey);
  if (!existing || now - existing.startedAt >= 60 * 60 * 1000) {
    memoryGuestWriteWindows.set(scopeKey, { startedAt: now, count: 1 });
    return;
  }
  if (existing.count >= GUEST_KNOWLEDGE_WRITES_PER_HOUR) {
    throw new Error('guest_knowledge_rate_limited');
  }
  existing.count += 1;
}

async function claimDatabaseGuestWrite(scopeKey: string) {
  const result = await pool.query<{ scope_key: string }>(
    `INSERT INTO guest_knowledge_write_limits (scope_key, window_started_at, request_count, updated_at)
     VALUES ($1, NOW(), 1, NOW())
     ON CONFLICT (scope_key)
     DO UPDATE SET
       window_started_at = CASE
         WHEN guest_knowledge_write_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW()
         ELSE guest_knowledge_write_limits.window_started_at
       END,
       request_count = CASE
         WHEN guest_knowledge_write_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1
         ELSE guest_knowledge_write_limits.request_count + 1
       END,
       updated_at = NOW()
     WHERE guest_knowledge_write_limits.window_started_at <= NOW() - INTERVAL '1 hour'
        OR guest_knowledge_write_limits.request_count < $2
     RETURNING scope_key`,
    [scopeKey, GUEST_KNOWLEDGE_WRITES_PER_HOUR],
  );
  if (result.rows.length === 0) throw new Error('guest_knowledge_rate_limited');
}

async function ensureSchema() {
  if (!process.env.DATABASE_URL || schemaReady) return;
  if (!canRunRuntimeSchemaBootstrap()) {
    schemaReady = true;
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_knowledge_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT 'general',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      knowledge_type TEXT,
      central_question TEXT,
      structured_content JSONB,
      bundle_schema_version INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE,
      purge_at TIMESTAMP WITH TIME ZONE
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user
    ON user_knowledge_items(user_id);
  `);

  await pool.query(`
    ALTER TABLE user_knowledge_items
      ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS knowledge_type TEXT,
      ADD COLUMN IF NOT EXISTS central_question TEXT,
      ADD COLUMN IF NOT EXISTS structured_content JSONB,
      ADD COLUMN IF NOT EXISTS bundle_schema_version INTEGER,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS purge_at TIMESTAMP WITH TIME ZONE;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_active_created
    ON user_knowledge_items(user_id, created_at DESC)
    WHERE deleted_at IS NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_purge_at
    ON user_knowledge_items(purge_at)
    WHERE purge_at IS NOT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_knowledge_create_requests (
      user_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, request_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_knowledge_create_requests_created
    ON user_knowledge_create_requests(created_at);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guest_knowledge_write_limits (
      scope_key TEXT PRIMARY KEY,
      window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      request_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_guest_knowledge_write_limits_updated
    ON guest_knowledge_write_limits(updated_at);
  `);

  await ensureKnowledgeIngestionSchema();

  schemaReady = true;
}


export async function getUserKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentActor();

  if (!process.env.DATABASE_URL) {
    const now = Date.now();
    purgeMemoryKnowledgeItemsForUser(user.id);
    const items = getMemoryKnowledgeItemsForUser(user.id).filter((item) => !item.purge_at || new Date(item.purge_at).getTime() > now);
    const supersededIds = new Set(getMemoryKnowledgeSupersessionsForUser(user.id)
      .map((entry) => entry.superseded_item_id));
    return items.filter((item) => !item.deleted_at && !item.archived_at && !supersededIds.has(item.id));
  }

  await ensureSchema();

  const result = await pool.query<UserKnowledgeItem>(
    `
    SELECT i.id, i.user_id, i.title, i.summary, i.content, i.topic, i.tags,
      i.knowledge_type, i.central_question, i.structured_content, i.bundle_schema_version,
      i.version, i.last_verified_at::text, i.archived_at::text,
      i.created_at::text, i.updated_at::text,
      i.deleted_at::text, i.purge_at::text, s.provider AS source_provider, s.batch_id AS source_batch_id
    FROM user_knowledge_items i
    LEFT JOIN LATERAL (
      SELECT provider, batch_id FROM knowledge_card_sources s
      WHERE s.knowledge_item_id = i.id AND s.user_id = i.user_id ORDER BY s.created_at DESC LIMIT 1
    ) s ON TRUE
    WHERE i.user_id = $1
      AND i.deleted_at IS NULL
      AND i.archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_item_supersessions supersession
        WHERE supersession.user_id = i.user_id
          AND supersession.superseded_item_id = i.id
      )
      AND (i.purge_at IS NULL OR i.purge_at > NOW())
    ORDER BY i.created_at DESC
    ${user.isGuest ? 'LIMIT $2' : ''};
    `,
    user.isGuest ? [user.id, GUEST_KNOWLEDGE_ITEM_LIMIT] : [user.id]
  );

  return result.rows;
}

export async function getArchivedKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentActor();
  if (!process.env.DATABASE_URL) {
    const supersededIds = new Set(getMemoryKnowledgeSupersessionsForUser(user.id)
      .map((entry) => entry.superseded_item_id));
    return getMemoryKnowledgeItemsForUser(user.id)
      .filter((item) => !item.deleted_at && Boolean(item.archived_at) && !supersededIds.has(item.id))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id));
  }

  await ensureSchema();
  const result = await pool.query<UserKnowledgeItem>(
    `SELECT i.id, i.user_id, i.title, i.summary, i.content, i.topic, i.tags,
       i.knowledge_type, i.central_question, i.structured_content, i.bundle_schema_version,
       i.version, i.last_verified_at::text, i.archived_at::text,
       i.created_at::text, i.updated_at::text, i.deleted_at::text, i.purge_at::text,
       s.provider AS source_provider, s.batch_id AS source_batch_id
     FROM user_knowledge_items i
     LEFT JOIN LATERAL (
       SELECT provider, batch_id FROM knowledge_card_sources s
       WHERE s.knowledge_item_id = i.id AND s.user_id = i.user_id
       ORDER BY s.created_at DESC LIMIT 1
     ) s ON TRUE
     WHERE i.user_id = $1 AND i.deleted_at IS NULL AND i.archived_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM knowledge_item_supersessions supersession
         WHERE supersession.user_id = i.user_id
           AND supersession.superseded_item_id = i.id
       )
     ORDER BY i.updated_at DESC, i.id`,
    [user.id],
  );
  return result.rows;
}

export async function getUserKnowledgeOverview(maxGraphNotes = 48): Promise<UserKnowledgeOverview> {
  const user = await requireCurrentActor();
  const limit = Math.max(1, Math.min(Math.trunc(maxGraphNotes), 100));

  if (!process.env.DATABASE_URL) {
    const now = Date.now();
    purgeMemoryKnowledgeItemsForUser(user.id);
    const items = getMemoryKnowledgeItemsForUser(user.id)
      .filter((item) => !item.deleted_at && !item.archived_at
        && (!item.purge_at || new Date(item.purge_at).getTime() > now));
    const supersededIds = new Set(getMemoryKnowledgeSupersessionsForUser(user.id)
      .map((entry) => entry.superseded_item_id));
    const activeItems = items.filter((item) => !supersededIds.has(item.id));
    return {
      count: activeItems.length,
      graphNotes: activeItems.slice(0, limit).map(({ id, title, topic }) => ({ id, title, topic })),
    };
  }

  await ensureSchema();
  const result = await pool.query<Pick<UserKnowledgeItem, 'id' | 'title' | 'topic'> & { total_count: string }>(
    `
    SELECT id, title, topic, COUNT(*) OVER()::text AS total_count
    FROM user_knowledge_items
    WHERE user_id = $1 AND deleted_at IS NULL AND archived_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM knowledge_item_supersessions supersession
        WHERE supersession.user_id = user_knowledge_items.user_id
          AND supersession.superseded_item_id = user_knowledge_items.id
      )
    ORDER BY created_at DESC
    LIMIT $2;
    `,
    [user.id, limit],
  );

  return {
    count: Number.parseInt(result.rows[0]?.total_count ?? '0', 10),
    graphNotes: result.rows.map(({ id, title, topic }) => ({ id, title, topic })),
  };
}

export async function createKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const title = sanitizeKnowledgeTitle(String(formData.get('title') ?? ''));
  const requestedSummary = sanitizeKnowledgeContent(String(formData.get('summary') ?? ''), 500);
  const requestedContent = sanitizeKnowledgeContent(String(formData.get('content') ?? ''));
  const hasBundleInput = Boolean(String(formData.get('knowledge_type') ?? '').trim());
  const bundle = readBundleFormData(formData);
  if (hasBundleInput && !bundle) return;
  const projection = bundle ? projectKnowledgeBundle(bundle, requestedSummary) : null;
  const summary = sanitizeKnowledgeContent(projection?.summary ?? requestedSummary, 500);
  const content = sanitizeKnowledgeContent(projection?.content ?? requestedContent);
  const topic = normalizeKnowledgeTopic(String(formData.get('topic') ?? ''));
  const tags = sanitizeKnowledgeTags(String(formData.get('tags') ?? '').split(','));
  const dedupeKey = buildKnowledgeDedupeKey({
    title,
    topic,
    knowledgeType: bundle?.knowledge_type,
    centralQuestion: bundle?.central_question,
  });
  const requestId = normalizeKnowledgeRequestId(formData.get('request_id'));
  const relatedNodeId = String(formData.get('related_node_id') ?? '').trim();
  const relationType = String(formData.get('relation_type') ?? 'related');
  const relationDirection = String(formData.get('relation_direction') ?? formData.get('direction') ?? '') === 'incoming' ? 'incoming' : 'outgoing';

  if (!title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    if (user.isGuest) {
      claimMemoryGuestWrite(await getGuestRateScope(user.id));
      purgeMemoryKnowledgeItemsForUser(user.id);
      const activeCount = getMemoryKnowledgeItemsForUser(user.id).filter((item) => !item.deleted_at).length;
      if (activeCount >= GUEST_KNOWLEDGE_ITEM_LIMIT) throw new Error('guest_knowledge_item_limit');
    }
    if (requestId && hasMemoryCreateRequest(user.id, requestId)) return;
    const item = createMemoryKnowledgeItemForUser(user.id, {
      title, summary, content, topic, tags,
      knowledgeType: bundle?.knowledge_type ?? null,
      centralQuestion: bundle?.central_question ?? null,
      structuredContent: bundle?.structured_content ?? null,
      bundleSchemaVersion: bundle?.bundle_schema_version ?? null,
    }, { syncGraph });
    if (user.isGuest) {
      item.purge_at = new Date(Date.now() + GUEST_KNOWLEDGE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    }
    if (syncGraph && relatedNodeId) {
      await createPrivateKnowledgeEdgeForUser(user.id, `personal:${item.id}`, relatedNodeId,
        ['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'].includes(relationType)
          ? relationType as 'prerequisite' | 'related' | 'generalizes' | 'derived_from' | 'equivalent_to'
          : 'related', relationDirection);
    }

    revalidatePath('/my-knowledge');
    revalidatePath('/grid');
    revalidatePath('/knowledge');
    return;
  }

  await ensureSchema();
  if (user.isGuest) await claimDatabaseGuestWrite(await getGuestRateScope(user.id));
  const itemId = randomUUID();
  const nodeId = randomUUID();
  const revisionId = randomUUID();
  const activityId = randomUUID();
  const insertQuery = requestId
    ? `WITH claimed AS (
           INSERT INTO user_knowledge_create_requests (user_id, request_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING 1
         ), inserted_item AS (
           INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags,
             knowledge_type, central_question, structured_content, bundle_schema_version, dedupe_key, purge_at)
           SELECT $3, $1, $4, $9, $5, $6, $8::jsonb, $14, $15, $16::jsonb, $17,
             $18, CASE WHEN $11::boolean THEN NOW() + ($12::int * INTERVAL '1 day') ELSE NULL END
           WHERE EXISTS (SELECT 1 FROM claimed)
             AND (SELECT COUNT(*) FROM user_knowledge_items WHERE user_id = $1) < $21
             AND (NOT $11::boolean OR (
               SELECT COUNT(*) FROM user_knowledge_items
               WHERE user_id = $1 AND deleted_at IS NULL
                 AND (purge_at IS NULL OR purge_at > NOW())
             ) < $13)
           RETURNING *
         ), inserted_revision AS (
           INSERT INTO knowledge_item_revisions
             (id, user_id, knowledge_item_id, version, snapshot, change_reason)
           SELECT $19, i.user_id, i.id, i.version, to_jsonb(i), 'confirmed'
           FROM inserted_item i
           ON CONFLICT (knowledge_item_id, version) DO NOTHING
         ), inserted_activity AS (
           INSERT INTO knowledge_item_activity
             (id, user_id, knowledge_item_id, activity_type, metadata)
           SELECT $20, i.user_id, i.id, 'confirmed', '{"origin":"manual"}'::jsonb
           FROM inserted_item i
         ), inserted_node AS (
           INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
           SELECT $7, user_id, id, title, topic, 'manual' FROM inserted_item WHERE $10::boolean
           RETURNING knowledge_item_id
         ) SELECT id FROM inserted_item`
    : `WITH inserted_item AS (
           INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags,
             knowledge_type, central_question, structured_content, bundle_schema_version, dedupe_key, purge_at)
           SELECT $3, $1, $4, $9, $5, $6, $8::jsonb, $14, $15, $16::jsonb, $17,
             $18, CASE WHEN $11::boolean THEN NOW() + ($12::int * INTERVAL '1 day') ELSE NULL END
           WHERE $2::text IS NULL
             AND (SELECT COUNT(*) FROM user_knowledge_items WHERE user_id = $1) < $21
             AND (NOT $11::boolean OR (
               SELECT COUNT(*) FROM user_knowledge_items
               WHERE user_id = $1 AND deleted_at IS NULL
                 AND (purge_at IS NULL OR purge_at > NOW())
             ) < $13)
           RETURNING *
         ), inserted_revision AS (
           INSERT INTO knowledge_item_revisions
             (id, user_id, knowledge_item_id, version, snapshot, change_reason)
           SELECT $19, i.user_id, i.id, i.version, to_jsonb(i), 'confirmed'
           FROM inserted_item i
           ON CONFLICT (knowledge_item_id, version) DO NOTHING
         ), inserted_activity AS (
           INSERT INTO knowledge_item_activity
             (id, user_id, knowledge_item_id, activity_type, metadata)
           SELECT $20, i.user_id, i.id, 'confirmed', '{"origin":"manual"}'::jsonb
           FROM inserted_item i
         ), inserted_node AS (
           INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
           SELECT $7, user_id, id, title, topic, 'manual' FROM inserted_item WHERE $10::boolean
           RETURNING knowledge_item_id
         ) SELECT id FROM inserted_item`;
  const insertParams = [
    user.id,
    requestId || null,
    itemId,
    title,
    content,
    topic,
    nodeId,
    JSON.stringify(tags),
    summary,
    syncGraph,
    user.isGuest,
    GUEST_KNOWLEDGE_RETENTION_DAYS,
    GUEST_KNOWLEDGE_ITEM_LIMIT,
    bundle?.knowledge_type ?? null,
    bundle?.central_question ?? null,
    bundle?.structured_content ? JSON.stringify(bundle.structured_content) : null,
    bundle?.bundle_schema_version ?? null,
    dedupeKey,
    revisionId,
    activityId,
    MAX_KNOWLEDGE_ITEMS_PER_USER,
  ];
  const transactionQueries = [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [`knowledge-items:${user.id}`],
    },
    ...(user.isGuest ? [{
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [`guest-knowledge:${user.id}`],
    }] : []),
    { text: insertQuery, params: insertParams },
  ];
  const resultSets = await pool.accountTransaction<{ id: string }>(user.id, transactionQueries);
  const result = resultSets[resultSets.length - 1];
  if (user.isGuest && !result.rows[0]) {
    const count = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM user_knowledge_items
       WHERE user_id = $1 AND deleted_at IS NULL
         AND (purge_at IS NULL OR purge_at > NOW())`,
      [user.id],
    );
    if (Number.parseInt(count.rows[0]?.count ?? '0', 10) >= GUEST_KNOWLEDGE_ITEM_LIMIT) {
      throw new Error('guest_knowledge_item_limit');
    }
  }
  if (result.rows[0] && syncGraph && relatedNodeId) {
    const validRelation = ['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'].includes(relationType)
      ? relationType as 'prerequisite' | 'related' | 'generalizes' | 'derived_from' | 'equivalent_to'
      : 'related';
    await createPrivateKnowledgeEdgeForUser(user.id, `personal:${itemId}`, relatedNodeId, validRelation, relationDirection);
  }

  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
}

export async function updateKnowledgeItem(formData: FormData): Promise<KnowledgeItemUpdateResult> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const id = readIdentifierField(formData, 'id');
  const expectedVersion = readPositiveIntegerField(formData, 'version');
  const title = sanitizeKnowledgeTitle(String(formData.get('title') ?? ''));
  const summaryField = formData.get('summary');
  const requestedSummary = summaryField === null ? undefined : sanitizeKnowledgeContent(String(summaryField), 500);
  const bundleEditorPresent = String(formData.get('bundle_mode_present') ?? '') === '1';
  const hasBundleInput = Boolean(String(formData.get('knowledge_type') ?? '').trim());
  const bundle = readBundleFormData(formData);
  if (hasBundleInput && !bundle) throw new Error('Invalid structured knowledge bundle.');
  const projection = bundle ? projectKnowledgeBundle(bundle, requestedSummary ?? '') : null;
  const summary = projection?.summary ?? requestedSummary;
  const content = sanitizeKnowledgeContent(projection?.content ?? String(formData.get('content') ?? ''));
  const topic = normalizeKnowledgeTopic(String(formData.get('topic') ?? ''));
  const tagsField = formData.get('tags');
  const tags = tagsField === null ? undefined : sanitizeKnowledgeTags(String(tagsField).split(','));

  if (!title) throw new Error('A title is required.');

  if (!process.env.DATABASE_URL) {
    const result = updateMemoryKnowledgeItemForUser(user.id, id, {
      title, summary, content, topic, tags,
      knowledgeType: bundleEditorPresent ? bundle?.knowledge_type ?? null : undefined,
      centralQuestion: bundleEditorPresent ? bundle?.central_question ?? null : undefined,
      structuredContent: bundleEditorPresent ? bundle?.structured_content ?? null : undefined,
      bundleSchemaVersion: bundleEditorPresent ? bundle?.bundle_schema_version ?? null : undefined,
    }, { syncGraph, expectedVersion });

    if (result.updated) {
      revalidatePath('/my-knowledge');
      revalidatePath('/grid');
      revalidatePath('/knowledge');
    }
    return result;
  }

  await ensureSchema();
  const currentResult = await pool.query<{
    version: number;
    knowledge_type: KnowledgeBundleType | null;
    central_question: string | null;
  }>(
    `SELECT version, knowledge_type, central_question
     FROM user_knowledge_items
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL AND archived_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM knowledge_item_supersessions s
         WHERE s.user_id = user_knowledge_items.user_id
           AND s.superseded_item_id = user_knowledge_items.id
       )
     LIMIT 1`,
    [id, user.id],
  );
  const current = currentResult.rows[0];
  if (!current) return { updated: false, version: null, notFound: true };
  if (current.version !== expectedVersion) {
    return { updated: false, version: null, stale: true };
  }
  const finalKnowledgeType = bundleEditorPresent ? bundle?.knowledge_type ?? null : current.knowledge_type;
  const finalCentralQuestion = bundleEditorPresent ? bundle?.central_question ?? null : current.central_question;
  const dedupeKey = buildKnowledgeDedupeKey({
    title,
    topic,
    knowledgeType: finalKnowledgeType,
    centralQuestion: finalCentralQuestion,
  });
  const resultSets = await pool.accountTransaction<{ id: string }>(user.id, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [`knowledge-item:${user.id}:${id}`],
    },
    {
      text: KNOWLEDGE_ITEM_UPDATE_QUERY,
      params: [
        id, user.id, title, content, topic, tags ? JSON.stringify(tags) : null, summary ?? null, syncGraph,
        bundleEditorPresent, bundle?.knowledge_type ?? null, bundle?.central_question ?? null,
        bundle?.structured_content ? JSON.stringify(bundle.structured_content) : null,
        bundle?.bundle_schema_version ?? null, expectedVersion, dedupeKey,
        randomUUID(), randomUUID(), randomUUID(),
      ],
    },
  ]);

  if (!resultSets.at(-1)?.rows[0]) {
    return { updated: false, version: null, stale: true };
  }

  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
  return { updated: true, version: expectedVersion + 1 };
}

export async function updateKnowledgeItemFormAction(formData: FormData): Promise<void> {
  const result = await updateKnowledgeItem(formData);
  if (!result.updated) {
    throw new Error('This knowledge item changed or is no longer available. Reload before editing it again.');
  }
}

export async function deleteKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    softDeleteMemoryKnowledgeItemForUser(user.id, id, PERSONAL_CARD_RETENTION_DAYS, { syncGraph });

    revalidatePath('/my-knowledge');
    revalidatePath('/grid');
    revalidatePath('/knowledge');
    return;
  }

  await ensureSchema();

  const deleteQuery =
    `WITH deleted_item AS (
       UPDATE user_knowledge_items
       SET deleted_at = NOW(), purge_at = NOW() + ($3 * INTERVAL '1 day'), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, purge_at
     ), trash_activity AS (
       INSERT INTO knowledge_item_activity
         (id, user_id, knowledge_item_id, activity_type, metadata)
       SELECT $5, $2, i.id, 'revised', jsonb_build_object(
         'lifecycle', 'trash', 'state', 'deleted', 'purge_at', i.purge_at
       )
       FROM deleted_item i
     ), deleted_nodes AS (
       UPDATE user_graph_nodes n SET deleted_at = NOW(), purge_at = i.purge_at, updated_at = NOW()
       FROM deleted_item i WHERE $4::boolean AND n.knowledge_item_id = i.id AND n.user_id = $2 AND n.deleted_at IS NULL
       RETURNING n.id, n.purge_at
     )
     UPDATE user_graph_edges e SET deleted_at = NOW(), purge_at = d.purge_at
     FROM deleted_nodes d
     WHERE e.user_id = $2 AND e.deleted_at IS NULL
       AND (e.source_private_node_id = d.id OR e.target_private_node_id = d.id)`;
  await pool.accountTransaction(user.id, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [`knowledge-item:${user.id}:${id}`],
    },
    {
      text: deleteQuery,
      params: [id, user.id, PERSONAL_CARD_RETENTION_DAYS, syncGraph, randomUUID()],
    },
  ]);

  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
}

export async function getDeletedKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentActor();

  if (!process.env.DATABASE_URL) {
    return getMemoryKnowledgeItemsForUser(user.id).filter((item) => !!item.deleted_at && (!item.purge_at || new Date(item.purge_at).getTime() > Date.now()));
  }

  await ensureSchema();
  const result = await pool.query<UserKnowledgeItem>(
     `SELECT id, user_id, title, summary, content, topic, tags,
      knowledge_type, central_question, structured_content, bundle_schema_version,
      version, last_verified_at::text, archived_at::text,
      created_at::text, updated_at::text,
      deleted_at::text, purge_at::text
     FROM user_knowledge_items
     WHERE user_id = $1 AND deleted_at IS NOT NULL AND purge_at > NOW()
     ORDER BY deleted_at DESC`,
    [user.id]
  );
  return result.rows;
}

export async function restoreKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  if (!process.env.DATABASE_URL) {
    if (user.isGuest) {
      purgeMemoryKnowledgeItemsForUser(user.id);
      const activeCount = getMemoryKnowledgeItemsForUser(user.id).filter((item) => !item.deleted_at).length;
      if (activeCount >= GUEST_KNOWLEDGE_ITEM_LIMIT) throw new Error('guest_knowledge_item_limit');
    }
    restoreMemoryKnowledgeItemForUser(user.id, id, {
      syncGraph,
      retentionDays: user.isGuest ? GUEST_KNOWLEDGE_RETENTION_DAYS : undefined,
    });
  } else {
    await ensureSchema();
    const restoreQuery =
      `WITH current_item AS (
         SELECT * FROM user_knowledge_items
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND purge_at > NOW()
           AND (NOT $4::boolean OR created_at + ($6::int * INTERVAL '1 day') > NOW())
           AND (NOT $4::boolean OR (
             SELECT COUNT(*) FROM user_knowledge_items
             WHERE user_id = $2 AND deleted_at IS NULL
               AND (purge_at IS NULL OR purge_at > NOW())
           ) < $5)
       ), previous_revision AS (
         INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $7, i.user_id, i.id, i.version, to_jsonb(i), 'before_restore'
         FROM current_item i
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
       ), restored_item AS (
         UPDATE user_knowledge_items i SET deleted_at = NULL,
           purge_at = CASE WHEN $4::boolean THEN i.created_at + ($6::int * INTERVAL '1 day') ELSE NULL END,
           version = i.version + 1, updated_at = NOW()
         FROM current_item current
         WHERE i.id = current.id AND i.user_id = current.user_id
         RETURNING i.*
       ), restored_revision AS (
         INSERT INTO knowledge_item_revisions
           (id, user_id, knowledge_item_id, version, snapshot, change_reason)
         SELECT $8, i.user_id, i.id, i.version, to_jsonb(i), 'restored'
         FROM restored_item i
         ON CONFLICT (knowledge_item_id, version) DO NOTHING
       ), restored_activity AS (
         INSERT INTO knowledge_item_activity
           (id, user_id, knowledge_item_id, activity_type, metadata)
         SELECT $9, i.user_id, i.id, 'revised', '{"lifecycle":"trash","state":"restored"}'::jsonb
         FROM restored_item i
       ), restored_nodes AS (
         UPDATE user_graph_nodes n SET deleted_at = NULL, purge_at = NULL, label = i.title, topic = i.topic, updated_at = NOW()
         FROM restored_item i WHERE $3::boolean AND n.knowledge_item_id = i.id AND n.user_id = $2 RETURNING n.id
       )
       UPDATE user_graph_edges e SET deleted_at = NULL, purge_at = NULL
       WHERE e.user_id = $2 AND e.deleted_at IS NOT NULL AND e.purge_at > NOW()
         AND (e.source_private_node_id IN (SELECT id FROM restored_nodes) OR e.target_private_node_id IN (SELECT id FROM restored_nodes))
         AND (e.source_private_node_id IS NULL OR EXISTS (
           SELECT 1 FROM user_graph_nodes n WHERE n.id = e.source_private_node_id AND n.user_id = $2 AND n.deleted_at IS NULL
         ))
         AND (e.target_private_node_id IS NULL OR EXISTS (
           SELECT 1 FROM user_graph_nodes n WHERE n.id = e.target_private_node_id AND n.user_id = $2 AND n.deleted_at IS NULL
         ))`;
    const restoreParams = [
      id,
      user.id,
      syncGraph,
      user.isGuest,
      GUEST_KNOWLEDGE_ITEM_LIMIT,
      GUEST_KNOWLEDGE_RETENTION_DAYS,
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    await pool.accountTransaction(user.id, [
      {
        text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
        params: [`knowledge-item:${user.id}:${id}`],
      },
      ...(user.isGuest ? [{
        text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
        params: [`guest-knowledge:${user.id}`],
      }] : []),
      { text: restoreQuery, params: restoreParams },
    ]);
  }

  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
}

export async function getTopicKnowledgeHub(topic: string): Promise<TopicKnowledgeHub> {
  const user = await requireCurrentActor();
  if (typeof topic !== 'string' || !topic.trim() || Array.from(topic.trim()).length > 120) {
    throw new Error('A bounded topic is required.');
  }
  return getTopicKnowledgeHubForUser(user.id, topic);
}

export async function getKnowledgeDraftResolutionContext(
  draftId: string,
  targetItemId?: string,
): Promise<KnowledgeDraftResolutionContext | null> {
  const user = await requireCurrentActor();
  if (typeof draftId !== 'string' || !draftId.trim() || !/^[A-Za-z0-9._:-]+$/.test(draftId.trim())) {
    throw new Error('Invalid draft id.');
  }
  if (targetItemId !== undefined && (
    typeof targetItemId !== 'string'
    || !targetItemId.trim()
    || !/^[A-Za-z0-9._:-]+$/.test(targetItemId.trim())
  )) {
    throw new Error('Invalid target item id.');
  }
  return getKnowledgeDraftResolutionContextForUser(user.id, draftId.trim(), targetItemId?.trim());
}

export async function resolveKnowledgeDraft(formData: FormData): Promise<ResolveKnowledgeDraftResult> {
  const user = await requireCurrentActor();
  const batchId = readIdentifierField(formData, 'batch_id');
  const draftId = readIdentifierField(formData, 'draft_id');
  const expectedDraftVersion = readPositiveIntegerField(formData, 'draft_version');
  const action = readStringField(formData, 'resolution_action', 16, true);
  if (action !== 'create' && action !== 'merge' && action !== 'update') {
    throw new Error('Invalid resolution action.');
  }

  let targetKnowledgeItemId: string | undefined;
  let expectedTargetVersion: number | undefined;
  const reviewed: ReviewedKnowledgePayload = readReviewedKnowledgePayload(formData, action);
  if (action === 'merge' || action === 'update') {
    targetKnowledgeItemId = readIdentifierField(formData, 'target_item_id');
    expectedTargetVersion = readPositiveIntegerField(formData, 'target_version');
  }

  const result = await resolveKnowledgeDraftForUser(user.id, {
    batchId,
    draftId,
    expectedDraftVersion,
    action,
    targetKnowledgeItemId,
    expectedTargetVersion,
    reviewed,
  });
  revalidateResolvedKnowledge(batchId, reviewed?.topic);
  return result;
}

export async function ignoreKnowledgeDraft(formData: FormData): Promise<ResolveKnowledgeDraftResult> {
  const user = await requireCurrentActor();
  const batchId = readIdentifierField(formData, 'batch_id');
  const draftId = readIdentifierField(formData, 'draft_id');
  const expectedDraftVersion = readPositiveIntegerField(formData, 'draft_version');
  const result = await resolveKnowledgeDraftForUser(user.id, {
    batchId,
    draftId,
    expectedDraftVersion,
    action: 'ignore',
  });
  revalidateResolvedKnowledge(batchId);
  return result;
}

export async function verifyKnowledgeItem(formData: FormData) {
  const user = await requireCurrentActor();
  const itemId = readIdentifierField(formData, 'id');
  const expectedVersion = readPositiveIntegerField(formData, 'version');
  const reviewAt = readOptionalTimestampPatchField(formData, 'review_at');
  const result = await verifyKnowledgeItemForUser(user.id, itemId, expectedVersion, reviewAt);
  revalidateResolvedKnowledge();
  return result;
}

export async function archiveKnowledgeItem(formData: FormData) {
  const user = await requireCurrentActor();
  const itemId = readIdentifierField(formData, 'id');
  const expectedVersion = readPositiveIntegerField(formData, 'version');
  const result = await archiveKnowledgeItemForUser(user.id, itemId, expectedVersion);
  revalidateResolvedKnowledge();
  return result;
}

export async function restoreArchivedKnowledgeItem(formData: FormData) {
  const user = await requireCurrentActor();
  const itemId = readIdentifierField(formData, 'id');
  const expectedVersion = readPositiveIntegerField(formData, 'version');
  const result = await restoreArchivedKnowledgeItemForUser(user.id, itemId, expectedVersion);
  revalidateResolvedKnowledge();
  return result;
}

export async function supersedeKnowledgeItem(formData: FormData) {
  const user = await requireCurrentActor();
  const supersededItemId = readIdentifierField(formData, 'superseded_item_id');
  const supersedingItemId = readIdentifierField(formData, 'superseding_item_id');
  const expectedVersion = readPositiveIntegerField(formData, 'superseded_version');
  const reason = sanitizeKnowledgeContent(readStringField(formData, 'reason', 500, true), 500);
  if (supersededItemId === supersedingItemId) throw new Error('An item cannot supersede itself.');
  const result = await supersedeKnowledgeItemForUser(
    user.id,
    supersededItemId,
    supersedingItemId,
    expectedVersion,
    reason,
  );
  revalidateResolvedKnowledge();
  return result;
}
