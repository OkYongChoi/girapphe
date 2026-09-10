import db from '@/lib/db';
import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import { parseKnowledgeBundleFields } from '@/lib/knowledge-bundle-runtime';
import { recallScheduleLockKey } from '@/lib/recall-schedule-lock';

export const PERSONAL_CARD_ID_PREFIX = 'personal:';
const MAX_PERSONAL_KNOWLEDGE_ITEM_ID_LENGTH = 128;
const PERSONAL_KNOWLEDGE_ITEM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const KNOWLEDGE_BUNDLE_TYPES = new Set([
  'concept', 'procedure', 'comparison', 'mechanism', 'structure',
  'claim_evidence', 'question', 'decision', 'event', 'expression',
]);

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
  reviewable_count: number;
};

export type PrivatePracticeDomainProgress = {
  domain: string;
  reviewed: number;
  known: number;
  saved: number;
};

export type PrivatePracticeEligibilityRecord = {
  item_user_id: string;
  has_approved_ingestion_draft: boolean;
  has_eligible_conversation_source: boolean;
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
  reviewable_count: string | number | null;
};

type DomainRow = {
  domain: string | null;
  reviewed: string | number;
  known: string | number;
  saved: string | number;
};

type PrivatePracticeMutationRow = {
  knowledge_item_id?: string | null;
  recall_schedule_state?: string | null;
  eligible?: boolean;
  deleted?: boolean;
};

export type PrivatePracticeSaveResult =
  | { kind: 'saved' }
  | { kind: 'active_recall' }
  | { kind: 'not_available' };

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

function hasStoredTypedBundleShape(record: PrivatePracticeEligibilityRecord): boolean {
  const content = record.structured_content;
  return typeof record.knowledge_type === 'string'
    && KNOWLEDGE_BUNDLE_TYPES.has(record.knowledge_type)
    && typeof record.central_question === 'string'
    && record.central_question.replace(/^ +| +$/g, '').length > 0
    && Boolean(content)
    && typeof content === 'object'
    && !Array.isArray(content)
    && (content as Record<string, unknown>).type === record.knowledge_type
    && record.bundle_schema_version === 1;
}

/**
 * Defense-in-depth for the private practice boundary. SQL applies the same
 * predicates, and rows are checked again before any private content is returned.
 */
export function isEligiblePrivatePracticeRecord(
  record: PrivatePracticeEligibilityRecord,
  actorUserId: string,
): boolean {
  const typedManual = hasStoredTypedBundleShape(record)
    && !record.has_approved_ingestion_draft;
  const approvedConversation = record.has_approved_ingestion_draft
    && record.has_eligible_conversation_source;
  return record.item_user_id === actorUserId && (typedManual || approvedConversation)
    && record.archived_at === null && record.deleted_at === null && record.purge_at === null
    && record.is_superseded === false;
}

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

const APPROVED_OWNER_INGESTION_DRAFT_PREDICATE = `EXISTS (
  SELECT 1
  FROM knowledge_card_drafts approved_draft
  WHERE approved_draft.knowledge_item_id = i.id
    AND approved_draft.user_id = i.user_id
    AND approved_draft.status = 'approved'
    AND approved_draft.approved_at IS NOT NULL
)`;

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

const STORED_TYPED_BUNDLE_PREDICATE = `
  (i.knowledge_type IN (
      'concept', 'procedure', 'comparison', 'mechanism', 'structure',
      'claim_evidence', 'question', 'decision', 'event', 'expression'
    )
    AND i.central_question IS NOT NULL
    AND btrim(i.central_question) <> ''
    AND jsonb_typeof(i.structured_content) = 'object'
    AND i.structured_content ->> 'type' = i.knowledge_type
    AND i.bundle_schema_version = 1)
`;

const PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE = `
  ((${STORED_TYPED_BUNDLE_PREDICATE}
     AND NOT ${APPROVED_OWNER_INGESTION_DRAFT_PREDICATE})
   OR ${APPROVED_CONVERSATION_SOURCE_PREDICATE})
`;

const PRIVATE_PRACTICE_ID_PREDICATE = `
  char_length(i.id) BETWEEN 1 AND ${MAX_PERSONAL_KNOWLEDGE_ITEM_ID_LENGTH}
  AND i.id ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'
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

function privatePracticeModePredicate(mode: PrivatePracticeMode): string {
  return mode === 'review'
    ? `AND (
         s.recall_schedule_state IS NULL
         OR s.recall_schedule_state = 'ordinary_practice'
       )
       AND (
          (
            s.progress_state = 'learning'
            AND s.status = 'saved'
            AND (s.due_at IS NULL OR s.due_at <= NOW())
          )
          OR (
            s.progress_state = 'review'
            AND s.status = 'known'
            AND s.due_at IS NOT NULL
            AND s.due_at <= NOW()
          )
       )`
    : `AND s.status IS NULL
       AND (
         s.recall_schedule_state IS NULL
         OR (
           s.recall_schedule_state = 'ordinary_practice'
           AND s.due_at IS NOT NULL
           AND s.due_at <= NOW()
         )
       )`;
}

export function buildEligiblePrivatePracticeQuery(
  userId: string,
  mode: PrivatePracticeMode,
  options?: { afterKnowledgeItemId?: string; limitOne?: boolean },
): { text: string; params: string[] } {
  const modePredicate = privatePracticeModePredicate(mode);
  const cursorPredicate = options?.afterKnowledgeItemId === undefined
    ? ''
    : 'AND i.id > $2';
  const limit = options?.limitOne ? 'LIMIT 1' : '';
  const params = options?.afterKnowledgeItemId === undefined
    ? [userId]
    : [userId, options.afterKnowledgeItemId];
  return {
    text: `
    SELECT
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
      ${APPROVED_OWNER_INGESTION_DRAFT_PREDICATE} AS has_approved_ingestion_draft,
      ${APPROVED_CONVERSATION_SOURCE_PREDICATE} AS has_eligible_conversation_source,
      i.archived_at,
      i.deleted_at,
      i.purge_at,
      ${SUPERSEDED_OWNER_PREDICATE} AS is_superseded
    FROM user_knowledge_items i
    LEFT JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
      AND ${PRIVATE_PRACTICE_ID_PREDICATE}
      ${cursorPredicate}
      ${modePredicate}
    ORDER BY i.id ASC
    ${limit}
  `,
    params,
  };
}

async function queryEligiblePrivatePracticeCards(
  userId: string,
  mode: PrivatePracticeMode,
  options?: { afterKnowledgeItemId?: string; limitOne?: boolean },
): Promise<PrivatePracticeCard[]> {
  const query = buildEligiblePrivatePracticeQuery(userId, mode, options);
  const result = await db.query<PrivatePracticeCardRow>(query.text, query.params);

  return result.rows
    .filter((row) => isEligiblePrivatePracticeRecord(row, userId))
    .map((row) => mapPrivatePracticeCard(row, userId))
    .filter((card): card is PrivatePracticeCard => card !== null);
}

export async function getEligiblePrivatePracticeCards(
  userId: string,
  mode: PrivatePracticeMode,
): Promise<PrivatePracticeCard[]> {
  return queryEligiblePrivatePracticeCards(userId, mode);
}

export async function getNextEligiblePrivatePracticeCard(
  userId: string,
  mode: PrivatePracticeMode,
  afterCardId: string | null,
): Promise<PrivatePracticeCard | null> {
  const afterKnowledgeItemId = afterCardId === null ? '' : parsePersonalCardId(afterCardId);
  if (afterKnowledgeItemId === null) {
    throw new TypeError('Invalid private Practice cursor card id.');
  }
  const [card] = await queryEligiblePrivatePracticeCards(userId, mode, {
    afterKnowledgeItemId,
    limitOne: true,
  });
  return card ?? null;
}

export async function savePrivatePracticeCardState(
  userId: string,
  knowledgeItemId: string,
  status: PrivatePracticeStatus,
): Promise<PrivatePracticeSaveResult> {
  const [, result, probe] = await db.accountTransaction<PrivatePracticeMutationRow>(userId, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [recallScheduleLockKey(userId, knowledgeItemId)],
    },
    {
      text: `INSERT INTO user_private_card_states AS s (
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
      AND ${PRIVATE_PRACTICE_ID_PREDICATE}
    ON CONFLICT (user_id, knowledge_item_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      knowledge_state = EXCLUDED.knowledge_state,
      progress_state = EXCLUDED.progress_state,
      due_at = EXCLUDED.due_at,
      last_seen = EXCLUDED.last_seen
    WHERE s.recall_schedule_state IS NULL
       OR s.recall_schedule_state = 'ordinary_practice'
    RETURNING knowledge_item_id, recall_schedule_state`,
      params: [userId, knowledgeItemId, status],
    },
    {
      text: `SELECT
        i.id AS knowledge_item_id,
        s.recall_schedule_state
      FROM user_knowledge_items i
      LEFT JOIN user_private_card_states s
        ON s.user_id = i.user_id
       AND s.knowledge_item_id = i.id
      WHERE ${ACTIVE_OWNER_PREDICATE}
        AND i.id = $2
        AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
        AND ${PRIVATE_PRACTICE_ID_PREDICATE}
      LIMIT 1`,
      params: [userId, knowledgeItemId],
    },
  ]);

  if (result.rows.length === 1) return { kind: 'saved' };
  if (probe.rows[0]?.recall_schedule_state
    && probe.rows[0].recall_schedule_state !== 'ordinary_practice') {
    return { kind: 'active_recall' };
  }
  return { kind: 'not_available' };
}

export async function getSavedPrivatePracticeCards(userId: string): Promise<PrivatePracticeCard[]> {
  const result = await db.query<PrivatePracticeCardRow>(`
    SELECT
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
      ${APPROVED_OWNER_INGESTION_DRAFT_PREDICATE} AS has_approved_ingestion_draft,
      ${APPROVED_CONVERSATION_SOURCE_PREDICATE} AS has_eligible_conversation_source,
      i.archived_at,
      i.deleted_at,
      i.purge_at,
      ${SUPERSEDED_OWNER_PREDICATE} AS is_superseded
    FROM user_knowledge_items i
    JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
      AND ${PRIVATE_PRACTICE_ID_PREDICATE}
      AND (s.progress_state = 'learning' OR s.status = 'saved')
    ORDER BY i.id ASC
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
  const [, result] = await db.accountTransaction<PrivatePracticeMutationRow>(userId, [
    {
      text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
      params: [recallScheduleLockKey(userId, knowledgeItemId)],
    },
    {
      text: `
    WITH eligible AS (
      SELECT i.id
      FROM user_knowledge_items i
      WHERE ${ACTIVE_OWNER_PREDICATE}
        AND i.id = $2
        AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
        AND ${PRIVATE_PRACTICE_ID_PREDICATE}
      LIMIT 1
    ), invalidated_attempts AS (
      UPDATE recall_attempts a
      SET lifecycle_state = 'invalidated',
          invalidated_at = NOW(),
          invalidation_reason = 'item_removed',
          updated_at = NOW()
      WHERE a.user_id = $1
        AND a.knowledge_item_id = $2
        AND a.lifecycle_state IN ('prepared', 'confidence_selected', 'revealed')
        AND EXISTS (SELECT 1 FROM eligible)
      RETURNING a.id
    ), deleted AS (
      DELETE FROM user_private_card_states s
      WHERE s.user_id = $1
        AND s.knowledge_item_id = $2
        AND EXISTS (SELECT 1 FROM eligible)
        AND (SELECT COUNT(*) FROM invalidated_attempts) >= 0
      RETURNING s.knowledge_item_id
    )
    SELECT
      EXISTS (SELECT 1 FROM eligible) AS eligible,
      EXISTS (SELECT 1 FROM deleted) AS deleted
  `,
      params: [userId, knowledgeItemId],
    },
  ]);

  return result.rows[0]?.eligible === true;
}

export async function getPrivatePracticeStats(userId: string): Promise<PrivatePracticeStats> {
  const result = await db.query<CountRow>(`
    SELECT
      COUNT(*) FILTER (WHERE s.knowledge_state = 'known' OR s.status = 'known') AS known_count,
      COUNT(*) FILTER (WHERE s.progress_state = 'learning' OR s.status = 'saved') AS saved_count,
      COUNT(*) FILTER (
        WHERE (s.recall_schedule_state IS NULL OR s.recall_schedule_state = 'ordinary_practice')
          AND (
            (
              s.progress_state = 'learning'
              AND s.status = 'saved'
              AND (s.due_at IS NULL OR s.due_at <= NOW())
            )
            OR (
              s.progress_state = 'review'
              AND s.status = 'known'
              AND s.due_at IS NOT NULL
              AND s.due_at <= NOW()
            )
          )
      ) AS reviewable_count
    FROM user_knowledge_items i
    JOIN user_private_card_states s
      ON s.knowledge_item_id = i.id
     AND s.user_id = i.user_id
    WHERE ${ACTIVE_OWNER_PREDICATE}
      AND ${PRIVATE_PRACTICE_ELIGIBILITY_PREDICATE}
      AND ${PRIVATE_PRACTICE_ID_PREDICATE}
  `, [userId]);
  const row = result.rows[0];
  return {
    known_count: parseCount(row?.known_count),
    saved_count: parseCount(row?.saved_count),
    reviewable_count: parseCount(row?.reviewable_count),
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
      AND ${PRIVATE_PRACTICE_ID_PREDICATE}
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
  await db.accountTransaction(userId, [
    {
      // Serialize against every current schedule and retained attempt before
      // deleting either product history or the authoritative Practice rows.
      text: `WITH ordered_recall_items AS MATERIALIZED (
        SELECT candidates.user_id, candidates.knowledge_item_id
        FROM (
          SELECT s.user_id, s.knowledge_item_id
          FROM user_private_card_states s
          WHERE s.user_id = $1
          UNION
          SELECT a.user_id, a.knowledge_item_id
          FROM recall_attempts a
          WHERE a.user_id = $1
        ) candidates
        ORDER BY candidates.knowledge_item_id
      )
      SELECT pg_advisory_xact_lock(
        hashtext('recall-schedule:' || row.user_id || ':' || row.knowledge_item_id)
      )
      FROM ordered_recall_items row`,
      params: [userId],
    },
    {
      text: 'DELETE FROM recall_attempts WHERE user_id = $1',
      params: [userId],
    },
    {
      text: 'DELETE FROM user_private_card_states WHERE user_id = $1',
      params: [userId],
    },
  ]);
}
