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
const PRE_CONFIRMATION_IMPORT_EVENTS = [
  'conversation_import_started',
  'conversation_import_parsed',
] as const;

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

function opaqueSubject(userId: string, subjectId: string) {
  return createHash('sha256').update(`${userId}\u0000${subjectId}`).digest('hex');
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
      subjectId: opaqueSubject(userId, event.subjectId),
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
      opaqueSubject(userId, event.subjectId),
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

export async function deleteKnowledgeProductEventsForSubjectForUser(
  userId: string,
  subjectId: string,
): Promise<number> {
  if (!userId || !subjectId || subjectId.length > 240) throw new Error('A bounded owner event subject is required.');
  const subjectHash = opaqueSubject(userId, subjectId);
  if (!process.env.DATABASE_URL) {
    const existing = memoryEvents.get(userId) ?? [];
    const retained = existing.filter((event) => event.subjectId !== subjectHash);
    if (retained.length > 0) memoryEvents.set(userId, retained);
    else memoryEvents.delete(userId);
    return existing.length - retained.length;
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
  const subjectHash = opaqueSubject(userId, subjectId);
  if (!process.env.DATABASE_URL) {
    const existing = memoryEvents.get(userId) ?? [];
    const retained = existing.filter((event) => (
      event.subjectId !== subjectHash
      || !PRE_CONFIRMATION_IMPORT_EVENTS.includes(
        event.eventName as (typeof PRE_CONFIRMATION_IMPORT_EVENTS)[number],
      )
    ));
    if (retained.length > 0) memoryEvents.set(userId, retained);
    else memoryEvents.delete(userId);
    return existing.length - retained.length;
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
  const fromSubjectHash = opaqueSubject(userId, fromSubjectId);
  const toSubjectHash = opaqueSubject(userId, toSubjectId);
  if (!process.env.DATABASE_URL) {
    let reassigned = 0;
    for (const event of memoryEvents.get(userId) ?? []) {
      if (event.subjectId !== fromSubjectHash
        || !PRE_CONFIRMATION_IMPORT_EVENTS.includes(
          event.eventName as (typeof PRE_CONFIRMATION_IMPORT_EVENTS)[number],
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

export async function getDismissedKnowledgeSignalIdsForUser(
  userId: string,
  signalIdsInput: string[],
): Promise<Set<string>> {
  const signalIds = [...new Set(signalIdsInput.filter((id) => /^kis_[a-z0-9]+$/.test(id)).slice(0, 8))];
  if (!userId || signalIds.length === 0) return new Set();
  const hashes = new Map(signalIds.map((id) => [opaqueSubject(userId, id), id]));
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
