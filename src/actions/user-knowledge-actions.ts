'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import pool from '@/lib/db';
import { requireCurrentUser } from '@/lib/auth';

export type UserKnowledgeItem = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  topic: string;
  created_at: string;
  updated_at: string;
};

const memoryStore = new Map<string, UserKnowledgeItem[]>();
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
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_knowledge_items_user
    ON user_knowledge_items(user_id);
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

export async function getUserKnowledgeItems(): Promise<UserKnowledgeItem[]> {
  const user = await requireCurrentUser();

  if (!process.env.DATABASE_URL) {
    return memoryStore.get(user.id) ?? [];
  }

  await ensureSchema();

  const result = await pool.query<UserKnowledgeItem>(
    `
    SELECT id, user_id, title, content, topic, created_at::text, updated_at::text
    FROM user_knowledge_items
    WHERE user_id = $1
    ORDER BY updated_at DESC;
    `,
    [user.id]
  );

  return result.rows;
}

export async function createKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const title = sanitizeTitle(String(formData.get('title') ?? ''));
  const content = sanitizeContent(String(formData.get('content') ?? ''));
  const topic = normalizeTopic(String(formData.get('topic') ?? ''));

  if (!title) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    const item: UserKnowledgeItem = {
      id: randomUUID(),
      user_id: user.id,
      title,
      content,
      topic,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const items = memoryStore.get(user.id) ?? [];
    memoryStore.set(user.id, [item, ...items]);

    revalidatePath('/my-knowledge');
    return;
  }

  await ensureSchema();

  await pool.query(
    `
    INSERT INTO user_knowledge_items (id, user_id, title, content, topic)
    VALUES ($1, $2, $3, $4, $5);
    `,
    [randomUUID(), user.id, title, content, topic]
  );

  revalidatePath('/my-knowledge');
}

export async function updateKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
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
    WHERE id = $1 AND user_id = $2;
    `,
    [id, user.id, title, content, topic]
  );

  revalidatePath('/my-knowledge');
}

export async function deleteKnowledgeItem(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    const items = memoryStore.get(user.id) ?? [];
    memoryStore.set(
      user.id,
      items.filter((item) => item.id !== id)
    );

    revalidatePath('/my-knowledge');
    return;
  }

  await ensureSchema();

  await pool.query('DELETE FROM user_knowledge_items WHERE id = $1 AND user_id = $2', [
    id,
    user.id,
  ]);

  revalidatePath('/my-knowledge');
}
