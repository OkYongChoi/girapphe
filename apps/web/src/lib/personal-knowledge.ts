import pool from '@/lib/db';

export const PERSONAL_CARD_RETENTION_DAYS = 14;

export async function purgeExpiredPersonalKnowledgeItems() {
  if (!process.env.DATABASE_URL) return 0;
  const result = await pool.query<{ id: string }>(
    'DELETE FROM user_knowledge_items WHERE purge_at <= NOW() RETURNING id'
  );
  return result.rows.length;
}
