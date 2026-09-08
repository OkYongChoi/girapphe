export const SELECTED_CONVERSATION_IMPORT_SCHEMA_VERSION = 1 as const;
export const MAX_SELECTED_CONVERSATION_EXCHANGES = 12;

export type SelectedConversationExchange = {
  conversationRef: string;
  messageRef: string;
  title: string;
  prompt: string;
  response: string;
  occurredAt: string | null;
};

export type SelectedConversationImportResult = {
  schemaVersion: typeof SELECTED_CONVERSATION_IMPORT_SCHEMA_VERSION;
  provider: string;
  sourceKind: 'export';
  consent: true;
  selections: SelectedConversationExchange[];
};

const IMPORT_KEYS = ['schemaVersion', 'provider', 'sourceKind', 'consent', 'selections'] as const;
const EXCHANGE_KEYS = ['conversationRef', 'messageRef', 'title', 'prompt', 'response', 'occurredAt'] as const;
const ABSOLUTE_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function boundedString(value: unknown, maximum: number) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}

function absoluteInstant(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || !ABSOLUTE_DATE_TIME.test(value)) return undefined;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : undefined;
}

function parseSelectedExchange(value: unknown): SelectedConversationExchange | null {
  if (!isRecord(value) || !hasExactKeys(value, EXCHANGE_KEYS)) return null;
  const conversationRef = boundedString(value.conversationRef, 200);
  const messageRef = boundedString(value.messageRef, 200);
  const title = boundedString(value.title, 200);
  const prompt = boundedString(value.prompt, 4_000);
  const response = boundedString(value.response, 4_000);
  const occurredAt = absoluteInstant(value.occurredAt);
  if (!conversationRef || !messageRef || !title || !prompt || !response || occurredAt === undefined) return null;
  return { conversationRef, messageRef, title, prompt, response, occurredAt };
}

export function parseSelectedConversationImportResult(value: unknown): SelectedConversationImportResult {
  if (!isRecord(value) || !hasExactKeys(value, IMPORT_KEYS)) {
    throw new Error('Invalid selected conversation import result.');
  }
  const provider = boundedString(value.provider, 40);
  if (!provider || !/^[a-z0-9][a-z0-9_-]*$/.test(provider)
    || value.schemaVersion !== SELECTED_CONVERSATION_IMPORT_SCHEMA_VERSION
    || value.sourceKind !== 'export'
    || value.consent !== true
    || !Array.isArray(value.selections)
    || value.selections.length < 1
    || value.selections.length > MAX_SELECTED_CONVERSATION_EXCHANGES) {
    throw new Error('Invalid selected conversation import result.');
  }
  const selections = value.selections.map(parseSelectedExchange);
  if (selections.some((selection) => selection === null)) {
    throw new Error('Invalid selected conversation import result.');
  }
  const parsed = selections as SelectedConversationExchange[];
  const unique = new Set(parsed.map((selection) => `${selection.conversationRef}\u0000${selection.messageRef}`));
  if (unique.size !== parsed.length) throw new Error('Invalid selected conversation import result.');
  return { schemaVersion: 1, provider, sourceKind: 'export', consent: true, selections: parsed };
}

export const KNOWLEDGE_INTELLIGENCE_SIGNAL_TYPES = [
  'thought_change',
  'contradiction',
  'connection',
  'rediscovery',
  'topic_emergence',
] as const;

export type KnowledgeIntelligenceSignalType = (typeof KNOWLEDGE_INTELLIGENCE_SIGNAL_TYPES)[number];
export type KnowledgeIntelligenceConfidence = 'high' | 'medium' | 'low';
export type KnowledgeIntelligenceUncertainty =
  | 'revision_comparison'
  | 'confirmed_relation'
  | 'topical_relevance'
  | 'recent_cluster';

export type KnowledgeIntelligenceItem = {
  id: string;
  title: string;
  summary: string;
  content: string;
  topic: string;
  tags: string[];
  centralQuestion: string | null;
  version: number;
  occurredAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceSelectorCount: number;
};

export type KnowledgeIntelligenceRevision = {
  itemId: string;
  version: number;
  title: string;
  summary: string;
  content: string;
  centralQuestion: string | null;
  createdAt: string;
};

export type KnowledgeIntelligenceActivity = {
  itemId: string;
  type: string;
  createdAt: string;
};

export type KnowledgeIntelligenceRelation = {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  type: string;
  origin: 'explicit_user' | 'extracted_from_source' | 'model_inferred';
  confirmedAt: string | null;
  evidenceSelectorCount: number;
};

export type KnowledgeIntelligenceCorpus = {
  items: KnowledgeIntelligenceItem[];
  revisions: KnowledgeIntelligenceRevision[];
  activity: KnowledgeIntelligenceActivity[];
  relations: KnowledgeIntelligenceRelation[];
};

export type KnowledgeIntelligenceEvidence = {
  itemId: string;
  revisionVersion: number | null;
  title: string;
  summary: string;
  topic: string;
  occurredAt: string;
  sourceSelectorCount: number;
};

export type KnowledgeIntelligenceSignal = {
  id: string;
  type: KnowledgeIntelligenceSignalType;
  privacy: 'private';
  topic: string;
  confidence: KnowledgeIntelligenceConfidence;
  uncertainty: KnowledgeIntelligenceUncertainty;
  startedAt: string;
  endedAt: string;
  relationType: string | null;
  evidence: KnowledgeIntelligenceEvidence[];
  contextItemIds: string[];
  score: number;
};

const DAY_MS = 24 * 60 * 60 * 1_000;
const CONNECTION_TYPES = new Set([
  'related', 'generalizes', 'derived_from', 'equivalent_to', 'answers', 'supports',
  'causes', 'contributes_to', 'enables', 'inhibits', 'prerequisite',
]);
const TOKEN_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'but', 'for', 'from', 'have',
  'into', 'not', 'that', 'the', 'their', 'then', 'this', 'was', 'were', 'what',
  'when', 'where', 'which', 'with', 'your',
]);

function instant(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function itemInstant(item: KnowledgeIntelligenceItem) {
  return instant(item.occurredAt) ?? instant(item.updatedAt) ?? instant(item.createdAt) ?? 0;
}

function words(value: string) {
  return new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}#+.-]{2,}/gu) ?? [])
    .filter((token) => !TOKEN_STOP_WORDS.has(token)));
}

function itemWords(item: Pick<KnowledgeIntelligenceItem, 'title' | 'summary' | 'content' | 'centralQuestion'>) {
  return words(`${item.title} ${item.summary} ${item.content} ${item.centralQuestion ?? ''}`);
}

function overlap(left: Set<string>, right: Set<string>) {
  let count = 0;
  for (const token of left) if (right.has(token)) count += 1;
  return count;
}

function similarity(left: Set<string>, right: Set<string>) {
  const intersection = overlap(left, right);
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 1 : intersection / union;
}

function hashPart(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash.toString(36).padStart(7, '0');
}

function signalId(parts: string[]) {
  const value = parts.join('|');
  return `kis_${hashPart(value, 2_166_136_261)}${hashPart([...value].reverse().join(''), 3_335_553_937)}`;
}

function evidenceFromItem(
  item: KnowledgeIntelligenceItem,
  revision?: KnowledgeIntelligenceRevision,
): KnowledgeIntelligenceEvidence {
  return {
    itemId: item.id,
    revisionVersion: revision?.version ?? null,
    title: revision?.title ?? item.title,
    summary: revision?.summary ?? item.summary,
    topic: item.topic,
    occurredAt: revision?.createdAt ?? item.occurredAt ?? item.updatedAt ?? item.createdAt,
    sourceSelectorCount: item.sourceSelectorCount,
  };
}

function orderedDates(evidence: KnowledgeIntelligenceEvidence[]) {
  const dates = evidence.map((entry) => instant(entry.occurredAt)).filter((value): value is number => value !== null);
  const first = dates.length > 0 ? Math.min(...dates) : 0;
  const last = dates.length > 0 ? Math.max(...dates) : first;
  return { startedAt: new Date(first).toISOString(), endedAt: new Date(last).toISOString() };
}

function buildSignal(input: Omit<KnowledgeIntelligenceSignal, 'id' | 'privacy' | 'startedAt' | 'endedAt'> & { idParts: string[] }) {
  const dates = orderedDates(input.evidence);
  return {
    id: signalId([input.type, ...input.idParts]),
    type: input.type,
    privacy: 'private' as const,
    topic: input.topic,
    confidence: input.confidence,
    uncertainty: input.uncertainty,
    ...dates,
    relationType: input.relationType,
    evidence: input.evidence,
    contextItemIds: [...new Set(input.contextItemIds)],
    score: input.score,
  };
}

export function generateKnowledgeIntelligence(
  corpus: KnowledgeIntelligenceCorpus,
  options: { now?: string; maxSignals?: number } = {},
): KnowledgeIntelligenceSignal[] {
  const now = instant(options.now ?? new Date().toISOString()) ?? Date.now();
  const maximum = Math.max(1, Math.min(8, Math.trunc(options.maxSignals ?? 6)));
  const items = corpus.items.filter((item) => item.id && item.topic && item.title);
  const byId = new Map(items.map((item) => [item.id, item]));
  const candidates: KnowledgeIntelligenceSignal[] = [];

  const revisionsByItem = Map.groupBy(
    corpus.revisions.filter((revision) => byId.has(revision.itemId)),
    (revision) => revision.itemId,
  );
  for (const [itemId, revisions] of revisionsByItem) {
    const item = byId.get(itemId)!;
    const ordered = [...revisions].toSorted((left, right) => left.version - right.version || left.createdAt.localeCompare(right.createdAt));
    const first = ordered[0];
    const last = ordered.at(-1)!;
    if (ordered.length < 2 || first.version === last.version) continue;
    const before = itemWords({ ...item, ...first });
    const after = itemWords({ ...item, ...last });
    const materialSimilarity = similarity(before, after);
    if (before.size + after.size < 6 || materialSimilarity > 0.82) continue;
    const evidence = [evidenceFromItem(item, first), evidenceFromItem(item, last)];
    candidates.push(buildSignal({
      idParts: [item.id, String(first.version), String(last.version)],
      type: 'thought_change', topic: item.topic,
      confidence: materialSimilarity < 0.45 ? 'high' : 'medium',
      uncertainty: 'revision_comparison', relationType: null, evidence,
      contextItemIds: [item.id], score: 90 + Math.round((1 - materialSimilarity) * 9),
    }));
  }

  for (const relation of corpus.relations) {
    if (!relation.confirmedAt) continue;
    const source = byId.get(relation.sourceItemId);
    const target = byId.get(relation.targetItemId);
    if (!source || !target || source.topic !== target.topic || source.id === target.id) continue;
    const evidence = [evidenceFromItem(source), evidenceFromItem(target)];
    if (relation.type === 'contradicts') {
      candidates.push(buildSignal({
        idParts: [relation.id, source.id, target.id],
        type: 'contradiction', topic: source.topic,
        confidence: relation.origin === 'explicit_user' ? 'high' : 'medium',
        uncertainty: 'confirmed_relation', relationType: relation.type, evidence,
        contextItemIds: [source.id, target.id], score: 100 + relation.evidenceSelectorCount,
      }));
    } else if (CONNECTION_TYPES.has(relation.type)) {
      candidates.push(buildSignal({
        idParts: [relation.id, source.id, target.id],
        type: 'connection', topic: source.topic,
        confidence: relation.origin === 'model_inferred' ? 'low' : 'medium',
        uncertainty: 'confirmed_relation', relationType: relation.type, evidence,
        contextItemIds: [source.id, target.id], score: 68 + relation.evidenceSelectorCount,
      }));
    }
  }

  const lastReuseByItem = new Map<string, number>();
  for (const entry of corpus.activity) {
    if (entry.type !== 'reused') continue;
    const at = instant(entry.createdAt);
    if (at !== null && at > (lastReuseByItem.get(entry.itemId) ?? 0)) lastReuseByItem.set(entry.itemId, at);
  }
  const recent = items.filter((item) => now - itemInstant(item) >= 0 && now - itemInstant(item) <= 21 * DAY_MS);
  const old = items.filter((item) => now - itemInstant(item) >= 60 * DAY_MS);
  const explicitlyConnected = new Set(corpus.relations.flatMap((relation) => [
    `${relation.sourceItemId}\u0000${relation.targetItemId}`,
    `${relation.targetItemId}\u0000${relation.sourceItemId}`,
  ]));
  for (const current of recent) {
    for (const previous of old) {
      if (current.id === previous.id || current.topic !== previous.topic) continue;
      if (explicitlyConnected.has(`${current.id}\u0000${previous.id}`)) continue;
      if (now - (lastReuseByItem.get(previous.id) ?? 0) < 45 * DAY_MS) continue;
      const sharedTags = previous.tags.filter((tag) => current.tags.includes(tag)).length;
      const sharedWords = overlap(itemWords(current), itemWords(previous));
      if (sharedTags === 0 && sharedWords < 2) continue;
      const evidence = [evidenceFromItem(previous), evidenceFromItem(current)];
      candidates.push(buildSignal({
        idParts: [previous.id, current.id],
        type: 'rediscovery', topic: current.topic,
        confidence: sharedTags > 0 && sharedWords >= 2 ? 'high' : 'medium',
        uncertainty: 'topical_relevance', relationType: null, evidence,
        contextItemIds: [previous.id, current.id], score: 78 + Math.min(8, sharedTags * 3 + sharedWords),
      }));
    }
  }

  const recentByTopic = Map.groupBy(recent, (item) => item.topic);
  for (const [topic, topicItems] of recentByTopic) {
    if (topicItems.length < 2) continue;
    const established = items.some((item) => item.topic === topic && now - itemInstant(item) > 30 * DAY_MS);
    if (established) continue;
    const evidence = [...topicItems]
      .toSorted((left, right) => itemInstant(left) - itemInstant(right))
      .slice(-3)
      .map((item) => evidenceFromItem(item));
    candidates.push(buildSignal({
      idParts: evidence.map((entry) => entry.itemId),
      type: 'topic_emergence', topic, confidence: 'medium',
      uncertainty: 'recent_cluster', relationType: null, evidence,
      contextItemIds: evidence.map((entry) => entry.itemId), score: 60 + Math.min(6, topicItems.length),
    }));
  }

  const seen = new Set<string>();
  const perType = new Map<KnowledgeIntelligenceSignalType, number>();
  const result: KnowledgeIntelligenceSignal[] = [];
  for (const signal of candidates.toSorted((left, right) => right.score - left.score || left.id.localeCompare(right.id))) {
    if (seen.has(signal.id) || (perType.get(signal.type) ?? 0) >= 2) continue;
    seen.add(signal.id);
    perType.set(signal.type, (perType.get(signal.type) ?? 0) + 1);
    result.push(signal);
    if (result.length >= maximum) break;
  }
  return result;
}

export const KNOWLEDGE_PRODUCT_EVENT_NAMES = [
  'conversation_import_started',
  'conversation_import_parsed',
  'conversation_import_confirmed',
  'conversation_import_candidates_ready',
  'conversation_import_first_value_viewed',
  'knowledge_candidate_resolved',
  'knowledge_signal_viewed',
  'knowledge_signal_evidence_opened',
  'knowledge_signal_dismissed',
  'knowledge_context_created',
] as const;

export const KNOWLEDGE_PRODUCT_EVENT_OUTCOMES = [
  'approved', 'merged', 'updated', 'ignored', 'cancelled',
  'unhelpful', 'incorrect', 'scope_changed',
] as const;

export type KnowledgeProductEventName = (typeof KNOWLEDGE_PRODUCT_EVENT_NAMES)[number];
export type KnowledgeProductEventOutcome = (typeof KNOWLEDGE_PRODUCT_EVENT_OUTCOMES)[number];

export type KnowledgeProductEventInput = {
  eventName: KnowledgeProductEventName;
  eventVersion: 1;
  subjectId: string;
  signalType?: KnowledgeIntelligenceSignalType;
  outcome?: KnowledgeProductEventOutcome;
  selectionCount?: number;
};

export type KnowledgeProductMetricEvent = {
  actorId: string;
  eventName: KnowledgeProductEventName;
  subjectId: string;
  createdAt: string;
};

export type KnowledgeProductMetrics = {
  importActivation: number | null;
  reviewActivation: number | null;
  d7Retention: number | null;
  d30Retention: number | null;
  knowledgeReuseRate: number | null;
};

const EVENT_KEYS = new Set(['eventName', 'eventVersion', 'subjectId', 'signalType', 'outcome', 'selectionCount']);

export function parseKnowledgeProductEventInput(value: unknown): KnowledgeProductEventInput {
  if (!isRecord(value) || Object.keys(value).some((key) => !EVENT_KEYS.has(key))) {
    throw new Error('Invalid knowledge product event.');
  }
  const eventName = value.eventName;
  const subjectId = boundedString(value.subjectId, 180);
  const signalType = value.signalType;
  const outcome = value.outcome;
  const selectionCount = value.selectionCount;
  if (!KNOWLEDGE_PRODUCT_EVENT_NAMES.includes(eventName as KnowledgeProductEventName)
    || value.eventVersion !== 1
    || !subjectId
    || !/^[A-Za-z0-9._:-]+$/.test(subjectId)
    || (signalType !== undefined && !KNOWLEDGE_INTELLIGENCE_SIGNAL_TYPES.includes(signalType as KnowledgeIntelligenceSignalType))
    || (outcome !== undefined && !KNOWLEDGE_PRODUCT_EVENT_OUTCOMES.includes(outcome as KnowledgeProductEventOutcome))
    || (selectionCount !== undefined && (!Number.isInteger(selectionCount) || Number(selectionCount) < 0 || Number(selectionCount) > 100_000))) {
    throw new Error('Invalid knowledge product event.');
  }
  const isSignalEvent = eventName === 'knowledge_signal_viewed'
    || eventName === 'knowledge_signal_evidence_opened'
    || eventName === 'knowledge_signal_dismissed';
  if (isSignalEvent !== (signalType !== undefined)) throw new Error('Invalid knowledge product event.');
  if (eventName === 'knowledge_signal_dismissed' && !['unhelpful', 'incorrect', 'scope_changed'].includes(String(outcome))) {
    throw new Error('Invalid knowledge product event.');
  }
  if (eventName === 'knowledge_candidate_resolved' && !['approved', 'merged', 'updated', 'ignored', 'cancelled'].includes(String(outcome))) {
    throw new Error('Invalid knowledge product event.');
  }
  if (outcome !== undefined && eventName !== 'knowledge_signal_dismissed' && eventName !== 'knowledge_candidate_resolved') {
    throw new Error('Invalid knowledge product event.');
  }
  return {
    eventName: eventName as KnowledgeProductEventName,
    eventVersion: 1,
    subjectId,
    ...(signalType ? { signalType: signalType as KnowledgeIntelligenceSignalType } : {}),
    ...(outcome ? { outcome: outcome as KnowledgeProductEventOutcome } : {}),
    ...(selectionCount !== undefined ? { selectionCount: Number(selectionCount) } : {}),
  };
}


function rate(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator;
}

export function computeKnowledgeProductMetrics(events: KnowledgeProductMetricEvent[]): KnowledgeProductMetrics {
  const valid = events.flatMap((event) => {
    if (!event.actorId || !event.subjectId || !KNOWLEDGE_PRODUCT_EVENT_NAMES.includes(event.eventName)) return [];
    const at = Date.parse(event.createdAt);
    return Number.isFinite(at) ? [{ ...event, at }] : [];
  });
  const actors = (eventName: KnowledgeProductEventName) => new Set(
    valid.filter((event) => event.eventName === eventName).map((event) => event.actorId),
  );
  const confirmed = actors('conversation_import_confirmed');
  const activated = actors('conversation_import_first_value_viewed');
  const resolved = actors('knowledge_candidate_resolved');
  const activationAt = new Map<string, number>();
  for (const event of valid.filter((entry) => entry.eventName === 'conversation_import_first_value_viewed')) {
    activationAt.set(event.actorId, Math.min(event.at, activationAt.get(event.actorId) ?? Number.POSITIVE_INFINITY));
  }
  const meaningful = new Set<KnowledgeProductEventName>([
    'knowledge_candidate_resolved',
    'knowledge_signal_evidence_opened',
    'knowledge_signal_dismissed',
    'knowledge_context_created',
  ]);
  function retained(openDay: number, closeDay: number) {
    let count = 0;
    for (const [actorId, startedAt] of activationAt) {
      if (valid.some((event) => event.actorId === actorId && meaningful.has(event.eventName)
        && event.at >= startedAt + openDay * DAY_MS && event.at < startedAt + closeDay * DAY_MS)) count += 1;
    }
    return rate(count, activationAt.size);
  }
  const openedSignals = new Set(valid
    .filter((event) => event.eventName === 'knowledge_signal_evidence_opened')
    .map((event) => `${event.actorId}\u0000${event.subjectId}`));
  const reusedSignals = new Set(valid
    .filter((event) => event.eventName === 'knowledge_context_created')
    .map((event) => `${event.actorId}\u0000${event.subjectId}`)
    .filter((subject) => openedSignals.has(subject)));
  return {
    importActivation: rate(activated.size, confirmed.size),
    reviewActivation: rate([...resolved].filter((actorId) => activated.has(actorId)).length, activated.size),
    d7Retention: retained(7, 14),
    d30Retention: retained(30, 45),
    knowledgeReuseRate: rate(reusedSignals.size, openedSignals.size),
  };
}
