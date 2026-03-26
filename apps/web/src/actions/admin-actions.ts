'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/auth';
import { ADMIN_DOMAINS, ADMIN_EDGE_TYPES, ADMIN_NODE_TYPES } from '@/lib/admin-config';

function ensureAdminDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Admin database access requires DATABASE_URL to be configured.');
  }
}

function normalizeRequiredText(value: string, field: string, maxLength: number) {
  const normalized = value.trim().slice(0, maxLength);
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseBoundedNumber(value: number, field: string, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return value;
}

function ensureAllowedValue<T extends readonly string[]>(value: string, allowed: T, field: string) {
  if (!allowed.includes(value)) {
    throw new Error(`${field} is invalid`);
  }
  return value;
}

export type AdminNode = {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: string;
  created_at: string;
};

export type AdminEdge = {
  id: number;
  source: string;
  target: string;
  type: string;
  weight: number;
};

export type AdminUser = {
  user_id: string;
  known: number;
  partial: number;
  total: number;
  last_updated: string | null;
};

export async function getAdminNodes(): Promise<AdminNode[]> {
  await requireAdminUser();
  ensureAdminDatabase();
  const { rows } = await pool.query<AdminNode>(
    'SELECT id, label, domain, level, difficulty, type, created_at FROM graph_nodes ORDER BY domain, level, label'
  );
  return rows;
}

export async function createAdminNode(data: {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: string;
}): Promise<void> {
  await requireAdminUser();
  ensureAdminDatabase();

  const id = normalizeRequiredText(data.id, 'id', 100).toLowerCase().replace(/\s+/g, '_');
  const label = normalizeRequiredText(data.label, 'label', 200);
  const domain = ensureAllowedValue(normalizeRequiredText(data.domain, 'domain', 50), ADMIN_DOMAINS, 'domain');
  const type = ensureAllowedValue(normalizeRequiredText(data.type, 'type', 50), ADMIN_NODE_TYPES, 'type');
  const level = parseBoundedNumber(data.level, 'level', 0, 5);
  const difficulty = parseBoundedNumber(data.difficulty, 'difficulty', 1, 5);

  await pool.query(
    `INSERT INTO graph_nodes (id, label, domain, level, difficulty, type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, label, domain, level, difficulty, type]
  );
  revalidatePath('/admin');
  revalidatePath('/admin/nodes');
}

export async function deleteAdminNode(id: string): Promise<void> {
  await requireAdminUser();
  ensureAdminDatabase();
  await pool.query('DELETE FROM graph_nodes WHERE id = $1', [normalizeRequiredText(id, 'id', 100)]);
  revalidatePath('/admin');
  revalidatePath('/admin/nodes');
  revalidatePath('/admin/edges');
}

export async function getAdminEdges(): Promise<AdminEdge[]> {
  await requireAdminUser();
  ensureAdminDatabase();
  const { rows } = await pool.query<AdminEdge>(
    'SELECT id, source, target, type, weight FROM graph_edges ORDER BY source, target'
  );
  return rows;
}

export async function createAdminEdge(data: {
  source: string;
  target: string;
  type: string;
  weight: number;
}): Promise<void> {
  await requireAdminUser();
  ensureAdminDatabase();
  const source = normalizeRequiredText(data.source, 'source', 100);
  const target = normalizeRequiredText(data.target, 'target', 100);
  const type = ensureAllowedValue(normalizeRequiredText(data.type, 'type', 50), ADMIN_EDGE_TYPES, 'type');
  const weight = parseBoundedNumber(data.weight, 'weight', 0, 1);

  if (source === target) {
    throw new Error('source and target must be different nodes');
  }

  await pool.query(
    'INSERT INTO graph_edges (source, target, type, weight) VALUES ($1, $2, $3, $4)',
    [source, target, type, weight]
  );
  revalidatePath('/admin');
  revalidatePath('/admin/edges');
}

export async function deleteAdminEdge(id: number): Promise<void> {
  await requireAdminUser();
  ensureAdminDatabase();
  if (!Number.isInteger(id) || id < 1) throw new Error('id is invalid');
  await pool.query('DELETE FROM graph_edges WHERE id = $1', [id]);
  revalidatePath('/admin');
  revalidatePath('/admin/edges');
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  await requireAdminUser();
  ensureAdminDatabase();
  const { rows } = await pool.query<AdminUser>(
    `SELECT
       user_id,
       COUNT(*)::int                                       AS total,
       COUNT(*) FILTER (WHERE knowledge_state = 1)::int   AS known,
       COUNT(*) FILTER (WHERE knowledge_state = 0.5)::int AS partial,
       MAX(last_updated)                                   AS last_updated
     FROM user_knowledge_states
     GROUP BY user_id
     ORDER BY MAX(last_updated) DESC NULLS LAST`
  );
  return rows;
}
