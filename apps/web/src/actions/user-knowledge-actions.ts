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
  createMemoryKnowledgeItemForUser,
  createPrivateKnowledgeEdgeForUser,
  ensureKnowledgeIngestionSchema,
  getMemoryKnowledgeItemsForUser,
  hasMemoryCreateRequest,
  normalizeKnowledgeTopic,
  purgeMemoryKnowledgeItemsForUser,
  restoreMemoryKnowledgeItemForUser,
  sanitizeKnowledgeContent,
  sanitizeKnowledgeTags,
  sanitizeKnowledgeTitle,
  softDeleteMemoryKnowledgeItemForUser,
  updateMemoryKnowledgeItemForUser,
} from '@/lib/knowledge-ingestion';
import { parseKnowledgeBundleFields, projectKnowledgeBundle, type KnowledgeBundleFields } from '@/lib/knowledge-bundle-runtime';

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
    return items.filter((item) => !item.deleted_at);
  }

  await ensureSchema();

  const result = await pool.query<UserKnowledgeItem>(
    `
    SELECT i.id, i.user_id, i.title, i.summary, i.content, i.topic, i.tags,
      i.knowledge_type, i.central_question, i.structured_content, i.bundle_schema_version,
      i.created_at::text, i.updated_at::text,
      i.deleted_at::text, i.purge_at::text, s.provider AS source_provider, s.batch_id AS source_batch_id
    FROM user_knowledge_items i
    LEFT JOIN LATERAL (
      SELECT provider, batch_id FROM knowledge_card_sources s
      WHERE s.knowledge_item_id = i.id AND s.user_id = i.user_id ORDER BY s.created_at DESC LIMIT 1
    ) s ON TRUE
    WHERE i.user_id = $1
      AND i.deleted_at IS NULL
      AND (i.purge_at IS NULL OR i.purge_at > NOW())
    ORDER BY i.created_at DESC
    ${user.isGuest ? 'LIMIT $2' : ''};
    `,
    user.isGuest ? [user.id, GUEST_KNOWLEDGE_ITEM_LIMIT] : [user.id]
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
      .filter((item) => !item.deleted_at && (!item.purge_at || new Date(item.purge_at).getTime() > now));
    return {
      count: items.length,
      graphNotes: items.slice(0, limit).map(({ id, title, topic }) => ({ id, title, topic })),
    };
  }

  await ensureSchema();
  const result = await pool.query<Pick<UserKnowledgeItem, 'id' | 'title' | 'topic'> & { total_count: string }>(
    `
    SELECT id, title, topic, COUNT(*) OVER()::text AS total_count
    FROM user_knowledge_items
    WHERE user_id = $1 AND deleted_at IS NULL
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
  const insertQuery = requestId
    ? `WITH claimed AS (
           INSERT INTO user_knowledge_create_requests (user_id, request_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING 1
         ), inserted_item AS (
           INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags,
             knowledge_type, central_question, structured_content, bundle_schema_version, purge_at)
           SELECT $3, $1, $4, $9, $5, $6, $8::jsonb, $14, $15, $16::jsonb, $17,
             CASE WHEN $11::boolean THEN NOW() + ($12::int * INTERVAL '1 day') ELSE NULL END
           WHERE EXISTS (SELECT 1 FROM claimed)
             AND (NOT $11::boolean OR (
               SELECT COUNT(*) FROM user_knowledge_items
               WHERE user_id = $1 AND deleted_at IS NULL
                 AND (purge_at IS NULL OR purge_at > NOW())
             ) < $13)
           RETURNING id, user_id, title, topic
         ), inserted_node AS (
           INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
           SELECT $7, user_id, id, title, topic, 'manual' FROM inserted_item WHERE $10::boolean
           RETURNING knowledge_item_id
         ) SELECT id FROM inserted_item`
    : `WITH inserted_item AS (
           INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags,
             knowledge_type, central_question, structured_content, bundle_schema_version, purge_at)
           SELECT $3, $1, $4, $9, $5, $6, $8::jsonb, $14, $15, $16::jsonb, $17,
             CASE WHEN $11::boolean THEN NOW() + ($12::int * INTERVAL '1 day') ELSE NULL END
           WHERE $2::text IS NULL
             AND (NOT $11::boolean OR (
               SELECT COUNT(*) FROM user_knowledge_items
               WHERE user_id = $1 AND deleted_at IS NULL
                 AND (purge_at IS NULL OR purge_at > NOW())
             ) < $13)
           RETURNING id, user_id, title, topic
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
  ];
  const result = user.isGuest
    ? (await pool.transaction<{ id: string }>([
        {
          text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
          params: [`guest-knowledge:${user.id}`],
        },
        { text: insertQuery, params: insertParams },
      ]))[1]
    : await pool.query<{ id: string }>(insertQuery, insertParams);
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

export async function updateKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const id = String(formData.get('id') ?? '').trim();
  const title = sanitizeKnowledgeTitle(String(formData.get('title') ?? ''));
  const summaryField = formData.get('summary');
  const requestedSummary = summaryField === null ? undefined : sanitizeKnowledgeContent(String(summaryField), 500);
  const bundleEditorPresent = String(formData.get('bundle_mode_present') ?? '') === '1';
  const hasBundleInput = Boolean(String(formData.get('knowledge_type') ?? '').trim());
  const bundle = readBundleFormData(formData);
  if (hasBundleInput && !bundle) return;
  const projection = bundle ? projectKnowledgeBundle(bundle, requestedSummary ?? '') : null;
  const summary = projection?.summary ?? requestedSummary;
  const content = sanitizeKnowledgeContent(projection?.content ?? String(formData.get('content') ?? ''));
  const topic = normalizeKnowledgeTopic(String(formData.get('topic') ?? ''));
  const tagsField = formData.get('tags');
  const tags = tagsField === null ? undefined : sanitizeKnowledgeTags(String(tagsField).split(','));

  if (!id || !title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    updateMemoryKnowledgeItemForUser(user.id, id, {
      title, summary, content, topic, tags,
      knowledgeType: bundleEditorPresent ? bundle?.knowledge_type ?? null : undefined,
      centralQuestion: bundleEditorPresent ? bundle?.central_question ?? null : undefined,
      structuredContent: bundleEditorPresent ? bundle?.structured_content ?? null : undefined,
      bundleSchemaVersion: bundleEditorPresent ? bundle?.bundle_schema_version ?? null : undefined,
    }, { syncGraph });

    revalidatePath('/my-knowledge');
    revalidatePath('/grid');
    revalidatePath('/knowledge');
    return;
  }

  await ensureSchema();

  await pool.query(
    `WITH updated_item AS (
       UPDATE user_knowledge_items SET title = $3, content = $4, topic = $5,
         tags = CASE WHEN $6::jsonb IS NULL THEN tags ELSE $6::jsonb END,
         summary = CASE WHEN $7::text IS NULL THEN summary ELSE $7 END,
         knowledge_type = CASE WHEN $9::boolean THEN $10 ELSE knowledge_type END,
         central_question = CASE WHEN $9::boolean THEN $11 ELSE central_question END,
         structured_content = CASE WHEN $9::boolean THEN $12::jsonb ELSE structured_content END,
         bundle_schema_version = CASE WHEN $9::boolean THEN $13 ELSE bundle_schema_version END,
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, title, topic
     )
     UPDATE user_graph_nodes n SET label = i.title, topic = i.topic, updated_at = NOW()
     FROM updated_item i WHERE $8::boolean AND n.knowledge_item_id = i.id AND n.user_id = $2 AND n.deleted_at IS NULL`,
    [id, user.id, title, content, topic, tags ? JSON.stringify(tags) : null, summary ?? null, syncGraph,
      bundleEditorPresent, bundle?.knowledge_type ?? null, bundle?.central_question ?? null,
      bundle?.structured_content ? JSON.stringify(bundle.structured_content) : null,
      bundle?.bundle_schema_version ?? null]
  );

  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
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

  await pool.query(
    `WITH deleted_item AS (
       UPDATE user_knowledge_items
       SET deleted_at = NOW(), purge_at = NOW() + ($3 * INTERVAL '1 day'), updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, purge_at
     ), deleted_nodes AS (
       UPDATE user_graph_nodes n SET deleted_at = NOW(), purge_at = i.purge_at, updated_at = NOW()
       FROM deleted_item i WHERE $4::boolean AND n.knowledge_item_id = i.id AND n.user_id = $2 AND n.deleted_at IS NULL
       RETURNING n.id, n.purge_at
     )
     UPDATE user_graph_edges e SET deleted_at = NOW(), purge_at = d.purge_at
     FROM deleted_nodes d
     WHERE e.user_id = $2 AND e.deleted_at IS NULL
       AND (e.source_private_node_id = d.id OR e.target_private_node_id = d.id)`,
    [id, user.id, PERSONAL_CARD_RETENTION_DAYS, syncGraph]
  );

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
      `WITH restored_item AS (
         UPDATE user_knowledge_items SET deleted_at = NULL,
           purge_at = CASE WHEN $4::boolean THEN created_at + ($6::int * INTERVAL '1 day') ELSE NULL END,
           updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND purge_at > NOW()
           AND (NOT $4::boolean OR created_at + ($6::int * INTERVAL '1 day') > NOW())
           AND (NOT $4::boolean OR (
             SELECT COUNT(*) FROM user_knowledge_items
             WHERE user_id = $2 AND deleted_at IS NULL
               AND (purge_at IS NULL OR purge_at > NOW())
           ) < $5)
         RETURNING id, title, topic
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
    ];
    if (user.isGuest) {
      await pool.transaction([
        {
          text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
          params: [`guest-knowledge:${user.id}`],
        },
        { text: restoreQuery, params: restoreParams },
      ]);
    } else {
      await pool.query(restoreQuery, restoreParams);
    }
  }

  revalidatePath('/my-knowledge');
  revalidatePath('/grid');
  revalidatePath('/knowledge');
}
