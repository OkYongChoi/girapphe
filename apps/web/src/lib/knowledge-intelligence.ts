import 'server-only';

import {
  generateKnowledgeIntelligence,
  type KnowledgeIntelligenceActivity,
  type KnowledgeIntelligenceCorpus,
  type KnowledgeIntelligenceRevision,
  type KnowledgeIntelligenceSignal,
} from '@stem-brain/shared/ai-thinking-history';
import db from '@/lib/db';
import {
  getMemoryKnowledgeActivityForUser,
  getMemoryKnowledgeEvidenceForUser,
  getMemoryKnowledgeItemsForUser,
  getMemoryKnowledgeRevisionsForUser,
  getPrivateKnowledgeGraphForUser,
} from '@/lib/knowledge-ingestion';
import { getDismissedKnowledgeSignalIdsForUser } from '@/lib/knowledge-product-events';
import { isAiThinkingHistoryEnabledForUser } from '@/lib/ai-thinking-history-rollout';

const MAX_INTELLIGENCE_ITEMS = 240;
const MAX_INTELLIGENCE_SIGNALS = 6;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function iso(value: unknown, fallback = new Date(0).toISOString()) {
  const parsed = value ? Date.parse(String(value)) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

type IntelligenceExtras = {
  revisions: KnowledgeIntelligenceRevision[];
  activity: KnowledgeIntelligenceActivity[];
  selectorCounts: Map<string, number>;
  updatedAt: Map<string, string>;
};

async function loadExtras(userId: string, itemIds: string[]): Promise<IntelligenceExtras> {
  const selected = new Set(itemIds);
  if (!process.env.DATABASE_URL) {
    const memoryItems = getMemoryKnowledgeItemsForUser(userId);
    const selectorCounts = new Map<string, number>();
    for (const entry of getMemoryKnowledgeEvidenceForUser(userId, selected)) {
      selectorCounts.set(entry.knowledge_item_id, (selectorCounts.get(entry.knowledge_item_id) ?? 0) + 1);
    }
    return {
      revisions: getMemoryKnowledgeRevisionsForUser(userId, selected).map((entry) => ({
        itemId: entry.knowledge_item_id,
        version: entry.version,
        title: entry.snapshot.title,
        summary: entry.snapshot.summary,
        content: entry.snapshot.content,
        centralQuestion: entry.snapshot.central_question,
        createdAt: iso(entry.created_at),
      })),
      activity: getMemoryKnowledgeActivityForUser(userId, selected).map((entry) => ({
        itemId: entry.knowledge_item_id,
        type: entry.activity_type,
        createdAt: iso(entry.created_at),
      })),
      selectorCounts,
      updatedAt: new Map(memoryItems.filter((item) => selected.has(item.id)).map((item) => [item.id, item.updated_at])),
    };
  }

  const [revisionRows, activityRows, selectorRows, itemRows] = await Promise.all([
    db.query<Record<string, unknown>>(
      `SELECT knowledge_item_id, version, snapshot, created_at::text
       FROM knowledge_item_revisions WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])
       ORDER BY knowledge_item_id, version`, [userId, itemIds],
    ),
    db.query<Record<string, unknown>>(
      `SELECT knowledge_item_id, activity_type, created_at::text
       FROM knowledge_item_activity WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])
       ORDER BY created_at`, [userId, itemIds],
    ),
    db.query<Record<string, unknown>>(
      `SELECT knowledge_item_id, COUNT(*)::integer AS selector_count
       FROM knowledge_evidence_spans WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])
       GROUP BY knowledge_item_id`, [userId, itemIds],
    ),
    db.query<Record<string, unknown>>(
      `SELECT id, updated_at::text FROM user_knowledge_items
       WHERE user_id = $1 AND id = ANY($2::text[])`, [userId, itemIds],
    ),
  ]);
  return {
    revisions: revisionRows.rows.map((row) => {
      const snapshot = record(row.snapshot);
      return {
        itemId: stringValue(row.knowledge_item_id),
        version: Number(row.version),
        title: stringValue(snapshot.title),
        summary: stringValue(snapshot.summary),
        content: stringValue(snapshot.content),
        centralQuestion: nullableString(snapshot.central_question),
        createdAt: iso(row.created_at),
      };
    }),
    activity: activityRows.rows.map((row) => ({
      itemId: stringValue(row.knowledge_item_id),
      type: stringValue(row.activity_type),
      createdAt: iso(row.created_at),
    })),
    selectorCounts: new Map(selectorRows.rows.map((row) => [stringValue(row.knowledge_item_id), Number(row.selector_count ?? 0)])),
    updatedAt: new Map(itemRows.rows.map((row) => [stringValue(row.id), iso(row.updated_at)])),
  };
}

export async function buildKnowledgeIntelligenceCorpusForUser(userId: string): Promise<KnowledgeIntelligenceCorpus> {
  if (!userId) throw new Error('A user is required.');
  const graph = await getPrivateKnowledgeGraphForUser(userId);
  const nodes = graph.nodes.slice(0, MAX_INTELLIGENCE_ITEMS);
  const itemIds = nodes.map((node) => node.knowledge_item_id);
  if (itemIds.length === 0) return { items: [], revisions: [], activity: [], relations: [] };
  const extras = await loadExtras(userId, itemIds);
  const selected = new Set(itemIds);
  return {
    items: nodes.map((node) => ({
      id: node.knowledge_item_id,
      title: node.label,
      summary: node.summary,
      content: node.explanation,
      topic: node.topic,
      tags: node.tags,
      centralQuestion: node.central_question,
      version: node.version,
      occurredAt: node.observed_at,
      createdAt: node.created_at,
      updatedAt: extras.updatedAt.get(node.knowledge_item_id) ?? node.created_at,
      sourceSelectorCount: extras.selectorCounts.get(node.knowledge_item_id) ?? 0,
    })),
    revisions: extras.revisions,
    activity: extras.activity,
    relations: graph.edges.flatMap((edge) => {
      if (!edge.source.startsWith('personal:') || !edge.target.startsWith('personal:')) return [];
      const sourceItemId = edge.source.slice('personal:'.length);
      const targetItemId = edge.target.slice('personal:'.length);
      if (!selected.has(sourceItemId) || !selected.has(targetItemId)) return [];
      return [{
        id: edge.id,
        sourceItemId,
        targetItemId,
        type: edge.type,
        origin: edge.relation_origin,
        confirmedAt: edge.confirmed_at,
        evidenceSelectorCount: edge.evidence_span_ids.length,
      }];
    }),
  };
}

export async function getKnowledgeIntelligenceForUser(userId: string): Promise<KnowledgeIntelligenceSignal[]> {
  if (!isAiThinkingHistoryEnabledForUser(userId)) return [];
  const corpus = await buildKnowledgeIntelligenceCorpusForUser(userId);
  const signals = generateKnowledgeIntelligence(corpus, { maxSignals: MAX_INTELLIGENCE_SIGNALS });
  const dismissed = await getDismissedKnowledgeSignalIdsForUser(userId, signals.map((signal) => signal.id));
  return signals.filter((signal) => !dismissed.has(signal.id));
}

export async function getKnowledgeIntelligenceSignalForUser(
  userId: string,
  signalId: string,
): Promise<KnowledgeIntelligenceSignal | null> {
  if (!/^kis_[a-z0-9]+$/.test(signalId)) return null;
  return (await getKnowledgeIntelligenceForUser(userId)).find((signal) => signal.id === signalId) ?? null;
}
