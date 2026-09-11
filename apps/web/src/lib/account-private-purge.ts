import 'server-only';

import { deriveMcpTokenCreationRateScopeKey } from '@/lib/account-lifecycle';

export function buildPrivateProductPurgeQuery(userId: string) {
  return {
    text: `WITH
       deleted_evidence_spans AS (
         DELETE FROM knowledge_evidence_spans WHERE user_id = $1 RETURNING id
       ),
       deleted_sources AS (
         DELETE FROM knowledge_card_sources
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_evidence_spans) >= 0
         RETURNING id
       ),
       deleted_revisions AS (
         DELETE FROM knowledge_item_revisions
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_sources) >= 0
         RETURNING id
       ),
       deleted_activity AS (
         DELETE FROM knowledge_item_activity WHERE user_id = $1 RETURNING id
       ),
       deleted_knowledge_product_events AS (
         DELETE FROM knowledge_product_events WHERE user_id = $1 RETURNING id
       ),
       deleted_supersessions AS (
         DELETE FROM knowledge_item_supersessions WHERE user_id = $1 RETURNING id
       ),
       deleted_graph_edges AS (
         DELETE FROM user_graph_edges WHERE user_id = $1 RETURNING id
       ),
       deleted_recall_attempts AS (
         DELETE FROM recall_attempts WHERE user_id = $1 RETURNING id
       ),
       deleted_private_states AS (
         DELETE FROM user_private_card_states
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_recall_attempts) >= 0
         RETURNING knowledge_item_id
       ),
       deleted_graph_nodes AS (
         DELETE FROM user_graph_nodes
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_graph_edges) >= 0
         RETURNING id
       ),
       deleted_items AS (
         DELETE FROM user_knowledge_items
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_sources) >= 0
           AND (SELECT COUNT(*) FROM deleted_revisions) >= 0
           AND (SELECT COUNT(*) FROM deleted_activity) >= 0
           AND (SELECT COUNT(*) FROM deleted_knowledge_product_events) >= 0
           AND (SELECT COUNT(*) FROM deleted_supersessions) >= 0
           AND (SELECT COUNT(*) FROM deleted_private_states) >= 0
           AND (SELECT COUNT(*) FROM deleted_graph_nodes) >= 0
         RETURNING id
       ),
       deleted_create_requests AS (
         DELETE FROM user_knowledge_create_requests WHERE user_id = $1 RETURNING request_id
       ),
       deleted_drafts AS (
         DELETE FROM knowledge_card_drafts
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_sources) >= 0
         RETURNING id
       ),
       deleted_batches AS (
         DELETE FROM knowledge_ingestion_batches
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_drafts) >= 0
           AND (SELECT COUNT(*) FROM deleted_knowledge_product_events) >= 0
         RETURNING id
       ),
       deleted_ingestion_request_tombstones AS (
         DELETE FROM knowledge_ingestion_request_tombstones
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_batches) >= 0
         RETURNING request_id
       ),
       selected_mcp_tokens AS MATERIALIZED (
         SELECT id FROM mcp_access_tokens WHERE user_id = $1
       ),
       deleted_mcp_rate_limits AS (
         DELETE FROM mcp_request_rate_limits
         WHERE scope_key = 'user:' || $1
            OR scope_key = $2
            OR scope_key LIKE $2 || ':%'
            OR scope_key IN (SELECT 'token:' || id FROM selected_mcp_tokens)
         -- credential:* fingerprints are non-reversible and remain subject to bounded stale cleanup.
         RETURNING scope_key
       ),
       deleted_tokens AS (
         DELETE FROM mcp_access_tokens
         WHERE user_id = $1
           AND (SELECT COUNT(*) FROM deleted_mcp_rate_limits) >= 0
         RETURNING id
       ),
       deleted_evidence AS (
         DELETE FROM user_knowledge_evidence WHERE user_id = $1 RETURNING id
       ),
       deleted_knowledge_states AS (
         DELETE FROM user_knowledge_states WHERE user_id = $1 RETURNING node_id
       ),
       deleted_quiz_limits AS (
         DELETE FROM user_quiz_rate_limits WHERE user_id = $1 RETURNING user_id
       ),
       deleted_card_states AS (
         DELETE FROM user_card_states WHERE user_id = $1 RETURNING card_id
       ),
       deleted_toss_limits AS (
         DELETE FROM toss_prepare_rate_limits WHERE user_id = $1 RETURNING user_id
       ),
       deleted_billing_limits AS (
         DELETE FROM billing_request_rate_limits WHERE user_id = $1 RETURNING user_id
       )
     SELECT
       (SELECT COUNT(*) FROM deleted_evidence_spans) AS deleted_evidence_spans,
       (SELECT COUNT(*) FROM deleted_revisions) AS deleted_revisions,
       (SELECT COUNT(*) FROM deleted_activity) AS deleted_activity,
       (SELECT COUNT(*) FROM deleted_knowledge_product_events) AS deleted_knowledge_product_events,
       (SELECT COUNT(*) FROM deleted_supersessions) AS deleted_supersessions,
       (SELECT COUNT(*) FROM deleted_recall_attempts) AS deleted_recall_attempts,
       (SELECT COUNT(*) FROM deleted_items) AS deleted_items,
       (SELECT COUNT(*) FROM deleted_create_requests) AS deleted_create_requests,
       (SELECT COUNT(*) FROM deleted_ingestion_request_tombstones) AS deleted_ingestion_request_tombstones,
       (SELECT COUNT(*) FROM deleted_batches) AS deleted_batches,
       (SELECT COUNT(*) FROM deleted_mcp_rate_limits) AS deleted_mcp_rate_limits,
       (SELECT COUNT(*) FROM deleted_tokens) AS deleted_tokens,
       (SELECT COUNT(*) FROM deleted_evidence) AS deleted_evidence,
       (SELECT COUNT(*) FROM deleted_knowledge_states) AS deleted_knowledge_states,
       (SELECT COUNT(*) FROM deleted_quiz_limits) AS deleted_quiz_limits,
       (SELECT COUNT(*) FROM deleted_card_states) AS deleted_card_states,
       (SELECT COUNT(*) FROM deleted_toss_limits) AS deleted_toss_limits,
       (SELECT COUNT(*) FROM deleted_billing_limits) AS deleted_billing_limits`,
    params: [userId, deriveMcpTokenCreationRateScopeKey(userId)],
  };
}
