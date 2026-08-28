import db from '@/lib/db';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import { parseKnowledgeBundleFields } from '@/lib/knowledge-bundle-runtime';

export const PERSONAL_CARD_ID_PREFIX = 'personal:';
const MAX_PERSONAL_KNOWLEDGE_ITEM_ID_LENGTH = 128;
const PERSONAL_KNOWLEDGE_ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export type PrivatePracticeStatus = 'known' | 'saved';
export type PrivatePracticeMode = 'new' | 'review';

export type PrivatePracticeCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  wiki_url: string;
  domain: string;
  level: 'understand';
  status: PrivatePracticeStatus | null;
  knowledge_state: 'unknown' | 'known' | null;
  progress_state: 'learning' | 'review' | null;
  due_at: Date | null;
  last_seen: Date | null;
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
};

export type PrivatePracticeStats = {
  known_count: number;
  saved_count: number;
};

export type PrivatePracticeDomainProgress = {
  domain: string;
  reviewed: number;
  known: number;
  saved: number;
};

export type PrivatePracticeEligibilityRecord = {
  item_user_id: string;
  draft_user_id: string | null;
  batch_user_id: string | null;
  source_user_id: string | null;
  draft_status: string | null;
  approved_at: Date | string | null;
  batch_status: string | null;
  batch_source_type: string | null;
  source_type: string | null;
  knowledge_type?: string | null;
  central_question?: string | null;
  structured_content?: unknown;
  bundle_schema_version?: number | null;
  archived_at: Date | string | null;
  deleted_at: Date | string | null;
  purge_at: Date | string | null;
  is_superseded: boolean;
};

type PrivatePracticeCardRow = PrivatePracticeEligibilityRecord & {
  knowledge_item_id: string;
  title: string;
  summary: string;
  explanation: string;
  domain: string;
  status: PrivatePracticeStatus | null;
  knowledge_state: 'unknown' | 'known' | null;
  progress_state: 'learning' | 'review' | null;
  due_at: Date | string | null;
  last_seen: Date | string | null;
};

type CountRow = {
  known_count: string | number | null;
  saved_count: string | number | null;
};

type DomainRow = {
  domain: string | null;
  reviewed: string | number;
  known: string | number;
  saved: string | number;
};

function parseCount(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseInt(value ?? '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toPersonalCardId(knowledgeItemId: string): string {
  const normalized = knowledgeItemId.trim();
  if (
    normalized.length === 0
    || normalized.length > MAX_PERSONAL_KNOWLEDGE_ITEM_ID_LENGTH
    || !PERSONAL_KNOWLEDGE_ITEM_ID_PATTERN.test(normalized)
  ) {
    throw new Error('Invalid personal knowledge item id.');
  }
  return `${PERSONAL_CARD_ID_PREFIX}${normalized}`;
}

export function parsePersonalCardId(cardId: string): string | null {
  if (!cardId.startsWith(PERSONAL_CARD_ID_PREFIX)) return null;
  const knowledgeItemId = cardId.slice(PERSONAL_CARD_ID_PREFIX.length);
  if (
    knowledgeItemId.length === 0
    || knowledgeItemId.length > MAX_PERSONAL_KNOWLEDGE_ITEM_ID_LENGTH
    || !PERSONAL_KNOWLEDGE_ITEM_ID_PATTERN.test(knowledgeItemId)
  ) {
    return null;
  }
  return knowledgeItemId;
}

export function isPersonalCardId(cardId: string): boolean {
  return cardId.startsWith(PERSONAL_CARD_ID_PREFIX);
}

/**
 * Defense-in-depth for the private practice boundary. SQL applies the same
 * predicates, and rows are checked again before any private content is returned.
 */
export function isEligiblePrivatePracticeRecord(
  record: PrivatePracticeEligibilityRecord,
  actorUserId: string,
): boolean {
  const typedManual = parseKnowledgeBundleFields({
    knowledge_type: record.knowledge_type,
    central_question: record.central_question,
    structured_content: record.structured_content,
    bundle_schema_version: record.bundle_schema_version,
  }) !== null && record.draft_user_id === null && record.batch_user_id === null && record.source_user_id === null;
  const approvedConversation = record.draft_user_id === actorUserId
    && record.batch_user_id === actorUserId
    && record.source_user_id === actorUserId
    && record.draft_status === 'approved'
    && record.approved_at !== null
    && (record.batch_status === 'partial' || record.batch_status === 'approved')
    && record.batch_source_type === 'conversation'
    && record.source_type === 'conversation';
  return record.item_user_id === actorUserId && (typedManual || approvedConversation)
    && record.archived_at === null && record.deleted_at === null && record.purge_at === null
    && record.is_superseded === false;
}

const ELIGIBLE_PRIVATE_CARD_FROM = `
  FROM user_knowledge_items i
  LEFT JOIN knowledge_card_drafts d
    ON d.knowledge_item_id = i.id
   AND d.user_id = i.user_id
   AND d.status = 'approved'
   AND d.approved_at IS NOT NULL
  LEFT JOIN knowledge_ingestion_batches b
    ON b.id = d.batch_id
   AND b.user_id = i.user_id
   AND b.source_type = 'conversation'
   AND b.status IN ('partial', 'approved')
  LEFT JOIN knowledge_card_sources src
    ON src.knowledge_item_id = i.id
   AND src.user_id = i.user_id
   AND src.draft_id = d.id
   AND src.batch_id = b.id
   AND src.source_type = 'conversation'
`;

const SUPERSEDED_OWNER_PREDICATE = `EXISTS (
  SELECT 1
  FROM knowledge_item_supersessions supersession
  WHERE supersession.user_id = i.user_id
    AND supersession.superseded_item_id = i.id
)`;

const ACTIVE_OWNER_PREDICATE = `
  i.user_id = $1
  AND i.archived_at IS NULL
  AND i.deleted_at IS NULL
  AND i.purge_at IS NULL
  AND NOT ${SUPERSEDED_OWNER_PREDICATE}
`;

const APPROVED_CONVERSATION_SOURCE_PREDICATE = `
  EXISTS (
    SELECT 1
    FROM knowledge_card_drafts d
    JOIN knowledge_ingestion_batches b
      ON b.id = d.batch_id
     AND b.user_id = i.user_id
     AND b.source_type = 'conversation'
     AND b.status IN ('partial', 'approved')
    JOIN knowledge_card_sources src
      ON src.knowledge_item_id = i.id
     AND src.user_id = i.user_id
     AND src.draft_id = d.id
     AND src.batch_id = b.id
     AND src.source_type = 'conversation'
    WHERE d.knowledge_item_id = i.id
      AND d.user_id = i.user_id
      AND d.status = 'approved'
      AND d.approved_at IS NOT NULL
  )
`;

const PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE = `
  ((i.knowledge_type IS NOT NULL AND i.central_question IS NOT NULL
    AND i.structured_content IS NOT NULL AND i.bundle_schema_version = 1)
   OR ${APPROVED_CONVERSATION_SOURCE_PREDICATE})
`;

function mapPrivatePracticeCard(
  row: PrivatePracticeCardRow,
  actorUserId: string,
): PrivatePracticeCard | null {
  if (!isEligiblePrivatePracticeRecord(row, actorUserId)) return null;
  let cardId: string;
  try {
    cardId = toPersonalCardId(row.knowledge_item_id);
  } catch {
    return null;
  }
  const bundle = parseKnowledgeBundleFields({
    knowledge_type: row.knowledge_type,
    central_question: row.central_question,
    structured_content: row.structured_content,
    bundle_schema_version: row.bundle_schema_version,
  });

  return {
    id: cardId,
    title: row.title,
    summary: row.summary,
    explanation: row.explanation,
    wiki_url: '',
    domain: row.domain,
    level: 'understand',
    status: row.status,
    knowledge_state: row.knowledge_state,
    progress_state: row.progress_state,
    due_at: row.due_at ? new Date(row.due_at) : null,
    last_seen: row.last_seen ? new Date(row.last_seen) : null,
    knowledge_type: bundle?.knowledge_type ?? null,
    central_question: bundle?.central_question ?? null,
    structured_content: bundle?.structured_content ?? null,
    bundle_schema_version: bundle?.bundle_schema_version ?? null,
  };
}

export async function getEligiblePrivatePracticeCards(
  userId: string,
  mode: PrivatePracticeMode,
): Promise<PrivatePracticeCard[]> {
  const modePredicate = mode === 'review'
    ? `AND (s.progress_state = 'learning' OR s.status = 'saved')
       AND (s.due_at IS NULL OR s.due_at <= NOW())`
    : '';
  const result = await db.query<PrivatePracticeCardRow>(`
    SELECT DISTINCT ON (i.id)
      i.id AS knowledge_item_id,
      i.title,
      COALESCE(NULLIF(i.summary, ''), NULLIF(i.content, ''), i.title) AS summary,
      COALESCE(NULLIF(i.content, ''), NULLIF(i.summary, ''), i.title) AS explanation,
      COALESCE(NULLIF(i.topic, ''), 'personal') AS domain,
      i.knowledge_type,
      i.central_question,
      i.structured_content,
      i.bundle_schema_version,
      s.status,
      s.knowledge_state,
      s.progress_state,
      s.due_at,
      s.last_seen,
      i.user_id AS item_user_id,
      d.user_id AS draft_user_id,
      b.user_id AS batch_user_id,
      src.user_id AS source_user_id,
      d.status AS draft_status,
      d.approved_at,
      b.status AS batch_status,
      b.source_type AS batch_source_type,
      src.source_type,
      i.archived_at,
      i.deleted_at,
      i.purge_at,
      ${SUPERSEDED_OWNER_PREDICATE} AS is_superseded
    ${ELIGIBLE_PRIVATE_CARD_FROM}
    LEFT JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
      ${modePredicate}
    ORDER BY i.id, s.last_seen NULLS FIRST, i.created_at ASC
  `, [userId]);

  return result.rows
    .filter((row) => isEligiblePrivatePracticeRecord(row, userId))
    .map((row) => mapPrivatePracticeCard(row, userId))
    .filter((card): card is PrivatePracticeCard => card !== null);
}

export async function savePrivatePracticeCardState(
  userId: string,
  knowledgeItemId: string,
  status: PrivatePracticeStatus,
): Promise<boolean> {
  const [result] = await db.accountTransaction<{ knowledge_item_id: string }>(userId, [{
    text: `INSERT INTO user_private_card_states (
      user_id,
      knowledge_item_id,
      status,
      knowledge_state,
      progress_state,
      due_at,
      last_seen
    )
    SELECT
      i.user_id,
      i.id,
      $3,
      CASE WHEN $3 = 'known' THEN 'known' ELSE 'unknown' END,
      CASE WHEN $3 = 'known' THEN 'review' ELSE 'learning' END,
      CASE WHEN $3 = 'known' THEN NOW() + INTERVAL '14 days' ELSE NOW() END,
      NOW()
    FROM user_knowledge_items i
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND i.id = $2
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
    ON CONFLICT (user_id, knowledge_item_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      knowledge_state = EXCLUDED.knowledge_state,
      progress_state = EXCLUDED.progress_state,
      due_at = EXCLUDED.due_at,
      last_seen = EXCLUDED.last_seen
    RETURNING knowledge_item_id`,
    params: [userId, knowledgeItemId, status],
  }]);

  return result.rows.length === 1;
}

export async function getSavedPrivatePracticeCards(userId: string): Promise<PrivatePracticeCard[]> {
  const result = await db.query<PrivatePracticeCardRow>(`
    SELECT DISTINCT ON (i.id)
      i.id AS knowledge_item_id,
      i.title,
      COALESCE(NULLIF(i.summary, ''), NULLIF(i.content, ''), i.title) AS summary,
      COALESCE(NULLIF(i.content, ''), NULLIF(i.summary, ''), i.title) AS explanation,
      COALESCE(NULLIF(i.topic, ''), 'personal') AS domain,
      i.knowledge_type,
      i.central_question,
      i.structured_content,
      i.bundle_schema_version,
      s.status,
      s.knowledge_state,
      s.progress_state,
      s.due_at,
      s.last_seen,
      i.user_id AS item_user_id,
      d.user_id AS draft_user_id,
      b.user_id AS batch_user_id,
      src.user_id AS source_user_id,
      d.status AS draft_status,
      d.approved_at,
      b.status AS batch_status,
      b.source_type AS batch_source_type,
      src.source_type,
      i.archived_at,
      i.deleted_at,
      i.purge_at,
      ${SUPERSEDED_OWNER_PREDICATE} AS is_superseded
    ${ELIGIBLE_PRIVATE_CARD_FROM}
    JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
      AND (s.progress_state = 'learning' OR s.status = 'saved')
    ORDER BY i.id, s.last_seen DESC
  `, [userId]);

  return result.rows
    .filter((row) => isEligiblePrivatePracticeRecord(row, userId))
    .map((row) => mapPrivatePracticeCard(row, userId))
    .filter((card): card is PrivatePracticeCard => card !== null);
}

export async function removePrivatePracticeCardState(
  userId: string,
  knowledgeItemId: string,
): Promise<boolean> {
  const result = await db.query<{ eligible: boolean; deleted: boolean }>(`
    WITH eligible AS (
      SELECT i.id
      FROM user_knowledge_items i
      WHERE ${ACTIVE_OWNER_PREDICATE}
        AND i.id = $2
        AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
      LIMIT 1
    ), deleted AS (
      DELETE FROM user_private_card_states s
      WHERE s.user_id = $1
        AND s.knowledge_item_id = $2
        AND EXISTS (SELECT 1 FROM eligible)
      RETURNING s.knowledge_item_id
    )
    SELECT
      EXISTS (SELECT 1 FROM eligible) AS eligible,
      EXISTS (SELECT 1 FROM deleted) AS deleted
  `, [userId, knowledgeItemId]);

  return result.rows[0]?.eligible === true;
}

export async function getPrivatePracticeStats(userId: string): Promise<PrivatePracticeStats> {
  const result = await db.query<CountRow>(`
    SELECT
      COUNT(*) FILTER (WHERE s.knowledge_state = 'known' OR s.status = 'known') AS known_count,
      COUNT(*) FILTER (WHERE s.progress_state = 'learning' OR s.status = 'saved') AS saved_count
    FROM user_knowledge_items i
    JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
  `, [userId]);
  const row = result.rows[0];
  return {
    known_count: parseCount(row?.known_count),
    saved_count: parseCount(row?.saved_count),
  };
}

export async function getPrivatePracticeDomainProgress(
  userId: string,
): Promise<PrivatePracticeDomainProgress[]> {
  const result = await db.query<DomainRow>(`
    SELECT
      COALESCE(NULLIF(i.topic, ''), 'personal') AS domain,
      COUNT(*) AS reviewed,
      COUNT(*) FILTER (WHERE s.knowledge_state = 'known' OR s.status = 'known') AS known,
      COUNT(*) FILTER (WHERE s.progress_state = 'learning' OR s.status = 'saved') AS saved
    FROM user_knowledge_items i
    JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
    GROUP BY COALESCE(NULLIF(i.topic, ''), 'personal')
    ORDER BY reviewed DESC, domain ASC
  `, [userId]);

  return result.rows.map((row) => ({
    domain: row.domain?.trim() || 'personal',
    reviewed: parseCount(row.reviewed),
    known: parseCount(row.known),
    saved: parseCount(row.saved),
  }));
}

export async function resetPrivatePracticeProgress(userId: string): Promise<void> {
  await db.query('DELETE FROM user_private_card_states WHERE user_id = $1', [userId]);
}
