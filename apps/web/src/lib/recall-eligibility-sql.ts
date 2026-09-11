export const ACTIVE_RECALL_ITEM_PREDICATE = `
  i.user_id = $1
  AND i.archived_at IS NULL
  AND i.deleted_at IS NULL
  AND i.purge_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM knowledge_item_supersessions supersession
    WHERE supersession.user_id = i.user_id
      AND supersession.superseded_item_id = i.id
  )
`;

function approvedCurrentConversationPredicate(excludedBatchExpression?: string): string {
  const batchExclusion = excludedBatchExpression
    ? `\n     AND b.id <> ${excludedBatchExpression}`
    : '';
  return `
  EXISTS (
    SELECT 1
    FROM knowledge_card_drafts d
    JOIN knowledge_ingestion_batches b
      ON b.id = d.batch_id
     AND b.user_id = i.user_id
     AND b.source_type = 'conversation'
     AND b.scope = 'current_conversation'
     AND b.status IN ('partial', 'approved')${batchExclusion}
    JOIN knowledge_card_sources src
      ON src.knowledge_item_id = i.id
     AND src.user_id = i.user_id
     AND src.draft_id = d.id
     AND src.batch_id = b.id
     AND src.source_type = 'conversation'
     AND src.supported_item_version = i.version
    WHERE d.knowledge_item_id = i.id
      AND d.user_id = i.user_id
      AND d.status = 'approved'
      AND d.approved_at IS NOT NULL
  )
`;
}

export const APPROVED_CURRENT_CONVERSATION_PREDICATE = approvedCurrentConversationPredicate();

function approvedCurrentConversationExcludingBatchPredicate(
  excludedBatchExpression: string,
): string {
  return approvedCurrentConversationPredicate(excludedBatchExpression);
}

function strictRecallEligibility(
  versionExpression: string,
  excludedBatchExpression?: string,
): string {
  return `
    ${ACTIVE_RECALL_ITEM_PREDICATE}
    AND i.version = ${versionExpression}
    AND i.bundle_schema_version = 1
    AND i.knowledge_type IN ('concept', 'procedure', 'comparison')
    AND i.central_question IS NOT NULL
    AND i.structured_content IS NOT NULL
    AND ${excludedBatchExpression
      ? approvedCurrentConversationExcludingBatchPredicate(excludedBatchExpression)
      : APPROVED_CURRENT_CONVERSATION_PREDICATE}
  `;
}

export function strictRecallEligibilityPredicate(versionExpression: string): string {
  return strictRecallEligibility(versionExpression);
}

export function strictRecallEligibilityExcludingBatchPredicate(
  versionExpression: string,
  excludedBatchExpression: string,
): string {
  return strictRecallEligibility(versionExpression, excludedBatchExpression);
}
