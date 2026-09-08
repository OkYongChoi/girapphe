import 'server-only';

import db from '@/lib/db';

export const KNOWLEDGE_DATA_EXPORT_SCHEMA_VERSION = 1;

export function buildKnowledgeDataExportQuery(userId: string) {
  if (!userId) throw new Error('A user is required.');
  return {
    text: `SELECT jsonb_build_object(
      'schema_version', ${KNOWLEDGE_DATA_EXPORT_SCHEMA_VERSION},
      'exported_at', CURRENT_TIMESTAMP,
      'privacy', jsonb_build_object(
        'raw_conversations_included', FALSE,
        'archive_files_included', FALSE,
        'owner_scoped', TRUE
      ),
      'approved_knowledge', COALESCE((
        SELECT jsonb_agg(to_jsonb(i) - 'user_id' ORDER BY i.created_at, i.id)
        FROM user_knowledge_items i WHERE i.user_id = $1
      ), '[]'::jsonb),
      'knowledge_revisions', COALESCE((
        SELECT jsonb_agg(to_jsonb(r) - 'user_id' ORDER BY r.created_at, r.id)
        FROM knowledge_item_revisions r WHERE r.user_id = $1
      ), '[]'::jsonb),
      'knowledge_sources', COALESCE((
        SELECT jsonb_agg(to_jsonb(s) - 'user_id' ORDER BY s.created_at, s.id)
        FROM knowledge_card_sources s WHERE s.user_id = $1
      ), '[]'::jsonb),
      'evidence_selectors', COALESCE((
        SELECT jsonb_agg(to_jsonb(e) - 'user_id' ORDER BY e.created_at, e.id)
        FROM knowledge_evidence_spans e WHERE e.user_id = $1
      ), '[]'::jsonb),
      'private_graph_nodes', COALESCE((
        SELECT jsonb_agg(to_jsonb(n) - 'user_id' ORDER BY n.created_at, n.id)
        FROM user_graph_nodes n WHERE n.user_id = $1
      ), '[]'::jsonb),
      'private_relationships', COALESCE((
        SELECT jsonb_agg(to_jsonb(e) - 'user_id' ORDER BY e.created_at, e.id)
        FROM user_graph_edges e WHERE e.user_id = $1
      ), '[]'::jsonb),
      'relationship_evidence', COALESCE((
        SELECT jsonb_agg(to_jsonb(re) - 'user_id' ORDER BY re.edge_id, re.evidence_span_id)
        FROM knowledge_relation_evidence re WHERE re.user_id = $1
      ), '[]'::jsonb),
      'supersession_history', COALESCE((
        SELECT jsonb_agg(to_jsonb(s) - 'user_id' ORDER BY s.created_at, s.id)
        FROM knowledge_item_supersessions s WHERE s.user_id = $1
      ), '[]'::jsonb),
      'reuse_and_activity', COALESCE((
        SELECT jsonb_agg(to_jsonb(a) - 'user_id' ORDER BY a.created_at, a.id)
        FROM knowledge_item_activity a WHERE a.user_id = $1
      ), '[]'::jsonb),
      'import_jobs', COALESCE((
        SELECT jsonb_agg(to_jsonb(b) - 'user_id' - 'mcp_token_id' ORDER BY b.created_at, b.id)
        FROM knowledge_ingestion_batches b WHERE b.user_id = $1
      ), '[]'::jsonb),
      'pending_and_resolved_candidates', COALESCE((
        SELECT jsonb_agg(to_jsonb(d) - 'user_id' ORDER BY d.created_at, d.id)
        FROM knowledge_card_drafts d WHERE d.user_id = $1
      ), '[]'::jsonb),
      'intelligence_feedback_and_metrics', COALESCE((
        SELECT jsonb_agg(to_jsonb(e) - 'user_id' ORDER BY e.created_at, e.id)
        FROM knowledge_product_events e WHERE e.user_id = $1
      ), '[]'::jsonb)
    ) AS export_data`,
    params: [userId],
  };
}

export async function buildKnowledgeDataExportForUser(userId: string): Promise<Record<string, unknown>> {
  if (!process.env.DATABASE_URL) throw new Error('The account database is unavailable.');
  const query = buildKnowledgeDataExportQuery(userId);
  const result = await db.query<{ export_data: Record<string, unknown> | string }>(query.text, query.params);
  const value = result.rows[0]?.export_data;
  if (!value) throw new Error('The knowledge export could not be created.');
  return typeof value === 'string' ? JSON.parse(value) as Record<string, unknown> : value;
}
