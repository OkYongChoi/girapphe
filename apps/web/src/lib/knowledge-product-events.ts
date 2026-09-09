import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import {
  parseKnowledgeProductEventInput,
  type KnowledgeProductEventInput,
} from '@stem-brain/shared/ai-thinking-history';
import db from '@/lib/db';

const MAX_EVENTS_PER_BATCH = 10;
const MAX_EVENTS_PER_HOUR = 120;
const MAX_EVENTS_PER_OWNER = 50_000;
const CHATGPT_EXPORT_SESSION_EVENT_DOMAIN = 'girapphe:chatgpt-export-session-event:v1';
const IMPORT_START_PARSE_EVENTS = [
  'conversation_import_started',
  'conversation_import_parsed',
] as const;
type ChatGptExportSessionEventName =
  | (typeof IMPORT_START_PARSE_EVENTS)[number]
  | 'conversation_import_confirmed'
  | 'conversation_import_candidates_ready';

type StoredKnowledgeProductEvent = KnowledgeProductEventInput & {
  id: string;
  userId: string;
  subjectId: string;
  createdAt: string;
};

const memoryEvents = new Map<string, StoredKnowledgeProductEvent[]>();

export class KnowledgeProductEventLimitError extends Error {
  constructor() {
    super('Knowledge product event limit exceeded.');
    this.name = 'KnowledgeProductEventLimitError';
  }
}

export function knowledgeProductEventSubjectHash(userId: string, subjectId: string) {
  return createHash('sha256').update(`${userId}\u0000${subjectId}`).digest('hex');
}

function removeMemoryEventsForSubject(
  userId: string,
  subjectHash: string,
  eventNames?: readonly string[],
): number {
  const existing = memoryEvents.get(userId) ?? [];
  const retained = existing.filter((event) => (
    event.subjectId !== subjectHash
    || (eventNames !== undefined && !eventNames.includes(event.eventName))
  ));
  if (retained.length > 0) memoryEvents.set(userId, retained);
  else memoryEvents.delete(userId);
  return existing.length - retained.length;
}

export function deleteMemoryKnowledgeProductEventsForSubjectForUser(
  userId: string,
  subjectId: string,
): number {
  return removeMemoryEventsForSubject(
    userId,
    knowledgeProductEventSubjectHash(userId, subjectId),
  );
}

export function getMemoryKnowledgeProductEventsForTesting(userId: string) {
  return (memoryEvents.get(userId) ?? []).map((event) => ({ ...event }));
}

export function clearMemoryKnowledgeProductEventsForTesting(userId?: string) {
  if (userId) memoryEvents.delete(userId);
  else memoryEvents.clear();
}

export async function recordKnowledgeProductEventsForUser(
  userId: string,
  values: unknown[],
): Promise<number> {
  if (!userId || !Array.isArray(values) || values.length < 1 || values.length > MAX_EVENTS_PER_BATCH) {
    throw new Error('A bounded owner event batch is required.');
  }
  const events = values.map(parseKnowledgeProductEventInput);
  const now = new Date();

  if (!process.env.DATABASE_URL) {
    const existing = memoryEvents.get(userId) ?? [];
    const hourAgo = now.getTime() - 60 * 60 * 1_000;
    const recentCount = existing.filter((event) => Date.parse(event.createdAt) >= hourAgo).length;
    if (existing.length + events.length > MAX_EVENTS_PER_OWNER
      || recentCount + events.length > MAX_EVENTS_PER_HOUR) {
      throw new KnowledgeProductEventLimitError();
    }
    existing.push(...events.map((event) => ({
      ...event,
      id: randomUUID(),
      userId,
      subjectId: knowledgeProductEventSubjectHash(userId, event.subjectId),
      createdAt: now.toISOString(),
    })));
    memoryEvents.set(userId, existing);
    return events.length;
  }

  const params: unknown[] = [userId];
  const rows = events.map((event, index) => {
    const start = 2 + index * 6;
    params.push(
      randomUUID(),
      event.eventName,
      knowledgeProductEventSubjectHash(userId, event.subjectId),
      event.signalType ?? null,
      event.outcome ?? null,
      event.selectionCount ?? null,
    );
    return `($${start}::text, $1::text, $${start + 1}::text, 1::integer, $${start + 2}::text, $${start + 3}::text, $${start + 4}::text, $${start + 5}::integer)`;
  });
  const [result] = await db.accountTransaction<{ id: string }>(userId, [{
    text: `INSERT INTO knowledge_product_events
      (id, user_id, event_name, event_version, subject_id, signal_type, outcome, selection_count)
     SELECT candidate.* FROM (VALUES ${rows.join(', ')}) AS candidate
      (id, user_id, event_name, event_version, subject_id, signal_type, outcome, selection_count)
     WHERE (SELECT COUNT(*) FROM knowledge_product_events WHERE user_id = $1) + ${events.length} <= ${MAX_EVENTS_PER_OWNER}
       AND (SELECT COUNT(*) FROM knowledge_product_events
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 hour') + ${events.length} <= ${MAX_EVENTS_PER_HOUR}
     RETURNING id`,
    params,
  }]);
  if (result.rows.length !== events.length) throw new KnowledgeProductEventLimitError();
  return result.rows.length;
}

export async function recordKnowledgeProductEventForUser(userId: string, value: unknown) {
  return recordKnowledgeProductEventsForUser(userId, [value]);
}

function chatGptExportSessionEventId(
  userId: string,
  importSessionId: string,
  batchId: string,
  eventName: ChatGptExportSessionEventName,
) {
  return createHash('sha256')
    .update(`${CHATGPT_EXPORT_SESSION_EVENT_DOMAIN}\u0000${userId}\u0000${importSessionId}\u0000${batchId}\u0000${eventName}`)
    .digest('hex');
}

export async function deleteKnowledgeProductEventsForSubjectForUser(
  userId: string,
  subjectId: string,
): Promise<number> {
  if (!userId || !subjectId || subjectId.length > 240) throw new Error('A bounded owner event subject is required.');
  const subjectHash = knowledgeProductEventSubjectHash(userId, subjectId);
  if (!process.env.DATABASE_URL) {
    return removeMemoryEventsForSubject(userId, subjectHash);
  }
  const [result] = await db.accountTransaction<{ id: string }>(userId, [{
    text: `DELETE FROM knowledge_product_events
           WHERE user_id = $1 AND subject_id = $2
           RETURNING id`,
    params: [userId, subjectHash],
  }]);
  return result.rows.length;
}

export async function deletePreConfirmationImportEventsForSubjectForUser(
  userId: string,
  subjectId: string,
): Promise<number> {
  if (!userId || !subjectId || subjectId.length > 240) {
    throw new Error('A bounded owner event subject is required.');
  }
  const subjectHash = knowledgeProductEventSubjectHash(userId, subjectId);
  if (!process.env.DATABASE_URL) {
    return removeMemoryEventsForSubject(userId, subjectHash, IMPORT_START_PARSE_EVENTS);
  }
  const [result] = await db.accountTransaction<{ id: string }>(userId, [{
    text: `DELETE FROM knowledge_product_events
           WHERE user_id = $1 AND subject_id = $2
             AND event_name IN ('conversation_import_started', 'conversation_import_parsed')
           RETURNING id`,
    params: [userId, subjectHash],
  }]);
  return result.rows.length;
}

export async function reassignKnowledgeProductEventsSubjectForUser(
  userId: string,
  fromSubjectId: string,
  toSubjectId: string,
): Promise<number> {
  if (!userId || !fromSubjectId || !toSubjectId
    || fromSubjectId.length > 240 || toSubjectId.length > 240) {
    throw new Error('Bounded owner event subjects are required.');
  }
  if (fromSubjectId === toSubjectId) return 0;
  const fromSubjectHash = knowledgeProductEventSubjectHash(userId, fromSubjectId);
  const toSubjectHash = knowledgeProductEventSubjectHash(userId, toSubjectId);
  if (!process.env.DATABASE_URL) {
    let reassigned = 0;
    for (const event of memoryEvents.get(userId) ?? []) {
      if (event.subjectId !== fromSubjectHash
        || !IMPORT_START_PARSE_EVENTS.includes(
          event.eventName as (typeof IMPORT_START_PARSE_EVENTS)[number],
        )) continue;
      event.subjectId = toSubjectHash;
      reassigned += 1;
    }
    return reassigned;
  }
  const [result] = await db.accountTransaction<{ id: string }>(userId, [{
    text: `UPDATE knowledge_product_events
           SET subject_id = $3
           WHERE user_id = $1 AND subject_id = $2
             AND event_name IN ('conversation_import_started', 'conversation_import_parsed')
           RETURNING id`,
    params: [userId, fromSubjectHash, toSubjectHash],
  }]);
  return result.rows.length;
}

type ChatGptExportCompletionEventInput = {
  importSessionId: string;
  batchId: string;
  parsedExchangeCount?: number;
  selectionCount: number;
  created: boolean;
  draftCount: number;
};

type ChatGptExportCompletionEventOptions = {
  memoryBatchExists: () => boolean;
};

export async function finalizeChatGptExportCompletionEventsForUser(
  userId: string,
  completion: ChatGptExportCompletionEventInput,
  options: ChatGptExportCompletionEventOptions,
): Promise<number> {
  if (!userId
    || !completion.importSessionId
    || completion.importSessionId.length > 240
    || !completion.batchId
    || completion.batchId.length > 240
    || !Number.isInteger(completion.selectionCount)
    || completion.selectionCount < 1
    || completion.selectionCount > 100_000
    || (completion.parsedExchangeCount !== undefined
      && (!Number.isInteger(completion.parsedExchangeCount)
        || completion.parsedExchangeCount < completion.selectionCount
        || completion.parsedExchangeCount > 100_000))) {
    throw new Error('Bounded owner import event subjects are required.');
  }
  const eventValues = [
    ...(completion.parsedExchangeCount === undefined ? [] : [{
      eventName: 'conversation_import_started',
      eventVersion: 1,
      subjectId: completion.batchId,
    }, {
      eventName: 'conversation_import_parsed',
      eventVersion: 1,
      subjectId: completion.batchId,
      selectionCount: completion.parsedExchangeCount,
    }]), {
    eventName: 'conversation_import_confirmed',
    eventVersion: 1,
    subjectId: completion.batchId,
    selectionCount: completion.selectionCount,
  }, ...(completion.created ? [{
    eventName: 'conversation_import_candidates_ready',
    eventVersion: 1,
    subjectId: completion.batchId,
    selectionCount: completion.draftCount,
  }] : [])];
  const events = eventValues.map((value) => {
    const event = parseKnowledgeProductEventInput(value);
    return {
      ...event,
      id: chatGptExportSessionEventId(
        userId,
        completion.importSessionId,
        completion.batchId,
        event.eventName as ChatGptExportSessionEventName,
      ),
    };
  });
  const now = new Date();
  const sessionSubjectHash = knowledgeProductEventSubjectHash(userId, completion.importSessionId);
  const batchSubjectHash = knowledgeProductEventSubjectHash(userId, completion.batchId);

  if (!process.env.DATABASE_URL) {
    const existing = memoryEvents.get(userId) ?? [];
    if (!options.memoryBatchExists()) {
      return removeMemoryEventsForSubject(
        userId,
        sessionSubjectHash,
        IMPORT_START_PARSE_EVENTS,
      );
    }
    for (const event of existing) {
      if (event.subjectId !== sessionSubjectHash
        || !IMPORT_START_PARSE_EVENTS.includes(
          event.eventName as (typeof IMPORT_START_PARSE_EVENTS)[number],
        )) continue;
      event.subjectId = batchSubjectHash;
    }
    const existingIds = new Set(existing.map((event) => event.id));
    const missing = events.filter((event) => !existingIds.has(event.id));
    const hourAgo = now.getTime() - 60 * 60 * 1_000;
    const recentCount = existing.filter((event) => Date.parse(event.createdAt) >= hourAgo).length;
    if (existing.length + missing.length > MAX_EVENTS_PER_OWNER
      || recentCount + missing.length > MAX_EVENTS_PER_HOUR) {
      throw new KnowledgeProductEventLimitError();
    }
    existing.push(...missing.map((event) => ({
      ...event,
      userId,
      subjectId: batchSubjectHash,
      createdAt: now.toISOString(),
    })));
    memoryEvents.set(userId, existing);
    return missing.length;
  }

  const params: unknown[] = [
    userId,
    completion.batchId,
    sessionSubjectHash,
    batchSubjectHash,
  ];
  const rows = events.map((event, index) => {
    const start = 5 + index * 7;
    params.push(
      event.id,
      event.eventName,
      event.eventVersion,
      event.signalType ?? null,
      event.outcome ?? null,
      event.selectionCount ?? null,
      batchSubjectHash,
    );
    return `($${start}::text, $1::text, $${start + 1}::text, $${start + 2}::integer, $${start + 6}::text, $${start + 3}::text, $${start + 4}::text, $${start + 5}::integer)`;
  });
  const resultSets = await db.accountTransaction<{
    batch_exists: boolean;
    quota_available: boolean;
    missing_count: number;
    inserted_count: number;
    reassigned_count: number;
    cleared_count: number;
  }>(userId, [{
    text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
    params: [`knowledge-ingestion:${userId}`],
  }, {
    text: 'SELECT pg_advisory_xact_lock(hashtext($1))',
    params: [`knowledge-import:${userId}:${completion.batchId}`],
  }, {
    text: `WITH owned_batch AS MATERIALIZED (
      SELECT id FROM knowledge_ingestion_batches
      WHERE id = $2 AND user_id = $1 AND provider = 'chatgpt' AND scope = 'selected_export'
      FOR UPDATE
    ), candidates
      (id, user_id, event_name, event_version, subject_id, signal_type, outcome, selection_count)
      AS (VALUES ${rows.join(', ')}),
    missing AS MATERIALIZED (
      SELECT candidate.* FROM candidates candidate
      WHERE NOT EXISTS (
        SELECT 1 FROM knowledge_product_events existing
        WHERE existing.id = candidate.id
      )
    ), eligible_batch AS MATERIALIZED (
      SELECT id FROM owned_batch
      WHERE (SELECT COUNT(*) FROM knowledge_product_events WHERE user_id = $1)
          + (SELECT COUNT(*) FROM missing) <= ${MAX_EVENTS_PER_OWNER}
        AND (SELECT COUNT(*) FROM knowledge_product_events
             WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 hour')
          + (SELECT COUNT(*) FROM missing) <= ${MAX_EVENTS_PER_HOUR}
    ), reassigned AS (
      UPDATE knowledge_product_events SET subject_id = $4
      WHERE user_id = $1 AND subject_id = $3 AND subject_id <> $4
        AND event_name IN ('conversation_import_started', 'conversation_import_parsed')
        AND EXISTS (SELECT 1 FROM owned_batch)
      RETURNING id
    ), cleared AS (
      DELETE FROM knowledge_product_events
      WHERE user_id = $1 AND subject_id = $3
        AND event_name IN ('conversation_import_started', 'conversation_import_parsed')
        AND NOT EXISTS (SELECT 1 FROM owned_batch)
      RETURNING id
    ), inserted AS (
      INSERT INTO knowledge_product_events
        (id, user_id, event_name, event_version, subject_id, signal_type, outcome, selection_count)
      SELECT missing.* FROM missing CROSS JOIN eligible_batch
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    )
    SELECT EXISTS (SELECT 1 FROM owned_batch) AS batch_exists,
      EXISTS (SELECT 1 FROM eligible_batch) AS quota_available,
      (SELECT COUNT(*)::integer FROM missing) AS missing_count,
      (SELECT COUNT(*)::integer FROM inserted) AS inserted_count,
      (SELECT COUNT(*)::integer FROM reassigned) AS reassigned_count,
      (SELECT COUNT(*)::integer FROM cleared) AS cleared_count`,
    params,
  }]);
  const row = resultSets[2].rows[0];
  if (row?.batch_exists && !row.quota_available) throw new KnowledgeProductEventLimitError();
  if (row?.batch_exists && Number(row.inserted_count) !== Number(row.missing_count)) {
    throw new Error('Consented import events could not be recorded idempotently.');
  }
  return Number(row?.inserted_count ?? 0);
}

export async function getDismissedKnowledgeSignalIdsForUser(
  userId: string,
  signalIdsInput: string[],
): Promise<Set<string>> {
  const signalIds = [...new Set(signalIdsInput.filter((id) => /^kis_[a-z0-9]+$/.test(id)).slice(0, 8))];
  if (!userId || signalIds.length === 0) return new Set();
  const hashes = new Map(signalIds.map((id) => [knowledgeProductEventSubjectHash(userId, id), id]));
  if (!process.env.DATABASE_URL) {
    return new Set((memoryEvents.get(userId) ?? [])
      .filter((event) => event.eventName === 'knowledge_signal_dismissed' && hashes.has(event.subjectId))
      .map((event) => hashes.get(event.subjectId)!));
  }
  const result = await db.query<{ subject_id: string }>(
    `SELECT DISTINCT subject_id FROM knowledge_product_events
     WHERE user_id = $1 AND event_name = 'knowledge_signal_dismissed'
       AND subject_id = ANY($2::text[])`,
    [userId, [...hashes.keys()]],
  );
  return new Set(result.rows.flatMap((row) => hashes.get(row.subject_id) ?? []));
}
