'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { requireCurrentActor } from '@/lib/auth';
import { PERSONAL_CARD_RETENTION_DAYS, purgeExpiredPersonalKnowledgeItems } from '@/lib/personal-knowledge';

export type UserKnowledgeItem = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  topic: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  purge_at: string | null;
};

const memoryStore = new Map<string, UserKnowledgeItem[]>();
const memoryCreateRequestStore = new Map<string, Set<string>>();
let schemaReady = false;

async function ensureSchema() {
  if (!process.env.DATABASE_URL || schemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_knowledge_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT 'general',
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

  schemaReady = true;
}

function normalizeTopic(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return 'general';
  const normalized = trimmed.replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
  return normalized.slice(0, 48) || 'general';
}

function sanitizeTitle(input: string) {
  return input.trim().slice(0, 120);
}

function sanitizeContent(input: string) {
  return input.trim().slice(0, 6000);
}

async function purgeExpiredKnowledgeItems() {
  await purgeExpiredPersonalKnowledgeItems();
}

export async function getUserKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentActor();

  if (!process.env.DATABASE_URL) {
    const now = Date.now();
    const items = (memoryStore.get(user.id) ?? []).filter((item) => !item.purge_at || new Date(item.purge_at).getTime() > now);
    memoryStore.set(user.id, items);
    return items.filter((item) => !item.deleted_at);
  }

  await ensureSchema();
  await purgeExpiredKnowledgeItems();

  const result = await pool.query<UserKnowledgeItem>(
    `
    SELECT id, user_id, title, content, topic, created_at::text, updated_at::text,
      deleted_at::text, purge_at::text
    FROM user_knowledge_items
    WHERE user_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC;
    `,
    [user.id]
  );

  return result.rows;
}

export async function createKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const title = sanitizeTitle(String(formData.get('title') ?? ''));
  const content = sanitizeContent(String(formData.get('content') ?? ''));
  const topic = normalizeTopic(String(formData.get('topic') ?? ''));
  const requestId = String(formData.get('request_id') ?? '').trim();

  if (!title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    if (requestId) {
      const seen = memoryCreateRequestStore.get(user.id) ?? new Set<string>();
      if (seen.has(requestId)) {
        return;
      }
      seen.add(requestId);
      memoryCreateRequestStore.set(user.id, seen);
    }

    const item: UserKnowledgeItem = {
      id: randomUUID(),
      user_id: user.id,
      title,
      content,
      topic,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      purge_at: null,
    };

    const items = memoryStore.get(user.id) ?? [];
    memoryStore.set(user.id, [item, ...items]);

    revalidatePath('/my-knowledge');
    return;
  }

  await ensureSchema();
  if (requestId) {
    await pool.query(
      `
      WITH claimed AS (
        INSERT INTO user_knowledge_create_requests (user_id, request_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      INSERT INTO user_knowledge_items (id, user_id, title, content, topic)
      SELECT $3, $1, $4, $5, $6
      WHERE EXISTS (SELECT 1 FROM claimed);
      `,
      [user.id, requestId, randomUUID(), title, content, topic]
    );
  } else {
    await pool.query(
      `
      INSERT INTO user_knowledge_items (id, user_id, title, content, topic)
      VALUES ($1, $2, $3, $4, $5);
      `,
      [randomUUID(), user.id, title, content, topic]
    );
  }

  revalidatePath('/my-knowledge');
}

export async function updateKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const id = String(formData.get('id') ?? '').trim();
  const title = sanitizeTitle(String(formData.get('title') ?? ''));
  const content = sanitizeContent(String(formData.get('content') ?? ''));
  const topic = normalizeTopic(String(formData.get('topic') ?? ''));

  if (!id || !title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    const items = memoryStore.get(user.id) ?? [];
    const next = items.map((item) =>
      item.id === id
        ? { ...item, title, content, topic, updated_at: new Date().toISOString() }
        : item
    );
    memoryStore.set(user.id, next);

    revalidatePath('/my-knowledge');
    return;
  }

  await ensureSchema();

  await pool.query(
    `
    UPDATE user_knowledge_items
    SET title = $3, content = $4, topic = $5, updated_at = NOW()
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
    `,
    [id, user.id, title, content, topic]
  );

  revalidatePath('/my-knowledge');
}

export async function deleteKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentActor();
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    const items = memoryStore.get(user.id) ?? [];
    memoryStore.set(
      user.id,
      items.map((item) => item.id === id
        ? { ...item, deleted_at: new Date().toISOString(), purge_at: new Date(Date.now() + PERSONAL_CARD_RETENTION_DAYS * 86_400_000).toISOString() }
        : item)
    );

    revalidatePath('/my-knowledge');
    revalidatePath('/knowledge');
    return;
  }

  await ensureSchema();

  await pool.query(
    `UPDATE user_knowledge_items
     SET deleted_at = NOW(), purge_at = NOW() + ($3 * INTERVAL '1 day'), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, user.id, PERSONAL_CARD_RETENTION_DAYS]
  );

  revalidatePath('/my-knowledge');
  revalidatePath('/knowledge');
}

export async function getDeletedKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentActor();

  if (!process.env.DATABASE_URL) {
    return (memoryStore.get(user.id) ?? []).filter((item) => !!item.deleted_at && (!item.purge_at || new Date(item.purge_at).getTime() > Date.now()));
  }

  await ensureSchema();
  await purgeExpiredKnowledgeItems();
  const result = await pool.query<UserKnowledgeItem>(
    `SELECT id, user_id, title, content, topic, created_at::text, updated_at::text,
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
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  if (!process.env.DATABASE_URL) {
    const items = memoryStore.get(user.id) ?? [];
    memoryStore.set(user.id, items.map((item) => item.id === id && item.deleted_at && (!item.purge_at || new Date(item.purge_at).getTime() > Date.now())
      ? { ...item, deleted_at: null, purge_at: null, updated_at: new Date().toISOString() }
      : item));
  } else {
    await ensureSchema();
    await pool.query(
      `UPDATE user_knowledge_items
       SET deleted_at = NULL, purge_at = NULL, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL AND purge_at > NOW()`,
      [id, user.id]
    );
  }

  revalidatePath('/my-knowledge');
  revalidatePath('/knowledge');
}
