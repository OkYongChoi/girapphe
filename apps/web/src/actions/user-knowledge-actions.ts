'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { requireCurrentActor } from '@/lib/auth';
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

export type UserKnowledgeItem = {
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
  source_provider?: string | null;
  source_batch_id?: string | null;
};

let schemaReady = false;

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
    SELECT i.id, i.user_id, i.title, i.summary, i.content, i.topic, i.tags, i.created_at::text, i.updated_at::text,
      i.deleted_at::text, i.purge_at::text, s.provider AS source_provider, s.batch_id AS source_batch_id
    FROM user_knowledge_items i
    LEFT JOIN LATERAL (
      SELECT provider, batch_id FROM knowledge_card_sources s
      WHERE s.knowledge_item_id = i.id AND s.user_id = i.user_id ORDER BY s.created_at DESC LIMIT 1
    ) s ON TRUE
    WHERE i.user_id = $1 AND i.deleted_at IS NULL
    ORDER BY i.created_at DESC;
    `,
    [user.id]
  );

  return result.rows;
}

export async function createKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const title = sanitizeKnowledgeTitle(String(formData.get('title') ?? ''));
  const summary = sanitizeKnowledgeContent(String(formData.get('summary') ?? ''), 500);
  const content = sanitizeKnowledgeContent(String(formData.get('content') ?? ''));
  const topic = normalizeKnowledgeTopic(String(formData.get('topic') ?? ''));
  const tags = sanitizeKnowledgeTags(String(formData.get('tags') ?? '').split(','));
  const requestId = String(formData.get('request_id') ?? '').trim();
  const relatedNodeId = String(formData.get('related_node_id') ?? '').trim();
  const relationType = String(formData.get('relation_type') ?? 'related');
  const relationDirection = String(formData.get('relation_direction') ?? formData.get('direction') ?? '') === 'incoming' ? 'incoming' : 'outgoing';

  if (!title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    if (requestId && hasMemoryCreateRequest(user.id, requestId)) return;
    const item = createMemoryKnowledgeItemForUser(user.id, { title, summary, content, topic, tags }, { syncGraph });
    if (syncGraph && relatedNodeId) {
      await createPrivateKnowledgeEdgeForUser(user.id, `personal:${item.id}`, relatedNodeId,
        ['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'].includes(relationType)
          ? relationType as 'prerequisite' | 'related' | 'generalizes' | 'derived_from' | 'equivalent_to'
          : 'related', relationDirection);
    }

    revalidatePath('/my-knowledge');
    return;
  }

  await ensureSchema();
  const itemId = randomUUID();
  const nodeId = randomUUID();
  const result = await pool.query<{ id: string }>(
    requestId
      ? `WITH claimed AS (
           INSERT INTO user_knowledge_create_requests (user_id, request_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING RETURNING 1
         ), inserted_item AS (
           INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags)
           SELECT $3, $1, $4, $9, $5, $6, $8::jsonb WHERE EXISTS (SELECT 1 FROM claimed)
           RETURNING id, user_id, title, topic
         ), inserted_node AS (
           INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
           SELECT $7, user_id, id, title, topic, 'manual' FROM inserted_item WHERE $10::boolean
           RETURNING knowledge_item_id
         ) SELECT id FROM inserted_item`
      : `WITH inserted_item AS (
           INSERT INTO user_knowledge_items (id, user_id, title, summary, content, topic, tags)
           SELECT $3, $1, $4, $9, $5, $6, $8::jsonb WHERE $2::text IS NULL
           RETURNING id, user_id, title, topic
         ), inserted_node AS (
           INSERT INTO user_graph_nodes (id, user_id, knowledge_item_id, label, topic, origin)
           SELECT $7, user_id, id, title, topic, 'manual' FROM inserted_item WHERE $10::boolean
           RETURNING knowledge_item_id
         ) SELECT id FROM inserted_item`,
    [user.id, requestId || null, itemId, title, content, topic, nodeId, JSON.stringify(tags), summary, syncGraph]
  );
  if (result.rows[0] && syncGraph && relatedNodeId) {
    const validRelation = ['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'].includes(relationType)
      ? relationType as 'prerequisite' | 'related' | 'generalizes' | 'derived_from' | 'equivalent_to'
      : 'related';
    await createPrivateKnowledgeEdgeForUser(user.id, `personal:${itemId}`, relatedNodeId, validRelation, relationDirection);
  }

  revalidatePath('/my-knowledge');
}

export async function updateKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const syncGraph = !user.isGuest;
  const id = String(formData.get('id') ?? '').trim();
  const title = sanitizeKnowledgeTitle(String(formData.get('title') ?? ''));
  const summaryField = formData.get('summary');
  const summary = summaryField === null ? undefined : sanitizeKnowledgeContent(String(summaryField), 500);
  const content = sanitizeKnowledgeContent(String(formData.get('content') ?? ''));
  const topic = normalizeKnowledgeTopic(String(formData.get('topic') ?? ''));
  const tagsField = formData.get('tags');
  const tags = tagsField === null ? undefined : sanitizeKnowledgeTags(String(tagsField).split(','));

  if (!id || !title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    updateMemoryKnowledgeItemForUser(user.id, id, { title, summary, content, topic, tags }, { syncGraph });

    revalidatePath('/my-knowledge');
    return;
  }

  await ensureSchema();

  await pool.query(
    `WITH updated_item AS (
       UPDATE user_knowledge_items SET title = $3, content = $4, topic = $5,
         tags = CASE WHEN $6::jsonb IS NULL THEN tags ELSE $6::jsonb END,
         summary = CASE WHEN $7::text IS NULL THEN summary ELSE $7 END, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id, title, topic
     )
     UPDATE user_graph_nodes n SET label = i.title, topic = i.topic, updated_at = NOW()
     FROM updated_item i WHERE $8::boolean AND n.knowledge_item_id = i.id AND n.user_id = $2 AND n.deleted_at IS NULL`,
    [id, user.id, title, content, topic, tags ? JSON.stringify(tags) : null, summary ?? null, syncGraph]
  );

  revalidatePath('/my-knowledge');
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
  revalidatePath('/knowledge');
}

export async function getDeletedKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentActor();

  if (!process.env.DATABASE_URL) {
    return getMemoryKnowledgeItemsForUser(user.id).filter((item) => !!item.deleted_at && (!item.purge_at || new Date(item.purge_at).getTime() > Date.now()));
  }

  await ensureSchema();
  const result = await pool.query<UserKnowledgeItem>(
    `SELECT id, user_id, title, summary, content, topic, tags, created_at::text, updated_at::text,
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
    restoreMemoryKnowledgeItemForUser(user.id, id, { syncGraph });
  } else {
    await ensureSchema();
    await pool.query(
      `WITH restored_item AS (
         UPDATE user_knowledge_items SET deleted_at = NULL, purge_at = NULL, updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND purge_at > NOW()
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
         ))`,
      [id, user.id, syncGraph]
    );
  }

  revalidatePath('/my-knowledge');
  revalidatePath('/knowledge');
}
