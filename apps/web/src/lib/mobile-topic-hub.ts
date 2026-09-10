import type { TopicKnowledgeHub } from '@/lib/topic-knowledge-hub';
import {
  type MobileKnowledgeCapabilities,
  withMobileKnowledgeCompatibility,
  withMobileRelationCompatibility,
} from '@/lib/mobile-knowledge-capabilities';
import {
  normalizeKnowledgeEvidenceSourceReference,
  normalizeKnowledgeOpaqueReference,
} from '@/lib/knowledge-source-url';

export const MAX_MOBILE_TOPIC_HUB_ITEMS = 200;
export const MAX_MOBILE_TOPIC_HUB_SOURCES = 500;
export const MAX_MOBILE_TOPIC_HUB_ACTIVITY = 500;
export const MAX_MOBILE_TOPIC_HUB_EVIDENCE_SELECTORS = 1000;
export const MAX_MOBILE_TOPIC_HUB_RELATIONS = 500;
export const MAX_MOBILE_RELATION_EVIDENCE_SELECTORS = 24;

const MAX_MOBILE_MESSAGE_REFERENCE_LENGTH = 240;
const MAX_MOBILE_TEXT_POSITION = 10_000_000;
const MAX_MOBILE_LINE_POSITION = 1_000_000;

function strictOpaqueReference(value: unknown): string | null {
  if (typeof value !== 'string'
    || Array.from(value.normalize('NFKC').trim()).length > MAX_MOBILE_MESSAGE_REFERENCE_LENGTH) return null;
  return normalizeKnowledgeOpaqueReference(value, MAX_MOBILE_MESSAGE_REFERENCE_LENGTH);
}

function projectProvenancePosition(
  value: Record<string, unknown> | null,
): Record<string, string | number> | null {
  if (!value) return null;
  const projected: Record<string, string | number> = {};
  const sourceRef = normalizeKnowledgeEvidenceSourceReference(value.source_ref);
  const messageRef = strictOpaqueReference(value.message_ref);
  if (sourceRef) projected.source_ref = sourceRef;
  if (messageRef) projected.message_ref = messageRef;

  const { start, end, line_start: lineStart, line_end: lineEnd } = value;
  if (Number.isSafeInteger(start) && Number.isSafeInteger(end)
    && Number(start) >= 0 && Number(end) > Number(start)
    && Number(end) <= MAX_MOBILE_TEXT_POSITION) {
    projected.start = Number(start);
    projected.end = Number(end);
  }
  if (Number.isSafeInteger(lineStart) && Number.isSafeInteger(lineEnd)
    && Number(lineStart) >= 1 && Number(lineEnd) >= Number(lineStart)
    && Number(lineEnd) <= MAX_MOBILE_LINE_POSITION) {
    projected.line_start = Number(lineStart);
    projected.line_end = Number(lineEnd);
  }
  return Object.keys(projected).length > 0 ? projected : null;
}

function projectEvidencePosition(
  selectorType: TopicKnowledgeHub['evidence_selectors'][number]['selector_type'],
  value: Record<string, unknown>,
): Record<string, string | number> | null {
  const projected = projectProvenancePosition(value);
  if (!projected) return null;
  if (selectorType === 'message') {
    if (typeof projected.message_ref !== 'string') return null;
    return {
      ...(typeof projected.source_ref === 'string' ? { source_ref: projected.source_ref } : {}),
      message_ref: projected.message_ref,
    };
  }
  if (selectorType === 'external_ref') {
    return typeof projected.source_ref === 'string'
      ? { source_ref: projected.source_ref }
      : null;
  }
  if (selectorType === 'text_position') {
    return typeof projected.start === 'number' && typeof projected.end === 'number'
      ? { start: projected.start, end: projected.end }
      : null;
  }
  return typeof projected.line_start === 'number' && typeof projected.line_end === 'number'
    ? { line_start: projected.line_start, line_end: projected.line_end }
    : null;
}

export type MobileTopicHubProjection = Pick<
  TopicKnowledgeHub,
  'topic' | 'generated_at' | 'sources' | 'activity' | 'evidence_selectors'
> & {
  items: TopicKnowledgeHub['items'];
  relations: TopicKnowledgeHub['relations'];
};

export function toMobileTopicHub(
  hub: TopicKnowledgeHub,
  capabilities: MobileKnowledgeCapabilities,
): MobileTopicHubProjection {
  const compatibleRelations = withMobileRelationCompatibility(hub.relations, capabilities)
    .slice(0, MAX_MOBILE_TOPIC_HUB_RELATIONS)
    .map((relation) => ({
      ...relation,
      evidence_span_ids: relation.evidence_span_ids.slice(0, MAX_MOBILE_RELATION_EVIDENCE_SELECTORS),
    }));
  const relationEvidenceIds = new Set(compatibleRelations.flatMap((relation) => relation.evidence_span_ids));
  const boundedEvidence = hub.evidence_selectors
    .flatMap((entry, index) => {
      const selector = projectEvidencePosition(entry.selector_type, entry.selector);
      return selector ? [{ entry, index, selector }] : [];
    })
    .sort((left, right) => Number(relationEvidenceIds.has(right.entry.id)) - Number(relationEvidenceIds.has(left.entry.id))
      || left.index - right.index)
    .slice(0, MAX_MOBILE_TOPIC_HUB_EVIDENCE_SELECTORS);
  const evidenceSourceIds = new Set(boundedEvidence.map(({ entry }) => entry.source_id));
  const relationEvidenceSourceIds = new Set(boundedEvidence
    .filter(({ entry }) => relationEvidenceIds.has(entry.id))
    .map(({ entry }) => entry.source_id));
  const boundedSources = hub.sources
    .map((source, index) => ({ source, index }))
    .sort((left, right) => Number(relationEvidenceSourceIds.has(right.source.id)) - Number(relationEvidenceSourceIds.has(left.source.id))
      || Number(evidenceSourceIds.has(right.source.id)) - Number(evidenceSourceIds.has(left.source.id))
      || left.index - right.index)
    .slice(0, MAX_MOBILE_TOPIC_HUB_SOURCES)
    .map(({ source }) => ({
      id: source.id,
      knowledge_item_id: source.knowledge_item_id,
      source_type: source.source_type,
      provider: source.provider,
      conversation_ref: source.conversation_ref,
      source_url: source.source_url,
      source_locator: projectProvenancePosition(source.source_locator),
      discussed_at: source.discussed_at,
      relation_origin: source.relation_origin,
      confirmed_at: source.confirmed_at,
      created_at: source.created_at,
    }));
  const retainedSourceIds = new Set(boundedSources.map((source) => source.id));
  const evidenceSelectors = boundedEvidence
    .filter(({ entry }) => retainedSourceIds.has(entry.source_id))
    .map(({ entry, selector }) => ({
      id: entry.id,
      knowledge_item_id: entry.knowledge_item_id,
      source_id: entry.source_id,
      selector_type: entry.selector_type,
      selector,
      polarity: entry.polarity,
      quality: entry.quality,
      relation_origin: entry.relation_origin,
      confirmed_at: entry.confirmed_at,
      created_at: entry.created_at,
    }));
  const retainedEvidenceIds = new Set(evidenceSelectors.map((entry) => entry.id));

  return {
    topic: hub.topic,
    generated_at: hub.generated_at,
    items: hub.items
      .slice(0, MAX_MOBILE_TOPIC_HUB_ITEMS)
      .map((item) => withMobileKnowledgeCompatibility(item, capabilities)),
    sources: boundedSources,
    activity: hub.activity
      .slice(0, MAX_MOBILE_TOPIC_HUB_ACTIVITY)
      .map((entry) => ({
        id: entry.id,
        knowledge_item_id: entry.knowledge_item_id,
        activity_type: entry.activity_type,
        metadata: entry.metadata,
        created_at: entry.created_at,
      })),
    relations: compatibleRelations.map((relation) => ({
      id: relation.id,
      source: relation.source,
      target: relation.target,
      type: relation.type,
      relation_origin: relation.relation_origin,
      confirmed_at: relation.confirmed_at,
      evidence_span_ids: relation.evidence_span_ids
        .filter((id) => retainedEvidenceIds.has(id))
        .slice(0, MAX_MOBILE_RELATION_EVIDENCE_SELECTORS),
    })),
    evidence_selectors: evidenceSelectors,
  };
}
