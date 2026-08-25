import pool from '@/lib/db';

export const PERSONAL_CARD_RETENTION_DAYS = 14;

export async function purgeExpiredPersonalKnowledgeItems() {
  if (!process.env.DATABASE_URL) return 0;
  const result = await pool.query<{ deleted_count: string }>(
    `WITH deleted_items AS (
       DELETE FROM user_knowledge_items WHERE purge_at <= NOW() RETURNING id
     ), deleted_guest_requests AS (
       DELETE FROM user_knowledge_create_requests
       WHERE user_id LIKE 'guest\\_%' ESCAPE '\\'
         AND created_at <= NOW() - INTERVAL '90 days'
       RETURNING request_id
     ), deleted_guest_limits AS (
       DELETE FROM guest_knowledge_write_limits
       WHERE updated_at <= NOW() - INTERVAL '2 days'
       RETURNING scope_key
     )
     SELECT COUNT(*)::text AS deleted_count FROM deleted_items`
  );
  return Number.parseInt(result.rows[0]?.deleted_count ?? '0', 10);
}
