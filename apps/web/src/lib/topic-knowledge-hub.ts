import 'server-only';

import type { KnowledgeBundleContent, KnowledgeBundleType } from '@stem-brain/shared';
import pool from '@/lib/db';
import {
  getMemoryKnowledgeActivityForUser,
  getMemoryKnowledgeEvidenceForUser,
  getMemoryKnowledgeItemsForUser,
  getMemoryKnowledgeRevisionsForUser,
  getMemoryKnowledgeSourcesForUser,
  getMemoryKnowledgeSupersessionsForUser,
  getPrivateKnowledgeGraphForUser,
  normalizeKnowledgeTopic,
  purgeMemoryKnowledgeItemsForUser,
  sanitizeKnowledgeEvidenceSelectors,
} from '@/lib/knowledge-ingestion';
import {
  normalizeKnowledgeOpaqueReference,
  normalizeKnowledgeSourceUrl,
} from '@/lib/knowledge-source-url';

export const MAX_TOPIC_HUB_ITEMS = 200;
export const MAX_CONTEXT_PACK_ITEMS = 100;
export const DEFAULT_CONTEXT_PACK_ITEMS = 50;
export const MAX_CONTEXT_PACK_BYTES = 256 * 1024;

export type TopicKnowledgeHubItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  structured_content: KnowledgeBundleContent | null;
  bundle_schema_version: number | null;
  version: number;
  observed_at: string | null;
  valid_from: string | null;
  valid_to: string | null;
  last_verified_at: string | null;
  review_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TopicKnowledgeSource = {
  id: string;
  knowledge_item_id: string;
  source_type: string;
  provider: string;
  conversation_ref: string | null;
  source_url: string | null;
  source_locator: Record<string, unknown> | null;
  discussed_at: string | null;
  relation_origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
  confirmed_at: string | null;
  created_at: string;
};

export type TopicKnowledgeActivity = {
  id: string;
  knowledge_item_id: string;
  activity_type: 'confirmed' | 'connected' | 'verified' | 'reused' | 'revised' | 'superseded' | 'archived' | 'restored';
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TopicKnowledgeRelation = {
  id: string;
  source: string;
  target: string;
  type: string;
  relation_origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
  confirmed_at: string | null;
};

export type TopicKnowledgeRevision = {
  id: string;
  knowledge_item_id: string;
  version: number;
  snapshot: TopicKnowledgeHubItem;
  change_reason: string | null;
  created_at: string;
};

export type TopicKnowledgeSupersession = {
  id: string;
  superseded_item_id: string;
  replacement_item_id: string;
  reason: string | null;
  created_at: string;
};

export type TopicKnowledgeEvidenceSelector = {
  id: string;
  knowledge_item_id: string;
  source_id: string;
  selector_type: 'message' | 'text_position' | 'line_range' | 'external_ref';
  selector: Record<string, unknown>;
  polarity: 'supports' | 'contradicts';
  quality: 'unknown' | 'low' | 'medium' | 'high';
  relation_origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
  confirmed_at: string | null;
  created_at: string;
};

export type TopicKnowledgeHub = {
  topic: string;
  generated_at: string;
  items: TopicKnowledgeHubItem[];
  sources: TopicKnowledgeSource[];
  activity: TopicKnowledgeActivity[];
  relations: TopicKnowledgeRelation[];
  revisions: TopicKnowledgeRevision[];
  supersessions: TopicKnowledgeSupersession[];
  evidence_selectors: TopicKnowledgeEvidenceSelector[];
};

export type ActiveKnowledgeTopicSummary = {
  topic: string;
  item_count: number;
  open_question_count: number;
  decision_count: number;
  event_count: number;
  source_count: number;
  last_updated_at: string;
  sample_titles: string[];
};

export type KnowledgeContextFormat = 'json' | 'markdown' | 'yaml';

type TopicHubOptions = {
  includeArchived?: boolean;
  includeSuperseded?: boolean;
  maxItems?: number;
  itemIds?: string[];
};

type ContextPackOptions = TopicHubOptions & {
  maxBytes?: number;
};

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(maximum, Math.trunc(value!)));
}

function mapItem(row: Record<string, unknown>): TopicKnowledgeHubItem {
  return {
    id: String(row.id),
    title: String(row.title),
    summary: String(row.summary ?? ''),
    content: String(row.content ?? ''),
    topic: String(row.topic),
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    knowledge_type: (row.knowledge_type ?? null) as KnowledgeBundleType | null,
    central_question: row.central_question ? String(row.central_question) : null,
    structured_content: (row.structured_content ?? null) as KnowledgeBundleContent | null,
    bundle_schema_version: row.bundle_schema_version === null || row.bundle_schema_version === undefined
      ? null
      : Number(row.bundle_schema_version),
    version: Number(row.version ?? 1),
    observed_at: iso(row.observed_at),
    valid_from: iso(row.valid_from),
    valid_to: iso(row.valid_to),
    last_verified_at: iso(row.last_verified_at),
    review_at: iso(row.review_at),
    created_at: iso(row.created_at) ?? new Date(0).toISOString(),
    updated_at: iso(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapSource(row: Record<string, unknown>): TopicKnowledgeSource {
  const origin = String(row.relation_origin ?? 'extracted_from_source');
  return {
    id: String(row.id),
    knowledge_item_id: String(row.knowledge_item_id),
    source_type: String(row.source_type ?? 'conversation'),
    provider: String(row.provider ?? 'other'),
    conversation_ref: normalizeKnowledgeOpaqueReference(row.conversation_ref),
    source_url: normalizeKnowledgeSourceUrl(row.source_url),
    source_locator: jsonObject(row.source_locator),
    discussed_at: iso(row.discussed_at),
    relation_origin: origin === 'explicit_user' || origin === 'model_inferred' ? origin : 'extracted_from_source',
    confirmed_at: iso(row.confirmed_at),
    created_at: iso(row.created_at) ?? new Date(0).toISOString(),
  };
}

function mapActivity(row: Record<string, unknown>): TopicKnowledgeActivity {
  return {
    id: String(row.id),
    knowledge_item_id: String(row.knowledge_item_id),
    activity_type: String(row.activity_type) as TopicKnowledgeActivity['activity_type'],
    metadata: jsonObject(row.metadata) ?? {},
    created_at: iso(row.created_at) ?? new Date(0).toISOString(),
  };
}

function mapRevision(row: Record<string, unknown>): TopicKnowledgeRevision {
  const snapshot = jsonObject(row.snapshot) ?? {};
  return {
    id: String(row.id),
    knowledge_item_id: String(row.knowledge_item_id),
    version: Number(row.version ?? 1),
    snapshot: mapItem(snapshot),
    change_reason: row.change_reason ? String(row.change_reason) : null,
    created_at: iso(row.created_at) ?? new Date(0).toISOString(),
  };
}

function relationOrigin(
  value: unknown,
  legacyOrigin?: unknown,
): TopicKnowledgeEvidenceSelector['relation_origin'] {
  return value === 'explicit_user' || value === 'model_inferred'
    ? value
    : value === 'extracted_from_source'
      ? value
      : legacyOrigin === 'manual'
        ? 'explicit_user'
        : 'extracted_from_source';
}

function mapEvidenceSelector(row: Record<string, unknown>): TopicKnowledgeEvidenceSelector {
  const selectorType = String(row.selector_type);
  const selector = sanitizeKnowledgeEvidenceSelectors([{
    selector_type: selectorType,
    ...(jsonObject(row.selector) ?? {}),
    polarity: row.polarity,
    quality: row.quality,
    relation_origin: relationOrigin(row.relation_origin),
  }])[0];
  return {
    id: String(row.id),
    knowledge_item_id: String(row.knowledge_item_id),
    source_id: String(row.source_id),
    selector_type: (
      selectorType === 'text_position'
      || selectorType === 'line_range'
      || selectorType === 'external_ref'
        ? selectorType
        : 'message'
    ),
    selector: selector ? {
      ...(selector.sourceRef ? { source_ref: selector.sourceRef } : {}),
      ...(selector.messageRef ? { message_ref: selector.messageRef } : {}),
      ...(selector.start !== undefined ? { start: selector.start } : {}),
      ...(selector.end !== undefined ? { end: selector.end } : {}),
      ...(selector.lineStart !== undefined ? { line_start: selector.lineStart } : {}),
      ...(selector.lineEnd !== undefined ? { line_end: selector.lineEnd } : {}),
    } : {},
    polarity: row.polarity === 'contradicts' ? 'contradicts' : 'supports',
    quality: row.quality === 'low' || row.quality === 'medium' || row.quality === 'high'
      ? row.quality
      : 'unknown',
    relation_origin: relationOrigin(row.relation_origin),
    confirmed_at: iso(row.confirmed_at),
    created_at: iso(row.created_at) ?? new Date(0).toISOString(),
  };
}

type TopicKnowledgeHubCollections = Omit<TopicKnowledgeHub, 'topic' | 'generated_at'>;

const EPOCH_ISO = new Date(0).toISOString();

function newestFirst(
  leftTimestamp: string,
  rightTimestamp: string,
  leftId: string,
  rightId: string,
) {
  return rightTimestamp.localeCompare(leftTimestamp) || leftId.localeCompare(rightId);
}

function oldestFirst(
  leftTimestamp: string,
  rightTimestamp: string,
  leftId: string,
  rightId: string,
) {
  return leftTimestamp.localeCompare(rightTimestamp) || leftId.localeCompare(rightId);
}

function deterministicGeneratedAt(collections: TopicKnowledgeHubCollections): string {
  const timestamps = [
    ...collections.items.map((item) => item.updated_at),
    ...collections.sources.flatMap((source) => [source.created_at, source.confirmed_at, source.discussed_at]),
    ...collections.activity.map((entry) => entry.created_at),
    ...collections.relations.map((relation) => relation.confirmed_at),
    ...collections.revisions.map((revision) => revision.created_at),
    ...collections.supersessions.map((entry) => entry.created_at),
    ...collections.evidence_selectors.flatMap((entry) => [entry.created_at, entry.confirmed_at]),
  ].filter((value): value is string => Boolean(value));
  if (timestamps.length === 0) return new Date().toISOString();
  return timestamps.reduce((latest, value) => value > latest ? value : latest, EPOCH_ISO);
}

function finalizeTopicKnowledgeHub(
  topic: string,
  collections: TopicKnowledgeHubCollections,
): TopicKnowledgeHub {
  const sorted: TopicKnowledgeHubCollections = {
    items: [...collections.items].sort((left, right) => newestFirst(
      left.updated_at, right.updated_at, left.id, right.id,
    )),
    sources: [...collections.sources].sort((left, right) => oldestFirst(
      left.created_at, right.created_at, left.id, right.id,
    )),
    activity: [...collections.activity].sort((left, right) => newestFirst(
      left.created_at, right.created_at, left.id, right.id,
    )),
    relations: [...collections.relations].sort((left, right) => left.source.localeCompare(right.source)
      || left.target.localeCompare(right.target)
      || left.type.localeCompare(right.type)
      || left.id.localeCompare(right.id)),
    revisions: [...collections.revisions].sort((left, right) => left.knowledge_item_id.localeCompare(right.knowledge_item_id)
      || left.version - right.version
      || left.created_at.localeCompare(right.created_at)
      || left.id.localeCompare(right.id)),
    supersessions: [...collections.supersessions].sort((left, right) => newestFirst(
      left.created_at, right.created_at, left.id, right.id,
    )),
    evidence_selectors: [...collections.evidence_selectors].sort((left, right) => left.knowledge_item_id.localeCompare(right.knowledge_item_id)
      || oldestFirst(left.created_at, right.created_at, left.id, right.id)),
  };
  const visiblePrivateItemIds = new Set([
    ...sorted.items.map((item) => item.id),
    ...sorted.revisions.map((revision) => revision.knowledge_item_id),
    ...sorted.supersessions.flatMap((entry) => [entry.superseded_item_id, entry.replacement_item_id]),
    ...sorted.relations.flatMap((relation) => [relation.source, relation.target]
      .filter((endpoint) => endpoint.startsWith('personal:'))
      .map((endpoint) => endpoint.slice('personal:'.length))),
  ]);
  return {
    topic,
    generated_at: deterministicGeneratedAt(sorted),
    ...sorted,
    activity: sorted.activity.map((entry) => ({
      ...entry,
      metadata: sanitizeActivityMetadataForVisibleItems(
        entry.metadata,
        visiblePrivateItemIds,
        visiblePrivateItemIds,
      ),
    })),
  };
}

export async function getTopicKnowledgeHubForUser(
  userId: string,
  topicInput: string,
  options: TopicHubOptions = {},
): Promise<TopicKnowledgeHub> {
  if (!userId) throw new Error('A user is required.');
  const topic = normalizeKnowledgeTopic(topicInput);
  const limit = boundedLimit(options.maxItems, MAX_TOPIC_HUB_ITEMS, MAX_TOPIC_HUB_ITEMS);
  const requestedItemIds = [...new Set(options.itemIds?.map((id) => id.trim()).filter(Boolean)
    .slice(0, MAX_CONTEXT_PACK_ITEMS) ?? [])];
  const requestedItems = requestedItemIds.length > 0 ? new Set(requestedItemIds) : null;

  if (!process.env.DATABASE_URL) {
    purgeMemoryKnowledgeItemsForUser(userId);
    const allMemoryItems = getMemoryKnowledgeItemsForUser(userId);
    const allSupersessions = getMemoryKnowledgeSupersessionsForUser(userId);
    const supersededIds = new Set(allSupersessions.map((entry) => entry.superseded_item_id));
    const memoryItems = allMemoryItems
      .filter((item) => item.topic === topic && !item.deleted_at)
      .filter((item) => options.includeArchived === true || !item.archived_at)
      .filter((item) => options.includeSuperseded === true || !supersededIds.has(item.id))
      .filter((item) => !requestedItems || requestedItems.has(item.id))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id))
      .slice(0, limit)
      .map((item) => mapItem(item as unknown as Record<string, unknown>));
    const itemIds = new Set(memoryItems.map((item) => item.id));
    const graph = await getPrivateKnowledgeGraphForUser(userId);
    const historyItemIds = new Set([
      ...itemIds,
      ...allMemoryItems
        .filter((item) => item.topic === topic && !item.deleted_at)
        .filter((item) => options.includeArchived === true || !item.archived_at)
        .filter((item) => supersededIds.has(item.id))
        .map((item) => item.id),
    ]);
    for (let depth = 0; depth < 500; depth += 1) {
      let added = false;
      for (const entry of allSupersessions) {
        if (historyItemIds.has(entry.superseding_item_id) && !historyItemIds.has(entry.superseded_item_id)) {
          historyItemIds.add(entry.superseded_item_id);
          added = true;
        }
      }
      if (!added) break;
    }
    const supersessions = allSupersessions
      .filter((entry) => historyItemIds.has(entry.superseded_item_id)
        || historyItemIds.has(entry.superseding_item_id))
      .map((entry) => ({
        id: entry.id,
        superseded_item_id: entry.superseded_item_id,
        replacement_item_id: entry.superseding_item_id,
        reason: entry.reason || null,
        created_at: entry.created_at,
      }));
    return finalizeTopicKnowledgeHub(topic, {
      items: memoryItems,
      sources: getMemoryKnowledgeSourcesForUser(userId, itemIds)
        .map((source) => mapSource(source as unknown as Record<string, unknown>)),
      activity: getMemoryKnowledgeActivityForUser(userId, itemIds)
        .map((entry) => mapActivity(entry as unknown as Record<string, unknown>)),
      relations: graph.edges
        .filter((edge) => itemIds.has(edge.source.replace(/^personal:/, '')) || itemIds.has(edge.target.replace(/^personal:/, '')))
        .map((edge) => ({
          id: edge.id,
          source: edge.source.replace(/^graph_/, 'public:'),
          target: edge.target.replace(/^graph_/, 'public:'),
          type: edge.type,
          relation_origin: relationOrigin(edge.relation_origin, edge.origin),
          confirmed_at: edge.confirmed_at,
        })),
      revisions: getMemoryKnowledgeRevisionsForUser(userId, historyItemIds)
        .map((revision) => mapRevision(revision as unknown as Record<string, unknown>)),
      supersessions,
      evidence_selectors: getMemoryKnowledgeEvidenceForUser(userId, itemIds).map((entry) => {
        const selector = entry.selector;
        return mapEvidenceSelector({
          id: entry.id,
          knowledge_item_id: entry.knowledge_item_id,
          source_id: entry.source_id,
          selector_type: selector.selectorType,
          selector: {
            ...(selector.sourceRef ? { source_ref: selector.sourceRef } : {}),
            ...(selector.messageRef ? { message_ref: selector.messageRef } : {}),
            ...(selector.start !== undefined ? { start: selector.start } : {}),
            ...(selector.end !== undefined ? { end: selector.end } : {}),
            ...(selector.lineStart !== undefined ? { line_start: selector.lineStart } : {}),
            ...(selector.lineEnd !== undefined ? { line_end: selector.lineEnd } : {}),
          },
          polarity: selector.polarity,
          quality: selector.quality,
          relation_origin: selector.relationOrigin,
          confirmed_at: entry.created_at,
          created_at: entry.created_at,
        });
      }),
    });
  }

  const itemResult = await pool.query<Record<string, unknown>>(
    `SELECT i.id, i.title, i.summary, i.content, i.topic, i.tags, i.knowledge_type,
       i.central_question, i.structured_content, i.bundle_schema_version, i.version,
       i.observed_at, i.valid_from, i.valid_to, i.last_verified_at, i.review_at,
       i.created_at, i.updated_at
     FROM user_knowledge_items i
     WHERE i.user_id = $1 AND i.topic = $2 AND i.deleted_at IS NULL
       AND (i.purge_at IS NULL OR i.purge_at > NOW())
       AND ($3::boolean OR i.archived_at IS NULL)
       AND ($4::boolean OR NOT EXISTS (
         SELECT 1 FROM knowledge_item_supersessions s
         WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
       ))
       AND ($5::text[] IS NULL OR i.id = ANY($5::text[]))
     ORDER BY i.updated_at DESC, i.id
     LIMIT $6`,
    [
      userId,
      topic,
      options.includeArchived === true,
      options.includeSuperseded === true,
      requestedItems ? requestedItemIds : null,
      limit,
    ],
  );
  const items = itemResult.rows.map(mapItem);
  const itemIds = items.map((item) => item.id);
  const historyIdResult = await pool.query<{ id: string }>(
    `WITH RECURSIVE topic_history_seed(id) AS (
       SELECT unnest($2::text[])
       UNION
       SELECT i.id
       FROM user_knowledge_items i
       WHERE i.user_id = $1 AND i.topic = $3 AND i.deleted_at IS NULL
         AND (i.purge_at IS NULL OR i.purge_at > NOW())
         AND ($4::boolean OR i.archived_at IS NULL)
         AND EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
     ), history_ids(id) AS (
       SELECT id FROM topic_history_seed
       UNION
       SELECT s.superseded_item_id
       FROM knowledge_item_supersessions s
       JOIN history_ids h ON h.id = s.replacement_item_id
       JOIN user_knowledge_items predecessor
         ON predecessor.id = s.superseded_item_id AND predecessor.user_id = s.user_id
         AND (predecessor.purge_at IS NULL OR predecessor.purge_at > NOW())
       WHERE s.user_id = $1
     )
     SELECT h.id
     FROM history_ids h
     JOIN user_knowledge_items i ON i.id = h.id AND i.user_id = $1
     WHERE i.purge_at IS NULL OR i.purge_at > NOW()
     ORDER BY h.id LIMIT 1000`,
    [userId, itemIds, topic, options.includeArchived === true],
  );
  const historyItemIds = historyIdResult.rows.map((row) => row.id);

  const [
    sourceResult,
    activityResult,
    relationResult,
    revisionResult,
    supersessionResult,
    evidenceResult,
  ] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `SELECT id, knowledge_item_id, source_type, provider, conversation_ref, source_url,
         source_locator, discussed_at, relation_origin, confirmed_at, created_at
       FROM knowledge_card_sources
       WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])
       ORDER BY created_at, id
       LIMIT 500`,
      [userId, itemIds],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, knowledge_item_id, activity_type, metadata, created_at
       FROM knowledge_item_activity
       WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])
       ORDER BY created_at DESC, id
       LIMIT 500`,
      [userId, itemIds],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT e.id,
         COALESCE('personal:' || sn.knowledge_item_id, 'public:' || e.source_public_node_id) AS source,
         COALESCE('personal:' || tn.knowledge_item_id, 'public:' || e.target_public_node_id) AS target,
         e.type, e.origin, e.relation_origin, e.confirmed_at
       FROM user_graph_edges e
       LEFT JOIN user_graph_nodes sn ON sn.id = e.source_private_node_id AND sn.user_id = e.user_id
         AND sn.deleted_at IS NULL
       LEFT JOIN user_graph_nodes tn ON tn.id = e.target_private_node_id AND tn.user_id = e.user_id
         AND tn.deleted_at IS NULL
       LEFT JOIN user_knowledge_items si ON si.id = sn.knowledge_item_id AND si.user_id = sn.user_id
         AND si.deleted_at IS NULL AND si.archived_at IS NULL
         AND (si.purge_at IS NULL OR si.purge_at > NOW())
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions source_supersession
           WHERE source_supersession.user_id = si.user_id
             AND source_supersession.superseded_item_id = si.id
         )
       LEFT JOIN user_knowledge_items ti ON ti.id = tn.knowledge_item_id AND ti.user_id = tn.user_id
         AND ti.deleted_at IS NULL AND ti.archived_at IS NULL
         AND (ti.purge_at IS NULL OR ti.purge_at > NOW())
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions target_supersession
           WHERE target_supersession.user_id = ti.user_id
             AND target_supersession.superseded_item_id = ti.id
         )
       WHERE e.user_id = $1 AND e.deleted_at IS NULL
         AND (sn.knowledge_item_id = ANY($2::text[]) OR tn.knowledge_item_id = ANY($2::text[]))
         AND (e.source_private_node_id IS NULL OR si.id IS NOT NULL)
         AND (e.target_private_node_id IS NULL OR ti.id IS NOT NULL)
       ORDER BY e.created_at, e.id
       LIMIT 500`,
      [userId, itemIds],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT r.id, r.knowledge_item_id, r.version, r.snapshot, r.change_reason, r.created_at
       FROM knowledge_item_revisions r
       WHERE r.user_id = $1 AND r.knowledge_item_id = ANY($2::text[])
       ORDER BY knowledge_item_id, version
       LIMIT 1000`,
      [userId, historyItemIds],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT s.id, s.superseded_item_id, s.replacement_item_id, s.reason, s.created_at
       FROM knowledge_item_supersessions s
       JOIN user_knowledge_items superseded_item
         ON superseded_item.id = s.superseded_item_id AND superseded_item.user_id = s.user_id
         AND (superseded_item.purge_at IS NULL OR superseded_item.purge_at > NOW())
       WHERE s.user_id = $1
         AND (s.superseded_item_id = ANY($2::text[]) OR s.replacement_item_id = ANY($2::text[]))
       ORDER BY s.created_at DESC, s.id
       LIMIT 500`,
      [userId, historyItemIds],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, knowledge_item_id, source_id, selector_type, selector,
         polarity, quality, relation_origin, confirmed_at, created_at
       FROM knowledge_evidence_spans
       WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])
       ORDER BY created_at, id
       LIMIT 1000`,
      [userId, itemIds],
    ),
  ]);

  return finalizeTopicKnowledgeHub(topic, {
    items,
    sources: sourceResult.rows.map(mapSource),
    activity: activityResult.rows.map(mapActivity),
    relations: relationResult.rows.map((row) => ({
      id: String(row.id),
      source: String(row.source),
      target: String(row.target),
      type: String(row.type),
      relation_origin: relationOrigin(row.relation_origin, row.origin),
      confirmed_at: iso(row.confirmed_at),
    })),
    revisions: revisionResult.rows.map(mapRevision),
    supersessions: supersessionResult.rows.map((row) => ({
      id: String(row.id),
      superseded_item_id: String(row.superseded_item_id),
      replacement_item_id: String(row.replacement_item_id),
      reason: row.reason ? String(row.reason) : null,
      created_at: iso(row.created_at) ?? new Date(0).toISOString(),
    })),
    evidence_selectors: evidenceResult.rows.map(mapEvidenceSelector),
  });
}

function sortTopicSummaries(summaries: ActiveKnowledgeTopicSummary[]) {
  return summaries.sort((left, right) => right.last_updated_at.localeCompare(left.last_updated_at)
    || left.topic.localeCompare(right.topic));
}

export async function getActiveKnowledgeTopicSummariesForUser(
  userId: string,
): Promise<ActiveKnowledgeTopicSummary[]> {
  if (!userId) throw new Error('A user is required.');

  if (!process.env.DATABASE_URL) {
    purgeMemoryKnowledgeItemsForUser(userId);
    const supersededIds = new Set(getMemoryKnowledgeSupersessionsForUser(userId)
      .map((entry) => entry.superseded_item_id));
    const activeItems = getMemoryKnowledgeItemsForUser(userId)
      .filter((item) => !item.deleted_at && !item.archived_at && !supersededIds.has(item.id));
    const activeItemIds = new Set(activeItems.map((item) => item.id));
    const sourceCountByItem = new Map<string, number>();
    for (const source of getMemoryKnowledgeSourcesForUser(userId, activeItemIds)) {
      sourceCountByItem.set(
        source.knowledge_item_id,
        (sourceCountByItem.get(source.knowledge_item_id) ?? 0) + 1,
      );
    }
    const grouped = new Map<string, typeof activeItems>();
    for (const item of activeItems) {
      const entries = grouped.get(item.topic) ?? [];
      entries.push(item);
      grouped.set(item.topic, entries);
    }
    return sortTopicSummaries(Array.from(grouped.entries()).map(([topic, topicItems]) => {
      const sortedItems = [...topicItems].sort((left, right) => newestFirst(
        left.updated_at, right.updated_at, left.id, right.id,
      ));
      return {
        topic,
        item_count: sortedItems.length,
        open_question_count: sortedItems.filter((item) => item.knowledge_type === 'question'
          && item.structured_content?.type === 'question'
          && item.structured_content.status === 'open').length,
        decision_count: sortedItems.filter((item) => item.knowledge_type === 'decision').length,
        event_count: sortedItems.filter((item) => item.knowledge_type === 'event').length,
        source_count: sortedItems.reduce(
          (count, item) => count + (sourceCountByItem.get(item.id) ?? 0),
          0,
        ),
        last_updated_at: sortedItems[0]?.updated_at ?? EPOCH_ISO,
        sample_titles: sortedItems.slice(0, 3).map((item) => item.title),
      };
    }));
  }

  const result = await pool.query<Record<string, unknown>>(
    `WITH active_items AS (
       SELECT i.id, i.topic, i.title, i.knowledge_type, i.structured_content, i.updated_at
       FROM user_knowledge_items i
       WHERE i.user_id = $1 AND i.deleted_at IS NULL AND i.archived_at IS NULL
         AND (i.purge_at IS NULL OR i.purge_at > NOW())
         AND NOT EXISTS (
           SELECT 1 FROM knowledge_item_supersessions s
           WHERE s.user_id = i.user_id AND s.superseded_item_id = i.id
         )
     ), source_counts AS (
       SELECT s.knowledge_item_id, COUNT(*)::integer AS source_count
       FROM knowledge_card_sources s
       JOIN active_items i ON i.id = s.knowledge_item_id
       WHERE s.user_id = $1
       GROUP BY s.knowledge_item_id
     )
     SELECT i.topic,
       COUNT(*)::integer AS item_count,
       (COUNT(*) FILTER (
         WHERE i.knowledge_type = 'question'
           AND i.structured_content ->> 'type' = 'question'
           AND i.structured_content ->> 'status' = 'open'
       ))::integer AS open_question_count,
       (COUNT(*) FILTER (WHERE i.knowledge_type = 'decision'))::integer AS decision_count,
       (COUNT(*) FILTER (WHERE i.knowledge_type = 'event'))::integer AS event_count,
       COALESCE(SUM(s.source_count), 0)::integer AS source_count,
       MAX(i.updated_at) AS last_updated_at,
       (ARRAY_AGG(i.title ORDER BY i.updated_at DESC, i.id))[1:3] AS sample_titles
     FROM active_items i
     LEFT JOIN source_counts s ON s.knowledge_item_id = i.id
     GROUP BY i.topic
     ORDER BY MAX(i.updated_at) DESC, i.topic`,
    [userId],
  );
  return sortTopicSummaries(result.rows.map((row) => ({
    topic: String(row.topic),
    item_count: Number(row.item_count ?? 0),
    open_question_count: Number(row.open_question_count ?? 0),
    decision_count: Number(row.decision_count ?? 0),
    event_count: Number(row.event_count ?? 0),
    source_count: Number(row.source_count ?? 0),
    last_updated_at: iso(row.last_updated_at) ?? EPOCH_ISO,
    sample_titles: Array.isArray(row.sample_titles)
      ? row.sample_titles.filter((title): title is string => typeof title === 'string').slice(0, 3)
      : [],
  })));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => [key, stableValue(nested)]));
}

export function stableKnowledgeJson(value: unknown) {
  return JSON.stringify(stableValue(value), null, 2);
}

function yamlScalar(value: unknown) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(String(value));
}

function toYaml(value: unknown, depth = 0): string {
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}[]`;
    return value.map((entry) => {
      if (entry && typeof entry === 'object') return `${indent}-\n${toYaml(entry, depth + 1)}`;
      return `${indent}- ${yamlScalar(entry)}`;
    }).join('\n');
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) return `${indent}{}`;
    return entries.map(([key, entry]) => {
      if (entry && typeof entry === 'object') return `${indent}${JSON.stringify(key)}:\n${toYaml(entry, depth + 1)}`;
      return `${indent}${JSON.stringify(key)}: ${yamlScalar(entry)}`;
    }).join('\n');
  }
  return `${indent}${yamlScalar(value)}`;
}

function markdownHub(hub: TopicKnowledgeHub) {
  const lines = [`# ${hub.topic}`, '', `Generated: ${hub.generated_at}`, ''];
  for (const item of hub.items) {
    lines.push(`## ${item.title}`, '');
    if (item.knowledge_type) lines.push(`- Type: ${item.knowledge_type}`);
    if (item.central_question) lines.push(`- Central question: ${item.central_question}`);
    lines.push(`- Version: ${item.version}`);
    if (item.last_verified_at) lines.push(`- Last verified: ${item.last_verified_at}`);
    if (item.summary) lines.push('', item.summary);
    if (item.content) lines.push('', item.content);
    const sources = hub.sources.filter((source) => source.knowledge_item_id === item.id);
    if (sources.length > 0) {
      lines.push('', '### Sources', '');
      for (const source of sources) {
        const location = source.source_url ?? source.conversation_ref ?? source.provider;
        lines.push(`- ${source.provider}: ${location}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function serializeTopicKnowledgeHub(hub: TopicKnowledgeHub, format: KnowledgeContextFormat): string {
  if (format === 'json') return `${stableKnowledgeJson(hub)}\n`;
  if (format === 'yaml') return `${toYaml(stableValue(hub))}\n`;
  return markdownHub(hub);
}

function sanitizeActivityMetadataForVisibleItems(
  metadata: Record<string, unknown>,
  selectedItemIds: Set<string>,
  knownPrivateItemIds: Set<string>,
): Record<string, unknown> {
  const sanitize = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string') {
      const personalId = value.startsWith('personal:') ? value.slice('personal:'.length) : value;
      const isItemReference = knownPrivateItemIds.has(personalId)
        || /(?:^|_)item_ids?$/u.test(key);
      return isItemReference && !selectedItemIds.has(personalId) ? undefined : value;
    }
    if (Array.isArray(value)) {
      return value.map((entry) => sanitize(entry, key)).filter((entry) => entry !== undefined);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .map(([nestedKey, nestedValue]) => [nestedKey, sanitize(nestedValue, nestedKey)] as const)
        .filter(([, nestedValue]) => nestedValue !== undefined));
    }
    return value;
  };
  return sanitize(metadata) as Record<string, unknown>;
}

export async function buildTopicKnowledgeContextPackForUser(
  userId: string,
  topic: string,
  options: ContextPackOptions = {},
): Promise<TopicKnowledgeHub> {
  const defaultMaxItems = boundedLimit(options.maxItems, DEFAULT_CONTEXT_PACK_ITEMS, MAX_CONTEXT_PACK_ITEMS);
  const selectedIds = [...new Set(options.itemIds?.map((id) => id.trim()).filter(Boolean)
    .slice(0, MAX_CONTEXT_PACK_ITEMS) ?? [])];
  const maxItems = selectedIds.length > 0 ? selectedIds.length : defaultMaxItems;
  const selected = selectedIds.length > 0
    ? new Set(selectedIds)
    : null;
  const hub = await getTopicKnowledgeHubForUser(userId, topic, {
    includeArchived: options.includeArchived,
    includeSuperseded: options.includeSuperseded,
    maxItems,
    ...(selected ? { itemIds: selectedIds } : {}),
  });
  const items = hub.items.filter((item) => !selected || selected.has(item.id)).slice(0, maxItems);
  const itemIds = new Set(items.map((item) => item.id));
  const knownPrivateItemIds = new Set([
    ...hub.items.map((item) => item.id),
    ...hub.revisions.map((revision) => revision.knowledge_item_id),
    ...hub.supersessions.flatMap((entry) => [entry.superseded_item_id, entry.replacement_item_id]),
    ...hub.relations.flatMap((relation) => [relation.source, relation.target]
      .filter((endpoint) => endpoint.startsWith('personal:'))
      .map((endpoint) => endpoint.slice('personal:'.length))),
  ]);
  const result = finalizeTopicKnowledgeHub(hub.topic, {
    items,
    sources: hub.sources.filter((source) => itemIds.has(source.knowledge_item_id)),
    activity: hub.activity
      .filter((entry) => itemIds.has(entry.knowledge_item_id))
      .map((entry) => ({
        ...entry,
        metadata: sanitizeActivityMetadataForVisibleItems(entry.metadata, itemIds, knownPrivateItemIds),
      })),
    revisions: hub.revisions.filter((revision) => itemIds.has(revision.knowledge_item_id)),
    supersessions: hub.supersessions.filter((entry) => itemIds.has(entry.superseded_item_id)
      && itemIds.has(entry.replacement_item_id)),
    evidence_selectors: hub.evidence_selectors.filter((entry) => itemIds.has(entry.knowledge_item_id)),
    relations: hub.relations.filter((relation) => {
      const privateItemId = (endpoint: string) => endpoint.startsWith('personal:')
        ? endpoint.slice('personal:'.length)
        : null;
      const sourceId = privateItemId(relation.source);
      const targetId = privateItemId(relation.target);
      if (sourceId && !itemIds.has(sourceId)) return false;
      if (targetId && !itemIds.has(targetId)) return false;
      return Boolean((sourceId && itemIds.has(sourceId)) || (targetId && itemIds.has(targetId)));
    }),
  });
  const maxBytes = boundedLimit(options.maxBytes, MAX_CONTEXT_PACK_BYTES, MAX_CONTEXT_PACK_BYTES);
  if (new TextEncoder().encode(stableKnowledgeJson(result)).byteLength > maxBytes) {
    throw new Error('The selected context pack exceeds the configured size limit.');
  }
  return result;
}
