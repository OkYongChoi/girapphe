'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/auth';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Nodes ────────────────────────────────────────────────────────────────────

export async function getAdminNodes(): Promise<AdminNode[]> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return [];
  const { rows } = await pool.query<AdminNode>(
    'SELECT id, label, domain, level, difficulty, type, created_at FROM graph_nodes ORDER BY domain, level'
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
  if (!process.env.DATABASE_URL) return;

  const id = data.id.trim().toLowerCase().replace(/\s+/g, '_');
  const label = data.label.trim().slice(0, 200);
  const domain = data.domain.trim().slice(0, 50);
  if (!id || !label || !domain) throw new Error('id, label, and domain are required');

  await pool.query(
    `INSERT INTO graph_nodes (id, label, domain, level, difficulty, type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, label, domain, data.level, data.difficulty, data.type]
  );
  revalidatePath('/admin/nodes');
}

export async function deleteAdminNode(id: string): Promise<void> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return;
  await pool.query('DELETE FROM graph_nodes WHERE id = $1', [id]);
  revalidatePath('/admin/nodes');
}

// ── Edges ────────────────────────────────────────────────────────────────────

export async function getAdminEdges(): Promise<AdminEdge[]> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return [];
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
  if (!process.env.DATABASE_URL) return;
  if (!data.source || !data.target || !data.type) throw new Error('source, target, and type are required');

  await pool.query(
    `INSERT INTO graph_edges (source, target, type, weight) VALUES ($1, $2, $3, $4)`,
    [data.source, data.target, data.type, data.weight]
  );
  revalidatePath('/admin/edges');
}

export async function deleteAdminEdge(id: number): Promise<void> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return;
  await pool.query('DELETE FROM graph_edges WHERE id = $1', [id]);
  revalidatePath('/admin/edges');
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<AdminUser[]> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return [];
  const { rows } = await pool.query<AdminUser>(
    `SELECT
       user_id,
       COUNT(*)::int                                             AS total,
       COUNT(*) FILTER (WHERE knowledge_state = 1)::int         AS known,
       COUNT(*) FILTER (WHERE knowledge_state = 0.5)::int       AS partial,
       MAX(last_updated)                                         AS last_updated
     FROM user_knowledge_states
     GROUP BY user_id
     ORDER BY MAX(last_updated) DESC NULLS LAST`
  );
  return rows;
}
